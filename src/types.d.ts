export type ProgressEvent = { stage: string; percent: number; detail?: string };
export type Profile = { username: string; installDir: string; ramGb: number };
export type LauncherUpdate =
  | { state: 'none' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

declare global {
  interface Window {
    api: {
      getProfile: () => Promise<Profile>;
      saveProfile: (data: Profile) => Promise<boolean>;
      pickFolder: () => Promise<string | null>;
      checkDisk: () => Promise<{ ok: boolean; free: number; required: number }>;
      play: (data: { username: string; ramGb: number }) => Promise<{ ok: boolean; error?: string }>;
      installUpdate: () => Promise<boolean>;
      onProgress: (cb: (e: ProgressEvent) => void) => () => void;
      onLauncherUpdate: (cb: (u: LauncherUpdate) => void) => () => void;
    };
  }
}
