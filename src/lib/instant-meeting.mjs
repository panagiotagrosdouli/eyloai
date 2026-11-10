// Client-side meeting plan for an actual third-party Jitsi room.
// This does not send invitations, confirm RSVPs or provide EYLO room access controls.
import { isPublicJitsiRoomUrl } from './jitsi-room.mjs';

export function createInstantMeetingPlan(meetingLink, now = new Date()) {
  if (!isPublicJitsiRoomUrl(meetingLink)) throw new Error('A valid Jitsi video room is required.');
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('A valid local date is required.');
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const time = [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')].join(':');
  return {
    title: 'Instant research video meeting', call_type: 'research_discussion',
    project_id: '', project_title: '', date, time, duration_minutes: 60,
    participants: '', agenda: '', meeting_link: meetingLink, notes: '',
    status: 'in_progress', invitation_status: 'not_sent', confirmation_reference: '',
  };
}
