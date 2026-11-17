import { lines, stations, routes, fixtures } from './demo.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const time = at => at ? new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York',
}).format(at) + ' ET' : '';
const codes = values => [...new Set(values.filter(code => Object.hasOwn(lines, code)))];
const lineCodes = record => codes([record.LineCode1, record.LineCode2, record.LineCode3, record.LineCode4]);
const badge = (code, full = false) => lines[code]
  ? '<span class="line" style="--line:' + lines[code][1] + '"><i></i>' + (full ? lines[code][0] : code) + '</span>'
  : '<span class="line">—</span>';
const viewText = {
  home: ['MetroPulse', ''],
  network: ['Network overview', 'Explore the rail network, check arrivals, and track service changes.'],
  advisories: ['Service advisories', 'Check rail disruptions and elevator or escalator outages.'],
  saved: ['Saved stations', 'Keep your regular stops close at hand.'],
};

function storedStations() {
  try {
    const records = JSON.parse(localStorage.getItem('metropulse-stations') || '[]');
    return Array.isArray(records) ? records.filter(item => typeof item?.code === 'string' && typeof item?.name === 'string') : [];
  } catch { return []; }
}

const state = {
  mode: 'loading', view: 'home', selected: 'A01', filter: '', stations, feeds: {},
  saved: storedStations(), error: false, loading: false,
};
const search = $('search');
let matches = [];
let option = -1;

function selectedStation() {
  return state.stations.find(s => s.code === state.selected);
}

function isSaved(code) {
  return state.saved.some(s => s.code === code);
}

function toggleSaved(station) {
  state.saved = isSaved(station.code)
    ? state.saved.filter(s => s.code !== station.code)
    : [...state.saved, { code: station.code, name: station.name }];
  try { localStorage.setItem('metropulse-stations', JSON.stringify(state.saved)); } catch { /* Session still works. */ }
  render();
  $('save-station')?.focus();
}

function stationRecords(feed) {
  if (!feed?.items.length) return stations;
  const byCode = new Map(feed.items.map(s => [s.Code,s]));
  return feed.items.filter(s => s.Code && s.Name).flatMap(s => {
    const sibling = byCode.get(s.StationTogether1) ?? byCode.get(s.StationTogether2);
    if (sibling && sibling.Name === s.Name && sibling.Code < s.Code) return [];
    return [{
      code: s.Code, name: s.Name, lat: Number(s.Lat), lon: Number(s.Lon),
      secondary: sibling?.Code, lines: codes([...lineCodes(s), ...lineCodes(sibling ?? {})]),
    }];
  });
}

function feedLabel(feed) {
  if (state.mode === 'demo') return 'Sample data';
  if (feed?.state === 'stale') return 'Delayed · ' + time(feed.at);
  if (feed?.state === 'fresh') return time(feed.at);
  return 'Unavailable';
}

function renderStatus() {
  const degraded = state.error || (state.mode === 'live' &&
    Object.values(state.feeds).some(feed => feed.state !== 'fresh'));
  const mode = $('mode');
  mode.dataset.mode = degraded ? 'degraded' : state.mode;
  mode.innerHTML = '<i></i>' + (degraded ? 'Feed degraded' :
    state.mode === 'demo' ? 'Demo mode' : state.mode === 'live' ? 'WMATA feed' : 'Connecting');
  const notice = $('notice');
  const message = state.error
    ? 'The transit server could not be reached. Any previously loaded data may be delayed.'
    : state.mode === 'demo' ? 'Demo mode · Sample arrivals and advisories. Live data requires a WMATA developer key.'
    : degraded ? 'Some WMATA feeds are delayed or unavailable. Each section shows its own update status.' : '';
  if (notice.textContent !== message) notice.textContent = message;
  notice.hidden = !message || state.view === 'home';
  $('refresh').disabled = state.loading;
}

function renderStats() {
  const incidentFeed = state.feeds.incidents;
  const incidents = state.mode === 'demo' ? '1' : incidentFeed?.state === 'unavailable'
    ? '—' : incidentFeed?.items.length ?? '—';
  $('stats').innerHTML = [
    ['◎', state.mode === 'demo' || !state.feeds.stations?.items.length ? 'Mapped stations' : 'Stations indexed',
      state.mode === 'loading' ? '—' : state.stations.length],
    ['≋', state.mode === 'demo' ? 'Sample rail advisories' : 'Rail advisories', incidents],
    ['☆', 'Saved stations', state.saved.length],
  ].map(([icon,label,value]) => '<div class="stat"><span class="stat-icon" aria-hidden="true">' + icon
    + '</span><div><small>' + label + '</small><strong>' + value + '</strong></div></div>').join('');
}

