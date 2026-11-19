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
