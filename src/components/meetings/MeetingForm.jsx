import React, { useState } from 'react';
import { X, Link2 } from 'lucide-react';

const CALL_TYPES = [
  { value: 'project_meeting', label: 'Project Meeting' },
  { value: 'research_discussion', label: 'Research Discussion' },
  { value: 'collaboration_call', label: 'Collaboration Call' },
  { value: 'mentor_call', label: 'Mentor Call' },
  { value: 'funding_preparation', label: 'Funding Preparation' },
  { value: 'startup_planning', label: 'Startup Planning' },
  { value: 'team_sync', label: 'Team Sync' },
];

/**
 * @param {{
 *   projects?: any[],
 *   onSave: (form: any) => Promise<void>|void,
 *   onCancel: () => void,
 *   initial?: any
 * }} props
 */
export default function MeetingForm({ projects = [], onSave, onCancel, initial = {} }) {
  const [form, setForm] = useState({
    title: '',
    call_type: 'project_meeting',
    project_id: '',
    project_title: '',
    date: '',
    time: '',
    duration_minutes: 60,
    participants: '',
    agenda: '',
    meeting_link: '',
    notes: '',
    status: 'scheduled',
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => {
    setError('');
    setForm(f => ({ ...f, [key]: val }));
  };

  const handleProjectChange = (id) => {
    const proj = projects.find(p => p.id === id);
    set('project_id', id);
    set('project_title', proj?.title || '');
  };

  const createVideoRoom = () => {
    const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const roomName = `eylo-${randomPart}`.replace(/[^a-zA-Z0-9-]/g, '');
    set('meeting_link', `https://meet.jit.si/${roomName}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        participants: form.participants.trim(),
        agenda: form.agenda.trim(),
        meeting_link: form.meeting_link.trim(),
        duration_minutes: Math.min(480, Math.max(5, Number(form.duration_minutes) || 60)),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Meeting could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">{initial.id ? 'Edit meeting' : 'Schedule a meeting'}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Keep the meeting connected to a project when it belongs to an active research workspace.</p>
        </div>
        <button type="button" onClick={onCancel} disabled={saving} aria-label="Close meeting form" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40">
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs leading-5 text-destructive">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Title *</label>
        <input required value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="e.g. Weekly Research Sync"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
      </div>

      {/* Type & Project */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Call Type</label>
          <select value={form.call_type} onChange={e => set('call_type', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40">
            {CALL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Linked Project</label>
          <select value={form.project_id} onChange={e => handleProjectChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40">
            <option value="">— None —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      {/* Date, Time, Duration */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Date *</label>
          <input required type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Time</label>
          <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Duration (min)</label>
          <input type="number" min="5" max="480" step="5" value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40" />
        </div>
      </div>

      {/* Participants */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Participants (comma-separated emails/names)</label>
        <input value={form.participants} onChange={e => set('participants', e.target.value)}
          placeholder="alice@lab.com, Bob Smith, Dr. Chen..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
      </div>

      {/* Meeting Link */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Meeting Link (Zoom / Meet / Teams)</label>
        <div className="flex gap-2">
          <input type="url" value={form.meeting_link} onChange={e => set('meeting_link', e.target.value)}
            placeholder="https://meet.google.com/..."
            className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
          <button type="button" onClick={createVideoRoom}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
            <Link2 size={12} aria-hidden="true" /> Create room
          </button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Creates a unique Jitsi video room, or paste an existing Zoom, Meet, or Teams link.</p>
      </div>

      {/* Agenda */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Agenda</label>
        <textarea value={form.agenda} onChange={e => set('agenda', e.target.value)}
          rows={3} placeholder="Key topics, goals, discussion points..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 resize-none" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving || !form.title.trim() || !form.date}
          className="min-h-10 flex-1 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? 'Saving…' : initial.id ? 'Update meeting' : 'Schedule meeting'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-40">
          Cancel
        </button>
      </div>
    </form>
  );
}
