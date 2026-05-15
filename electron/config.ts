export const CONFIG = {
  // GitHub repo c релизами модпака. Поменяй на свой когда создашь.
  modpackRepo: 'Engooger/gow-modpack',
  // Минимальные версии для случая когда manifest ещё не залит.
  fallback: {
    minecraft: '1.21.1',
    neoforge: '21.1.229',
    java: 21,
  },
};

export function manifestUrl(): string {
  return `https://github.com/${CONFIG.modpackRepo}/releases/latest/download/manifest.json`;
}

export function assetUrl(version: string, file: string): string {
  return `https://github.com/${CONFIG.modpackRepo}/releases/download/${version}/${file}`;
}
