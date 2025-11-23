# GitHub Actions 多分支部署指南

## 🎯 功能说明

本项目配置了自动化部署，可以将不同分支部署到 GitHub Pages 的不同路径：

- **main** 分支 → 根路径 `https://yourusername.github.io/factors_of_colormap_new/`
- **random** 分支 → `/random` 路径 `https://yourusername.github.io/factors_of_colormap_new/random/`

## 🚀 使用方法

### 1. 启用 GitHub Pages

1. 进入仓库的 **Settings** → **Pages**
2. Source 选择：**Deploy from a branch**
3. Branch 选择：**gh-pages** / **(root)**
4. 点击 **Save**

### 2. 配置仓库权限

确保 GitHub Actions 有写入权限：

1. 进入 **Settings** → **Actions** → **General**
2. 找到 **Workflow permissions**
3. 选择 **Read and write permissions**
4. 勾选 **Allow GitHub Actions to create and approve pull requests**
5. 点击 **Save**

### 3. 推送代码触发部署

```bash
# 部署到根路径
git checkout main
git push origin main

# 部署到 /random 路径
git checkout random
git push origin random
```

### 4. 手动触发部署

1. 进入 **Actions** 标签
2. 选择 **Deploy Branch to Subdirectory**
3. 点击 **Run workflow**
4. 选择要部署的分支
5. 点击 **Run workflow**

## 📁 部署路径规则

| 分支名称 | 部署路径 | 访问 URL 示例 |
|---------|---------|--------------|
| `main` | `/` | `https://yourusername.github.io/factors_of_colormap_new/` |
| `random` | `/random/` | `https://yourusername.github.io/factors_of_colormap_new/random/` |

## 🔧 工作流程文件说明

### `.github/workflows/deploy-branch.yml`

这是推荐使用的配置文件，特点：

✅ **保留多分支内容**：每个分支部署到自己的子目录，互不覆盖  
✅ **自动创建索引页**：每个部署路径都有美观的索引页面  
✅ **支持 main 和 random 分支**：main 部署到根目录，random 部署到 /random 子目录  
✅ **简洁高效**：专门为两个分支优化

### `.github/workflows/deploy.yml`

这是简化版配置，使用 GitHub Pages Actions：

⚠️ **注意**：这个配置会覆盖整个 gh-pages 分支，不保留其他分支的内容

## 🎨 项目结构

部署后的文件结构：

```
gh-pages/
├── index.html                          # main 分支的主页
├── Colormap_Visualizer/                # main 分支的内容
│   ├── colormap-visualizer.html
│   └── stimuli-generator.html
├── gaussian_perturbation_system/
│   └── index.html
├── rainbows good or bad for/
│   └── ...
└── random/                             # random 分支的内容
    ├── index.html
    ├── Colormap_Visualizer/
    ├── gaussian_perturbation_system/
    └── ...
```

## 🔍 查看部署状态

### 方法 1：GitHub Actions 日志

1. 进入仓库的 **Actions** 标签
2. 点击最近的工作流运行
3. 查看每个步骤的详细日志
4. 成功时会显示 ✅ 标记

### 方法 2：GitHub Pages 状态

1. 进入 **Settings** → **Pages**
2. 查看 **Your site is live at** 后面的 URL
3. 点击 **Visit site** 查看部署结果

## 🐛 常见问题

### 问题 1：404 错误

**原因**：GitHub Pages 可能需要几分钟才能更新

**解决**：
- 等待 3-5 分钟后重试
- 检查 Settings → Pages 中的 URL 是否正确
- 清除浏览器缓存

### 问题 2：权限错误

```
refusing to allow a GitHub App to create or update workflow
```

**解决**：按照上面"配置仓库权限"的步骤操作

### 问题 3：分支部署后看不到内容

**原因**：可能没有正确推送到 gh-pages 分支

**解决**：
```bash
# 检查 gh-pages 分支
git fetch origin
git checkout gh-pages
ls -la
```

### 问题 4：相对路径问题

如果你的 HTML 文件中使用了相对路径（如 `<link href="/style.css">`），在子目录中可能会失败。

**解决方案 A**：使用相对路径
```html
<!-- 不要用 /style.css -->
<link href="./style.css">
```

**解决方案 B**：使用 base 标签
```html
<head>
  <base href="/dev/">  <!-- 根据部署路径调整 -->
  <link href="/style.css">
</head>
```

## 📝 自定义配置

### 添加新分支

如果需要添加其他分支，编辑 `.github/workflows/deploy-branch.yml`：

**第 1 步**：添加分支到触发列表
```yaml
on:
  push:
    branches:
      - main
      - random
      - staging  # 新增分支
```

**第 2 步**：添加部署路径规则
```yaml
- name: Determine deployment path
  id: path
  run: |
    BRANCH_NAME="${GITHUB_REF#refs/heads/}"
    
    if [ "$BRANCH_NAME" = "main" ]; then
      echo "deploy_path=." >> $GITHUB_OUTPUT
    elif [ "$BRANCH_NAME" = "random" ]; then
      echo "deploy_path=random" >> $GITHUB_OUTPUT
    elif [ "$BRANCH_NAME" = "staging" ]; then
      echo "deploy_path=staging" >> $GITHUB_OUTPUT  # 新增
    else
      echo "❌ Unknown branch: $BRANCH_NAME"
      exit 1
    fi
```

### 修改触发条件

如需在 Pull Request 时也触发部署预览：

```yaml
on:
  push:
    branches:
      - main
      - random
  pull_request:        # 在 PR 时也部署
    branches:
      - main
  workflow_dispatch:   # 允许手动触发
```

## 📚 技术细节

### 工作流程

1. 当代码推送到指定分支时，触发 GitHub Actions
2. Actions 检出当前分支的代码和 gh-pages 分支
3. 根据分支名称确定部署路径
4. 将文件复制到 gh-pages 分支的对应路径
5. 创建索引页面
6. 提交并推送到 gh-pages 分支
7. GitHub Pages 自动发布更新

### 为什么使用 gh-pages 分支？

- ✅ 保持源代码和部署文件分离
- ✅ 可以手动回滚到之前的版本
- ✅ 查看完整的部署历史
- ✅ 支持多分支同时部署

## 🎉 完成

现在你的项目已经配置好多分支部署了！每次推送代码时，都会自动部署到对应的路径。

访问你的网站：`https://<username>.github.io/<repository>/`
