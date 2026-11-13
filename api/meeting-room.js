import crypto from 'node:crypto';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { applyCors } from '../src/lib/api-cors.mjs';
import { readSupabaseApiConfig } from '../server/supabase-config.mjs';

const TOKEN_TTL_SECONDS = 600;
const MAX_PARTICIPANTS = 20;

function jsonHeaders(key) {
  const headers = { apikey: key, 'content-type': 'application/json', accept: 'application/json' };
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
  return headers;
}

function readMediaConfig() {
  const url = String(process.env.LIVEKIT_URL || '').trim();
  const apiKey = String(process.env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = String(process.env.LIVEKIT_API_SECRET || '').trim();
  let parsed;
  try { parsed = new URL(url); } catch { /* fail closed */ }
  if (!parsed || !['wss:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !apiKey || !apiSecret) return null;
  return { clientUrl: `wss://${parsed.host}`, serverUrl: `https://${parsed.host}`, apiKey, apiSecret };
}

async function identify(request, config) {
  const bearer = request.headers.authorization;
  if (!bearer?.startsWith('Bearer ')) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, { headers: { authorization: bearer, apikey: config.publicKey }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id && user?.email ? user : null;
}

async function db(config, path, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    signal: AbortSignal.timeout(8000),
    headers: { ...jsonHeaders(config.serverKey), ...(options.headers || {}) },
  });
  if (!response.ok) throw Object.assign(new Error(`Meeting storage request failed (${response.status}).`), { status: response.status });
  return response.status === 204 ? null : response.json();
}

async function meetingFor(config, id) {
  const rows = await db(config, `meetings?id=eq.${encodeURIComponent(id)}&select=id,user_id,data&limit=1`);
  return rows?.[0] || null;
}

function roomClient(media) {
  return new RoomServiceClient(media.serverUrl, media.apiKey, media.apiSecret);
}

function privateRoomName(meetingId, ownerId, secret) {
  return `eylo-${crypto.createHmac('sha256', secret).update(`${meetingId}:${ownerId}`).digest('hex').slice(0, 36)}`;
}

async function ensureRoom(service, name) {
  try {
    await service.createRoom({ name, emptyTimeout: 300, maxParticipants: MAX_PARTICIPANTS });
  } catch (error) {
    const rooms = await service.listRooms([name]).catch(() => []);
    if (!rooms.some(room => room.name === name)) throw error;
  }
}

async function issueToken(media, roomName, user, role, displayName) {
  const token = new AccessToken(media.apiKey, media.apiSecret, {
    identity: crypto.createHash('sha256').update(`eylo:${user.id}`).digest('hex').slice(0, 32),
    name: String(displayName || user.user_metadata?.full_name || user.email).slice(0, 80),
    ttl: TOKEN_TTL_SECONDS,
    metadata: JSON.stringify({ role }),
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    roomAdmin: role === 'host',
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
  });
  return token.toJwt();
}

function hashInvitation(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function send(response, status, body) {
  return response.status(status).json(body);
}

export default async function handler(request, response) {
  if (applyCors(request, response, ['POST'])) return;
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'Method not allowed.' });
  }

  const supabase = readSupabaseApiConfig();
  const media = readMediaConfig();
  if (!supabase.hasPublicConfig || !supabase.hasServerConfig) {
    return send(response, 503, { error: 'Meeting access needs verified Supabase server configuration.', code: 'MEETING_AUTH_NOT_CONFIGURED' });
  }
  if (!media) return send(response, 503, { error: 'Native video is awaiting a configured LiveKit media server.', code: 'LIVEKIT_NOT_CONFIGURED' });

  try {
    const user = await identify(request, supabase);
    if (!user) return send(response, 401, { error: 'Sign in with a verified EYLO account to access this meeting.' });
    const action = String(request.body?.action || '');
    const meetingId = String(request.body?.meetingId || '');
    if (!/^[0-9a-f-]{36}$/i.test(meetingId)) return send(response, 400, { error: 'A valid meeting is required.' });
    const meeting = await meetingFor(supabase, meetingId);
    if (!meeting) return send(response, 404, { error: 'Meeting not found.' });
    const host = meeting.user_id === user.id;

    if (action === 'invite') {
      if (!host) return send(response, 403, { error: 'Only the meeting host can invite participants.' });
      const email = String(request.body?.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || email === user.email.toLowerCase()) {
        return send(response, 400, { error: 'Enter a valid participant email address.' });
      }
      const currentParticipants = await db(supabase, `meeting_participants?meeting_id=eq.${encodeURIComponent(meetingId)}&status=in.(invited,accepted)&select=invited_email`);
      if (currentParticipants?.length >= MAX_PARTICIPANTS - 1 && !currentParticipants.some(participant => participant.invited_email === email)) {
        return send(response, 409, { error: 'This meeting has reached its participant limit.' });
      }
      const inviteToken = crypto.randomBytes(32).toString('base64url');
      const rows = await db(supabase, 'meeting_participants?on_conflict=meeting_id,invited_email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ meeting_id: meetingId, owner_user_id: meeting.user_id, invited_email: email, role: 'participant', status: 'invited', invite_token_hash: hashInvitation(inviteToken), invited_by: user.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }),
      });
      const origin = String(process.env.APP_URL || 'https://eyloai.vercel.app').replace(/\/$/, '');
      return send(response, 200, { inviteUrl: `${origin}/meetings?invite=${encodeURIComponent(inviteToken)}&meeting=${encodeURIComponent(meetingId)}`, expiresInSeconds: 604800, emailDelivery: 'not_configured', participantId: rows?.[0]?.id });
    }

    if (action === 'accept-invite') {
      const raw = String(request.body?.inviteToken || '');
      if (!/^[A-Za-z0-9_-]{40,60}$/.test(raw) || !user.email_confirmed_at) return send(response, 403, { error: 'A valid invitation and verified account are required.' });
      const rows = await db(supabase, `meeting_participants?meeting_id=eq.${encodeURIComponent(meetingId)}&invite_token_hash=eq.${hashInvitation(raw)}&status=eq.invited&select=id,invited_email,expires_at`);
      const invitation = rows?.[0];
      if (!invitation || invitation.invited_email !== user.email.toLowerCase() || new Date(invitation.expires_at).getTime() < Date.now()) return send(response, 403, { error: 'This invitation is invalid, expired or addressed to another account.' });
      await db(supabase, `meeting_participants?id=eq.${encodeURIComponent(invitation.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: user.id, status: 'accepted', invite_token_hash: null, accepted_at: new Date().toISOString() }) });
      return send(response, 200, { accepted: true });
    }

    if (action === 'info') {
      if (!host) {
        const membership = await db(supabase, `meeting_participants?meeting_id=eq.${encodeURIComponent(meetingId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.accepted&select=id&limit=1`);
        if (!membership?.length) return send(response, 403, { error: 'You are not an authorized participant in this meeting.' });
      }
      return send(response, 200, {
        id: meeting.id,
        title: String(meeting.data?.title || 'EYLO meeting').slice(0, 160),
        date: String(meeting.data?.date || ''),
        time: String(meeting.data?.time || ''),
        duration_minutes: Number(meeting.data?.duration_minutes) || 60,
        native_status: String(meeting.data?.native_status || ''),
        canStart: host,
      });
    }

    if (!['start', 'join', 'end'].includes(action)) return send(response, 400, { error: 'Choose start, join, invite, accept-invite, info or end.' });
    if (action === 'start' && !host) return send(response, 403, { error: 'Only the meeting host can start this room.' });
    if (action === 'end' && !host) return send(response, 403, { error: 'Only the meeting host can end this room.' });

    const data = meeting.data || {};
    const storedRoomName = String(data.livekit_room_name || '');
    const roomName = /^eylo-[a-f0-9]{36}$/.test(storedRoomName)
      ? storedRoomName
      : privateRoomName(meeting.id, meeting.user_id, media.apiSecret);
    if (action === 'start') {
      const service = roomClient(media);
      await ensureRoom(service, roomName);
      await db(supabase, `meetings?id=eq.${encodeURIComponent(meeting.id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ data: { ...data, native_video: true, native_status: 'live', livekit_room_name: roomName, livekit_started_at: new Date().toISOString() } }),
      });
    } else if (action === 'end') {
      if (data.native_status !== 'live') return send(response, 409, { error: 'This meeting is not live.' });
      await roomClient(media).deleteRoom(roomName);
      await db(supabase, `meetings?id=eq.${encodeURIComponent(meeting.id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ data: { ...data, native_status: 'ended', livekit_ended_at: new Date().toISOString() } }),
      });
      return send(response, 200, { ended: true });
    } else {
      if (data.native_status !== 'live') return send(response, 409, { error: 'The host has not started this meeting.' });
      if (!host) {
        const membership = await db(supabase, `meeting_participants?meeting_id=eq.${encodeURIComponent(meetingId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.accepted&select=id&limit=1`);
        if (!membership?.length) return send(response, 403, { error: 'You are not an invited participant in this meeting.' });
      }
    }
    const role = host ? 'host' : 'participant';
    const displayName = String(request.body?.displayName || user.user_metadata?.full_name || user.email).slice(0, 80);
    return send(response, 200, { token: await issueToken(media, roomName, user, role, displayName), serverUrl: media.clientUrl, roomName, role, expiresInSeconds: TOKEN_TTL_SECONDS });
  } catch (error) {
    console.error('Native meeting request failed:', error?.message || 'unknown error');
    return send(response, error.status === 404 ? 404 : 503, { error: 'The meeting service could not complete this request. Please retry.' });
  }
}
