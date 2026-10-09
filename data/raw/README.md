# Raw dataset

The organizer-provided archive is preserved as `organizer_dataset.zip`. Its only data file, `extention of Z-Alizadeh sani dataset.xlsx`, was compared byte-for-byte with the extracted workbook `z_alizadeh_sani_uci_411.xlsx` used by the audit and pipeline; their SHA-256 hashes match. The source archive is the authoritative project copy.

- Dataset: [Extension of Z-Alizadeh Sani dataset](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset)
- Original authors: Roohallah Alizadehsani, Mohamad Roshanzamir, and Zahra Sani (2013)
- DOI: [10.24432/C5461K](https://doi.org/10.24432/C5461K)
- License: CC BY 4.0; retain attribution when redistributing/adapting.
- Organizer archive: `organizer_dataset.zip`; SHA-256: `e97af1a18733d64fa88caa0628e5fe7ce6b2e26ec4c7ee03baade92a6f1470e8`
- Workbook extracted from the archive: `z_alizadeh_sani_uci_411.xlsx`; SHA-256: `739343245c2ba578b541370217531750d8e936022f928b83e0d91756caa3ff0b`
- Workbook sheet used for initial audit: `Sheet 1 - Table 1` (303 rows, 59 columns). The second sheet is empty and has a different 100-column schema; it is not used.

## Supplemental UCI Heart Disease archive (dataset 45)

- Source: [UCI Heart Disease dataset](https://archive.ics.uci.edu/dataset/45/heart+disease)
- Local archive: `uci_heart_disease_45.zip`; SHA-256: `b17cd273da9ce1caa4710fce80227ea454d4dbf9fcbc8e6a9121672751563adc`
- License: CC BY 4.0; cite the UCI dataset and retain attribution when redistributing/adapting.
- The ZIP contains four processed 14-column cohorts, raw 76-attribute files, and `heart-disease.names`. Processed cohort ETL and caveats are recorded in [`reports/uci_heart_disease_45_audit.md`](../../reports/uci_heart_disease_45_audit.md).
- Keep this source cohort-tagged. It is not a row-compatible addition to the organizer workbook; do not mix it into the existing 55-feature model without a documented feature crosswalk and source-held-out evaluation.

Do not edit the source archive or workbook. Record cleaning and target mapping in code/config so the audit can be repeated from the same file.
