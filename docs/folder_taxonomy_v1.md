# Folder Taxonomy (v1)

## Required Top-Level Folders
The project root MUST contain exactly these top-level folders:
- `/01_Admin`
- `/02_Contracts`
- `/03_Design`
- `/04_CA`
- `/05_Issued`
- `/06_Archive`
- `/_System` (hidden, managed by KORDA)

## Binding Rules
- No freeform top-level folders are allowed.
- Discipline separation under `/03_Design` is mandatory.
- CA artifacts must never live in `/03_Design`.
- Issued packages live only in `/05_Issued`.
- `/06_Archive` is read-only, append-only for superseded/historical packages.
- `/_System` is reserved for KORDA manifests, checksums, and ingestion state; manual edits are prohibited.

## Canonical Subfolder Patterns

### `/01_Admin`
- `/01_Admin/PM`
- `/01_Admin/Schedules`
- `/01_Admin/Meeting_Minutes`
- `/01_Admin/Correspondence`

### `/02_Contracts`
- `/02_Contracts/Prime`
- `/02_Contracts/Subcontracts`
- `/02_Contracts/Change_Orders`
- `/02_Contracts/Insurance_Bonds`

### `/03_Design`
- `/03_Design/Common`
- `/03_Design/Architecture`
- `/03_Design/Civil`
- `/03_Design/Structural`
- `/03_Design/Mechanical`
- `/03_Design/Electrical`
- `/03_Design/Plumbing`
- `/03_Design/FireProtection`
- `/03_Design/LowVoltage`
- `/03_Design/Landscape`

Discipline pattern (repeat per discipline):
- `/03_Design/{Discipline}/01_Working`
- `/03_Design/{Discipline}/02_Coordination`
- `/03_Design/{Discipline}/03_Calculations`
- `/03_Design/{Discipline}/04_Submittal_Inputs`
- `/03_Design/{Discipline}/05_Internal_Reviews`

### `/04_CA`
- `/04_CA/RFIs`
- `/04_CA/Submittals`
- `/04_CA/Site_Reports`
- `/04_CA/ASIs`
- `/04_CA/Punchlists`

### `/05_Issued`
- `/05_Issued/IFP`
- `/05_Issued/IFC`
- `/05_Issued/Bid_Addenda`
- `/05_Issued/AsBuilt`

### `/06_Archive`
- `/06_Archive/{YYYY}/{PackageType}`
- Only superseded, closed, or legally retained records move here.
- Files in archive are immutable and version-preserving.

### `/_System`
- `/_System/manifests`
- `/_System/hash_index`
- `/_System/ingestion_queue`
- `/_System/audit_exports`

## Project-Type Examples

### Example A: Commercial Tower
- `/03_Design/Electrical/01_Working`
- `/03_Design/Mechanical/02_Coordination`
- `/03_Design/FireProtection/03_Calculations`
- `/04_CA/RFIs`
- `/05_Issued/IFC/TWR01_IFC_20270312`
- `/06_Archive/2028/IFC_Superseded`

### Example B: Healthcare Facility
- `/03_Design/Mechanical/03_Calculations`
- `/03_Design/Plumbing/02_Coordination`
- `/03_Design/LowVoltage/01_Working`
- `/04_CA/Submittals`
- `/05_Issued/IFP/HCF02_IFP_20270501`
- `/06_Archive/2029/AsBuilt_Closedout`

## Definition of Done
- All required top-level folders are present exactly as specified.
- Design and CA segregation rules are encoded and enforced.
- Discipline patterns under `/03_Design` are documented and repeatable.
- Commercial tower and healthcare examples are included.

## Tests
- `rg -n "^- `/0[1-6]_.*|/_System" docs/folder_taxonomy_v1.md`
- `rg -n "No freeform top-level folders|CA artifacts must never live in /03_Design|Issued packages live only in /05_Issued" docs/folder_taxonomy_v1.md`
- Manual: walk an active project tree and confirm no top-level folders outside the required list.
- Manual: verify RFIs/Submittals exist only under `/04_CA` and issued sets only under `/05_Issued`.