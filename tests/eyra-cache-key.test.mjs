import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEyraCacheKey } from '../src/lib/eyra-cache-key.mjs';

const date = new Date('2026-11-05T12:00:00Z');

test('personal EYRA cache keys are isolated by user', () => {
  const first = makeEyraCacheKey('monitor', 'user-a', { projects: ['a'] }, date);
  const second = makeEyraCacheKey('monitor', 'user-b', { projects: ['a'] }, date);
  assert.notEqual(first, second);
});

test('personal EYRA cache keys change when context changes', () => {
  assert.notEqual(
    makeEyraCacheKey('mission', 'user-a', { projects: ['a'] }, date),
    makeEyraCacheKey('mission', 'user-a', { projects: ['b'] }, date),
  );
});

test('personal EYRA cache keys are isolated by namespace and UTC day', () => {
  assert.notEqual(
    makeEyraCacheKey('monitor', 'user-a', {}, date),
    makeEyraCacheKey('analysis', 'user-a', {}, date),
  );
  assert.notEqual(
    makeEyraCacheKey('monitor', 'user-a', {}, date),
    makeEyraCacheKey('monitor', 'user-a', {}, new Date('2026-11-06T12:00:00Z')),
  );
});

test('personal EYRA cache keys reject an absent user identity', () => {
  assert.throws(() => makeEyraCacheKey('mission', '', {}, date), /user ID/);
});
