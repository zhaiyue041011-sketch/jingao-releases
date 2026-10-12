const makeBrowserBridge = () => {
  const key = 'jingao-browser-data-v1';
  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const timestamp = () => new Date().toISOString();
  const seed = () => ({
    projects: [{ id: 'demo-project', name: '逆光而行', description: '都市悬疑短片 · 第一稿', createdAt: timestamp(), updatedAt: timestamp() }],
    episodes: [{ id: 'demo-episode', projectId: 'demo-project', title: '第 1 集 · 雨夜', order: 1, script: '场 1 · 外景 · 雨夜\n\n雨落在空旷的站台。\n\n林夏（旁白）\n有些告别，发生时没有声音。', storyboard: 'SHOT 01｜全景｜5 秒\n画面：雨夜中的空站台，林夏背对镜头。\n运镜：缓慢推进。\n声音：雨声，远处列车鸣笛。\n\nSHOT 02｜近景｜3 秒\n画面：她攥紧一张旧车票。\n运镜：固定。', createdAt: timestamp(), updatedAt: timestamp() }]
  });
  const read = () => JSON.parse(localStorage.getItem(key) || 'null') || seed();
  const write = (data) => { localStorage.setItem(key, JSON.stringify(data)); return data; };
  if (!localStorage.getItem(key)) write(seed());
  return {
    async listProjects() { const d = read(); return d.projects.map(p => ({ ...p, episodeCount: d.episodes.filter(e => e.projectId === p.id).length })).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async createProject(input) { const d = read(); const p = { id: uid(), name: input.name, description: input.description || '', createdAt: timestamp(), updatedAt: timestamp() }; d.projects.push(p); d.episodes.push({ id: uid(), projectId: p.id, title: '第 1 集', order: 1, script: '', storyboard: '', createdAt: timestamp(), updatedAt: timestamp() }); write(d); return { ...p, episodeCount: 1 }; },
    async getProject(id) { return read().projects.find(p => p.id === id); },
    async removeProject(id) { const d = read(); d.projects = d.projects.filter(p => p.id !== id); d.episodes = d.episodes.filter(e => e.projectId !== id); write(d); },
    async listEpisodes(id) { return read().episodes.filter(e => e.projectId === id).sort((a,b) => a.order-b.order); },
    async createEpisode(projectId, title) { const d = read(); const list = d.episodes.filter(e => e.projectId === projectId); const e = { id: uid(), projectId, title, order: list.length + 1, script: '', storyboard: '', createdAt: timestamp(), updatedAt: timestamp() }; d.episodes.push(e); const p=d.projects.find(x=>x.id===projectId); p.updatedAt=e.updatedAt; write(d); return e; },
    async loadEpisode(projectId, episodeId) { return read().episodes.find(e => e.projectId === projectId && e.id === episodeId); },
    async saveEpisode(input) { const d = read(); const e=d.episodes.find(x=>x.id===input.episodeId); Object.assign(e, { title: input.title, script: input.script, storyboard: input.storyboard, updatedAt: timestamp() }); const p=d.projects.find(x=>x.id===input.projectId); p.updatedAt=e.updatedAt; write(d); return e; },
    async removeEpisode(projectId, episodeId) { const d=read(); if (d.episodes.filter(e=>e.projectId===projectId).length <= 1) throw new Error('每个项目至少需要保留一集'); d.episodes=d.episodes.filter(e=>e.id!==episodeId); write(d); },
    async getAppInfo() { return { version: '0.2.0 · 浏览器预览', dataPath: '浏览器本地存储' }; },
    async openDataFolder() { return '仅桌面版支持打开数据文件夹'; },
    async checkForUpdates() { return { status: 'development', version: '0.2.0' }; },
    async installUpdate() { return { ok: false }; },
    onUpdateStatus() { return () => {}; }
  };
};

const api = window.jingao || makeBrowserBridge();
const $ = (selector) => document.querySelector(selector);
const state = { projects: [], project: null, episodes: [], episode: null, dirty: false, focus: null, saving: false, pendingUpdate: false };

const ui = {
  home: $('#home-view'), editor: $('#editor-view'), grid: $('#project-grid'), empty: $('#empty-projects'), count: $('#project-count'),
  projectName: $('#current-project-name'), episodeList: $('#episode-list'), episodeIndex: $('#episode-index'), episodeTitle: $('#episode-title'),
  script: $('#script-editor'), storyboard: $('#storyboard-editor'), scriptCount: $('#script-count'), storyboardCount: $('#storyboard-count'),
  editorGrid: $('#editor-grid'), saveState: $('#save-state'), globalStatus: $('#global-status'), projectDialog: $('#project-dialog'), episodeDialog: $('#episode-dialog')
};

function toast(message, isError = false) {
  const item = document.createElement('div');
  item.className = `toast${isError ? ' error' : ''}`;
  item.textContent = message;
  $('#toast-region').append(item);
  setTimeout(() => item.remove(), 2800);
}

function formatDate(value) {
  if (!value) return '刚刚';
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function updateCounts() {
  ui.scriptCount.textContent = `${ui.script.value.replace(/\s/g, '').length} 字`;
  const shots = (ui.storyboard.value.match(/(?:^|\n)\s*SHOT\s*\d+/gi) || []).length;
  ui.storyboardCount.textContent = `${shots} 个镜头`;
}

function setDirty(value) {
  state.dirty = value;
  ui.saveState.classList.toggle('dirty', value);
  ui.saveState.classList.toggle('saving', state.saving);
  ui.saveState.lastChild.textContent = value ? ' 未保存' : ' 已保存';
}

function markDirty() { setDirty(true); updateCounts(); }

async function guardUnsaved() {
  if (!state.dirty) return true;
  return window.confirm('当前内容还没有保存，继续会丢失这些修改。要继续吗？');
}

function showHome() {
  state.project = null; state.episodes = []; state.episode = null; state.focus = null;
  ui.editor.hidden = true; ui.home.hidden = false; ui.editorGrid.className = 'editor-grid';
  document.title = '镜稿 · 剧本与分镜工作台';
}

function showEditor() { ui.home.hidden = true; ui.editor.hidden = false; }

async function loadProjects(showNotice = false) {
  const button = $('#refresh-projects-button');
  button.classList.add('rotating');
  try {
    state.projects = await api.listProjects();
    renderProjects();
    if (showNotice) toast('已读取最新项目');
  } catch (error) { toast(error.message || '项目读取失败', true); }
  finally { button.classList.remove('rotating'); }
}

function setGlobalStatus(message, tone = 'ready') {
  ui.globalStatus.classList.toggle('dirty', tone === 'working');
  ui.globalStatus.lastChild.textContent = ` ${message}`;
}

function handleUpdateStatus(update) {
  const button = $('#refresh-projects-button');
  const label = $('#refresh-projects-label');
  if (update.status === 'checking') {
    button.classList.add('rotating'); label.textContent = '检查更新中'; setGlobalStatus('正在检查最新版本', 'working');
  } else if (update.status === 'available') {
    label.textContent = `下载 v${update.version}`; setGlobalStatus(`发现新版本 v${update.version}`, 'working'); toast(`发现 v${update.version}，正在下载`);
  } else if (update.status === 'downloading') {
    label.textContent = `下载 ${update.percent}%`; setGlobalStatus(`新版下载中 · ${update.percent}%`, 'working');
  } else if (update.status === 'not-available') {
    button.classList.remove('rotating'); label.textContent = '刷新与更新'; setGlobalStatus('当前已是最新版本'); toast('项目已刷新，当前已是最新版本');
  } else if (update.status === 'downloaded') {
    state.pendingUpdate = true;
    button.classList.remove('rotating'); label.textContent = '重启更新'; setGlobalStatus(`v${update.version} 已准备好`);
    if (window.confirm(`新版本 v${update.version} 已下载完成。现在重启并安装吗？`)) api.installUpdate();
  } else if (update.status === 'error') {
    button.classList.remove('rotating'); label.textContent = '刷新与更新'; setGlobalStatus('本地存储已就绪'); toast('项目已刷新，但暂时无法连接更新服务器', true);
  }
}

async function refreshProjectsAndUpdate() {
  if (state.pendingUpdate) {
    if (window.confirm('新版已经下载完成。现在重启并安装吗？')) api.installUpdate();
    return;
  }
  await loadProjects(false);
  const button = $('#refresh-projects-button');
  const label = $('#refresh-projects-label');
  button.classList.add('rotating'); label.textContent = '检查更新中';
  try {
    const result = await api.checkForUpdates();
    if (result.status === 'development' || result.status === 'unsupported') {
      button.classList.remove('rotating'); label.textContent = '刷新与更新'; toast('项目已刷新；安装版将从 GitHub 检查更新');
    }
  } catch (error) {
    button.classList.remove('rotating'); label.textContent = '刷新与更新'; setGlobalStatus('本地存储已就绪'); toast('项目已刷新，但更新检查失败', true);
  }
}

function renderProjects() {
  ui.grid.replaceChildren();
  ui.empty.hidden = state.projects.length > 0;
  ui.grid.hidden = state.projects.length === 0;
  ui.count.textContent = `${state.projects.length} 个项目`;
  state.projects.forEach((project, index) => {
    const card = document.createElement('article');
    card.className = 'project-card'; card.tabIndex = 0;
    const top = document.createElement('div'); top.className = 'card-top';
    const no = document.createElement('span'); no.className = 'project-number'; no.textContent = `PROJECT ${String(index + 1).padStart(2, '0')}`;
    const menu = document.createElement('button'); menu.className = 'card-menu'; menu.textContent = '×'; menu.title = '删除项目'; menu.setAttribute('aria-label', `删除项目 ${project.name}`);
    menu.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!window.confirm(`确定删除“${project.name}”吗？项目中的剧本和分镜都会被删除，此操作无法撤销。`)) return;
      try { await api.removeProject(project.id); await loadProjects(); toast('项目已删除'); } catch (error) { toast(error.message || '删除失败', true); }
    });
    top.append(no, menu);
    const middle = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = project.name;
    const description = document.createElement('p'); description.textContent = project.description || '还没有添加项目备注';
    middle.append(title, description);
    const meta = document.createElement('div'); meta.className = 'card-meta';
    const episodes = document.createElement('span'); episodes.className = 'episode-badge'; episodes.textContent = `${project.episodeCount || 0} 集`;
    const date = document.createElement('span'); date.textContent = `更新于 ${formatDate(project.updatedAt)}`;
    meta.append(episodes, date); card.append(top, middle, meta);
    card.addEventListener('click', () => openProject(project.id));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openProject(project.id); });
    ui.grid.append(card);
  });
}

