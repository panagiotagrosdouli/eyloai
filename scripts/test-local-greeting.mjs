import assert from 'node:assert/strict';
import { getLocalGreeting } from '../src/lib/local-greeting.js';

const cases = [
  [8, 'Good morning, Alex.'],
  [14, 'Good afternoon, Alex.'],
  [19, 'Good evening, Alex.'],
  [2, 'Hello, Alex.'],
];

for (const [hour, expectedGreeting] of cases) {
  const localDate = new Date(2026, 0, 2, hour, 15);
  const result = getLocalGreeting('Alex Morgan', localDate);
  assert.equal(result.greeting, expectedGreeting);
  assert.ok(result.question.endsWith('?'));
  assert.ok(result.localTime);
  assert.ok(result.place);
}

assert.equal(getLocalGreeting('', new Date(2026, 0, 2, 8)).greeting, 'Good morning.');
console.log('Local-time greeting regression test passed.');
