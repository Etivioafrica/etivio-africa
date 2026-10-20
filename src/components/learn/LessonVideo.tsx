"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import type { VideoSource } from "@/lib/video";

// Lesson video for learners. YouTube lessons play through YouTube's iframe API with YouTube's own controls turned
// off: the iframe is cropped so its edge overlays (title, logo, "Watch on YouTube", share) sit outside the frame, a
// clear shield on top swallows clicks and right-clicks so nothing in the iframe can be reached, and our controls
// drive playback instead. Uploaded files play in a <video> without the download option.

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  setVolume(v: number): void;
  setPlaybackRate(r: number): void;
  destroy(): void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars: Record<string, string | number>;
      events: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace & { loaded?: number };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<YTNamespace> | null = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiReady ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.append(s);
  });
  return apiReady;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];
const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

export function LessonVideo({ source, title, next }: { source: VideoSource; title: string; next?: { href: string; label: string } | null }) {
  if (source.provider === "youtube") return <YouTubeVideo key={source.id} id={source.id} title={title} next={next} />;
  return (
    <div className="et-pl-video">
      {source.provider === "vimeo" ? (
        <iframe
          src={`https://player.vimeo.com/video/${source.id}?title=0&byline=0&portrait=0&badge=0&dnt=1&pip=0`}
          title={title}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video src={source.src} controls controlsList="nodownload" disablePictureInPicture preload="metadata" onContextMenu={(e) => e.preventDefault()} />
      )}
    </div>
  );
}

function YouTubeVideo({ id, title, next }: { id: string; title: string; next?: { href: string; label: string } | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "paused" | "buffering" | "ended">("idle");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [rate, setRate] = useState(1);
  const [full, setFull] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [speedOpen, setSpeedOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = document.createElement("div");
    mount.current?.append(host);
    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player.current = new YT.Player(host, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1, cc_load_policy: 0, origin: window.location.origin },
        events: {
          onReady: () => {
            setReady(true);
            setDuration(player.current?.getDuration() ?? 0);
          },
          onStateChange: ({ data }) => {
            // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            if (data === 1) setState("playing");
            else if (data === 2) setState("paused");
            else if (data === 3) setState("buffering");
            else if (data === 0) setState("ended");
            setDuration(player.current?.getDuration() ?? 0);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      host.remove();
    };
  }, [id]);

  // Keep the clock moving while it plays.
  useEffect(() => {
    if (state !== "playing") return;
    const t = setInterval(() => setTime(player.current?.getCurrentTime() ?? 0), 250);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const playing = state === "playing" || state === "buffering";
  const toggle = useCallback(() => {
    const p = player.current;
    if (!p || !ready) return;
    if (state === "ended") p.seekTo(0, true);
    if (playing) p.pauseVideo();
    else p.playVideo();
  }, [ready, playing, state]);

  const seek = (to: number) => {
    const s = Math.min(Math.max(0, to), duration || to);
    player.current?.seekTo(s, true);
    setTime(s);
  };

  const toggleMute = () => {
    if (muted) player.current?.unMute();
    else player.current?.mute();
    setMuted(!muted);
  };

  const toggleFull = () => {
    const el = wrap.current;
    if (!el) return;
    // iPhone Safari can't make an element fullscreen, so fill the window instead.
    if (!el.requestFullscreen) return setFull(!full);
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => setFull(!full));
  };

  const wake = () => {
    setChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setChrome(false);
      setSpeedOpen(false);
    }, 2500);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, .et-vp-menu")) return;
    if (e.key === "Escape" && speedOpen) return setSpeedOpen(false);
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") toggle();
    else if (k === "arrowleft" || k === "j") seek(time - (k === "j" ? 10 : 5));
    else if (k === "arrowright" || k === "l") seek(time + (k === "l" ? 10 : 5));
    else if (k === "m") toggleMute();
    else if (k === "f") toggleFull();
    else return;
    e.preventDefault();
    wake();
  };

  const showChrome = chrome || !playing;

  return (
    <div
      ref={wrap}
      className={`et-vp${full ? " is-full" : ""}${showChrome ? "" : " is-idle"}`}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={wake}
      onMouseLeave={() => playing && setChrome(false)}
      aria-label={`Video: ${title}`}
    >
      <div className="et-vp-box">
        <div ref={mount} className="et-vp-frame" />
        {/* Catches every click so nothing inside YouTube's frame can be reached. */}
        <div className="et-vp-shield" onClick={() => (speedOpen ? setSpeedOpen(false) : toggle())} onDoubleClick={toggleFull} onContextMenu={(e) => e.preventDefault()} />

        {(state === "idle" || state === "ended") && (
          <div className="et-vp-cover" onContextMenu={(e) => e.preventDefault()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" draggable={false} />
            {state === "ended" ? (
              <div className="et-vp-end">
                <button type="button" className="et-btn et-btn-ghost" onClick={toggle}>
                  <RotateCcw size={16} /> Watch again
                </button>
                {next && (
                  <Link href={next.href} className="et-btn et-btn-primary">
                    {next.label} <ChevronRight size={16} />
                  </Link>
                )}
              </div>
            ) : (
              <button type="button" className="et-vp-big" onClick={toggle} disabled={!ready} aria-label="Play video">
                <Play size={34} fill="currentColor" />
              </button>
            )}
          </div>
        )}
        {state === "paused" && (
          <button type="button" className="et-vp-big is-paused" onClick={toggle} aria-label="Play video">
            <Play size={34} fill="currentColor" />
          </button>
        )}

        <div className="et-vp-controls" onContextMenu={(e) => e.preventDefault()}>
          <input
            type="range"
            className="et-vp-seek"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(time, duration || 1)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            style={{ "--p": `${duration ? (time / duration) * 100 : 0}%` } as React.CSSProperties}
          />
          <div className="et-vp-row">
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button type="button" onClick={() => seek(time - 10)} aria-label="Back 10 seconds">
              <RotateCcw size={19} />
            </button>
            <button type="button" onClick={() => seek(time + 10)} aria-label="Forward 10 seconds">
              <RotateCw size={19} />
            </button>
            <span className="et-vp-time">
              {clock(time)} / {clock(duration)}
            </span>
            <span className="et-vp-spacer" />
            <div className="et-vp-speed">
              <button type="button" className="et-vp-speed-btn" onClick={() => setSpeedOpen(!speedOpen)} aria-haspopup="menu" aria-expanded={speedOpen} aria-label={`Playback speed ${rate}x`}>
                {rate}x
              </button>
              {speedOpen && (
                <div className="et-vp-menu" role="menu">
                  <small>Speed</small>
                  {RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="menuitemradio"
                      aria-checked={r === rate}
                      className={r === rate ? "is-on" : undefined}
                      onClick={() => {
                        player.current?.setPlaybackRate(r);
                        setRate(r);
                        setSpeedOpen(false);
                      }}
                    >
                      {r === 1 ? "Normal" : `${r}x`}
                      {r === rate && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
              {muted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <input
              type="range"
              className="et-vp-vol"
              min={0}
              max={100}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                player.current?.setVolume(v);
                if (muted && v > 0) {
                  player.current?.unMute();
                  setMuted(false);
                }
                setVolume(v);
              }}
              aria-label="Volume"
              style={{ "--p": `${muted ? 0 : volume}%` } as React.CSSProperties}
            />
            <button type="button" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"}>
              {full ? <Minimize size={19} /> : <Maximize size={19} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
