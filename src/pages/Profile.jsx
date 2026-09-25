import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Award, Check, Edit2, FileText, FolderOpen, Search, Users,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { USER_TYPE_OPTIONS } from '@/lib/persona';

const PROFILE_FIELDS = [
  { key: 'bio', label: 'Bio', placeholder: 'Describe your research focus and goals…', multiline: true },
  { key: 'research_interests', label: 'Research interests', placeholder: 'e.g. AI, climate tech, quantum computing…' },
  { key: 'skills', label: 'Skills', placeholder: 'e.g. Machine learning, Python, grant writing…' },
  { key: 'organization', label: 'University / organization', placeholder: 'e.g. University, laboratory, company…' },
  { key: 'country', label: 'Country', placeholder: 'e.g. Greece' },
  { key: 'career_goal', label: 'Career goal', placeholder: 'e.g. Build a research group, launch a spinout…' },
  { key: 'startup_interest', label: 'Startup interest', placeholder: 'e.g. Healthtech, climate, none…' },
];

const EMPTY_FORM = {
  bio: '',
  skills: '',
  research_interests: '',
  organization: '',
  country: '',
  career_goal: '',
  startup_interest: '',
  user_type: '',
};

export default function Profile() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ papers: 0, researchers: 0, opportunities: 0, projects: 0, searches: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState(EMPTY_FORM);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const me = await base44.auth.me();
      const results = await Promise.allSettled([
        base44.entities.SavedPaper.list('-created_date', 999),
        base44.entities.SavedResearcher.list('-created_date', 999),
        base44.entities.SavedOpportunity.list('-created_date', 999),
        base44.entities.Project.list('-created_date', 999),
        base44.entities.SearchHistory.list('-created_date', 999),
      ]);
      const [papers, researchers, opportunities, projects, searches] = results
        .map(result => result.status === 'fulfilled' ? result.value : []);
      const failures = results.filter(result => result.status === 'rejected').length;
      if (failures) {
        setLoadError(`${failures} activity collection${failures === 1 ? '' : 's'} could not be counted. Profile details are still available.`);
      }

      const nextForm = {
        bio: me.bio || '',
        skills: me.skills || '',
        research_interests: me.research_interests || '',
        organization: me.organization || '',
        country: me.country || '',
        career_goal: me.career_goal || '',
        startup_interest: me.startup_interest || '',
        user_type: me.user_type || '',
      };

      setUser(me);
      setForm(nextForm);
      setSavedForm(nextForm);
      setStats({
        papers: papers.length,
        researchers: researchers.length,
        opportunities: opportunities.length,
        projects: projects.length,
        searches: searches.length,
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await base44.auth.updateMe(form);
      setUser(previous => ({ ...previous, ...updated }));
      setSavedForm(form);
      setEditing(false);
      toast({ title: 'Profile updated' });
    } catch (error) {
      toast({
        title: 'Could not update profile',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    setForm(savedForm);
    setEditing(false);
  };

  const missingContext = useMemo(
    () => PROFILE_FIELDS.filter(field => !String(form[field.key] || '').trim()).map(field => field.label),
    [form],
  );

  const userTypeLabel = USER_TYPE_OPTIONS.find(option => option.value === form.user_type)?.label || 'Not set';

  if (loading) return <ProfileSkeleton />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Research identity</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Keep the context EYLO may use to tailor research workflows. Your activity counts below come directly from your private workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => editing ? saveProfile() : setEditing(true)}
          disabled={saving}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50 sm:self-auto"
        >
          {editing ? <Check size={14} aria-hidden="true" /> : <Edit2 size={14} aria-hidden="true" />}
          {saving ? 'Saving…' : editing ? 'Save profile' : 'Edit profile'}
        </button>
      </header>

      {loadError && (
        <div role="status" className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-100">
          {loadError}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,.75fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-4 border-b border-border pb-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-lg font-semibold text-foreground">
              {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">{user?.full_name || 'Researcher'}</h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{userTypeLabel}</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Role</p>
            {editing ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {USER_TYPE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm(current => ({ ...current, user_type: option.value }))}
                    className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold transition-colors ${
                      form.user_type === option.value
                        ? 'border-primary/40 bg-primary/5 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/25 hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground">{userTypeLabel}</p>
            )}
          </div>

          <div className="mt-6 grid gap-5">
            {PROFILE_FIELDS.map(field => (
              <div key={field.key}>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {field.label}
                </label>
                {editing ? (
                  field.multiline ? (
                    <textarea
                      value={form[field.key]}
                      onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                    />
                  ) : (
                    <input
                      value={form[field.key]}
                      onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                    />
                  )
                ) : (
                  <p className="text-sm leading-6 text-foreground">
                    {form[field.key] || <span className="text-muted-foreground">Not provided</span>}
                  </p>
                )}
              </div>
            ))}
          </div>

          {editing && (
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-5">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="min-h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-foreground">Workspace activity</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Exact saved-item counts. They are not reputation or productivity scores.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Papers', value: stats.papers, icon: FileText },
                { label: 'Researchers', value: stats.researchers, icon: Users },
                { label: 'Funding', value: stats.opportunities, icon: Award },
                { label: 'Projects', value: stats.projects, icon: FolderOpen },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                    <Icon size={14} className="text-muted-foreground" aria-hidden="true" />
                    <p className="mt-3 font-heading text-2xl font-semibold tabular-nums text-foreground">{item.value}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{item.label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Search size={12} aria-hidden="true" /> Saved searches</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{stats.searches}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Profile context</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Research interests, skills and goals can help EYLO tailor prompts and recommendations only where those fields are actually used.
            </p>
            {missingContext.length ? (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Optional details not provided</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{missingContext.join(' · ')}</p>
                {!editing && (
                  <button type="button" onClick={() => setEditing(true)} className="mt-4 text-xs font-semibold text-primary hover:underline">
                    Add context
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs leading-5 text-muted-foreground">All optional profile context fields are filled in. You can change them at any time.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12" role="status" aria-live="polite">
      <div className="h-4 w-28 animate-pulse rounded bg-secondary" />
      <div className="mt-4 h-9 w-44 animate-pulse rounded bg-secondary" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,.75fr)]">
        <div className="h-[34rem] animate-pulse rounded-2xl border border-border bg-card" />
        <div className="space-y-3">
          <div className="h-52 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </div>
      <span className="sr-only">Loading profile</span>
    </div>
  );
}