async function openProject(projectId) {
  try {
    const [project, episodes] = await Promise.all([api.getProject(projectId), api.listEpisodes(projectId)]);
    state.project = project; state.episodes = episodes;
    ui.projectName.textContent = project.name;
    showEditor(); renderEpisodeList();
    if (episodes[0]) await selectEpisode(episodes[0].id, true);
  } catch (error) { toast(error.message || '项目打开失败', true); }
}

function renderEpisodeList() {
  ui.episodeList.replaceChildren();
  state.episodes.forEach((episode, index) => {
    const button = document.createElement('button'); button.className = `episode-item${state.episode?.id === episode.id ? ' active' : ''}`;
    const number = document.createElement('span'); number.className = 'episode-item-number'; number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('span'); title.textContent = episode.title;
    button.append(number, title); button.addEventListener('click', () => selectEpisode(episode.id)); ui.episodeList.append(button);
  });
}

async function selectEpisode(episodeId, force = false) {
  if (!force && state.episode?.id === episodeId) return;
  if (!force && !(await guardUnsaved())) return;
  try {
    const episode = await api.loadEpisode(state.project.id, episodeId);
    state.episode = episode;
    ui.episodeTitle.value = episode.title;
    ui.script.value = episode.script || '';
    ui.storyboard.value = episode.storyboard || '';
    const index = Math.max(0, state.episodes.findIndex(item => item.id === episodeId));
    ui.episodeIndex.textContent = `EP. ${String(index + 1).padStart(2, '0')}`;
    document.title = `${episode.title} · ${state.project.name} · 镜稿`;
    setDirty(false); updateCounts(); renderEpisodeList();
  } catch (error) { toast(error.message || '内容读取失败', true); }
}

