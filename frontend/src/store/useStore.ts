import {create} from 'zustand';
import {api} from '../api/client';
import type {FeatureDef, MetricsPayload, Prediction, Primitive, Sample, Target} from '../types';

// One shared store: the 3D scene and the dashboard both read from here (roadmap 14.4).
interface Settings {
  colorBlind: boolean;
  labels: boolean;
  live: boolean;
  autoRotate: boolean;
}

interface Store {
  features: FeatureDef[];
  samples: Sample[];
  metrics: MetricsPayload | null;
  backend: 'unknown' | 'up' | 'down';
  input: Record<string, Primitive>;
  prediction: Prediction | null;
  selectedTarget: Target | null;
  hoveredTarget: Target | null;
  status: 'idle' | 'loading' | 'error' | 'ready';
  error: string | null;
  settings: Settings;
  resetNonce: number;
  init: () => Promise<void>;
  setField: (name: string, value: Primitive | undefined) => void;
  loadSample: (id: string) => void;
  resetForm: () => void;
  predict: () => Promise<void>;
  select: (t: Target | null) => void;
  hover: (t: Target | null) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  resetView: () => void;
}

let liveTimer: ReturnType<typeof setTimeout> | undefined;
let requestId = 0;

export const useStore = create<Store>((set, get) => ({
  features: [],
  samples: [],
  metrics: null,
  backend: 'unknown',
  input: {},
  prediction: null,
  selectedTarget: null,
  hoveredTarget: null,
  status: 'idle',
  error: null,
  settings: {colorBlind: false, labels: true, live: true, autoRotate: false},
  resetNonce: 0,

  init: async () => {
    try {
      const [features, samples] = await Promise.all([api.features(), api.samples()]);
      set({features, samples, backend: 'up', error: null});
    } catch (e) {
      set({backend: 'down', error: (e as Error).message});
      return;
    }
    api.metrics().then((metrics) => set({metrics})).catch(() => undefined);
  },

  setField: (name, value) => {
    const input = {...get().input};
    if (value === undefined || value === '') delete input[name];
    else input[name] = value;
    // BMI is autofilled from height and weight (the dataset's BMI equals weight / (height/100)^2).
    if (name === 'Weight' || name === 'Length') {
      const w = Number(input.Weight), h = Number(input.Length);
      if (input.Weight !== undefined && input.Length !== undefined && w > 0 && h > 0) input.BMI = Math.round((w / (h / 100) ** 2) * 100) / 100;
      else delete input.BMI;
    }
    // The shown result belongs to the old inputs. Drop it (the heart returns to its
    // neutral state) and ignore any request still in flight for those old inputs.
    requestId++;
    clearTimeout(liveTimer);
    set({input, prediction: null, status: 'idle', error: null});
    const hasCore = input.Age !== undefined && input.Sex !== undefined && input.BP !== undefined;
    if (get().settings.live && hasCore) {
      liveTimer = setTimeout(() => void get().predict(), 300);
    }
  },

  loadSample: (id) => {
    const s = get().samples.find((x) => x.id === id);
    if (!s) return;
    clearTimeout(liveTimer);
    set({input: {...s.features}, prediction: null});
    void get().predict();
  },

  resetForm: () => {
    clearTimeout(liveTimer);
    requestId++;
    set({input: {}, prediction: null, selectedTarget: null, status: 'idle', error: null});
  },

  predict: async () => {
    const input = get().input;
    const hasCore = input.Age !== undefined && input.Sex !== undefined && input.BP !== undefined;
    if (!hasCore) {
      set({prediction: null, status: 'idle'});
      return;
    }
    const id = ++requestId;
    set({status: 'loading', error: null, prediction: null});
    try {
      const prediction = await api.predict(input);
      if (id !== requestId) return; // a newer request superseded this one
      set({prediction, status: 'ready', backend: 'up'});
    } catch (e) {
      if (id !== requestId) return;
      set({status: 'error', error: (e as Error).message, prediction: null});
    }
  },

  select: (t) => set({selectedTarget: t}),
  hover: (t) => set({hoveredTarget: t}),
  setSetting: (k, v) => set({settings: {...get().settings, [k]: v}}),
  resetView: () => set({selectedTarget: null, resetNonce: get().resetNonce + 1}),
}));
