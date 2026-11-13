import test from 'node:test';
import assert from 'node:assert/strict';
import { blankBudget, blankBudgetLine, moneyToMinor, minorToMoney, validateBudget, readBudget, budgetPatch, budgetTotals, budgetCsv } from '../src/lib/project-budget.mjs';
const line = patch => ({ ...blankBudgetLine(), title: 'Travel', ...patch });
test('budget arithmetic uses exact cents, including overspend, categories and cancelled lines', () => {
 const budget = { ...blankBudget(), allocation: '0.25', lines: [line({ planned: '0.10', actual: '0.20', category: 'travel' }), line({ planned: '0.20', actual: '0.10', category: 'staff' }), line({ planned: '100', actual: '0', status: 'cancelled' })] };
 const totals = budgetTotals(budget);
 assert.equal(totals.planned, 30); assert.equal(totals.actual, 30); assert.equal(totals.remaining, -5);
 assert.equal(minorToMoney(totals.remaining), '-0.05'); assert.deepEqual(totals.byCategory.travel, { planned: 10, actual: 20 });
 assert.equal(moneyToMinor('999999999.99'), 99999999999);
});
test('invalid decimal formats, malformed records and duplicate lines fail closed', () => {
 for (const value of ['1.001', '-1', '1e3', 'NaN', '', ' 1', '1,20', '01', '1000000000', 5, null]) assert.throws(() => moneyToMinor(value));
 const row = line();
 for (const patch of [{ currency: 'JPY' }, { version: 2 }, { lines: [row,row] }, { lines: [line({ status: 'cancelled', actual: '1' })] }, { lines: [line({ notes: 'x'.repeat(2001) })] }, { lines: Array.from({ length: 101 }, () => line()) }]) assert.throws(() => validateBudget({ ...blankBudget(), ...patch }));
 assert.throws(() => readBudget({ research_budget: false }));
});
test('currency changes require removing saved lines; patch preserves unrelated project fields', () => {
 const project = { research_budget: { ...blankBudget(), lines: [line()] }, title: 'Keep' };
 assert.throws(() => budgetPatch(project, { ...project.research_budget, currency: 'USD' }), /Currency cannot change/);
 assert.deepEqual(Object.keys(budgetPatch(project, project.research_budget)), ['research_budget']);
 assert.equal(project.title, 'Keep');
 assert.equal(budgetPatch({}, { ...blankBudget(), currency: 'USD' }).research_budget.currency, 'USD');
});
test('CSV escapes formulas, quotes and newlines and retains exact monetary decimals', () => {
 const csv = budgetCsv({ ...blankBudget(), lines: [line({ title: '\t=HYPERLINK("https://example.org")', notes: 'line1\nline2', planned: '0.1', actual: '0.2' })] });
 assert.ok(csv.includes('"\'\t=HYPERLINK(""https://example.org"")"'));
 assert.ok(csv.includes('"0.10","0.20"')); assert.ok(csv.includes('"line1\nline2"'));
});
