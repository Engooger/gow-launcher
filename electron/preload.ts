import { contextBridge, ipcRenderer } from 'electron';

export type ProgressEvent = { stage: string; percent: number; detail?: string };
export type Profile = { username: string; installDir: string; ramGb: number };

export type LauncherUpdate =
  | { state: 'none' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

contextBridge.exposeInMainWorld('api', {
  getProfile: (): Promise<Profile> => ipcRenderer.invoke('profile:get'),
  saveProfile: (data: Profile) => ipcRenderer.invoke('profile:save', data),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  checkDisk: (): Promise<{ ok: boolean; free: number; required: number }> =>
    ipcRenderer.invoke('disk:check'),
  play: (data: { username: string; ramGb: number }) => ipcRenderer.invoke('play', data),
  installUpdate: () => ipcRenderer.invoke('launcher:install-update'),
  onProgress: (cb: (e: ProgressEvent) => void) => {
    const handler = (_: unknown, payload: ProgressEvent) => cb(payload);
    ipcRenderer.on('progress', handler);
    return () => ipcRenderer.removeListener('progress', handler);
  },
  onLauncherUpdate: (cb: (u: LauncherUpdate) => void) => {
    const handler = (_: unknown, payload: LauncherUpdate) => cb(payload);
    ipcRenderer.on('launcher-update', handler);
    return () => ipcRenderer.removeListener('launcher-update', handler);
  },
});
