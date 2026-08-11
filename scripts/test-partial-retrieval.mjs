globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.includes('api.openalex.org/works')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [{
          id: 'openalex-1',
          title: 'Robotics for independent ageing: a field study',
          publication_year: 2025,
          cited_by_count: 12,
          relevance_score: 1,
          authorships: [],
          open_access: { is_oa: true },
          primary_location: { source: { display_name: 'Test journal' } },
        }],
      }),
    };
  }
  if (target.includes('api.semanticscholar.org')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{
          paperId: 's2-1',
          title: 'Robotics supporting independent ageing at home',
          abstract: 'Robotics for independent ageing and independent living.',
          year: 2024,
          authors: [],
          citationCount: 4,
          externalIds: {},
        }],
      }),
    };
  }
  if (target.includes('europepmc')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ resultList: { result: [] } }),
    };
  }
  throw new Error('Simulated source outage');
};

const { searchAllPapersWithStatus } = await import('../src/lib/eyra-api.js');
const result = await searchAllPapersWithStatus('robotics for independent ageing', { limit: 10 });

if (result.available_source_count !== 3 || result.unavailable_source_count !== 2) {
  throw new Error(`Unexpected source health: ${JSON.stringify(result.source_status)}`);
}
if (result.papers.length !== 2) {
  throw new Error(`Expected two verified partial records, received ${result.papers.length}`);
}

console.log('Partial-source retrieval test passed.');
