const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');

let mainWindow;
let updateCheckInFlight = false;

const now = () => new Date().toISOString();
const cleanText = (value, max = 120) => String(value || '').trim().slice(0, max);
const assertId = (value) => {
  if (!/^[a-zA-Z0-9-]+$/.test(String(value))) throw new Error('无效的数据标识');
  return String(value);
};

function dataRoot() {
  return path.join(app.getPath('userData'), 'workspace');
}

function projectDir(projectId) {
  return path.join(dataRoot(), 'projects', assertId(projectId));
}

function episodeFile(projectId, episodeId) {
  return path.join(projectDir(projectId), 'episodes', `${assertId(episodeId)}.json`);
}

async function ensureDataRoot() {
  await fs.mkdir(path.join(dataRoot(), 'projects'), { recursive: true });
}

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(temp, file);
}

async function getProject(projectId) {
  return readJson(path.join(projectDir(projectId), 'project.json'));
}

async function listProjects() {
  await ensureDataRoot();
  const root = path.join(dataRoot(), 'projects');
  const entries = await fs.readdir(root, { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-zA-Z0-9-]+$/.test(entry.name)) continue;
    try {
      const project = await readJson(path.join(root, entry.name, 'project.json'));
      const episodes = await listEpisodes(entry.name);
      projects.push({ ...project, episodeCount: episodes.length });
    } catch (error) {
      console.warn(`忽略损坏的项目 ${entry.name}:`, error.message);
    }
  }
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function createEpisodeInternal(projectId, title) {
  const project = await getProject(projectId);
  const existing = await listEpisodes(projectId);
  const createdAt = now();
  const episode = {
    id: randomUUID(),
    projectId,
    title: cleanText(title) || `第 ${existing.length + 1} 集`,
    order: existing.length + 1,
    script: '',
    storyboard: '',
    createdAt,
    updatedAt: createdAt
  };
  await writeJson(episodeFile(projectId, episode.id), episode);
  project.updatedAt = createdAt;
  await writeJson(path.join(projectDir(projectId), 'project.json'), project);
  return episode;
}

async function createProject(input) {
  await ensureDataRoot();
  const name = cleanText(input?.name, 60);
  if (!name) throw new Error('请输入项目名称');
  const createdAt = now();
  const project = {
    id: randomUUID(),
    name,
    description: cleanText(input?.description, 240),
    createdAt,
    updatedAt: createdAt
  };
  await writeJson(path.join(projectDir(project.id), 'project.json'), project);
  await createEpisodeInternal(project.id, '第 1 集');
  return { ...project, episodeCount: 1 };
}

async function listEpisodes(projectId) {
  const dir = path.join(projectDir(projectId), 'episodes');
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const episodes = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const episode = await readJson(path.join(dir, entry.name));
      episodes.push({
        id: episode.id,
        projectId: episode.projectId,
        title: episode.title,
        order: episode.order,
        updatedAt: episode.updatedAt
      });
    } catch (error) {
      console.warn(`忽略损坏的集文件 ${entry.name}:`, error.message);
    }
  }
  return episodes.sort((a, b) => a.order - b.order || a.createdAt?.localeCompare(b.createdAt));
}

async function loadEpisode(projectId, episodeId) {
  return readJson(episodeFile(projectId, episodeId));
}

async function saveEpisode(input) {
  const episode = await loadEpisode(input.projectId, input.episodeId);
  episode.title = cleanText(input.title, 80) || episode.title;
  episode.script = String(input.script || '');
  episode.storyboard = String(input.storyboard || '');
  episode.updatedAt = now();
  await writeJson(episodeFile(input.projectId, input.episodeId), episode);
  const project = await getProject(input.projectId);
  project.updatedAt = episode.updatedAt;
  await writeJson(path.join(projectDir(input.projectId), 'project.json'), project);
  return episode;
}

async function removeProject(projectId) {
  await fs.rm(projectDir(projectId), { recursive: true, force: false });
  return { ok: true };
}

async function removeEpisode(projectId, episodeId) {
  const episodes = await listEpisodes(projectId);
  if (episodes.length <= 1) throw new Error('每个项目至少需要保留一集');
  await fs.unlink(episodeFile(projectId, episodeId));
  const project = await getProject(projectId);
  project.updatedAt = now();
  await writeJson(path.join(projectDir(projectId), 'project.json'), project);
  return { ok: true };
}

function registerIpc() {
  ipcMain.handle('projects:list', listProjects);
  ipcMain.handle('projects:create', (_event, input) => createProject(input));
  ipcMain.handle('projects:get', (_event, projectId) => getProject(projectId));
  ipcMain.handle('projects:remove', (_event, projectId) => removeProject(projectId));
  ipcMain.handle('episodes:list', (_event, projectId) => listEpisodes(projectId));
  ipcMain.handle('episodes:create', (_event, projectId, title) => createEpisodeInternal(projectId, title));
  ipcMain.handle('episodes:load', (_event, projectId, episodeId) => loadEpisode(projectId, episodeId));
  ipcMain.handle('episodes:save', (_event, input) => saveEpisode(input));
  ipcMain.handle('episodes:remove', (_event, projectId, episodeId) => removeEpisode(projectId, episodeId));
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataPath: dataRoot() }));
  ipcMain.handle('app:open-data', () => shell.openPath(dataRoot()));
  ipcMain.handle('app:check-update', async () => {
    if (!app.isPackaged) return { status: 'development', version: app.getVersion() };
    if (process.platform !== 'win32') return { status: 'unsupported' };
    if (updateCheckInFlight) return { status: 'checking' };
    updateCheckInFlight = true;
    try {
      await autoUpdater.checkForUpdates();
      return { status: 'checking' };
    } catch (error) {
      updateCheckInFlight = false;
      throw new Error(error?.message || '无法检查更新');
    }
  });
  ipcMain.handle('app:install-update', () => {
    autoUpdater.quitAndInstall();
    return { ok: true };
  });
}

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app:update-status', payload);
}

function setupUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ status: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ status: 'available', version: info.version }));
  autoUpdater.on('update-not-available', (info) => {
    updateCheckInFlight = false;
    sendUpdateStatus({ status: 'not-available', version: info.version });
  });
  autoUpdater.on('download-progress', (progress) => sendUpdateStatus({ status: 'downloading', percent: Math.round(progress.percent || 0) }));
  autoUpdater.on('update-downloaded', (info) => {
    updateCheckInFlight = false;
    sendUpdateStatus({ status: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (error) => {
    updateCheckInFlight = false;
    sendUpdateStatus({ status: 'error', message: error?.message || '检查更新失败' });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#0b0d12',
    title: '镜稿',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  await ensureDataRoot();
  registerIpc();
  setupUpdater();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
