// SSE framing shared by the authenticated server relay and browser reader.
// Limits apply to bytes received, including incomplete or malicious frames.
export async function* readEyraEvents(body, maxBytes = 4 * 1024 * 1024) {
  if (!body?.getReader) throw new Error('EYRA did not provide a response stream.');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = ''; let bytes = 0; let ended = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) { ended = true; buffer += decoder.decode(); }
      else { bytes += value.byteLength; if (bytes > maxBytes) throw new Error('EYRA stream exceeded its response budget.'); buffer += decoder.decode(value, { stream: true }); }
      let separator;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') continue;
        let event;
        try { event = JSON.parse(data); } catch { throw new Error('EYRA returned an invalid response event.'); }
        yield event;
      }
      if (done) {
        if (buffer.trim()) throw new Error('EYRA stream ended in an incomplete event.');
        break;
      }
    }
  } finally { if (!ended) await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function relayEyraResponse(body, onDelta) {
  let text = ''; let completed = null;
  for await (const event of readEyraEvents(body)) {
    if (event.type === 'response.output_text.delta') {
      if (typeof event.delta !== 'string') throw new Error('Invalid EYRA text event.');
      text += event.delta;
      if (text.length > 40_000) throw new Error('EYRA response exceeded its text budget.');
      await onDelta(event.delta);
    } else if (event.type === 'response.completed') {
      if (event.response?.status !== 'completed') throw new Error('EYRA generation did not complete.');
      completed = event.response;
    } else if (['error', 'response.failed', 'response.incomplete'].includes(event.type)) {
      throw new Error('EYRA generation did not complete.');
    }
  }
  if (!completed || !text.trim() || completed.output?.some(item => item.type === 'function_call')) throw new Error('EYRA stream did not confirm a completed text response.');
  const finalText = (completed.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
  if (!finalText || finalText.length > 40_000) throw new Error('EYRA completed without a valid final response.');
  return { text: finalText, response_id: completed.id, model: completed.model };
}
