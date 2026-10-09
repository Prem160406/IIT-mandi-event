# Cross-source CAD feature harmonization study

Organizer cohort: 303; UCI Heart Disease 45: 920 across four historical cohorts.

## Crosswalk decisions

| Field | Harmonization | Confidence/use |
|---|---|---|
| Age | years → years | Core |
| Sex | binary codes → male/female | Core |
| Fasting glucose | organizer mg/dL >120 → binary; UCI fbs already uses >120 mg/dL | Core, with missing UCI values imputed in training |
| Chest pain | Typical/Atypical/Nonanginal flags mapped to UCI cp 1/2/3; no-flag mapping is tested both as separate and as asymptomatic | Exploratory sensitivity only |
| Blood pressure | BP mmHg vs resting/admission BP mmHg | Sensitivity feature; organizer context/systolic status is not explicit |
| CAD target | Cath vs num>0 | Near match; threshold boundary differs (<50/>50 vs >=50), and organizer Cath has one vessel-rule disagreement |

## Domain-transfer results

Each result trains on one complete source and scores on an untouched external cohort. AUC measures ranking; Brier measures probability error; sensitivity/specificity use a fixed 0.5 threshold for illustration only.

### core_age_sex_fbs

Inputs: age, sex, fbs120

Chest-pain mapping: No organizer category flags retained as a separate no_category_flag value.

| Train → test | N | CAD+ | AUC (95% CI) | Brier (95% CI) | Sensitivity | Specificity |
|---|---:|---:|---:|---:|---:|---:|
| Organizer → cleveland | 303 | 139 | 0.658 (0.597–0.718) | 0.258 (0.236–0.281) | 0.842 | 0.427 |
| Organizer → hungary | 294 | 106 | 0.654 (0.589–0.719) | 0.232 (0.212–0.252) | 0.623 | 0.633 |
| Organizer → long_beach_va | 200 | 149 | 0.612 (0.523–0.701) | 0.187 (0.168–0.206) | 0.966 | 0.157 |
| Organizer → switzerland | 123 | 115 | 0.543 (0.325–0.746) | 0.175 (0.146–0.207) | 0.791 | 0.250 |
| UCI 45 all cohorts → organizer (Cath) | 303 | 216 | 0.706 (0.643–0.769) | 0.219 (0.199–0.239) | 0.667 | 0.609 |
| UCI 45 all cohorts → organizer (vessel-rule label sensitivity) | 303 | 217 | 0.713 (0.651–0.775) | 0.217 (0.197–0.237) | 0.668 | 0.616 |
| UCI train other cohorts → cleveland | 303 | 139 | 0.700 (0.640–0.757) | 0.222 (0.203–0.242) | 0.698 | 0.598 |
| UCI train other cohorts → hungary | 294 | 106 | 0.672 (0.610–0.734) | 0.225 (0.205–0.244) | 0.689 | 0.606 |
| UCI train other cohorts → long_beach_va | 200 | 149 | 0.630 (0.539–0.717) | 0.188 (0.172–0.204) | 0.940 | 0.216 |
| UCI train other cohorts → switzerland | 123 | 115 | 0.453 (0.246–0.652) | 0.187 (0.161–0.213) | 0.774 | 0.125 |

### core_plus_bp

Inputs: age, sex, fbs120, bp

Chest-pain mapping: No organizer category flags retained as a separate no_category_flag value.

