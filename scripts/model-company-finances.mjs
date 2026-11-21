import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? new URL('../docs/company-financial-assumptions.json', import.meta.url);
const { baseline, scenarios } = JSON.parse(readFileSync(path, 'utf8'));
const fields = [
  'openingCash', 'netPrice', 'monthlyAdds', 'salesStartMonth', 'churn', 'freeUsers',
  'freeAiCost', 'paidAiCost', 'storagePerUser', 'providerFixed', 'hosting', 'supportHours',
  'supportRate', 'paymentRate', 'paymentFixed', 'acquisition', 'overhead',
  'hiringStartMonth', 'payroll', 'scaleStartMonth', 'scaleCost',
];

const columns = ['scenario', 'month', 'paid_accounts_expected', 'revenue_eur', 'direct_cost_eur',
  'gross_margin_pct', 'operating_cost_eur', 'total_expense_eur', 'net_cash_burn_eur', 'closing_cash_eur',
  'first_cash_shortfall_month', 'cac_eur', 'static_break_even_paid_accounts'];
const rows = [columns.join(',')];
const money = value => value.toFixed(2);

for (const [scenario, overrides] of Object.entries(scenarios)) {
  if (!/^[a-z][a-z0-9_-]+$/.test(scenario)) throw new Error('Invalid scenario name');
  const a = { ...baseline, ...overrides };
  for (const field of fields) {
    if (!Number.isFinite(a[field]) || a[field] < 0) throw new Error(`Invalid input: ${field}`);
  }
  if (a.churn > 1 || a.paymentRate > 1) throw new Error('Rates must be between zero and one');
  for (const field of ['salesStartMonth', 'hiringStartMonth', 'scaleStartMonth']) {
    if (!Number.isInteger(a[field]) || a[field] < 1 || a[field] > 13) throw new Error(`Invalid month: ${field}`);
  }
  let paid = 0;
  let cash = a.openingCash;
  let shortfall = '';
  const scenarioRows = [];
  for (let month = 1; month <= 12; month++) {
    const adds = month >= a.salesStartMonth ? a.monthlyAdds : 0;
    paid = paid * (1 - a.churn) + adds;
    const revenue = paid * a.netPrice;
    const unitCost = a.paidAiCost + a.storagePerUser + a.netPrice * a.paymentRate + a.paymentFixed;
    const fixedDirect = a.freeUsers * (a.freeAiCost + a.storagePerUser) + a.providerFixed +
      a.hosting + a.supportHours * a.supportRate + (month >= a.scaleStartMonth ? a.scaleCost : 0);
    const direct = fixedDirect + paid * unitCost;
    const operating = a.acquisition + a.overhead + (month >= a.hiringStartMonth ? a.payroll : 0);
    const burn = direct + operating - revenue;
    cash -= burn;
    if (cash < 0 && !shortfall) shortfall = month;
    const breakEven = a.netPrice > unitCost
      ? Math.ceil((fixedDirect + operating) / (a.netPrice - unitCost))
      : '';
    scenarioRows.push([scenario, month, money(paid), money(revenue), money(direct),
      revenue ? money(100 * (revenue - direct) / revenue) : '', money(operating),
      money(direct + operating), money(burn), money(cash), '', adds ? money(a.acquisition / adds) : '', breakEven]);
  }
  for (const row of scenarioRows) {
    row[10] = shortfall;
    rows.push(row.join(','));
  }
}
console.log(rows.join('\n'));
