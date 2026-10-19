// Shown the moment a link is clicked while the next page's data loads, so navigation never feels stuck.
export function PageSkeleton() {
  return (
    <div className="et-page" aria-busy="true" aria-label="Loading">
      <div className="et-skel" style={{ height: 30, width: 260 }} />
      <div className="et-skel" style={{ height: 16, width: 380, maxWidth: "80%" }} />
      <div className="et-skel-grid">
        <div className="et-skel" style={{ height: 150 }} />
        <div className="et-skel" style={{ height: 150 }} />
        <div className="et-skel" style={{ height: 150 }} />
      </div>
      <div className="et-skel" style={{ height: 260 }} />
    </div>
  );
}
