# 镜稿首次发布说明

这一步只需要完整执行一次。完成后，镜稿主页的“刷新与更新”按钮就能从 GitHub Releases 检查并安装新版。

## 一、把源码放入仓库

1. 在 GitHub Desktop 中选中 `jingao-releases`。
2. 点击菜单 `Repository` → `Show in Explorer`（在资源管理器中显示）。
3. 将本压缩包内的全部文件解压到该仓库文件夹根目录。
4. 确认仓库文件夹中可以直接看到 `package.json`、`src` 和 `.github`。

## 二、提交并推送

1. 回到 GitHub Desktop。
2. 左下角 Summary 填写：`发布镜稿 v0.2.0`。
3. 点击 `Commit to main`（若显示 master，则点击 `Commit to master`）。
4. 点击顶部 `Push origin`。

## 三、等待自动构建

1. 打开 `https://github.com/zhaiyue041011-sketch/jingao-releases/actions`。
2. 等待 `Build and Release Windows` 任务显示绿色对勾，通常需要几分钟。
3. 打开 `https://github.com/zhaiyue041011-sketch/jingao-releases/releases`。
4. 下载 `Jingao-0.2.0-x64-Setup.exe` 并安装。

## 四、以后更新

每次收到新源码后，将文件覆盖到同一仓库，提交并 Push。自动构建完成后，已安装的镜稿可在主页点击“刷新与更新”下载新版并重启安装。

版本号必须递增，例如 `0.2.0` → `0.2.1`。GitHub Release 必须保持为正式发布，不能是 Draft。
