// Tool events are untrusted server/provider envelopes. A missing or unfamiliar
// status must never be presented as a completed workspace mutation.
export function formatUnverifiedEyraToolAction(action) {
  const knownTool = typeof action?.tool === 'string'
    && /^[a-z][a-z0-9_.-]{0,79}$/i.test(action.tool)
    ? action.tool : 'Workspace action';
  if (action?.status === 'succeeded') {
    return `- ${knownTool} reported success, but the result details could not be verified here. Check the actual workspace record.`;
  }
  return `- ${knownTool}: **Outcome not confirmed.** Review the agent run and the workspace record before retrying; the action may still be pending.`;
}

export function hasEyraWriteReceipt(action) {
  if (action?.status !== 'succeeded' || !['project.create', 'library.save_paper'].includes(action.tool)) return false;
  const id = action.result?.id;
  // The owner-scoped server must return an actual saved record identifier.
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function formatEyraToolFailure(action) {
  // Failure metadata can originate from upstream providers. Never echo raw
  // error strings in the user-visible transcript: they can include private
  // record text, tokens, URLs or untrusted Markdown.
  const tool = typeof action?.tool === 'string'
    && /^[a-z][a-z0-9_.-]{0,79}$/i.test(action.tool)
    ? action.tool : 'Workspace action';
  if (action?.status === 'needs_review') {
    return `- **Outcome uncertain — manual review required:** ${tool}. Check the agent run and actual workspace record before retrying.`;
  }
  return `- ${tool} failed. Check the agent run and workspace record before retrying; the operation was not confirmed.`;
}
