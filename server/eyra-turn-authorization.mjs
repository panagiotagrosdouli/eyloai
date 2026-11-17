/** Exact last-turn extraction for write permission. Model and retrieved data never authorize writes. */
export function currentUserRequest(prompt, userTurn) {
  // The UI sends the latest turn separately: instructions hidden in past
  // messages or retrieved evidence must not grant write authorization.
  const heading = 'LATEST USER REQUEST (preserved in full):' + String.fromCharCode(10);
  const markerPosition = prompt.lastIndexOf(heading);
  if (markerPosition < 0) {
    // Legacy API callers with an ordinary, unwrapped prompt remain supported;
    // they are explicitly requesting an operation in the direct prompt.
    return userTurn === undefined ? prompt : (userTurn === prompt ? prompt : '');
  }
  if (typeof userTurn !== 'string' || !userTurn.trim() || userTurn.length > 2000) return '';
  const start = markerPosition + heading.length;
  const closing = String.fromCharCode(10, 10) + 'Context excerpts are bounded';
  const end = prompt.indexOf(closing, start);
  if (end < 0) return '';
  // The explicit user turn must match the last app-designated turn exactly.
  // An additional forged heading in the text therefore fails closed.
  const embedded = prompt.slice(start, end);
  return embedded === userTurn ? userTurn : '';
}

