import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import MeetingCard from '@/components/meetings/MeetingCard';
import MeetingForm from '@/components/meetings/MeetingForm';
import MeetingDetail from '@/components/meetings/MeetingDetail';
import { Plus, Calendar, Clock, Loader2, Search } from 'lucide-react';
import moment from 'moment';
import { useSearchParams } from 'react-router-dom';

const TABS = ['Upcoming', 'Past', 'All'];

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('Upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setSearchTerm(searchParams.get('q') || ''); }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    const [m, p] = await Promise.allSettled([
      base44.entities.Meeting.list('-date', 100),
      base44.entities.Project.list('-updated_date', 50),
    ]);
    setMeetings(m.status === 'fulfilled' ? m.value : []);
    setProjects(p.status === 'fulfilled' ? p.value : []);
    if (m.status === 'rejected' || p.status === 'rejected') {
      setLoadError('Some meeting data could not be loaded. Refresh to try again.');
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
      toast({ title: 'Meeting could not be saved', description: error?.message || 'Please try again.', variant: 'destructive' });
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
      toast({ title: 'Meeting could not be deleted', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const today = moment().startOf('day');
  const filtered = meetings.filter(m => {
    const d = moment(m.date);
    const matchesTab = tab === 'Upcoming' ? d.isSameOrAfter(today) : tab === 'Past' ? d.isBefore(today) : true;
    const q = searchTerm.trim().toLowerCase();
    const matchesQuery = !q || [m.title, m.participants, m.project_title, m.agenda, m.notes]
      .some(value => String(value || '').toLowerCase().includes(q));
    return matchesTab && matchesQuery;
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
          <h1 className="font-heading font-bold text-2xl">Meetings</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> New
        </button>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search meetings..." aria-label="Search meetings" className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Upcoming strip */}
      {loadError && <div role="alert" className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-100">{loadError}</div>}
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
