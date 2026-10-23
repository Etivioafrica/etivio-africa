"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Check, Maximize2, Mic, MicOff, Minimize2, MonitorUp, MonitorX, PhoneOff, Video, VideoOff, Volume2 } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { joinSessionCall } from "@/app/(call)/sessions/actions";
import type { SessionRoom } from "@/lib/data/coaching";

// The call room for one coaching session. Audio and video go straight between the two browsers (WebRTC). The coach's
// browser makes the offer; the learner's answers. Connection messages travel over the private Realtime channel
// "session:<id>" (only these two people can use it, see migration 0050), and presence there shows who's in the room.
// A new offer generation (`gen`) starts whenever the coach builds a fresh connection, e.g. after someone refreshes.

type Phase = "lobby" | "joining" | "in" | "left";
type Peer = { mic: boolean; cam: boolean; screen: boolean };
type Sig =
  | { t: "hello" }
  | { t: "offer" | "answer"; gen: number; sdp: RTCSessionDescriptionInit }
  | { t: "ice"; gen: number; c: RTCIceCandidateInit }
  | ({ t: "state" } & Peer)
  | { t: "restart" }
  | { t: "bye" };

const noop = () => () => {};
const clock = () => Date.now();
const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO: MediaTrackConstraints = { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function CallRoom({ room, opensAt, closesAt, backHref }: { room: SessionRoom; opensAt: number; closesAt: number; backHref: string }) {
  // Its own client with the Realtime heartbeat in a Web Worker: browsers slow timers in background tabs (for example
  // while you share another tab), and without this the connection would drop and the other side would think you left.
  const db = useMemo(
    () =>
      createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        isSingleton: false,
        realtime: { worker: true },
      }),
    [],
  );
  const isCoach = room.role === "coach";
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [peerHere, setPeerHere] = useState(false);
  const [peer, setPeer] = useState<Peer>({ mic: true, cam: false, screen: false });
  const [link, setLink] = useState<"none" | "connecting" | "connected" | "reconnecting">("none");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  const [outs, setOuts] = useState<MediaDeviceInfo[] | null>(null);
  const [outId, setOutId] = useState("");
  const [fs, setFs] = useState(false);

  const chan = useRef<RealtimeChannel | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const gen = useRef(0);
  const pendingIce = useRef<{ gen: number; c: RTCIceCandidateInit }[]>([]);
  const ice = useRef<RTCIceServer[]>([]);
  const mic = useRef<MediaStreamTrack | null>(null);
  const cam = useRef<MediaStreamTrack | null>(null);
  const screen = useRef<MediaStreamTrack | null>(null);
  const local = useRef<MediaStream>(null);
  const remote = useRef<MediaStream | null>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const joined = useRef(false);
  const state = useRef<Peer>({ mic: true, cam: false, screen: false });
  const helloTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const goneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string, ms = 4000) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), ms);
  }, []);

  // The preview and the camera tile pick up whichever video is being sent (screen first, then camera).
  const localView = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    const t = screen.current ?? cam.current;
    el.srcObject = t ? new MediaStream([t]) : null;
    void el.play().catch(() => {});
  }, []);

  const send = (m: Sig) => void chan.current?.send({ type: "broadcast", event: "sig", payload: m });
  const shareState = () => send({ t: "state", ...state.current });

  // ----- Devices ------------------------------------------------------------------------------------------------
  const getMic = async () => {
    if (mic.current) return true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
      mic.current = s.getAudioTracks()[0];
      mic.current.enabled = state.current.mic;
      return true;
    } catch {
      flash("Allow microphone access so the other person can hear you.", 6000);
      return false;
    }
  };
  const getCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: VIDEO });
      cam.current = s.getVideoTracks()[0];
      return true;
    } catch {
      flash("Camera unavailable. You can still join with audio.", 5000);
      return false;
    }
  };

  // Ask for the camera and microphone as soon as the lobby opens, so people can check how they look and sound.
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      queueMicrotask(() => flash("This browser can't make video calls. Try Chrome, Safari or Edge.", 10000));
      return;
    }
    let cancelled = false;
    void (async () => {
      await getMic();
      const ok = await getCam();
      if (cancelled) return;
      state.current.cam = ok;
      setCamOn(ok);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Connection ---------------------------------------------------------------------------------------------
  const videoSender = () => pc.current?.getTransceivers().find((t) => t.receiver.track.kind === "video")?.sender ?? null;
  const outgoingVideo = () => screen.current ?? cam.current ?? null;

  const stopHealing = () => {
    if (healTimer.current) clearInterval(healTimer.current);
    healTimer.current = null;
  };
  // A stalled or failed connection is repaired, not hung up: the coach restarts the network side (ICE restart) and
  // the learner asks for one. It keeps trying every few seconds until the call is back or someone leaves.
  const heal = () => {
    if (healTimer.current || !joined.current) return;
    const attempt = () => {
      const p = pc.current;
      if (!joined.current || !p || p.connectionState === "connected") return stopHealing();
      if (isCoach) void offer(true);
      else send({ t: "restart" });
    };
    healTimer.current = setInterval(attempt, 6000);
    attempt();
  };
  const isLive = () => !!pc.current && ["new", "connecting", "connected", "disconnected"].includes(pc.current.connectionState);

  const closePc = () => {
    stopHealing();
    pc.current?.close();
    pc.current = null;
    remote.current = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    pendingIce.current = [];
  };

  const newPc = () => {
    closePc();
    const p = new RTCPeerConnection({ iceServers: ice.current });
    pc.current = p;
    remote.current = new MediaStream();
    if (remoteVideo.current) remoteVideo.current.srcObject = remote.current;
    p.ontrack = (e) => {
      if (!remote.current) remote.current = new MediaStream();
      if (!remote.current.getTracks().includes(e.track)) remote.current.addTrack(e.track);
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = remote.current;
        void remoteVideo.current.play().catch(() => {});
      }
    };
    p.onicecandidate = (e) => {
      if (e.candidate) send({ t: "ice", gen: gen.current, c: e.candidate.toJSON() });
    };
    p.onconnectionstatechange = () => {
      if (pc.current !== p) return;
      const s = p.connectionState;
      if (s === "connected") {
        stopHealing();
        setLink("connected");
        shareState();
      } else if (s === "disconnected") {
        // Often a brief hiccup that sorts itself out; repair it if it hasn't after a few seconds.
        setLink("reconnecting");
        setTimeout(() => {
          if (pc.current === p && p.connectionState !== "connected") heal();
        }, 5000);
      } else if (s === "failed") {
        setLink("reconnecting");
        heal();
      }
    };
    return p;
  };

  // Coach: offer with an audio and a video slot, so cameras and screens can switch without renegotiating.
  const offer = async (restart = false) => {
    let p = pc.current;
    if (!restart || !p) {
      gen.current += 1;
      p = newPc();
      const ls = (local.current ??= new MediaStream());
      p.addTransceiver(mic.current ?? "audio", { direction: "sendrecv", streams: [ls] });
      const v = outgoingVideo();
      p.addTransceiver(v ?? "video", { direction: "sendrecv", streams: [ls] });
      setLink("connecting");
    }
    try {
      const o = await p.createOffer({ iceRestart: restart });
      await p.setLocalDescription(o);
      send({ t: "offer", gen: gen.current, sdp: o });
    } catch {
      /* the next presence change or hello retries */
    }
  };

  const drainIce = async () => {
    const p = pc.current;
    if (!p?.remoteDescription) return;
    const ready = pendingIce.current.filter((x) => x.gen === gen.current);
    pendingIce.current = pendingIce.current.filter((x) => x.gen > gen.current);
    for (const x of ready) await p.addIceCandidate(x.c).catch(() => {});
  };

  const onSignal = async (m: Sig) => {
    if (!joined.current) return;
    if (m.t === "state") {
      setPeer({ mic: m.mic, cam: m.cam, screen: m.screen });
      return;
    }
    if (m.t === "bye") {
      closePc();
      setLink("none");
      setPeer({ mic: true, cam: false, screen: false });
      return;
    }
    if (isCoach) {
      if (m.t === "hello") await offer();
      else if (m.t === "restart") {
        if (pc.current && pc.current.connectionState !== "connected") await offer(true);
        else if (!pc.current) await offer();
      }
      else if (m.t === "answer" && m.gen === gen.current && pc.current) {
        await pc.current.setRemoteDescription(m.sdp).catch(() => {});
        await drainIce();
      } else if (m.t === "ice") {
        if (m.gen !== gen.current) return;
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(m.c).catch(() => {});
        else pendingIce.current.push(m);
      }
      return;
    }
    // Learner
    if (m.t === "offer") {
      if (helloTimer.current) clearInterval(helloTimer.current);
      helloTimer.current = null;
      let p = pc.current;
      if (!p || m.gen !== gen.current) {
        gen.current = m.gen;
        pendingIce.current = pendingIce.current.filter((x) => x.gen === m.gen);
        p = newPc();
        setLink("connecting");
      }
      try {
        await p.setRemoteDescription(m.sdp);
        const ls = (local.current ??= new MediaStream());
        for (const t of p.getTransceivers()) {
          t.direction = "sendrecv";
          const track = t.receiver.track.kind === "audio" ? mic.current : outgoingVideo();
          if (track && !ls.getTracks().includes(track)) ls.addTrack(track);
          await t.sender.replaceTrack(track);
        }
        const a = await p.createAnswer();
        await p.setLocalDescription(a);
        send({ t: "answer", gen: m.gen, sdp: a });
        await drainIce();
      } catch {
        /* a newer offer will follow */
      }
    } else if (m.t === "ice") {
      if (m.gen < gen.current) return;
      if (m.gen === gen.current && pc.current?.remoteDescription) await pc.current.addIceCandidate(m.c).catch(() => {});
      else pendingIce.current.push(m);
    }
  };
  const onSignalRef = useRef(onSignal);
  useEffect(() => {
    onSignalRef.current = onSignal;
  });

  // Learner: keep saying hello until the coach's offer arrives (covers the coach joining after you, or a refresh).
  const startHello = () => {
    if (isCoach || helloTimer.current || pc.current?.remoteDescription) return;
    send({ t: "hello" });
    helloTimer.current = setInterval(() => {
      if (pc.current?.remoteDescription) {
        if (helloTimer.current) clearInterval(helloTimer.current);
        helloTimer.current = null;
      } else send({ t: "hello" });
    }, 3000);
  };

  const presenceRef = useRef<(here: boolean) => void>(() => {});
  useEffect(() => {
    presenceRef.current = (here: boolean) => {
      setPeerHere(here);
      if (!joined.current) return;
      if (here) {
        if (goneTimer.current) clearTimeout(goneTimer.current);
        goneTimer.current = null;
        // Already in a call with them (their connection to the room just blipped): carry on.
        if (isLive()) return;
        if (isCoach) void offer();
        else startHello();
      } else if (!goneTimer.current) {
        // Not being in the room for a moment isn't leaving: the call keeps going while audio and video still flow.
        // Only close it if they're still gone and the call has dropped after 30 seconds. Leaving properly sends "bye".
        goneTimer.current = setTimeout(() => {
          goneTimer.current = null;
          if (!joined.current || pc.current?.connectionState === "connected") return;
          closePc();
          setLink("none");
        }, 30_000);
      }
    };
  });

  // Join the room's channel on open (to show who's waiting); presence is only announced once you join.
  useEffect(() => {
    let ch: RealtimeChannel | null = null;
    let gone = false;
    void (async () => {
      const { data } = await db.auth.getSession();
      if (gone) return;
      await db.realtime.setAuth(data.session?.access_token ?? null);
      ch = db.channel(`session:${room.id}`, { config: { private: true, broadcast: { self: false }, presence: { key: room.me.id } } });
      chan.current = ch;
      ch.on("broadcast", { event: "sig" }, ({ payload }) => void onSignalRef.current(payload as Sig))
        .on("presence", { event: "sync" }, () => {
          const here = Object.keys(ch!.presenceState()).includes(room.other.id);
          presenceRef.current(here);
        })
        .subscribe((s) => {
          if (s === "CHANNEL_ERROR") flash("Couldn't reach the call service. Check your connection and refresh.", 8000);
        });
    })();
    return () => {
      gone = true;
      if (ch) void db.removeChannel(ch);
      chan.current = null;
    };
  }, [db, room.id, room.me.id, room.other.id, flash]);

  // Leaving the page ends your side cleanly.
  useEffect(() => {
    const bye = () => {
      if (joined.current) send({ t: "bye" });
    };
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      bye();
      closePc();
      [mic, cam, screen].forEach((r) => r.current?.stop());
      if (helloTimer.current) clearInterval(helloTimer.current);
      if (goneTimer.current) clearTimeout(goneTimer.current);
    };
    // Runs once: these refs and helpers are read at unmount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back to the tab: repair the call if it dropped while you were away.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible" && joined.current && pc.current && pc.current.connectionState !== "connected") heal();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A clock for the countdown and call timer.
  useEffect(() => {
    const t = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ----- Actions ------------------------------------------------------------------------------------------------
  const join = async () => {
    setPhase("joining");
    if (!(await getMic())) {
      setPhase("lobby");
      return;
    }
    const r = await joinSessionCall(room.id);
    if (r.error || !r.ice) {
      flash(r.error ?? "Couldn't join the call.", 6000);
      setPhase("lobby");
      return;
    }
    ice.current = r.ice;
    joined.current = true;
    setPhase("in");
    await chan.current?.track({ role: room.role, at: new Date().toISOString() });
    if (peerHere) presenceRef.current(true);
  };

  const leave = async () => {
    send({ t: "bye" });
    joined.current = false;
    await chan.current?.untrack();
    closePc();
    setLink("none");
    if (helloTimer.current) clearInterval(helloTimer.current);
    helloTimer.current = null;
    if (goneTimer.current) clearTimeout(goneTimer.current);
    goneTimer.current = null;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setPhase("left");
  };

  const toggleMic = async () => {
    if (!mic.current && !(await getMic())) return;
    const on = !state.current.mic;
    state.current.mic = on;
    mic.current!.enabled = on;
    setMicOn(on);
    shareState();
  };

  const toggleCam = async () => {
    if (state.current.cam) {
      cam.current?.stop();
      cam.current = null;
      state.current.cam = false;
      setCamOn(false);
    } else {
      if (!(await getCam())) return;
      state.current.cam = true;
      setCamOn(true);
    }
    if (!screen.current) await videoSender()?.replaceTrack(cam.current);
    shareState();
  };

  // Upper limit for the video we send. Screens keep their sharpness (text stays readable) and drop frames instead.
  const capVideo = async (maxBitrate: number, pref: RTCDegradationPreference) => {
    const sender = videoSender();
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = maxBitrate;
      params.degradationPreference = pref;
      await sender.setParameters(params);
    } catch {
      /* not every browser lets this change mid-call; the default still works */
    }
  };

  const stopShare = async () => {
    screen.current?.stop();
    screen.current = null;
    state.current.screen = false;
    setSharing(false);
    await videoSender()?.replaceTrack(cam.current);
    await capVideo(1_200_000, "balanced");
    shareState();
  };
  const toggleShare = async () => {
    if (screen.current) return stopShare();
    try {
      // 15 frames a second is plenty for slides and code, and keeps sharing from swamping a slow connection.
      const d = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 15 } } });
      screen.current = d.getVideoTracks()[0];
      screen.current.contentHint = "detail";
      screen.current.onended = () => void stopShare();
      state.current.screen = true;
      setSharing(true);
      await videoSender()?.replaceTrack(screen.current);
      await capVideo(1_500_000, "maintain-resolution");
      shareState();
    } catch {
      /* cancelled in the browser's picker */
    }
  };

  const canShare = mounted && !!navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices;
  const canSink = mounted && "setSinkId" in HTMLMediaElement.prototype;
  const toggleOutputs = async () => {
    if (outs) return setOuts(null);
    try {
      setOuts((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput"));
    } catch {
      setOuts([]);
    }
  };
  const pickOutput = async (id: string) => {
    try {
      await (remoteVideo.current as HTMLVideoElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(id);
      setOutId(id);
    } catch {
      flash("Couldn't switch the speaker.");
    }
    setOuts(null);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void stage.current?.requestFullscreen?.().catch(() => flash("Full screen isn't available here."));
  };

  // ----- View ---------------------------------------------------------------------------------------------------
  const t = now || (mounted ? clock() : 0);
  const start = Date.parse(room.startsAt);
  const end = Date.parse(room.endsAt);
  const open = t >= opensAt && t <= closesAt;
  const when = mounted ? new Date(start).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "";
  // In a call with them if they're in the room, or the call is still flowing while their room connection blips.
  const withPeer = peerHere || link === "connected";
  const status =
    phase !== "in"
      ? ""
      : !withPeer
        ? `Waiting for ${room.other.name} to join…`
        : link === "connected"
          ? t < start
            ? `Starts in ${mmss(Math.ceil((start - t) / 1000))}`
            : t < end
              ? `${mmss(Math.floor((end - t) / 1000))} left`
              : "Session time is up"
          : link === "reconnecting"
            ? "Reconnecting…"
            : "Connecting…";

  if (phase !== "in")
    return (
      <div className="et-cr-lobby">
        <Link href={backHref} className="et-cr-back">
          <ArrowLeft size={15} /> Back to sessions
        </Link>
        <div className="et-cr-lobby-grid">
          <div className="et-cr-preview">
            {camOn ? <video ref={localView} className="et-cr-video is-mirror" autoPlay playsInline muted /> : <div className="et-cr-off"><Avatar src={room.me.avatar} initial={room.me.name.charAt(0)} seed={room.me.name} className="et-cr-face" /><span>Camera is off</span></div>}
            <div className="et-cr-preview-bar">
              <button type="button" className={micOn ? "" : "is-off"} onClick={() => void toggleMic()} aria-label={micOn ? "Mute" : "Unmute"}>
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              <button type="button" className={camOn ? "" : "is-off"} onClick={() => void toggleCam()} aria-label={camOn ? "Turn camera off" : "Turn camera on"}>
                {camOn ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
            </div>
          </div>
          <div className="et-cr-join">
            <p className="et-cr-kicker">Coaching session</p>
            <h1>{isCoach ? `Session with ${room.other.name}` : `Session with ${room.other.name}`}</h1>
            <p className="et-cr-when">{when}</p>
            {room.note && <p className="et-cr-note">{isCoach ? "They'd like to cover: " : "You asked about: "}{room.note}</p>}
            <p className={`et-cr-presence${peerHere ? " is-here" : ""}`}>
              <i /> {peerHere ? `${room.other.name} is in the room` : `${room.other.name} hasn't joined yet`}
            </p>
            {phase === "left" ? (
              <>
                <p className="et-cr-muted">You left the call.</p>
                <button type="button" className="et-btn et-btn-primary et-cr-btn" onClick={() => void join()} disabled={!open}>
                  Rejoin
                </button>
              </>
            ) : room.status !== "confirmed" ? (
              <p className="et-cr-muted">This session isn&apos;t booked any more.</p>
            ) : !mounted ? null : t < opensAt ? (
              <p className="et-cr-muted">The room opens 15 minutes before the session, in {mmss(Math.ceil((opensAt - t) / 1000))}.</p>
            ) : t > closesAt ? (
              <p className="et-cr-muted">This session has finished.</p>
            ) : (
              <button type="button" className="et-btn et-btn-primary et-cr-btn" onClick={() => void join()} disabled={phase === "joining"}>
                {phase === "joining" ? "Joining…" : "Join now"}
              </button>
            )}
            <p className="et-cr-small">Use headphones for the best sound. The call goes straight between you and {isCoach ? "your learner" : "your coach"}; Etivio doesn&apos;t record it.</p>
          </div>
        </div>
        {notice && <div className="et-cr-toast" role="status">{notice}</div>}
      </div>
    );

  const peerVideo = withPeer && link === "connected" && (peer.cam || peer.screen);
  return (
    <div className={`et-cr-call${fs ? " is-fs" : ""}`} ref={stage}>
      <div className="et-cr-top">
        <div>
          <b>{room.other.name}</b>
          <small>{status}</small>
        </div>
        <button type="button" className="et-cr-icon" onClick={toggleFullscreen} aria-label={fs ? "Exit full screen" : "Full screen"}>
          {fs ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
      <div className="et-cr-stage">
        <video ref={remoteVideo} className={`et-cr-video${peer.screen ? " is-screen" : ""}`} autoPlay playsInline style={{ visibility: peerVideo ? "visible" : "hidden" }} />
        {!peerVideo && (
          <div className="et-cr-off is-stage">
            <Avatar src={room.other.avatar} initial={room.other.name.charAt(0)} seed={room.other.name} className={`et-cr-face${withPeer ? "" : " is-waiting"}`} />
            <span>{!withPeer ? `Waiting for ${room.other.name}` : link !== "connected" ? "Connecting…" : `${room.other.name}'s camera is off`}</span>
          </div>
        )}
        {withPeer && link === "connected" && !peer.mic && (
          <span className="et-cr-muted-tag">
            <MicOff size={13} /> Muted
          </span>
        )}
        <div className="et-cr-self">
          {camOn || sharing ? <video key={sharing ? "screen" : "cam"} ref={localView} className={`et-cr-video${sharing ? "" : " is-mirror"}`} autoPlay playsInline muted /> : <div className="et-cr-off"><Avatar src={room.me.avatar} initial={room.me.name.charAt(0)} seed={room.me.name} className="et-cr-face is-sm" /></div>}
          <span>You{!micOn && " (muted)"}</span>
        </div>
      </div>
      <div className="et-cr-bar">
        <button type="button" className={micOn ? "" : "is-off"} onClick={() => void toggleMic()} aria-pressed={!micOn}>
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          <span>{micOn ? "Mute" : "Unmute"}</span>
        </button>
        <button type="button" className={camOn ? "" : "is-off"} onClick={() => void toggleCam()} aria-pressed={!camOn}>
          {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          <span>{camOn ? "Camera" : "Camera off"}</span>
        </button>
        {canShare && (
          <button type="button" className={sharing ? "is-active" : ""} onClick={() => void toggleShare()} aria-pressed={sharing}>
            {sharing ? <MonitorX size={20} /> : <MonitorUp size={20} />}
            <span>{sharing ? "Stop sharing" : "Share screen"}</span>
          </button>
        )}
        {canSink && (
          <button type="button" onClick={() => void toggleOutputs()} aria-expanded={!!outs}>
            <Volume2 size={20} />
            <span>Speaker</span>
          </button>
        )}
        <button type="button" className="is-leave" onClick={() => void leave()}>
          <PhoneOff size={20} />
          <span>Leave</span>
        </button>
        {outs && (
          <ul className="et-cr-outs">
            {outs.length ? (
              outs.map((d) => (
                <li key={d.deviceId}>
                  <button type="button" onClick={() => void pickOutput(d.deviceId)}>
                    {(outId || "default") === d.deviceId ? <Check size={14} /> : <i />}
                    {d.label || "Speaker"}
                  </button>
                </li>
              ))
            ) : (
              <li className="et-cr-muted">No other speakers found.</li>
            )}
          </ul>
        )}
      </div>
      {notice && <div className="et-cr-toast" role="status">{notice}</div>}
    </div>
  );
}
