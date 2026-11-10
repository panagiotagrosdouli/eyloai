import React, { useState } from 'react';
import { BadgeCheck, CircleAlert, Loader2, SearchCheck } from 'lucide-react';
import { verifyCitation } from '@/lib/citation-verification.mjs';

function statusStyle(status) {
  if (status === 'Verified') return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300';
  if (status === 'Partially verified') return 'border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-200';
  return 'border-border bg-muted/40 text-muted-foreground';
}

function FieldStatus({ status }) {
  const labels = { match: 'Match', mismatch: 'Mismatch', unavailable: 'Unavailable' };
  return <span className={status === 'match' ? 'font-medium text-emerald-700 dark:text-emerald-300' : status === 'mismatch' ? 'font-medium text-destructive' : 'text-muted-foreground'}>{labels[status] || status}</span>;
}

export default function CitationVerification({ paper }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      setResult(await verifyCitation(paper));
    } catch (verificationError) {
      setResult(null);
      setError(verificationError?.message || 'Citation verification failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const Icon = result?.status === 'Verified' ? BadgeCheck : result ? CircleAlert : SearchCheck;
  return <div className="mt-2">
    <button type="button" onClick={verify} disabled={loading} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-60">
      {loading ? <Loader2 size={12} className="animate-spin" /> : <SearchCheck size={12} />}
      {loading ? 'Checking Crossref…' : result ? 'Check citation again' : 'Verify citation metadata'}
    </button>
    {error && <div role="alert" className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[11px] text-destructive"><span>{error}</span><button type="button" onClick={verify} className="shrink-0 font-semibold underline">Retry</button></div>}
    {result && <div role="status" aria-live="polite" className={`mt-2 rounded-lg border p-3 ${statusStyle(result.status)}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold"><Icon size={14} />{result.status}</div>
      <p className="mt-1 text-[11px] leading-5">{result.note}</p>
      {result.fields.length > 0 && <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left text-[10px]">
          <thead><tr className="border-b border-current/10"><th scope="col" className="py-1.5 pr-3 font-semibold">Metadata</th><th scope="col" className="py-1.5 pr-3 font-semibold">Saved record</th><th scope="col" className="py-1.5 pr-3 font-semibold">Crossref</th><th scope="col" className="py-1.5 font-semibold">Check</th></tr></thead>
          <tbody>{result.fields.map(field => <tr key={field.label} className="border-b border-current/5 align-top"><th scope="row" className="py-1.5 pr-3 font-medium">{field.label}</th><td className="max-w-48 break-words py-1.5 pr-3">{String(field.savedValue ?? '')}</td><td className="max-w-48 break-words py-1.5 pr-3">{String(field.sourceValue ?? '')}</td><td className="py-1.5"><FieldStatus status={field.status} /></td></tr>)}</tbody>
        </table>
      </div>}
      {result.journal && <p className="mt-2 text-[10px]">Journal in Crossref: {result.journal}</p>}
      {result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] underline">Open Crossref DOI record</a>}
    </div>}
  </div>;
}
