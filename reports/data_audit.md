# Initial dataset audit

**Audit date:** 2026-10-08  
**Source:** UCI Machine Learning Repository, dataset 411, Extension of Z-Alizadeh Sani dataset. See [`data/raw/README.md`](../data/raw/README.md) for attribution, license and SHA-256.  
**Re-run:** `python -m ml.data_audit`

## Observed structure

- The workbook has two sheets. `Sheet 1 - Table 1` contains 303 records and 59 columns; `Sheet1` is empty and has a different 100-column schema. The audit uses the non-empty sheet with LAD/LCX/RCA/Cath.
- There are 55 candidate clinical predictors and four recorded outcome columns: LAD, LCX, RCA and Cath. There is **no column named CAD** in the non-empty sheet.
- No missing cells or duplicate rows were found in the selected sheet.
- Target counts:

| Recorded outcome | Positive | Negative | Total |
|---|---:|---:|---:|
| Cath (provisional overall CAD label) | 216 CAD | 87 Normal | 303 |
| LAD | 177 Stenotic | 126 Normal | 303 |
| LCX | 119 Stenotic | 184 Normal | 303 |
| RCA | 114 Stenotic | 189 Normal | 303 |

## Findings that affect modeling

1. **Primary overall target is `Cath`.** The workbook has no CAD-named column; `Cath` is the explicit overall CAD/Normal outcome and is mapped to model target `CAD` in `config/targets.yaml`. The UCI description says CAD should be positive when any of LAD/LCX/RCA is stenotic. Those two labels disagree for one record: Excel row 95 has `Cath=Normal`, `LAD=Stenotic`, `LCX=Normal`, `RCA=Normal`. Keep the source values unchanged, train against the explicit `Cath` outcome, and report the vessel-derived definition as a sensitivity check. The audit reports this mismatch; it does not silently relabel the row.
2. **One constant feature:** `Exertional CP` is `N` in all 303 records. It carries no learned signal in this file; keep it documented, and exclude it from a fitted model or let a fold-local variance check remove it. Do not claim it contributed to a prediction.
3. **A category spelling needs normalization:** `Sex` contains `Fmale` and `Male`. `ml/data_prep.py` maps the source spelling `Fmale` to `Female` in memory and preserves the original workbook.
4. **Rare feature categories exist:** examples include CHF=Y (1 record), LowTH Ang=Y (2), CRF=Y (6), CVA=Y (5), and Weak Peripheral Pulse=Y (5). These are not outcomes, but they can make subgroup and feature attribution claims unstable.
5. **Units and user-entry limits are unresolved:** the workbook mixes integer-like and decimal measurements; observed sample ranges must not be treated as clinical reference ranges or safe input bounds. `config/features.yaml` deliberately leaves these fields unset pending source/clinical reference review.

## Current M1 decision and next actions

- Use `Cath` as the primary overall CAD target because it is the explicit overall CAD/Normal field in the workbook and the project requires an overall CAD label. All four outcome columns remain excluded from every predictor matrix.
- Preserve and report the row 95 discordance; compare results with the vessel-derived any-stenotic-vessel label as a sensitivity check if feasible.
- Freeze the target definition before train/test splitting, tuning, calibration or threshold selection.
- Confirm measurement units and any display/reference ranges before M2 uses them for API validation or M4 presents them as clinical flags.

This is an internal audit of one public dataset, not clinical validation or evidence that predictions generalize to other populations.
