import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArxivFeed } from '../src/lib/arxiv-feed.js';

test('parses arXiv Atom entries in Node and decodes XML entities', () => {
  const feed = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>https://arxiv.org/abs/2601.01234v1</id>
        <published>2026-01-10T00:00:00Z</published>
        <title>AI &amp; science &#x2014; an &lt;open&gt; study</title>
        <author><name>Ada Lovelace</name></author>
        <author><name>Grace Hopper</name></author>
        <summary>Models &amp; methods for &#x03B1; research.</summary>
      </entry>
    </feed>`;

  assert.deepEqual(parseArxivFeed(feed), [{
    id: 'https://arxiv.org/abs/2601.01234v1',
    title: 'AI & science — an <open> study',
    authors: ['Ada Lovelace', 'Grace Hopper'],
    summary: 'Models & methods for α research.',
    published: '2026-01-10T00:00:00Z',
  }]);
});

test('returns no entries for a valid Atom feed with no papers', () => {
  assert.deepEqual(parseArxivFeed('<feed><title>Empty</title></feed>'), []);
});
