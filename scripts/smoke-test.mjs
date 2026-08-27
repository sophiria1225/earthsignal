import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 43_000 + (process.pid % 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/server.cjs'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += String(chunk); });
server.stderr.on('data', chunk => { serverOutput += String(chunk); });

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // 起動完了まで短く再試行する。
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`EarthSignal server did not start:\n${serverOutput}`);
}

async function readJson(path, init = {}, timeoutMs = 55_000) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = await response.json();
  return { response, body };
}

try {
  await waitForServer();

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('x-frame-options'), 'DENY');
  assert.match(health.headers.get('content-security-policy') || '', /default-src 'self'/);

  const earthquakes = await readJson('/api/data/earthquakes?limit=3');
  assert.equal(typeof earthquakes.body.isLive, 'boolean');
  assert.ok(Array.isArray(earthquakes.body.earthquakes));
  assert.ok(earthquakes.body.earthquakes.length <= 3);

  const weather = await readJson('/api/data/weather/cell_tokyo_01');
  assert.equal(typeof weather.body.isLive, 'boolean');
  assert.ok(weather.body.weather === null || weather.body.weather.cellId === 'cell_tokyo_01');

  const social = await readJson('/api/social/posts');
  assert.ok([200, 502].includes(social.response.status));
  assert.equal(typeof social.body.isLive, 'boolean');
  assert.ok(Array.isArray(social.body.posts));
  assert.ok(Array.isArray(social.body.sources));

  const invalidAi = await readJson('/api/ai/explain-anomaly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cellId: '../../etc/passwd', score: 50 }),
  });
  assert.equal(invalidAi.response.status, 400);

  const malformedAi = await fetch(`${baseUrl}/api/ai/explain-anomaly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  });
  assert.equal(malformedAi.status, 400);
  assert.match(malformedAi.headers.get('content-type') || '', /application\/json/);

  const missingApi = await readJson('/api/does-not-exist');
  assert.equal(missingApi.response.status, 404);
  assert.equal(missingApi.body.error, 'API endpoint not found');

  const spa = await fetch(`${baseUrl}/client-side-route`);
  assert.equal(spa.status, 200);
  assert.match(spa.headers.get('content-type') || '', /text\/html/);
  assert.equal(spa.headers.get('cache-control'), 'no-cache');

  const indexHtml = await (await fetch(baseUrl)).text();
  const assetPath = indexHtml.match(/(?:src|href)="(\/assets\/[^"]+)"/)?.[1];
  assert.ok(assetPath, 'built index should reference a hashed asset');
  const asset = await fetch(`${baseUrl}${assetPath}`);
  assert.match(asset.headers.get('cache-control') || '', /immutable/);

  process.stdout.write('EarthSignal production smoke test passed.\n');
} finally {
  server.kill('SIGTERM');
}
