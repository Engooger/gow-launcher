import fs from 'node:fs';

// Грубая оценка нужного места: моды+конфиги+java+mc+неофордж ≈ 2.5 ГБ распакованного
const REQUIRED_BYTES = 3 * 1024 * 1024 * 1024;

export function checkDiskSpace(dir: string): { ok: boolean; free: number; required: number } {
  try {
    const stat = fs.statfsSync(dir);
    const free = stat.bavail * stat.bsize;
    return { ok: free >= REQUIRED_BYTES, free, required: REQUIRED_BYTES };
  } catch {
    return { ok: true, free: -1, required: REQUIRED_BYTES };
  }
}
