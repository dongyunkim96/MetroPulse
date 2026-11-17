export const lines = {
  RD: ['Red', '#fa6474'], OR: ['Orange', '#ffa557'], SV: ['Silver', '#aab8ce'],
  BL: ['Blue', '#62a8fc'], YL: ['Yellow', '#f6d165'], GR: ['Green', '#61d28b'],
};

export const stations = [
  ['N12', 'Ashburn', ['SV'], 46, 138, 0, -14],
  ['N10', 'Dulles Airport', ['SV'], 105, 138, 0, 23],
  ['K08', 'Vienna', ['OR'], 94, 206, -8, 22],
  ['K05', 'East Falls Church', ['OR','SV'], 172, 168, -15, -14],
  ['K01', 'Rosslyn', ['BL','OR','SV'], 253, 168, -4, -15],
  ['C06', 'Pentagon', ['BL','YL'], 276, 274, -13, -14],
  ['C10', 'National Airport', ['BL','YL'], 276, 326, -12, 0, 'end'],
  ['C13', 'Franconia-Springfield', ['BL'], 231, 365, -12, 0, 'end'],
  ['C15', 'Huntington', ['YL'], 324, 365, 12, 4, 'start'],
  ['A15', 'Shady Grove', ['RD'], 207, 52, 0, -14],
  ['A02', 'Farragut North', ['RD'], 293, 98, -9, -14],
  ['A01', 'Metro Center', ['RD','BL','OR','SV'], 344, 168, -12, 23, 'end', 'C01'],
  ['B01', 'Gallery Place', ['RD','GR','YL'], 434, 149, 12, -14, 'start', 'F01'],
  ['B03', 'Union Station', ['RD'], 487, 101, 12, 4, 'start'],
  ['B11', 'Glenmont', ['RD'], 487, 44, 12, 4, 'start'],
  ['E10', 'Greenbelt', ['GR'], 417, 46, -12, 4, 'end'],
  ['D05', 'Capitol South', ['BL','OR','SV'], 481, 215, 0, 23],
  ['D08', 'Stadium-Armory', ['BL','OR','SV'], 557, 215, 0, -15],
  ['D13', 'New Carrollton', ['OR'], 620, 152, 0, -15],
  ['G05', 'Downtown Largo', ['BL','SV'], 638, 256, 0, 23],
  ['D03', "L’Enfant Plaza", ['BL','OR','SV','YL','GR'], 417, 215, -15, 18, 'end', 'F03'],
  ['F11', 'Branch Ave', ['GR'], 563, 354, 2, 22],
].map(([code,name,services,x,y,dx,dy,anchor='middle',secondary]) => ({
  code,
  name, lines: services,x,y,dx,dy,anchor,
  secondary,
}));

export const routes = {
  RD: 'M207 52 H246 L293 98 H314 L344 128 V168 H407 L434 149 L487 101 V44',
  SV: 'M46 138 H141 L172 168 H344 L392 215 H557 L595 256 H638',
  OR: 'M94 206 H129 L172 164 H344 L396 211 H557 L620 152',
  BL: 'M231 365 L276 326 V274 L253 251 V172 H344 L388 219 H557 L594 260 H638',
  GR: 'M417 46 V132 L434 149 L417 166 V260 L510 354 H563',
  YL: 'M324 365 L280 326 V274 H377 L421 230 V166 L434 149 L421 136 V122',
};

export const fixtures = {
  advisories: [
    { title: 'Scheduled track work', detail: 'Sample advisory · Allow extra travel time on the Red Line this evening.', lines: ['RD'] },
    { title: 'Elevator outage at Metro Center', detail: 'Sample advisory · 12th Street entrance elevator is unavailable.', station: 'A01', lines: [] },
  ],
  arrivals(station) {
    const destinations = { RD: ['Shady Grove','Glenmont'], OR: ['Vienna','New Carrollton'], SV: ['Ashburn','Downtown Largo'],
      BL: ['Franconia-Springfield','Downtown Largo'], YL: ['Huntington','Mt Vernon Sq'], GR: ['Branch Ave','Greenbelt'] };
    return station.lines.flatMap((line,i) => destinations[line].map((destination,j) => ({
      line, destination, min: String(3 + i * 2 + j * 7),
    }))).filter(row => row.destination !== station.name).sort((a,b) => Number(a.min) - Number(b.min));
  },
};
