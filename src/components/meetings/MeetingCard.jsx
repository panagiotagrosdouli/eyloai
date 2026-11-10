import React from 'react';
import { Video, Calendar, Users, Sparkles } from 'lucide-react';
import moment from 'moment';
import { normalizeMeetingLink } from '@/lib/meeting-links.mjs';

const TYPE_LABELS = {
  project_meeting: 'Project Meeting',
  research_discussion: 'Research Discussion',
  phd_supervision: 'Potential PhD Supervision Discussion',
  collaboration_call: 'Collaboration Call',
  mentor_call: 'Mentor Call',
  funding_preparation: 'Funding Prep',
  startup_planning: 'Startup Planning',
  team_sync: 'Team Sync',
};

const TYPE_COLORS = {
  project_meeting: 'bg-primary/10 text-primary',
  research_discussion: 'bg-accent/10 text-accent',
  collaboration_call: 'bg-blue-500/10 text-blue-400',
  mentor_call: 'bg-green-500/10 text-green-400',
  funding_preparation: 'bg-amber-500/10 text-amber-400',
  startup_planning: 'bg-chart-3/10 text-purple-400',
  team_sync: 'bg-secondary text-muted-foreground',
};

const STATUS_LABELS = {
  scheduled: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  scheduled: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-green-500/10 text-green-400',
  completed: 'bg-secondary text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function MeetingCard({ meeting, onClick }) {
  const isPast = moment(meeting.date).isBefore(moment().startOf('day'));
  let meetingLink = '';
  try { meetingLink = normalizeMeetingLink(meeting.meeting_link); } catch { /* Invalid saved URLs stay inert. */ }

  return (
    <article className={`p-4 rounded-xl border bg-card transition-all group card-glow hover:border-primary/30 focus-within:border-primary/40 ${isPast ? 'opacity-70' : 'border-border'}`} aria-label={`${meeting.title} meeting plan`}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onClick} aria-label={`Open meeting plan: ${meeting.title}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          <span className="flex-shrink-0 w-12 text-center p-2 rounded-lg bg-secondary border border-border/60" aria-hidden="true">
            <span className="block text-[10px] text-muted-foreground uppercase">{moment(meeting.date).format('MMM')}</span>
            <span className="block text-lg font-bold font-heading leading-none">{moment(meeting.date).format('D')}</span>
          </span>

          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[meeting.call_type] || TYPE_COLORS.project_meeting}`}>
                {TYPE_LABELS[meeting.call_type] || 'Meeting'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[meeting.status] || STATUS_COLORS.scheduled}`}>
                {STATUS_LABELS[meeting.status] || 'Planned'}
              </span>
              {meeting.eyra_prep && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold"><Sparkles size={9} aria-hidden="true" /> EYRA Ready</span>}
            </span>

            <span className="block font-semibold text-sm">{meeting.title}</span>

            <span className="flex items-center gap-3 mt-1 flex-wrap">
              {meeting.time && <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Calendar size={9} aria-hidden="true" /> {meeting.time}{meeting.duration_minutes ? ` · ${meeting.duration_minutes}m` : ''}</span>}
              {meeting.participants && <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Users size={9} aria-hidden="true" /> {meeting.participants.split(',').length} participant{meeting.participants.split(',').length > 1 ? 's' : ''}</span>}
              {meeting.project_title && <span className="text-[10px] text-primary">{meeting.project_title}</span>}
            </span>
          </span>
        </button>

        {meetingLink && (
            <a
              href={meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open external meeting room for ${meeting.title} (opens in a new tab)`}
              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Video size={13} aria-hidden="true" />
            </a>
          )}
      </div>
    </article>
  );
}
