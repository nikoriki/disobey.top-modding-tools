const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  injectMetadata: (filePath, metadata) => ipcRenderer.invoke('inject-metadata', { filePath, metadata }),
  conversorCreateMmpackage: (args) => ipcRenderer.invoke('conversor-create-mmpackage', args),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings-mt', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings-mt'),
  loadMainManagerSettings: () => ipcRenderer.invoke('load-main-manager-settings'),
});
