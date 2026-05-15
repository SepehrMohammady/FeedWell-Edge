# Related Work Matrix (Priority-Sorted, Deployability Focus)

| Priority | Phase | Paper | Core Contribution | Deployment Limitation | Efficiency / Footprint Gap | Planned Response |
|---|---|---|---|---|---|---|
| P1 | Phase A (current) | Continual Learning at the Edge | Edge-side real-time training perspective | Focuses on edge adaptation conceptually but with limited mobile product integration constraints | Insufficient joint analysis of adaptation quality vs battery/thermal/runtime overhead | Implement bounded update scheduling and report adaptation-performance vs resource trade-offs |
| P2 | Phase A (current) | Beyond Explicit and Implicit Feedback | Rich user feedback signal taxonomy for personalization | Rich interaction signals can increase compute/storage overhead if unbounded | Missing compact signal selection strategy for low-footprint continual learning | Use compact event schema (impression/open/dwell-depth) and evaluate utility-cost trade-offs |
| P3 | Phase A (current) | Privacy-Preserving News Recommendation | Privacy-aware recommendation learning design | Often relies on broader coordination assumptions beyond strict local-only operation | Limited evidence for zero-export local pipelines with measurable on-device cost envelopes | Enforce strict local-only behavior/data pipeline and quantify its utility/efficiency impact |
| P4 | Phase A (current) | Privacy by Design Permission System | Privacy-by-design mobile governance mechanisms | Not tailored to continual-learning recommender lifecycle and update loops | Missing link between privacy controls and model update/storage overhead | Add retention controls, reset semantics, and measurable data lifecycle cost in-app |
| P5 | Cross-phase reference | On-Device Recommender Systems Survey | Comprehensive taxonomy of on-device recommendation strategies | Largely conceptual categorization; limited end-to-end app-level reproducibility guidance | No concrete budgeted targets for latency, memory, storage, and energy in production loops | Provide reproducible app-embedded pipeline with explicit resource budgets and measurement protocol |
| P6 | Phase B (near-term) | Consumer Attention & Personalized Experiences (GAI) | Configurational approach to attention-driven personalization in generative AI | GAI-focused; assumes cloud-side or hybrid architecture; attention mechanisms traditionally compute-intensive | Limited guidance for local-only attention-like personalization on mobile; generalization to non-GAI domains unclear | Adapt configurational insights to on-device ranking; use learned topic weights as local attention proxy; test on RSS domain |
| P7 | Phase C preparation | TinyOL | Online TinyML under severe resource constraints | Microcontroller focus not directly mapped to smartphone continual recommendation runtime | Lacks cross-platform transfer path and shared model-state contracts from phone to MCU | Enforce compact model/state interfaces now to keep STM32 deployment feasible later |
| P8 | Phase B-C (research) | µNAS: Constrained Neural Architecture Search for Microcontrollers | Automated architecture search under strict memory/latency budgets for MCU deployment | Designed for static architectures post-search; does not address continual retraining or online adaptation | Gap between discovered architecture and on-device learning efficiency; search targets MCU but not phone-based continual loop | Combine with BNN quantization and TinyOL replay for joint architecture-weight-learning co-optimization |

## Research Direction: Efficiency Cascade (Phase 2-3)

**Synthesis**: µNAS (architecture search) + BNN (extreme quantization, 8-32x compression) + CL (continual learning) creates three-tier efficiency pipeline:
1. Architecture search finds minimal model footprint under latency/memory targets (µNAS).
2. Binarized weights reduce model size and inference cost (BNN).
3. Local continual learning adapts compressed model without full retraining (CL + TinyOL).

**Expected Outcomes**:
- Smartphone model footprint: <5MB (vs typical 50-100MB).
- Inference latency: <50ms per prediction (vs 100-300ms baseline).
- Update cost: <100ms per user event (vs retraining).
- Transfer to STM32: Validated via cross-device evaluation.

## Notes
- Priority order follows implementation sequence: stabilize local continual learning first (Phase A), then efficiency cascade optimization (Phase B), then embedded transfer validation (Phase C).
- Domain (RSS) is treated as one input stream; claims are designed to transfer to other content platforms.
- For each row, add exact citation metadata and section-level evidence in the next revision.
