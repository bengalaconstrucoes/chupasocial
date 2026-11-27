"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  ScreenShareOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type CallMode = "audio" | "video";
type Phase = "idle" | "outgoing" | "incoming" | "active";

type IncomingCall = {
  callId: string;
  from: string;
  name: string;
  mode: CallMode;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

function RemoteMedia({ stream, label }: { stream: MediaStream; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasVideo = stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
    if (audioRef.current) audioRef.current.srcObject = stream;
  }, [stream]);

  return (
    <>
      {hasVideo && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          aria-label={`Vídeo de ${label}`}
          className="h-full w-full bg-black object-contain"
        />
      )}
      <audio ref={audioRef} autoPlay />
    </>
  );
}

function SelfVideo({ stream, mirrored }: { stream: MediaStream; mirrored: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn("h-full w-full object-cover", mirrored && "-scale-x-100")}
    />
  );
}

/** Toque de chamada sintetizado — nenhum arquivo de áudio para carregar. */
function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let context: AudioContext | null = null;
    let toneTimer: ReturnType<typeof setInterval> | null = null;
    let vibrateTimer: ReturnType<typeof setInterval> | null = null;

    const beep = () => {
      if (!context) return;
      const now = context.currentTime;
      [880, 660].forEach((frequency, index) => {
        const start = now + index * 0.45;
        const oscillator = context!.createOscillator();
        const gain = context!.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.14, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        oscillator.connect(gain).connect(context!.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.34);
      });
    };

    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) context = new Ctor();
    } catch {
      context = null;
    }

    if (context) {
      void context.resume().catch(() => undefined);
      beep();
      toneTimer = setInterval(beep, 1800);
    }

    if (typeof navigator.vibrate === "function") {
      navigator.vibrate([400, 200, 400, 200, 400]);
      vibrateTimer = setInterval(() => navigator.vibrate([400, 200, 400, 200, 400]), 2600);
    }

    return () => {
      if (toneTimer) clearInterval(toneTimer);
      if (vibrateTimer) clearInterval(vibrateTimer);
      if (context) void context.close().catch(() => undefined);
      if (typeof navigator.vibrate === "function") navigator.vibrate(0);
    };
  }, [active]);
}

