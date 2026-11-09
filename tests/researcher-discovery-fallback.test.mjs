import test from 'node:test';
import assert from 'node:assert/strict';

import { searchOpenAlexAuthors } from '../src/lib/eyra-api.js';

test('discovers real paper authors when a multiword OpenAlex author search is empty', async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    requests.push(parsed.pathname);
    if (parsed.pathname === '/authors') {
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    if (parsed.pathname === '/works') {
      return new Response(JSON.stringify({
        results: [{
          id: 'https://openalex.org/W2794543671',
          authorships: [{
            author: {
              id: 'https://openalex.org/A5033953081',
              display_name: 'Nelly M. Cruz',
              orcid: 'https://orcid.org/0000-0002-9040-6957',
            },
            institutions: [{
              display_name: 'University of Washington',
              country_code: 'US',
            }],
          }],
        }],
      }), { status: 200 });
    }
    throw new Error(`Unexpected OpenAlex endpoint: ${parsed.pathname}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const researchers = await searchOpenAlexAuthors('CRISPR gene editing', 8);

  assert.deepEqual(requests, ['/authors', '/works']);
  assert.equal(researchers.length, 1);
  assert.equal(researchers[0].name, 'Nelly M. Cruz');
  assert.equal(researchers[0].institution, 'University of Washington');
  assert.equal(researchers[0].profile_url, 'https://openalex.org/authors/A5033953081');
  assert.equal(researchers[0].academic_role, null);
  assert.equal(researchers[0].academic_role_verified, false);
  assert.equal(researchers[0].data_source, 'OpenAlex publication authorship');
});

test('excludes corporate and consortium author records from researcher profiles', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, '/authors');
    return new Response(JSON.stringify({ results: [
      { id: 'https://openalex.org/A1', display_name: 'Nelly M. Cruz' },
      { id: 'https://openalex.org/A2', display_name: 'Asia-Pacific Climate Change Adaptation Network' },
      { id: 'https://openalex.org/A3', display_name: 'Connecticut Governor Steering Committee' },
      { id: 'https://openalex.org/A4', display_name: 'Excellence in Agronomy for Sustainable Intensification and Climate Change Adaptation' },
    ] }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const researchers = await searchOpenAlexAuthors('climate change adaptation', 8);

  assert.deepEqual(researchers.map(person => person.name), ['Nelly M. Cruz']);
});
