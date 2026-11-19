/** Pure client-side retrieval planner; never treats user workspace text as source verification. */
export function shouldRetrieve(content, mode) {
  const text = String(content || '').toLowerCase();
  const funding = mode === 'funding' || /(grant|funding|call for|opportunit|χρηματοδ|επιχορήγ|πρόσκλησ)/i.test(text);
  const people = mode === 'team' || /(collaborat|researcher|author|institution|university|team|consortium|συνεργά|ερευνητ|πανεπιστήμ|ομάδα)/i.test(text);
  const papers = ['research', 'impact', 'literature', 'methodology', 'critical'].includes(mode)
    || /(paper|literature|evidence|study|studies|research gap|method|citation|δημοσίευ|βιβλιογραφ|έρευν|μελέτ|μεθοδολογ)/i.test(text);
  return { funding, people, papers };
}

export function compactQuery(content, workspaceContext) {
  const genericEnglish = /\b(my|current|project|work|research|review|analyze)\b/gi;
  const genericGreek = /(μου|έργο|έρευνα|ανάλυσ[ηε]|αξιολόγησ[ηε])/gi;
  const cleaned = content.replace(genericEnglish, ' ').replace(genericGreek, ' ').replace(/\s+/g, ' ').trim();
  const interestLine = workspaceContext
    .split('\n')
    .find(line => line.startsWith('Research Interests:')) || '';
  const interest = interestLine
    .replace('Research Interests:', '')
    .replace(/Not yet specified.*/i, '')
    .trim()
    .slice(0, 140);
  const projectLine = workspaceContext
    .split('\n')
    .find(line => /^- ".+" \[(active|planning)\]:/i.test(line)) || '';
  const project = projectLine.replace(/^- /, '').trim().slice(0, 180);
  const contextAnchor = [interest, project].filter(Boolean).join(' ');
  return (cleaned.length >= 18 ? cleaned : `${cleaned} ${contextAnchor}`).trim().slice(0, 280) || content.slice(0, 280);
}

