# 镜稿 v0.2.0

镜稿是一款面向编剧、导演和短片创作者的本地桌面工作台。项目、集数、剧本与分镜都保存在本机，不依赖网络。

## 已实现

- 创建与删除项目，并为项目命名、添加备注
- 每个项目管理多集内容
- 剧本与分镜双栏同时编辑
- 剧本或分镜单独放大，按 `Esc` 恢复双栏
- 更紧凑的顶部工具栏与集数栏，并可一键收起左侧集数栏
- 手动保存与 `Ctrl + S` 快捷保存
- 主页“刷新与更新”会刷新项目列表，并检查 GitHub Releases 最新版本
- 发现新版后自动下载，并提示重启安装
- 未保存内容离开/刷新保护
- 原子写入本地 JSON，降低意外中断导致文件损坏的风险
- Windows 安装版和免安装版打包配置

## 本地运行

先安装 [Node.js 22 LTS](https://nodejs.org/)，然后在项目目录运行：

```bash
npm install
npm start
```

## 首次发布与自动更新

本项目已绑定公开更新仓库：

`https://github.com/zhaiyue041011-sketch/jingao-releases`

将源码放入该仓库并推送到 `main` 分支后，GitHub Actions 会自动：

1. 构建 Windows NSIS 安装版。
2. 生成 `latest.yml` 与差分更新文件。
3. 创建与当前 `package.json` 版本一致的正式 Release。

请从 Releases 下载 `Jingao-版本-x64-Setup.exe` 并安装一次。此后在镜稿主页点击“刷新与更新”，即可检查、下载并安装后续版本。

每次发布新版本前，必须提高 `package.json` 中的 `version`，例如从 `0.2.0` 改为 `0.2.1`，再推送代码。

## 本地打包 Windows EXE

在 Windows 电脑中运行：

```bash
npm install
npm run dist:win
```

生成文件位于 `release` 文件夹：

- `Jingao-版本-x64-Setup.exe`：安装版
- `Jingao-版本-x64-Portable.exe`：免安装版

仓库也包含 `.github/workflows/build-windows.yml`。推送 `v*` 标签或在 GitHub Actions 中手动运行，即可下载 Windows EXE 构建产物。

## 数据位置与刷新含义

桌面版数据默认保存在 Electron 的应用数据目录下，可点击右上角文件夹按钮直接打开。主页“刷新”会重新扫描项目；编辑页“刷新”会重新读取当前集最后一次保存到磁盘的版本。如果有未保存修改，应用会先提示确认。

编辑页中的“刷新”仍只读取当前集最后一次保存到磁盘的版本，不触发软件更新。

## 数据结构

```text
workspace/
  projects/
    <project-id>/
      project.json
      episodes/
        <episode-id>.json
```
