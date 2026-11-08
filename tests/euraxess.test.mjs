import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/euraxess.js';

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

const currentEuraxessMarkup = `
  <ul aria-label="Search results items">
    <li>
      <div id="job-teaser-content">
        <div class="label-thumbnail-wrapper">
          <ul>
            <li class="ecl-content-block__label-item"><span>JOB</span></li>
            <li class="ecl-content-block__label-item"><span>France</span></li>
          </ul>
        </div>
        <article>
          <ul>
            <li><a href="/partnering/organisations/profile/cnrs">CNRS</a></li>
            <li>Posted on: 7 November 2026</li>
          </ul>
          <h3><a href="/jobs/478694"><span>PhD position: Climate resilience</span></a></h3>
          <div class="ecl-content-block__description"><p>Research on climate adaptation.</p></div>
        </article>
      </div>
    </li>
  </ul>`;

test('EURAXESS parser accepts its current id-based result wrapper', async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async url => {
    requestedUrl = new URL(url);
    return { ok: true, text: async () => currentEuraxessMarkup };
  };

  try {
    const response = createResponse();
    await handler({ method: 'GET', headers: {}, query: { q: 'climate' } }, response);

    assert.equal(requestedUrl.searchParams.get('f[0]'), 'keywords:climate');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].title, 'PhD position: Climate resilience');
    assert.equal(response.body.items[0].organization, 'CNRS');
    assert.equal(response.body.items[0].country, 'France');
    assert.equal(response.body.items[0].description, 'Research on climate adaptation.');
    assert.equal(response.body.items[0].source_url, 'https://euraxess.ec.europa.eu/jobs/478694');
    assert.equal(response.body.items[0].source, 'EURAXESS');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('EURAXESS parser still accepts the previous class-based result wrapper', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => currentEuraxessMarkup.replace('id="job-teaser-content"', 'class="job-teaser-content"'),
  });

  try {
    const response = createResponse();
    await handler({ method: 'GET', headers: {}, query: { q: 'climate' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.items.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
