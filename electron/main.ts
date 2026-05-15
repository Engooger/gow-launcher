import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { loadProfile, saveProfile, defaultInstallDir, gameRoot, Profile } from './paths.js';
import { syncModpack } from './updater.js';
import { launchMinecraft } from './launcher.js';
import { setupAutoUpdate, quitAndInstall } from './autoupdate.js';
import { checkDiskSpace } from './diskspace.js';

const isDev = !app.isPackaged;

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 620,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e10',
    icon: path.join(__dirname, '..', 'build-assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // F12 — открыть DevTools (полезно если что-то ломается)
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      win!.webContents.toggleDevTools();
    }
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('Failed to load:', code, desc, url);
    win!.webContents.openDevTools({ mode: 'detach' });
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadFile(indexPath).catch((err) => {
      console.error('loadFile failed:', err);
      win!.webContents.openDevTools({ mode: 'detach' });
    });
    win.webContents.once('did-finish-load', () => {
      setupAutoUpdate(win!, sendProgress);
    });
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function sendProgress(payload: { stage: string; percent: number; detail?: string }) {
  win?.webContents.send('progress', payload);
}

ipcMain.handle('profile:get', () => {
  const p = loadProfile();
  return {
    username: p.username || '',
    installDir: p.installDir || defaultInstallDir(),
    ramGb: p.ramGb || 6,
  };
});

ipcMain.handle('profile:save', (_e, data: Profile) => {
  saveProfile(data);
  return true;
});

ipcMain.handle('dialog:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Куда установить игру',
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

ipcMain.handle('disk:check', () => checkDiskSpace(gameRoot()));

ipcMain.handle('launcher:install-update', () => {
  quitAndInstall();
  return true;
});

ipcMain.handle('play', async (_e, data: { username: string; ramGb: number }) => {
  try {
    const disk = checkDiskSpace(gameRoot());
    if (!disk.ok && disk.free >= 0) {
      const freeGb = (disk.free / 1e9).toFixed(1);
      const reqGb = (disk.required / 1e9).toFixed(1);
      throw new Error(`Мало места на диске: ${freeGb} ГБ свободно, нужно ${reqGb} ГБ`);
    }
    sendProgress({ stage: 'sync', percent: 0, detail: 'Проверка обновлений' });
    const manifest = await syncModpack(sendProgress);
    sendProgress({ stage: 'launch', percent: 95, detail: 'Запуск Minecraft' });
    await launchMinecraft(data.username, data.ramGb, manifest, sendProgress);
    sendProgress({ stage: 'done', percent: 100, detail: 'Игра запущена' });
    return { ok: true };
  } catch (err: any) {
    sendProgress({ stage: 'error', percent: 0, detail: err.message || String(err) });
    return { ok: false, error: err.message || String(err) };
  }
});
