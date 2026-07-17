import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  User, FileText, Users, Award, FolderOpen, TrendingUp,
  Zap, Target, Brain, Edit2, Check, Sparkles
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { USER_TYPE_OPTIONS } from '@/lib/persona';

const PROFILE_FIELDS = [
  { key: 'bio', label: 'Bio', placeholder: 'Describe your research focus and goals...', multiline: true },
  { key: 'research_interests', label: 'Research Interests', placeholder: 'e.g. AI, climate tech, quantum computing...' },
  { key: 'skills', label: 'Skills', placeholder: 'e.g. Machine Learning, Python, Grant Writing...' },
  { key: 'organization', label: 'University / Organization', placeholder: 'e.g. MIT, Fraunhofer Institute...' },
  { key: 'country', label: 'Country', placeholder: 'e.g. Germany, USA, France...' },
  { key: 'career_goal', label: 'Career Goal', placeholder: 'e.g. Launch a research startup, become a research lead...' },
  { key: 'startup_interest', label: 'Startup Interest', placeholder: 'e.g. Healthtech, CleanTech, None...' },
];

const ACHIEVEMENTS = [
  { label: 'First Discovery', test: (s) => s.searches >= 1, icon: '🔭' },
  { label: 'First Project', test: (s) => s.projects >= 1, icon: '🚀' },
  { label: 'Researcher', test: (s) => s.researchers >= 1, icon: '👥' },
  { label: 'Grant Hunter', test: (s) => s.opportunities >= 1, icon: '🏆' },
  { label: 'Knowledge Builder', test: (s) => s.papers >= 5, icon: '📚' },
  { label: 'Innovator', test: (s) => s.projects >= 3, icon: '💡' },
  { label: 'Explorer', test: (s) => s.searches >= 10, icon: '🌍' },
  { label: 'Power User', test: (s) => s.searches >= 25, icon: '⚡' },
];

