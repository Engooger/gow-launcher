import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { gameRoot } from './paths.js';

type Progress = (p: { stage: string; percent: number; detail?: string }) => void;

const ADOPTIUM_URL =
  'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk';

export function javaRoot(): string {
  return path.join(gameRoot(), 'runtime', 'jre-21');
}

export function findJavaExe(): string | null {
  const root = javaRoot();
  if (!fs.existsSync(root)) return null;
  try {
    for (const sub of fs.readdirSync(root)) {
      const exe = path.join(root, sub, 'bin', 'javaw.exe');
      if (fs.existsSync(exe)) return exe;
    }
  } catch {}
  return null;
}

async function downloadFile(url: string, dest: string, onProgress?: (loaded: number, total: number) => void) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${url}`);
  const total = Number(res.headers.get('content-length') || 0);
  let loaded = 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out.write(Buffer.from(value));
    loaded += value.byteLength;
    onProgress?.(loaded, total);
  }
  out.end();
  await new Promise<void>((resolve, reject) => {
    out.on('finish', () => resolve());
    out.on('error', reject);
  });
}

export async function ensureJava21(progress: Progress): Promise<string> {
  const existing = findJavaExe();
  if (existing) return existing;

  progress({ stage: 'java', percent: 86, detail: 'Скачиваю Java 21 (~50MB)' });
  fs.mkdirSync(javaRoot(), { recursive: true });
  const zipPath = path.join(javaRoot(), 'jre.zip');

  await downloadFile(ADOPTIUM_URL, zipPath, (loaded, total) => {
    progress({
      stage: 'java',
      percent: 86,
      detail: `Java 21: ${(loaded / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`,
    });
  });

  progress({ stage: 'java', percent: 89, detail: 'Распаковка Java' });
  new AdmZip(zipPath).extractAllTo(javaRoot(), true);
  fs.unlinkSync(zipPath);

  const exe = findJavaExe();
  if (!exe) throw new Error('Не нашёл javaw.exe после распаковки JRE');
  return exe;
}
