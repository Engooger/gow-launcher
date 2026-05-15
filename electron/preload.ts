import { contextBridge, ipcRenderer } from 'electron';

export type ProgressEvent = { stage: string; percent: number; detail?: string };
export type Profile = { username: string; installDir: string; ramGb: number };

contextBridge.exposeInMainWorld('api', {
  getProfile: (): Promise<Profile> => ipcRenderer.invoke('profile:get'),
  saveProfile: (data: Profile) => ipcRenderer.invoke('profile:save', data),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  play: (data: { username: string; ramGb: number }) => ipcRenderer.invoke('play', data),
  onProgress: (cb: (e: ProgressEvent) => void) => {
    const handler = (_: unknown, payload: ProgressEvent) => cb(payload);
    ipcRenderer.on('progress', handler);
    return () => ipcRenderer.removeListener('progress', handler);
  },
});
