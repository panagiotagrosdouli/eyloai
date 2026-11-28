import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Serve the same handlers and API aliases as Vercel during local development.
// No production proxy or fallback credentials: handlers retain their own guards.
export function localApiPlugin() {
  let root;
  let routes;
  return {
    name: 'eylo-local-api',
    apply: 'serve',
    configResolved(config) { root = config.root; },
    async configureServer(server) {
      const files = await readdir(resolve(root, 'api'));
      routes = new Map(files.filter(file => file.endsWith('.js')).map(file => [
        `/api/${file.slice(0, -3)}`, { file, query: '' },
      ]));
      const hosting = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
      for (const rewrite of hosting.rewrites || []) {
        if (!rewrite.source.startsWith('/api/') || !rewrite.destination.startsWith('/api/')) continue;
        const target = new URL(rewrite.destination, 'http://localhost');
        const route = routes.get(target.pathname);
        if (route) routes.set(rewrite.source, { file: route.file, query: target.search });
      }
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) return next();
        response.setHeader('Cache-Control', 'no-store');
        response.status = code => { response.statusCode = code; return response; };
        response.json = body => {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(body));
          return response;
        };
        response.send = body => { response.end(body); return response; };
        const route = routes.get(url.pathname);
        if (!route) return response.status(404).json({ error: 'API endpoint not found.' });
        request.query = Object.fromEntries(url.searchParams);
        for (const [key, value] of new URLSearchParams(route.query)) request.query[key] = value;
        try {
          const module = await import(pathToFileURL(resolve(root, 'api', route.file)).href);
          // Stripe must receive the original stream for signature verification.
          if (module.config?.api?.bodyParser !== false && !['GET', 'HEAD'].includes(request.method)) {
            let size = 0;
            const chunks = [];
            for await (const chunk of request) {
              size += chunk.length;
              if (size > 1024 * 1024) return response.status(413).json({ error: 'Request body too large.' });
              chunks.push(chunk);
            }
            const body = Buffer.concat(chunks).toString('utf8');
            if (/^application\/json\b/i.test(request.headers['content-type'] || '')) {
              try { request.body = body ? JSON.parse(body) : {}; }
              catch { return response.status(400).json({ error: 'Invalid JSON request body.' }); }
            } else request.body = body;
          }
          await module.default(request, response);
        } catch {
          server.config.logger.error(`Local API handler failed: ${url.pathname}`);
          if (!response.headersSent) response.status(500).json({ error: 'Local API request failed.' });
          else response.end();
        }
      });
    },
  };
}
