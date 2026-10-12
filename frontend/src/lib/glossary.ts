// name -> [short label, full form, group]. Covers all 55 dataset inputs.
export type GroupKey = 'History' | 'Exam' | 'ECG' | 'Lab';
export const GROUP_TITLE: Record<GroupKey, string> = {History: 'History and risk factors', Exam: 'Symptoms and examination', ECG: 'ECG', Lab: 'Lab and echo'};
export const DATA_GROUP: Record<string, GroupKey> = {Demographic: 'History', 'Symptoms and examination': 'Exam', ECG: 'ECG', 'Laboratory and echo': 'Lab'};

export const NAMES: Record<string, [string, string, GroupKey]> = {
  Age: ['Age', 'Age in years', 'History'], Weight: ['Weight', 'Body weight', 'History'], Length: ['Height', 'Body height', 'History'],
  Sex: ['Sex', 'Female or male', 'History'], BMI: ['BMI', 'Body mass index', 'History'], DM: ['DM', 'Diabetes mellitus', 'History'],
  HTN: ['HTN', 'Hypertension (high blood pressure)', 'History'], 'Current Smoker': ['Current smoker', 'Smokes now', 'History'],
  'EX-Smoker': ['Ex-smoker', 'Smoked in the past', 'History'], FH: ['FH', 'Family history', 'History'], Obesity: ['Obesity', 'Obesity', 'History'],
  CRF: ['CRF', 'Chronic renal failure', 'History'], CVA: ['CVA', 'Cerebrovascular accident (stroke)', 'History'],
  'Airway disease': ['Airway disease', 'Chronic lung or airway disease', 'History'], 'Thyroid Disease': ['Thyroid disease', 'Thyroid disease', 'History'],
  CHF: ['CHF', 'Congestive heart failure', 'History'], DLP: ['DLP', 'Dyslipidemia (abnormal blood fats)', 'History'],
  BP: ['BP', 'Blood pressure', 'Exam'], PR: ['PR', 'Pulse rate', 'Exam'], Edema: ['Edema', 'Swelling from fluid', 'Exam'],
  'Weak Peripheral Pulse': ['Weak pulse', 'Weak peripheral pulse', 'Exam'], 'Lung rales': ['Lung rales', 'Crackling lung sounds', 'Exam'],
  'Systolic Murmur': ['Systolic murmur', 'Murmur as the heart contracts', 'Exam'], 'Diastolic Murmur': ['Diastolic murmur', 'Murmur as the heart relaxes', 'Exam'],
  'Typical Chest Pain': ['Typical chest pain', 'Classic angina-type chest pain', 'Exam'], Dyspnea: ['Dyspnea', 'Shortness of breath', 'Exam'],
  'Function Class': ['Function class', 'Functional class (0 to 3)', 'Exam'], Atypical: ['Atypical pain', 'Atypical chest pain', 'Exam'],
  Nonanginal: ['Non-anginal pain', 'Chest pain not typical of angina', 'Exam'], 'Exertional CP': ['Exertional CP', 'Exertional chest pain', 'Exam'],
  'LowTH Ang': ['Low-threshold angina', 'Angina on minimal effort', 'Exam'],
  'Q Wave': ['Q wave', 'Pathological Q wave on ECG', 'ECG'], 'St Elevation': ['ST elevation', 'ST-segment elevation', 'ECG'],
  'St Depression': ['ST depression', 'ST-segment depression', 'ECG'], Tinversion: ['T inversion', 'T-wave inversion', 'ECG'],
  LVH: ['LVH', 'Left ventricular hypertrophy', 'ECG'], 'Poor R Progression': ['Poor R progression', 'Poor R-wave progression', 'ECG'],
  BBB: ['BBB', 'Bundle branch block', 'ECG'],
  FBS: ['FBS', 'Fasting blood sugar', 'Lab'], CR: ['CR', 'Creatinine', 'Lab'], TG: ['TG', 'Triglycerides', 'Lab'],
  LDL: ['LDL', 'Low-density lipoprotein cholesterol', 'Lab'], HDL: ['HDL', 'High-density lipoprotein cholesterol', 'Lab'],
  BUN: ['BUN', 'Blood urea nitrogen', 'Lab'], ESR: ['ESR', 'Erythrocyte sedimentation rate', 'Lab'], HB: ['HB', 'Hemoglobin', 'Lab'],
  K: ['K', 'Potassium', 'Lab'], Na: ['Na', 'Sodium', 'Lab'], WBC: ['WBC', 'White blood cell count', 'Lab'], Lymph: ['Lymph', 'Lymphocytes', 'Lab'],
  Neut: ['Neut', 'Neutrophils', 'Lab'], PLT: ['PLT', 'Platelet count', 'Lab'], 'EF-TTE': ['EF-TTE', 'Ejection fraction (echocardiogram)', 'Lab'],
  'Region RWMA': ['RWMA', 'Regional wall motion abnormality (0 to 4)', 'Lab'], VHD: ['VHD', 'Valvular heart disease (severity)', 'Lab'],
};

// Most important terms first, with a short meaning.
export const KEY_TERMS: [string, string, string][] = [
  ['CAD', 'Coronary artery disease', 'Narrowing of the arteries that feed the heart muscle.'],
  ['Stenosis', 'Artery narrowing', 'Here, at least 50% narrowing counts as significant.'],
  ['LAD', 'Left anterior descending artery', 'Front of the heart.'],
  ['LCX', 'Left circumflex artery', 'Side and back of the heart.'],
  ['RCA', 'Right coronary artery', 'Right side and bottom of the heart.'],
  ['Typical chest pain', 'Classic angina-type chest pain', 'Pressure or tightness brought on by effort.'],
  ['BP', 'Blood pressure', 'Force of blood against the artery walls.'],
  ['PR', 'Pulse rate', 'Heartbeats per minute.'],
  ['LDL', 'Low-density lipoprotein cholesterol', '\u201cBad\u201d cholesterol that builds plaque.'],
  ['HDL', 'High-density lipoprotein cholesterol', '\u201cGood\u201d cholesterol that clears fat.'],
  ['DM', 'Diabetes mellitus', 'High blood sugar that damages vessels.'],
  ['HTN', 'Hypertension', 'Persistently high blood pressure.'],
  ['FBS', 'Fasting blood sugar', 'Blood glucose after fasting.'],
  ['BMI', 'Body mass index', 'Weight divided by height squared.'],
  ['ST elevation', 'ST-segment elevation', 'ECG change linked to heart muscle injury.'],
  ['T inversion', 'T-wave inversion', 'ECG change linked to reduced blood supply.'],
  ['LVH', 'Left ventricular hypertrophy', 'Thickened wall of the main pumping chamber.'],
  ['EF-TTE', 'Ejection fraction (echocardiogram)', 'Share of blood pumped out with each beat.'],
  ['RWMA', 'Regional wall motion abnormality', 'Part of the heart wall moves abnormally on echo.'],
  ['AUC', 'Area under the ROC curve', 'How well a model ranks sick above healthy (0.5 chance, 1 perfect).'],
];
