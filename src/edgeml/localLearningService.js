import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  EVENTS: 'edgeml_events_v1',
  ACTIVE_SESSIONS: 'edgeml_active_sessions_v1',
  MODEL_STATE: 'edgeml_model_state_v1',
  CURSOR: 'edgeml_cursor_v1',
};

const DRIFT_CONFIG = {
  shortAlpha: 0.3,
  longAlpha: 0.05,
  threshold: 0.35,
  minEventsPerTopic: 5,
};

function createDefaultModelState() {
  return {
    version: 1,
    topicWeights: {},
    updatedAt: null,
    drift: {
      config: { ...DRIFT_CONFIG },
      topicSignals: {},
      flaggedTopics: [],
      eventCount: 0,
      maxDivergence: 0,
      lastComputedAt: null,
    },
  };
}

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

function buildRankingProfile(state = createDefaultModelState()) {
  const topicWeights = { ...(state?.topicWeights || {}) };
  const drift = state?.drift || {};
  const topicSignals = { ...(drift?.topicSignals || {}) };
  const flaggedTopics = Array.isArray(drift?.flaggedTopics) ? drift.flaggedTopics : [];

  return {
    topicWeights,
    topicSignals,
    flaggedTopics,
    updatedAt: state?.updatedAt || null,
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
      titleLength: context.titleLength ?? null,
      hasImage: context.hasImage ?? null,
      language: context.language ?? null,
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
      action: context.action ?? 'preview', // 'preview' or 'read_in_app' or 'browser'
      titleLength: context.titleLength ?? null,
      language: context.language ?? null,
    },
  });
}

export async function startReadSession(article, metadata = {}) {
  const sessions = await readJson(STORAGE_KEYS.ACTIVE_SESSIONS, {});
  sessions[article.id] = {
    startedAt: Date.now(),
    maxScrollPercent: 0,
    article: buildArticleSnapshot(article),
    language: metadata.language ?? null,
    contentLength: metadata.contentLength ?? null,
    translationUsed: false,
    readAloudUsed: false,
    noteTaken: false,
  };
  await writeJson(STORAGE_KEYS.ACTIVE_SESSIONS, sessions);
}

export async function recordFeatureUsage(articleId, feature) {
  const sessions = await readJson(STORAGE_KEYS.ACTIVE_SESSIONS, {});
  const session = sessions[articleId];
  if (!session) return;

  if (feature === 'translate') session.translationUsed = true;
  if (feature === 'read_aloud') session.readAloudUsed = true;
  if (feature === 'note') session.noteTaken = true;

  await writeJson(STORAGE_KEYS.ACTIVE_SESSIONS, sessions);
}

export async function recordSearchQuery(query) {
  await appendEvent({
    type: 'search',
    at: toIsoNow(),
    context: { query },
  });
}

export async function recordStageTransition(fromStage, toStage, dwellSeconds = 0) {
  await appendEvent({
    type: 'stage_transition',
    at: toIsoNow(),
    context: {
      from: fromStage, // 'feed', 'preview', 'reader'
      to: toStage,
      dwellSeconds,
    },
  });
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
      language: session.language ?? null,
      contentLength: session.contentLength ?? null,
      translationUsed: session.translationUsed ?? false,
      readAloudUsed: session.readAloudUsed ?? false,
      noteTaken: session.noteTaken ?? false,
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
  const defaultState = createDefaultModelState();
  const state = await readJson(STORAGE_KEYS.MODEL_STATE, defaultState);
  const baseDrift = state?.drift || {};
  const nextState = {
    ...defaultState,
    ...state,
    topicWeights: { ...(state.topicWeights || {}) },
    drift: {
      ...defaultState.drift,
      ...baseDrift,
      topicSignals: { ...(baseDrift.topicSignals || {}) },
      flaggedTopics: Array.isArray(baseDrift.flaggedTopics) ? [...baseDrift.flaggedTopics] : [],
    },
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

      const previousSignal = nextState.drift.topicSignals[topic] || {
        shortEma: 0,
        longEma: 0,
        divergence: 0,
        lastDelta: 0,
        eventCount: 0,
        lastUpdatedAt: null,
      };

      const shortEma =
        DRIFT_CONFIG.shortAlpha * delta +
        (1 - DRIFT_CONFIG.shortAlpha) * Number(previousSignal.shortEma || 0);
      const longEma =
        DRIFT_CONFIG.longAlpha * delta +
        (1 - DRIFT_CONFIG.longAlpha) * Number(previousSignal.longEma || 0);
      const divergence = Math.abs(shortEma - longEma);

      nextState.drift.topicSignals[topic] = {
        shortEma,
        longEma,
        divergence,
        lastDelta: delta,
        eventCount: Number(previousSignal.eventCount || 0) + 1,
        lastUpdatedAt: evt?.at || toIsoNow(),
      };
      nextState.drift.eventCount = Number(nextState.drift.eventCount || 0) + 1;
      nextState.drift.maxDivergence = Math.max(Number(nextState.drift.maxDivergence || 0), divergence);
    }
    processed += 1;
  }

  nextState.drift.flaggedTopics = Object.entries(nextState.drift.topicSignals || {})
    .filter(([, signal]) => {
      const eventCount = Number(signal?.eventCount || 0);
      const divergence = Number(signal?.divergence || 0);
      return eventCount >= DRIFT_CONFIG.minEventsPerTopic && divergence >= DRIFT_CONFIG.threshold;
    })
    .sort((a, b) => Number(b?.[1]?.divergence || 0) - Number(a?.[1]?.divergence || 0))
    .map(([topic]) => topic)
    .slice(0, 5);
  nextState.drift.lastComputedAt = toIsoNow();

  nextState.updatedAt = toIsoNow();
  await writeJson(STORAGE_KEYS.MODEL_STATE, nextState);
  await writeJson(STORAGE_KEYS.CURSOR, events.length);

  return {
    processedEvents: processed,
    totalEvents: events.length,
    updatedAt: nextState.updatedAt,
    driftFlaggedTopics: nextState.drift.flaggedTopics,
    driftMaxDivergence: Number(Number(nextState.drift.maxDivergence || 0).toFixed(4)),
  };
}

