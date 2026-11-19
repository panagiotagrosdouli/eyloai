import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPitchDeckEvidenceReferences } from '../src/lib/pitch-deck-evidence.mjs';

const slides = () => Array.from({ length: 10 }, (_, i) => ({
  title: 'Slide ' + (i + 1),
  headline: 'Evidence and hypothesis',
  bullets: ['Evaluate this assumption before relying on it'],
  evidence_ids: [],
  speaker_notes: 'No measured results are claimed here',
}));

test('ten slide deck with grounded source IDs is accepted', () => {
  const pages = slides();
  pages[2].bullets = ['Retrieved record [P1] concerns this topic'];
  pages[2].evidence_ids = ['P1'];
  pages[8].bullets = ['Official call [F1] requires eligibility verification'];
  pages[8].evidence_ids = ['F1'];
  const deck = { slides: pages };
  assert.equal(assertPitchDeckEvidenceReferences(deck, [{}], [{}]), deck);
});

test('fabricated citations in speaker notes, bullets, or evidence list are rejected', () => {
  const fakeManifest = slides(); fakeManifest[1].evidence_ids = ['P99'];
  assert.throws(() => assertPitchDeckEvidenceReferences({ slides: fakeManifest }, [{}], []), /does not exist/);
  const fakeBullet = slides(); fakeBullet[1].bullets = ['Unfounded source [P2]'];
  assert.throws(() => assertPitchDeckEvidenceReferences({ slides: fakeBullet }, [{}], []), /does not exist/);
  const unlisted = slides(); unlisted[1].speaker_notes = 'See [F1]';
  assert.throws(() => assertPitchDeckEvidenceReferences({ slides: unlisted }, [], [{}]), /missing from the slide evidence list/);
});

test('ten complete slides are required; generated references cannot imply verification', () => {
  assert.throws(() => assertPitchDeckEvidenceReferences({ slides: slides().slice(0, 9) }, [], []), /exactly ten/);
  assert.throws(() => assertPitchDeckEvidenceReferences({ slides: [{ title: 'T' }] }, [], []), /exactly ten/);
});
