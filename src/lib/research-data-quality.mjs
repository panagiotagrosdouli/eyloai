/**
 * Deterministic, browser-only descriptive quality audit.
 * It does not impute missing data, assume missingness is random, or diagnose
 * duplicate participants from identical CSV rows.
 */
export function auditResearchDataQuality(dataset) {
  const headers = Array.isArray(dataset?.headers) ? dataset.headers : [];
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const totalRows = rows.length;
  const isPresent = cell => String(cell ?? '').trim().length > 0;
  const columnAudit = headers.map((column, index) => {
    const values = rows.map(row => String(row?.[index] ?? '').trim());
    const nonempty = values.filter(isPresent);
    const missing = totalRows - nonempty.length;
    const distinct = new Set(nonempty).size;
    return {
      column,
      present: nonempty.length,
      missing,
      missingPercent: totalRows ? Math.round((missing / totalRows) * 10000) / 100 : 0,
      constantAmongPresent: nonempty.length > 1 && distinct === 1,
      allMissing: missing === totalRows && totalRows > 0,
    };
  });
  let completeRows = 0;
  let entirelyMissingRows = 0;
  const observed = new Set();
  let identicalAdditionalRows = 0;
  for (const row of rows) {
    const count = headers.reduce((sum, _, i) => sum + Number(isPresent(row?.[i])), 0);
    if (count === headers.length) completeRows += 1;
    if (count === 0) entirelyMissingRows += 1;
    const key = JSON.stringify(headers.map((_, i) => String(row?.[i] ?? '')));
    if (observed.has(key)) identicalAdditionalRows += 1;
    else observed.add(key);
  }
  const notes = [];
  if (columnAudit.some(column => column.allMissing)) notes.push('One or more columns contain no observed values.');
  if (columnAudit.some(column => column.constantAmongPresent)) notes.push('One or more columns have only one observed value among nonblank cells.');
  if (identicalAdditionalRows) notes.push('Identical rows may be legitimate repeated observations; inspect before deduplicating.');
  if (totalRows - completeRows) notes.push('Missingness mechanisms (MCAR/MAR/MNAR) cannot be determined from this summary.');
  return {
    totalRows, columnCount: headers.length, completeRows,
    incompleteRows: totalRows - completeRows,
    entirelyMissingRows, identicalAdditionalRows,
    columns: columnAudit, notes,
    disclaimer: 'Descriptive audit only. No data were changed, inferred, imputed, transmitted, or used to test a scientific hypothesis.',
  };
}
