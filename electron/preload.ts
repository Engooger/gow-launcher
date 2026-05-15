import { contextBridge, ipcRenderer } from 'electron';

export type ProgressEvent = { stage: string; percent: number; detail?: string };

contextBridge.exposeInMainWorld('api', {
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: (data: { username: string }) => ipcRenderer.invoke('profile:save', data),
  play: (username: string) => ipcRenderer.invoke('play', username),
  onProgress: (cb: (e: ProgressEvent) => void) => {
    const handler = (_: unknown, payload: ProgressEvent) => cb(payload);
    ipcRenderer.on('progress', handler);
    return () => ipcRenderer.removeListener('progress', handler);
  },
});
