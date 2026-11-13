// Consolidate small endpoints to stay within the Vercel Hobby function limit.
// Keep each handler's own CORS, HTTP method and authorization behavior.
import capabilities from '../server/capabilities.js';
import contact from '../server/contact.js';
import deploymentStatus from '../server/deployment-status.js';

import {adminOperations,developerRead} from '../server/product-api.js';

const handlers = Object.freeze({
  capabilities,
  'admin-operations':adminOperations,
  developer:developerRead,
  contact,
  'deployment-status': deploymentStatus,
});

export default function handler(request, response) {
  const endpoint = request.query?.endpoint;
  const selected = typeof endpoint === 'string' && Object.hasOwn(handlers, endpoint)
    ? handlers[endpoint]
    : null;
  if (!selected) {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(404).json({ error: 'API endpoint not found.' });
  }
  return selected(request, response);
}
