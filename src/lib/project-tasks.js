const CHECKBOX_PREFIX = /^\s*(?:[-*+]\s+)?\[([ xX])\]\s*/;
const LIST_PREFIX = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/;

export function parseProjectTasks(value = '') {
  return String(value || '').split('\n').flatMap((line, lineIndex) => {
    const text = line.replace(CHECKBOX_PREFIX, '').replace(LIST_PREFIX, '').trim();
    if (!text) return [];
    const checkbox = line.match(CHECKBOX_PREFIX);
    return [{ lineIndex, text, completed: checkbox ? checkbox[1].toLowerCase() === 'x' : false }];
  });
}

export function toggleProjectTask(value = '', lineIndex) {
  const lines = String(value || '').split('\n');
  const current = lines[lineIndex];
  if (typeof current !== 'string') return String(value || '');
  const checkbox = current.match(CHECKBOX_PREFIX);
  const completed = checkbox ? checkbox[1].toLowerCase() !== 'x' : true;
  const text = current.replace(CHECKBOX_PREFIX, '').replace(LIST_PREFIX, '').trim();
  if (text) lines[lineIndex] = `- [${completed ? 'x' : ' '}] ${text}`;
  return lines.join('\n');
}
