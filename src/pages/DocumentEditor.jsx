import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, FilePlus2, Loader2, RotateCcw, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { createEyloFilesService } from '@/services/eylo-files.mjs';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const files = createEyloFilesService(supabase);
const EMPTY_TITLE = 'Untitled research note.md';
const EMPTY_BODY = '# Research note\n\nStart with a question, evidence, or an idea.\n';
const MAX_DOCUMENT_CHARACTERS = 200_000;

function ensureMarkdownFilename(value) {
  const name = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240);
  if (!name) throw new Error('Enter a file name before saving.');
  return /\.md$/i.test(name) ? name : `${name}.md`;
}

function draftStorageKey(userId, fileId) {
  return `eylo:document-draft:${userId}:${fileId || 'new'}`;
}

function saveDownload(content, name) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearDraft(key) {
  try { sessionStorage.removeItem(key); } catch { /* Browser storage is optional. */ }
}

export default function DocumentEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [name, setName] = useState(EMPTY_TITLE);
  const [body, setBody] = useState(EMPTY_BODY);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recoveredDraft, setRecoveredDraft] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');
  const loadGeneration = useRef(0);
  const key = useMemo(() => draftStorageKey(user?.id || 'unknown', isNew ? null : id), [user?.id, isNew, id]);
  const dirty = !savedSnapshot || name !== savedSnapshot.name || body !== savedSnapshot.body;

  const loadDocument = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError('');
    setFile(null);
    setLoadedKey('');
    setRecoveredDraft(false);
    try {
      let nextFile = null;
      let nextName = EMPTY_TITLE;
      let nextBody = EMPTY_BODY;
      if (!isNew) {
        const records = await files.list();
        if (generation !== loadGeneration.current) return;
        nextFile = records.find(record => record.id === id) || null;
        if (!nextFile) throw new Error('This document was not found or is not available to your account.');
        if (!['text/markdown', 'text/plain'].includes(nextFile.mime_type)) {
          throw new Error('Only Markdown and plain-text files can be opened in the document editor.');
        }
        const latest = nextFile.versions[0];
        if (!latest) throw new Error('This document has no saved version to open.');
        nextName = nextFile.name;
        nextBody = await (await files.download(latest)).text();
        if (generation !== loadGeneration.current) return;
      }
      if (nextBody.length > MAX_DOCUMENT_CHARACTERS) throw new Error('This document is larger than the editor limit. Download it from EYLO Files instead.');
      setFile(nextFile);
      const snapshot = { name: nextName, body: nextBody };
      setSavedSnapshot(snapshot);
      setName(nextName);
      setBody(nextBody);
      setLoadedKey(key);
      try {
        const recovered = sessionStorage.getItem(key);
        if (recovered) {
          const value = JSON.parse(recovered);
          if (typeof value?.name === 'string' && typeof value?.body === 'string' && value.body.length <= MAX_DOCUMENT_CHARACTERS) {
            setName(value.name);
            setBody(value.body);
            setRecoveredDraft(true);
          }
        }
      } catch {
        // Recovery storage is optional; the saved file remains authoritative.
      }
    } catch (cause) {
      if (generation === loadGeneration.current) setError(cause?.message || 'The document could not be opened.');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [id, isNew, key]);

  useEffect(() => { void loadDocument(); }, [loadDocument]);

  useEffect(() => {
    if (loading || loadedKey !== key) return;
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ name, body }));
      else sessionStorage.removeItem(key);
    } catch {
      // The editor continues to work when browser storage is disabled.
    }
  }, [body, dirty, key, loading, loadedKey, name]);

  async function save() {
    if (saving || loading || !dirty) return;
    setSaving(true);
    setError('');
    try {
      const filename = ensureMarkdownFilename(name);
      if (body.length > MAX_DOCUMENT_CHARACTERS) throw new Error('The document exceeds the editor’s 200,000 character limit.');
      const payload = new File([body], filename, { type: 'text/markdown' });
      if (isNew) {
        const created = await files.upload(payload, { description: 'Markdown document created in EYLO Document Editor' });
        clearDraft(key);
        toast({ title: 'Document created', description: 'Your document is stored in EYLO Files with version history.' });
        navigate(`/documents/${created.id}`, { replace: true });
      } else {
        const updated = await files.addVersion(id, payload);
        const snapshot = { name: updated.name, body };
        setFile(current => current ? { ...current, ...updated } : current);
        setName(updated.name);
        setSavedSnapshot(snapshot);
        setRecoveredDraft(false);
        clearDraft(key);
        toast({ title: 'New document version saved', description: 'The previous version remains in EYLO Files.' });
        await loadDocument();
      }
    } catch (cause) {
      setError(cause?.message || 'Your changes could not be saved. The draft is still available in this tab.');
      toast({ title: 'Save failed', description: cause?.message || 'Your draft remains in this tab.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function loadSelectedVersion() {
    const version = file?.versions.find(item => item.id === selectedVersion);
    if (!version) return;
    try {
      const text = await (await files.download(version)).text();
      if (text.length > MAX_DOCUMENT_CHARACTERS) throw new Error('This version is larger than the editor limit.');
      setBody(text);
      setRecoveredDraft(true);
      toast({ title: `Version ${version.version_number} loaded`, description: 'Save to create a new version; history will be preserved.' });
    } catch (cause) {
      setError(cause?.message || 'This version could not be loaded.');
    }
  }

  function exportDocument() {
    try { saveDownload(body, ensureMarkdownFilename(name)); }
    catch (cause) { setError(cause?.message || 'The document could not be exported.'); }
  }

  return (
    <div className="eylo-page">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/files" aria-label="Back to EYLO Files" className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-secondary"><ArrowLeft size={17} aria-hidden="true" /></Link>
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">EYLO Create</p><h1 className="text-xl font-semibold">Document Editor</h1></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportDocument} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"><Download size={15} aria-hidden="true" />Export Markdown</button>
          <button type="button" onClick={() => void save()} disabled={loading || saving || !dirty} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}{saving ? 'Saving…' : 'Save version'}</button>
        </div>
      </header>
      <p role="note" className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground">Documents are saved as Markdown in your private EYLO Files workspace. Each save creates a recoverable version; Markdown export is a valid plain-text `.md` file.</p>
      {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
      {recoveredDraft && <p role="status" className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">Unsaved changes were recovered for this account and document. Save to keep them in EYLO Files.</p>}
      {loading ? <div role="status" className="grid min-h-48 place-items-center text-sm text-muted-foreground"><Loader2 className="animate-spin" size={18} aria-hidden="true" />Opening document…</div> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Document editing surface">
          <label className="block text-xs font-semibold text-muted-foreground">Document title
            <input value={name} onChange={event => setName(event.target.value)} maxLength={240} className="mt-1 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="mt-4 block text-xs font-semibold text-muted-foreground">Document text (Markdown)
            <textarea value={body} onChange={event => setBody(event.target.value)} maxLength={MAX_DOCUMENT_CHARACTERS} spellCheck className="mt-1 min-h-[60vh] w-full resize-y rounded-xl border border-border bg-background p-4 font-mono text-sm leading-6 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" aria-describedby="editor-status" />
          </label>
          <p id="editor-status" className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span><span>{body.length.toLocaleString()} / {MAX_DOCUMENT_CHARACTERS.toLocaleString()} characters</span></p>
        </section>
        <aside className="h-fit rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Version history</h2>
          {!file ? <p className="mt-2 text-sm text-muted-foreground">Your first save creates the document in EYLO Files.</p> : file.versions.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No saved versions are available.</p> : <>
            <label className="mt-3 block text-xs text-muted-foreground">Saved version
              <select value={selectedVersion} onChange={event => setSelectedVersion(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground" aria-label="Choose a saved document version">
                <option value="">Choose a version</option>
                {file.versions.map(version => <option key={version.id} value={version.id}>Version {version.version_number} · {new Date(version.created_at).toLocaleString()}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void loadSelectedVersion()} disabled={!selectedVersion} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"><RotateCcw size={14} aria-hidden="true" />Load selected version</button>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Loading an older version changes the editor draft only. Save it to create a new version; existing history is not overwritten.</p>
          </>}
          <Link to="/files" className="mt-4 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-primary hover:underline"><FilePlus2 size={14} aria-hidden="true" />Open EYLO Files</Link>
        </aside>
      </div>}
    </div>
  );
}
