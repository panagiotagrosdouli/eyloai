export const DATA_LAB_LIMITS = Object.freeze({
  bytes: 5 * 1024 * 1024,
  rows: 10_000,
  columns: 50,
  fieldCharacters: 20_000,
});

export const DATA_LAB_DISCLOSURE_THRESHOLDS = Object.freeze([1, 3, 5, 10]);
export const DATA_LAB_DEFAULT_MINIMUM_CELL_SIZE = 5;
const DATA_LAB_SCATTER_LIMIT = 500;

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
    : midpoint(sortedValues[middle - 1], sortedValues[middle]);
}

function midpoint(first, second) {
  if ((first < 0) !== (second < 0)) return (first + second) / 2;
  return first + ((second - first) / 2);
}

function numericMoments(values) {
  if (!values.length) return { mean: null, sampleStandardDeviation: null };
  const scale = Math.max(...values.map(Math.abs)) || 1;
  let meanScaled = 0;
  let sumSquares = 0;
  values.forEach((value, index) => {
    const scaled = value / scale;
    const delta = scaled - meanScaled;
    meanScaled += delta / (index + 1);
    sumSquares += delta * (scaled - meanScaled);
  });
  const mean = Math.max(-1, Math.min(1, meanScaled)) * scale;
  const scaledDeviation = values.length > 1 ? Math.sqrt(Math.max(0, sumSquares / (values.length - 1))) : null;
  const sampleStandardDeviation = scaledDeviation === null ? null : scaledDeviation * scale;
  return {
    mean: Number.isFinite(mean) ? mean : null,
    sampleStandardDeviation: Number.isFinite(sampleStandardDeviation) ? sampleStandardDeviation : null,
  };
}

function disclosureThreshold(value = 1) {
  const threshold = Number(value);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > DATA_LAB_LIMITS.rows) {
    throw new Error('The minimum cell size must be a whole number from 1 to 10,000.');
  }
  return threshold;
}

/** Calculate deterministic per-column summaries without modifying the source rows. */
export function summarizeResearchData(dataset, options = {}) {
  if (!dataset || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) return [];
  const minimumCellSize = disclosureThreshold(options.minimumCellSize);
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
      const sorted = [...numeric].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      summary.statisticsSuppressed = numeric.length < minimumCellSize;
      summary.minimumCellSize = minimumCellSize;
      const moments = numericMoments(numeric);
      summary.statistics = summary.statisticsSuppressed ? null : {
        count: numeric.length,
        mean: moments.mean,
        median: median(sorted),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        sampleStandardDeviation: moments.sampleStandardDeviation,
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

function hashText(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicScatterSample(pairs, limit) {
  if (pairs.length <= limit) return [...pairs];
  const duplicateOccurrences = new Map();
  const ranked = pairs.map((pair) => {
    const pairKey = `${pair.first}\u0000${pair.second}`;
    const occurrence = duplicateOccurrences.get(pairKey) || 0;
    duplicateOccurrences.set(pairKey, occurrence + 1);
    const samplingKey = `${pairKey}\u0000${occurrence}`;
    return { pair, samplingKey, priority: hashText(samplingKey) };
  });
  return ranked
    .sort((left, right) => left.priority - right.priority
      || left.samplingKey.localeCompare(right.samplingKey)
      || left.pair.row - right.pair.row)
    .slice(0, limit)
    .map(({ pair }) => pair)
    .sort((left, right) => left.row - right.row);
}

/** Compare two numeric columns using complete pairs and descriptive Pearson r. */
export function compareResearchNumericColumns(dataset, firstColumn, secondColumn, options = {}) {
  const minimumCellSize = disclosureThreshold(options.minimumCellSize ?? DATA_LAB_DEFAULT_MINIMUM_CELL_SIZE);
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

  const requiredPairs = Math.max(3, minimumCellSize);
  if (pairs.length < requiredPairs) {
    return {
      available: false,
      reason: `At least ${requiredPairs} complete numeric pairs are needed at the selected disclosure threshold.`,
      pairs: pairs.length,
      incomplete,
      minimumCellSize,
    };
  }

  // Pearson r is unchanged by scaling each variable independently. Scaling
  // first keeps the online covariance calculation finite for large CSV values.
  const firstMin = pairs.reduce((min, pair) => Math.min(min, pair.first), Infinity);
  const firstMax = pairs.reduce((max, pair) => Math.max(max, pair.first), -Infinity);
  const secondMin = pairs.reduce((min, pair) => Math.min(min, pair.second), Infinity);
  const secondMax = pairs.reduce((max, pair) => Math.max(max, pair.second), -Infinity);
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
      minimumCellSize,
    };
  }

  const pearsonR = Math.max(-1, Math.min(1, coMoment / denominator));
  const plotLimit = DATA_LAB_SCATTER_LIMIT;
  const firstLow = firstMin / firstScale;
  const firstRange = firstMax / firstScale - firstLow || 1;
  const secondLow = secondMin / secondScale;
  const secondRange = secondMax / secondScale - secondLow || 1;
  const sampledPairs = deterministicScatterSample(pairs, plotLimit);
  const scatterSample = sampledPairs.map((point) => {
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
    minimumCellSize,
    scatterSampleSize: scatterSample.length,
    scatterLimit: plotLimit,
    samplingMethod: pairs.length <= plotLimit ? 'all complete pairs' : 'deterministic value-hash priority sample',
    firstMin,
    firstMax,
    secondMin,
    secondMax,
    scatterSample,
    pearsonR: Number.isFinite(pearsonR) ? pearsonR : null,
  };
}

/** Describe one numeric variable within observed categories; no group test is performed. */
export function summarizeResearchNumericByCategory(dataset, numericColumn, categoryColumn, options = {}) {
  const minimumGroupSize = disclosureThreshold(options.minimumGroupSize ?? DATA_LAB_DEFAULT_MINIMUM_CELL_SIZE);
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
      const moments = numericMoments(values);
      const sorted = [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[middle] : midpoint(sorted[middle - 1], sorted[middle]);
      return {
        category,
        count: values.length,
        mean: moments.mean,
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        sampleStandardDeviation: moments.sampleStandardDeviation,
      };
    })
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));

  const suppressedGroups = allGroups.some((group) => group.count < minimumGroupSize);
  const publishableGroups = allGroups.filter((group) => group.count >= minimumGroupSize);
  const limit = 50;
  const displayedGroups = publishableGroups.slice(0, limit);
  const groupsTruncated = publishableGroups.length > limit;
  return {
    available: complete > 0,
    kind: 'numeric-by-category',
    numericColumn,
    categoryColumn,
    pairs: suppressedGroups ? null : complete,
    incomplete: suppressedGroups ? null : rows.length - complete,
    minimumGroupSize,
    totalGroups: suppressedGroups ? null : allGroups.length,
    omittedGroups: suppressedGroups ? null : Math.max(0, allGroups.length - displayedGroups.length),
    omittedObservations: suppressedGroups ? null : allGroups.slice(limit).reduce((sum, group) => sum + group.count, 0),
    hasSuppressedGroups: suppressedGroups,
    groupsTruncated,
    groups: displayedGroups,
    reason: displayedGroups.length ? undefined : suppressedGroups
      ? `All observed groups are below the selected minimum size (k=${minimumGroupSize}) and are suppressed.`
      : 'No complete numeric-category observations are available.',
  };
}

