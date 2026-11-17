const cache = new Map();
const pending = new Map();
const definitions = {
  stations: ['/Rail.svc/json/jStations', 'Stations', 3600_000, 86400_000],
  incidents: ['/Incidents.svc/json/Incidents', 'Incidents', 45_000, 600_000],
  elevators: ['/Incidents.svc/json/ElevatorIncidents', 'ElevatorIncidents', 60_000, 600_000],
  arrivals: ['/StationPrediction.svc/json/GetPrediction/All', 'Trains', 25_000, 120_000],
};

async function upstream(name, key, fetcher) {
  const [path, field, ttl, maxAge] = definitions[name];
  const previous = cache.get(name);
  if (previous && Date.now() - previous.at < ttl) return previous;
  if (pending.has(name)) return pending.get(name);

  const request = (async () => {
    try {
      const response = await fetcher('https://api.wmata.com' + path, {
        headers: { api_key: key, accept: 'application/json' },
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error('WMATA request failed');
      const payload = await response.json();
      if (!Array.isArray(payload[field])) throw new Error('Unexpected WMATA response');
      const result = { state: 'fresh', at: Date.now(), items: payload[field] };
      cache.set(name, result);
      return result;
    } catch {
      if (previous && Date.now() - previous.at < maxAge) return { ...previous, state: 'stale' };
      return { state: 'unavailable', at: null, items: [] };
    }
  })();
  pending.set(name, request);
  try { return await request; } finally { pending.delete(name); }
}

export function createHandler(assets, fetcher = fetch) {
  return {
    async fetch(request, env = {}) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      const path = new URL(request.url).pathname;
      if (path === '/api/transit') {
        if (!env.WMATA_API_KEY) {
          return Response.json({ mode: 'demo', reason: 'missing_key' }, { headers: { 'Cache-Control': 'no-store' } });
        }
        const feeds = Object.fromEntries(await Promise.all(Object.keys(definitions).map(async name =>
          [name, await upstream(name, env.WMATA_API_KEY, fetcher)])));
        return Response.json({ mode: 'live', feeds }, { headers: { 'Cache-Control': 'no-store' } });
      }

      const asset = Object.hasOwn(assets, path) ? assets[path] : null;
      if (!asset) return new Response('Not found', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : asset.body, { headers: {
        'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; object-src 'none'",
        'Cache-Control': 'no-cache',
      }});
    },
  };
}
