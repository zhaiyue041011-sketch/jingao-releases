const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jingao', {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (input) => ipcRenderer.invoke('projects:create', input),
  getProject: (projectId) => ipcRenderer.invoke('projects:get', projectId),
  removeProject: (projectId) => ipcRenderer.invoke('projects:remove', projectId),
  listEpisodes: (projectId) => ipcRenderer.invoke('episodes:list', projectId),
  createEpisode: (projectId, title) => ipcRenderer.invoke('episodes:create', projectId, title),
  loadEpisode: (projectId, episodeId) => ipcRenderer.invoke('episodes:load', projectId, episodeId),
  saveEpisode: (input) => ipcRenderer.invoke('episodes:save', input),
  removeEpisode: (projectId, episodeId) => ipcRenderer.invoke('episodes:remove', projectId, episodeId),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openDataFolder: () => ipcRenderer.invoke('app:open-data'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-update'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:update-status', listener);
    return () => ipcRenderer.removeListener('app:update-status', listener);
  }
});
