import { spawn, spawnSync } from 'node:child_process';

const portArgument = process.argv.find((argument) => argument.startsWith('--port='));
const port = Number(portArgument?.split('=')[1] ?? process.env.AGENT_HARNESS_PORT ?? 8090);
const baseUrl = `http://127.0.0.1:${port}`;
const fullSuite = process.argv.includes('--full');

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid agent harness port: ${port}`);
}

async function command(name, args) {
  const result = spawn(name, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  // Keep draining Expo's pipes while browser checks run to avoid backpressure.
  await new Promise((resolve, reject) => {
    result.once('error', reject);
    result.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${name} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}.`)));
  });
}

async function waitForExpo(server, output) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Expo exited before the harness could connect.\n${output.value.slice(-4000)}`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // Expo is still bundling.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Expo did not become ready at ${baseUrl}.\n${output.value.slice(-4000)}`);
}

function stopProcessTree(server) {
  if (!server || server.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
}

let server;
const serverOutput = { value: '' };

try {
  console.log('AGENT_HARNESS_STATIC_CHECKS');
  await command('npm', ['run', 'typecheck']);
  await command('npm', ['run', 'lint']);

  console.log(`AGENT_HARNESS_START_EXPO ${baseUrl}`);
  server = spawn('npm', ['run', 'web', '--', '--port', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: 'none', CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  const captureOutput = (chunk) => {
    serverOutput.value = `${serverOutput.value}${chunk}`.slice(-12_000);
  };
  server.stdout.on('data', captureOutput);
  server.stderr.on('data', captureOutput);

  await waitForExpo(server, serverOutput);
  console.log('AGENT_HARNESS_BROWSER_CHECKS');
  if (fullSuite) {
    await command('node', ['scripts/ux-smoke.mjs', baseUrl]);
  } else {
    await command('node', ['scripts/review-agent-smoke.mjs', baseUrl]);
    await command('node', ['scripts/capture-agent-smoke.mjs', baseUrl]);
    await command('node', ['scripts/transaction-edit-agent-smoke.mjs', baseUrl]);
    await command('node', ['scripts/account-delete-agent-smoke.mjs', baseUrl]);
  }
  const intelligenceWarmup = await fetch(`${baseUrl}/intelligence`, { signal: AbortSignal.timeout(120_000) });
  if (!intelligenceWarmup.ok) throw new Error(`Intelligence route warmup failed with ${intelligenceWarmup.status}.`);
  await command('node', ['scripts/intelligence-agent-smoke.mjs', baseUrl]);
  console.log('AGENT_HARNESS_OK');
} finally {
  stopProcessTree(server);
}
