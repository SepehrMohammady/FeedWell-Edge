package expo.modules.edgeencoder

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.SystemClock
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * On-device byte-level news encoder (MIND-Edge-Recommender, scripts/export_app_assets.py) and battery readings.
 *
 * A title becomes 128 byte ids (UTF-8 bytes, first 128, id = byte + 1, 0 = padding), the ids are looked up in
 * the 257 x 64 byte table, and the ONNX file maps the embedded sequence (1, 64, 128) and the padding mask
 * (1, 1, 128) to a 384-d news vector. This is the same rule as src/student.text_to_bytes and
 * scripts/export_int8.embed_inputs on the laptop.
 */
class EdgeEncoderModule : Module() {
  private val env: OrtEnvironment by lazy { OrtEnvironment.getEnvironment() }
  private val sessions = HashMap<String, OrtSession>()
  private var table: FloatArray? = null
  private val seqLen = 128
  private val embedDim = 64

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

  override fun definition() = ModuleDefinition {
    Name("EdgeEncoder")

    // Load a model file (file:// URI or path) under a key, and the byte table. threads <= 0: ONNX Runtime default.
    AsyncFunction("load") { key: String, modelPath: String, tablePath: String, threads: Int ->
      val t0 = SystemClock.elapsedRealtimeNanos()
      val opts = OrtSession.SessionOptions()
      if (threads > 0) opts.setIntraOpNumThreads(threads)
      sessions.remove(key)?.close()
      sessions[key] = env.createSession(path(modelPath), opts)
      table = readTable(path(tablePath))
      mapOf(
        "loadMs" to (SystemClock.elapsedRealtimeNanos() - t0) / 1e6,
        "inputs" to sessions[key]!!.inputNames.toList(),
        "threads" to threads,
        "ortVersion" to "1.27.0"
      )
    }

    // News vectors of the given titles (one list of 384 floats per title).
    AsyncFunction("encode") { key: String, titles: List<String> ->
      val s = session(key)
      titles.map { encodeOne(s, it).toList() }
    }

    // Latency per title of the whole path (bytes, lookup, ONNX Runtime run), after warm-up calls.
    AsyncFunction("benchmark") { key: String, titles: List<String>, repeats: Int, warmup: Int ->
      val s = session(key)
      for (i in 0 until warmup) encodeOne(s, titles[i % titles.size])
      val ms = DoubleArray(repeats)
      val t0 = SystemClock.elapsedRealtimeNanos()
      for (i in 0 until repeats) {
        val a = System.nanoTime()
        encodeOne(s, titles[i % titles.size])
        ms[i] = (System.nanoTime() - a) / 1e6
      }
      val wallMs = (SystemClock.elapsedRealtimeNanos() - t0) / 1e6
      val sorted = ms.sorted()
      fun q(p: Double) = sorted[((sorted.size - 1) * p).toInt()]
      mapOf(
        "repeats" to repeats, "warmup" to warmup, "meanMs" to ms.average(), "medianMs" to q(0.5),
        "p10Ms" to q(0.1), "p90Ms" to q(0.9), "p99Ms" to q(0.99), "minMs" to sorted.first(), "maxMs" to sorted.last(),
        "wallMs" to wallMs, "battery" to readBattery()
      )
    }

    Function("battery") { readBattery() }

    // Battery samples every sampleSeconds for `seconds`; with load = true the encoder runs over the titles in a loop.
    AsyncFunction("batteryRun") { key: String, titles: List<String>, seconds: Int, sampleSeconds: Int, load: Boolean ->
      val s = if (load) session(key) else null
      val samples = ArrayList<Map<String, Any?>>()
      val start = SystemClock.elapsedRealtime()
      val end = start + seconds * 1000L
      var nextSample = start
      var count = 0L
      while (SystemClock.elapsedRealtime() < end) {
        if (SystemClock.elapsedRealtime() >= nextSample) {
          samples.add(readBattery() + ("titles" to count.toDouble()))
          nextSample += sampleSeconds * 1000L
        }
        if (s != null) {
          encodeOne(s, titles[(count % titles.size).toInt()])
          count++
        } else {
          Thread.sleep(100)
        }
      }
      samples.add(readBattery() + ("titles" to count.toDouble()))
      mapOf("load" to load, "seconds" to seconds, "titles" to count.toDouble(), "samples" to samples)
    }

    // Write a result as JSON to the app's external files (Android/data/<package>/files/edge_bench/<name>.json).
    Function("saveResult") { name: String, json: String ->
      val dir = File(context.getExternalFilesDir(null), "edge_bench").apply { mkdirs() }
      val file = File(dir, "$name.json")
      file.writeText(json)
      Log.i("EdgeEncoder", "saved ${file.absolutePath} (${json.length} chars)")
      file.absolutePath
    }
  }

  private fun session(key: String) = sessions[key] ?: throw IllegalStateException("model '$key' not loaded")

  private fun path(p: String) = if (p.startsWith("file://")) p.removePrefix("file://") else p

  private fun readTable(path: String): FloatArray {
    val fb = ByteBuffer.wrap(File(path).readBytes()).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
    val out = FloatArray(fb.remaining())
    fb.get(out)
    require(out.size == 257 * embedDim) { "byte table has ${out.size} values, expected ${257 * embedDim}" }
    return out
  }

  private fun byteIds(title: String): IntArray {
    val bytes = title.toByteArray(Charsets.UTF_8)
    val ids = IntArray(seqLen)
    for (i in 0 until minOf(seqLen, bytes.size)) ids[i] = (bytes[i].toInt() and 0xff) + 1
    return ids
  }

  private fun encodeOne(s: OrtSession, title: String): FloatArray {
    val t = table ?: throw IllegalStateException("byte table not loaded")
    val ids = byteIds(title)
    if (ids.all { it == 0 }) return FloatArray(384)
    val x = FloatArray(embedDim * seqLen)            // (1, 64, 128): x[e * 128 + l] = table[ids[l] * 64 + e]
    val mask = FloatArray(seqLen)
    for (l in 0 until seqLen) {
      val row = ids[l] * embedDim
      for (e in 0 until embedDim) x[e * seqLen + l] = t[row + e]
      mask[l] = if (ids[l] != 0) 1f else 0f
    }
    OnnxTensor.createTensor(env, FloatBuffer.wrap(x), longArrayOf(1, embedDim.toLong(), seqLen.toLong())).use { xt ->
      OnnxTensor.createTensor(env, FloatBuffer.wrap(mask), longArrayOf(1, 1, seqLen.toLong())).use { mt ->
        s.run(mapOf("embedded_bytes" to xt, "mask" to mt)).use { result ->
          @Suppress("UNCHECKED_CAST")
          return (result[0].value as Array<FloatArray>)[0]
        }
      }
    }
  }

  private fun readBattery(): Map<String, Any?> {
    val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    return mapOf(
      "timeMs" to System.currentTimeMillis().toDouble(),
      "elapsedMs" to SystemClock.elapsedRealtime().toDouble(),
      "chargeCounterUah" to bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER),
      "currentNowUa" to bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW),
      "currentAvgUa" to bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_AVERAGE),
      "capacityPct" to bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY),
      "voltageMv" to intent?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1),
      "temperatureDeciC" to intent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1),
      "plugged" to intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1),
      "status" to intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
    )
  }
}
