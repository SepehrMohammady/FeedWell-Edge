// Content-aware ranking with the on-device byte-level encoder (research build).
// Each article title becomes a 384-d vector (modules/edge-encoder, 8-bit file, one thread, cached by title);
// the user encoder pools the vectors of the most recent reads into one user vector; an article's content
// score is the dot product of the two, turned into a z-score over the loaded articles so that the setting's
// weight has the same meaning for any feed. The same rule was replayed on MIND clicks in
// MIND-Edge-Recommender (scripts/replay_app.py), which also chose the default weight.
import { Asset } from 'expo-asset';
import EdgeEncoder from '../../modules/edge-encoder';

const NEWS_ENCODER = require('../../assets/models/edge_encoder_v1/news_encoder_int8.onnx');
const BYTE_TABLE = require('../../assets/models/edge_encoder_v1/byte_table.f32');
const USER_ENCODER = require('../../assets/models/edge_encoder_v1/user_encoder.onnx');
const KEY = 'rank';

let ready = null;

async function localUri(moduleId) {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset.localUri || asset.uri;
}

function ensureReady() {
  if (!ready) {
    ready = (async () => {
      await EdgeEncoder.load(KEY, await localUri(NEWS_ENCODER), await localUri(BYTE_TABLE), 1);
      await EdgeEncoder.loadUserEncoder(await localUri(USER_ENCODER));
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

export function cleanTitle(title) {
  return String(title || '').replace(/\s+/g, ' ').trim();
}

// articles: [{ id, title }]; historyTitles: newest last. Returns { scores: Map(id -> z-score), raw, ms, historyUsed }.
export async function computeContentScores(articles, historyTitles) {
  await ensureReady();
  const titles = articles.map((a) => cleanTitle(a.title));
  const res = await EdgeEncoder.contentScores(KEY, historyTitles.map(cleanTitle), titles);
  const raw = res.scores;
  const n = raw.length;
  const mean = n ? raw.reduce((s, x) => s + x, 0) / n : 0;
  const sd = n ? Math.sqrt(raw.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n) : 0;
  const scores = new Map(articles.map((a, i) => [a.id, sd > 0 ? (raw[i] - mean) / sd : 0]));
  return { scores, raw, ms: res.ms, historyUsed: res.historyUsed, newVectors: res.newVectors };
}
