import React from 'react';
import { Video, Calendar, Users, ExternalLink, Sparkles } from 'lucide-react';
import moment from 'moment';

const TYPE_LABELS = {
  project_meeting: 'Project Meeting',
  research_discussion: 'Research Discussion',
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

const STATUS_COLORS = {
  scheduled: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-green-500/10 text-green-400',
  completed: 'bg-secondary text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function MeetingCard({ meeting, onClick }) {
  const isPast = moment(meeting.date).isBefore(moment().startOf('day'));

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border bg-card cursor-pointer hover:border-primary/30 transition-all group card-glow ${isPast ? 'opacity-70' : 'border-border'}`}
    >
      <div className="flex items-start gap-3">
        {/* Date block */}
        <div className="flex-shrink-0 w-12 text-center p-2 rounded-lg bg-secondary border border-border/60">
          <p className="text-[10px] text-muted-foreground uppercase">{moment(meeting.date).format('MMM')}</p>
          <p className="text-lg font-bold font-heading leading-none">{moment(meeting.date).format('D')}</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[meeting.call_type] || TYPE_COLORS.project_meeting}`}>
              {TYPE_LABELS[meeting.call_type] || 'Meeting'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[meeting.status] || STATUS_COLORS.scheduled}`}>
              {meeting.status || 'scheduled'}
            </span>
            {meeting.eyra_prep && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-1">
                <Sparkles size={9} /> EYRA Ready
              </span>
            )}
          </div>

          <h3 className="font-semibold text-sm">{meeting.title}</h3>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {meeting.time && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar size={9} /> {meeting.time}{meeting.duration_minutes ? ` · ${meeting.duration_minutes}m` : ''}
              </span>
            )}
            {meeting.participants && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Users size={9} /> {meeting.participants.split(',').length} participant{meeting.participants.split(',').length > 1 ? 's' : ''}
              </span>
            )}
            {meeting.project_title && (
              <span className="text-[10px] text-primary">{meeting.project_title}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {meeting.meeting_link && (
            <a
              href={meeting.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Video size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
