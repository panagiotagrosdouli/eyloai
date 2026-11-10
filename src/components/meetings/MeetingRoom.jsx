import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Copy, Maximize, Mic, MicOff, MonitorUp, Phone, PhoneOff, Send, Users, X } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { getUsableSession } from '@/lib/supabaseClient';

async function meetingRequest(session, payload) {
  const response = await fetch('/api/meeting-room', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Meeting request failed.');
  return body;
}

function useParticipants(room, revision) {
  return useMemo(() => room ? [room.localParticipant, ...room.remoteParticipants.values()] : [], [room, revision]);
}

function ParticipantAudio({ participant, isLocal, revision }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (isLocal) return undefined;
    const track = participant.getTrackPublication(Track.Source.Microphone)?.track;
    if (track && audioRef.current) track.attach(audioRef.current);
    return () => { if (track && audioRef.current) track.detach(audioRef.current); };
  }, [participant, isLocal, revision]);
  return isLocal ? null : <audio ref={audioRef} autoPlay />;
}

function ParticipantTile({ participant, isLocal, revision }) {
  const videoRef = useRef(null);
  const screenRef = useRef(null);
  const cameraTrack = participant.getTrackPublication(Track.Source.Camera)?.track;
  const screenTrack = participant.getTrackPublication(Track.Source.ScreenShare)?.track;
  useEffect(() => {
    if (cameraTrack && videoRef.current) cameraTrack.attach(videoRef.current);
    if (screenTrack && screenRef.current) screenTrack.attach(screenRef.current);
    return () => {
      if (cameraTrack && videoRef.current) cameraTrack.detach(videoRef.current);
      if (screenTrack && screenRef.current) screenTrack.detach(screenRef.current);
    };
  }, [participant, revision]);

  return (
    <div className="relative flex min-h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-900 sm:min-h-56">
      {screenTrack && <video ref={screenRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />}
      {cameraTrack && <video ref={videoRef} autoPlay playsInline muted={isLocal} className={screenTrack ? 'absolute bottom-2 right-2 z-10 h-16 w-24 rounded-lg object-cover sm:h-20 sm:w-32' : 'h-full w-full object-cover'} />}
      {!cameraTrack && !screenTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg font-semibold">{String(participant.name || participant.identity).slice(0, 1).toUpperCase()}</div>
          <span className="text-sm">Camera off</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white">{participant.name || (isLocal ? 'You' : 'Participant')}{isLocal ? ' (you)' : ''}</span>
    </div>
  );
}

export default function MeetingRoom({ meeting, action = 'join', onClose, onUpdate }) {
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [devices, setDevices] = useState({ audio: [], video: [] });
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteState, setInviteState] = useState('');
  const chatEndRef = useRef(null);
  const [role, setRole] = useState('participant');
  const participants = useParticipants(room, revision);

  useEffect(() => {
    let active = true;
    let connectedRoom;
    const connect = async () => {
      try {
        setError('');
        const session = await getUsableSession({ required: true, validate: true });
        const access = await meetingRequest(session, { action, meetingId: meeting.id, displayName: session.user?.user_metadata?.full_name });
        if (!active) return;
        setRole(access.role);
        connectedRoom = new Room({ adaptiveStream: true, dynacast: true });
        const changed = () => setRevision(value => value + 1);
        connectedRoom.on(RoomEvent.TrackSubscribed, changed);
        connectedRoom.on(RoomEvent.TrackUnsubscribed, changed);
        connectedRoom.on(RoomEvent.ParticipantConnected, changed);
        connectedRoom.on(RoomEvent.ParticipantDisconnected, changed);
        connectedRoom.on(RoomEvent.LocalTrackPublished, changed);
        connectedRoom.on(RoomEvent.LocalTrackUnpublished, changed);
        connectedRoom.on(RoomEvent.LocalTrackPublished, publication => { if (publication.source === Track.Source.ScreenShare) setScreenOn(true); });
        connectedRoom.on(RoomEvent.LocalTrackUnpublished, publication => { if (publication.source === Track.Source.ScreenShare) setScreenOn(false); });
        connectedRoom.on(RoomEvent.ConnectionStateChanged, state => setStatus(state === 'connected' ? 'Connected' : state));
        connectedRoom.on(RoomEvent.Reconnecting, () => setStatus('Reconnecting…'));
        connectedRoom.on(RoomEvent.Reconnected, () => setStatus('Connected'));
        connectedRoom.on(RoomEvent.DataReceived, (data, participant, _kind, topic) => {
          if (topic !== 'eylo-chat') return;
          try {
            const item = JSON.parse(new TextDecoder().decode(data));
            if (typeof item.text === 'string') setChat(lines => [...lines, { ...item, sender: participant?.name || 'Participant', mine: false }].slice(-200));
          } catch { /* Ignore malformed peer data. */ }
        });
        setRoom(connectedRoom);
        await connectedRoom.connect(access.serverUrl, access.token, { autoSubscribe: true });
        await Promise.all([connectedRoom.localParticipant.setMicrophoneEnabled(true), connectedRoom.localParticipant.setCameraEnabled(true)]);
        setMicOn(true); setCameraOn(true); setStatus('Connected');
        const all = await navigator.mediaDevices?.enumerateDevices?.() || [];
        setDevices({ audio: all.filter(item => item.kind === 'audioinput'), video: all.filter(item => item.kind === 'videoinput') });
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : 'Could not connect to this meeting.'); setStatus('Connection failed'); }
        connectedRoom?.disconnect();
      }
    };
    connect();
    return () => { active = false; connectedRoom?.disconnect(); };
  }, [action, meeting.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat]);

  const disconnect = useCallback(async ({ end = false } = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      if (end) {
        const session = await getUsableSession({ required: true, validate: true });
        await meetingRequest(session, { action: 'end', meetingId: meeting.id });
        onUpdate?.();
      }
      room?.disconnect();
      onClose?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not end the meeting.');
    } finally { setBusy(false); }
  }, [busy, meeting.id, onClose, onUpdate, room]);

  const toggleMic = async () => {
    try { await room.localParticipant.setMicrophoneEnabled(!micOn); setMicOn(!micOn); } catch (cause) { setError(cause.message || 'Microphone permission is unavailable.'); }
  };
  const toggleCamera = async () => {
    try { await room.localParticipant.setCameraEnabled(!cameraOn); setCameraOn(!cameraOn); setRevision(value => value + 1); } catch (cause) { setError(cause.message || 'Camera permission is unavailable.'); }
  };
  const selectDevice = async (kind, id) => {
    try {
      if (kind === 'audio') await room.localParticipant.setMicrophoneEnabled(true, id ? { deviceId: id } : {});
      else await room.localParticipant.setCameraEnabled(true, id ? { deviceId: id } : {});
      if (kind === 'audio') setMicOn(true); else { setCameraOn(true); setRevision(value => value + 1); }
    } catch (cause) { setError(cause.message || 'Could not select that device.'); }
  };
  const shareScreen = async () => {
    try { await room.localParticipant.setScreenShareEnabled(!screenOn); setScreenOn(!screenOn); setRevision(value => value + 1); }
    catch (cause) { if (cause?.name !== 'NotAllowedError') setError(cause.message || 'Screen sharing is unavailable.'); }
  };
  const sendChat = async event => {
    event.preventDefault();
    const text = message.trim();
    if (!text || !room || text.length > 1000) return;
    const item = { text, sentAt: new Date().toISOString() };
    try {
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(item)), { reliable: true, topic: 'eylo-chat' });
      setChat(lines => [...lines, { ...item, sender: 'You', mine: true }].slice(-200)); setMessage('');
    } catch { setError('Message could not be sent.'); }
  };
  const invite = async event => {
    event.preventDefault(); setInviteState('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const result = await meetingRequest(session, { action: 'invite', meetingId: meeting.id, email: inviteEmail });
      setInviteLink(result.inviteUrl); setInviteState('Invitation link created. EYLO has not emailed it. Share it only with the intended account holder.'); setInviteEmail('');
    } catch (cause) { setInviteState(cause.message || 'Could not create invitation.'); }
  };
  const copyInvite = async () => { await navigator.clipboard.writeText(inviteLink); setInviteState('Invitation link copied. It expires in seven days and is restricted to the invited verified account.'); };
  const fullscreen = () => document.querySelector('[data-eylo-room]')?.requestFullscreen?.();

  return (
    <section data-eylo-room role="dialog" aria-modal="true" aria-label="EYLO video meeting" className="fixed inset-0 z-[100] flex flex-col bg-background p-3 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div><h2 className="text-base font-semibold text-foreground">{meeting.title}</h2><p className="text-xs text-muted-foreground">{status} · {participants.length} {participants.length === 1 ? 'participant' : 'participants'}</p></div>
        <div className="flex items-center gap-2"><button onClick={fullscreen} aria-label="Full screen" className="rounded-lg border border-border p-2"><Maximize size={16}/></button><button onClick={() => disconnect()} className="rounded-lg border border-border p-2" aria-label="Close meeting"><X size={16}/></button></div>
      </header>
      {error && <div role="alert" className="mb-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">{error}<button onClick={() => window.location.reload()} className="underline">Retry</button></div>}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-h-0 flex-col gap-3 overflow-auto">
          {room ? <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">{participants.map((participant, index) => <React.Fragment key={participant.sid || participant.identity || index}><ParticipantTile participant={participant} isLocal={participant === room.localParticipant} revision={revision} /><ParticipantAudio participant={participant} isLocal={participant === room.localParticipant} revision={revision} /></React.Fragment>)}</div> : <div className="flex min-h-56 flex-1 items-center justify-center text-sm text-muted-foreground">{status}</div>}
          <div className="mt-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-card p-3">
            <button disabled={!room} onClick={toggleMic} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'} className="rounded-full border border-border p-3 disabled:opacity-50">{micOn ? <Mic size={19}/> : <MicOff size={19}/>}</button>
            <button disabled={!room} onClick={toggleCamera} aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'} className="rounded-full border border-border p-3 disabled:opacity-50">{cameraOn ? <Camera size={19}/> : <CameraOff size={19}/>}</button>
            <button disabled={!room} onClick={shareScreen} aria-label={screenOn ? 'Stop screen sharing' : 'Share screen'} aria-pressed={screenOn} className={`rounded-full border p-3 disabled:opacity-50 ${screenOn ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}><MonitorUp size={19}/></button>
            <button disabled={!room || busy} onClick={() => disconnect()} className="flex items-center gap-2 rounded-full bg-destructive px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Phone size={17}/> Leave</button>
            {role === 'host' && <button disabled={!room || busy} onClick={() => disconnect({ end: true })} className="flex items-center gap-2 rounded-full border border-destructive px-4 py-3 text-sm font-semibold text-destructive disabled:opacity-50"><PhoneOff size={17}/> End meeting</button>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="text-muted-foreground">Microphone<select aria-label="Microphone device" className="ml-2 max-w-48 rounded-lg border border-border bg-card p-2" onChange={event => selectDevice('audio', event.target.value)}><option value="">Default</option>{devices.audio.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>)}</select></label>
            <label className="text-muted-foreground">Camera<select aria-label="Camera device" className="ml-2 max-w-48 rounded-lg border border-border bg-card p-2" onChange={event => selectDevice('video', event.target.value)}><option value="">Default</option>{devices.video.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>)}</select></label>
          </div>
        </div>
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border p-3 text-sm font-semibold"><Users size={16}/> Meeting chat</div>
          <div aria-live="polite" className="min-h-24 flex-1 space-y-2 overflow-y-auto p-3">{chat.map((item, index) => <p key={`${item.sentAt}-${index}`} className={`max-w-[95%] rounded-lg px-3 py-2 text-xs ${item.mine ? 'ml-auto bg-primary text-primary-foreground' : 'bg-secondary'}`}><span className="mb-1 block font-semibold">{item.sender}</span>{item.text}</p>)}<div ref={chatEndRef}/></div>
          <form onSubmit={sendChat} className="flex gap-2 border-t border-border p-3"><input value={message} maxLength={1000} onChange={event => setMessage(event.target.value)} placeholder="Send a message" aria-label="Meeting message" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"/><button aria-label="Send message" className="rounded-lg bg-primary p-2 text-primary-foreground"><Send size={16}/></button></form>
          {role === 'host' && <form onSubmit={invite} className="border-t border-border p-3"><label className="mb-2 block text-xs font-semibold">Invite a verified EYLO account</label><div className="flex gap-2"><input required type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="researcher@example.edu" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"/><button className="rounded-lg border border-border px-3 text-xs">Invite</button></div>{inviteState && <p role="status" className="mt-2 text-xs text-muted-foreground">{inviteState}</p>}{inviteLink && <button type="button" onClick={copyInvite} className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline"><Copy size={12}/> Copy restricted link</button>}</form>}
        </aside>
      </div>
    </section>
  );
}
