import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { profilePath } from './paths.js';
import { syncModpack } from './updater.js';
import { launchMinecraft } from './launcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 600,
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
  try {
    return JSON.parse(fs.readFileSync(profilePath(), 'utf-8'));
  } catch {
    return { username: '' };
  }
});

ipcMain.handle('profile:save', (_e, data: { username: string }) => {
  fs.writeFileSync(profilePath(), JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('play', async (_e, username: string) => {
  try {
    sendProgress({ stage: 'sync', percent: 0, detail: 'Проверка обновлений' });
    const manifest = await syncModpack(sendProgress);
    sendProgress({ stage: 'launch', percent: 95, detail: 'Запуск Minecraft' });
    await launchMinecraft(username, manifest, sendProgress);
    sendProgress({ stage: 'done', percent: 100, detail: 'Игра запущена' });
    return { ok: true };
  } catch (err: any) {
    sendProgress({ stage: 'error', percent: 0, detail: err.message || String(err) });
    return { ok: false, error: err.message || String(err) };
  }
});