export async function getDriftSummary() {
  const state = await readJson(STORAGE_KEYS.MODEL_STATE, createDefaultModelState());
  const drift = state?.drift || {};
  const topicSignals = drift?.topicSignals || {};
  const strongestTopics = Object.entries(topicSignals)
    .sort((a, b) => Number(b?.[1]?.divergence || 0) - Number(a?.[1]?.divergence || 0))
    .slice(0, 3)
    .map(([topic, signal]) => ({
      topic,
      divergence: Number(Number(signal?.divergence || 0).toFixed(4)),
      shortEma: Number(Number(signal?.shortEma || 0).toFixed(4)),
      longEma: Number(Number(signal?.longEma || 0).toFixed(4)),
      eventCount: Number(signal?.eventCount || 0),
    }));

  return {
    flaggedTopics: Array.isArray(drift?.flaggedTopics) ? drift.flaggedTopics : [],
    strongestTopics,
    maxDivergence: Number(Number(drift?.maxDivergence || 0).toFixed(4)),
    eventCount: Number(drift?.eventCount || 0),
    lastComputedAt: drift?.lastComputedAt || null,
    threshold: Number(drift?.config?.threshold || DRIFT_CONFIG.threshold),
  };
}

export async function getFeedRankingProfile() {
  const state = await readJson(STORAGE_KEYS.MODEL_STATE, createDefaultModelState());
  return buildRankingProfile(state);
}

export function scoreArticleForRanking(article, rankingProfile = {}) {
  const topic = getTopicFromArticle(article);
  const topicWeight = Number(rankingProfile?.topicWeights?.[topic] || 0);
  const divergence = Number(rankingProfile?.topicSignals?.[topic]?.divergence || 0);
  const isDriftFlagged = Array.isArray(rankingProfile?.flaggedTopics) && rankingProfile.flaggedTopics.includes(topic);

  const publishedAt = new Date(article?.publishedDate || article?.pubDate || 0).getTime();
  const hoursSincePublished = Number.isFinite(publishedAt)
    ? Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60))
    : 72;
  const freshnessBoost = Math.max(0, 1.5 - Math.min(hoursSincePublished / 48, 1.5));
  const unreadBoost = article?.isRead ? 0 : 0.35;
  const driftBoost = isDriftFlagged ? Math.max(0.4, divergence * 3) : 0;

  return Number((topicWeight + driftBoost + freshnessBoost + unreadBoost).toFixed(4));
}

export async function getLocalLearningSummary() {
  const events = await readJson(STORAGE_KEYS.EVENTS, []);
  const state = await readJson(STORAGE_KEYS.MODEL_STATE, createDefaultModelState());
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

  const drift = state?.drift || {};
  const strongestDriftTopics = Object.entries(drift?.topicSignals || {})
    .sort((a, b) => Number(b?.[1]?.divergence || 0) - Number(a?.[1]?.divergence || 0))
    .slice(0, 3)
    .map(([topic, signal]) => ({
      topic,
      divergence: Number(Number(signal?.divergence || 0).toFixed(4)),
      eventCount: Number(signal?.eventCount || 0),
    }));

  return {
    totalEvents: events.length,
    eventsLast7Days: sevenDays.length,
    byType,
    modelUpdatedAt: state.updatedAt,
    topTopics,
    drift: {
      flaggedTopics: Array.isArray(drift?.flaggedTopics) ? drift.flaggedTopics : [],
      strongestTopics: strongestDriftTopics,
      maxDivergence: Number(Number(drift?.maxDivergence || 0).toFixed(4)),
      threshold: Number(drift?.config?.threshold || DRIFT_CONFIG.threshold),
      lastComputedAt: drift?.lastComputedAt || null,
    },
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
