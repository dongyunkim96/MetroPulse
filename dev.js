import { createServer } from 'node:http';
import worker from './dist/server/index.js';

const port = Number(process.env.PORT || 4173);
createServer(async (incoming, outgoing) => {
  try {
    const response = await worker.fetch(new Request('http://localhost:' + port + incoming.url, {
      method: incoming.method,
    }), process.env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end('Server error');
  }
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port));
