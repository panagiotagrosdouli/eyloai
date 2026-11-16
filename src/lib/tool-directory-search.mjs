// Search the tool directory by user intent, group, and common research terms.
// Keep this pure so the same behavior can be checked without a browser.
const TOOL_ALIASES = {
  '/research-gaps': ['research gap', 'evidence gap', 'κενο', 'ερευνητικο κενο'],
  '/literature-review': ['systematic review', 'prisma', 'bibliography', 'βιβλιογραφια'],
  '/labs/data': ['csv', 'dataset', 'data analysis', 'δεδομενα'],
  '/opportunities': ['grant', 'funding', 'χρηματοδοτηση'],
  '/library': ['saved papers', 'references', 'πηγες'],
  '/study-planner': ['study schedule', 'διαβασμα'],
};

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
}

export function filterToolGroups(groups, rawQuery) {
  const terms = normalize(rawQuery).split(' ').filter(Boolean);
  if (!terms.length) return groups;
  return groups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const searchable = normalize([
        group.section, group.description, item.label, item.desc,
        item.badge, ...(TOOL_ALIASES[item.path] || []),
      ].join(' '));
      return terms.every(term => searchable.includes(term));
    }),
  })).filter(group => group.items.length > 0);
}
