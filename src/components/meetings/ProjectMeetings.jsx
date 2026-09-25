import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import MeetingCard from './MeetingCard';
import MeetingForm from './MeetingForm';
import MeetingDetail from './MeetingDetail';
import { Plus, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import moment from 'moment';

export default function ProjectMeetings({ projectId, projectTitle }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [loadError, setLoadError] = useState('');
  const { toast } = useToast();

  useEffect(() => { load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const all = await base44.entities.Meeting.filter({ project_id: projectId }, '-date', 50);
      setMeetings(all);
    } catch (error) {
      setMeetings([]);
      setLoadError(error instanceof Error ? error.message : 'Project meetings could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (data.id) {
        await base44.entities.Meeting.update(data.id, data);
        toast({ title: 'Meeting updated' });
      } else {
        await base44.entities.Meeting.create({ ...data, project_id: projectId, project_title: projectTitle });
        toast({ title: 'Meeting scheduled' });
      }
      setShowForm(false);
      setSelected(null);
      await load();
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
      await load();
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
  const upcoming = meetings.filter(m => moment(m.date).isSameOrAfter(today));
  const past = meetings.filter(m => moment(m.date).isBefore(today));
  const shown = tab === 'upcoming' ? upcoming : past;

  if (selected) {
    return (
      <MeetingDetail
        meeting={selected}
        projects={[]}
        onBack={() => setSelected(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onUpdate={load}
      />
    );
  }

  if (showForm) {
    return (
      <MeetingForm
        projects={[{ id: projectId, title: projectTitle }]}
        initial={{ project_id: projectId, project_title: projectTitle }}
        onSave={handleSave}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <div role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-100">
          {loadError}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {['upcoming', 'past'].map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`min-h-9 rounded-lg px-3 text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              {t} {t === 'upcoming' ? `(${upcoming.length})` : `(${past.length})`}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background hover:opacity-90">
          <Plus size={12} aria-hidden="true" /> Schedule
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" role="status" aria-live="polite">
          {[0, 1, 2].map(item => <div key={item} className="h-24 animate-pulse rounded-xl border border-border bg-card" />)}
          <span className="sr-only">Loading project meetings</span>
        </div>
      ) : shown.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-border/60 rounded-xl">
          <Calendar size={22} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">No {tab} meetings</p>
          {tab === 'upcoming' && (
            <button onClick={() => setShowForm(true)} className="text-xs text-primary font-medium hover:underline mt-1">
              + Schedule a meeting
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(m => (
            <MeetingCard key={m.id} meeting={m} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-border/40">
        <Link to="/meetings" className="text-xs text-primary hover:underline">View all meetings →</Link>
      </div>
    </div>
  );
}