async function saveCurrent() {
  if (!state.episode || state.saving) return;
  state.saving = true; ui.saveState.classList.add('saving'); ui.saveState.lastChild.textContent = ' 保存中';
  try {
    const saved = await api.saveEpisode({ projectId: state.project.id, episodeId: state.episode.id, title: ui.episodeTitle.value, script: ui.script.value, storyboard: ui.storyboard.value });
    state.episode = saved;
    const summary = state.episodes.find(item => item.id === saved.id);
    if (summary) Object.assign(summary, { title: saved.title, updatedAt: saved.updatedAt });
    ui.episodeTitle.value = saved.title; renderEpisodeList(); setDirty(false); toast('已保存到本地');
  } catch (error) { toast(error.message || '保存失败', true); setDirty(true); }
  finally { state.saving = false; ui.saveState.classList.remove('saving'); }
}

async function refreshEpisode() {
  if (!state.episode || !(await guardUnsaved())) return;
  const button = $('#reload-episode-button'); button.classList.add('rotating');
  try {
    state.episodes = await api.listEpisodes(state.project.id); renderEpisodeList();
    await selectEpisode(state.episode.id, true); toast('已读取最新保存版本');
  } catch (error) { toast(error.message || '刷新失败', true); }
  finally { button.classList.remove('rotating'); }
}

