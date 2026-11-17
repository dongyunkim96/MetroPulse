# MetroPulse

**An independent Washington Metro dashboard for checking train arrivals, rail advisories, and station accessibility.**

[Open the live site](https://metropulse-azure.vercel.app) · [Check the API](https://metropulse-azure.vercel.app/api/transit)

MetroPulse brings the information riders need before leaving home into one place. Start with an interactive rail map or search for a station by name. Open a station to see upcoming trains and accessibility reports, then save recurring stops for quick access.

The hosted site currently runs in **Demo mode** and labels sample arrivals and advisories in the UI. Add a WMATA developer API key on the server to enable the upstream feeds.

## What you can do

| Screen | What it does |
| --- | --- |
| **Home** | Introduces the service and links directly to Metro Center, Vienna, and Dulles Airport. |
| **Network** | Explore the rail map, filter by line, and search stations with keyboard or pointer controls. Station details show destination, arrival estimate, and accessibility reports. |
| **Advisories** | Review rail service alerts and elevator or escalator outages, with separate status and update times for each feed. |
| **Saved Stations** | Save or remove stations and reopen them from the same browser. |

Station views can be shared using a URL such as [Metro Center](https://metropulse-azure.vercel.app/#network/A01). Saved stations use browser local storage and persist on the same browser and origin. The interface includes a skip link, focus indicators, keyboard station search, responsive layouts, and reduced-motion styles.

## Technology and architecture

- **Frontend:** semantic HTML, CSS, and native JavaScript modules. The route is stored in the URL hash, allowing static hosting with browser navigation and station deep links.
- **Backend:** one same-origin endpoint, `GET /api/transit`. The shared handler runs locally through Node.js and on Vercel through `api/transit.js`.
- **Hosting:** Vercel serves the static build from `dist/public` and deploys the transit endpoint as a Node.js Function.
- **Testing:** Node's built-in test runner exercises the data handler with injected upstream responses.
- **Runtime dependencies:** none beyond the browser and Node.js runtime.

```text
Browser → Vercel static frontend → same-origin /api/transit
                                         ↓
                                  Vercel Function
                                         ↓
                       WMATA stations, arrivals, and advisories
```

The backend sends WMATA requests concurrently, keeps the key server-side, and checks each response before making it available to the browser. A failed feed preserves results from successful feeds. Last-known data is labeled delayed and expires after a feed-specific limit. The cache and in-flight request deduplication are per running instance and can reset on cold starts or differ across instances.

## WMATA data

The application calls the [WMATA Developer API](https://developer.wmata.com/). Transit data is provided by WMATA.

| Feed | Upstream path | Fresh cache | Maximum retained age on failure |
| --- | --- | ---: | ---: |
| Rail stations | `/Rail.svc/json/jStations` | 60 minutes | 24 hours |
| Arrival predictions | `/StationPrediction.svc/json/GetPrediction/All` | 25 seconds | 2 minutes |
| Rail incidents | `/Incidents.svc/json/Incidents` | 45 seconds | 10 minutes |
| Accessibility incidents | `/Incidents.svc/json/ElevatorIncidents` | 60 seconds | 10 minutes |

For live mode, each feed in the API response includes a `state` (`fresh`, `stale`, or `unavailable`), an `at` timestamp in epoch milliseconds or `null`, and an `items` array. The dashboard refreshes automatically every 30 seconds while its tab is visible and also offers a manual refresh. Live mode plots station coordinates from WMATA. Demo mode draws a simplified schematic of selected stations and shows sample reports.

## Run locally

Requirements: Node.js 20.19 or newer and Git. The Vercel deployment uses Node.js 22.

```bash
git clone https://github.com/dongyunkim96/MetroPulse.git
cd MetroPulse
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). No package install or API key is required for demo mode.

### Enable WMATA feeds

1. Obtain a developer key in the [WMATA developer portal](https://developer.wmata.com/).
2. Set `WMATA_API_KEY` in the environment used to start the server, then restart it. PowerShell uses `$env:WMATA_API_KEY = '<your key>'`. Bash or zsh uses `export WMATA_API_KEY='<your key>'`.
3. On Vercel, add `WMATA_API_KEY` under **Project → Settings → Environment Variables** for the environments you want to use, then redeploy.

The `.env.example` file documents the variable name. The local entry point reads the process environment. Keep real credentials out of Git and browser code.

## Test and build

```bash
npm test
npm run build
```

The tests cover demo mode with no upstream calls, concurrent request deduplication, and partial upstream failure. The build generates `dist/public/` for Vercel and `dist/server/index.js` for the local server. To smoke-test a deployment, open the homepage, follow a featured station link, and check `/api/transit` for an HTTP 200 and the expected mode.

## Deploy to Vercel

Import this repository into Vercel and leave the project root at the repository root. The versioned `vercel.json` uses `npm run build` and serves `dist/public`. Vercel discovers `api/transit.js` as the transit function. The public production deployment is [metropulse-azure.vercel.app](https://metropulse-azure.vercel.app).

## Project structure

| Path | Responsibility |
| --- | --- |
| `index.html` | Home, dashboard layout, and navigation |
| `styles.css` | Visual design, responsive layout, and focus states |
| `app.js` | Routing, station search, map, transit rendering, and favorites |
| `demo.js` | Demo stations, rail diagram, and labeled sample data |
| `server.js` | WMATA upstream requests, caching, and response handling |
| `api/transit.js` | Vercel Function entry point |
| `build.js`, `dev.js` | Build output and local development server |
| `server.test.js` | Transit API tests |
| `vercel.json` | Build and hosting settings |

MetroPulse is an independent project and is not affiliated with WMATA.
