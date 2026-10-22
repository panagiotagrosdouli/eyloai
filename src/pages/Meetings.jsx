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
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setSearchTerm(searchParams.get('q') || ''); }, [searchParams]);
  const personToDiscuss = searchParams.get('person')?.trim().slice(0, 160) || '';
  const phdDiscussion = searchParams.get('type') === 'phd_supervision';
  const discussionTopic = searchParams.get('topic')?.trim().slice(0, 180) || '';
  useEffect(() => { if (personToDiscuss) setShowForm(true); }, [personToDiscuss]);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    const [m, p] = await Promise.allSettled([
      base44.entities.Meeting.list('-date', 100),
      base44.entities.Project.list('-updated_date', 50),
    ]);
    // A transient backend failure must not erase previously loaded records.
    if (m.status === 'fulfilled') setMeetings(m.value);
    if (p.status === 'fulfilled') setProjects(p.value);
    if (m.status === 'rejected' || p.status === 'rejected') {
      setLoadError('Some meeting data could not be loaded. Retry to refresh your workspace.');
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
        toast({ title: 'Meeting plan saved', description: 'No invitation was sent. Share the details with participants yourself.' });
      }
      setShowForm(false);
      if (personToDiscuss) setSearchParams({}, { replace: true });
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
    if (!d.isValid()) return false;
    const matchesTab = tab === 'Upcoming' ? d.isSameOrAfter(today) : tab === 'Past' ? d.isBefore(today) : true;
    const q = searchTerm.trim().toLowerCase();
    const matchesQuery = !q || [m.title, m.participants, m.project_title, m.agenda, m.notes]
      .some(value => String(value || '').toLowerCase().includes(q));
    return matchesTab && matchesQuery;
  });

  const upcoming = meetings.filter(m => moment(m.date).isValid() && moment(m.date).isSameOrAfter(today))
    .sort((a, b) => moment(a.date).valueOf() - moment(b.date).valueOf()).slice(0, 3);

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
      <div className="eylo-page max-w-3xl">
        <MeetingForm
          projects={projects}
          initial={personToDiscuss ? {
            title: phdDiscussion ? `Potential PhD supervision discussion with ${personToDiscuss}` : `Research discussion with ${personToDiscuss}`,
            call_type: phdDiscussion ? 'phd_supervision' : 'research_discussion',
            participants: personToDiscuss,
            agenda: phdDiscussion
              ? `Discuss potential doctoral research alignment${discussionTopic ? ` in ${discussionTopic}` : ''}. Verify the researcher's academic role, eligibility to supervise, availability and official application procedure. This is a personal meeting plan; no invitation or booking has been sent.`
              : '',
          } : {}}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); if (personToDiscuss) setSearchParams({}, { replace: true }); }}
        />
      </div>
    );
  }

  return (
    <div className="eylo-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="eylo-page-heading">Meetings</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> New
        </button>
      </div>

      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">Plan research discussions, capture agendas and save notes. Saving a plan does not send an invitation or confirm attendance.</p>
      <div className="relative mb-5 max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search meetings..." aria-label="Search meetings" className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Upcoming strip */}
      {loadError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-foreground"><span>{loadError}</span><button type="button" onClick={loadData} className="font-semibold text-primary underline">Retry loading</button></div>}
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
