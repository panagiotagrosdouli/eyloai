const OPENALEX_ENTITY = /^https:\/\/openalex\.org\/([WATPI]\d+)$/i;
const OPENALEX_AUTHOR = /^https:\/\/openalex\.org\/A\d+$/i;
const OPENALEX_INSTITUTION = /^https:\/\/openalex\.org\/I\d+$/i;
const OPENALEX_TOPIC = /^https:\/\/openalex\.org\/T\d+$/i;
const OPENALEX_WORK = /^https:\/\/openalex\.org\/W\d+$/i;
const MAX_SAVED_RECORDS = 250;

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function stableRecordId(value) {
  const id = String(value ?? '').trim();
  return id && id.length <= 240 ? id : '';
}

function addNode(nodes, node) {
  if (!node.id || nodes.has(node.id)) return;
  nodes.set(node.id, { ...node, source_url: safeExternalUrl(node.source_url) });
}

function addEdge(edges, edge) {
  if (!edge.from || !edge.to || edge.from === edge.to) return;
  const id = `${edge.kind}:${edge.from}->${edge.to}`;
  if (!edges.has(id)) edges.set(id, { ...edge, id, source_url: safeExternalUrl(edge.source_url) });
}

function topicKey(topic) {
  const id = String(topic?.id || '');
  return OPENALEX_TOPIC.test(id) ? `topic:${id}` : '';
}

function listOf(value) {
  return Array.isArray(value) ? value : [];
}

