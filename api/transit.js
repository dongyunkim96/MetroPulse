import { createHandler } from '../server.js';

const transit = createHandler({});

export default {
  fetch(request) {
    return transit.fetch(request, { WMATA_API_KEY: process.env.WMATA_API_KEY });
  },
};