| Train → test | N | CAD+ | AUC (95% CI) | Brier (95% CI) | Sensitivity | Specificity |
|---|---:|---:|---:|---:|---:|---:|
| Organizer → cleveland | 303 | 139 | 0.669 (0.609–0.728) | 0.263 (0.238–0.287) | 0.863 | 0.409 |
| Organizer → hungary | 294 | 106 | 0.666 (0.598–0.730) | 0.245 (0.221–0.268) | 0.660 | 0.543 |
| Organizer → long_beach_va | 200 | 149 | 0.623 (0.535–0.710) | 0.191 (0.170–0.213) | 0.966 | 0.137 |
| Organizer → switzerland | 123 | 115 | 0.561 (0.326–0.785) | 0.176 (0.143–0.212) | 0.783 | 0.375 |
| UCI 45 all cohorts → organizer (Cath) | 303 | 216 | 0.716 (0.654–0.774) | 0.219 (0.199–0.239) | 0.630 | 0.609 |
| UCI 45 all cohorts → organizer (vessel-rule label sensitivity) | 303 | 217 | 0.722 (0.660–0.784) | 0.218 (0.197–0.238) | 0.631 | 0.616 |
| UCI train other cohorts → cleveland | 303 | 139 | 0.701 (0.642–0.757) | 0.221 (0.202–0.242) | 0.712 | 0.591 |
| UCI train other cohorts → hungary | 294 | 106 | 0.683 (0.621–0.744) | 0.227 (0.207–0.248) | 0.726 | 0.590 |
| UCI train other cohorts → long_beach_va | 200 | 149 | 0.593 (0.498–0.689) | 0.194 (0.175–0.212) | 0.933 | 0.176 |
| UCI train other cohorts → switzerland | 123 | 115 | 0.479 (0.254–0.689) | 0.187 (0.161–0.216) | 0.774 | 0.125 |

### core_plus_chest_pain

Inputs: age, sex, fbs120, chest_pain

Chest-pain mapping: No organizer category flags retained as a separate no_category_flag value.

| Train → test | N | CAD+ | AUC (95% CI) | Brier (95% CI) | Sensitivity | Specificity |
|---|---:|---:|---:|---:|---:|---:|
| Organizer → cleveland | 303 | 139 | 0.722 (0.664–0.777) | 0.219 (0.195–0.244) | 0.683 | 0.689 |
| Organizer → hungary | 294 | 106 | 0.756 (0.700–0.813) | 0.193 (0.173–0.213) | 0.415 | 0.888 |
| Organizer → long_beach_va | 200 | 149 | 0.646 (0.555–0.731) | 0.203 (0.178–0.229) | 0.805 | 0.333 |
| Organizer → switzerland | 123 | 115 | 0.680 (0.472–0.867) | 0.245 (0.209–0.282) | 0.635 | 0.625 |
| UCI 45 all cohorts → organizer (Cath) | 303 | 216 | 0.795 (0.738–0.852) | 0.302 (0.279–0.322) | 0.310 | 0.931 |
| UCI 45 all cohorts → organizer (vessel-rule label sensitivity) | 303 | 217 | 0.803 (0.746–0.856) | 0.301 (0.279–0.322) | 0.313 | 0.942 |
| UCI train other cohorts → cleveland | 303 | 139 | 0.822 (0.773–0.866) | 0.177 (0.155–0.200) | 0.871 | 0.646 |
| UCI train other cohorts → hungary | 294 | 106 | 0.835 (0.790–0.879) | 0.156 (0.133–0.180) | 0.745 | 0.830 |
| UCI train other cohorts → long_beach_va | 200 | 149 | 0.727 (0.643–0.797) | 0.180 (0.155–0.209) | 0.812 | 0.373 |
| UCI train other cohorts → switzerland | 123 | 115 | 0.708 (0.471–0.922) | 0.111 (0.083–0.142) | 0.896 | 0.625 |

### core_plus_chest_pain_assume_no_flags_asymptomatic

Inputs: age, sex, fbs120, chest_pain

Chest-pain mapping: No organizer category flags mapped to asymptomatic (explicit sensitivity assumption).

| Train → test | N | CAD+ | AUC (95% CI) | Brier (95% CI) | Sensitivity | Specificity |
|---|---:|---:|---:|---:|---:|---:|
| Organizer → cleveland | 303 | 139 | 0.716 (0.658–0.771) | 0.223 (0.199–0.248) | 0.647 | 0.695 |
| Organizer → hungary | 294 | 106 | 0.742 (0.685–0.801) | 0.197 (0.177–0.217) | 0.311 | 0.904 |
| Organizer → long_beach_va | 200 | 149 | 0.640 (0.550–0.724) | 0.207 (0.181–0.233) | 0.785 | 0.333 |
| Organizer → switzerland | 123 | 115 | 0.666 (0.454–0.855) | 0.259 (0.224–0.297) | 0.574 | 0.750 |
| UCI 45 all cohorts → organizer (Cath) | 303 | 216 | 0.761 (0.695–0.825) | 0.299 (0.275–0.323) | 0.361 | 0.862 |
| UCI 45 all cohorts → organizer (vessel-rule label sensitivity) | 303 | 217 | 0.768 (0.701–0.830) | 0.299 (0.273–0.323) | 0.364 | 0.872 |
| UCI train other cohorts → cleveland | 303 | 139 | 0.822 (0.773–0.866) | 0.177 (0.155–0.200) | 0.871 | 0.646 |
| UCI train other cohorts → hungary | 294 | 106 | 0.835 (0.790–0.879) | 0.156 (0.133–0.180) | 0.745 | 0.830 |
| UCI train other cohorts → long_beach_va | 200 | 149 | 0.727 (0.643–0.797) | 0.180 (0.155–0.209) | 0.812 | 0.373 |
| UCI train other cohorts → switzerland | 123 | 115 | 0.708 (0.471–0.922) | 0.111 (0.083–0.142) | 0.896 | 0.625 |

