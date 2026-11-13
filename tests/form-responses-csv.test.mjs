import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchRecord, formResponsesCsv } from '../src/lib/product-workbench.mjs';
const id = '00000000-0000-4000-8000-000000000001';
function form() {
  const record = createWorkbenchRecord('forms',id);
  return {...record,title:'Survey',definition:'Name | text | required\nCount | number | optional',responses:[]};
}
test('form CSV exports stable response IDs, quoted labels and multiline answers, escaping formulas', () => {
  const record=form();
  record.responses=[{id,definition:record.definition,answers:{field_0:'=HYPERLINK("evil")\nnext, line',field_1:'-2'}}];
  const csv=formResponsesCsv(record);
  assert.ok(csv.startsWith('"Response ID","Name","Count"\r\n'));
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")\nnext, line"'));
  assert.ok(csv.includes('"\'-2"'));
  assert.equal(formResponsesCsv(form()),'"Response ID","Name","Count"\r\n');
});
test('form CSV fails on changed definitions, missing required answers or invalid date/number', () => {
  const record=form();
  record.responses=[{id,definition:'Changed',answers:{field_0:'a'}}];
  assert.throws(()=>formResponsesCsv(record),/unchanged definition/);
  record.responses[0].definition=record.definition;
  record.responses[0].answers={field_0:'a',field_1:'NaN'};
  assert.throws(()=>formResponsesCsv(record),/must be a number/);
});
