import {
  AlignmentType, Document, Footer, HeadingLevel, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';

const cell = (value, bold = false) => new TableCell({
  width: { size: 25, type: WidthType.PERCENTAGE },
  children: [new Paragraph({ children: [new TextRun({ text: String(value || '—'), bold })] })],
});

const row = values => new TableRow({ children: values.map((value, index) => cell(value, index === 0)) });

export async function createGrantProposalDocx(artifact = {}) {
  const sections = Array.isArray(artifact.edited_sections) ? artifact.edited_sections : artifact.draft?.sections || [];
  const workPackages = artifact.edited_work_packages || artifact.draft?.work_packages || [];
  const budgetLines = artifact.draft?.budget_lines || [];
  const source = artifact.call_source || {};
  const requirements = artifact.call_requirements || [];
  const children = [
    new Paragraph({ text: 'Grant proposal draft', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: 'Researcher review required · Not submitted · Not an award or institutional approval', bold: true })], alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `Call: ${source.title || 'Not specified'}`, heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: `Official source: ${source.url || 'Not supplied'}` }),
    new Paragraph({ text: `Project idea: ${artifact.project_idea || 'Not specified'}` }),
    new Paragraph({ text: `Discipline: ${artifact.discipline || 'Not specified'} · Language: ${artifact.language || 'English'}` }),
    new Paragraph({ text: 'Call requirements and provenance', heading: HeadingLevel.HEADING_1 }),
    ...requirements.map(requirement => new Paragraph({ children: [
      new TextRun({ text: `[${requirement.id}] line ${requirement.line}: `, bold: true }),
      new TextRun(requirement.quote),
      new TextRun({ text: ` (${requirement.source_url || source.url || 'source URL unavailable'})`, italics: true }),
    ], bullet: { level: 0 } })),
  ];
  for (const section of sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ text: section.content || '[Researcher input required]' }));
    if (section.requirement_ids?.length) children.push(new Paragraph({ children: [new TextRun({ text: `Call requirements: ${section.requirement_ids.join(', ')}`, italics: true })] }));
    if (section.source_ids?.length) children.push(new Paragraph({ children: [new TextRun({ text: `Scholarly record IDs: ${section.source_ids.join(', ')}`, italics: true })] }));
  }
  children.push(new Paragraph({ text: 'Bibliography', heading: HeadingLevel.HEADING_1 }));
  const bibliography = artifact.bibliography || [];
  if (bibliography.length) {
    for (const source of bibliography) {
      const authors = source.authors || 'Authors unavailable';
      const year = source.year ? ` (${source.year})` : '';
      const doi = source.doi ? ` DOI: ${source.doi}.` : '';
      const url = source.url ? ` ${source.url}` : '';
      children.push(new Paragraph({ text: `${authors}${year}. ${source.title || 'Title unavailable'}.${doi}${url}`, bullet: { level: 0 } }));
    }
  } else children.push(new Paragraph({ text: '[No bibliography records were saved with this draft.]' }));
  children.push(new Paragraph({ text: 'Provisional work packages, milestones and deliverables', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: 'These are proposed planning elements. They do not record existing partner commitments or completed work.' }));
  if (workPackages.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1500, 2400, 2800, 2500, 1800], rows: [
    row(['WP', 'Objective and activities', 'Deliverables', 'Milestones', 'Partner (unconfirmed)']),
    ...workPackages.map(item => row([`${item.code || ''} ${item.title || ''}`, `${item.objective || ''}\n${(item.activities || []).join('\n')}`, (item.deliverables || []).join('\n'), (item.milestones || []).join('\n'), item.partner_name || '[Researcher input required]']))
  ] }));
  children.push(new Paragraph({ text: 'Provisional budget structure', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: 'Only researcher-supplied figures appear below. Empty amounts indicate that no verified figure was supplied.' }));
  if (budgetLines.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [2400, 1800, 4300, 2500], rows: [
    row(['Category', 'Supplied amount', 'Basis / provenance', 'Figure ID']),
    ...budgetLines.map(item => row([item.category, item.amount_text || 'Not supplied', item.basis, item.figure_id || '—']))
  ] }));
  children.push(new Paragraph({ text: 'Human review and limitations', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: 'This is an editable AI-assisted draft. Verify each call requirement against the official source and each scholarly claim against the original publication. Confirm eligibility, dates, budget rules, partner roles, institutional facts, ethics, feasibility, reproducibility and submission terms with authorized researchers and officials.' }));
  const document = new Document({
    creator: 'EYLO Proposal Studio',
    title: `Grant proposal draft — ${source.title || 'Research call'}`,
    subject: 'Researcher-reviewed grant proposal draft with call provenance',
    keywords: 'grant proposal, researcher review, draft',
    sections: [{ properties: {}, footers: { default: new Footer({ children: [new Paragraph({ text: 'DRAFT · Requires researcher review', alignment: AlignmentType.CENTER })] }) }, children }],
    styles: { default: { document: { run: { font: 'Aptos', size: 22 }, paragraph: { spacing: { after: 160 } } } } },
  });
  return Packer.toBlob(document);
}
