export const DATA_LAB_LIMITS = Object.freeze({
  bytes: 5 * 1024 * 1024,
  rows: 10_000,
  columns: 50,
  fieldCharacters: 20_000,
});

function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let quoteClosed = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        field += character;
      }
      continue;
    }

    if (quoteClosed && character !== ',' && character !== '\n' && character !== '\r') {
      throw new Error('Unexpected text after a quoted CSV field.');
    }
    if (character === '"') {
      if (field.length) throw new Error('A quoted field must start at the beginning of a CSV cell.');
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
      quoteClosed = false;
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      quoteClosed = false;
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('A quoted CSV field is not closed.');
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

/** Parse a bounded comma-separated file with one header row. */
export function parseResearchCsv(input, limits = DATA_LAB_LIMITS) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Choose a non-empty CSV file.');
  if (new TextEncoder().encode(input).byteLength > limits.bytes) throw new Error('The CSV exceeds the 5 MB limit.');

  const rows = parseRows(input.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('The CSV needs a header row and at least one data row.');
  if (rows.length - 1 > limits.rows) throw new Error('The CSV exceeds the 10,000 data-row limit.');

  const headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  if (headers.length > limits.columns) throw new Error('The CSV exceeds the 50-column limit.');
  if (headers.some((header) => header.length > 200)) throw new Error('A column name is too long.');
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  if (new Set(normalizedHeaders).size !== headers.length) throw new Error('Column names must be unique.');

  const data = rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length) throw new Error(`Row ${rowIndex + 2} has a different number of columns.`);
    if (cells.some((cell) => cell.length > limits.fieldCharacters)) throw new Error(`A cell in row ${rowIndex + 2} is too long.`);
    return cells;
  });

  return { headers, rows: data };
}

function numericValue(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

/** Calculate deterministic per-column summaries without modifying the source rows. */
export function summarizeResearchData(dataset) {
  if (!dataset || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) return [];
  return dataset.headers.map((header, columnIndex) => {
    const values = dataset.rows.map((row) => String(row?.[columnIndex] ?? '').trim());
    const present = values.filter(Boolean);
    const numeric = present.map(numericValue);
    const isNumeric = present.length > 0 && numeric.every((value) => value !== null);
    const uniqueCount = new Set(present).size;
    const summary = {
      column: header,
      type: !present.length ? 'empty' : isNumeric ? 'numeric' : 'text',
      rows: values.length,
      missing: values.length - present.length,
      distinct: uniqueCount,
    };

    if (isNumeric) {
      const sorted = [...numeric].sort((a, b) => a - b);
      const mean = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
      const squaredDeviation = numeric.reduce((sum, value) => sum + ((value - mean) ** 2), 0);
      summary.statistics = {
        count: numeric.length,
        mean,
        median: median(sorted),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        sampleStandardDeviation: numeric.length > 1 ? Math.sqrt(squaredDeviation / (numeric.length - 1)) : null,
      };
    }
    return summary;
  });
}

export function getResearchDataChartRows(dataset, column, limit = 1000) {
  const index = dataset?.headers?.indexOf(column) ?? -1;
  if (index < 0 || !Array.isArray(dataset?.rows)) return [];
  return dataset.rows.slice(0, limit).flatMap((row, rowIndex) => {
    const value = numericValue(row?.[index]);
    return value === null ? [] : [{ row: rowIndex + 1, value }];
  });
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  const safe = typeof value !== 'number' && /^[\t ]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportResearchDataSummaryCsv(summaries) {
  const headers = ['Column', 'Type', 'Rows', 'Missing', 'Distinct', 'Count', 'Mean', 'Median', 'Minimum', 'Maximum', 'Sample SD'];
  const rows = (Array.isArray(summaries) ? summaries : []).map((item) => [
    item.column,
    item.type,
    item.rows,
    item.missing,
    item.distinct,
    item.statistics?.count,
    item.statistics?.mean,
    item.statistics?.median,
    item.statistics?.min,
    item.statistics?.max,
    item.statistics?.sampleStandardDeviation,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