### expanded_bp_and_chest_pain

Inputs: age, sex, fbs120, bp, chest_pain

Chest-pain mapping: No organizer category flags retained as a separate no_category_flag value.

| Train → test | N | CAD+ | AUC (95% CI) | Brier (95% CI) | Sensitivity | Specificity |
|---|---:|---:|---:|---:|---:|---:|
| Organizer → cleveland | 303 | 139 | 0.728 (0.671–0.782) | 0.218 (0.193–0.245) | 0.705 | 0.671 |
| Organizer → hungary | 294 | 106 | 0.744 (0.685–0.804) | 0.193 (0.171–0.215) | 0.528 | 0.814 |
| Organizer → long_beach_va | 200 | 149 | 0.652 (0.565–0.735) | 0.203 (0.177–0.231) | 0.819 | 0.353 |
| Organizer → switzerland | 123 | 115 | 0.682 (0.445–0.891) | 0.245 (0.206–0.286) | 0.652 | 0.750 |
| UCI 45 all cohorts → organizer (Cath) | 303 | 216 | 0.797 (0.740–0.853) | 0.312 (0.289–0.332) | 0.282 | 0.931 |
| UCI 45 all cohorts → organizer (vessel-rule label sensitivity) | 303 | 217 | 0.805 (0.748–0.858) | 0.311 (0.289–0.332) | 0.286 | 0.942 |
| UCI train other cohorts → cleveland | 303 | 139 | 0.823 (0.774–0.868) | 0.177 (0.154–0.200) | 0.863 | 0.652 |
| UCI train other cohorts → hungary | 294 | 106 | 0.836 (0.791–0.881) | 0.158 (0.134–0.181) | 0.755 | 0.824 |
| UCI train other cohorts → long_beach_va | 200 | 149 | 0.698 (0.608–0.775) | 0.181 (0.157–0.210) | 0.859 | 0.373 |
| UCI train other cohorts → switzerland | 123 | 115 | 0.725 (0.484–0.925) | 0.111 (0.083–0.143) | 0.904 | 0.625 |

## Labels and interpretation

Organizer Cath and the any-stenotic-vessel rule agree on 302/303 rows; mismatches: 1.
The CSVs were not joined. This is cross-domain transfer, not pooled random-split validation. Features with uncertain semantics are isolated as extension variants. The 95% intervals are class-stratified bootstrap intervals over test rows, conditional on the fitted model; they do not capture model-training or source-population uncertainty.

## Source documentation

- [UCI Extension of Z-Alizadeh Sani dataset](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset) — CAD threshold and target description.
- [UCI Heart Disease dataset 45](https://archive.ics.uci.edu/dataset/45/heart+disease) — age, sex, cp, trestbps, fbs, num coding and definitions.
- [Z-Alizadeh Sani feature definitions and units](https://pmc.ncbi.nlm.nih.gov/articles/PMC9698583/) — published field descriptions for BP and FBS.

## Limitations

- Only two source families are available and both are historical, angiography-selected cohorts; transfer does not establish prospective clinical validity.
- The UCI 45 cohorts have pronounced label prevalence and missingness differences, including only eight CAD-negative Switzerland records.
- Chest-pain and blood-pressure mappings are explicit sensitivity assumptions; interpret the core and extensions separately.
- Performance at threshold 0.5 is not a recommended operating point; calibration and clinical utility need independent data and decision costs.
- Without patient identifiers, exact cross-source duplicate detection is not possible.

## Reproduction

```powershell
python -m ml.harmonize_uci_sources
```
