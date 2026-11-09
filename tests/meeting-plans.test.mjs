import test from 'node:test';
import assert from 'node:assert/strict';
import moment from 'moment';

import { upcomingMeetingPlans } from '../src/lib/meeting-plans.mjs';

test('upcoming meeting plans exclude invalid and past dates and sort the next three chronologically', () => {
  const meetings = [
    { id: 'later', date: '2026-11-12' },
    { id: 'tomorrow', date: '2026-11-10' },
    { id: 'today', date: '2026-11-09' },
    { id: 'past', date: '2026-11-08' },
    { id: 'invalid', date: 'not-a-date' },
    { id: 'farthest', date: '2026-11-15' },
  ];

  assert.deepEqual(
    upcomingMeetingPlans(meetings, moment('2026-11-09T12:00:00')).map(meeting => meeting.id),
    ['today', 'tomorrow', 'later'],
  );
});

test('upcoming meeting plans tolerate missing collections', () => {
  assert.deepEqual(upcomingMeetingPlans(null, moment('2026-11-09')), []);
});
