import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';
import { mcDir, manifestLocalPath } from './paths.js';
import { manifestUrl, CONFIG } from './config.js';

export type Manifest = {
  version: string;
  minecraft: string;
  neoforge: string;
  java: number;
  components: Component[];
};

export type Component = {
  name: string;
  file: string;
  url?: string;
  sha256: string;
  size?: number;
  // Куда положить
  extractTo?: string;         // распаковать zip в эту папку (относительно mcDir)
  copyTo?: string;            // скопировать как одиночный файл (относительно mcDir)
  wipeBeforeExtract?: boolean; // удалить целевую папку перед распаковкой
};

type Progress = (p: { stage: string; percent: number; detail?: string }) => void;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} GET ${url}`);
  return (await res.json()) as T;
}

async function downloadTo(url: string, dest: string, onProgress?: (loaded: number, total: number) => void) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} GET ${url}`);
  const total = Number(res.headers.get('content-length') || 0);
  let loaded = 0;
  const reader = res.body.getReader();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(dest);
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

function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('data', (c) => h.update(c));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', reject);
  });
}

function readLocalManifest(): Manifest | null {
  try {
    return JSON.parse(fs.readFileSync(manifestLocalPath(), 'utf-8'));
  } catch {
    return null;
  }
}

function writeLocalManifest(m: Manifest) {
  fs.writeFileSync(manifestLocalPath(), JSON.stringify(m, null, 2));
}

function rmrf(dir: string) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export async function syncModpack(progress: Progress): Promise<Manifest> {
  progress({ stage: 'manifest', percent: 2, detail: 'Получение manifest.json' });

  let remote: Manifest;
  try {
    remote = await fetchJson<Manifest>(manifestUrl());
  } catch (e: any) {
    // Если манифест ещё не залит — используем локальный или фолбэк
    const local = readLocalManifest();
    if (local) {
      progress({ stage: 'manifest', percent: 100, detail: 'Нет сети, использую локальную сборку' });
      return local;
    }
    throw new Error(`Нет манифеста и нет локальной сборки: ${e.message}`);
  }

  const local = readLocalManifest();
  const mc = mcDir();

  const total = remote.components.length;
  for (let i = 0; i < total; i++) {
    const comp = remote.components[i];
    const prevHash = local?.components.find((c) => c.name === comp.name)?.sha256;
    const baseUrl = comp.url ?? `https://github.com/${CONFIG.modpackRepo}/releases/download/${remote.version}/${comp.file}`;

    const target = comp.copyTo
      ? path.join(mc, comp.copyTo)
      : null;

    // Если хэш совпадает и для copyTo файл существует — пропускаем
    if (prevHash === comp.sha256) {
      if (!comp.copyTo || (target && fs.existsSync(target))) {
        progress({ stage: 'sync', percent: 5 + ((i + 1) / total) * 80, detail: `${comp.name}: актуально` });
        continue;
      }
    }

    progress({ stage: 'sync', percent: 5 + (i / total) * 80, detail: `Качаю ${comp.name}` });

    const tmp = path.join(mc, '.tmp', comp.file);
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    await downloadTo(baseUrl, tmp, (loaded, all) => {
      const pct = all ? (loaded / all) * (80 / total) : 0;
      progress({
        stage: 'sync',
        percent: 5 + (i / total) * 80 + pct,
        detail: `${comp.name}: ${(loaded / 1e6).toFixed(1)} / ${(all / 1e6).toFixed(1)} MB`,
      });
    });

    const got = await sha256File(tmp);
    if (got !== comp.sha256) {
      fs.unlinkSync(tmp);
      throw new Error(`SHA256 не совпал для ${comp.file}: ожидали ${comp.sha256}, получили ${got}`);
    }

    if (comp.copyTo) {
      const dst = path.join(mc, comp.copyTo);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.renameSync(tmp, dst);
    } else if (comp.extractTo) {
      const dst = path.join(mc, comp.extractTo);
      if (comp.wipeBeforeExtract) rmrf(dst);
      fs.mkdirSync(dst, { recursive: true });
      const zip = new AdmZip(tmp);
      zip.extractAllTo(dst, true);
      fs.unlinkSync(tmp);
    }
  }

  rmrf(path.join(mc, '.tmp'));
  writeLocalManifest(remote);
  progress({ stage: 'sync', percent: 85, detail: 'Сборка обновлена' });
  return remote;
}