export default function Profile() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ papers: 0, researchers: 0, opportunities: 0, projects: 0, searches: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: '', skills: '', research_interests: '', organization: '', country: '', career_goal: '', startup_interest: '', user_type: '' });
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [me, papers, researchers, opportunities, projects, searches] = await Promise.all([
      base44.auth.me(),
      base44.entities.SavedPaper.list('-created_date', 999),
      base44.entities.SavedResearcher.list('-created_date', 999),
      base44.entities.SavedOpportunity.list('-created_date', 999),
      base44.entities.Project.list('-created_date', 999),
      base44.entities.SearchHistory.list('-created_date', 999),
    ]);
    setUser(me);
    setForm({
      bio: me.bio || '', skills: me.skills || '', research_interests: me.research_interests || '',
      organization: me.organization || '', country: me.country || '',
      career_goal: me.career_goal || '', startup_interest: me.startup_interest || '',
      user_type: me.user_type || '',
    });
    setStats({ papers: papers.length, researchers: researchers.length, opportunities: opportunities.length, projects: projects.length, searches: searches.length });
    setLoading(false);
  };

  const saveProfile = async () => {
    await base44.auth.updateMe(form);
    setEditing(false);
    toast({ title: 'Profile updated' });
  };

  const researchScore = Math.min(stats.papers * 5 + stats.researchers * 3 + stats.searches * 2, 100);
  const innovationScore = Math.min(stats.projects * 15 + stats.opportunities * 4, 100);
  const impactScore = Math.min(Math.round((researchScore + innovationScore) / 2 * 0.8 + stats.projects * 5), 100);

  const profileComplete = PROFILE_FIELDS.filter(f => form[f.key]?.trim()).length;
  const profilePct = Math.round((profileComplete / PROFILE_FIELDS.length) * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground mb-1">Profile</h1>
        <p className="text-muted-foreground text-sm">Your Research & Innovation identity on EYLO. A complete profile helps EYRA personalize recommendations.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left — identity card */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-border bg-card">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xl font-bold">
                  {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base text-foreground">{user?.full_name || 'Researcher'}</h2>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => editing ? saveProfile() : setEditing(true)}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${editing ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}
              >
                {editing ? <Check size={14} /> : <Edit2 size={14} />}
              </button>
            </div>

            {/* Profile completion */}
            {!editing && profilePct < 100 && (
              <div className="mb-4 p-3 rounded-xl bg-secondary/50 border border-border/50">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground">Profile completeness</p>
                  <p className="text-[10px] font-bold text-primary">{profilePct}%</p>
                </div>
                <div className="h-1 rounded-full bg-border overflow-hidden">
                  <div className="h-full eyra-gradient rounded-full transition-all" style={{ width: `${profilePct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Complete your profile so EYRA can personalize funding & researcher recommendations.
                </p>
              </div>
            )}

            {/* User type */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">I am a...</p>
              {editing ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {USER_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, user_type: opt.value }))}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                        form.user_type === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/20 text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {USER_TYPE_OPTIONS.find(o => o.value === form.user_type)
                    ? <span>{USER_TYPE_OPTIONS.find(o => o.value === form.user_type).emoji} {USER_TYPE_OPTIONS.find(o => o.value === form.user_type).label}</span>
                    : <span className="italic opacity-40 text-[10px]">Not set — click edit to add</span>}
                </p>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-3">
              {PROFILE_FIELDS.map(field => (
                <div key={field.key}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{field.label}</p>
                  {editing ? (
                    field.multiline ? (
                      <textarea
                        value={form[field.key]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                      />
                    ) : (
                      <input
                        value={form[field.key]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {form[field.key] || <span className="italic opacity-40 text-[10px]">Not set — click edit to add</span>}
                    </p>
                  )}
                </div>
              ))}

              {editing && (
                <div className="flex gap-2 pt-2">
                  <button onClick={saveProfile} className="flex-1 py-2.5 rounded-xl eyra-gradient text-white text-xs font-semibold">
                    Save Profile
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — scores, stats, achievements */}
        <div className="lg:col-span-2 space-y-5">

          {/* Reputation scores */}
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={13} className="text-primary" />
              <h3 className="font-semibold text-sm text-foreground">EYLO Reputation</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Research', score: researchScore, icon: Brain, color: 'hsl(210, 100%, 60%)' },
                { label: 'Innovation', score: innovationScore, icon: Zap, color: 'hsl(250, 70%, 62%)' },
                { label: 'Impact', score: impactScore, icon: Target, color: 'hsl(165, 60%, 48%)' },
              ].map(({ label, score, icon: Icon, color }) => {
                const r = 28;
                const circ = 2 * Math.PI * r;
                const dash = circ * Math.min(score / 100, 1);
                return (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
                        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
                        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="4"
                          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 1s ease' }} />
                      </svg>
                      <div className="flex flex-col items-center z-10">
                        <Icon size={11} style={{ color }} />
                        <span className="font-bold text-sm text-foreground leading-none mt-0.5">{score}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-4 leading-relaxed">
              Scores grow as you discover papers, build projects, and save opportunities on EYLO.
            </p>
          </div>

          {/* Activity stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Papers', value: stats.papers, icon: FileText, color: 'text-primary' },
              { label: 'Researchers', value: stats.researchers, icon: Users, color: 'text-accent' },
              { label: 'Projects', value: stats.projects, icon: FolderOpen, color: 'text-chart-4' },
              { label: 'Discoveries', value: stats.searches, icon: TrendingUp, color: 'text-chart-3' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
                  <Icon size={15} className={`${s.color} mx-auto mb-2`} />
                  <div className="font-bold text-xl font-heading">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              );
            })}
          </div>

          {/* Achievements */}
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Award size={13} className="text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Achievements</h3>
              <span className="text-[10px] text-muted-foreground ml-1">
                {ACHIEVEMENTS.filter(a => a.test(stats)).length} / {ACHIEVEMENTS.length} unlocked
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ACHIEVEMENTS.map(a => {
                const unlocked = a.test(stats);
                return (
                  <div key={a.label}
                    className={`p-3.5 rounded-xl border text-center transition-all ${
                      unlocked ? 'border-primary/25 bg-primary/5' : 'border-border/30 bg-secondary/20 opacity-35'
                    }`}
                  >
                    <div className="text-2xl mb-1.5">{a.icon}</div>
                    <p className="text-[10px] font-medium text-foreground leading-tight">{a.label}</p>
                    {unlocked && <p className="text-[9px] text-primary mt-0.5">Unlocked</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* EYRA tip */}
          {profilePct < 70 && (
            <div className="p-4 rounded-xl border border-primary/15 bg-primary/5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0">
                <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-0.5">Complete your profile</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  EYRA uses your research interests, skills, and career goals to personalize funding recommendations, collaborator suggestions, and opportunity matches.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
