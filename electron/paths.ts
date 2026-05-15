import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export const APP_NAME = 'GoW';

export function gameRoot(): string {
  const root = path.join(app.getPath('appData'), `.${APP_NAME.toLowerCase()}-launcher`);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function mcDir(): string {
  const d = path.join(gameRoot(), 'minecraft');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function profilePath(): string {
  return path.join(gameRoot(), 'profile.json');
}

export function manifestLocalPath(): string {
  return path.join(gameRoot(), 'manifest.local.json');
}
