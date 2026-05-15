import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

type Progress = (p: { stage: string; percent: number; detail?: string }) => void;

export function setupAutoUpdate(win: BrowserWindow, progress: Progress) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    progress({ stage: 'self-update', percent: 0, detail: 'Проверка обновлений лаунчера' });
  });

  autoUpdater.on('update-available', (info) => {
    progress({ stage: 'self-update', percent: 0, detail: `Качаю лаунчер ${info.version}` });
  });

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('launcher-update', { state: 'none' });
  });

  autoUpdater.on('download-progress', (p) => {
    progress({
      stage: 'self-update',
      percent: p.percent,
      detail: `Лаунчер: ${p.percent.toFixed(0)}% (${(p.bytesPerSecond / 1e6).toFixed(1)} MB/s)`,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('launcher-update', { state: 'ready' });
  });

  autoUpdater.on('error', (e) => {
    console.error('[updater]', e.message);
    win.webContents.send('launcher-update', { state: 'error', message: e.message });
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

export function quitAndInstall() {
  autoUpdater.quitAndInstall();
}
