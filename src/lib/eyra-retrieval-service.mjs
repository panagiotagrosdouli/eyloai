import { shouldRetrieve, compactQuery } from './eyra-retrieval-plan.mjs';

/**
 * Transport-neutral evidence fanout. Every provider is optional, but a chosen
 * retrieval always exposes partial failures. Source claims are never invented.
 */
export async function retrieveEyraEvidence(content, mode, workspaceContext, signal, adapters) {
  signal?.throwIfAborted();
  const intent = shouldRetrieve(content, mode);
  const query = compactQuery(content, workspaceContext);
  const tasks = [];

  if (intent.papers) {
    tasks.push(adapters.searchPapers(query, { limit: 16, signal }).then(result => ({
      kind: 'papers',
      items: result.papers || [],
      status: result.source_status || [],
    })));
  }
  if (intent.people) {
    tasks.push(adapters.searchAuthors(query, 6, { throwOnError: true, signal }).then(items => ({ kind: 'researchers', items })));
    tasks.push(adapters.searchInstitutions(query, 4, { throwOnError: true, signal }).then(items => ({ kind: 'institutions', items })));
  }
  if (intent.funding) {
    tasks.push(adapters.searchFunding(query, 10, { signal }).then(result => ({ kind: 'funding', items: result.items || [] })));
  }

  if (!tasks.length) return { query, blocks: [], sources: [], attempted: false };
  const settled = await Promise.allSettled(tasks);
  signal?.throwIfAborted();
  const groups = Object.fromEntries(
    settled.filter(result => result.status === 'fulfilled').map(result => [result.value.kind, result.value]),
  );
  const failedCount = settled.filter(result => result.status === 'rejected').length;
  const packet = adapters.buildEvidence(groups, failedCount);
  return { query, ...packet, attempted: true };
}
