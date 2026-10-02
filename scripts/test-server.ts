// Runs a production build of the app on :3199 against tmp/testdata, for UI testing without
// touching real projects. Build first with `npm run build`.
process.env.API_PORT = '3199';
process.env.DATA_DIR = new URL('../tmp/testdata', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
process.argv.push('--prod');
await import('../server/index');