export function buildResearchKnowledgeGraph({ papers = [], researchers = [], projects = [] } = {}) {
  const nodes = new Map();
  const edges = new Map();
  const paperNodes = new Map();
  const projectIds = new Set();
  const projectRows = listOf(projects).slice(0, MAX_SAVED_RECORDS);
  const paperRows = listOf(papers).slice(0, MAX_SAVED_RECORDS);
  const researcherRows = listOf(researchers).slice(0, MAX_SAVED_RECORDS);

  for (const project of projectRows) {
    const id = stableRecordId(project?.id);
    if (!id) continue;
    const nodeId = `project:${id}`;
    projectIds.add(id);
    addNode(nodes, {
      id: nodeId,
      entity_id: id,
      type: 'project',
      label: String(project.title || 'Untitled project').slice(0, 180),
      details: String(project.goal || project.description || '').slice(0, 500),
      source_url: '',
      provenance: 'Saved project record',
    });
  }

  for (const paper of paperRows) {
    const recordId = stableRecordId(paper?.id) || stableRecordId(paper?.source_id);
    if (!recordId) continue;
    const nodeId = `paper:${recordId}`;
    const rawWorkId = String(paper.source_id || paper.openalex_id || '').trim();
    const workId = rawWorkId.match(OPENALEX_ENTITY)?.[1] || rawWorkId.match(/^(W\d+)$/i)?.[1];
    const normalizedWorkId = workId && workId.startsWith('W') ? `https://openalex.org/${workId}` : '';
    const openalexId = normalizedWorkId || (OPENALEX_WORK.test(String(paper.source_id || '')) ? String(paper.source_id) : '');
    const sourceUrl = safeExternalUrl(paper.url) || openalexId;
    addNode(nodes, {
      id: nodeId,
      entity_id: recordId,
      type: 'paper',
      label: String(paper.title || 'Untitled publication').slice(0, 220),
      details: [paper.year, paper.source || 'Saved paper', paper.doi ? `DOI ${paper.doi}` : ''].filter(Boolean).join(' · '),
      source_url: sourceUrl,
      provenance: sourceUrl ? 'Saved publication metadata; open the source record' : 'Saved publication metadata; source URL not recorded',
      openalex_id: openalexId,
    });
    paperNodes.set(nodeId, { paper, openalexId });

    if (projectIds.has(String(paper.project_id || ''))) {
      addEdge(edges, {
        from: `project:${paper.project_id}`,
        to: nodeId,
        kind: 'project-paper',
        label: 'Saved to project',
        source_url: '',
        provenance: 'EYLO project/library record',
        inferred: false,
      });
    }

    for (const authorship of listOf(paper.authorships).slice(0, 100)) {
      const authorId = String(authorship?.author_id || '');
      if (!OPENALEX_AUTHOR.test(authorId)) continue;
      const authorNodeId = `author:${authorId}`;
      addNode(nodes, {
        id: authorNodeId,
        entity_id: authorId,
        type: 'author',
        label: String(authorship.author_name || 'Named author').slice(0, 180),
        details: 'OpenAlex author identifier',
        source_url: authorId,
        provenance: 'Authorship recorded by OpenAlex for this publication',
      });
      addEdge(edges, {
        from: authorNodeId,
        to: nodeId,
        kind: 'authorship',
        label: 'Authored',
        source_url: sourceUrl,
        provenance: 'OpenAlex publication authorship',
        inferred: false,
      });

      for (const institution of listOf(authorship.institutions).slice(0, 5)) {
        const institutionId = String(institution?.id || '');
        if (!OPENALEX_INSTITUTION.test(institutionId)) continue;
        const institutionNodeId = `institution:${institutionId}`;
        addNode(nodes, {
          id: institutionNodeId,
          entity_id: institutionId,
          type: 'institution',
          label: String(institution.name || 'Institution').slice(0, 180),
          details: 'Affiliation recorded on this publication',
          source_url: institutionId,
          provenance: 'OpenAlex publication affiliation',
        });
        addEdge(edges, {
          from: authorNodeId,
          to: institutionNodeId,
          kind: 'publication-affiliation',
          label: 'Affiliated on this work',
          source_url: sourceUrl,
          provenance: 'OpenAlex authorship affiliation; not necessarily current',
          inferred: false,
        });
      }
    }

    for (const topic of listOf(paper.openalex_topics).slice(0, 10)) {
      const nodeIdForTopic = topicKey(topic);
      if (!nodeIdForTopic) continue;
      addNode(nodes, {
        id: nodeIdForTopic,
        entity_id: topic.id,
        type: 'topic',
        label: String(topic.name || 'Indexed topic').slice(0, 180),
        details: 'OpenAlex topic classification',
        source_url: topic.id,
        provenance: 'OpenAlex indexed topic for this publication',
      });
      addEdge(edges, {
        from: nodeId,
        to: nodeIdForTopic,
        kind: 'indexed-topic',
        label: 'Indexed under',
        source_url: sourceUrl,
        provenance: 'OpenAlex topic classification',
        inferred: false,
      });
    }

    const annotations = projectRows.find(row => String(row?.id) === String(paper.project_id))?.evidence_matrix?.annotations || {};
    const studyDesign = String(annotations?.[paper.id]?.study_design || '').trim().slice(0, 300);
    if (studyDesign) {
      const methodNodeId = `method-note:${paper.project_id}:${paper.id}`;
      addNode(nodes, {
        id: methodNodeId,
        entity_id: `${paper.project_id}:${paper.id}`,
        type: 'methodology',
        label: studyDesign,
        details: 'Researcher-authored evidence matrix note',
        source_url: '',
        provenance: 'Researcher note in a linked EYLO project; not independently verified',
      });
      addEdge(edges, {
        from: nodeId,
        to: methodNodeId,
        kind: 'method-note',
        label: 'Method note',
        source_url: sourceUrl,
        provenance: 'Researcher-authored project note',
        inferred: false,
      });
    }
  }

  for (const researcher of researcherRows) {
    const openalexId = String(researcher?.openalex_id || '');
    if (!OPENALEX_AUTHOR.test(openalexId)) continue;
    const nodeId = `author:${openalexId}`;
    addNode(nodes, {
      id: nodeId,
      entity_id: openalexId,
      type: 'researcher',
      label: String(researcher.name || 'Saved researcher').slice(0, 180),
      details: [researcher.institution, researcher.orcid ? `ORCID ${researcher.orcid}` : ''].filter(Boolean).join(' · '),
      source_url: safeExternalUrl(researcher.profile_url) || openalexId,
      provenance: 'Saved researcher record; source profile link available',
    });
    const savedResearcherNode = nodes.get(nodeId);
    if (savedResearcherNode) {
      nodes.set(nodeId, {
        ...savedResearcherNode,
        type: 'researcher',
        label: String(researcher.name || savedResearcherNode.label).slice(0, 180),
        details: [researcher.institution, researcher.orcid ? `ORCID ${researcher.orcid}` : ''].filter(Boolean).join(' · '),
        provenance: 'Saved researcher record; source profile link available',
      });
    }
    if (projectIds.has(String(researcher.project_id || ''))) {
      addEdge(edges, {
        from: `project:${researcher.project_id}`,
        to: nodeId,
        kind: 'project-researcher',
        label: 'Saved to project',
        source_url: safeExternalUrl(researcher.profile_url) || openalexId,
        provenance: 'EYLO project/library record',
        inferred: false,
      });
    }
    for (const topic of listOf(researcher.openalex_topics).slice(0, 10)) {
      const topicNodeId = topicKey(topic);
      if (!topicNodeId) continue;
      addNode(nodes, {
        id: topicNodeId,
        entity_id: topic.id,
        type: 'topic',
        label: String(topic.name || 'Indexed topic').slice(0, 180),
        details: 'OpenAlex topic classification',
        source_url: topic.id,
        provenance: 'OpenAlex indexed topic for this researcher record',
      });
      addEdge(edges, {
        from: nodeId,
        to: topicNodeId,
        kind: 'researcher-topic',
        label: 'Research record topic',
        source_url: safeExternalUrl(researcher.profile_url) || openalexId,
        provenance: researcher.research_topics_source || 'OpenAlex researcher metadata',
        inferred: false,
      });
    }
  }

  const openAlexPapers = new Map([...paperNodes.entries()]
    .filter(([, row]) => row.openalexId)
    .map(([nodeId, row]) => [row.openalexId, { nodeId, paper: row.paper }]));

  for (const [nodeId, { paper, openalexId }] of paperNodes) {
    if (openalexId) {
      for (const referencedWorkId of listOf(paper.referenced_work_ids).slice(0, 100)) {
        if (!OPENALEX_WORK.test(String(referencedWorkId))) continue;
        const cited = openAlexPapers.get(String(referencedWorkId));
        if (!cited) continue;
        addEdge(edges, {
          from: nodeId,
          to: cited.nodeId,
          kind: 'citation',
          label: 'Cites',
          source_url: safeExternalUrl(paper.url) || openalexId,
          provenance: 'OpenAlex referenced-work identifier; both papers are in this library',
          inferred: false,
        });
      }
    }
  }

  const paperTopics = new Map();
  for (const edge of edges.values()) {
    if (edge.kind !== 'indexed-topic') continue;
    const topicId = edge.to;
    const topic = nodes.get(topicId);
    if (!paperTopics.has(topicId)) paperTopics.set(topicId, []);
    paperTopics.get(topicId).push({ paperId: edge.from, topicName: topic?.label || 'shared topic' });
  }
  for (const rows of paperTopics.values()) {
    const linkedPairs = new Set();
    const maxRelatedPerPaper = Math.min(3, rows.length - 1);
    for (let left = 0; left < rows.length; left += 1) {
      for (let offset = 1; offset <= maxRelatedPerPaper; offset += 1) {
        const right = (left + offset) % rows.length;
        const pair = [rows[left].paperId, rows[right].paperId].sort().join('|');
        if (linkedPairs.has(pair)) continue;
        linkedPairs.add(pair);
        addEdge(edges, {
          from: rows[left].paperId,
          to: rows[right].paperId,
          kind: 'topic-similarity',
          label: `Shared indexed topic: ${rows[left].topicName}`,
          source_url: '',
          provenance: 'Inferred similarity from one shared OpenAlex topic; this is not a citation or proof of scientific agreement',
          inferred: true,
        });
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    coverage: {
      papers: paperRows.length,
      researchers: researcherRows.length,
      projects: projectRows.length,
      authorshipRecords: [...edges.values()].filter(edge => edge.kind === 'authorship').length,
      citationLinks: [...edges.values()].filter(edge => edge.kind === 'citation').length,
      inferredTopicLinks: [...edges.values()].filter(edge => edge.inferred).length,
    },
  };
}

export function filterResearchKnowledgeGraph(graph, { query = '', types = null } = {}) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const allowedTypes = Array.isArray(types) ? new Set(types) : null;
  const nodes = listOf(graph?.nodes).filter(node => {
    if (allowedTypes && !allowedTypes.has(node.type)) return false;
    if (!normalizedQuery) return true;
    return `${node.label} ${node.details || ''} ${node.provenance || ''}`.toLowerCase().includes(normalizedQuery);
  });
  const visibleIds = new Set(nodes.map(node => node.id));
  const edges = listOf(graph?.edges).filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  return { nodes, edges };
}

export function getRelatedKnowledgeNodes(graph, nodeId) {
  const nodes = new Map(listOf(graph?.nodes).map(node => [node.id, node]));
  return listOf(graph?.edges).flatMap(edge => {
    if (edge.from !== nodeId && edge.to !== nodeId) return [];
    const relatedId = edge.from === nodeId ? edge.to : edge.from;
    const node = nodes.get(relatedId);
    return node ? [{ node, edge }] : [];
  });
}
