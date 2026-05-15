import { Client } from 'minecraft-launcher-core';
import crypto from 'node:crypto';
import { mcDir } from './paths.js';
import { Manifest } from './updater.js';
import { ensureJava21 } from './java.js';
import { ensureNeoForge, neoVersionId } from './neoforge.js';

type Progress = (p: { stage: string; percent: number; detail?: string }) => void;

function offlineUuid(username: string): string {
  const md5 = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest();
  md5[6] = (md5[6] & 0x0f) | 0x30;
  md5[8] = (md5[8] & 0x3f) | 0x80;
  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function launchMinecraft(
  username: string,
  ramGb: number,
  manifest: Manifest,
  progress: Progress
) {
  const root = mcDir();

  const javaExe = await ensureJava21(progress);
  await ensureNeoForge(manifest.neoforge, javaExe, progress, manifest.neoforgeInstaller);

  progress({ stage: 'launch', percent: 95, detail: 'Запуск Minecraft' });

  const max = Math.max(2, Math.min(32, Math.floor(ramGb || 6)));
  const min = Math.max(1, Math.min(max, 2));

  const launcher = new Client();
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
      custom: neoVersionId(manifest.neoforge),
    },
    memory: { max: `${max}G`, min: `${min}G` },
    javaPath: javaExe,
    overrides: { detached: true },
  };

  launcher.on('progress', (e: any) => {
    progress({ stage: 'mc-download', percent: 96, detail: `${e.type}: ${e.task}/${e.total}` });
  });
  launcher.on('debug', (m: any) => console.log('[MC]', m));
  launcher.on('data', (m: any) => console.log('[MC stdout]', String(m).trim()));
  launcher.on('close', (code: any) => console.log('[MC closed]', code));

  await launcher.launch(opts);
}