/** Export comparison metadata and aggregates only; never export source rows. */
export function exportResearchDataComparisonCsv(comparison) {
  let rows = [['Statistic', 'Value']];
  if (comparison?.available && comparison.kind === 'pearson-correlation') {
    rows.push(
      ['Variable 1', comparison.firstColumn],
      ['Variable 2', comparison.secondColumn],
      ['Pearson correlation (r)', comparison.pearsonR],
      ['Complete pairs used', comparison.pairs],
      ['Rows skipped', comparison.incomplete],
      ['Minimum complete pairs (k)', comparison.minimumCellSize],
      ['Scatter observations displayed', comparison.scatterSampleSize],
      ['Scatter sampling method', comparison.samplingMethod],
      ['Scope', 'Descriptive within-file linear association; no p-value, population inference, or causal claim'],
    );
  } else if (comparison?.available && comparison.kind === 'numeric-by-category') {
    rows = [['Statistic', 'Value', '', '', '', '', '']];
    const metadata = [
      ['Numeric variable', comparison.numericColumn],
      ['Categorical variable', comparison.categoryColumn],
      ['Complete observations used', comparison.pairs],
      ['Rows skipped', comparison.incomplete],
      ['Minimum group size (k)', comparison.minimumGroupSize],
      ['Small groups suppressed', comparison.hasSuppressedGroups ? 'Yes' : 'No'],
      ...(comparison.totalGroups == null ? [] : [['Categories in file', comparison.totalGroups]]),
      ['Categories included in table', comparison.groups.length],
      ['Scope', 'Descriptive group summaries only; no group test, population inference, or causal claim. Aggregate output does not guarantee anonymity.'],
    ];
    rows.push(...metadata.map((row) => [...row, '', '', '', '', '']), ['', '', '', '', '', '', '']);
    rows.push(
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
  const headers = ['Column', 'Type', 'Minimum cell size (k)', 'Disclosure', 'Rows', 'Missing', 'Distinct', 'Count', 'Mean', 'Median', 'Minimum', 'Maximum', 'Sample SD'];
  const rows = (Array.isArray(summaries) ? summaries : []).map((item) => [
    item.column,
    item.type,
    item.minimumCellSize,
    item.statisticsSuppressed ? 'Suppressed: below minimum cell size' : 'Not suppressed',
    item.statisticsSuppressed ? '' : item.rows,
    item.statisticsSuppressed ? '' : item.missing,
    item.statisticsSuppressed ? '' : item.distinct,
    item.statistics?.count,
    item.statistics?.mean,
    item.statistics?.median,
    item.statistics?.min,
    item.statistics?.max,
    item.statistics?.sampleStandardDeviation,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
