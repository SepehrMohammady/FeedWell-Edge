# FeedWell-Edge Research Repository

## Project Scope

This repository hosts the implementation track for a PhD-oriented research project on:

**On-device continual personalization for recommender systems under strict privacy constraints.**

The working application is an Android RSS reader used as a realistic testbed. The scientific objective is not RSS-specific; RSS is the current input domain used to evaluate methods that should transfer to other content platforms.

## Core Research Goal

Design and validate a deployable recommender pipeline that:

1. Learns continuously from organic on-device behavior.
2. Keeps raw user behavior and model updates on-device only.
3. Mitigates model collapse under concept drift.
4. Meets practical deployment constraints: latency, footprint, storage growth, energy cost, and reproducibility.

## Current Paper Direction

Working title:

**On-Device Continual Personalization for RSS Readers: A TinyML Approach to Privacy-Preserving Recommendation**

Primary paper artifacts:

- [docs/paper/main.tex](docs/paper/main.tex)
- [docs/paper/related-work-matrix.md](docs/paper/related-work-matrix.md)
- [docs/paper/references.bib](docs/paper/references.bib)

Visual architecture and roadmap page:

- [docs/guide/approach-blueprint.html](docs/guide/approach-blueprint.html)

## User Engagement Model

Research-grounded observation of real user behavior in RSS readers identified three stages:

1. **Feed Tab (Stage 1):** Article browsing with filtering, sorting, searching, and scrolling. Dwell time correlates with subject interest, title length, and language.
2. **Article Preview (Stage 2):** Decision point showing article snippet. Actions: read in app, open browser, save, share, or return.
3. **Reader (Stage 3):** Full article consumption with optional translate, read-aloud, notes, bookmark features.

Signal extraction spans all stages with metadata capture: language, title length, content length, feature usage, stage transitions.

## Selected Implementation Approach (Current)

Phase-aligned strategy grounded in **Efficiency Cascade** (Architecture Search + Quantization + Learning):

1. **Phase A (now)**: Local event pipeline with lightweight continual learner, bounded replay.
2. **Phase B (near-term)**: Constrained architecture search (µNAS-inspired) + binarized weight quantization (BNN) to achieve 8-32x compression. Validate phone-side inference latency (<50ms) and update cost (<100ms).
3. **Phase C (research goal)**: Cross-device transfer with STM32 microcontroller; validate reproducibility and generalization claims.

## Efficiency-Centric Evaluation Targets

All experiments should report:

1. Ranking quality and adaptation speed.
2. Inference latency and update latency.
3. Memory and persistent storage footprint.
4. Battery/thermal overhead.
5. Privacy guarantees under local-only processing.

## Repository Workflow Requirements

For each change set (v2.0.2+):

1. Bump version in: `src/config/version.js`, `package.json`, `app.json`.
2. Update documentation: README, paper (if methodology changes), guide, related-work matrix.
3. Export paper PDF: `pdflatex main.tex` in docs/paper/.
4. Build Android release: `cd android; .\gradlew assembleRelease`.
5. Install on device (if available): `adb install -r android/app/build/outputs/apk/release/app-release.apk`.
6. Commit and push all updates.

This synchronized workflow prevents drift between code and documentation.

## Build and Run

```bash
npm install
npm run android
```

Release build:

```bash
cd android
.\gradlew assembleRelease
```

## Versioning

Research track version baseline is now in the 2.x line.

- Current version target for this update cycle: **2.0.2**
- Current version target for this update cycle: **2.0.3**

Version sync script:

```bash
node scripts/update-version.js <version>
```

## License

MIT License. See [LICENSE](LICENSE).
