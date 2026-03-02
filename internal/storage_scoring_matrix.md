# Storage Scoring Matrix (v1)

| Model | Discoverability | Machine Readability | Immutability | Access Control | AEC Integration | Automation Feasibility | Overhead | Migration Risk | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A. Shared Drive | 1 | 1 | 1 | 2 | 3 | 1 | 4 | 4 | 17 |
| B. SharePoint / DMS | 3 | 2 | 2 | 4 | 3 | 2 | 2 | 3 | 21 |
| C. Object Store + Metadata DB | 4 | 4 | 5 | 4 | 4 | 4 | 3 | 3 | 31 |
| D. Hybrid: Object + Relational + Vector | 5 | 5 | 5 | 5 | 4 | 5 | 3 | 3 | 35 |
| E. Structured Drawing-as-Record DB | 2 | 5 | 3 | 4 | 1 | 3 | 1 | 1 | 20 |

## Model Rationales

### A. Shared Drive
Shared drives are familiar and low-friction initially, but they fail evidentiary and automation requirements at enterprise scale. Discoverability and machine readability are weak because naming and folder structures drift. Immutability is poor due to overwrite behavior, making this model a weak long-term legal and AI foundation.

### B. SharePoint / DMS
SharePoint/DMS improves enterprise access control and basic search, but it does not natively enforce cryptographic immutability or chain-auditable records. It is workable for general document management but underperforms for high-integrity AI and mixed AEC artifact governance without heavy customization.

### C. Object Store + Metadata DB
This model is strong for scale, immutability, and structured governance. It supports deterministic automation and clear authority boundaries, but semantic AI retrieval is limited without a dedicated vector derivative layer. It is a robust baseline and a direct precursor to the hybrid target.

### D. Hybrid: Object + Relational + Vector
Hybrid scores highest because it combines immutable authoritative storage, strong relational governance, and high-quality AI retrieval through regenerable vector derivatives. It preserves legal authority in object/relational layers while enabling advanced AI workflows safely. Complexity is higher than simpler models but acceptable for 20-year direction.

### E. Structured Drawing-as-Record DB
A fully structured drawing-as-record system can be machine-friendly, but it is a poor fit for heterogeneous AEC records and carries very high migration and maintenance burden. It risks forcing lossy normalization and operational brittleness, making it unsuitable as the primary architecture.