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

/** Compare two numeric columns using complete pairs and descriptive Pearson r. */
export function compareResearchNumericColumns(dataset, firstColumn, secondColumn) {
  const headers = Array.isArray(dataset?.headers) ? dataset.headers : [];
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const firstIndex = headers.indexOf(firstColumn);
  const secondIndex = headers.indexOf(secondColumn);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) {
    return { available: false, reason: 'Choose two different numeric columns.' };
  }

  const pairs = [];
  let incomplete = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const first = numericValue(row?.[firstIndex]);
    const second = numericValue(row?.[secondIndex]);
    if (first === null || second === null) {
      incomplete += 1;
      continue;
    }
    pairs.push({ first, second, row: rowIndex + 1 });
  }

  if (pairs.length < 3) {
    return {
      available: false,
      reason: 'At least three complete numeric pairs are needed for a descriptive correlation.',
      pairs: pairs.length,
      incomplete,
    };
  }

  // Pearson r is unchanged by scaling each variable independently. Scaling
  // first keeps the online covariance calculation finite for large CSV values.
  const firstMin = Math.min(...pairs.map(({ first }) => first));
  const firstMax = Math.max(...pairs.map(({ first }) => first));
  const secondMin = Math.min(...pairs.map(({ second }) => second));
  const secondMax = Math.max(...pairs.map(({ second }) => second));
  const firstScale = Math.max(Math.abs(firstMin), Math.abs(firstMax)) || 1;
  const secondScale = Math.max(Math.abs(secondMin), Math.abs(secondMax)) || 1;
  let firstMean = 0;
  let secondMean = 0;
  let firstSquares = 0;
  let secondSquares = 0;
  let coMoment = 0;
  pairs.forEach(({ first, second }, index) => {
    const count = index + 1;
    const scaledFirst = first / firstScale;
    const scaledSecond = second / secondScale;
    const firstDelta = scaledFirst - firstMean;
    const secondDelta = scaledSecond - secondMean;
    firstMean += firstDelta / count;
    secondMean += secondDelta / count;
    firstSquares += firstDelta * (scaledFirst - firstMean);
    secondSquares += secondDelta * (scaledSecond - secondMean);
    coMoment += firstDelta * (scaledSecond - secondMean);
  });

  const denominator = Math.sqrt(firstSquares * secondSquares);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return {
      available: false,
      reason: 'Correlation is undefined when either column has no variation among complete pairs.',
      pairs: pairs.length,
      incomplete,
    };
  }

  const pearsonR = Math.max(-1, Math.min(1, coMoment / denominator));
  const plotLimit = 500;
  const plotCount = Math.min(pairs.length, plotLimit);
  const firstLow = firstMin / firstScale;
  const firstRange = firstMax / firstScale - firstLow || 1;
  const secondLow = secondMin / secondScale;
  const secondRange = secondMax / secondScale - secondLow || 1;
  const scatterSample = Array.from({ length: plotCount }, (_, index) => {
    const sampleIndex = plotCount === 1 ? 0 : Math.round(index * (pairs.length - 1) / (plotCount - 1));
    const point = pairs[sampleIndex];
    return {
      ...point,
      xPosition: Math.max(0, Math.min(1, ((point.first / firstScale) - firstLow) / firstRange)),
      yPosition: Math.max(0, Math.min(1, ((point.second / secondScale) - secondLow) / secondRange)),
    };
  });
  return {
    available: Number.isFinite(pearsonR),
    kind: 'pearson-correlation',
    firstColumn,
    secondColumn,
    pairs: pairs.length,
    incomplete,
    firstMin,
    firstMax,
    secondMin,
    secondMax,
    scatterSample,
    pearsonR: Number.isFinite(pearsonR) ? pearsonR : null,
  };
}

/** Describe one numeric variable within observed categories; no group test is performed. */
export function summarizeResearchNumericByCategory(dataset, numericColumn, categoryColumn) {
  const headers = Array.isArray(dataset?.headers) ? dataset.headers : [];
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const numericIndex = headers.indexOf(numericColumn);
  const categoryIndex = headers.indexOf(categoryColumn);
  const types = summarizeResearchData(dataset).map((summary) => summary.type);
  if (numericIndex < 0 || categoryIndex < 0 || numericIndex === categoryIndex
    || types[numericIndex] !== 'numeric' || types[categoryIndex] !== 'text') {
    return { available: false, reason: 'Choose one numeric variable and one categorical variable.' };
  }

  const groups = new Map();
  let complete = 0;
  for (const row of rows) {
    const value = numericValue(row?.[numericIndex]);
    const category = String(row?.[categoryIndex] ?? '').trim();
    if (value === null || !category) continue;
    complete += 1;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(value);
  }

  const allGroups = [...groups.entries()]
    .map(([category, values]) => {
      const scale = Math.max(...values.map(Math.abs)) || 1;
      let meanScaled = 0;
      let squaredDeviations = 0;
      values.forEach((value, index) => {
        const scaled = value / scale;
        const delta = scaled - meanScaled;
        meanScaled += delta / (index + 1);
        squaredDeviations += delta * (scaled - meanScaled);
      });
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] / 2) + (sorted[middle] / 2);
      const mean = meanScaled * scale;
      const sampleStandardDeviation = values.length > 1
        ? Math.sqrt(squaredDeviations / (values.length - 1)) * scale
        : null;
      return {
        category,
        count: values.length,
        mean: Number.isFinite(mean) ? mean : null,
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        sampleStandardDeviation: Number.isFinite(sampleStandardDeviation) ? sampleStandardDeviation : null,
      };
    })
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));

  const limit = 50;
  const displayedGroups = allGroups.slice(0, limit);
  return {
    available: displayedGroups.length > 0,
    kind: 'numeric-by-category',
    numericColumn,
    categoryColumn,
    pairs: complete,
    incomplete: rows.length - complete,
    totalGroups: allGroups.length,
    omittedGroups: Math.max(0, allGroups.length - displayedGroups.length),
    omittedObservations: allGroups.slice(limit).reduce((sum, group) => sum + group.count, 0),
    groups: displayedGroups,
    reason: displayedGroups.length ? undefined : 'No complete numeric-category observations are available.',
  };
}

/** Export comparison metadata and aggregates only; never export source rows. */
export function exportResearchDataComparisonCsv(comparison) {
  const rows = [['Statistic', 'Value']];
  if (comparison?.available && comparison.kind === 'pearson-correlation') {
    rows.push(
      ['Variable 1', comparison.firstColumn],
      ['Variable 2', comparison.secondColumn],
      ['Pearson correlation (r)', comparison.pearsonR],
      ['Complete pairs used', comparison.pairs],
      ['Rows skipped', comparison.incomplete],
      ['Scope', 'Descriptive pairwise linear association; no causal or statistical significance claim'],
    );
  } else if (comparison?.available && comparison.kind === 'numeric-by-category') {
    rows.push(
      ['Numeric variable', comparison.numericColumn],
      ['Categorical variable', comparison.categoryColumn],
      ['Complete observations used', comparison.pairs],
      ['Rows skipped', comparison.incomplete],
      ['Categories in file', comparison.totalGroups],
      ['Categories included in table', comparison.groups.length],
      ['Scope', 'Descriptive group summaries only; no statistical test or causal claim'],
      [],
      ['Category', 'Count', 'Mean', 'Median', 'Sample SD', 'Minimum', 'Maximum'],
      ...comparison.groups.map((group) => [group.category, group.count, group.mean, group.median, group.sampleStandardDeviation, group.min, group.max]),
    );
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
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
