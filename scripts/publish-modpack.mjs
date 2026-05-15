#!/usr/bin/env node
// Пакует mods/config/kubejs из сборки в zip, считает SHA256, генерит manifest.json
// и публикует GitHub Release через REST API (без gh CLI).
//
// Использование:
//   GH_TOKEN=ghp_xxx node scripts/publish-modpack.mjs --version 0.1.0
//
// Параметры:
//   --version 0.1.0          версия релиза (тэг будет v0.1.0)
//   --pack "D:/..."          путь к папке сборки
//   --gow "D:/.../gow.jar"   путь к gow-jar
//   --repo Engooger/gow-modpack

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) {
  console.error('Не задан GH_TOKEN. Запусти как: $env:GH_TOKEN="ghp_..."; node scripts/publish-modpack.mjs ...');
  process.exit(1);
}

const VERSION = args.version || `0.0.${Date.now()}`;
const TAG = `v${VERSION}`;
const PACK_DIR = args.pack || 'D:/steam/Новая папка';
const GOW_JAR = args.gow || 'D:/steam/Новая папка/mods/gow-0.1.0.jar';
const NEOFORGE_INSTALLER = args.installer || 'C:/Users/helly/Downloads/neoforge-21.1.229-installer.jar';
const REPO = args.repo || 'Engooger/gow-modpack';
const OUT = path.resolve('build', VERSION);
const MC_VERSION = '1.21.1';
const NEOFORGE_VERSION = '21.1.229';
const JAVA = 21;

fs.mkdirSync(OUT, { recursive: true });

function sha256(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

function zipFolder(srcDir, outFile, options = {}) {
  const { excludePrefix = [] } = options;
  const zip = new AdmZip();
  function walk(dir, rel = '') {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const relPath = path.posix.join(rel, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, relPath);
      else {
        if (excludePrefix.some((p) => name.startsWith(p))) continue;
        zip.addLocalFile(full, rel);
      }
    }
  }
  walk(srcDir);
  zip.writeZip(outFile);
}

async function api(method, url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${method} ${url} → ${res.status} ${t}`);
  }
  return res.json();
}

async function uploadAsset(uploadUrl, filePath, contentType) {
  const name = path.basename(filePath);
  const data = fs.readFileSync(filePath);
  const url = uploadUrl.replace('{?name,label}', `?name=${encodeURIComponent(name)}`);
  console.log(`  ↑ ${name} (${(data.length / 1e6).toFixed(1)} MB)`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': contentType,
      'Content-Length': String(data.length),
    },
    body: data,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upload ${name} failed: ${res.status} ${t}`);
  }
}

async function getOrCreateRelease() {
  // Удаляем существующий релиз с тем же тэгом, если есть (для пересоздания)
  try {
    const existing = await api('GET', `https://api.github.com/repos/${REPO}/releases/tags/${TAG}`);
    if (existing.id) {
      console.log(`  Удаляю существующий релиз ${TAG}`);
      await api('DELETE', `https://api.github.com/repos/${REPO}/releases/${existing.id}`);
      // и тэг тоже
      try {
        await api('DELETE', `https://api.github.com/repos/${REPO}/git/refs/tags/${TAG}`);
      } catch {}
    }
  } catch {}

  return await api('POST', `https://api.github.com/repos/${REPO}/releases`, {
    tag_name: TAG,
    name: `GoW Modpack ${TAG}`,
    body: `Auto-published.\n\nMC ${MC_VERSION} · NeoForge ${NEOFORGE_VERSION}`,
    draft: false,
    prerelease: false,
  });
}

console.log(`Сборка модпака ${TAG} из ${PACK_DIR}`);

// 1. Моды (без gow-*.jar)
console.log('  → mods.zip');
const modsZip = path.join(OUT, 'mods.zip');
zipFolder(path.join(PACK_DIR, 'mods'), modsZip, { excludePrefix: ['gow-'] });

// 2. Конфиги
console.log('  → config.zip');
const configZip = path.join(OUT, 'config.zip');
zipFolder(path.join(PACK_DIR, 'config'), configZip);

// 3. KubeJS
let kubejsZip = null;
if (fs.existsSync(path.join(PACK_DIR, 'kubejs'))) {
  console.log('  → kubejs.zip');
  kubejsZip = path.join(OUT, 'kubejs.zip');
  zipFolder(path.join(PACK_DIR, 'kubejs'), kubejsZip);
}

// 4. GoW мод
console.log('  → gow.jar');
const gowOut = path.join(OUT, 'gow.jar');
fs.copyFileSync(GOW_JAR, gowOut);

// 5. Манифест
const components = [
  {
    name: 'mods',
    file: 'mods.zip',
    sha256: sha256(modsZip),
    size: fs.statSync(modsZip).size,
    extractTo: 'mods',
    wipeBeforeExtract: true,
  },
  {
    name: 'config',
    file: 'config.zip',
    sha256: sha256(configZip),
    size: fs.statSync(configZip).size,
    extractTo: 'config',
    wipeBeforeExtract: true,
  },
];
if (kubejsZip) {
  components.push({
    name: 'kubejs',
    file: 'kubejs.zip',
    sha256: sha256(kubejsZip),
    size: fs.statSync(kubejsZip).size,
    extractTo: 'kubejs',
    wipeBeforeExtract: true,
  });
}
components.push({
  name: 'gow',
  file: 'gow.jar',
  sha256: sha256(gowOut),
  size: fs.statSync(gowOut).size,
  copyTo: 'mods/gow.jar',
});

const manifest = {
  version: TAG,
  minecraft: MC_VERSION,
  neoforge: NEOFORGE_VERSION,
  java: JAVA,
  components,
};

// NeoForge installer (если есть локально — закидываем в релиз)
let neoInstallerOut = null;
if (fs.existsSync(NEOFORGE_INSTALLER)) {
  console.log('  → neoforge-installer.jar');
  const name = `neoforge-${NEOFORGE_VERSION}-installer.jar`;
  neoInstallerOut = path.join(OUT, name);
  fs.copyFileSync(NEOFORGE_INSTALLER, neoInstallerOut);
  manifest.neoforgeInstaller = {
    url: `https://github.com/${REPO}/releases/download/${TAG}/${name}`,
    sha256: sha256(neoInstallerOut),
  };
}
const manifestPath = path.join(OUT, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Манифест: ${manifestPath}`);

// 6. Публикация
console.log(`\nПубликую релиз ${TAG} в ${REPO}...`);
const release = await getOrCreateRelease();
const uploadUrl = release.upload_url;

const assets = [
  [manifestPath, 'application/json'],
  [modsZip, 'application/zip'],
  [configZip, 'application/zip'],
  [gowOut, 'application/java-archive'],
];
if (kubejsZip) assets.splice(3, 0, [kubejsZip, 'application/zip']);
if (neoInstallerOut) assets.push([neoInstallerOut, 'application/java-archive']);

for (const [file, ct] of assets) {
  await uploadAsset(uploadUrl, file, ct);
}

console.log(`\nГотово: ${release.html_url}`);
