// Shared conservative intent check for EYRA write consent. This classifies
// the *latest user turn*, never historical chat or retrieved documents.
export function requestedEyraWrites(request) {
  const text = typeof request === 'string' ? request.toLowerCase().trim() : '';
  if (!text || text.length > 2000) return { project: false, paper: false };
  if (/\\b(?:don't|do not|never|should not|shouldn't)\\b/.test(text)
    || /(?:^|\\s)(?:μην|μη)(?:\\s|$)/u.test(text)) {
    return { project: false, paper: false };
  }
  const project = /\\b(?:create|make|start|set up|open)\\b.{0,100}\\bproject\\b|\\bnew project\\b|\\bproject\\b.{0,100}\\b(?:create|make|start|set up|open)\\b|(?:δημιούργησε|δημιουργησε|δημιουργήστε|δημιουργηστε|φτιάξε|φτιαξε|άνοιξε|ανοιξε).{0,100}(?:έργο|πρότζεκτ)|νέο έργο/u.test(text);
  const paper = /\\b(?:save|add|put|store)\\b.{0,100}\\b(?:paper|article|publication)\\b|\\b(?:paper|article|publication)\\b.{0,100}\\b(?:save|add|put|store)\\b|\\bmy library\\b|στη βιβλιοθήκη μου|(?:αποθήκευσε|αποθηκευσε|αποθηκεύστε|αποθήκευσέ).{0,100}(?:άρθρο|δημοσίευση|εργασία)|(?:άρθρο|δημοσίευση|εργασία).{0,100}(?:αποθήκευσε|αποθηκευσε|αποθήκευσέ)/u.test(text);
  return { project, paper };
}
