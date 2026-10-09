# UCI Heart Disease (dataset 45) ETL and compatibility audit

**Source:** [UCI Heart Disease dataset 45](https://archive.ics.uci.edu/dataset/45/heart+disease)

**Archived source:** [`data/raw/uci_heart_disease_45.zip`](../data/raw/uci_heart_disease_45.zip)

**Re-run processed-file ETL:** `python -m ml.etl_uci_heart_disease`

**Machine-readable audit:** [`uci_heart_disease_45_audit.json`](uci_heart_disease_45_audit.json)

**Cohort-tagged ETL output:** [`data/interim/uci_heart_disease_45.csv`](../data/interim/uci_heart_disease_45.csv)

## What is in the archive

The ZIP contains the source notes (`heart-disease.names`), four processed 14-column cohorts, and separate raw 76-attribute files. The processed files are Cleveland (303 records), Hungary (294), Switzerland (123), and Long Beach VA (200): 920 rows total. Each has the 13 traditional predictors plus `num`; the ETL keeps the original target and derives `cad = 0` for `num=0` and `cad = 1` for `num=1..4`.

The processed files do **not** contain LAD, LCX, or RCA target columns. The raw dictionary describes artery-segment fields (attributes 59–68), so vessel-level use may be possible from raw records, but that requires a separate raw-file integrity and label-coding audit. This ETL deliberately does not parse or use those raw files. The current archive's Cleveland raw file contains embedded NUL bytes and does not flatten cleanly into the expected 76-field records; the processed Cleveland file is the safer source for its overall CAD label.

## Processed cohort summary

| Cohort | Rows | CAD positive | CAD negative | Missing feature values |
|---|---:|---:|---:|---:|
| Cleveland | 303 | 139 | 164 | 6 |
| Hungary | 294 | 106 | 188 | 782 |
| Switzerland | 123 | 115 | 8 | 273 |
| Long Beach VA | 200 | 149 | 51 | 698 |
| **Total** | **920** | **509** | **411** | **1,759** |

The very different positive-label fractions across sites (about 36% in Hungary versus 94% in Switzerland) and highly uneven missingness mean a random pooled split could give an overly reassuring estimate. Any candidate should be assessed with cohort-held-out evaluation and the site identifier retained for analysis. The 1,759 missing entries are feature cells; no `num` target is missing in the processed files.

## Can it train the current project model?

**It can support a CAD-only supplemental candidate after feature harmonization; it cannot be appended to the existing 55-feature table as-is.** Its processed schema has 13 inputs with different names and meanings. Some inputs are absent from the organizer data, and some organizer fields do not have exact counterparts. In particular, `ca` is the number of major vessels seen by fluoroscopy and must not be used as an input for a pre-angiography CAD predictor. Do not encode unsupported mappings by guessing.

The target is close but not perfectly documented identically: UCI's `num` is 0 for no disease and 1–4 for disease, while the organizer dataset defines CAD at a >=50% stenosis threshold; UCI's supplied description phrases the negative/positive boundary as `<50%`/`>50%`. Keep source and target provenance and report the threshold-definition caveat.

This ETL only validates and stages the processed CAD records. It does not merge cohorts with dataset 411, train or select a model, or provide additional artery labels. A cohort-aware CAD experiment and a separate raw artery-label audit are the next analyses.
