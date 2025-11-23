# 🚀 快速部署指南

## 简介

你的项目现在有两个分支：
- **main** → 部署到根路径
- **random** → 部署到 `/random` 子路径

## ⚡ 三步快速开始

### 第 1 步：提交并推送配置文件

```bash
git add .github/ DEPLOYMENT.md README-DEPLOY.md
git commit -m "Add GitHub Actions deployment config"
git push origin main
```

### 第 2 步：配置 GitHub Pages

1. 进入你的 GitHub 仓库页面
2. 点击 **Settings** (设置)
3. 左侧菜单找到 **Pages**
4. 在 "Build and deployment" 部分：
   - **Source**: 选择 `Deploy from a branch`
   - **Branch**: 选择 `gh-pages` 和 `/ (root)`
5. 点击 **Save**

### 第 3 步：配置 Actions 权限

1. 在 **Settings** 页面
2. 左侧菜单找到 **Actions** → **General**
3. 滚动到 "Workflow permissions"
4. 选择 **Read and write permissions** ✅
5. 勾选 **Allow GitHub Actions to create and approve pull requests** ✅
6. 点击 **Save**

## ✅ 完成！

现在每次你推送代码到 `main` 或 `random` 分支时，会自动部署：

```bash
# 部署 main 分支到根路径
git checkout main
git push origin main
# 访问: https://yourusername.github.io/factors_of_colormap_new/

# 部署 random 分支到 /random
git checkout random
git push origin random
# 访问: https://yourusername.github.io/factors_of_colormap_new/random/
```

## 📊 查看部署状态

1. 进入仓库的 **Actions** 标签
2. 查看最新的工作流运行
3. 绿色 ✅ = 部署成功
4. 红色 ❌ = 部署失败（点击查看日志）

## 🔗 访问你的网站

部署完成后（通常需要 1-3 分钟），访问：

- **Main**: `https://yourusername.github.io/factors_of_colormap_new/`
- **Random**: `https://yourusername.github.io/factors_of_colormap_new/random/`

> 记得把 `yourusername` 替换成你的 GitHub 用户名

## 🎨 网站内容

部署后，每个路径都会有一个索引页面，链接到：

- Colormap Visualizer
- Stimuli Generator  
- Gaussian Perturbation System
- Experiment Interface

## 💡 提示

- **首次部署**：可能需要等待 5 分钟
- **后续部署**：通常 1-2 分钟完成
- **缓存问题**：清除浏览器缓存或使用隐身模式

## 📖 详细文档

查看 [`DEPLOYMENT.md`](./DEPLOYMENT.md) 获取完整文档。

---

**遇到问题？** 检查 Actions 日志，或参考 DEPLOYMENT.md 中的"常见问题"部分。
