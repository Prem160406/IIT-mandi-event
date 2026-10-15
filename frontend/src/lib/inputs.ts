import type {FeatureDef, Primitive} from '../types';
import {DATA_GROUP, GROUP_TITLE, NAMES} from './glossary';

export type Kind = 'number' | 'yesno' | 'choice' | 'bmi';
export interface Choice {value: Primitive; text: string}
export interface InputSpec {
  name: string; // exact feature name in config/features.yaml
  label: string;
  full?: string;
  kind: Kind;
  unit?: string;
  group: string;
  min?: number;
  max?: number;
  yes?: Primitive;
  no?: Primitive;
  choices?: Choice[];
}

const rwma: Choice[] = [0, 1, 2, 3, 4].map((n) => ({value: n, text: String(n)}));
const CARDIAC_FUNCTION_FIELDS = new Set([
  'CHF', 'Edema', 'Systolic Murmur', 'Diastolic Murmur', 'Dyspnea', 'BBB', 'EF-TTE', 'VHD',
]);

// The 12 key measurements (+ BMI, autofilled).
export const INPUTS: InputSpec[] = [
  {name: 'Age', label: 'Age', full: 'Age in years', kind: 'number', unit: 'yrs', min: 18, max: 110, group: 'Patient'},
  {name: 'Sex', label: 'Sex', kind: 'choice', choices: [{value: 'Female', text: 'Female'}, {value: 'Male', text: 'Male'}], group: 'Patient'},
  {name: 'Length', label: 'Height', kind: 'number', unit: 'cm', min: 100, max: 240, group: 'Patient'},
  {name: 'Weight', label: 'Weight', kind: 'number', unit: 'kg', min: 30, max: 250, group: 'Patient'},
  {name: 'BMI', label: 'BMI', full: 'Body mass index', kind: 'bmi', min: 10, max: 70, group: 'Patient'},
  {name: 'BP', label: 'BP', full: 'Blood pressure', kind: 'number', unit: 'mmHg', min: 60, max: 240, group: 'Vitals and lipids'},
  {name: 'PR', label: 'PR', full: 'Pulse rate', kind: 'number', unit: 'bpm', min: 40, max: 200, group: 'Vitals and lipids'},
  {name: 'LDL', label: 'LDL', full: 'Low-density lipoprotein cholesterol', kind: 'number', unit: 'mg/dL', min: 10, max: 400, group: 'Vitals and lipids'},
  {name: 'HDL', label: 'HDL', full: 'High-density lipoprotein cholesterol', kind: 'number', unit: 'mg/dL', min: 10, max: 150, group: 'Vitals and lipids'},
  {name: 'St Elevation', label: 'ST elevation', full: 'ST-segment elevation', kind: 'yesno', yes: 1, no: 0, group: 'ECG and echo'},
  {name: 'Tinversion', label: 'T inversion', full: 'T-wave inversion', kind: 'yesno', yes: 1, no: 0, group: 'ECG and echo'},
  {name: 'LVH', label: 'LVH', full: 'Left ventricular hypertrophy', kind: 'yesno', yes: 'Y', no: 'N', group: 'ECG and echo'},
  {name: 'Region RWMA', label: 'RWMA', full: 'Regional wall motion abnormality', kind: 'choice', choices: rwma, group: 'ECG and echo'},
];

export const INPUT_NAMES = new Set(INPUTS.map((i) => i.name));

// Key inputs plus every other (non-constant) feature served by /features.
export function buildSpecs(features: FeatureDef[]): InputSpec[] {
  const extra: InputSpec[] = [];
  for (const f of features) {
    if (INPUT_NAMES.has(f.name) || f.constant_in_source) continue;
    const g = NAMES[f.name];
    const base = {
      name: f.name,
      label: g ? g[0] : f.name,
      full: g ? g[1] : undefined,
      unit: f.unit ?? (f.name === 'EF-TTE' ? '%' : undefined),
      min: f.input_range ? f.input_range[0] : 0,
      max: f.input_range ? f.input_range[1] : undefined,
      group: CARDIAC_FUNCTION_FIELDS.has(f.name)
        ? 'Cardiac function & valves'
        : GROUP_TITLE[g ? g[2] : DATA_GROUP[f.group] ?? 'History'],
    };
    const cats = f.categories ?? [];
    if (f.type === 'binary') {
      const letters = cats.includes('Y');
      extra.push({...base, kind: 'yesno', yes: letters ? 'Y' : 1, no: letters ? 'N' : 0});
    } else if (f.type === 'categorical' || f.type === 'ordinal') {
      extra.push({...base, kind: 'choice', choices: cats.map((c) => ({
        value: c,
        text: c === 'N' ? (f.name === 'BBB' ? 'Normal' : 'None') : String(c),
      }))});
    } else {
      extra.push({...base, kind: 'number'});
    }
  }
  return [...INPUTS, ...extra];
}

export function valueText(s: InputSpec, v: Primitive | undefined | null): string {
  if (v === undefined || v === null) return 'Not provided';
  if (s.kind === 'yesno') return v === s.yes ? 'Yes' : v === s.no ? 'No' : String(v);
  if (s.kind === 'bmi') return Number(v).toFixed(1);
  if (s.kind === 'choice') return s.choices?.find((c) => c.value === v)?.text ?? String(v);
  return `${v}${s.unit ? ` ${s.unit}` : ''}`;
}

export function bmiBand(b: number): string {
  return b < 18.5 ? 'Underweight' : b < 25 ? 'Normal' : b < 30 ? 'Overweight' : 'Obese';
}
