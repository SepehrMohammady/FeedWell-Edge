// On-device byte-level news encoder (research build). Model files come from MIND-Edge-Recommender
// (scripts/export_app_assets.py, artifacts/app/edge_encoder_v1): 64-5-384 byte-CNN, distilled from a
// multilingual sentence encoder and trained on clicks shown in a random one of 15 languages.
// The native side (modules/edge-encoder) does the byte ids, the table lookup and the ONNX Runtime run.
import { Asset } from 'expo-asset';
import EdgeEncoder from '../../modules/edge-encoder';
import testVectors from '../../assets/models/edge_encoder_v1/test_vectors.json';

const MODELS = {
  int8: require('../../assets/models/edge_encoder_v1/news_encoder_int8.onnx'),
  fp32: require('../../assets/models/edge_encoder_v1/news_encoder_fp32.onnx'),
};
const BYTE_TABLE = require('../../assets/models/edge_encoder_v1/byte_table.f32');

async function localUri(moduleId) {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset.localUri || asset.uri;
}

export async function loadEncoder(kind = 'int8', threads = 0, key = kind) {
  return EdgeEncoder.load(key, await localUri(MODELS[kind]), await localUri(BYTE_TABLE), threads);
}

export function encodeTitles(titles, key = 'int8') {
  return EdgeEncoder.encode(key, titles);
}

export function batteryNow() {
  return EdgeEncoder.battery();
}

export function saveResult(name, result) {
  return EdgeEncoder.saveResult(name, JSON.stringify(result, null, 1));
}

function cosine(a, b) {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i += 1) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 1;
}

// Compare the phone's vectors with the laptop's for the test titles (same ONNX Runtime version, 1.27.0).
export async function validateOnDevice() {
  const out = {};
  for (const kind of ['int8', 'fp32']) {
    await loadEncoder(kind, 0, `check_${kind}`);
    const phone = await encodeTitles(testVectors.titles, `check_${kind}`);
    const ref = testVectors.news_vectors[`onnx_${kind}`];
    let maxAbs = 0;
    let minCos = 1;
    phone.forEach((v, i) => {
      v.forEach((x, j) => { maxAbs = Math.max(maxAbs, Math.abs(x - ref[i][j])); });
      if (testVectors.titles[i]) minCos = Math.min(minCos, cosine(v, ref[i]));
    });
    out[kind] = { titles: phone.length, maxAbsDiff: maxAbs, minCosine: minCos };
  }
  return out;
}

const BENCH_TITLES = testVectors.titles.filter(Boolean);

// Latency per title for each model file and thread count.
export async function runLatencyBenchmark({ repeats = 2000, warmup = 200, threadOptions = [1, 2, 4, 0] } = {}) {
  const results = [];
  for (const kind of ['int8', 'fp32']) {
    for (const threads of threadOptions) {
      const key = `bench_${kind}_${threads}`;
      const load = await loadEncoder(kind, threads, key);
      const stats = await EdgeEncoder.benchmark(key, BENCH_TITLES, repeats, warmup);
      results.push({ kind, threads, loadMs: load.loadMs, ...stats });
    }
  }
  return results;
}

// Battery test: `seconds` with the encoder idle (screen on, app open), then the same with the encoder in a loop.
export async function runBatteryTest({ seconds = 900, sampleSeconds = 30, kind = 'int8', threads = 1 } = {}) {
  const key = `battery_${kind}_${threads}`;
  await loadEncoder(kind, threads, key);
  const idle = await EdgeEncoder.batteryRun(key, BENCH_TITLES, seconds, sampleSeconds, false);
  const load = await EdgeEncoder.batteryRun(key, BENCH_TITLES, seconds, sampleSeconds, true);
  return { kind, threads, seconds, idle, load };
}
