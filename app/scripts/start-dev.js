/**
 * Starts Expo with a stable LAN hostname on Windows so Metro/HMR can reconnect
 * without "Cannot connect to Metro" / manual refresh every time.
 */
const { spawn } = require('child_process');
const os = require('os');

function getLanIPv4() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

const lanIp = getLanIPv4();
const args = process.argv.slice(2);
const useTunnel = args.includes('--tunnel');
const extraArgs = args.filter((a) => a !== '--tunnel');

if (lanIp && !useTunnel) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
  console.log(`[start-dev] Using LAN IP for Metro: ${lanIp}`);
} else if (useTunnel) {
  console.log('[start-dev] Tunnel mode — skipping REACT_NATIVE_PACKAGER_HOSTNAME');
} else {
  console.warn('[start-dev] No LAN IP found — Metro may fail to reconnect on Windows');
}

const expoArgs = [
  'expo',
  'start',
  '--dev-client',
  ...(useTunnel ? ['--tunnel'] : []),
  ...extraArgs,
];
const child = spawn('npx', expoArgs, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
