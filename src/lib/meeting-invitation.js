// RFC 5545 calendar invitation draft, generated locally. No attendee RSVP or
// invitation delivery is implied by creating this file.
const escapeCalendar = value => String(value || '')
  .replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n')
  .replace(/,/g, '\\,').replace(/;/g, '\\;');

export function createMeetingCalendarDraft(meeting) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meeting.date || '') || !/^\d{2}:\d{2}$/.test(meeting.time || '')) {
    throw new Error('Set a valid meeting date and time before exporting.');
  }
  const start = new Date(`${meeting.date}T${meeting.time}:00`);
  if (Number.isNaN(start.getTime()) || start.getFullYear() !== Number(meeting.date.slice(0, 4))) {
    throw new Error('Invalid meeting date.');
  }
  const duration = Math.min(1440, Math.max(1, Number(meeting.duration_minutes) || 60));
  const end = new Date(start.getTime() + duration * 60000);
  const localStamp = date => [
    date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'),
  ].join('') + 'T' + [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0'), '00'].join('');
  const uid = `${String(meeting.id || 'draft').replace(/[^a-z0-9-]/gi, '')}@eyloai`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EYLO//Meeting Proposal//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${now}`,
    `DTSTART:${localStamp(start)}`, `DTEND:${localStamp(end)}`,
    `SUMMARY:${escapeCalendar(meeting.title || 'EYLO proposed meeting')}`,
    `DESCRIPTION:${escapeCalendar([meeting.agenda, 'Proposed meeting only. Confirmation required.'].filter(Boolean).join('\\n'))}`,
    `LOCATION:${escapeCalendar(meeting.meeting_link || '')}`,
    'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
