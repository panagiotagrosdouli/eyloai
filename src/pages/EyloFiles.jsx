import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, FolderOpen, Loader2, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { EYLO_FILE_MAX_BYTES, filterEyloFiles } from '@/lib/eylo-files.mjs';
import { createEyloFilesService } from '@/services/eylo-files.mjs';
import { useToast } from '@/components/ui/use-toast';

const files = createEyloFilesService(supabase);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EyloFiles() {
  const inputRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [pending, setPending] = useState(null);
  const [descriptionDrafts, setDescriptionDrafts] = useState({});
  const [error, setError] = useState('');
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus') || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [fileResult, projectResult] = await Promise.allSettled([
      files.list(), base44.entities.Project.list('-updated_date', 500),
    ]);
    if (fileResult.status === 'fulfilled') setRecords(fileResult.value);
    else setError(fileResult.reason?.message || 'Your files could not be loaded.');
    setProjects(projectResult.status === 'fulfilled' ? projectResult.value : []);
    if (projectResult.status === 'rejected') {
      toast({ title: 'Project list unavailable', description: 'Files remain usable; project links could not be loaded.', variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!focusId || loading) return;
    const focusedFile = records.find(record => record.id === focusId);
    if (focusedFile) setSearch(focusedFile.name);
  }, [focusId, loading, records]);

  const visibleFiles = useMemo(() => filterEyloFiles(records.map(record => ({
    ...record,
    project_title: projects.find(project => project.id === record.project_id)?.title || '',
  })), search), [records, projects, search]);

  useEffect(() => {
    if (!focusId || !visibleFiles.some(record => record.id === focusId)) return undefined;
    const timer = window.setTimeout(() => document.getElementById(`eylo-file-${focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
    return () => window.clearTimeout(timer);
  }, [focusId, visibleFiles]);

  async function saveUpload(file, fileId = null) {
    setBusyId(fileId || 'new');
    setError('');
    try {
      if (fileId) await files.addVersion(fileId, file);
      else await files.upload(file);
      toast({ title: fileId ? 'New file version saved' : 'File added to EYLO Files', description: 'The file is stored privately in your workspace.' });
      await load();
    } catch (cause) {
      setError(cause?.message || 'The file could not be saved.');
      toast({ title: 'File was not saved', description: cause?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusyId('');
      setPending(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function downloadVersion(file, version) {
    setBusyId(`${file.id}:${version.id}`);
    setError('');
    try {
      const blob = await files.download(version);
      downloadBlob(blob, file.name);
    } catch (cause) {
      setError(cause?.message || 'This version could not be downloaded.');
    } finally {
      setBusyId('');
    }
  }

  async function updateFile(file, patch) {
    setBusyId(file.id);
    setError('');
    try {
      const updated = await files.update(file.id, patch);
      setRecords(current => current.map(item => item.id === file.id ? { ...item, ...updated } : item));
      toast({ title: 'File details saved' });
    } catch (cause) {
      setError(cause?.message || 'File details could not be saved.');
    } finally {
      setBusyId('');
    }
  }

  async function removeFile(file) {
    if (!window.confirm(`Permanently delete “${file.name}” and all ${file.versions.length} stored version(s)?`)) return;
    setBusyId(file.id);
    setError('');
    try {
      await files.remove(file.id);
      setRecords(current => current.filter(item => item.id !== file.id));
      toast({ title: 'File and its versions deleted' });
    } catch (cause) {
      setError(cause?.message || 'The file could not be deleted.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="eylo-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">Workspace storage</p>
          <h1 className="eylo-page-heading">EYLO Files</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Keep research documents in a private workspace, link them to projects, and retrieve earlier versions when needed.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/documents/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"><Plus size={16} aria-hidden="true" />Create a document</Link>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busyId)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busyId === 'new' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            Add a file
          </button>
        </div>
        <input ref={inputRef} className="sr-only" type="file" aria-label="Choose a file to upload" onChange={event => event.target.files?.[0] && void saveUpload(event.target.files[0], pending)} />
      </header>

      <p role="note" className="mb-5 rounded-xl border border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground">Private files are available only to your signed-in account. Supported files up to {formatBytes(EYLO_FILE_MAX_BYTES)}. Uploading a replacement creates a new version; it does not overwrite the previous file.</p>
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><span>{error}</span><button type="button" onClick={() => void load()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3"><RefreshCw size={14} aria-hidden="true" />Retry</button></div>}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search files</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search file names and notes" className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>
      </div>

      {loading ? <div role="status" className="grid min-h-40 place-items-center text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" aria-hidden="true" />Loading your private files…</span></div>
        : visibleFiles.length === 0 ? <section className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"><FolderOpen size={22} aria-hidden="true" /></div>
          <h2 className="mt-4 text-lg font-semibold">{search ? 'No matching files' : 'Your file workspace is ready'}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{search ? 'Try another name or note.' : 'Add a proposal, dataset, paper, or working document. Files remain private and can be linked to a project.'}</p>
          {!search && <div className="mt-5 flex flex-wrap justify-center gap-2"><Link to="/documents/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"><Plus size={16} aria-hidden="true" />Create a document</Link><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Upload size={16} aria-hidden="true" />Add your first file</button></div>}
        </section>
        : <section aria-label="Your files" className="grid gap-4 xl:grid-cols-2">
          {visibleFiles.map(file => <article key={file.id} id={`eylo-file-${file.id}`} className={`min-w-0 rounded-2xl border bg-card p-4 sm:p-5 ${focusId === file.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText size={18} aria-hidden="true" /></div>
              <div className="min-w-0 flex-1"><h2 className="break-words text-sm font-semibold">{file.name}</h2><p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.size_bytes)} · {file.versions.length} version{file.versions.length === 1 ? '' : 's'} · Updated {new Date(file.updated_at).toLocaleDateString()}</p></div>
              <button type="button" onClick={() => void removeFile(file)} disabled={busyId === file.id} aria-label={`Delete ${file.name} and all versions`} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 size={16} aria-hidden="true" /></button>
            </div>

            <label className="mt-4 block text-xs font-medium text-muted-foreground">File note
              <textarea rows={2} maxLength={2000} value={descriptionDrafts[file.id] ?? file.description ?? ''} onChange={event => setDescriptionDrafts(current => ({ ...current, [file.id]: event.target.value }))} className="mt-1 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-10 items-center gap-2 text-xs text-muted-foreground">Project
                <select value={file.project_id || ''} onChange={event => void updateFile(file, { project_id: event.target.value || null })} disabled={busyId === file.id || !projects.length} aria-label={`Link ${file.name} to a project`} className="min-h-10 max-w-52 rounded-lg border border-border bg-background px-2 text-sm text-foreground">
                  <option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void updateFile(file, { description: descriptionDrafts[file.id] ?? file.description ?? '' })} disabled={busyId === file.id} className="min-h-10 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50">Save details</button>
            </div>
            {file.project_id && <Link to={`/projects/${file.project_id}`} className="mt-2 inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline">Open linked project</Link>}
            {['text/markdown', 'text/plain'].includes(file.mime_type) && <Link to={`/documents/${file.id}`} className="mt-2 inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline">Open in Document Editor</Link>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs font-semibold text-muted-foreground">Version history</span>
              <button type="button" onClick={() => { setPending(file.id); inputRef.current?.click(); }} disabled={Boolean(busyId)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"><Upload size={13} aria-hidden="true" />Upload new version</button>
            </div>
            {file.versions.length ? <ol className="mt-2 divide-y divide-border">
              {file.versions.map((version, index) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="text-muted-foreground">Version {version.version_number}{index === 0 ? ' · latest' : ''} · {formatBytes(version.size_bytes)} · {new Date(version.created_at).toLocaleString()}</span>
                <button type="button" onClick={() => void downloadVersion(file, version)} disabled={busyId === `${file.id}:${version.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"><Download size={14} aria-hidden="true" />Download</button>
              </li>)}
            </ol> : <p className="mt-2 text-xs text-destructive">No saved version metadata was found. Retry loading or contact support before deleting this file.</p>}
          </article>)}
        </section>}
      {records.length >= 500 && <p role="status" className="mt-4 text-xs text-muted-foreground">Showing the 500 most recently updated files. Older files are not included in this view yet.</p>}
    </div>
  );
}
