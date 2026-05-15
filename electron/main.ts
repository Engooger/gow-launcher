import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile, saveProfile, defaultInstallDir, Profile } from './paths.js';
import { syncModpack } from './updater.js';
import { launchMinecraft } from './launcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 620,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
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

ipcMain.handle('play', async (_e, data: { username: string; ramGb: number }) => {
  try {
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
