import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import MeetingCard from '@/components/meetings/MeetingCard';
import MeetingForm from '@/components/meetings/MeetingForm';
import MeetingDetail from '@/components/meetings/MeetingDetail';
import { Plus, Calendar, Clock } from 'lucide-react';
import moment from 'moment';

const TABS = ['Upcoming', 'Past', 'All'];

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('Upcoming');
  const [loadError, setLoadError] = useState('');
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    const [meetingsResult, projectsResult] = await Promise.allSettled([
      base44.entities.Meeting.list('-date', 100),
      base44.entities.Project.list('-updated_date', 50),
    ]);
    if (meetingsResult.status === 'fulfilled') {
      setMeetings(meetingsResult.value);
    } else {
      setMeetings([]);
      setLoadError(meetingsResult.reason?.message || 'Meetings could not be loaded.');
    }
    setProjects(projectsResult.status === 'fulfilled' ? projectsResult.value : []);
    if (projectsResult.status === 'rejected' && meetingsResult.status === 'fulfilled') {
      setLoadError('Meetings loaded, but project links are temporarily unavailable.');
    }
    setLoading(false);
  };

  const handleSave = async (data) => {
    try {
      if (data.id) {
        await base44.entities.Meeting.update(data.id, data);
        toast({ title: 'Meeting updated' });
      } else {
        await base44.entities.Meeting.create(data);
        toast({ title: 'Meeting scheduled' });
      }
      setShowForm(false);
      setSelected(null);
      await loadData();
    } catch (error) {
      toast({
        title: 'Meeting could not be saved',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Meeting.delete(id);
      toast({ title: 'Meeting deleted' });
      setSelected(null);
      await loadData();
    } catch (error) {
      toast({
        title: 'Meeting could not be deleted',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const today = moment().startOf('day');
  const filtered = meetings.filter(m => {
    const d = moment(m.date);
    if (tab === 'Upcoming') return d.isSameOrAfter(today);
    if (tab === 'Past') return d.isBefore(today);
    return true;
  });

  const upcoming = meetings.filter(m => moment(m.date).isSameOrAfter(today)).slice(0, 3);

  if (selected) {
    return (
      <MeetingDetail
        meeting={selected}
        projects={projects}
        onBack={() => setSelected(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onUpdate={loadData}
      />
    );
  }

  if (showForm) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <MeetingForm
          projects={projects}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Research coordination</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Meetings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Prepare, capture decisions, and keep meeting context connected to the right project.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:self-auto"
        >
          <Plus size={14} aria-hidden="true" /> New meeting
        </button>
      </header>

      {loadError && (
        <div role="status" className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-100">
          {loadError}
        </div>
      )}

      {/* Upcoming strip */}
      {upcoming.length > 0 && (
        <div className="mb-7 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Clock size={11} /> Next Up
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {upcoming.map(m => (
              <button key={m.id} onClick={() => setSelected(m)} className="text-left p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors">
                <p className="text-xs font-semibold truncate">{m.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{moment(m.date).format('MMM D')} {m.time && `· ${m.time}`}</p>
                {m.project_title && <p className="text-[10px] text-primary mt-0.5 truncate">{m.project_title}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-4">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3" role="status" aria-live="polite">
          {[0, 1, 2, 3].map(item => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
          <span className="sr-only">Loading meetings</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
            <Calendar size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">No {tab.toLowerCase()} meetings</p>
          <p className="text-xs text-muted-foreground mb-4">Schedule a meeting to get started</p>
          <button type="button" onClick={() => setShowForm(true)} className="mt-1 text-xs font-semibold text-primary hover:underline">Schedule a meeting</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <MeetingCard key={m.id} meeting={m} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}
    </div>
  );
}
