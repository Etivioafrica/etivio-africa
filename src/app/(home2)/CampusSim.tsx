"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BarChart3, Briefcase, Check, Heart, HelpCircle, ImagePlus, Megaphone, MessageCircle, Repeat2, Smile, Trophy, Video } from "lucide-react";
import { defaultAvatar } from "@/lib/avatars";

// A looping, hands-off demo of posting on Campus, played inside the white card and styled like the real composer and post
// card (same shapes, icons and colours as /campus): the box opens, the Update type is picked, a post is typed with an
// @mention, Post is pressed and the finished post appears. It only runs while on screen, and with reduced motion it just
// shows the finished post.
const TEXT = "Just finished my first case study for the UI Foundations course. Thank you @tunde for the feedback on the onboarding flow!";
const AT = TEXT.indexOf("@tunde");
const KINDS = [
  { k: "update", label: "Update", icon: Megaphone },
  { k: "question", label: "Question", icon: HelpCircle },
  { k: "win", label: "Win", icon: Trophy },
  { k: "poll", label: "Poll", icon: BarChart3 },
  { k: "opportunity", label: "Opportunity", icon: Briefcase },
] as const;
const QUICK = KINDS.filter((x) => x.k !== "update");

const AMAKA = defaultAvatar("Amaka O.");
const TUNDE = defaultAvatar("Tunde A.");

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
        await wait(1400);
        setPhase("open");
        await wait(1000);
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
        await wait(900);
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
  const closed = phase === "idle";
  const mentionOpen = phase === "typing" && typed.length > AT && typed.length <= AT + 6;
  const ready = typed.length > 0;

  return (
    <div className="et-sim" ref={root}>
      <div className="et-sim-stage">
        {/* The composer, closed then open */}
        <div className={`et-sim-pane${posted ? "" : " is-on"}`}>
          {closed ? (
            <>
              <div className="et-sim-closed">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={AMAKA} alt="" className="et-sim-face" />
                <span>What are you learning today?</span>
              </div>
              <div className="et-sim-quick">
                {QUICK.map(({ k, label, icon: Icon }) => (
                  <span key={k}>
                    <Icon size={17} className={`k-${k}`} /> {label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="et-sim-open">
              <div className="et-sim-who">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={AMAKA} alt="" className="et-sim-face" />
                <span>
                  <b>Amaka O.</b>
                  <small>Posting to Campus</small>
                </span>
              </div>
              <div className="et-sim-types">
                {KINDS.map(({ k, label, icon: Icon }) => (
                  <span key={k} className={`k-${k}${kind && k === "update" ? " is-on" : ""}`}>
                    <Icon size={15} /> {label}
                  </span>
                ))}
              </div>
              <div className="et-sim-area">
                {typed ? (
                  <p>
                    <Marked text={typed} />
                    {phase === "typing" && <i className="et-sim-caret" />}
                  </p>
                ) : (
                  <p className="et-sim-ph">
                    What are you learning today?
                    {phase === "open" && <i className="et-sim-caret" />}
                  </p>
                )}
                {mentionOpen && (
                  <div className="et-sim-pop">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={TUNDE} alt="" className="et-sim-face is-sm" />
                    <span>
                      <b>Tunde A.</b>
                      <small>@tunde</small>
                    </span>
                  </div>
                )}
              </div>
              <div className="et-sim-tool">
                <div className="et-sim-icons">
                  <span>
                    <ImagePlus size={19} />
                  </span>
                  <span>
                    <Video size={19} />
                  </span>
                  <span>
                    <Smile size={19} />
                  </span>
                </div>
                <span className={`et-sim-btn${ready ? " is-ready" : ""}${press ? " is-press" : ""}`}>{phase === "posting" ? "Posting…" : "Post"}</span>
              </div>
            </div>
          )}
        </div>

        {/* The finished post, as it appears in the feed */}
        <div className={`et-sim-pane${posted ? " is-on" : ""}`}>
          <article className="et-sim-post">
            <header>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={AMAKA} alt="" className="et-sim-face" />
              <div className="et-sim-head">
                <div className="et-sim-line">
                  <b>Amaka O.</b>
                  <span>@amaka · just now</span>
                </div>
                <span className="et-sim-kind k-update">
                  <Megaphone size={13} /> Updates
                </span>
              </div>
              <span className="et-sim-done">
                <Check size={13} strokeWidth={3} /> Posted
              </span>
            </header>
            <p className="et-sim-text">
              <Marked text={TEXT} />
            </p>
            <footer>
              <span className={`et-sim-act is-like${likes ? " is-on" : ""}`}>
                <Heart size={18} fill={likes ? "currentColor" : "none"} /> {likes || ""}
              </span>
              <span className="et-sim-act">
                <MessageCircle size={18} /> {likes > 1 ? 1 : ""}
              </span>
              <span className="et-sim-act">
                <Repeat2 size={19} />
              </span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
