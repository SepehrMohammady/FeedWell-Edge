# Related Work Matrix (Draft)

| Paper | Core Contribution | Limitation | Gap for FeedWell-Edge | Planned Response |
|---|---|---|---|---|
| On-Device Recommender Systems Survey | Taxonomy of DeviceRS methods | Broad survey, not RSS-specific implementation protocol | Lacks reproducible mobile app integration path | Build app-embedded, reproducible pipeline in FeedWell-Edge |
| Continual Learning at the Edge | Real-time edge training framing | Limited focus on RSS personalization and user-level diversity preservation | No RSS reading-loop specific continual adaptation design | Add interaction-driven CL loop with replay + drift |
| TinyOL | TinyML online learning on constrained devices | Different domain assumptions than mobile RSS app runtime | Missing direct bridge from Android to STM32 roadmap | Design model/state portability constraints from day one |
| Privacy-Preserving News Rec. | Privacy-aware recommendation learning | Usually assumes coordination and broader infra context | Does not enforce strict local-only app-first pipeline | Keep full behavior and adaptation on-device only |
| Privacy by Design Permission System | Privacy governance patterns | Not recommender-CL specific | Missing recommendation-specific data lifecycle controls | Add retention controls, reset workflow, transparent local summary |
| Beyond Explicit and Implicit Feedback | Richer user feedback modeling | Not focused on strict on-device CL optimization | Signals not mapped to tiny resource budgets | Map opens, dwell, scroll depth into compact event schema |

## Notes
- Update this matrix after each implementation milestone and experiment batch.
- For each row, add exact citations and section-level evidence.
