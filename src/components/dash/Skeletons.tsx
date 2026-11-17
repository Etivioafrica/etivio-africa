import type { CSSProperties } from "react";

// Loading placeholders shaped like the screen that's coming, so a tab switch feels like the page filling in rather than
// being replaced. The phone shows the screen's big title above (MobileSection), so these never draw a title of their own.

const bar = (h: number, w: number | string, extra?: CSSProperties): CSSProperties => ({ height: h, width: w, maxWidth: "100%", ...extra });
const Line = ({ h = 12, w = "100%", style }: { h?: number; w?: number | string; style?: CSSProperties }) => <div className="et-skel" style={bar(h, w, style)} />;
const Round = ({ size }: { size: number }) => <div className="et-skel" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0 }} />;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="et-page" aria-busy="true" aria-label="Loading" style={{ gap: 14 }}>
      {children}
    </div>
  );
}

// Row of pills (filters, level chips).
function Chips({ n = 4 }: { n?: number }) {
  return (
    <div style={{ display: "flex", gap: 8, overflow: "hidden" }}>
      {Array.from({ length: n }, (_, i) => (
        <Line key={i} h={34} w={[72, 96, 84, 88, 70][i % 5]} style={{ borderRadius: 999, flexShrink: 0 }} />
      ))}
    </div>
  );
}

// Course / list cards: thumbnail, two lines of text, a price line.
export function CourseListSkeleton({ chips = true, rows = 4 }: { chips?: boolean; rows?: number }) {
  return (
    <Frame>
      {chips && <Chips />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="et-card" style={{ display: "flex", gap: 14, padding: 14 }}>
          <Line h={76} w={92} style={{ borderRadius: 14, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9, justifyContent: "center" }}>
            <Line h={14} w="85%" />
            <Line h={11} w="60%" />
            <Line h={11} w="35%" />
          </div>
        </div>
      ))}
    </Frame>
  );
}

// Explore: search bar, filter chips and marketplace cards.
export function ExploreSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <Frame>
      <Line h={46} style={{ borderRadius: 14 }} />
      <Chips n={5} />
      <div className="et-mk-grid">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="et-mk-card" style={{ minHeight: 0 }}>
            <Line h={150} style={{ borderRadius: 16 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 8px" }}>
              <Line h={13} w="80%" />
              <Line h={11} w="45%" />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// Campus feed: composer, then posts (avatar, name, a few lines, action row).
export function FeedSkeleton({ posts = 3 }: { posts?: number }) {
  return (
    <Frame>
      <div className="et-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
        <Round size={40} />
        <Line h={40} style={{ flex: 1, borderRadius: 999 }} />
      </div>
      {Array.from({ length: posts }, (_, i) => (
        <div key={i} className="et-card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Round size={40} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              <Line h={13} w="45%" />
              <Line h={10} w="28%" />
            </div>
          </div>
          <Line h={12} />
          <Line h={12} w="92%" />
          <Line h={12} w="60%" />
          <div style={{ display: "flex", gap: 24, paddingTop: 4 }}>
            <Line h={16} w={28} />
            <Line h={16} w={28} />
            <Line h={16} w={28} />
          </div>
        </div>
      ))}
    </Frame>
  );
}

// Me / profile: cover, avatar, name and buttons, then chips.
export function ProfileSkeleton() {
  return (
    <Frame>
      <div className="et-card" style={{ overflow: "hidden", padding: 0 }}>
        <Line h={110} style={{ borderRadius: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px 18px" }}>
          <div style={{ marginTop: -36 }}>
            <Round size={84} />
          </div>
          <Line h={20} w="55%" />
          <Line h={12} w="35%" />
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <Line key={i} h={38} style={{ flex: 1, borderRadius: 10 }} />
            ))}
          </div>
        </div>
      </div>
      <Chips n={4} />
      <Line h={120} style={{ borderRadius: 16 }} />
    </Frame>
  );
}

// Plain stacked rows (inbox, announcements, tables).
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Frame>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
          <Round size={44} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Line h={13} w="50%" />
            <Line h={11} w="80%" />
          </div>
        </div>
      ))}
    </Frame>
  );
}
