const GROUPS = [
  'Demographic',
  'Symptoms and examination',
  'ECG',
  'Laboratory and echo',
] as const;

const format = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(3)}`;

export function PhysiologicalBreakdown({contributions}: {contributions?: Record<string, number> | null}) {
  const values = GROUPS.map((group) => {
    const value = contributions?.[group];
    return [group, typeof value === 'number' && Number.isFinite(value) ? value : null] as const;
  });
  const available = values.some(([, value]) => value != null);
  const maximum = Math.max(0.001, ...values.map(([, value]) => Math.abs(value ?? 0)));

  return (
    <section className="phys" aria-label="Physiological group contribution breakdown">
      <p className="note phys-caption">Net contribution to log-odds risk by physiological category</p>
      {!available ? <p className="note">No physiological breakdown available.</p> : (
        <div className="phys-rows">
          {values.map(([group, value]) => {
            const width = value == null ? 0 : Math.abs(value) / maximum * 50;
            const style = value == null ? undefined : {
              left: value < 0 ? `${50 - width}%` : '50%',
              width: `${width}%`,
            };
            return (
              <div className="phys-row" key={group}>
                <span className="phys-name">{group}</span>
                <div className="phys-track" aria-label={`${group}: ${value == null ? 'unavailable' : format(value)} log-odds`}>
                  <i className="phys-zero" />
                  {value != null && <i className={`phys-bar ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'}`} style={style} />}
                </div>
                <span className={`phys-value ${value != null && value < 0 ? 'negative' : 'positive'}`}>{value == null ? '–' : format(value)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
