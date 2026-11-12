import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Database, Download, FileSpreadsheet, LockKeyhole, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  DATA_LAB_LIMITS,
  DATA_LAB_DEFAULT_MINIMUM_CELL_SIZE,
  DATA_LAB_DISCLOSURE_THRESHOLDS,
  compareResearchNumericColumns,
  exportResearchDataComparisonCsv,
  exportResearchDataSummaryCsv,
  getResearchDataChartRows,
  parseResearchCsv,
  summarizeResearchData,
  summarizeResearchNumericByCategory,
} from '@/lib/research-data.mjs';
import { auditResearchDataQuality } from '@/lib/research-data-quality.mjs';
import { sha256ResearchFile, buildResearchDataProvenance } from '@/lib/research-data-provenance.mjs';
import { addResearchCatalogEntry, clearResearchCatalog, exportResearchCatalogJson, readResearchCatalog, removeResearchCatalogEntry, researchCatalogStorageKey } from '@/lib/research-catalog.mjs';

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 });

function downloadCsv(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function displayNumber(value) {
  return value == null ? '—' : numberFormat.format(value);
}

export default function ResearchDataLab() {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const loadGenerationRef = useRef(0);
  useEffect(() => () => { loadGenerationRef.current += 1; }, []);
  const [dataset, setDataset] = useState(null);
  const [filename, setFilename] = useState('');
  const [fileDigest, setFileDigest] = useState(null);
  const [fileBytes, setFileBytes] = useState(0);
  const [digestError, setDigestError] = useState('');
  const [chartColumn, setChartColumn] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparisonColumns, setComparisonColumns] = useState([]);
  const [minimumCellSize, setMinimumCellSize] = useState(DATA_LAB_DEFAULT_MINIMUM_CELL_SIZE);
  const [catalogEntries, setCatalogEntries] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogStatus, setCatalogStatus] = useState('');
  const [confirmCatalogClear, setConfirmCatalogClear] = useState(false);
  const catalogKey = useMemo(() => researchCatalogStorageKey(user?.id), [user?.id]);
  useEffect(() => {
    setCatalogEntries([]);
    setCatalogStatus('');
    setCatalogError('');
    setConfirmCatalogClear(false);
    if (!catalogKey) {
      setCatalogError('Sign in to access this account’s browser-local catalog.');
      return;
    }
    try { setCatalogEntries(readResearchCatalog(window.localStorage, catalogKey)); }
    catch (cause) { setCatalogError(cause.message || 'The local catalog could not be opened.'); }
  }, [catalogKey]);
  const summaries = useMemo(() => summarizeResearchData(dataset, { minimumCellSize }), [dataset, minimumCellSize]);
  const quality = useMemo(() => dataset ? auditResearchDataQuality(dataset) : null, [dataset]);
  const numericColumns = summaries.filter((summary) => summary.type === 'numeric').map((summary) => summary.column);
  const comparableColumns = summaries.filter((summary) => summary.type === 'numeric' || summary.type === 'text').map((summary) => summary.column);
  const summaryByColumn = new Map(summaries.map((summary) => [summary.column, summary]));
  const selectedComparisonColumns = [
    comparableColumns.includes(comparisonColumns[0]) ? comparisonColumns[0] : comparableColumns[0] || '',
    comparableColumns.includes(comparisonColumns[1]) && comparisonColumns[1] !== (comparableColumns.includes(comparisonColumns[0]) ? comparisonColumns[0] : comparableColumns[0])
      ? comparisonColumns[1]
      : comparableColumns.find((column) => column !== (comparableColumns.includes(comparisonColumns[0]) ? comparisonColumns[0] : comparableColumns[0])) || '',
  ];
  const comparison = useMemo(
    () => {
      if (!selectedComparisonColumns.every(Boolean)) return null;
      const firstType = summaryByColumn.get(selectedComparisonColumns[0])?.type;
      const secondType = summaryByColumn.get(selectedComparisonColumns[1])?.type;
      if (firstType === 'numeric' && secondType === 'numeric') {
        return compareResearchNumericColumns(dataset, ...selectedComparisonColumns, { minimumCellSize });
      }
      if (firstType === 'numeric' && secondType === 'text') {
        return summarizeResearchNumericByCategory(dataset, selectedComparisonColumns[0], selectedComparisonColumns[1], { minimumGroupSize: minimumCellSize });
      }
      if (firstType === 'text' && secondType === 'numeric') {
        return summarizeResearchNumericByCategory(dataset, selectedComparisonColumns[1], selectedComparisonColumns[0], { minimumGroupSize: minimumCellSize });
      }
      return { available: false, reason: 'Choose two numeric variables or one numeric and one categorical variable.' };
    },
    [dataset, selectedComparisonColumns[0], selectedComparisonColumns[1], minimumCellSize],
  );
  const selectedChartColumn = numericColumns.includes(chartColumn) ? chartColumn : numericColumns[0] || '';
  const chartRows = useMemo(
    () => getResearchDataChartRows(dataset, selectedChartColumn),
    [dataset, selectedChartColumn],
  );
  const plottedRows = chartRows.slice(0, 80);
  const plot = { left: 54, top: 12, width: 730, height: 216 };
  const chartMin = Math.min(0, ...plottedRows.map(({ value }) => value));
  const chartMax = Math.max(1, ...plottedRows.map(({ value }) => value));
  const chartRange = chartMax - chartMin || 1;
  const zeroY = plot.top + ((chartMax / chartRange) * plot.height);
  const barStep = plottedRows.length ? plot.width / plottedRows.length : plot.width;
  const barWidth = Math.max(2, Math.min(28, barStep * 0.7));

  const loadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const generation = ++loadGenerationRef.current;
    setError('');
    setLoading(true);
    setDataset(null);
    setFilename('');
    setFileDigest(null);
    setFileBytes(0);
    setDigestError('');
    setComparisonColumns([]);
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Choose a .csv file.');
      if (file.size > DATA_LAB_LIMITS.bytes) throw new Error('The CSV exceeds the 5 MB limit.');
      const rawBytes = await file.arrayBuffer();
      if (generation !== loadGenerationRef.current) return;
      const result = parseResearchCsv(new TextDecoder('utf-8').decode(rawBytes));
      setDataset(result);
      setFilename(file.name);
      setFileBytes(rawBytes.byteLength);
      try {
        const digest = await sha256ResearchFile(rawBytes);
        if (generation !== loadGenerationRef.current) return;
        setFileDigest(digest);
      } catch {
        if (generation !== loadGenerationRef.current) return;
        setDigestError('File fingerprint unavailable in this browser. Data analysis remains local.');
      }
      if (generation !== loadGenerationRef.current) return;
      setChartColumn(result.headers.find((header) => summarizeResearchData(result).find((item) => item.column === header && item.type === 'numeric')) || '');
    } catch (cause) {
      if (generation === loadGenerationRef.current) {
        setError(cause instanceof Error ? cause.message : 'The CSV could not be read. Check its format and try again.');
      }
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
      event.target.value = '';
    }
  };

  const clearData = () => {
    loadGenerationRef.current += 1;
    setLoading(false);
    setDataset(null);
    setFilename('');
    setFileDigest(null);
    setFileBytes(0);
    setDigestError('');
    setChartColumn('');
    setComparisonColumns([]);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleExport = () => {
    downloadCsv(exportResearchDataSummaryCsv(summaries), 'research-data-summary.csv');
  };

  const exportComparison = () => {
    if (!comparison?.available) return;
    downloadCsv(exportResearchDataComparisonCsv(comparison), 'research-variable-comparison.csv');
  };

  const exportQualityReport = () => {
    if (!quality) return;
    // Only aggregate counts and column names are included; never raw rows.
    const blob = new Blob([JSON.stringify({
      format: 'eylo-local-data-quality-v1',
      generated_at: new Date().toISOString(),
      file_name: filename,
      disclosure: {
        minimum_cell_size: minimumCellSize,
        aggregate_only_output_guarantees_anonymity: false,
      },
      audit: quality,
      provenance: fileDigest && dataset
        ? buildResearchDataProvenance({
          fileName: filename, byteLength: fileBytes, sha256: fileDigest,
          rowCount: dataset.rows.length, columnCount: dataset.headers.length,
        }) : null,
    }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'research-data-quality.json';
      document.body.append(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const saveToCatalog = () => {
    if (!dataset) return;
    if (!catalogKey) { setCatalogError('Sign in before saving dataset metadata.'); return; }
    try {
      const result = addResearchCatalogEntry(window.localStorage, {
        id: window.crypto.randomUUID(), fileName: filename, sha256: fileDigest,
        byteLength: fileBytes, rowCount: dataset.rows.length, columnCount: dataset.headers.length,
        addedAt: new Date().toISOString(),
      }, catalogKey);
      setCatalogEntries(result.entries);
      setCatalogError('');
      setCatalogStatus(result.duplicate ? 'This exact file fingerprint is already in your catalog.' : 'Dataset metadata saved in this browser.');
    } catch (cause) { setCatalogError(cause.message || 'The local catalog could not save this entry.'); }
  };

  const deleteCatalogEntry = (id) => {
    try {
      const entries = removeResearchCatalogEntry(window.localStorage, id, catalogKey);
      setCatalogEntries(entries);
      setCatalogError('');
      setCatalogStatus('Catalog entry removed from this browser.');
    } catch (cause) { setCatalogError(cause.message || 'The catalog entry could not be removed.'); }
  };

  const deleteCatalog = () => {
    try {
      clearResearchCatalog(window.localStorage, catalogKey);
      setCatalogEntries([]);
      setCatalogError('');
      setCatalogStatus('Local catalog cleared.');
      setConfirmCatalogClear(false);
    } catch (cause) { setCatalogError(cause.message || 'The local catalog could not be cleared.'); }
  };

  const exportCatalog = () => {
    try {
      const blob = new Blob([exportResearchCatalogJson(catalogEntries)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'eylo-local-research-catalog.json';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) { setCatalogError(cause.message || 'The catalog export could not be created.'); }
  };

  const comparisonExportControl = (
    <div>
      <button type="button" onClick={exportComparison} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">
        <Download size={15} aria-hidden="true" /> Export comparison CSV
      </button>
      <p className="mt-2 text-xs text-muted-foreground">Small cells are suppressed using k={minimumCellSize}. Aggregate-only exports do not guarantee anonymity; assess the data and sharing context before distributing.</p>
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-8 sm:py-8" aria-labelledby="data-lab-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-primary"><BarChart3 size={16} aria-hidden="true" /> Research tools</div>
          <h1 id="data-lab-title" className="text-3xl font-bold tracking-tight">Research Data Lab</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Explore a CSV with transparent, reproducible summaries. EYLO calculates only from the values in the file; it does not infer study conclusions.</p>
        </div>
        {dataset && (
          <button type="button" onClick={clearData} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">
            <RotateCcw size={15} aria-hidden="true" /> Clear data
          </button>
        )}
      </header>

      <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:p-5" aria-label="Private file handling">
        <div className="flex items-start gap-3">
          <LockKeyhole size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Your CSV stays in this browser</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">The file is parsed locally and is not uploaded to EYLO or sent to an AI service. It is held in page memory only; clear it or leave the page to remove it.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="upload-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="upload-title" className="text-lg font-semibold">Open a dataset</h2>
            <p className="mt-1 text-sm text-muted-foreground">CSV with one header row; comma delimiters and quoted fields are supported.</p>
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground outline-offset-2 hover:opacity-90 focus-within:outline focus-within:outline-2 focus-within:outline-primary has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
            {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            {loading ? 'Reading file…' : 'Choose CSV'}
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={loadFile} disabled={loading} className="sr-only" aria-label="Choose CSV file" />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Limits: 5 MB, {numberFormat.format(DATA_LAB_LIMITS.rows)} rows, {DATA_LAB_LIMITS.columns} columns. No formulas are executed.</p>
        {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        {dataset && <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm text-foreground"><FileSpreadsheet size={16} className="text-primary" aria-hidden="true" />{filename} · {numberFormat.format(dataset.rows.length)} rows · {dataset.headers.length} columns</p>}
        {dataset && (
          <div className="mt-3 rounded-lg border border-border p-3 text-xs">
            <p className="font-semibold">Local file identity (SHA-256)</p>
            {fileDigest ? <code className="mt-1 block break-all font-mono">{fileDigest}</code>
              : <p role="status" className="mt-1 text-muted-foreground">{digestError || 'Calculating fingerprint…'}</p>}
            <p className="mt-2 text-muted-foreground">
              Fingerprint of the original CSV bytes, not the parsed rows. Use it to compare later file versions.
              It is not a scientific validation or a digital signature. Private, predictable datasets may be identifiable from their hash. Aggregate exports are not guaranteed to be anonymous.
              The optional fingerprint is included in the aggregate JSON report.
            </p>
            <button type="button" onClick={saveToCatalog} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">
              <Database size={15} aria-hidden="true" /> Save metadata to Data Catalog
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="catalog-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="catalog-title" className="text-lg font-semibold">Local Data Catalog</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Opt in to save a dataset name, dimensions, file size, saved date and optional SHA-256 fingerprint in this browser, scoped to your signed-in account. CSV contents and column values are never stored. Names and hashes can still be sensitive; catalog exports do not guarantee anonymity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCatalog} disabled={!catalogEntries.length} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={15} aria-hidden="true" /> Export catalog metadata
            </button>
            <button type="button" onClick={() => setConfirmCatalogClear(true)} disabled={!catalogEntries.length && !catalogError} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 size={15} aria-hidden="true" /> Clear catalog
            </button>
          </div>
        </div>
        {confirmCatalogClear && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alertdialog" aria-labelledby="clear-catalog-title" aria-describedby="clear-catalog-description">
          <h3 id="clear-catalog-title" className="text-sm font-semibold">Clear all catalog metadata?</h3>
          <p id="clear-catalog-description" className="mt-1 text-sm text-muted-foreground">This removes {catalogEntries.length} browser-local entries for this account. It does not affect source files or analysis data.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirmCatalogClear(false)} className="min-h-10 rounded-lg border border-border px-3 text-sm">Cancel</button>
            <button type="button" onClick={deleteCatalog} className="min-h-10 rounded-lg bg-destructive px-3 text-sm font-semibold text-destructive-foreground">Confirm clear catalog</button>
          </div>
        </div>}
        {catalogError && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{catalogError}</p>}
        {catalogStatus && <p role="status" className="mt-3 text-sm text-muted-foreground">{catalogStatus}</p>}
        {catalogEntries.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {catalogEntries.map((entry) => (
              <li key={entry.id} className="min-w-0 rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold">{entry.fileName}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{numberFormat.format(entry.rowCount)} rows · {entry.columnCount} columns · {numberFormat.format(entry.byteLength)} bytes</p>
                    <p className="mt-1 text-xs text-muted-foreground">Saved {new Date(entry.addedAt).toLocaleString()}</p>
                    {entry.sha256 && <code className="mt-2 block break-all text-[11px] text-muted-foreground">SHA-256 · {entry.sha256}</code>}
                    {!entry.sha256 && <p className="mt-2 text-[11px] text-muted-foreground">File fingerprint unavailable when saved.</p>}
                  </div>
                  <button type="button" onClick={() => deleteCatalogEntry(entry.id)} aria-label={`Remove ${entry.fileName} from catalog`} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border px-2 text-xs hover:bg-secondary">
                    <Trash2 size={14} aria-hidden="true" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : !catalogError ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No catalog entries yet. Open a CSV and choose “Save metadata to Data Catalog” to remember its identity on this device.</p>
        ) : null}
      </section>

      {dataset && (
        <>
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="summary-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="summary-title" className="text-lg font-semibold">Column summary</h2>
                <p className="mt-1 text-sm text-muted-foreground">Blank cells count as missing. Numeric statistics use finite decimal values only.</p>
              </div>
              <button type="button" onClick={handleExport} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">
                <Download size={15} aria-hidden="true" /> Export summary CSV
              </button>
            </div>
            <p role="note" className="mt-3 text-xs leading-5 text-muted-foreground">Numeric summaries below k={minimumCellSize} are masked in this table and export. An aggregate-only export is not guaranteed to be anonymous.</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                <thead className="bg-secondary/60 text-xs text-muted-foreground">
                  <tr>{['Column', 'Type', 'Rows', 'Missing', 'Distinct', 'Mean', 'Median', 'Min', 'Max', 'Sample SD'].map((heading) => <th key={heading} scope="col" className="p-3 font-semibold">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {summaries.map((summary) => (
                    <tr key={summary.column} className="border-t border-border">
                      <th scope="row" className="max-w-56 break-words p-3 font-medium">{summary.column}</th>
                      <td className="p-3 capitalize">{summary.type}</td>
                      <td className="p-3">{summary.statisticsSuppressed ? '—' : summary.rows}</td>
                      <td className="p-3">{summary.statisticsSuppressed ? '—' : summary.missing}</td>
                      <td className="p-3">{summary.statisticsSuppressed ? '—' : summary.distinct}</td>
                      <td className="p-3">{displayNumber(summary.statistics?.mean)}</td>
                      <td className="p-3">{displayNumber(summary.statistics?.median)}</td>
                      <td className="p-3">{displayNumber(summary.statistics?.min)}</td>
                      <td className="p-3">{displayNumber(summary.statistics?.max)}</td>
                      <td className="p-3">{displayNumber(summary.statistics?.sampleStandardDeviation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {quality && (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="data-quality-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="data-quality-title" className="text-lg font-semibold">Missing-data and consistency audit</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Descriptive, local-only review. No missing values are imputed and identical rows are not automatically deleted.</p>
                </div>
                <button type="button" onClick={exportQualityReport}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">
                  <Download size={15} aria-hidden="true" /> Export quality JSON
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Complete rows', count: quality.completeRows },
                  { label: 'Incomplete rows', count: quality.incompleteRows },
                  { label: 'Fully missing rows', count: quality.entirelyMissingRows },
                  { label: 'Additional identical rows', count: quality.identicalAdditionalRows },
                ].map(({ label, count }) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <p className="text-xl font-bold tabular-nums">{numberFormat.format(count)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-secondary/60 text-xs text-muted-foreground">
                    <tr><th className="p-3">Column</th><th className="p-3">Present</th><th className="p-3">Missing</th><th className="p-3">Missing %</th><th className="p-3">Observation</th></tr>
                  </thead>
                  <tbody>
                    {quality.columns.map(item => (
                      <tr key={item.column} className="border-t border-border">
                        <th scope="row" className="break-words p-3 font-medium">{item.column}</th>
                        <td className="p-3 tabular-nums">{item.present}</td>
                        <td className="p-3 tabular-nums">{item.missing}</td>
                        <td className="p-3 tabular-nums">{item.missingPercent}%</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {item.allMissing ? 'No observed values' : item.constantAmongPresent ? 'Constant among observed values' : 'No simple flag'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {quality.notes.length > 0 && (
                <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-amber-600 dark:text-amber-400">
                  {quality.notes.map(note => <li key={note}>{note}</li>)}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{quality.disclaimer} The JSON export includes column names and aggregates but no raw dataset rows.</p>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="comparison-title">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="comparison-title" className="text-lg font-semibold">Compare variables</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Compare two numeric variables or summarize a numeric variable across observed categories. Results are descriptive and do not adjust for other variables.</p>
              </div>
              {comparableColumns.length >= 2 && (
                <div className="flex flex-wrap gap-3">
                  {[0, 1].map((index) => (
                    <label key={index} className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Variable {index + 1}
                      <select
                        aria-label={`Comparison variable ${index + 1}`}
                        value={selectedComparisonColumns[index]}
                        onChange={(event) => setComparisonColumns((current) => {
                          const next = [...selectedComparisonColumns];
                          next[index] = event.target.value;
                          return next;
                        })}
                        className="min-h-10 min-w-40 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      >
                        {comparableColumns.filter((column) => column === selectedComparisonColumns[index] || column !== selectedComparisonColumns[1 - index]).map((column) => (
                          <option key={column} value={column}>{column} ({summaryByColumn.get(column)?.type})</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Minimum cell size (k)
                    <select aria-label="Minimum disclosure cell size" value={minimumCellSize} onChange={(event) => setMinimumCellSize(Number(event.target.value))} className="min-h-10 min-w-40 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                      {DATA_LAB_DISCLOSURE_THRESHOLDS.map((value) => <option key={value} value={value}>{value === 1 ? '1 (no small-cell suppression)' : `${value} observations`}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>
            <p role="note" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">
              Numeric summaries and grouped cells below k={minimumCellSize} are masked in tables and exports. Lower k values disclose more detail. Aggregate-only output does not guarantee anonymity. These are descriptive analyses: no p-values, population inference, or causal conclusions are calculated.
            </p>
            {comparableColumns.length < 2 ? (
              <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">At least two non-empty columns are needed for comparison.</p>
            ) : comparison?.available && comparison.kind === 'pearson-correlation' ? (
              <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3" role="status" aria-live="polite">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Pearson correlation, r</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{numberFormat.format(comparison.pearsonR)}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Complete pairs used</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{numberFormat.format(comparison.pairs)}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Rows skipped for blanks or non-numeric cells</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{numberFormat.format(comparison.incomplete)}</p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground sm:col-span-3">Pearson r is a descriptive measure of linear association for complete pairs in this file. It is not an inferential test or causal estimate. The deterministic value-hash sample can omit rare patterns and outliers; r is calculated from all complete pairs.</p>
                <div className="sm:col-span-3">
                  {comparisonExportControl}
                </div>
              </div>
              {comparison.scatterSample?.length > 0 && (
                <div className="mt-6 rounded-xl border border-border p-3 sm:p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">Pairwise pattern</h3>
                    <p className="text-xs text-muted-foreground">
                      Showing {numberFormat.format(comparison.scatterSampleSize)} of {numberFormat.format(comparison.pairs)} complete pairs with a deterministic value-hash sample; r uses all pairs.
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedComparisonColumns[0]}: {displayNumber(comparison.firstMin)} to {displayNumber(comparison.firstMax)} · {selectedComparisonColumns[1]}: {displayNumber(comparison.secondMin)} to {displayNumber(comparison.secondMax)}
                  </p>
                  <svg className="mt-3 h-72 w-full" viewBox="0 0 640 310" role="img" aria-label={`Scatter plot of ${selectedComparisonColumns[0]} against ${selectedComparisonColumns[1]} using a sample of ${comparison.scatterSample.length} complete rows`}>
                    <title>Sampled paired values</title>
                    {[0, 0.5, 1].map(tick => {
                      const y = 16 + ((1 - tick) * 220);
                      return <line key={tick} x1="64" y1={y} x2="604" y2={y} stroke="hsl(var(--border))" strokeDasharray="4 4" />;
                    })}
                    <line x1="64" y1="236" x2="604" y2="236" stroke="currentColor" strokeOpacity="0.5" />
                    <line x1="64" y1="16" x2="64" y2="236" stroke="currentColor" strokeOpacity="0.5" />
                    {comparison.scatterSample.map(point => (
                      <circle key={point.row} cx={64 + point.xPosition * 540} cy={16 + (1 - point.yPosition) * 220} r="3.5" fill="hsl(var(--primary))" fillOpacity="0.75">
                        <title>Row {point.row}: {selectedComparisonColumns[0]} {numberFormat.format(point.first)}, {selectedComparisonColumns[1]} {numberFormat.format(point.second)}</title>
                      </circle>
                    ))}
                    <text x="64" y="252" textAnchor="start" fontSize="10" fill="currentColor">{displayNumber(comparison.firstMin)}</text>
                    <text x="334" y="252" textAnchor="middle" fontSize="10" fill="currentColor">{displayNumber((comparison.firstMin / 2) + (comparison.firstMax / 2))}</text>
                    <text x="604" y="252" textAnchor="end" fontSize="10" fill="currentColor">{displayNumber(comparison.firstMax)}</text>
                    <text x="334" y="275" textAnchor="middle" fontSize="12" fill="currentColor">{selectedComparisonColumns[0]}</text>
                    <text x="16" y="126" textAnchor="middle" fontSize="12" fill="currentColor" transform="rotate(-90 16 126)">{selectedComparisonColumns[1]}</text>
                    <text x="48" y="22" textAnchor="end" fontSize="10" fill="currentColor">{displayNumber(comparison.secondMax)}</text>
                    <text x="48" y="130" textAnchor="end" fontSize="10" fill="currentColor">{displayNumber((comparison.secondMin / 2) + (comparison.secondMax / 2))}</text>
                    <text x="48" y="239" textAnchor="end" fontSize="10" fill="currentColor">{displayNumber(comparison.secondMin)}</text>
                  </svg>
                  <div className="sr-only">
                    <table><caption>All {comparison.scatterSampleSize} displayed sampled values for {selectedComparisonColumns[0]} and {selectedComparisonColumns[1]}</caption><thead><tr><th>Source row</th><th>{selectedComparisonColumns[0]}</th><th>{selectedComparisonColumns[1]}</th></tr></thead><tbody>{comparison.scatterSample.map(point => <tr key={point.row}><td>{point.row}</td><td>{point.first}</td><td>{point.second}</td></tr>)}</tbody></table>
                  </div>
                </div>
              )}
              </>
            ) : comparison?.available && comparison.kind === 'numeric-by-category' ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3" role="status" aria-live="polite">
                  <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Complete numeric-category observations</p><p className="mt-1 text-2xl font-semibold tabular-nums">{comparison.pairs == null ? 'Suppressed' : numberFormat.format(comparison.pairs)}</p></div>
                  <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Rows skipped</p><p className="mt-1 text-2xl font-semibold tabular-nums">{comparison.incomplete == null ? 'Suppressed' : numberFormat.format(comparison.incomplete)}</p></div>
                  <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Observed categories</p><p className="mt-1 text-2xl font-semibold tabular-nums">{comparison.totalGroups == null ? 'Some suppressed' : numberFormat.format(comparison.totalGroups)}</p></div>
                  <p className="text-xs leading-5 text-muted-foreground sm:col-span-3">Group summaries are descriptive. Missing/non-numeric rows are excluded; no imputation, population inference, significance test, or causal conclusion is performed.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-secondary/60 text-xs text-muted-foreground"><tr>{['Category', 'n', 'Mean', 'Median', 'Sample SD', 'Minimum', 'Maximum'].map(label => <th key={label} scope="col" className="p-3 font-semibold">{label}</th>)}</tr></thead>
                    <tbody>{comparison.groups.map(group => (
                      <tr key={group.category} className="border-t border-border">
                        <th scope="row" className="max-w-64 break-words p-3 font-medium">{group.category}</th>
                        <td className="p-3 tabular-nums">{numberFormat.format(group.count)}</td>
                        <td className="p-3 tabular-nums">{displayNumber(group.mean)}</td>
                        <td className="p-3 tabular-nums">{displayNumber(group.median)}</td>
                        <td className="p-3 tabular-nums">{displayNumber(group.sampleStandardDeviation)}</td>
                        <td className="p-3 tabular-nums">{displayNumber(group.min)}</td>
                        <td className="p-3 tabular-nums">{displayNumber(group.max)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {comparison.hasSuppressedGroups && <p role="status" className="text-xs text-muted-foreground">Small groups below k={comparison.minimumGroupSize} are omitted without showing their labels, counts, or numeric summaries.</p>}
                {comparison.groupsTruncated && (comparison.omittedGroups == null
                  ? <p className="text-xs text-muted-foreground">Additional publishable categories are omitted because the table is limited to 50 rows; omitted counts are hidden while small groups are suppressed.</p>
                  : <p className="text-xs text-muted-foreground">Showing the 50 most frequent of {numberFormat.format(comparison.totalGroups)} categories. {numberFormat.format(comparison.omittedGroups)} less frequent categories ({numberFormat.format(comparison.omittedObservations)} observations) are included in the complete observation count but omitted from this table.</p>)}
                {comparisonExportControl}
              </div>
            ) : (
              <p role="status" className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{comparison?.reason || 'Choose two numeric columns.'}</p>
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="chart-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="chart-title" className="text-lg font-semibold">Explore numeric values</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Rows are shown in file order; missing values are skipped.</p>
                </div>
                {numericColumns.length > 0 && (
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Numeric column
                    <select aria-label="Numeric column" value={selectedChartColumn} onChange={(event) => setChartColumn(event.target.value)} className="min-h-10 min-w-40 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                      {numericColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {selectedChartColumn ? (
                <div className="mt-4">
                  <svg className="h-72 w-full overflow-visible" viewBox="0 0 800 270" role="img" aria-label={`Bar chart of ${selectedChartColumn} by row number`} preserveAspectRatio="none">
                    <title>{selectedChartColumn} values by row</title>
                    {[0, 1, 2, 3, 4].map((tick) => {
                      const value = chartMax - ((chartRange * tick) / 4);
                      const y = plot.top + ((tick / 4) * plot.height);
                      return <g key={tick}><line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 4" /><text x={plot.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="currentColor">{numberFormat.format(value)}</text></g>;
                    })}
                    <line x1={plot.left} y1={zeroY} x2={plot.left + plot.width} y2={zeroY} stroke="currentColor" strokeOpacity="0.45" />
                    {plottedRows.map(({ row, value }, index) => {
                      const valueY = plot.top + (((chartMax - value) / chartRange) * plot.height);
                      const y = value >= 0 ? valueY : zeroY;
                      const height = Math.max(1, Math.abs(zeroY - valueY));
                      return <rect key={row} x={plot.left + (index * barStep) + ((barStep - barWidth) / 2)} y={y} width={barWidth} height={height} rx="2" fill="hsl(var(--primary))"><title>Row {row}: {numberFormat.format(value)}</title></rect>;
                    })}
                    {plottedRows.length > 0 && [...new Set([0, Math.floor((plottedRows.length - 1) / 2), plottedRows.length - 1])].map((index) => {
                      const { row } = plottedRows[index];
                      return <text key={index} x={plot.left + (index * barStep) + (barStep / 2)} y="250" textAnchor="middle" fontSize="11" fill="currentColor">{row}</text>;
                    })}
                    <text x={plot.left + (plot.width / 2)} y="267" textAnchor="middle" fontSize="11" fill="currentColor">Row number</text>
                  </svg>
                  <div className="sr-only">
                    <table><caption>{selectedChartColumn} chart values by row</caption><thead><tr><th>Row</th><th>Value</th></tr></thead><tbody>{plottedRows.slice(0, 20).map(({ row, value }) => <tr key={row}><td>{row}</td><td>{value}</td></tr>)}</tbody></table>
                  </div>
                </div>
              ) : <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No numeric column is available to chart.</p>}
              {chartRows.length > plottedRows.length && selectedChartColumn && <p className="mt-2 text-xs text-muted-foreground">Chart shows the first {plottedRows.length} numeric values for readability.</p>}
            </div>

            <aside className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="steps-title">
              <h2 id="steps-title" className="text-lg font-semibold">Analysis steps</h2>
              <p className="mt-1 text-sm text-muted-foreground">Use these settings to reproduce the summaries.</p>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-foreground">
                <li>Read the first non-empty row as column headers.</li>
                <li>Use comma delimiters and standard double-quote escaping.</li>
                <li>Trim whitespace; blank cells are missing.</li>
                <li>Treat a column as numeric only when every present cell is a finite decimal or exponent value.</li>
                <li>Compute arithmetic mean, median, minimum, maximum, and sample standard deviation (n−1 denominator).</li>
              </ol>
              <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">These calculations describe the uploaded rows. They do not test a hypothesis or establish scientific significance.</p>
            </aside>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="preview-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="preview-title" className="text-lg font-semibold">Data preview</h2>
                <p className="mt-1 text-sm text-muted-foreground">Previewing the first {Math.min(dataset.rows.length, 100)} of {numberFormat.format(dataset.rows.length)} rows.</p>
              </div>
            </div>
            <div className="mt-4 max-h-[28rem] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-max border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-secondary text-foreground"><tr>{dataset.headers.map((header) => <th key={header} scope="col" className="max-w-64 p-3 font-semibold">{header}</th>)}</tr></thead>
                <tbody>
                  {dataset.rows.slice(0, 100).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-border align-top">
                      {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="max-w-64 break-words p-3">{cell || <span className="text-muted-foreground" aria-label="Missing value">—</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
