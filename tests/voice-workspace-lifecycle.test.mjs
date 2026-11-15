import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice recognition releases microphone and speech on unmount', async () => {
  const page = await readFile(new URL('../src/pages/VoiceAssistant.jsx', import.meta.url), 'utf8');
  assert.match(page, /useEffect\(\(\) => \{/);
  assert.match(page, /recognition\.onresult = null/);
  assert.match(page, /recognition\.onerror = null/);
  assert.match(page, /recognition\.onend = null/);
  assert.match(page, /recognition\.abort\(\)/);
  assert.match(page, /window\.speechSynthesis\?\.cancel\(\)/);
});

test('voice recognition startup and shutdown errors are visible and retryable', async () => {
  const page = await readFile(new URL('../src/pages/VoiceAssistant.jsx', import.meta.url), 'utf8');
  assert.match(page, /if \(recognitionRef\.current\) return/);
  assert.match(page, /try \{[\s\S]*?recognition\.start\(\)[\s\S]*?\} catch \{/);
  assert.match(page, /Microphone permission was denied/);
  assert.match(page, /Could not start microphone recognition/);
  assert.match(page, /try \{ recognition\.stop\(\); \}/);
  assert.match(page, /aria-label="Voice research question"/);
});
