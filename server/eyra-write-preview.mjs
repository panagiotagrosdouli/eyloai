import { validatedEyraToolArguments } from './eyra-tool-contract.mjs';

// A proposed write is a *draft*, never an authorization to execute it.
// It must be based on the exact latest user turn, and retain the allowlisted
// fields the model actually proposed, so the person can inspect them first.
const WRITE_FIELDS = Object.freeze({
  'project.create': ['title', 'description', 'goal', 'milestones', 'tasks'],
  'library.save_paper': ['doi', 'title'],
});

export function proposedEyraWriteActions(output, requestedWrites) {
  if (!Array.isArray(output)) throw new Error('Invalid provider tool output.');
  const proposed = [];
  for (const item of output) {
    if (item?.type !== 'function_call') continue;
    if (typeof item.name !== 'string' || !Object.hasOwn(WRITE_FIELDS, item.name)) {
      throw new Error('The model requested a non-write tool in write-preview mode.');
    }
    if ((item.name === 'project.create' && requestedWrites?.project !== true)
      || (item.name === 'library.save_paper' && requestedWrites?.paper !== true)) {
      throw new Error('The model proposed a write not authorized by the current user request.');
    }
    if (proposed.length >= 2 || proposed.some(action => action.tool === item.name)) {
      throw new Error('The model proposed duplicate or excessive writes.');
    }
    const args = validatedEyraToolArguments(item.name, item.arguments);
    const fields = Object.fromEntries(WRITE_FIELDS[item.name].map(key => [key, args[key]]));
    // Show the exact input values the executor will use. The project executor
    // trims all text fields, and DOI storage normalizes the paper identifier.
    if (item.name === 'project.create') {
      for (const key of WRITE_FIELDS[item.name]) fields[key] = fields[key].trim();
    } else {
      fields.doi = fields.doi.trim().replace(/^https?:\\/\\/(?:dx\\.)?doi\\.org\\//i, '')
        .replace(/^doi:\\s*/i, '').toLowerCase();
    }
    if (item.name === 'project.create' && !String(fields.title || '').trim()) {
      throw new Error('A proposed project needs a title.');
    }
    if (item.name === 'library.save_paper' && (!String(fields.title || '').trim()
      || !/^10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$/i.test(String(fields.doi || '').trim()))) {
      throw new Error('A proposed paper needs a title and valid DOI syntax.');
    }
    proposed.push({ tool: item.name, fields });
  }
  return proposed;
}

export const EYRA_WRITE_PREVIEW_INSTRUCTIONS = `In this preview-only request, do not execute any workspace operations.
If the user's latest request explicitly asks to create a project or save a paper,
produce the matching project.create or library.save_paper tool call containing
the exact proposed record fields. These are drafts for user review and are
not authorization to persist anything. Do not call read tools in this mode.
If the request is not clear, reply in plain text without a tool call.`;
