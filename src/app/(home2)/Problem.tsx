// "The problem" band after the statement (AgentLab style): black, a serif heading, and three bordered cards with a
// small isometric icon and a title; the one-line explanation slides in under the title on hover (always shown on touch
// screens). The story: people learn alone, with no place to share resources or find each other, which is why Campus exists.

const CARDS = [
  { id: "share", title: "Resources get lost", body: "Notes, templates and useful links end up lost in chat groups. Campus gives them one home you can search, save and share." },
  { id: "find", title: "Hard to find smart people", body: "The people worth learning with are hard to find. On Campus you meet learners and tutors by topic, follow them and mention them." },
  { id: "ask", title: "Questions with no answers", body: "You ask and then you wait. On Campus people who have been where you are reply, and Etivio AI helps with the rest." },
] as const;

// Isometric blocks: a lit top, a blue left face and a dark right face. Each icon builds on the same cube.
function Cube({ x = 0, y = 0, s = 1, id }: { x?: number; y?: number; s?: number; id: string }) {
  const k = (n: number) => n * s;
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points={`0,${k(-22)} ${k(38)},0 0,${k(22)} ${k(-38)},0`} fill={`url(#${id}-top)`} />
      <polygon points={`${k(-38)},0 0,${k(22)} 0,${k(66)} ${k(-38)},${k(44)}`} fill={`url(#${id}-left)`} />
      <polygon points={`${k(38)},0 0,${k(22)} 0,${k(66)} ${k(38)},${k(44)}`} fill="#0b0b0d" stroke="#2a2a30" strokeWidth="1" />
    </g>
  );
}

function Icon({ id }: { id: (typeof CARDS)[number]["id"] }) {
  return (
    <svg viewBox="0 0 120 120" width="104" height="104" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9c3ff" />
          <stop offset="1" stopColor="#4f7dff" />
        </linearGradient>
        <linearGradient id={`${id}-left`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d6bff" />
          <stop offset="1" stopColor="#1736b8" />
        </linearGradient>
      </defs>
      {id === "share" && (
        <>
          <Cube id={id} x={56} y={38} s={1} />
          <circle cx="90" cy="30" r="15" fill="#0b0b0d" stroke="#4f7dff" strokeWidth="2.5" />
          <path d="M84 36l12-12M87 24h9v9" fill="none" stroke="#a9c3ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {id === "find" && (
        <>
          <Cube id={id} x={44} y={50} s={0.62} />
          <Cube id={id} x={86} y={22} s={0.38} />
          <path d="M62 62 L78 44" stroke="#4f7dff" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
        </>
      )}
      {id === "ask" && (
        <>
          <Cube id={id} x={56} y={30} s={1} />
          <circle cx="88" cy="86" r="16" fill="#0b0b0d" stroke="#4f7dff" strokeWidth="2.5" />
          <text x="88" y="93" textAnchor="middle" fontSize="20" fontWeight="700" fill="#a9c3ff" fontFamily="system-ui, sans-serif">
            ?
          </text>
        </>
      )}
    </svg>
  );
}

export function Problem() {
  return (
    <section className="et-x-problem">
      <span className="et-x-label">
        <i /> The problem
      </span>
      <h2>Too many smart people learn alone, with nowhere to share resources or meet each other. So we built Campus.</h2>
      <div className="et-x-pcards">
        {CARDS.map((c) => (
          <article key={c.id}>
            <Icon id={c.id} />
            <div>
              <h3>{c.title}</h3>
              <div className="et-x-reveal">
                <p>{c.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
