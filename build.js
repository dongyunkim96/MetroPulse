import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const files = {
  '/': ['index.html', 'text/html'],
  '/styles.css': ['styles.css', 'text/css'],
  '/app.js': ['app.js', 'text/javascript'],
  '/demo.js': ['demo.js', 'text/javascript'],
};

await Promise.all([
  mkdir('dist/server', { recursive: true }),
  mkdir('dist/public', { recursive: true }),
]);

const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([path, [file, type]]) =>
  [path, { type: type + '; charset=utf-8', body: await readFile(file, 'utf8') }])));

await Promise.all([
  writeFile('dist/server/index.js', (await readFile('server.js', 'utf8')) +
    '\nexport default createHandler(' + JSON.stringify(assets) + ');\n'),
  ...Object.values(files).map(([file]) => copyFile(file, 'dist/public/' + file)),
]);
