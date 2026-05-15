import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mcDir } from './paths.js';

type Progress = (p: { stage: string; percent: number; detail?: string }) => void;

export function neoVersionId(version: string): string {
  return `neoforge-${version}`;
}

export function neoInstalled(version: string): boolean {
  const id = neoVersionId(version);
  return fs.existsSync(path.join(mcDir(), 'versions', id, `${id}.json`));
}

function installerUrl(version: string): string {
  return `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
}

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

function ensureLauncherProfiles() {
  // NeoForge installer требует launcher_profiles.json в MC dir
  const p = path.join(mcDir(), 'launcher_profiles.json');
  if (!fs.existsSync(p)) {
    fs.writeFileSync(
      p,
      JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2)
    );
  }
}

export async function ensureNeoForge(version: string, javaExe: string, progress: Progress): Promise<void> {
  if (neoInstalled(version)) return;

  progress({ stage: 'neoforge', percent: 90, detail: 'Скачиваю NeoForge installer' });
  const installerPath = path.join(mcDir(), `neoforge-${version}-installer.jar`);
  await downloadFile(installerUrl(version), installerPath);

  ensureLauncherProfiles();

  progress({ stage: 'neoforge', percent: 92, detail: 'Установка NeoForge (1-2 мин)' });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(javaExe, ['-jar', installerPath, '--installClient', mcDir()], {
      cwd: mcDir(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stdout.on('data', (b) => console.log('[neoforge]', b.toString()));
    proc.stderr.on('data', (b) => {
      const s = b.toString();
      stderr += s;
      console.log('[neoforge err]', s);
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`NeoForge installer exited ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });

  try {
    fs.unlinkSync(installerPath);
    fs.rmSync(installerPath + '.log', { force: true });
  } catch {}

  if (!neoInstalled(version)) {
    throw new Error(`NeoForge installer прошёл, но версия ${neoVersionId(version)} не появилась`);
  }
}
