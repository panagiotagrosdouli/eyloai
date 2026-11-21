import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('financial model projects twelve months per scenario and isolates changes in cost and revenue', () => {
  const [header, ...lines] = execFileSync(process.execPath, ['scripts/model-company-finances.mjs'], {
    encoding: 'utf8',
  }).trimEnd().split('\n');
  const columns = header.split(',');
  const rows = lines.map(line => Object.fromEntries(line.split(',').map((value, index) => [columns[index], value])));
  assert.equal(rows.length, 84);
  const month = (scenario, value) => rows.find(row => row.scenario === scenario && Number(row.month) === value);
  const noRevenue = month('no_revenue', 12);
  assert.equal(noRevenue.revenue_eur, '0.00');
  assert.equal(noRevenue.gross_margin_pct, '');
  assert.equal(noRevenue.closing_cash_eur, '4672.00');
  assert.equal(month('early_paid', 4).revenue_eur, '75.00');
  assert.equal(month('team_hiring', 12).first_cash_shortfall_month, '9');
  assert.ok(Number(month('high_ai_usage', 12).direct_cost_eur) > Number(month('early_paid', 12).direct_cost_eur));
});
