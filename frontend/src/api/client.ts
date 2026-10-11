import type {FeatureDef, MetricsPayload, Prediction, Primitive, Sample} from '../types';

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(`Cannot reach the API at ${API_URL}. Start the backend and try again.`);
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: {msg?: string}) => d.msg).join('; ');
    } catch { /* keep status text */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{status: string; loaded_models: string[]}>('/health'),
  features: async () => (await request<{features: FeatureDef[]}>('/features')).features,
  samples: async () => (await request<{samples: Sample[]}>('/samples')).samples,
  metrics: () => request<MetricsPayload>('/metrics'),
  predict: (features: Record<string, Primitive>) =>
    request<Prediction>('/predict', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({features}),
    }),
};
