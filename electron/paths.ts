import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export const APP_NAME = 'GoW';

// Корень — где лежит profile.json (всегда в %APPDATA%)
export function configRoot(): string {
  const root = path.join(app.getPath('appData'), `.${APP_NAME.toLowerCase()}-launcher`);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function profilePath(): string {
  return path.join(configRoot(), 'profile.json');
}

export type Profile = {
  username: string;
  installDir?: string;  // куда ставить игру; если пусто — рядом с configRoot/game
  ramGb?: number;       // выделяемая память
};

export function defaultInstallDir(): string {
  return path.join(configRoot(), 'game');
}

export function loadProfile(): Profile {
  try {
    return JSON.parse(fs.readFileSync(profilePath(), 'utf-8'));
  } catch {
    return { username: '', installDir: defaultInstallDir(), ramGb: 6 };
  }
}

export function saveProfile(p: Profile) {
  fs.writeFileSync(profilePath(), JSON.stringify(p, null, 2));
}

export function gameRoot(): string {
  const p = loadProfile();
  const root = p.installDir || defaultInstallDir();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function mcDir(): string {
  const d = path.join(gameRoot(), 'minecraft');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function manifestLocalPath(): string {
  return path.join(gameRoot(), 'manifest.local.json');
}
