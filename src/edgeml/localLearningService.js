import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  EVENTS: 'edgeml_events_v1',
  ACTIVE_SESSIONS: 'edgeml_active_sessions_v1',
  MODEL_STATE: 'edgeml_model_state_v1',
  CURSOR: 'edgeml_cursor_v1',
};

const DEFAULT_MODEL_STATE = {
  version: 1,
  topicWeights: {},
  updatedAt: null,
};

const MAX_STORED_EVENTS = 5000;

async function readJson(key, fallback) {
  try {
    const value = await AsyncStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (error) {
    console.warn(`[EdgeML] Failed to read ${key}:`, error);
    return fallback;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[EdgeML] Failed to write ${key}:`, error);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getTopicFromArticle(article = {}) {
  const category = Array.isArray(article.categories) ? article.categories[0] : null;
  if (category && typeof category === 'string' && category.trim()) {
    return category.trim().toLowerCase();
  }
  if (article.feedTitle && typeof article.feedTitle === 'string') {
    return article.feedTitle.trim().toLowerCase();
  }
  return 'unknown';
}

function toIsoNow() {
  return new Date().toISOString();
}

function buildArticleSnapshot(article = {}) {
  return {
    id: article.id,
    feedTitle: article.feedTitle || null,
    topic: getTopicFromArticle(article),
    publishedDate: article.publishedDate || article.pubDate || null,
  };
}

async function appendEvent(event) {
  const events = await readJson(STORAGE_KEYS.EVENTS, []);
  events.push(event);
  if (events.length > MAX_STORED_EVENTS) {
    events.splice(0, events.length - MAX_STORED_EVENTS);
  }
  await writeJson(STORAGE_KEYS.EVENTS, events);
}

export async function recordImpression(article, context = {}) {
  await appendEvent({
    type: 'impression',
    at: toIsoNow(),
    article: buildArticleSnapshot(article),
    context: {
      rank: context.rank ?? null,
      filter: context.filter ?? 'all',
      sortOrder: context.sortOrder ?? 'newest',
      source: context.source ?? 'feed_list',
    },
  });
}

export async function recordOpen(article, context = {}) {
  await appendEvent({
    type: 'open',
    at: toIsoNow(),
    article: buildArticleSnapshot(article),
    context: {
      rank: context.rank ?? null,
      filter: context.filter ?? 'all',
      sortOrder: context.sortOrder ?? 'newest',
      source: context.source ?? 'feed_list',
    },
  });
}

export async function startReadSession(article) {
  const sessions = await readJson(STORAGE_KEYS.ACTIVE_SESSIONS, {});
  sessions[article.id] = {
    startedAt: Date.now(),
    maxScrollPercent: 0,
    article: buildArticleSnapshot(article),
  };
  await writeJson(STORAGE_KEYS.ACTIVE_SESSIONS, sessions);
}

export async function updateReadSessionScroll(articleId, scrollPercent) {
  const sessions = await readJson(STORAGE_KEYS.ACTIVE_SESSIONS, {});
  const session = sessions[articleId];
  if (!session) return;

  const safeScroll = clamp(Number.isFinite(scrollPercent) ? scrollPercent : 0, 0, 100);
  session.maxScrollPercent = Math.max(session.maxScrollPercent || 0, safeScroll);
  sessions[articleId] = session;
  await writeJson(STORAGE_KEYS.ACTIVE_SESSIONS, sessions);
}

export async function finishReadSession(articleId) {
  const sessions = await readJson(STORAGE_KEYS.ACTIVE_SESSIONS, {});
  const session = sessions[articleId];
  if (!session) return null;

  const dwellSeconds = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
  const completed = (session.maxScrollPercent || 0) >= 80 || dwellSeconds >= 45;

  await appendEvent({
    type: 'read_session',
    at: toIsoNow(),
    article: session.article,
    context: {
      dwellSeconds,
      maxScrollPercent: session.maxScrollPercent || 0,
      completed,
    },
  });

  delete sessions[articleId];
  await writeJson(STORAGE_KEYS.ACTIVE_SESSIONS, sessions);

  return { dwellSeconds, maxScrollPercent: session.maxScrollPercent || 0, completed };
}

export async function purgeExpiredEvents(retentionDays = 30) {
  const events = await readJson(STORAGE_KEYS.EVENTS, []);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const filtered = events.filter(evt => {
    const ts = new Date(evt.at).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
  await writeJson(STORAGE_KEYS.EVENTS, filtered);
  return { before: events.length, after: filtered.length };
}

export async function runContinualLearningStep() {
  const events = await readJson(STORAGE_KEYS.EVENTS, []);
  const cursor = await readJson(STORAGE_KEYS.CURSOR, 0);
  const state = await readJson(STORAGE_KEYS.MODEL_STATE, DEFAULT_MODEL_STATE);
  const nextState = {
    ...state,
    topicWeights: { ...(state.topicWeights || {}) },
  };

  let processed = 0;
  for (let i = cursor; i < events.length; i += 1) {
    const evt = events[i];
    const topic = evt?.article?.topic || 'unknown';
    const current = Number(nextState.topicWeights[topic] || 0);
    let delta = 0;

    if (evt.type === 'open') {
      delta = 0.8;
    } else if (evt.type === 'read_session') {
      const dwell = Number(evt?.context?.dwellSeconds || 0);
      const depth = Number(evt?.context?.maxScrollPercent || 0);
      delta = 0.5 + Math.min(dwell / 90, 1.2) + Math.min(depth / 100, 1.0);
      if (evt?.context?.completed) delta += 0.5;
    }

    if (delta !== 0) {
      nextState.topicWeights[topic] = clamp(current + delta, -20, 20);
    }
    processed += 1;
  }

  nextState.updatedAt = toIsoNow();
  await writeJson(STORAGE_KEYS.MODEL_STATE, nextState);
  await writeJson(STORAGE_KEYS.CURSOR, events.length);

  return {
    processedEvents: processed,
    totalEvents: events.length,
    updatedAt: nextState.updatedAt,
  };
}

export async function getLocalLearningSummary() {
  const events = await readJson(STORAGE_KEYS.EVENTS, []);
  const state = await readJson(STORAGE_KEYS.MODEL_STATE, DEFAULT_MODEL_STATE);
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const sevenDays = events.filter(evt => new Date(evt.at).getTime() >= weekAgo);
  const byType = sevenDays.reduce((acc, evt) => {
    acc[evt.type] = (acc[evt.type] || 0) + 1;
    return acc;
  }, {});

  const topTopics = Object.entries(state.topicWeights || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic, score]) => ({ topic, score: Number(score.toFixed(2)) }));

  return {
    totalEvents: events.length,
    eventsLast7Days: sevenDays.length,
    byType,
    modelUpdatedAt: state.updatedAt,
    topTopics,
  };
}

export async function clearAllLocalLearningData() {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.EVENTS,
    STORAGE_KEYS.ACTIVE_SESSIONS,
    STORAGE_KEYS.MODEL_STATE,
    STORAGE_KEYS.CURSOR,
  ]);
}
