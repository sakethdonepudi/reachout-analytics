# Tamil Nadu rollback archive

This directory is intentionally outside the active public snapshot path.

- `aggregates-2026-10-25-previous-allocation.json` — the retired Tamil Nadu geographic-allocation aggregate. It is not imported by the public API, admin export, tests or UI.
- `previous-source/TN-2026-Exit-Poll-Analysis-Data-5.xlsx` — the previous workbook retained for private rollback only.
- The previous generator and publisher scripts are kept under `scripts/archive/` with non-TS extensions so they cannot be imported accidentally.

Active source: `../source/SAKET_TN_District_Estimate_calibrated_v3.xlsx` (SHA-256 recorded in `../aggregates.json`). The replacement public snapshot is `tn-2026-saket-v3`; missing-location responses remain statewide only and are not allocated geographically.
