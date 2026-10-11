import {useStore} from '../store/useStore';

const f = (x: number | undefined) => (x == null ? '–' : x.toFixed(2));
const figures = [
  ['holdout_roc.png', 'ROC curves on the held-out test set'],
  ['holdout_calibration.png', 'Calibration on the held-out test set'],
  ['holdout_confusion_matrices.png', 'Confusion matrices on the held-out test set'],
  ['global_logistic_contributions.png', 'Global feature contributions'],
];

export function ModelPerformance() {
  const metrics = useStore((s) => s.metrics);
  if (!metrics) return <p className="note">Metrics are not available. Check that the backend is running and reports/metrics.json exists.</p>;
  return (
    <div>
      <p className="note">Held-out test set (20% of the data), raw logistic regression at a 0.5 threshold. {metrics.purpose}</p>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Target</th><th className="r">Accuracy</th><th className="r">Precision</th><th className="r">Recall</th><th className="r">F1</th><th className="r">ROC-AUC</th><th className="r">Brier</th><th className="r">Positives / total</th></tr>
          </thead>
          <tbody>
            {metrics.targets.map((t) => {
              const m = t.holdout_metrics;
              const pos = t.class_counts_full_dataset['1'];
              return (
                <tr key={t.target}>
                  <td><b>{t.target}</b></td>
                  <td className="r mono">{f(m.accuracy)}</td><td className="r mono">{f(m.precision)}</td>
                  <td className="r mono">{f(m.recall_sensitivity)}</td><td className="r mono">{f(m.f1)}</td>
                  <td className="r mono">{f(m.roc_auc)}</td><td className="r mono">{f(m.brier_score)}</td>
                  <td className="r mono">{pos} / {t.dataset_rows}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">With 61 held-out patients these numbers are noisy. See reports/baseline_evaluation.md for confidence intervals and cross-validation.</p>
      <div className="figs">
        {figures.map(([file, alt]) => <img key={file} src={`/figures/${file}`} alt={alt} loading="lazy" />)}
      </div>
    </div>
  );
}