function renderMap() {
  const diagram = $('diagram');
  const focused = document.activeElement?.dataset?.station;
  const activeLine = state.filter;
  const geographic = state.feeds.stations?.items.length > 0;
  const plotted = geographic
    ? state.stations.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon) &&
      s.lat > 38 && s.lat < 40 && s.lon > -79 && s.lon < -76).map(s => ({
      ...s, x: ((s.lon + 77.52) / .66) * 605 + 36, y: ((39.15 - s.lat) / .43) * 330 + 31,
      dx: 9, dy: -10, anchor: 'start',
    })).filter(s => s.x > 18 && s.x < 662 && s.y > 18 && s.y < 370)
    : stations;
  $('map-label').textContent = geographic ? 'Station locations' : 'Key stations · schematic';
  const track = geographic ? '' : Object.entries(routes).map(([code,d]) =>
    '<path class="route" d="' + d + '" stroke="' + lines[code][1] + '" opacity="' +
    (!activeLine || code === activeLine ? .9 : .16) + '"/>').join('');
  const nodes = plotted.filter(s => !activeLine || s.lines.includes(activeLine)).map(s => {
    const active = s.code === state.selected;
    const color = lines[s.lines[0]]?.[1] ?? '#aab8ce';
    const labeled = active || !geographic;
    const anchor = geographic && s.x > 525 ? 'end' : s.anchor;
    return '<g class="stop ' + (active ? 'active' : '') + '" tabindex="0" role="button" aria-pressed="' + active
      + '" aria-label="' + escape(s.name) + '" data-station="' + escape(s.code) + '"><title>' + escape(s.name)
      + '</title><circle cx="' + s.x + '" cy="' + s.y + '" r="' + (geographic ? 8 : 13)
      + '" fill="transparent"/>' + (active ? '<circle class="halo" cx="' + s.x + '" cy="' + s.y + '" r="11"/>' : '')
      + '<circle class="dot" cx="' + s.x + '" cy="' + s.y + '" r="' + (geographic ? 3.1 : 5) + '" stroke="' + color
      + '"/>' + (labeled ? '<text x="' + (s.x + (geographic && anchor === 'end' ? -s.dx : s.dx))
      + '" y="' + (s.y + s.dy) + '" text-anchor="' + anchor + '">' + escape(s.name) + '</text>' : '') + '</g>';
  }).join('');
  diagram.innerHTML = '<path d="M199 36 C187 103 258 119 239 184 S297 207 264 246 S223 284 225 338 S247 368 250 390"'
    + ' fill="none" stroke="#172a41" stroke-width="24" opacity="' + (geographic ? 0 : .9) + '"/>' + track + nodes;
  if (focused) document.querySelector('[data-station="' + CSS.escape(focused) + '"]')?.focus();
  for (const button of $('legend').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.line === activeLine));
  }
}

function renderStation() {
  const container = $('station');
  const s = selectedStation();
  if (!s) { container.textContent = 'Select a station to get started.'; return; }
  const hadFocus = document.activeElement?.id === 'save-station';
  const feed = state.feeds.arrivals;
  const demo = state.mode === 'demo';
  const identifiers = [s.code, s.secondary].filter(Boolean);
  const rows = demo ? fixtures.arrivals(s) : (feed?.items ?? [])
    .filter(row => identifiers.includes(row.LocationCode) && row.DestinationName)
    .map(row => ({ line: row.Line, destination: row.DestinationName, min: row.Min }))
    .sort((a,b) => arrivalRank(a.min) - arrivalRank(b.min));
  const elevatorFeed = state.feeds.elevators;
  const elevators = demo ? fixtures.advisories.filter(row => row.station === s.code).map(row => row.detail)
    : (elevatorFeed?.items ?? []).filter(row => identifiers.includes(row.StationCode))
      .map(row => [row.UnitType, row.StationName, row.SymptomDescription].filter(Boolean).join(' · '));
  const emptyArrivals = state.mode === 'loading' ? 'Checking the transit feed…'
    : feed?.state === 'unavailable' || !feed && !demo ? 'Arrival predictions are unavailable.'
    : 'No upcoming predictions for this station.';
  const emptyAccess = state.mode === 'loading' ? 'Checking accessibility reports…'
    : elevatorFeed?.state === 'unavailable' || !elevatorFeed && !demo ? 'Accessibility reports are unavailable.'
    : 'No elevator or escalator outages in this report.';
  const saved = isSaved(s.code);
  container.innerHTML = '<div class="station-heading"><div><h3 id="selected-name" tabindex="-1">' + escape(s.name)
    + '</h3><div class="lines">' + s.lines.map(code => badge(code,true)).join('') + '</div></div>'
    + '<button id="save-station" class="save" aria-label="' + (saved ? 'Remove saved station' : 'Save station')
    + '" aria-pressed="' + saved + '">' + (saved ? '★' : '☆') + '</button></div>'
    + '<div class="section-head"><h3>Next trains</h3><small>' + escape(feedLabel(feed)) + '</small></div>'
    + (rows.slice(0,5).map(row => '<div class="arrival">' + badge(row.line) + '<span>' + escape(row.destination)
      + '</span><b>' + escape(displayArrival(row.min)) + '</b></div>').join('') || '<p class="subtle">' + emptyArrivals + '</p>')
    + '<div class="section-head"><h3>Station accessibility</h3><small>' + escape(feedLabel(elevatorFeed)) + '</small></div>'
    + '<div class="access">' + (elevators.length ? elevators.map(detail => '<p>' + escape(detail) + '</p>').join('')
      : '<p>' + emptyAccess + '</p>') + '</div>';
  $('save-station').onclick = () => toggleSaved(s);
  if (hadFocus) $('save-station').focus();
}

