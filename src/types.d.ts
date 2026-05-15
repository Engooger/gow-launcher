export type ProgressEvent = { stage: string; percent: number; detail?: string };

declare global {
  interface Window {
    api: {
      getProfile: () => Promise<{ username: string }>;
      saveProfile: (data: { username: string }) => Promise<boolean>;
      play: (username: string) => Promise<{ ok: boolean; error?: string }>;
      onProgress: (cb: (e: ProgressEvent) => void) => () => void;
    };
  }
}
