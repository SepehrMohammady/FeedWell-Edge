# FeedWell-Edge

FeedWell-Edge is the research version of FeedWell, an Android RSS reader written in React
Native (Expo). It learns how to order the feed on the phone: reading events, topic weights and
title vectors stay on the device.

## What it adds to FeedWell

- On-device learning (`src/edgeml/localLearningService.js`). Reading events (opens, reading time,
  scroll depth) are kept in local storage, at most 5,000 of them. A weight per topic grows with
  opened and read articles, short and long moving averages per topic flag drift, and the feed is
  ranked by topic weight, drift, freshness and whether an article is unread. The user can export
  a snapshot of the learned state.
- Byte-level news encoder (`edge-encoder` branch: `modules/edge-encoder`, `src/edgeml/`). The
  8-bit encoder of [MIND-Edge-Recommender](https://github.com/SepehrMohammady/MIND-Edge-Recommender)
  runs with ONNX Runtime 1.27.0 in a Kotlin module. A user vector is pooled from the most recent
  reads, and its dot product with an article's vector enters the ranking as a content score whose
  weight is set in Settings (default 2).
- Research screen (`edge-encoder` branch: `src/screens/EncoderLabModal.js`). It checks the phone's
  vectors against the laptop's, times the encoder per title and runs a battery test. It needs the
  test file `test_vectors.json` that `scripts/export_app_assets.py` of MIND-Edge-Recommender writes
  next to the model files. The file holds MIND and xMIND titles, so it is copied to the phone by
  hand and is not part of this repository.

## Branches

| Branch | Version | Content |
|---|---|---|
| `main` | 2.0.5 | the on-device learning layer on FeedWell 1.6.22 |
| `rebuild-on-feedwell-1.18` | 2.1.0 | the same layer on FeedWell 1.18.2; installs as `com.feedwelledge.app` next to FeedWell |
| `edge-encoder` | 2.1.0 | adds the byte-level encoder and the content-aware ranking |

## Build

```bash
npm install
npm run android
```

Release build (on Windows `.\gradlew`):

```bash
cd android
./gradlew assembleRelease
```

`node scripts/update-version.js <version>` sets the version in `src/config/version.js`,
`package.json` and `app.json`.

## Licence

MIT, see [LICENSE](LICENSE).
