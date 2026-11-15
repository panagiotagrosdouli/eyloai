// Lab-only UX measurements. Never infer real-user Core Web Vitals from this
// route smoke test, and never invent an unsupported/absent measurement.
const finiteNonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function percentile(values, fraction) {
  if (!Array.isArray(values) || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
  const usable = values.filter(finiteNonnegative).sort((a, b) => a - b);
  if (!usable.length) return null;
  const position = (usable.length - 1) * fraction;
  const bottom = Math.floor(position), top = Math.ceil(position);
  return usable[bottom] + (usable[top] - usable[bottom]) * (position - bottom);
}

export function summarizeUxObservations(observations) {
  if (!Array.isArray(observations)) return { samples: 0, routes: [] };
  const byRoute = new Map();
  for (const item of observations) {
    if (!item || typeof item.route !== 'string' || !item.route.startsWith('/')) continue;
    if (!byRoute.has(item.route)) byRoute.set(item.route, []);
    byRoute.get(item.route).push(item);
  }
  const metrics = ['navigationMs', 'domContentLoadedMs', 'lcpMs', 'cls', 'inpMs'];
  return {
    mode: 'synthetic authenticated smoke; not field Core Web Vitals',
    samples: [...byRoute.values()].reduce((sum, rows) => sum + rows.length, 0),
    routes: [...byRoute.entries()].map(([route, rows]) => ({
      route,
      samples: rows.length,
      viewportWidths: [...new Set(rows.map(row => row.width))].sort((a, b) => a - b),
      browserErrors: rows.reduce((sum, row) => sum + (Array.isArray(row.pageErrors) ? row.pageErrors.length : 0), 0),
      metrics: Object.fromEntries(metrics.map(metric => {
        const values = rows.map(row => row[metric]).filter(finiteNonnegative);
        return [metric, {
          observed: values.length,
          unavailable: rows.length - values.length,
          median: percentile(values, 0.5),
          p75: percentile(values, 0.75),
        }];
      })),
    })),
  };
}
