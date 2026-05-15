import { Client } from 'minecraft-launcher-core';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { mcDir } from './paths.js';
import { Manifest } from './updater.js';

type Progress = (p: { stage: string; percent: number; detail?: string }) => void;

function offlineUuid(username: string): string {
  // Стандартный офлайн-UUID Minecraft: md5("OfflinePlayer:" + name), v3
  const md5 = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest();
  md5[6] = (md5[6] & 0x0f) | 0x30; // версия 3
  md5[8] = (md5[8] & 0x3f) | 0x80; // вариант
  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function launchMinecraft(username: string, manifest: Manifest, progress: Progress) {
  const root = mcDir();
  const launcher = new Client();

  // minecraft-launcher-core поддерживает custom version (NeoForge installer как customFile)
  // Но проще — установленный NeoForge через installer.
  // Для MVP качаем версию ванилы и используем neoforge profile if installed
  const neoVersionId = `neoforge-${manifest.neoforge}`;
  const neoProfilePath = path.join(root, 'versions', neoVersionId, `${neoVersionId}.json`);

  const opts: any = {
    authorization: {
      access_token: '0',
      client_token: '0',
      uuid: offlineUuid(username),
      name: username,
      user_properties: '{}',
      meta: { type: 'mojang', demo: false },
    },
    root,
    version: {
      number: manifest.minecraft,
      type: 'release',
    },
    memory: {
      max: '6G',
      min: '2G',
    },
    overrides: {
      detached: false,
    },
  };

  // Если установлен NeoForge — запускаем его
  if (fs.existsSync(neoProfilePath)) {
    opts.version.custom = neoVersionId;
  } else {
    progress({ stage: 'neoforge', percent: 90, detail: 'NeoForge не установлен — будет ванила. Установи через installer.' });
  }

  launcher.on('progress', (e: any) => {
    progress({ stage: 'mc-download', percent: 90, detail: `${e.type}: ${e.task}/${e.total}` });
  });
  launcher.on('debug', (m: any) => console.log('[MC]', m));
  launcher.on('data', (m: any) => console.log('[MC stdout]', m));
  launcher.on('close', (code: any) => console.log('[MC closed]', code));

  await launcher.launch(opts);
}
