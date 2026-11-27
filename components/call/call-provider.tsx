"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  BellOff,
  BellRing,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  ScreenShareOff,
  Video,
  VideoOff,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { ringCallAction, dismissCallRingAction } from "@/lib/actions/calls";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type CallMode = "audio" | "video";
type Phase = "idle" | "outgoing" | "incoming" | "active";

export type CallParticipant = Pick<
  Profile,
  "id" | "display_name" | "username" | "avatar_url" | "is_verified"
>;

type IncomingCall = {
  callId: string;
  conversationId: string;
  from: CallParticipant;
  mode: CallMode;
  members: CallParticipant[];
};

type CallContextValue = {
  startCall: (
    conversationId: string,
    members: CallParticipant[],
    mode: CallMode,
  ) => Promise<void>;
  inCall: boolean;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const value = useContext(CallContext);
  if (!value) throw new Error("useCall precisa estar dentro de CallProvider");
  return value;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

const PARTICIPANT_FIELDS = "id, username, display_name, avatar_url, is_verified";

function RemoteMedia({ stream, label }: { stream: MediaStream; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(stream.getVideoTracks().length > 0);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
    if (audioRef.current) audioRef.current.srcObject = stream;
    const sync = () =>
      setHasVideo(stream.getVideoTracks().some((track) => track.enabled));
    sync();
    const timer = setInterval(sync, 700);
    return () => clearInterval(timer);
  }, [stream]);

  return (
    <>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          aria-label={`Vídeo de ${label}`}
          className="h-full w-full bg-black object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/5">
          <span className="text-xs text-white/50">câmera desligada</span>
        </div>
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

function useRingtone(active: boolean, silenced: boolean) {
  useEffect(() => {
    if (!active || silenced) return;

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
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
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
      vibrateTimer = setInterval(
        () => navigator.vibrate([400, 200, 400, 200, 400]),
        2600,
      );
    }

    return () => {
      if (toneTimer) clearInterval(toneTimer);
      if (vibrateTimer) clearInterval(vibrateTimer);
      if (context) void context.close().catch(() => undefined);
      if (typeof navigator.vibrate === "function") navigator.vibrate(0);
    };
  }, [active, silenced]);
}

export function CallProvider({
  viewer,
  children,
}: {
  viewer: CallParticipant;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<CallMode>("audio");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [members, setMembers] = useState<CallParticipant[]>([]);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [silenced, setSilenced] = useState(false);
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
  const conversationRef = useRef<string | null>(null);
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  useRingtone(phase === "incoming", silenced);

  useEffect(() => {
    setMounted(true);
    supabaseRef.current = createClient();
  }, []);

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const memberName = useCallback(
    (id: string) =>
      members.find((member) => member.id === id)?.display_name ??
      (viewer.id === id ? viewer.display_name : "Participante"),
    [members, viewer.display_name, viewer.id],
  );

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    void channelRef.current?.send({
      type: "broadcast",
      event,
      payload: { ...payload, from: viewer.id },
    });
  }, [viewer.id]);

  const publishLocal = useCallback((stream: MediaStream | null) => {
    localStreamRef.current = stream;
    setLocalStream(stream ? new MediaStream(stream.getTracks()) : null);
  }, []);

  const removePeer = useCallback((peerId: string) => {
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
  }, []);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
  }, []);

  const leaveChannel = useCallback(() => {
    const supabase = supabaseRef.current;
    if (channelRef.current && supabase) void supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }, []);

  const resetCall = useCallback(() => {
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
    setSilenced(false);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    callIdRef.current = null;
    conversationRef.current = null;
    setConversationId(null);
    updatePhase("idle");
    leaveChannel();
  }, [leaveChannel, stopLocalMedia, updatePhase]);

  const hangUp = useCallback(() => {
    const callId = callIdRef.current;
    if (callId) {
      send("end", { callId });
      const supabase = supabaseRef.current;
      if (supabase) void supabase.from("call_rings").delete().eq("call_id", callId);
    }
    resetCall();
  }, [resetCall, send]);

  const renegotiate = useCallback(async (peerId: string) => {
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
  }, [send]);

  const ensurePeer = useCallback(
    async (peerId: string, initiator: boolean) => {
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
          const next = current[peerId] ?? new MediaStream();
          const incomingStream = event.streams[0];
          const tracks = incomingStream ? incomingStream.getTracks() : [event.track];
          for (const track of [...tracks, event.track]) {
            if (!next.getTracks().some((item) => item.id === track.id)) next.addTrack(track);
          }
          return { ...current, [peerId]: next };
        });
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "closed") {
          removePeer(peerId);
          if (peersRef.current.size === 0 && phaseRef.current === "active") {
            setError("A conexão foi encerrada.");
            setTimeout(() => resetCall(), 1200);
          }
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
    },
    [removePeer, resetCall, send],
  );

  const handleSignal = useCallback(
    async (peerId: string, data: any) => {
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
    },
    [ensurePeer, send],
  );

  const joinChannel = useCallback(
    (conversation: string) => {
      const supabase = supabaseRef.current ?? createClient();
      supabaseRef.current = supabase;
      if (channelRef.current) void supabase.removeChannel(channelRef.current);

      const channel = supabase.channel(`chupa-call-${conversation}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "accept" }, ({ payload }: any) => {
          if (!payload || payload.to !== viewer.id) return;
          if (payload.callId !== callIdRef.current) return;
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          updatePhase("active");
          setElapsed(0);
          void ensurePeer(payload.from, true);
          // Avisa quem já está na chamada para conectar com o novo participante.
          send("peer-joined", { callId: callIdRef.current, peerId: payload.from });
        })
        .on("broadcast", { event: "peer-joined" }, ({ payload }: any) => {
          if (!payload || payload.peerId === viewer.id) return;
          if (payload.callId !== callIdRef.current) return;
          if (phaseRef.current !== "active") return;
          void ensurePeer(payload.peerId, viewer.id < payload.peerId);
        })
        .on("broadcast", { event: "signal" }, ({ payload }: any) => {
          if (!payload || payload.to !== viewer.id) return;
          if (payload.callId !== callIdRef.current) return;
          void handleSignal(payload.from, payload.data);
        })
        .on("broadcast", { event: "decline" }, ({ payload }: any) => {
          if (!payload || payload.callId !== callIdRef.current) return;
          if (payload.to && payload.to !== viewer.id) return;
          if (phaseRef.current === "outgoing") {
            setError("Chamada recusada.");
            setTimeout(() => resetCall(), 1200);
          }
        })
        .on("broadcast", { event: "end" }, ({ payload }: any) => {
          if (!payload || payload.callId !== callIdRef.current) return;
          if (payload.to && payload.to !== viewer.id) return;
          removePeer(payload.from);
          if (peersRef.current.size === 0) {
            if (phaseRef.current === "active") setError("A chamada foi encerrada.");
            setTimeout(() => resetCall(), 800);
          }
        })
        .subscribe();
    },
    [ensurePeer, handleSignal, removePeer, resetCall, send, updatePhase, viewer.id],
  );

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
      setError(
        "Não foi possível acessar câmera e microfone. Confira as permissões do navegador.",
      );
      return null;
    }
  }

  const startCall = useCallback(
    async (
      conversation: string,
      callMembers: CallParticipant[],
      nextMode: CallMode,
    ) => {
      if (phaseRef.current !== "idle" || busy) return;
      setBusy(true);
      setError(null);
      setIncoming(null);
      setMembers(callMembers);
      setConversationId(conversation);
      conversationRef.current = conversation;

      const stream = await getMedia(nextMode);
      if (!stream) {
        setBusy(false);
        setConversationId(null);
        conversationRef.current = null;
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
      joinChannel(conversation);

      const result = await ringCallAction(conversation, callId, nextMode);
      if (!result.ok) {
        setError(result.error);
      }

      ringTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "outgoing") {
          setError("Ninguém atendeu a chamada.");
          resetCall();
        }
      }, 45000);
    },
    [busy, joinChannel, publishLocal, resetCall, updatePhase],
  );

  const acceptCall = useCallback(async () => {
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
    conversationRef.current = incoming.conversationId;
    setConversationId(incoming.conversationId);
    setMembers(incoming.members);
    modeRef.current = incoming.mode;
    setMode(incoming.mode);
    setCameraOn(incoming.mode === "video");
    setMuted(false);
    setElapsed(0);
    updatePhase("active");
    setBusy(false);

    joinChannel(incoming.conversationId);
    send("accept", { callId: incoming.callId, to: incoming.from.id });
    // Conecta também com quem já aceitou antes (chamada em grupo).
    send("peer-joined", { callId: incoming.callId, peerId: viewer.id });
    void dismissCallRingAction(incoming.callId);
    setIncoming(null);
    setSilenced(false);
  }, [busy, incoming, joinChannel, publishLocal, send, updatePhase, viewer.id]);

  const declineCall = useCallback(() => {
    if (incoming) {
      send("decline", { callId: incoming.callId, to: incoming.from.id });
      void dismissCallRingAction(incoming.callId);
    }
    setIncoming(null);
    setSilenced(false);
    updatePhase("idle");
  }, [incoming, send, updatePhase]);

  // Escuta toques de chamada em qualquer página.
  useEffect(() => {
    const supabase = supabaseRef.current ?? createClient();
    supabaseRef.current = supabase;

    const channel = supabase
      .channel(`chupa-rings-${viewer.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_rings",
          filter: `to_user=eq.${viewer.id}`,
        },
        async (payload) => {
          const row = payload.new as {
            call_id: string;
            conversation_id: string;
            from_user: string;
            mode: string;
            created_at: string;
          };
          if (!row?.call_id) return;
          if (Date.now() - new Date(row.created_at).getTime() > 60000) return;
          if (phaseRef.current !== "idle") return;

          const [{ data: profileRow }, { data: memberRows }] = await Promise.all([
            supabase
              .from("profiles")
              .select(PARTICIPANT_FIELDS)
              .eq("id", row.from_user)
              .maybeSingle(),
            supabase
              .from("conversation_members")
              .select(`user:profiles!conversation_members_user_id_fkey(${PARTICIPANT_FIELDS})`)
              .eq("conversation_id", row.conversation_id),
          ]);

          const caller = (profileRow as CallParticipant | null) ?? {
            id: row.from_user,
            display_name: "Alguém",
            username: "",
            avatar_url: null,
            is_verified: false,
          };

          const list = ((memberRows ?? [])
            .map((item: any) => item.user)
            .filter(Boolean) as CallParticipant[]);

          setIncoming({
            callId: row.call_id,
            conversationId: row.conversation_id,
            from: caller,
            mode: row.mode === "video" ? "video" : "audio",
            members: list.length > 0 ? list : [caller, { ...viewer }],
          });
          setSilenced(false);
          updatePhase("incoming");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [updatePhase, viewer.id]);

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
    if (!cameraTrack) setCameraOn(false);
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
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
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

  const remoteIds = Object.keys(remoteStreams);
  const inCall = phase === "active" || phase === "outgoing";

  const contextValue: CallContextValue = {
    startCall,
    inCall: phase !== "idle",
  };

  const incomingPopup =
    mounted &&
    phase === "incoming" &&
    incoming &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chamada de ${incoming.from.display_name}`}
        className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      >
        <div className="animate-pop w-full max-w-sm rounded-3xl border border-white/10 bg-[#171219] p-6 text-center text-white shadow-2xl">
          <div className="relative mx-auto w-fit">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" aria-hidden />
            <span className="relative block rounded-full ring-4 ring-accent/40">
              <Avatar profile={incoming.from} size={88} link={false} />
            </span>
          </div>
          <p className="mt-4 text-lg font-semibold">{incoming.from.display_name}</p>
          <p className="mt-1 text-xs text-white/60">
            Chamada de {incoming.mode === "video" ? "vídeo" : "áudio"}
            {incoming.members.length > 2 ? " · no grupo" : ""}
            {silenced ? " · som silenciado" : " · tocando"}
          </p>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">
              {error}
            </p>
          )}

          <div className="mt-7 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={declineCall}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 py-3 text-white/80 transition-colors hover:bg-red-500/20 hover:text-white"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white">
                <PhoneOff size={20} />
              </span>
              <span className="text-[0.7rem]">recusar</span>
            </button>

            <button
              type="button"
              onClick={() => setSilenced((value) => !value)}
              aria-pressed={silenced}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl py-3 text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                silenced && "text-white",
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  silenced ? "bg-accent text-accent-ink" : "bg-white/15",
                )}
              >
                {silenced ? <BellOff size={20} /> : <BellRing size={20} />}
              </span>
              <span className="text-[0.7rem]">{silenced ? "silenciado" : "silenciar"}</span>
            </button>

            <button
              type="button"
              onClick={acceptCall}
              disabled={busy}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 py-3 text-white/80 transition-colors hover:bg-green-500/20 hover:text-white disabled:opacity-60"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white">
                {busy ? <Loader2 size={20} className="animate-spin" /> : <Phone size={20} />}
              </span>
              <span className="text-[0.7rem]">aceitar</span>
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  const callStage =
    mounted &&
    inCall &&
    createPortal(
      <div className="fixed inset-0 z-[85] flex flex-col bg-[#070608]/97 p-3 backdrop-blur sm:p-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {phase === "outgoing" ? "Chamando…" : "Em chamada"}
            </p>
            <p className="text-xs text-white/55">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
              {" · "}
              {remoteIds.length + 1} {remoteIds.length === 0 ? "pessoa" : "pessoas"}
              {sharing ? " · compartilhando tela" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={hangUp}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Encerrar chamada"
          >
            <PhoneOff size={17} />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mx-auto mt-2 w-full max-w-5xl rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs text-red-100"
          >
            {error}
          </p>
        )}

        <div className="mx-auto mt-3 min-h-0 w-full max-w-5xl flex-1 overflow-y-auto">
          {remoteIds.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/70">
              <Avatar profile={incoming?.from ?? members.find((m) => m.id !== viewer.id) ?? null} size={84} link={false} />
              <div>
                <p className="text-sm font-medium text-white">
                  {phase === "outgoing" ? "Aguardando alguém atender…" : "Conectando…"}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  A chamada toca no aparelho de quem está na conversa.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "grid h-full auto-rows-fr gap-2",
                remoteIds.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
              )}
            >
              {remoteIds.map((peerId) => (
                <div
                  key={peerId}
                  className="relative flex min-h-[10rem] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                >
                  <RemoteMedia stream={remoteStreams[peerId]} label={memberName(peerId)} />
                  <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[0.65rem] text-white">
                    {memberName(peerId)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-5xl items-center justify-center gap-2.5 pb-1 sm:gap-3">
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
          <div className="pointer-events-none fixed bottom-24 right-4 w-28 overflow-hidden rounded-xl border border-white/20 bg-black shadow-lg sm:w-44">
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
      </div>,
      document.body,
    );

  return (
    <CallContext.Provider value={contextValue}>
      {children}
      {incomingPopup}
      {callStage}
    </CallContext.Provider>
  );
}
