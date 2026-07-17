import React, { useState } from 'react';
import { Calendar, Video, Users, FileText, Clock, X } from 'lucide-react';

const CALL_TYPES = [
  { value: 'project_meeting', label: 'Project Meeting' },
  { value: 'research_discussion', label: 'Research Discussion' },
  { value: 'collaboration_call', label: 'Collaboration Call' },
  { value: 'mentor_call', label: 'Mentor Call' },
  { value: 'funding_preparation', label: 'Funding Preparation' },
  { value: 'startup_planning', label: 'Startup Planning' },
  { value: 'team_sync', label: 'Team Sync' },
];

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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleProjectChange = (id) => {
    const proj = projects.find(p => p.id === id);
    set('project_id', id);
    set('project_title', proj?.title || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-heading font-bold text-base">{initial.id ? 'Edit Meeting' : 'Schedule a Meeting'}</h2>
        <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <X size={15} className="text-muted-foreground" />
        </button>
      </div>

      {/* Title */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Title *</label>
        <input required value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="e.g. Weekly Research Sync"
          className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Type & Project */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Call Type</label>
          <select value={form.call_type} onChange={e => set('call_type', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            {CALL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Linked Project</label>
          <select value={form.project_id} onChange={e => handleProjectChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            <option value="">— None —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      {/* Date, Time, Duration */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Date *</label>
          <input required type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Time</label>
          <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Duration (min)</label>
          <input type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
      </div>

      {/* Participants */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Participants (comma-separated emails/names)</label>
        <input value={form.participants} onChange={e => set('participants', e.target.value)}
          placeholder="alice@lab.com, Bob Smith, Dr. Chen..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Meeting Link */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Meeting Link (Zoom / Meet / Teams)</label>
        <input type="url" value={form.meeting_link} onChange={e => set('meeting_link', e.target.value)}
          placeholder="https://meet.google.com/..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Agenda */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Agenda</label>
        <textarea value={form.agenda} onChange={e => set('agenda', e.target.value)}
          rows={3} placeholder="Key topics, goals, discussion points..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
          {saving ? 'Saving...' : initial.id ? 'Update Meeting' : 'Schedule Meeting'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
