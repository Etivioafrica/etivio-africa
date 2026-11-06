"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Heart, ImagePlus, MessageCircle, Check } from "lucide-react";

// A looping, hands-off demo of posting on Campus, played inside the white card: the composer opens, the Update type
// is picked, a post is typed with an @mention, Post is pressed and the finished post appears. It only runs while on
// screen, and with reduced motion it just shows the finished post.
const TEXT = "Just finished my first case study for the UI Foundations course. Thank you @tunde for the feedback on the onboarding flow!";
const AT = TEXT.indexOf("@tunde");
const KINDS = ["Update", "Question", "Win", "Poll", "Opportunity"];

function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(@\w*)/g).map((part, i) => (part.startsWith("@") ? <em key={i}>{part}</em> : part))}
    </>
  );
}

type Phase = "idle" | "open" | "typing" | "posting" | "posted";

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function CampusSim() {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
  const [livePhase, setPhase] = useState<Phase>("idle");
  const [liveKind, setKind] = useState(false);
  const [liveTyped, setTyped] = useState("");
  const [press, setPress] = useState(false);
  const [liveLikes, setLikes] = useState(0);
  // With reduced motion nothing plays: the card just shows the finished post.
  const phase = reduced ? "posted" : livePhase;
  const kind = reduced || liveKind;
  const typed = reduced ? TEXT : liveTyped;
  const likes = reduced ? 3 : liveLikes;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    let dead = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));

    (async () => {
      while (!dead) {
        setPhase("idle");
        setKind(false);
        setTyped("");
        setLikes(0);
        await wait(1100);
        setPhase("open");
        await wait(900);
        setKind(true);
        await wait(800);
        setPhase("typing");
        for (let i = 1; i <= TEXT.length; i++) {
          setTyped(TEXT.slice(0, i));
          const ch = TEXT[i - 1];
          await wait(i === AT + 6 ? 750 : ch === "," || ch === "." ? 190 : 30 + (i % 3) * 9);
        }
        await wait(800);
        setPress(true);
        await wait(380);
        setPress(false);
        setPhase("posting");
        await wait(750);
        setPhase("posted");
        await wait(800);
        setLikes(1);
        await wait(700);
        setLikes(3);
        await wait(4600);
      }
    })();

    return () => {
      dead = true;
      timers.forEach(clearTimeout);
    };
  }, [visible, reduced]);

  const posted = phase === "posted";
  const composing = !posted;
  const mentionOpen = phase === "typing" && typed.length > AT && typed.length <= AT + 6;

  return (
    <div className="et-x-card et-sim" ref={root}>
      <div className="et-x-card-bar">
        <span>CAMPUS</span>
        <span>{posted || kind ? "UPDATE" : "NEW POST"}</span>
      </div>

      <div className="et-sim-stage">
        <div className={`et-sim-pane${composing ? " is-on" : ""}`}>
          <div className="et-x-who">
            <span className="et-x-av">A</span>
            <div>
              <b>Amaka O.</b>
              <small>Product design</small>
            </div>
          </div>

          {phase === "idle" ? (
            <div className="et-sim-ph">Share something with Campus…</div>
          ) : (
            <>
              <div className="et-sim-kinds">
                {KINDS.map((k) => (
                  <span key={k} className={kind && k === "Update" ? "is-on" : undefined}>
                    {k}
                  </span>
                ))}
              </div>
              <div className="et-sim-box">
                {typed ? (
                  <p>
                    <Marked text={typed} />
                    {phase === "typing" && <i className="et-sim-caret" />}
                  </p>
                ) : (
                  <p className="et-sim-ph2">Write your update…{phase === "open" && <i className="et-sim-caret" />}</p>
                )}
                {mentionOpen && (
                  <div className="et-sim-pop">
                    <span className="et-x-av">T</span>
                    <div>
                      <b>Tunde A.</b>
                      <small>@tunde</small>
                    </div>
                  </div>
                )}
              </div>
              <div className="et-sim-actions">
                <span className="et-sim-add">
                  <ImagePlus size={16} /> Photo
                </span>
                <span className={`et-sim-send${press ? " is-press" : ""}`}>{phase === "posting" ? "Posting…" : "Post"}</span>
              </div>
            </>
          )}
        </div>

        <div className={`et-sim-pane${posted ? " is-on" : ""}`}>
          <div className="et-x-who">
            <span className="et-x-av">A</span>
            <div>
              <b>Amaka O.</b>
              <small>Product design · just now</small>
            </div>
            <span className="et-sim-done">
              <Check size={13} strokeWidth={3} /> Posted
            </span>
          </div>
          <p className="et-x-post">
            <Marked text={TEXT} />
          </p>
          <div className="et-x-post-foot">
            <span className={likes ? "is-liked" : undefined}>
              <Heart size={15} /> {likes}
            </span>
            <span>
              <MessageCircle size={15} /> {likes > 1 ? "1 reply" : "0 replies"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
