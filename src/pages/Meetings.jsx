import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import MeetingCard from '@/components/meetings/MeetingCard';
import MeetingForm from '@/components/meetings/MeetingForm';
import MeetingDetail from '@/components/meetings/MeetingDetail';
import { Video, Plus, Calendar, Clock, Filter, Loader2 } from 'lucide-react';
import moment from 'moment';

const TABS = ['Upcoming', 'Past', 'All'];

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('Upcoming');
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [m, p] = await Promise.all([
      base44.entities.Meeting.list('-date', 100),
      base44.entities.Project.list('-updated_date', 50),
    ]);
    setMeetings(m);
    setProjects(p);
    setLoading(false);
  };

  const handleSave = async (data) => {
    if (data.id) {
      await base44.entities.Meeting.update(data.id, data);
      toast({ title: 'Meeting updated' });
    } else {
      await base44.entities.Meeting.create(data);
      toast({ title: 'Meeting scheduled' });
    }
    setShowForm(false);
    setSelected(null);
    loadData();
  };

  const handleDelete = async (id) => {
    await base44.entities.Meeting.delete(id);
    toast({ title: 'Meeting deleted' });
    setSelected(null);
    loadData();
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl flex items-center gap-2">
            <Video size={22} className="text-primary" /> Calls & Meetings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Schedule, prepare, and debrief with EYRA</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> New Meeting
        </button>
      </div>

      {/* Upcoming strip */}
      {upcoming.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl border border-primary/20 bg-primary/5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
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
      <div className="flex gap-1 mb-4 border-b border-border/60">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin text-primary" /> Loading meetings...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
            <Calendar size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">No {tab.toLowerCase()} meetings</p>
          <p className="text-xs text-muted-foreground mb-4">Schedule a meeting to get started</p>
          <button onClick={() => setShowForm(true)} className="text-xs text-primary font-medium hover:underline">+ New Meeting</button>
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