function arrivalRank(min) {
  return min === 'BRD' ? -2 : min === 'ARR' ? -1 : /^\d+$/.test(min) ? Number(min) : Infinity;
}

function displayArrival(min) {
  if (min === 'BRD') return 'Boarding';
  if (min === 'ARR') return 'Arriving';
  return /^\d+$/.test(min) ? min + ' min' : '—';
}

function renderAlternate() {
  const target = $('alternate');
  if (state.view === 'network') return;
  if (state.view === 'saved') {
    const rows = state.saved.map(s => '<div class="entry"><h3>' + escape(s.name)
      + '</h3><button class="control" data-open="' + escape(s.code) + '"' +
      (state.stations.some(item => item.code === s.code) ? '' : ' disabled') + '>View station</button> '
      + '<button class="control" data-remove="' + escape(s.code) + '" aria-label="Remove ' + escape(s.name)
      + ' from saved stations">Remove</button></div>').join('');
    target.innerHTML = '<h2>Your stations</h2>' + (rows || '<p class="subtle">No saved stations yet. Open a station and select the star to add it.</p><div class="entry"><a href="#network">Explore the network →</a></div>');
    return;
  }
  const { incidents, elevators } = state.feeds;
  const demo = state.mode === 'demo';
  const rail = demo ? fixtures.advisories.filter(row => !row.station) : (incidents?.items ?? []).map(row => ({
    title: row.IncidentType || 'Rail advisory', detail: row.Description,
    lines: codes(String(row.LinesAffected ?? '').split(';').map(code => code.trim())),
  }));
  const access = demo ? fixtures.advisories.filter(row => row.station) : (elevators?.items ?? []).map(row => ({
    title: [row.StationName, row.UnitType].filter(Boolean).join(' · ') || 'Station outage',
    detail: row.SymptomDescription, lines: [],
  }));
  target.innerHTML = advisorySection('Rail service', rail, incidents) +
    advisorySection('Elevators & escalators', access, elevators);
}

function advisorySection(title, rows, feed) {
  return '<div class="section-head"><h2>' + title + '</h2><small>' + escape(feedLabel(feed)) + '</small></div>'
    + (rows.map(row => '<article class="entry"><h3>' + escape(row.title) + '</h3><p class="subtle">'
      + escape(row.detail) + '</p><div class="lines">' + row.lines.map(code => badge(code,true)).join('')
      + '</div></article>').join('') || '<p class="subtle">'
      + (state.mode === 'loading' ? 'Checking service reports…' : feed?.state === 'unavailable' || !feed && state.mode !== 'demo'
        ? 'This feed is currently unavailable.' : 'No active reports in this feed.') + '</p>');
}

