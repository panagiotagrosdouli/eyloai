import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractRouteSourceInventory } from '../src/lib/route-source-inventory.mjs';

test('static inventory covers actual public and private paths without counting catchall routes', async () => {
  const source = await readFile('src/App.jsx', 'utf8');
  const routes = extractRouteSourceInventory(source);
  assert.ok(routes.public_routes.length >= 10);
  assert.ok(routes.private_routes.length >= 40);
  for (const path of ['/', '/login', '/register', '/contact', '/careers', '/company/:section']) {
    assert.ok(routes.public_routes.includes(path), `Expected public route: ${path}`);
  }
  for (const path of ['/home', '/library', '/projects/:id', '/documents/:id', '/learn', '/research-gaps']) {
    assert.ok(routes.private_routes.includes(path), `Expected private route: ${path}`);
  }
  assert.equal(routes.public_routes.includes('/*'), false);
  assert.equal(routes.private_routes.includes('*'), false);
  assert.equal(new Set(routes.public_routes).size, routes.public_routes.length);
  assert.equal(new Set(routes.private_routes).size, routes.private_routes.length);
});

test('route scanner fails closed if security routing architecture changes', async () => {
  const source = await readFile('src/App.jsx', 'utf8');
  assert.throws(
    () => extractRouteSourceInventory(source.replace('<Route element={<ProtectedRoute />}>', '<Route element={<OtherBoundary />}>')),
    /routing architecture changed/i,
  );
  assert.throws(() => extractRouteSourceInventory(null), /Routing source/);
});
