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

## Selected Implementation Approach (Current)

Phase-aligned strategy:

1. Local event pipeline: impression, open, dwell/scroll-depth session events.
2. Lightweight continual learner baseline with bounded replay.
3. Drift-aware update scheduling and anti-collapse controls.
4. Deployment-focused evaluation loop with strict efficiency metrics.
5. TinyML transfer readiness for future STM32 deployment.

## Efficiency-Centric Evaluation Targets

All experiments should report:

1. Ranking quality and adaptation speed.
2. Inference latency and update latency.
3. Memory and persistent storage footprint.
4. Battery/thermal overhead.
5. Privacy guarantees under local-only processing.

## Repository Workflow Requirements

For each change set:

1. Update implementation and documentation artifacts together.
2. Keep README, paper sources, and guidance page synchronized.
3. Export paper PDF after paper changes.
4. Commit and push all updates to this repository.

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

- Current version target for this update cycle: **2.0.1**

Version sync script:

```bash
node scripts/update-version.js <version>
```

## License

MIT License. See [LICENSE](LICENSE).