function openDialog(dialog, focusTarget) { dialog.showModal(); requestAnimationFrame(() => focusTarget?.focus()); }
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));

$('#new-project-button').addEventListener('click', () => openDialog(ui.projectDialog, $('#project-name-input')));
$('#empty-create-button').addEventListener('click', () => openDialog(ui.projectDialog, $('#project-name-input')));
$('#project-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = { name: $('#project-name-input').value.trim(), description: $('#project-description-input').value.trim() };
  if (!input.name) return;
  try { const project = await api.createProject(input); ui.projectDialog.close(); event.target.reset(); await loadProjects(); toast('项目已创建'); await openProject(project.id); }
  catch (error) { toast(error.message || '创建失败', true); }
});

$('#add-episode-button').addEventListener('click', () => {
  $('#episode-name-input').value = `第 ${state.episodes.length + 1} 集`;
  openDialog(ui.episodeDialog, $('#episode-name-input'));
});
$('#episode-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const title = $('#episode-name-input').value.trim(); if (!title) return;
  try { const episode = await api.createEpisode(state.project.id, title); ui.episodeDialog.close(); state.episodes = await api.listEpisodes(state.project.id); renderEpisodeList(); await selectEpisode(episode.id); toast('新集已添加'); }
  catch (error) { toast(error.message || '添加失败', true); }
});

$('#delete-episode-button').addEventListener('click', async () => {
  if (!state.episode || !window.confirm(`确定删除“${state.episode.title}”吗？此操作无法撤销。`)) return;
  try {
    await api.removeEpisode(state.project.id, state.episode.id);
    state.episodes = await api.listEpisodes(state.project.id); state.episode = null; renderEpisodeList();
    await selectEpisode(state.episodes[0].id, true); toast('当前集已删除');
  } catch (error) { toast(error.message || '删除失败', true); }
});

document.querySelectorAll('.expand-button').forEach(button => button.addEventListener('click', () => {
  const panel = button.dataset.panel;
  state.focus = state.focus === panel ? null : panel;
  ui.editorGrid.className = `editor-grid${state.focus ? ` focus-${state.focus}` : ''}`;
  button.title = state.focus ? '恢复双栏' : `放大${panel === 'script' ? '剧本' : '分镜'}`;
}));

ui.script.addEventListener('input', markDirty); ui.storyboard.addEventListener('input', markDirty); ui.episodeTitle.addEventListener('input', markDirty);
$('#save-button').addEventListener('click', saveCurrent);
$('#reload-episode-button').addEventListener('click', refreshEpisode);
$('#refresh-projects-button').addEventListener('click', refreshProjectsAndUpdate);
$('#sidebar-toggle').addEventListener('click', () => {
  const collapsed = ui.editor.classList.toggle('sidebar-collapsed');
  const button = $('#sidebar-toggle');
  button.title = collapsed ? '展开集数栏' : '收起集数栏';
  button.setAttribute('aria-label', button.title);
});
$('#back-button').addEventListener('click', async () => { if (!(await guardUnsaved())) return; showHome(); await loadProjects(); });
$('#brand-home').addEventListener('click', async () => { if (!ui.editor.hidden && !(await guardUnsaved())) return; showHome(); await loadProjects(); });
$('#data-folder-button').addEventListener('click', async () => { const result = await api.openDataFolder(); if (result) toast(result, true); });

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveCurrent(); }
  if (event.key === 'Escape' && state.focus) { state.focus = null; ui.editorGrid.className = 'editor-grid'; }
});
window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });

(async function init() {
  if (api.onUpdateStatus) api.onUpdateStatus(handleUpdateStatus);
  try { const info = await api.getAppInfo(); $('#app-version').textContent = `镜稿 v${info.version}`; }
  catch { /* version is informational */ }
  await loadProjects();
})();
