import {
  AlignmentType, Document, Footer, HeadingLevel, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';

const cell = (value, bold = false, width = 20) => new TableCell({
  width: { size: width, type: WidthType.PERCENTAGE },
  children: [new Paragraph({ children: [new TextRun({ text: String(value || '—'), bold })] })],
});

const row = (values, widths = values.map(() => 100 / values.length)) => new TableRow({ children: values.map((value, index) => cell(value, index === 0, widths[index])) });

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
      new TextRun({ text: `[${requirement.id}] ${requirement.source_document_name || requirement.source_title || 'supplied text'} · source ID ${requirement.source_document_id || 'manual excerpt'} · ${requirement.page ? `page ${requirement.page}` : requirement.section ? `section ${requirement.section}` : `line ${requirement.line}`}: `, bold: true }),
      new TextRun(requirement.supporting_excerpt || requirement.quote),
      new TextRun({ text: ` · ${requirement.category || 'uncategorized'} · ${requirement.extraction_confidence || 'confidence unavailable'} · ${requirement.confirmation_status || 'unconfirmed'}`, italics: true }),
      new TextRun({ text: ` (${requirement.source_url || source.url || 'source URL unavailable'})`, italics: true }),
    ], bullet: { level: 0 } })),
  ];
  if (artifact.source_documents?.length) {
    children.push(new Paragraph({ text: 'Supplied source documents', heading: HeadingLevel.HEADING_1 }));
    for (const document of artifact.source_documents) children.push(new Paragraph({ text: `${document.name || 'Document'} · source ID ${document.id} · ${document.media_type || 'type unavailable'} · ${document.extraction_method || 'extraction method unavailable'} · ${document.extraction_status || 'status unavailable'}`, bullet: { level: 0 } }));
  }
  for (const section of sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: section.content || '[Researcher input required]' }));
    if (section.requirement_ids?.length) children.push(new Paragraph({ children: [new TextRun({ text: `Call requirements: ${section.requirement_ids.join(', ')}`, italics: true })] }));
    if (section.source_ids?.length) children.push(new Paragraph({ children: [new TextRun({ text: `Scholarly record IDs: ${section.source_ids.join(', ')}`, italics: true })] }));
  }
  children.push(new Paragraph({ text: 'Requirement to section mapping', heading: HeadingLevel.HEADING_1 }));
  const mappingWidths = [12, 18, 26, 26, 18];
  const sectionMap = new Map();
  for (const section of sections) for (const id of section.requirement_ids || []) sectionMap.set(id, [...(sectionMap.get(id) || []), section.heading]);
  if (requirements.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [900, 1500, 2400, 2400, 1600], rows: [
    row(['Requirement', 'Category', 'Source / location', 'Mapped proposal sections', 'Review state'], mappingWidths),
    ...requirements.map(item => row([
      item.id, item.category || 'uncategorized', `${item.source_document_name || item.source_title || 'supplied text'} · ${item.source_document_id || 'manual excerpt'} · ${item.page ? `p. ${item.page}` : item.section || `line ${item.line}`}`,
      (sectionMap.get(item.id) || []).join('; ') || '[Researcher mapping required]', item.confirmation_status || 'unconfirmed',
    ], mappingWidths)),
  ] }));
  else children.push(new Paragraph({ text: 'No extracted requirements. Manual requirements must be entered and confirmed.' }));
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
    row(['WP', 'Objective and activities', 'Deliverables', 'Milestones', 'Partner (unconfirmed)'], [12, 23, 23, 24, 18]),
    ...workPackages.map(item => row([`${item.code || ''} ${item.title || ''}`, `${item.objective || ''}\n${(item.activities || []).join('\n')}`, (item.deliverables || []).join('\n'), (item.milestones || []).join('\n'), item.partner_name || '[Researcher input required]'], [12, 23, 23, 24, 18]))
  ] }));
  children.push(new Paragraph({ text: 'Provisional project timeline', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: 'Relative sequence only; no calendar dates are inferred. Review dependencies and timing with the project team.' }));
  const timeline = artifact.draft?.timeline || [];
  if (timeline.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1700, 2200, 2900, 2400, 1800], rows: [
    row(['Sequence', 'Work package', 'Milestone', 'Dependency', 'Status']),
    ...timeline.map(item => row([item.sequence || 'Researcher input required', item.work_package_code || 'Researcher mapping required', item.milestone, item.dependency || 'None supplied', 'Provisional'])),
  ] }));
  children.push(new Paragraph({ text: 'Provisional risk register', heading: HeadingLevel.HEADING_1 }));
  const risks = artifact.draft?.risks || [];
  if (risks.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [2200, 1300, 1300, 3400, 2800], rows: [
    row(['Risk', 'Likelihood', 'Impact', 'Mitigation', 'Owner']),
    ...risks.map(item => row([item.risk, item.likelihood, item.impact, item.mitigation, item.owner || '[Researcher input required]'])),
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
