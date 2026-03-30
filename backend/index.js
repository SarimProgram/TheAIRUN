try {
  require('./dist/server.js');
} catch (error) {
  const isMissingBuild =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'MODULE_NOT_FOUND';

  if (isMissingBuild) {
    console.error('Missing dist/server.js. Run `npm run build` in backend before starting with `node index.js`.');
  } else {
    console.error('Failed to start backend via dist/server.js.', error);
  }

  process.exit(1);
}
