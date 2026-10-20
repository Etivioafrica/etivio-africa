export default function Loading() {
  return (
    <div className="et-app is-light et-pl">
      <header className="et-pl-top" />
      <div className="et-pl-body">
        <main className="et-pl-main">
          <div className="et-pl-stage">
            <div className="et-pl-video" />
          </div>
          <div className="et-pl-panel">
            <div className="et-skel" style={{ height: 120 }} />
          </div>
        </main>
        <aside className="et-pl-side">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="et-skel" style={{ height: 44, margin: 12 }} />
          ))}
        </aside>
      </div>
    </div>
  );
}
