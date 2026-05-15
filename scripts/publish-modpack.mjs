#!/usr/bin/env node
// Пакует mods/config/kubejs из сборки в zip, считает SHA256, готовит manifest.json
// и публикует GitHub Release через `gh` CLI.
//
// Использование:
//   node scripts/publish-modpack.mjs --version 0.1.0
//
// Требуется: gh CLI авторизован, репо gow-modpack создан.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import AdmZip from 'adm-zip';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const VERSION = args.version || `0.0.${Date.now()}`;
const PACK_DIR = args.pack || 'D:/steam/Новая папка';
const GOW_JAR = args.gow || 'D:/steam/Новая папка/mods/gow-0.1.0.jar';
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
  const { exclude = [] } = options;
  const zip = new AdmZip();
  function walk(dir, rel = '') {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const relPath = path.join(rel, name).replace(/\\/g, '/');
      if (exclude.some((e) => relPath.includes(e))) continue;
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, relPath);
      else zip.addLocalFile(full, rel.replace(/\\/g, '/'));
    }
  }
  walk(srcDir);
  zip.writeZip(outFile);
}

console.log(`Сборка модпака v${VERSION} из ${PACK_DIR}`);

// 1. Моды (без gow-*.jar — он отдельным компонентом)
console.log('  → mods.zip');
const modsZip = path.join(OUT, 'mods.zip');
zipFolder(path.join(PACK_DIR, 'mods'), modsZip, { exclude: ['gow-'] });

// 2. Конфиги
console.log('  → config.zip');
const configZip = path.join(OUT, 'config.zip');
zipFolder(path.join(PACK_DIR, 'config'), configZip);

// 3. KubeJS (если есть)
let kubejsZip = null;
if (fs.existsSync(path.join(PACK_DIR, 'kubejs'))) {
  console.log('  → kubejs.zip');
  kubejsZip = path.join(OUT, 'kubejs.zip');
  zipFolder(path.join(PACK_DIR, 'kubejs'), kubejsZip);
}

// 4. GoW мод (отдельно, часто меняется)
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
  {
    name: 'gow',
    file: 'gow.jar',
    sha256: sha256(gowOut),
    size: fs.statSync(gowOut).size,
    copyTo: 'mods/gow.jar',
  },
];
if (kubejsZip) {
  components.splice(2, 0, {
    name: 'kubejs',
    file: 'kubejs.zip',
    sha256: sha256(kubejsZip),
    size: fs.statSync(kubejsZip).size,
    extractTo: 'kubejs',
    wipeBeforeExtract: true,
  });
}

const manifest = {
  version: `v${VERSION}`,
  minecraft: MC_VERSION,
  neoforge: NEOFORGE_VERSION,
  java: JAVA,
  components,
};
const manifestPath = path.join(OUT, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Манифест: ${manifestPath}`);

// 6. Публикация в GitHub Release
console.log(`\nЗаливка релиза v${VERSION} в ${REPO}...`);
const assets = [manifestPath, modsZip, configZip, gowOut, kubejsZip].filter(Boolean);
try {
  execSync(
    `gh release create v${VERSION} ${assets.map((a) => `"${a}"`).join(' ')} --repo ${REPO} --title "GoW Modpack v${VERSION}" --notes "Auto-published"`,
    { stdio: 'inherit' }
  );
  console.log('Готово.');
} catch (e) {
  console.error('gh release create упал. Проверь что gh авторизован и репо создан.');
  console.error('Файлы готовы в:', OUT);
}
