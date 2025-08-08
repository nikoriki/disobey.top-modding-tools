const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const AdmZip = require('adm-zip');
const fs = require('fs');
const os = require('os');

let mainWindow;
function createWindow() {
mainWindow = new BrowserWindow({
width: 600,
height: 700,
minWidth: 400,
minHeight: 500,
frame: false,
webPreferences: {
preload: path.join(__dirname, 'preload.js'),
contextIsolation: true,
nodeIntegration: false,
sandbox: false
},
icon: undefined,
title: 'disobey.top modding tools'
});
mainWindow.setMenuBarVisibility(false);
mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: Custom title bar window controls
ipcMain.on('minimize-window', () => {
if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});
ipcMain.on('maximize-window', () => {
if (mainWindow && !mainWindow.isDestroyed()) {
if (mainWindow.isMaximized()) mainWindow.unmaximize();
else mainWindow.maximize();
}
});
ipcMain.on('close-window', () => {
if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

// IPC: Inject metadata.json into .mmpackage
ipcMain.handle('inject-metadata', async (event, { filePath, metadata }) => {
try {
const zip = new AdmZip(filePath);
const existing = zip.getEntry('metadata.json');
if (existing) zip.deleteFile('metadata.json');
zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2)));
zip.writeZip(filePath);
return { success: true };
} catch (err) {
return { success: false, error: err.message };
}
});

const { dialog } = require('electron');
const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'disobey.topmt');
const settingsFilePath = path.join(appDataPath, 'settings.json');
const mainManagerSettingsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'disobey.top', 'settings.json');

// IPC: Select mod folder
ipcMain.handle('select-folder', async () => {
const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
if (!canceled && filePaths.length > 0) return filePaths[0];
return null;
});
// IPC: Save/load settings for modding tools
ipcMain.handle('save-settings-mt', async (event, settings) => {
await fs.promises.mkdir(appDataPath, { recursive: true });
await fs.promises.writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
return { success: true };
});
ipcMain.handle('load-settings-mt', async () => {
try {
const data = await fs.promises.readFile(settingsFilePath, 'utf8');
return JSON.parse(data);
} catch { return {}; }
});
// IPC: Load main mod manager settings
ipcMain.handle('load-main-manager-settings', async () => {
try {
const data = await fs.promises.readFile(mainManagerSettingsPath, 'utf8');
return JSON.parse(data);
} catch { return {}; }
});

// IPC: Conversor - create .mmpackage from 4 files
ipcMain.handle('conversor-create-mmpackage', async (event, { files, platformCode, customNumber, modFolder, customPackageName }) => {
try {
if (!Array.isArray(files) || files.length !== 4) throw new Error('You must provide 4 files.');
const exts = files.map(f => f.name.split('.').pop().toLowerCase());
const requiredExts = ['pak', 'sig', 'ucas', 'utoc'];
const allPresent = requiredExts.every(ext => exts.includes(ext));
if (files.length !== 4 || !allPresent) {
  throw new Error('You must select exactly one each of: .pak, .sig, .ucas, .utoc (case-insensitive).');
}
let outName;
if (customPackageName && customPackageName.trim()) {
  outName = customPackageName.trim() + '.mmpackage';
} else {
  outName = 'mod';
  if (customNumber) outName += `_${customNumber}`;
  outName += '.mmpackage';
}
const zip = new AdmZip();
for (const file of files) {
let ext = file.name.split('.').pop().toLowerCase();
// Replace number after pakchunk and before -
let base = file.name.replace(/\.[^.]+$/, '');
base = base.replace(/(pakchunk)(\d+)(-)/, (m, p1, p2, p3) => {
return p1 + (customNumber ? customNumber : p2) + p3;
});
// Set platform code
base = base.replace(/-(Windows|WinGDK|EGS)?$/, `-${platformCode}`);
zip.addLocalFile(file.path, '', `${base}.${ext}`);
}
if (!modFolder) throw new Error('No mod folder selected.');
const outPath = path.join(modFolder, outName);
zip.writeZip(outPath);
return { success: true, outPath };
} catch (err) {
return { success: false, error: err.message };
}
});

// IPC: Unpack .mmpackage to folder
ipcMain.handle('unpack-mmpackage', async (event, { filePath }) => {
try {
const zip = new AdmZip(filePath);
const outDir = filePath.replace(/\.mmpackage$/, '_unpacked');
zip.extractAllTo(outDir, true);
return { success: true, outDir };
} catch (err) {
return { success: false, error: err.message };
}
});

// IPC: Repack folder to .mmpackage
ipcMain.handle('repack-folder', async (event, { folderPath, outputName }) => {
try {
const zip = new AdmZip();
const files = fs.readdirSync(folderPath);
for (const file of files) {
const filePath = path.join(folderPath, file);
if (fs.statSync(filePath).isFile()) {
zip.addLocalFile(filePath, '', file);
}
}
const outName = outputName && outputName.endsWith('.mmpackage') ? outputName : (outputName || 'mod.mmpackage');
const outPath = path.join(os.homedir(), 'Desktop', outName);
zip.writeZip(outPath);
return { success: true, outPath };
} catch (err) {
return { success: false, error: err.message };
}
});

// IPC: Validate .mmpackage structure
ipcMain.handle('validate-mmpackage', async (event, { filePath }) => {
try {
const zip = new AdmZip(filePath);
const entries = zip.getEntries().map(e => e.entryName);
const required = ['pak', 'sig', 'ucas', 'utoc'];
const found = required.every(ext => entries.some(e => e.endsWith('.' + ext)));
const hasMetadata = entries.includes('metadata.json');
return { success: true, valid: found, hasMetadata, entries };
} catch (err) {
return { success: false, error: err.message };
}
});

// IPC: Quick metadata viewer/editor
ipcMain.handle('view-metadata', async (event, { filePath }) => {
try {
const zip = new AdmZip(filePath);
const entry = zip.getEntry('metadata.json');
if (!entry) return { success: true, metadata: null };
const data = zip.readAsText(entry);
return { success: true, metadata: JSON.parse(data) };
} catch (err) {
return { success: false, error: err.message };
}
});
ipcMain.handle('edit-metadata', async (event, { filePath, metadata }) => {
try {
const zip = new AdmZip(filePath);
const existing = zip.getEntry('metadata.json');
if (existing) zip.deleteFile('metadata.json');
zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2)));
zip.writeZip(filePath);
return { success: true };
} catch (err) {
return { success: false, error: err.message };
}
});

// IPC: Batch inject metadata
ipcMain.handle('batch-inject-metadata', async (event, { files, metadata }) => {
try {
for (const filePath of files) {
const zip = new AdmZip(filePath);
const existing = zip.getEntry('metadata.json');
if (existing) zip.deleteFile('metadata.json');
zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2)));
zip.writeZip(filePath);
}
return { success: true };
} catch (err) {
return { success: false, error: err.message };
}
});

// IPC: Export metadata as file
ipcMain.handle('export-metadata', async (event, { filePath }) => {
try {
const zip = new AdmZip(filePath);
const entry = zip.getEntry('metadata.json');
if (!entry) return { success: false, error: 'No metadata.json found.' };
const data = zip.readAsText(entry);
const outPath = path.join(os.homedir(), 'Desktop', path.basename(filePath).replace(/\.mmpackage$/, '_metadata.json'));
fs.writeFileSync(outPath, data);
return { success: true, outPath };
} catch (err) {
return { success: false, error: err.message };
}
});
