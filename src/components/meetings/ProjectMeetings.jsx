import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import MeetingCard from './MeetingCard';
import MeetingForm from './MeetingForm';
import MeetingDetail from './MeetingDetail';
import { Video, Plus, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import moment from 'moment';

export default function ProjectMeetings({ projectId, projectTitle }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const { toast } = useToast();

  useEffect(() => { load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    const all = await base44.entities.Meeting.filter({ project_id: projectId }, '-date', 50);
    setMeetings(all);
    setLoading(false);
  };

  const handleSave = async (data) => {
    if (data.id) {
      await base44.entities.Meeting.update(data.id, data);
      toast({ title: 'Meeting updated' });
    } else {
      await base44.entities.Meeting.create({ ...data, project_id: projectId, project_title: projectTitle });
      toast({ title: 'Meeting scheduled' });
    }
    setShowForm(false);
    setSelected(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Meeting.delete(id);
    toast({ title: 'Meeting deleted' });
    setSelected(null);
    load();
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
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {['upcoming', 'past'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {t} {t === 'upcoming' ? `(${upcoming.length})` : `(${past.length})`}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg eyra-gradient text-white text-xs font-semibold hover:opacity-90 transition-opacity">
          <Plus size={12} /> Schedule Meeting
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
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
