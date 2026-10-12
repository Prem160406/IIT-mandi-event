import {useStore} from '../store/useStore';

const f = (x: number | undefined) => (x == null ? '–' : x.toFixed(2));
const figures = [
  ['holdout_roc.png', 'ROC curves'],
  ['holdout_calibration.png', 'Calibration'],
  ['holdout_confusion_matrices.png', 'Confusion matrices'],
  ['global_logistic_contributions.png', 'Global feature contributions'],
];

// Every number below comes from reports/metrics.json via the backend; nothing is hard-coded.
export function ModelPerformance() {
  const metrics = useStore((s) => s.metrics);
  if (!metrics) return <p className="note">Metrics are not available. Check that the backend is running and reports/metrics.json exists.</p>;
  return (
    <div className="perf">
      <div className="kpis">
        {metrics.targets.map((t) => (
          <div className="kpi" key={t.target}>
            <span>{t.target}</span>
            <b>{f(t.holdout_metrics.roc_auc)}</b>
            <small>AUC · {t.class_counts_full_dataset['1']} of {t.dataset_rows} narrowed</small>
          </div>
        ))}
      </div>
      <div className="scroll">
        <table className="mt">
          <thead>
            <tr><th>Target</th><th className="r">Accuracy</th><th className="r">Precision</th><th className="r">Recall</th><th className="r">F1</th><th className="r">ROC-AUC</th><th className="r">Brier</th></tr>
          </thead>
          <tbody>
            {metrics.targets.map((t) => {
              const m = t.holdout_metrics;
              return (
                <tr key={t.target}>
                  <td><b>{t.target}</b></td>
                  <td className="r mono">{f(m.accuracy)}</td><td className="r mono">{f(m.precision)}</td>
                  <td className="r mono">{f(m.recall_sensitivity)}</td><td className="r mono">{f(m.f1)}</td>
                  <td className="r mono">{f(m.roc_auc)}</td><td className="r mono">{f(m.brier_score)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">Held-out test set ({metrics.targets[0]?.holdout_rows ?? '–'} patients), logistic regression at a 0.5 threshold. Small test set, so values are noisy.</p>
      <div className="figs">
        {figures.map(([file, cap]) => (
          <figure key={file}><div className="fimg"><img src={`/figures/${file}`} alt={cap} loading="lazy" /></div><figcaption>{cap}</figcaption></figure>
        ))}
      </div>
    </div>
  );
}
