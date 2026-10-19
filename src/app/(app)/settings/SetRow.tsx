// One settings section: label + description on the left, controls on the right.
export function SetRow({ title, sub, danger, children }: { title: string; sub?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className={`et-set-row${danger ? " is-danger" : ""}`}>
      <div className="et-set-label">
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </div>
      <div className="et-set-ctrl">{children}</div>
    </div>
  );
}
