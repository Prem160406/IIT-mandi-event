# Feature metadata and input limits

## Source audit

The organizer-provided Extension of Z-Alizadeh Sani workbook contains feature names, recorded values and outcome labels, but does not provide a data dictionary with units, validated input limits or clinical reference ranges. The official [UCI dataset record](https://archive-beta.ics.uci.edu/dataset/411/extention%2Bof+z%2Balizadeh+sani+dataset) describes the cohort and targets but does not define units for the organizer workbook's fields.

A related publication on the underlying Z-Alizadeh Sani cohort reports units for some measurements. That is useful as a lead, but it does not prove that every organizer workbook field uses the same unit or encoding. We therefore do not infer UI limits or “normal” ranges from sample minima/maxima or transfer them from a related paper without organizer or clinical-owner confirmation. The [related publication](https://pmc.ncbi.nlm.nih.gov/articles/PMC9698583/) is reference material for follow-up, not a validated schema for this application.

## Current contract

- `config/features.yaml` is the shared feature registry. `unit`, `input_range` and `reference_range` remain `null` where authoritative metadata is unavailable.
- Until units and valid ranges are confirmed, M2 should validate required field presence, accepted categorical values and numeric type/finite values only. Do not enforce arbitrary clinical min/max bounds.
- M4 should label raw values without units and should not show green/red “normal” flags or imply clinical interpretation from cohort ranges.
- The ML preprocessing pipeline accepts the feature schema and fits imputation/encoding/scaling only on training folds. That is a modeling convenience, not a substitute for API validation.
- Before real user-entered values are supported, obtain a signed-off data dictionary covering field definitions, units, category encodings, permitted input limits, missing-value conventions and provenance.

This limitation does not prevent the internal demo using the dataset's own rows. It does prevent claiming that the form accepts clinically valid measurements or provides clinical range flags.