export function CallRoom({
  conversationId,
  viewer,
  members,
}: {
  conversationId: string;
  viewer: Pick<Profile, "id" | "display_name" | "username" | "avatar_url">;
  members: Profile[];
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<CallMode>("audio");
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const modeRef = useRef<CallMode>("audio");
  const phaseRef = useRef<Phase>("idle");
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useRingtone(phase === "incoming");

  const memberName = (id: string) =>
    members.find((member) => member.id === id)?.display_name ?? "Participante";

  function updatePhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function send(event: string, payload: Record<string, unknown>) {
    void channelRef.current?.send({
      type: "broadcast",
      event,
      payload: { ...payload, from: viewer.id },
    });
  }

  function publishLocal(stream: MediaStream | null) {
    localStreamRef.current = stream;
    // Objeto novo para o vídeo próprio refletir trilhas adicionadas depois.
    setLocalStream(stream ? new MediaStream(stream.getTracks()) : null);
  }

  function removePeer(peerId: string) {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.close();
      peersRef.current.delete(peerId);
    }
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }

  function stopLocalMedia() {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
  }

  function resetCall() {
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    stopLocalMedia();
    setRemoteStreams({});
    setIncoming(null);
    setElapsed(0);
    setMuted(false);
    setCameraOn(false);
    setSharing(false);
    setError(null);
    setBusy(false);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    callIdRef.current = null;
    updatePhase("idle");
  }

  function hangUp() {
    if (callIdRef.current) send("end", { callId: callIdRef.current });
    resetCall();
  }

  async function getMedia(nextMode: CallMode) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Seu navegador não oferece suporte a chamadas.");
      return null;
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video:
          nextMode === "video"
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
            : false,
      });
    } catch {
      setError("Não foi possível acessar câmera e microfone. Confira as permissões do navegador.");
      return null;
    }
  }

  async function renegotiate(peerId: string) {
    const peer = peersRef.current.get(peerId);
    if (!peer) return;
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send("signal", {
        callId: callIdRef.current,
        to: peerId,
        data: { description: peer.localDescription?.toJSON() },
      });
    } catch {
      // renegociação concorrente: a próxima troca de faixa resolve
    }
  }

  async function ensurePeer(peerId: string, initiator: boolean) {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const peer = new RTCPeerConnection(ICE_SERVERS);
    const stream = localStreamRef.current;
    stream?.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      send("signal", {
        callId: callIdRef.current,
        to: peerId,
        data: { candidate: event.candidate.toJSON() },
      });
    };

    peer.ontrack = (event) => {
      setRemoteStreams((current) => {
        const stream = current[peerId] ?? new MediaStream();
        const incomingStream = event.streams[0];
        const tracks = incomingStream ? incomingStream.getTracks() : [event.track];
        for (const track of [...tracks, event.track]) {
          if (!stream.getTracks().some((item) => item.id === track.id)) {
            stream.addTrack(track);
          }
        }
        return { ...current, [peerId]: stream };
      });
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "closed") {
        removePeer(peerId);
      }
    };

    peersRef.current.set(peerId, peer);

    if (initiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send("signal", {
        callId: callIdRef.current,
        to: peerId,
        data: { description: peer.localDescription?.toJSON() },
      });
    }

    return peer;
  }

  async function handleSignal(peerId: string, data: any) {
    if (!data) return;

    if (data.description) {
      const peer = await ensurePeer(peerId, false);
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(data.description));
      } catch {
        return;
      }

      const pending = pendingIceRef.current.get(peerId) ?? [];
      pendingIceRef.current.delete(peerId);
      for (const candidate of pending) {
        await peer.addIceCandidate(candidate).catch(() => undefined);
      }

      if (data.description.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        send("signal", {
          callId: callIdRef.current,
          to: peerId,
          data: { description: peer.localDescription?.toJSON() },
        });
      }
      return;
    }

    if (data.candidate) {
      const candidate = data.candidate as RTCIceCandidateInit;
      const peer = peersRef.current.get(peerId);
      if (peer?.remoteDescription) {
        await peer.addIceCandidate(candidate).catch(() => undefined);
      } else {
        const queue = pendingIceRef.current.get(peerId) ?? [];
        queue.push(candidate);
        pendingIceRef.current.set(peerId, queue);
      }
    }
  }

  async function startCall(nextMode: CallMode) {
    if (phaseRef.current !== "idle" || busy) return;
    setBusy(true);
    setError(null);
    const stream = await getMedia(nextMode);
    if (!stream) {
      setBusy(false);
      return;
    }

    publishLocal(stream);
    const callId = crypto.randomUUID();
    callIdRef.current = callId;
    modeRef.current = nextMode;
    setMode(nextMode);
    setCameraOn(nextMode === "video");
    setMuted(false);
    setElapsed(0);
    updatePhase("outgoing");
    setBusy(false);

    send("ring", { callId, mode: nextMode, name: viewer.display_name, to: null });

    ringTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current === "outgoing") {
        setError("Ninguém atendeu a chamada.");
        resetCall();
      }
    }, 45000);
  }

  async function acceptCall() {
    if (!incoming || busy) return;
    setBusy(true);
    setError(null);
    const stream = await getMedia(incoming.mode);
    if (!stream) {
      setBusy(false);
      return;
    }

    publishLocal(stream);
    callIdRef.current = incoming.callId;
    modeRef.current = incoming.mode;
    setMode(incoming.mode);
    setCameraOn(incoming.mode === "video");
    setMuted(false);
    setElapsed(0);
    updatePhase("active");
    setBusy(false);
    send("accept", { callId: incoming.callId, to: incoming.from });
    setIncoming(null);
  }

  function declineCall() {
    if (incoming) {
      send("decline", { callId: incoming.callId, to: incoming.from });
    }
    setIncoming(null);
    updatePhase("idle");
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`chupa-call-${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "ring" }, ({ payload }: any) => {
        if (!payload?.callId || payload.from === viewer.id) return;
        if (payload.to && payload.to !== viewer.id) return;
        if (phaseRef.current !== "idle") return;

        setIncoming({
          callId: payload.callId,
          from: payload.from,
          name: payload.name ?? memberName(payload.from),
          mode: payload.mode === "video" ? "video" : "audio",
        });
        updatePhase("incoming");
      })
      .on("broadcast", { event: "accept" }, ({ payload }: any) => {
        if (!payload || payload.to !== viewer.id) return;
        if (payload.callId !== callIdRef.current) return;
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        updatePhase("active");
        setElapsed(0);
        void ensurePeer(payload.from, true);
      })
      .on("broadcast", { event: "signal" }, ({ payload }: any) => {
        if (!payload || payload.to !== viewer.id) return;
        if (payload.callId !== callIdRef.current) return;
        void handleSignal(payload.from, payload.data);
      })
      .on("broadcast", { event: "end" }, ({ payload }: any) => {
        if (!payload || payload.callId !== callIdRef.current) return;
        if (payload.to && payload.to !== viewer.id) return;
        removePeer(payload.from);
        if (peersRef.current.size === 0 && phaseRef.current === "active") {
          resetCall();
        }
      })
      .on("broadcast", { event: "probe" }, ({ payload }: any) => {
        if (!payload || payload.from === viewer.id) return;
        if (phaseRef.current !== "active" || !callIdRef.current) return;
        send("ring", {
          callId: callIdRef.current,
          mode: modeRef.current,
          name: viewer.display_name,
          to: payload.from,
        });
      })
      .subscribe();

    // Pergunta se já existe uma chamada rolando nesta conversa.
    const probe = setTimeout(() => {
      send("probe", { to: null });
    }, 600);

    return () => {
      clearTimeout(probe);
      peersRef.current.forEach((peer) => peer.close());
      peersRef.current.clear();
      stopLocalMedia();
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewer.id]);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  function toggleMic() {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((track) => (track.enabled = !next));
    setMuted(next);
  }

  async function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream || sharing) return;

    const tracks = stream.getVideoTracks();
    if (tracks.length > 0) {
      const next = !cameraOn;
      tracks.forEach((track) => (track.enabled = next));
      setCameraOn(next);
      return;
    }

    try {
      const camera = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      const track = camera.getVideoTracks()[0];
      stream.addTrack(track);

      const renegotiateIds: string[] = [];
      peersRef.current.forEach((peer, peerId) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === "video");
        if (sender) void sender.replaceTrack(track);
        else {
          peer.addTrack(track, stream);
          renegotiateIds.push(peerId);
        }
      });

      publishLocal(stream);
      setCameraOn(true);
      for (const peerId of renegotiateIds) await renegotiate(peerId);
    } catch {
      setError("Não foi possível ligar a câmera. Confira as permissões.");
    }
  }

  async function toggleShare() {
    if (sharing) {
      stopShare();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Seu navegador não permite compartilhar a tela.");
      return;
    }

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = display.getVideoTracks()[0];
      if (!track) return;

      screenStreamRef.current = display;
      setScreenStream(display);
      setSharing(true);
      track.addEventListener("ended", () => stopShare());

      const stream = localStreamRef.current;
      const renegotiateIds: string[] = [];
      peersRef.current.forEach((peer, peerId) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === "video");
        if (sender) void sender.replaceTrack(track);
        else {
          peer.addTrack(track, stream ?? new MediaStream([track]));
          renegotiateIds.push(peerId);
        }
      });
      for (const peerId of renegotiateIds) await renegotiate(peerId);
    } catch {
      setError("Compartilhamento de tela cancelado.");
    }
  }

  function stopShare() {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setSharing(false);

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    peersRef.current.forEach((peer) => {
      const sender = peer.getSenders().find((item) => item.track?.kind === "video");
      if (sender) void sender.replaceTrack(cameraTrack);
    });
    if (!cameraTrack) {
      setCameraOn(false);
    }
  }

  const remoteIds = Object.keys(remoteStreams);
  const inCall = phase === "active" || phase === "outgoing";
  const participants = remoteIds.length + 1;

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => startCall("audio")}
          disabled={phase !== "idle" || busy}
          className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          aria-label="Chamada de áudio"
          title="Chamada de áudio"
        >
          <Phone size={17} />
        </button>
        <button
          type="button"
          onClick={() => startCall("video")}
          disabled={phase !== "idle" || busy}
          className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          aria-label="Chamada de vídeo"
          title="Chamada de vídeo"
        >
          <Video size={17} />
        </button>
      </div>

      {phase === "incoming" && incoming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Chamada de ${incoming.name}`}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur"
        >
          <div className="animate-pop w-full max-w-sm rounded-3xl border border-line bg-surface p-6 text-center shadow-2xl">
            <div className="relative mx-auto w-fit">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" aria-hidden />
              <span className="relative block rounded-full ring-4 ring-accent/30">
                <Avatar
                  profile={members.find((member) => member.id === incoming.from) ?? null}
                  size={84}
                  link={false}
                />
              </span>
            </div>
            <p className="mt-4 text-base font-semibold">{incoming.name}</p>
            <p className="mt-0.5 text-xs text-muted">
              Chamada de {incoming.mode === "video" ? "vídeo" : "áudio"}
              {members.length > 2 ? " · no grupo" : ""}
            </p>
            <p className="mt-3 text-[0.7rem] text-muted">Tocando som e vibrando…</p>

            <div className="mt-6 flex items-center justify-center gap-6">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={declineCall}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105"
                  aria-label="Recusar chamada"
                >
                  <PhoneOff size={20} />
                </button>
                <span className="text-[0.68rem] text-muted">recusar</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={acceptCall}
                  disabled={busy}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-ok text-white transition-transform hover:scale-105 disabled:opacity-60"
                  aria-label="Aceitar chamada"
                >
                  {busy ? <Loader2 size={20} className="animate-spin" /> : <Phone size={20} />}
                </button>
                <span className="text-[0.68rem] text-muted">atender</span>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {inCall && (
        <div className="fixed inset-0 z-[65] flex flex-col bg-[#080709]/95 p-3 backdrop-blur sm:p-6">
          <div className="flex items-start justify-between gap-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {phase === "outgoing" ? "Chamando…" : "Em chamada"}
              </p>
              <p className="text-xs text-white/60">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                {participants > 1 ? ` · ${participants} pessoas` : ""}
                {sharing ? " · compartilhando tela" : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {members.length > 2 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[0.68rem] text-white/70">
                  <Users size={12} /> grupo
                </span>
              )}
              <button
                type="button"
                onClick={hangUp}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Encerrar chamada"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-2 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs text-red-100"
            >
              {error}
            </p>
          )}

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {remoteIds.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/70">
                <Avatar
                  profile={members.find((member) => member.id !== viewer.id) ?? null}
                  size={76}
                  link={false}
                />
                <div>
                  <p className="text-sm font-medium text-white">
                    {phase === "outgoing" ? "Aguardando alguém atender…" : "Conectando…"}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">
                    A chamada toca no aparelho de quem está na conversa.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "grid h-full gap-2",
                  remoteIds.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
                )}
              >
                {remoteIds.map((peerId) => (
                  <div
                    key={peerId}
                    className="relative flex min-h-[9rem] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5"
                  >
                    <RemoteMedia
                      stream={remoteStreams[peerId]}
                      label={memberName(peerId)}
                    />
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[0.65rem] text-white">
                      {memberName(peerId)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2.5 pb-1 sm:gap-3">
            <button
              type="button"
              onClick={toggleMic}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors",
                muted ? "bg-white/25" : "bg-white/10 hover:bg-white/20",
              )}
              aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}
              title={muted ? "Ativar microfone" : "Silenciar microfone"}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              disabled={sharing}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors disabled:opacity-40",
                cameraOn ? "bg-white/25" : "bg-white/10 hover:bg-white/20",
              )}
              aria-label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
              title={cameraOn ? "Desligar câmera" : "Ligar câmera"}
            >
              {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>

            <button
              type="button"
              onClick={toggleShare}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors",
                sharing ? "bg-accent text-accent-ink" : "bg-white/10 hover:bg-white/20",
              )}
              aria-label={sharing ? "Parar de compartilhar a tela" : "Compartilhar a tela"}
              title={sharing ? "Parar compartilhamento" : "Compartilhar a tela"}
            >
              {sharing ? <ScreenShareOff size={18} /> : <MonitorUp size={18} />}
            </button>

            <button
              type="button"
              onClick={hangUp}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-400"
              aria-label="Encerrar chamada"
              title="Encerrar chamada"
            >
              <PhoneOff size={18} />
            </button>
          </div>

          {(cameraOn || sharing) && (screenStream ?? localStream) && (
            <div className="pointer-events-none absolute bottom-24 right-4 w-28 overflow-hidden rounded-lg border border-white/20 bg-black shadow-lg sm:w-44">
              <div className="aspect-video">
                <SelfVideo
                  stream={(screenStream ?? localStream) as MediaStream}
                  mirrored={!sharing}
                />
              </div>
              <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[0.6rem] text-white">
                você{sharing ? " · tela" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
