// Only the authenticated user's latest turn may authorize a write. A checked
// "allow tools" box is not sufficient: the turn must positively request the
// specific kind of change and the API must separately require confirmation.
//
// Intent matching deliberately prefers false negatives to false positives;
// metadata, retrieved records and old chat turns are never authorization.
const NEGATION = /\b(?:don't|do not|never|should not|shouldn't|without|avoid|instead of|rather than)\b|(?:^|\s)(?:μην|μη|χωρίς)(?=\s|$)/u;
const EXPLANATION = /^(?:how\b|what\b|why\b|explain\b|describe\b|show me how\b|tell me (?:about|how)\b|could you explain\b|πώς\b|τι\b|γιατί\b|εξήγησέ?\b|εξήγησε\b|δείξε μου πώς\b)/u;
const PROJECT_CREATE = /\b(?:create|make|start|set up)\b.{0,100}\b(?:new\s+)?project\b|\bproject\b.{0,90}\b(?:create|make|start|set up)\b|(?:δημιούργησε|δημιουργησε|δημιουργήστε|δημιουργηστε|δημιουργήσεις|δημιουργησεις|φτιάξε|φτιαξε|φτιάξεις|φτιαξεις)\b.{0,100}(?:έργο|πρότζεκτ)/u;
const PAPER_SAVE = /\b(?:save|store|archive)\b.{0,120}\b(?:paper|article|publication)\b|\b(?:paper|article|publication)\b.{0,100}\b(?:save|store|archive)\b|\b(?:add|put)\b.{0,100}\b(?:paper|article|publication)\b.{0,100}\blibrary\b|\b(?:add|put)\b.{0,80}\blibrary\b|(?:αποθήκευσε|αποθηκευσε|αποθηκεύστε|αποθήκευσέ|αποθηκευσέ|πρόσθεσε|προσθεσε)\b.{0,120}(?:άρθρο|δημοσίευση|εργασία|βιβλιοθήκη)/u;

// Split a turn into separate instructions: "Don't create a project, but save
// this paper" can approve only the latter, without a negation in another
// clause authorizing or suppressing unrelated work.
const CLAUSES = /[;.!?\n]|,\s*|\b(?:but|however|instead|then)\b|\bαλλά\b|\bόμως\b/u;

export function requestedEyraWrites(request) {
  const text = typeof request === 'string' ? request.toLowerCase().trim() : '';
  if (!text || text.length > 2000) return { project: false, paper: false };
  const approved = { project: false, paper: false };
  for (const raw of text.split(CLAUSES)) {
    const clause = raw.trim();
    if (!clause || NEGATION.test(clause) || EXPLANATION.test(clause)) continue;
    if (PROJECT_CREATE.test(clause)) approved.project = true;
    if (PAPER_SAVE.test(clause)) approved.paper = true;
  }
  return approved;
}
