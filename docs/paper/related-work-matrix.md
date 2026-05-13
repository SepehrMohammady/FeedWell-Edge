# Related Work Matrix (Deployability-Focused Draft)

| Paper | Core Contribution | Deployment Limitation | Efficiency / Footprint Gap | Planned Response |
|---|---|---|---|---|
| On-Device Recommender Systems Survey | Comprehensive taxonomy of on-device recommendation strategies | Largely conceptual categorization; limited end-to-end app-level reproducibility guidance | No concrete budgeted targets for latency, memory, storage, and energy in production loops | Provide reproducible app-embedded pipeline with explicit resource budgets and measurement protocol |
| Continual Learning at the Edge | Edge-side real-time training perspective | Focuses on edge adaptation conceptually but with limited mobile product integration constraints | Insufficient joint analysis of adaptation quality vs battery/thermal/runtime overhead | Implement bounded update scheduling and report adaptation-performance vs resource trade-offs |
| TinyOL | Online TinyML under severe resource constraints | Microcontroller focus not directly mapped to smartphone continual recommendation runtime | Lacks cross-platform transfer path and shared model-state contracts from phone to MCU | Enforce compact model/state interfaces now to keep STM32 deployment feasible later |
| Privacy-Preserving News Recommendation | Privacy-aware recommendation learning design | Often relies on broader coordination assumptions beyond strict local-only operation | Limited evidence for zero-export local pipelines with measurable on-device cost envelopes | Enforce strict local-only behavior/data pipeline and quantify its utility/efficiency impact |
| Privacy by Design Permission System | Privacy-by-design mobile governance mechanisms | Not tailored to continual-learning recommender lifecycle and update loops | Missing link between privacy controls and model update/storage overhead | Add retention controls, reset semantics, and measurable data lifecycle cost in-app |
| Beyond Explicit and Implicit Feedback | Rich user feedback signal taxonomy for personalization | Rich interaction signals can increase compute/storage overhead if unbounded | Missing compact signal selection strategy for low-footprint continual learning | Use compact event schema (impression/open/dwell-depth) and evaluate utility-cost trade-offs |

## Notes
- Priority of this matrix is deployability: latency, footprint, power, and reproducibility.
- Domain (RSS) is treated as one input stream; claims are designed to transfer to other content platforms.
- For each row, add exact citation metadata and section-level evidence in the next revision.
