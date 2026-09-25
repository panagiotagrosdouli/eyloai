import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchAllPapers } from '@/lib/eyra-api';
import { ArrowLeft, Video, Sparkles, Edit2, Trash2, Users, Calendar, Clock, FileText, CheckSquare, CalendarPlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import MeetingForm from './MeetingForm';
import ReactMarkdown from 'react-markdown';
import moment from 'moment';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TABS = ['Overview', 'EYRA Prep', 'Notes & Debrief'];

export default function MeetingDetail({ meeting, projects, onBack, onSave, onDelete, onUpdate }) {
  const [tab, setTab] = useState('Overview');
  const [editing, setEditing] = useState(false);
  const [loadingPrep, setLoadingPrep] = useState(false);
  const [loadingDebrief, setLoadingDebrief] = useState(false);
  const [notes, setNotes] = useState(meeting.notes || '');
  const [transcription, setTranscription] = useState(meeting.transcription || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const generatePrep = async () => {
    setLoadingPrep(true);
    try {
      const papers = await searchAllPapers(`${meeting.project_title || ''} ${meeting.title}`.trim());
      const paperContext = papers.slice(0, 6).map((paper, index) =>
        `[P${index + 1}] "${paper.title}" — ${paper.authors || 'Unknown'} (${paper.year || 'n/a'}) — ${paper.url}`
      ).join('\n');

      const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, an AI research and startup intelligence assistant. Generate a comprehensive pre-meeting brief for the following meeting:

Title: ${meeting.title}
Type: ${meeting.call_type?.replace(/_/g, ' ')}
Date: ${meeting.date} ${meeting.time || ''}
Participants: ${meeting.participants || 'Not specified'}
Agenda: ${meeting.agenda || 'Not specified'}
${meeting.project_title ? `Linked Project: ${meeting.project_title}` : ''}

VERIFIED RESEARCH RECORDS:
${paperContext || 'No matching records were retrieved.'}

Generate:
1. **Meeting Agenda** (structured, with time estimates)
2. **Suggested Questions** (5-7 key questions to ask)
3. **Project Context** (what to know going in)
4. **Relevant Research** (reference only [P1]-[P6] records supplied above; do not invent papers)
5. **Information to Verify** (facts or funding information not present in the meeting context)
6. **Success Criteria** (what a good outcome looks like)

Be specific, actionable, and tailored to the meeting type. Clearly separate supplied facts from suggestions.`,
    });
      await base44.entities.Meeting.update(meeting.id, { eyra_prep: res });
      meeting.eyra_prep = res;
      toast({ title: 'EYRA prep brief ready' });
      onUpdate();
    } catch (error) {
      toast({
        title: 'EYRA prep did not complete',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPrep(false);
    }
  };

  const generateDebrief = async () => {
    if (!notes && !transcription) {
      toast({ title: 'Add notes or transcription first', variant: 'destructive' });
      return;
    }
    setLoadingDebrief(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, an AI research and startup intelligence assistant. Analyze the following meeting and generate a comprehensive debrief.

Meeting: ${meeting.title}
Type: ${meeting.call_type?.replace(/_/g, ' ')}
Date: ${meeting.date}
Participants: ${meeting.participants || 'Not specified'}

${transcription ? `Transcription:\n${transcription}` : ''}
${notes ? `Notes:\n${notes}` : ''}

Generate a structured debrief with:
## Summary
(2-3 sentence executive summary)

## Key Decisions
(bullet list of decisions made)

## Action Items
(bullet list with owner and deadline if mentioned)

## Follow-up Tasks
(next concrete steps)

## Risks & Blockers
(any risks or blockers identified)

## Next Steps
(what happens next)

Be concise and actionable.`,
    });

      const update = {
        summary: res,
        notes,
        transcription,
        status: 'completed',
      };
      await base44.entities.Meeting.update(meeting.id, update);
      Object.assign(meeting, update);
      toast({ title: 'EYRA debrief generated' });
      onUpdate();
    } catch (error) {
      toast({
        title: 'EYRA debrief did not complete',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDebrief(false);
    }
  };

  const googleCalendarUrl = (() => {
    if (!meeting.date) return '';
    const start = `${meeting.date.replaceAll('-', '')}T${(meeting.time || '09:00').replace(':', '')}00`;
    const endDate = new Date(`${meeting.date}T${meeting.time || '09:00'}:00`);
    endDate.setMinutes(endDate.getMinutes() + Number(meeting.duration_minutes || 60));
    const end = [
      endDate.getFullYear(),
      String(endDate.getMonth() + 1).padStart(2, '0'),
      String(endDate.getDate()).padStart(2, '0'),
    ].join('') + 'T' + [
      String(endDate.getHours()).padStart(2, '0'),
      String(endDate.getMinutes()).padStart(2, '0'),
      '00',
    ].join('');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: meeting.title || 'EYLO meeting',
      dates: `${start}/${end}`,
      details: [meeting.agenda, meeting.meeting_link].filter(Boolean).join('\n\n'),
      location: meeting.meeting_link || '',
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  })();

  const saveNotes = async () => {
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      await base44.entities.Meeting.update(meeting.id, { notes, transcription });
      meeting.notes = notes;
      meeting.transcription = transcription;
      toast({ title: 'Notes saved' });
      await onUpdate();
    } catch (error) {
      toast({
        title: 'Notes could not be saved',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(meeting.id);
      setDeleteOpen(false);
    } catch {
      // Parent surfaces the destructive error.
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <MeetingForm
          projects={projects}
          initial={meeting}
          onSave={async (data) => { await onSave({ ...data, id: meeting.id }); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft size={14} /> Back to Meetings
      </button>

      {/* Header */}
      <div className="p-5 rounded-2xl border border-border bg-card mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                {meeting.call_type?.replace(/_/g, ' ') || 'Meeting'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                meeting.status === 'completed' ? 'bg-secondary text-muted-foreground' :
                meeting.status === 'in_progress' ? 'bg-green-500/10 text-green-400' :
                meeting.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                'bg-blue-500/10 text-blue-400'
              }`}>{meeting.status || 'scheduled'}</span>
            </div>
            <h1 className="font-heading font-bold text-xl">{meeting.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar size={11} /> {moment(meeting.date).format('dddd, MMMM D, YYYY')}
              </span>
              {meeting.time && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={11} /> {meeting.time} · {meeting.duration_minutes || 60}min
                </span>
              )}
              {meeting.participants && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users size={11} /> {meeting.participants}
                </span>
              )}
            </div>
            {meeting.project_title && (
              <p className="text-xs text-primary mt-1">📁 {meeting.project_title}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {googleCalendarUrl && (
              <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-semibold hover:border-primary/30 transition-colors">
                <CalendarPlus size={12} /> Add to Calendar
              </a>
            )}
            {meeting.meeting_link && (
              <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer"
                className="flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90">
                <Video size={12} aria-hidden="true" /> Join call
              </a>
            )}
            <button type="button" onClick={() => setEditing(true)} aria-label="Edit meeting" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Edit2 size={13} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setDeleteOpen(true)} aria-label="Delete meeting"
              className="grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10">
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-4">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`min-h-9 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="space-y-4">
          {meeting.agenda && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText size={10} /> Agenda
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{meeting.agenda}</p>
            </div>
          )}
          {meeting.action_items && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                <CheckSquare size={10} /> Action Items
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{meeting.action_items}</p>
            </div>
          )}
          {meeting.decisions && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Decisions</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{meeting.decisions}</p>
            </div>
          )}
          {meeting.next_steps && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Next Steps</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{meeting.next_steps}</p>
            </div>
          )}
          {!meeting.agenda && !meeting.action_items && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No details yet. Use EYRA Prep or add notes after the call.
            </div>
          )}
        </div>
      )}

      {/* EYRA Prep */}
      {tab === 'EYRA Prep' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-semibold">Pre-meeting evidence brief</p>
                <p className="text-[10px] text-muted-foreground">EYRA synthesis grounded in the meeting context and retrieved paper records</p>
              </div>
            </div>
            <button
              onClick={generatePrep}
              disabled={loadingPrep}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50"
            >
              <Sparkles size={12} /> {loadingPrep ? 'Generating...' : meeting.eyra_prep ? 'Regenerate' : 'Generate Brief'}
            </button>
          </div>

          {loadingPrep && (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">EYRA is preparing your brief...</p>
            </div>
          )}

          {meeting.eyra_prep && !loadingPrep && (
            <div className="rounded-xl border border-border bg-card p-5">
              <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none">{meeting.eyra_prep}</ReactMarkdown>
            </div>
          )}

          {!meeting.eyra_prep && !loadingPrep && (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border/60 rounded-xl">
              Click "Generate Brief" and EYRA will prepare your agenda, questions, and research context.
            </div>
          )}
        </div>
      )}

      {/* Notes & Debrief */}
      {tab === 'Notes & Debrief' && (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Meeting Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder="Add your meeting notes here..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Transcription (optional)</label>
            <textarea
              value={transcription}
              onChange={e => setTranscription(e.target.value)}
              rows={4}
              placeholder="Paste call transcript here for EYRA to analyze..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={saveNotes} disabled={savingNotes}
              className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50">
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
            <button onClick={generateDebrief} disabled={loadingDebrief}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50">
              <Sparkles size={11} aria-hidden="true" /> {loadingDebrief ? 'Generating…' : 'Generate debrief'}
            </button>
          </div>

          {loadingDebrief && (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">EYRA is analyzing your meeting...</p>
            </div>
          )}

          {meeting.summary && !loadingDebrief && (
            <div className="p-5 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                <Sparkles size={10} /> EYRA Debrief
              </p>
              <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none">{meeting.summary}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={open => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              “{meeting.title}” will be removed from your workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete meeting'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
