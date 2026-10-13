export type Target = 'CAD' | 'LAD' | 'LCX' | 'RCA';
export type Primitive = string | number;

export interface FeatureDef {
  name: string;
  type: 'continuous' | 'binary' | 'categorical' | 'ordinal';
  group: string;
  unit: string | null;
  input_range: [number, number] | null;
  reference_range: [number, number] | null;
  categories?: Primitive[];
  constant_in_source?: boolean;
}

export interface Sample {
  id: string;
  label: string;
  description: string;
  features: Record<string, Primitive>;
}

export interface VesselPrediction {
  probability: number;
  risk_level: 'low' | 'moderate' | 'high' | string;
  threshold: number;
}

export interface ExplanationItem {
  feature: string;
  category?: string;
  value: Primitive | null;
  log_odds: number;
  direction: 'raises_risk' | 'lowers_risk' | 'neutral' | string;
  method?: string | null;
  base_value?: number | null;
}

export interface Prediction {
  model_version: string;
  missing_fields: string[];
  cad: VesselPrediction & {label: string};
  vessels: Record<string, VesselPrediction>;
  explanations: Record<string, ExplanationItem[]>;
  group_contributions: Record<string, Record<string, number>>;
  disclaimer: string;
}

export interface TargetMetrics {
  target: string;
  dataset_rows: number;
  holdout_rows: number;
  class_counts_full_dataset: Record<string, number>;
  holdout_metrics: HoldoutMetrics;
  sigmoid_calibrated_holdout_metrics?: HoldoutMetrics;
}

export interface HoldoutMetrics {
  accuracy: number;
  precision: number;
  recall_sensitivity: number;
  f1: number;
  roc_auc: number;
  brier_score: number;
}

export interface MetricsPayload {
  purpose?: string;
  targets: TargetMetrics[];
}

export interface ArteryDef {
  key: string;
  label: string;
  meshNode: string;
  target: string;
}

export interface ArteryConfig {
  arteries: ArteryDef[];
  riskLevels: {low: number; high: number};
}
