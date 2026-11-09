import moment from 'moment';

export function upcomingMeetingPlans(meetings, today = moment()) {
  const startOfToday = moment(today).startOf('day');
  return (Array.isArray(meetings) ? meetings : [])
    .filter(meeting => {
      const date = moment(meeting?.date);
      return date.isValid() && date.isSameOrAfter(startOfToday);
    })
    .sort((a, b) => moment(a.date).valueOf() - moment(b.date).valueOf())
    .slice(0, 3);
}
