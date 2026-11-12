import test from 'node:test';
import assert from 'node:assert/strict';
import { toBibTeX, toRIS, escapeBibTeXText, publicBibliographyUrl } from '../src/utils/citation-export.js';

test('BibTeX exports available metadata without inventing fields', () => {
  const result = toBibTeX([{ title: 'Safe Navigation', authors: 'Ada Lovelace and Grace Hopper', year: 2026, doi: 'https://doi.org/10.1234/example', url: 'https://example.org/paper' }]);
  assert.match(result, /@misc\{lovelace20261,/);
  assert.match(result, /author = \{Ada Lovelace and Grace Hopper\}/);
  assert.match(result, /doi = \{10\.1234\/example\}/);
});
test('RIS exports authors separately and terminates each record', () => {
  const result = toRIS([{title:'Paper',authors:'Ada Lovelace and Grace Hopper',year:2025}]);
  assert.match(result, /AU  - Ada Lovelace\r\nAU  - Grace Hopper/);
  assert.match(result, /ER  - $/);
  assert.doesNotMatch(result, /DO  - /);
});
test('empty results export no invented references', () => {
  assert.equal(toBibTeX([]), '');
  assert.equal(toRIS([]), '');
});

test('internal Library record IDs are never invented as public reference URLs', () => {
  const source = { id: 'secret-internal-uuid', title: 'Stored paper', authors: 'Jane Doe', year: 2025 };
  assert.doesNotMatch(toBibTeX([source]), /secret-internal-uuid|url = /);
  assert.doesNotMatch(toRIS([source]), /secret-internal-uuid|UR  - /);
});

test('unsafe URLs and invalid DOIs are omitted from reference-manager exports', () => {
  const source = { title: 'Test study', doi: 'not a doi', url: 'javascript:alert(1)' };
  assert.doesNotMatch(toBibTeX([source]), /url = |doi = |javascript:/);
  assert.doesNotMatch(toRIS([source]), /UR  - |DO  - |javascript:/);
});

test('valid HTTPS DOI and publication URL remain usable in bibliography exports', () => {
  const source = { title: 'Evidence study', doi: 'https://doi.org/10.1000/xyz', url: 'https://publisher.example/record' };
  assert.match(toBibTeX([source]), /doi = \{10\.1000\/xyz\}/);
  assert.match(toBibTeX([source]), /url = \{https:\/\/publisher\.example\/record\}/);
  assert.match(toRIS([source]), /DO  - 10\.1000\/xyz/);
});

test('BibTeX escapes all TeX syntax characters without corrupting introduced commands', () => {
  assert.equal(escapeBibTeXText('A&B 50% #1_$ \\ {note} ~ ^'),
    String.raw`A\&B 50\% \#1\_\$ \textbackslash{} \{note\} \textasciitilde{} \textasciicircum{}`);
  const output = toBibTeX([{ title:'Methods & Results: 50% of A_B', authors:'Jane #Doe', year:2026 }]);
  assert.match(output, /Methods \\\& Results: 50\\% of A\\_B/);
  assert.match(output, /Jane \\#Doe/);
});

test('Unicode multiple authors, diacritics and missing optional fields survive both formats', () => {
  const paper = { title:'Études sur les protéines — Αθήνα', authors:['Ana María López', 'Émile Durkheim', 'Νίκη Παπαδοπούλου'] };
  const bib = toBibTeX([paper]);
  const ris = toRIS([paper]);
  assert.ok(bib.includes('Études sur les protéines — Αθήνα'));
  assert.ok(bib.includes('Ana María López and Émile Durkheim and Νίκη Παπαδοπούλου'));
  assert.equal(ris.match(/^AU  - /gm)?.length, 3);
  assert.ok(ris.includes('TI  - Études sur les protéines — Αθήνα'));
  assert.doesNotMatch(bib, /year = |doi = /);
  assert.doesNotMatch(ris, /PY  - |DO  - /);
});

test('records with duplicate titles still receive distinct citation keys', () => {
  const papers = [
    {title:'Same title',authors:'Ada Lovelace',year:2025},
    {title:'Same title',authors:'Ada Lovelace',year:2025},
  ];
  const keys = [...toBibTeX(papers).matchAll(/@misc\{([^,]+),/g)].map(item => item[1]);
  assert.equal(new Set(keys).size, 2);
});

test('private, local, signed and auth-bearing URLs are never exported as public sources', () => {
  const blocked = [
    'http://localhost:54321/private', 'http://127.0.0.1/data',
    'http://192.168.1.20/report', 'http://10.0.0.3/paper',
    'http://169.254.169.254/latest', 'https://lab.internal/record',
    'https://eyloai.vercel.app/projects/secret',
    'https://kbzjngpzxpniaumlupaa.supabase.co/storage/v1/object/sign/private/file?token=secret',
    'https://publisher.example/article?access_token=secret',
    'https://user:pass@publisher.example/study',
    'javascript:alert(1)', 'file:///secret', '/workspace/projects/xyz',
  ];
  for (const url of blocked) {
    assert.equal(publicBibliographyUrl(url), '', url);
    assert.doesNotMatch(toBibTeX([{title:'Paper',url}]), /url = /);
    assert.doesNotMatch(toRIS([{title:'Paper',url}]), /UR  - /);
  }
  assert.equal(publicBibliographyUrl('https://publisher.example/record?ref=scientific#private-fragment'),
    'https://publisher.example/record?ref=scientific');
});

test('large collections have one distinct well-delimited bibliography record per item', () => {
  const papers = Array.from({length:500}, (_,index) => ({
    title:'Study '+index, authors:[{name:'María García'}, {display_name:'José Álvarez'}],
    year: 2020 + index % 7, doi: '10.5555/paper.'+index,
    url: 'https://publisher.example/articles/'+index,
  }));
  const bib = toBibTeX(papers), ris = toRIS(papers);
  assert.equal([...bib.matchAll(/^@misc\{/gm)].length, 500);
  assert.equal(new Set([...bib.matchAll(/^@misc\{([^,]+),/gm)].map(item => item[1])).size, 500);
  assert.equal([...ris.matchAll(/^ER  - $/gm)].length, 500);
  assert.equal([...ris.matchAll(/^AU  - /gm)].length, 1000);
  assert.ok(!bib.includes('undefined'));
  assert.ok(!ris.includes('undefined'));
});
