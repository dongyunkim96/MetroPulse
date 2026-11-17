import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from './server.js';

const request = new Request('https://local.example/api/transit');

test('missing WMATA key returns labeled demo mode without an upstream request', async () => {
  const worker = createHandler({}, () => assert.fail('Unexpected upstream request'));
  assert.deepEqual(await (await worker.fetch(request)).json(), { mode: 'demo', reason: 'missing_key' });
});

test('parallel clients share requests and a broken feed does not erase healthy reports', async () => {
  const visited = [];
  const worker = createHandler({}, async (url, options) => {
    assert.equal(options.headers.api_key, 'test-only');
    visited.push(url);
    if (url.includes('ElevatorIncidents')) return new Response(null, { status: 503 });
    if (url.includes('jStations')) return Response.json({ Stations: [{ Code: 'A01' }] });
    if (url.includes('GetPrediction')) return Response.json({ Trains: [{ LocationCode: 'A01', Min: 'BRD' }] });
    return Response.json({ Incidents: [] });
  });
  const outputs = await Promise.all([worker.fetch(request, { WMATA_API_KEY: 'test-only' }),
    worker.fetch(request, { WMATA_API_KEY: 'test-only' })]);
  for (const response of outputs) {
    const data = await response.json();
    assert.equal(data.mode, 'live');
    assert.equal(data.feeds.elevators.state, 'unavailable');
    assert.equal(data.feeds.arrivals.items[0].Min, 'BRD');
    assert.equal(data.feeds.stations.state, 'fresh');
    assert.deepEqual(data.feeds.incidents.items, []);
  }
  assert.equal(visited.length, 4);
});
