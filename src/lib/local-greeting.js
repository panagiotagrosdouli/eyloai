const PERIODS = [
  {
    from: 5,
    to: 12,
    greeting: 'Good morning',
    question: 'What would you like to understand, decide, or move forward today?',
  },
  {
    from: 12,
    to: 17,
    greeting: 'Good afternoon',
    question: 'What would make the biggest difference to your work today?',
  },
  {
    from: 17,
    to: 22,
    greeting: 'Good evening',
    question: 'What would you like to review or move forward this evening?',
  },
  {
    from: 22,
    to: 29,
    greeting: 'Hello',
    question: 'What would you like to examine next?',
  },
];

function localPlace(timeZone) {
  if (!timeZone || timeZone.startsWith('Etc/')) return 'your local time';
  const place = timeZone.split('/').at(-1)?.replaceAll('_', ' ');
  return place || 'your local time';
}

export function getLocalGreeting(name = '', now = new Date()) {
  const hour = now.getHours();
  const normalizedHour = hour < 5 ? hour + 24 : hour;
  const period = PERIODS.find(item => normalizedHour >= item.from && normalizedHour < item.to) || PERIODS[3];
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const firstName = String(name || '').trim().split(/\s+/)[0];

  return {
    greeting: `${period.greeting}${firstName ? `, ${firstName}` : ''}.`,
    question: period.question,
    timeZone,
    place: localPlace(timeZone),
    localTime: now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}
