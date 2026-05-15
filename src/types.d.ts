export type ProgressEvent = { stage: string; percent: number; detail?: string };
export type Profile = { username: string; installDir: string; ramGb: number };

declare global {
  interface Window {
    api: {
      getProfile: () => Promise<Profile>;
      saveProfile: (data: Profile) => Promise<boolean>;
      pickFolder: () => Promise<string | null>;
      play: (data: { username: string; ramGb: number }) => Promise<{ ok: boolean; error?: string }>;
      onProgress: (cb: (e: ProgressEvent) => void) => () => void;
    };
  }
}
