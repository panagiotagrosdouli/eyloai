import { applyCors } from '../src/lib/api-cors.mjs';
import { runCalendarReminderDispatch } from '../src/lib/calendar-reminders-api.mjs';

export default async function handler(request, response) {
  if (applyCors(request, response, ['GET'])) return;
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  const result = await runCalendarReminderDispatch({ authorization: request.headers.authorization });
  return response.status(result.status).json(result.body);
}
