// Research screen for the on-device news encoder: numerical check against the laptop, latency per title,
// and a battery test (encoder idle, then running). Results are saved as JSON to
// Android/data/com.feedwelledge.app/files/edge_bench/ (read with adb pull) and shown here.
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { validateOnDevice, runLatencyBenchmark, runBatteryTest, batteryNow, saveResult } from '../edgeml/edgeEncoder';

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export default function EncoderLabModal({ visible, onClose, theme }) {
  const [busy, setBusy] = useState(null);
  const [log, setLog] = useState('');
  const colors = theme?.colors || {};
  const append = (line) => setLog((prev) => `${line}\n${prev}`);

  const run = async (label, fn) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      append(`${label}: ERROR ${e?.message || e}`);
    } finally {
      setBusy(null);
    }
  };

  const onValidate = () => run('check', async () => {
    const r = await validateOnDevice();
    const path = saveResult(`check_${stamp()}`, r);
    append(`check: int8 max|d| ${r.int8.maxAbsDiff.toExponential(2)} cos ${r.int8.minCosine.toFixed(6)}; `
      + `fp32 max|d| ${r.fp32.maxAbsDiff.toExponential(2)} cos ${r.fp32.minCosine.toFixed(6)}; `
      + `content scores max|d| int8 ${r.int8.contentScoresMaxAbsDiff.toExponential(2)} `
      + `fp32 ${r.fp32.contentScoresMaxAbsDiff.toExponential(2)} -> ${path}`);
  });

  const onLatency = () => run('latency', async () => {
    await activateKeepAwakeAsync('encoder-lab');
    const rows = await runLatencyBenchmark();
    deactivateKeepAwake('encoder-lab');
    const path = saveResult(`latency_${stamp()}`, { device: 'phone', rows });
    rows.forEach((r) => append(`${r.kind} threads ${r.threads || 'default'}: median ${r.medianMs.toFixed(3)} ms, `
      + `mean ${r.meanMs.toFixed(3)}, p90 ${r.p90Ms.toFixed(3)} (load ${r.loadMs.toFixed(0)} ms)`));
    append(`latency saved -> ${path}`);
  });

  const onBattery = () => run('battery', async () => {
    await activateKeepAwakeAsync('encoder-lab');
    append(`battery test started ${new Date().toLocaleTimeString()}: unplug the cable now; 15 min idle, then 15 min encoding`);
    const r = await runBatteryTest({ seconds: 900, sampleSeconds: 30, kind: 'int8', threads: 1 });
    deactivateKeepAwake('encoder-lab');
    const path = saveResult(`battery_${stamp()}`, r);
    const used = (run) => run.samples[0].chargeCounterUah - run.samples[run.samples.length - 1].chargeCounterUah;
    append(`battery: idle used ${used(r.idle)} uAh, encoding used ${used(r.load)} uAh for ${r.load.titles} titles -> ${path}`);
  });

  const onBatteryNow = () => {
    const b = batteryNow();
    append(`battery now: ${b.capacityPct}% ${b.chargeCounterUah} uAh, ${b.currentNowUa} uA, ${b.voltageMv} mV, plugged ${b.plugged}`);
  };

  const Button = ({ label, onPress }) => (
    <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary || '#2a78d6' }]} onPress={onPress} disabled={!!busy}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background || '#fff' }]}>
        <Text style={[styles.title, { color: colors.text || '#111' }]}>On-device encoder (research)</Text>
        <Text style={[styles.note, { color: colors.textSecondary || '#555' }]}>
          64-5-384 byte-level encoder, 8-bit and full-precision files. Keep the app open during the tests.
        </Text>
        <Button label="1. Check against laptop" onPress={onValidate} />
        <Button label="2. Latency per title" onPress={onLatency} />
        <Button label="3. Battery test (2 x 15 min, unplugged)" onPress={onBattery} />
        <Button label="Battery reading now" onPress={onBatteryNow} />
        {busy && (
          <View style={styles.busy}>
            <ActivityIndicator />
            <Text style={{ color: colors.text || '#111', marginLeft: 8 }}>{`running: ${busy}`}</Text>
          </View>
        )}
        <ScrollView style={styles.log}>
          <Text selectable style={[styles.logText, { color: colors.text || '#111' }]}>{log}</Text>
        </ScrollView>
        <TouchableOpacity style={styles.close} onPress={onClose} disabled={!!busy}>
          <Text style={{ color: colors.primary || '#2a78d6', fontSize: 16 }}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 6 },
  note: { fontSize: 13, marginBottom: 12 },
  button: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, marginVertical: 5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  busy: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  log: { flex: 1, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  logText: { fontFamily: 'monospace', fontSize: 11, paddingTop: 6 },
  close: { alignItems: 'center', paddingVertical: 14 },
});