function render() {
  const [title, subtitle] = viewText[state.view];
  $('title').textContent = title;
  $('subtitle').textContent = subtitle;
  for (const link of document.querySelectorAll('nav a[data-view]')) {
    if (link.dataset.view === state.view) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  const home = state.view === 'home';
  $('home-view').hidden = !home;
  $('dashboard-intro').hidden = home;
  $('stats').hidden = home;
  $('network-view').hidden = state.view !== 'network';
  $('alternate').hidden = home || state.view === 'network';
  renderStatus();
  if (home) return;
  renderStats();
  if (state.view === 'network') { renderMap(); renderStation(); }
  else renderAlternate();
}

function renderSearch() {
  const query = search.value.trim().toLowerCase();
  matches = query ? state.stations.filter(s => s.name.toLowerCase().includes(query)).slice(0,10) : [];
  option = -1;
  $('results').hidden = !query;
  $('results').innerHTML = matches.map((s,i) => '<div class="option" role="option" aria-selected="false" id="match-'
    + i + '" data-option="' + i + '">' + escape(s.name) + '</div>').join('')
    || '<div class="option" role="presentation">No matching stations</div>';
  search.setAttribute('aria-expanded', String(Boolean(query)));
  search.removeAttribute('aria-activedescendant');
}

function closeSearch() {
  $('results').hidden = true;
  search.setAttribute('aria-expanded','false');
  search.removeAttribute('aria-activedescendant');
}

function selectStation(code, focus = false) {
  const candidate = state.stations.find(s => s.code === code);
  if (!candidate) return;
  if (state.filter && !candidate.lines.includes(state.filter)) state.filter = '';
  state.selected = code;
  state.view = 'network';
  const hash = '#network/' + encodeURIComponent(code);
  if (location.hash !== hash) history.pushState(null, '', hash);
  search.value = '';
  closeSearch();
  render();
  if (focus) $('selected-name')?.focus();
}

async function update() {
  if (state.loading) return;
  state.loading = true;
  renderStatus();
  try {
    const response = await fetch('/api/transit', { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error('Transit endpoint unavailable');
    const data = await response.json();
    state.error = false;
    state.mode = data.mode;
    state.feeds = data.feeds ?? {};
    state.stations = stationRecords(state.feeds.stations);
    applyLinkedStation();
    if (!selectedStation()) state.selected = state.stations[0]?.code;
    if (!$('results').hidden) renderSearch();
  } catch {
    state.error = true;
    if (state.mode === 'loading') state.mode = 'error';
    state.feeds = Object.fromEntries(Object.entries(state.feeds).map(([name, feed]) =>
      [name, feed.state === 'fresh' ? { ...feed, state:'stale' } : feed]));
  } finally {
    state.loading = false;
    render();
  }
}

$('legend').innerHTML = '<button data-line="">All lines</button>' + Object.entries(lines)
  .map(([code,[name,color]]) => '<button data-line="' + code + '" style="--line:' + color + '"><i></i>' + name + '</button>').join('');
$('legend').addEventListener('click', event => {
  const button = event.target.closest('button[data-line]');
  if (!button) return;
  state.filter = button.dataset.line;
  renderMap();
});
$('diagram').addEventListener('click', event => {
  const node = event.target.closest('[data-station]');
  if (node) selectStation(node.dataset.station, matchMedia('(max-width: 730px)').matches);
});
$('diagram').addEventListener('keydown', event => {
  const node = event.target.closest('[data-station]');
  if (node && ['Enter',' '].includes(event.key)) {
    event.preventDefault();
    selectStation(node.dataset.station, true);
  }
});
search.addEventListener('input', renderSearch);
search.addEventListener('focus', () => { if (search.value) renderSearch(); });
search.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeSearch(); return; }
  if (!matches.length || $('results').hidden) return;
  if (event.key === 'Enter') { event.preventDefault(); selectStation(matches[Math.max(0,option)].code,true); }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    option = (option + (event.key === 'ArrowDown' ? 1 : option < 0 ? 0 : -1) + matches.length) % matches.length;
    for (const [i,item] of Array.from($('results').children).entries()) item.setAttribute('aria-selected', String(i === option));
    const item = $('match-' + option);
    search.setAttribute('aria-activedescendant', item.id);
    item.scrollIntoView({ block:'nearest' });
  }
});
$('results').addEventListener('pointerdown', event => event.preventDefault());
$('results').addEventListener('click', event => {
  const entry = event.target.closest('[data-option]');
  if (entry) selectStation(matches[Number(entry.dataset.option)].code, true);
});
search.addEventListener('blur', closeSearch);
$('alternate').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.dataset.open) selectStation(button.dataset.open,true);
  if (button?.dataset.remove) {
    toggleSaved({ code: button.dataset.remove });
    ($('alternate').querySelector('button, a') ?? $('title')).focus();
  }
});
$('refresh').addEventListener('click', update);

function applyLinkedStation() {
  const [,code] = location.hash.slice(1).split('/');
  if (state.view !== 'network' || !/^[A-Z][0-9]{2}$/.test(code ?? '')) return;
  const linked = state.stations.find(s => s.code === code || s.secondary === code);
  if (!linked) return;
  state.selected = linked.code;
  if (!linked.lines.includes(state.filter)) state.filter = '';
}

function route(event) {
  const [view, code] = location.hash.slice(1).split('/');
  if (view === 'main') return;
  state.view = Object.hasOwn(viewText, view) ? view : 'home';
  applyLinkedStation();
  closeSearch();
  render();
  if (event) {
    const target = state.view === 'home' ? 'home-title'
      : state.view === 'network' && code ? 'selected-name' : 'title';
    $(target)?.focus();
  }
}
window.addEventListener('hashchange', route);
route();
update();
setInterval(() => { if (!document.hidden && state.mode !== 'demo') update(); }, 30_000);
