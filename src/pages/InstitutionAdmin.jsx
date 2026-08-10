import React, { useEffect, useState } from 'react';
import { Activity, BarChart3, Building2, Loader2, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function InstitutionAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      const response = await fetch('/api/admin-analytics', { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not load institution analytics.');
      setData(result);
    };
    load().catch(loadError => setError(loadError?.message || 'Could not load institution analytics.'));
  }, []);

  if (!data && !error) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div>;

  const labels = {
    projects: 'Projects',
    saved_papers: 'Saved papers',
    saved_researchers: 'Researchers',
    saved_opportunities: 'Opportunities',
    meetings: 'Meetings',
    watchlists: 'Watchlists',
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-primary"><Building2 size={15} /><span className="text-[10px] font-bold uppercase tracking-widest">Institution Admin</span></div>
        <h1 className="font-heading text-3xl font-black">Organization research activity.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Aggregated server-side metrics for members provisioned with the same institution_id. Individual research content is not returned here.</p>
      </header>
      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-sm leading-6 text-amber-200">{error}<p className="mt-2 text-xs">An institution plan, organization_role= institution_admin and institution_id must be provisioned on your profile.</p></div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck size={19} /></div><div><h2 className="font-heading font-bold">{data.institution_name}</h2><p className="text-xs text-muted-foreground">Institution ID {data.institution_id} · generated {new Date(data.generated_at).toLocaleString()}</p></div></div>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-5"><Users size={16} className="text-primary" /><p className="mt-3 text-3xl font-black">{data.members}</p><p className="text-xs text-muted-foreground">Provisioned members</p></div>
            <div className="rounded-2xl border border-border bg-card p-5"><Activity size={16} className="text-primary" /><p className="mt-3 text-3xl font-black">{data.ai_actions_this_month}</p><p className="text-xs text-muted-foreground">AI actions this month</p></div>
            {Object.entries(data.counts).map(([key, value]) => <div key={key} className="rounded-2xl border border-border bg-card p-5"><BarChart3 size={16} className="text-primary" /><p className="mt-3 text-3xl font-black">{value}</p><p className="text-xs text-muted-foreground">{labels[key] || key}</p></div>)}
          </section>
        </>
      )}
    </div>
  );
}
