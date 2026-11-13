export const BUDGET_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD'];
export const BUDGET_CATEGORIES = ['staff', 'equipment', 'travel', 'consumables', 'publication', 'other'];
export const BUDGET_STATUSES = ['planned', 'committed', 'paid', 'cancelled'];
export const blankBudget = () => ({ version: 1, currency: 'EUR', allocation: '0.00', lines: [] });
export const blankBudgetLine = () => ({ id: crypto.randomUUID(), title: '', category: 'other', planned: '0.00', actual: '0.00', status: 'planned', notes: '' });
export function moneyToMinor(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value)) throw new Error('Amounts must be nonnegative decimals with at most two decimal places (maximum 999999999.99).');
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function minorToMoney(value) {
  if (!Number.isSafeInteger(value)) throw new Error('Amount exceeds the supported budget.');
  return `${value < 0 ? '-' : ''}${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, '0')}`;
}
export function validateBudget(budget) {
  if (!budget || budget.version !== 1 || !BUDGET_CURRENCIES.includes(budget.currency) || !Array.isArray(budget.lines) || budget.lines.length > 100) throw new Error('Unsupported budget format, currency or line limit.');
  moneyToMinor(budget.allocation); const seen = new Set();
  for (const row of budget.lines) {
    if (!row || typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id) || seen.has(row.id)) throw new Error('Each budget line needs a unique identifier.');
    seen.add(row.id);
    if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 160 || typeof row.notes !== 'string' || row.notes.length > 2000 || !BUDGET_CATEGORIES.includes(row.category) || !BUDGET_STATUSES.includes(row.status)) throw new Error('Each line needs a title, supported category/status and bounded notes.');
    moneyToMinor(row.planned); moneyToMinor(row.actual);
    if (row.status === 'cancelled' && moneyToMinor(row.actual) !== 0) throw new Error('A cancelled line must have zero actual cost; keep incurred costs in an active line.');
  }
  if (new TextEncoder().encode(JSON.stringify(budget)).length > 262144) throw new Error('Budget exceeds the 256 KiB workspace limit.');
  return budget;
}
export function readBudget(project) { return validateBudget(project.research_budget ?? blankBudget()); }
export function budgetPatch(project, budget) {
  const before = readBudget(project); validateBudget(budget);
  if (before.currency !== budget.currency && before.lines.length) throw new Error('Currency cannot change while saved budget lines exist. Export and remove those lines first; no exchange conversion is performed.');
  return { research_budget: budget };
}
export function budgetTotals(budget) {
  validateBudget(budget);
  const byCategory = Object.fromEntries(BUDGET_CATEGORIES.map(key => [key, { planned: 0, actual: 0 }]));
  let planned = 0, actual = 0;
  for (const row of budget.lines.filter(row => row.status !== 'cancelled')) {
    const p = moneyToMinor(row.planned), a = moneyToMinor(row.actual);
    planned += p; actual += a; byCategory[row.category].planned += p; byCategory[row.category].actual += a;
  }
  return { planned, actual, remaining: moneyToMinor(budget.allocation) - actual, variance: planned - actual, byCategory };
}
const csvCell = value => {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@\t\r-]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function budgetCsv(budget) {
  validateBudget(budget);
  return [['Title', 'Category', 'Status', 'Currency', 'Planned', 'Actual', 'Notes'], ...budget.lines.map(row => [row.title, row.category, row.status, budget.currency, minorToMoney(moneyToMinor(row.planned)), minorToMoney(moneyToMinor(row.actual)), row.notes])].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function budgetComparison(budget) {
  const totals = budgetTotals(budget);
  return [`Currency: ${budget.currency}; allocation: ${budget.allocation}`, `Active planned: ${minorToMoney(totals.planned)}; actual: ${minorToMoney(totals.actual)}`, ...budget.lines.map(row => `${row.title} | ${row.category} | ${row.status} | planned ${row.planned}, actual ${row.actual}\n${row.notes}`)].join('\n\n');
}
