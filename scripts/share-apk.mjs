import { createServer } from 'node:http';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

function createShortProjectLink(rootPath) {
  if (process.platform !== 'win32') {
    return { root: rootPath, cleanup: () => {} };
  }

  const baseDir = 'D:\\b';
  const linkName = `bn-${process.pid}`;
  const linkPath = join(baseDir, linkName);

  mkdirSync(baseDir, { recursive: true });
  if (!existsSync(linkPath)) {
    symlinkSync(rootPath, linkPath, 'junction');
  }

  return {
    root: linkPath,
    cleanup: () => {
      if (existsSync(linkPath)) {
        rmSync(linkPath, { force: true, recursive: true });
      }
    },
  };
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }

  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parsePort(value) {
  const fallback = 8123;
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

function getLanAddresses() {
  const candidates = [];
  const interfaces = os.networkInterfaces();

  for (const [name, infos] of Object.entries(interfaces)) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal) {
        continue;
      }

      if (info.address.startsWith('169.254.')) {
        continue;
      }

      candidates.push({ name, address: info.address });
    }
  }

  candidates.sort((a, b) => {
    const score = (item) => {
      const lower = item.name.toLowerCase();
      if (lower.includes('wi-fi') || lower.includes('wifi')) return 0;
      if (lower.includes('ethernet')) return 1;
      return 2;
    };

    return score(a) - score(b) || a.address.localeCompare(b.address);
  });

  return candidates;
}

const projectLink = createShortProjectLink(projectRoot);
const buildRoot = projectLink.root;
const androidDir = join(buildRoot, 'android');
const defaultApkPath = join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk'
);

function ensureApk(apkPath, buildRequested) {
  if (buildRequested) {
    const command = process.platform === 'win32'
      ? 'cmd.exe'
      : './gradlew';
    const args = process.platform === 'win32'
      ? ['/c', 'gradlew.bat', 'assembleRelease']
      : ['assembleRelease'];

    const result = spawnSync(command, args, {
      cwd: androidDir,
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  if (!existsSync(apkPath)) {
    throw new Error(`No se encontró el APK en ${apkPath}`);
  }
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.apk')) {
    return 'application/vnd.android.package-archive';
  }

  return 'application/octet-stream';
}

const apkPath = resolve(getArgValue('--apk') ?? defaultApkPath);
const port = parsePort(getArgValue('--port') ?? process.env.APK_SHARE_PORT);
const downloadName = getArgValue('--name') ?? 'BrainIA-release.apk';
const buildRequested = !hasFlag('--no-build');
const serverHost = '0.0.0.0';

try {
  ensureApk(apkPath, buildRequested);
} catch (error) {
  projectLink.cleanup();
  throw error;
}

const apkStat = statSync(apkPath);
const lanAddresses = getLanAddresses();

const server = createServer((req, res) => {
  const requestPath = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (requestPath === '/' || requestPath === '/index.html') {
    const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BrainIA APK</title>
    <style>
      body {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        margin: 0;
        padding: 24px;
        background: #f6f2ea;
        color: #1f2937;
      }
      .card {
        max-width: 640px;
        margin: 0 auto;
        padding: 24px;
        border-radius: 16px;
        background: white;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
      }
      a {
        display: inline-block;
        margin-top: 12px;
        padding: 12px 16px;
        border-radius: 10px;
        background: #111827;
        color: white;
        text-decoration: none;
      }
      code {
        background: #eef2ff;
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>BrainIA APK</h1>
      <p>APK listo para descargar desde el celular.</p>
      <p><code>${downloadName}</code></p>
      <a href="/download">Descargar APK</a>
    </div>
  </body>
</html>`;

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
    });
    res.end(html);
    return;
  }

  if (requestPath === '/download' || requestPath === '/apk') {
    // The release APK can be rebuilt while this local share server is running.
    // Read its metadata per request so the declared length always matches the
    // streamed file and Android never receives a truncated download.
    const currentApkStat = statSync(apkPath);
    const headers = {
      'Content-Type': contentTypeFor(apkPath),
      'Content-Length': currentApkStat.size,
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Cache-Control': 'no-store',
    };

    res.writeHead(200, headers);
    createReadStream(apkPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

function shutdown() {
  server.close(() => {
    projectLink.cleanup();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  projectLink.cleanup();
});

server.listen(port, serverHost, () => {
  const hostLabel = `${serverHost}:${port}`;
  const urls = lanAddresses.length > 0
    ? lanAddresses.map(({ address, name }) => `http://${address}:${port}  (${name})`)
    : [`http://127.0.0.1:${port}`];

  console.log(`APK: ${apkPath}`);
  console.log(`Tamano: ${Math.round(apkStat.size / 1024 / 1024)} MB`);
  console.log(`Servidor: ${hostLabel}`);
  console.log('Abre desde el celular una de estas URLs:');
  for (const url of urls) {
    console.log(`- ${url}`);
  }
  console.log(`Descarga directa: http://127.0.0.1:${port}/download`);
});
