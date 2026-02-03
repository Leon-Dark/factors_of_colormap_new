# Batch Colormap Generator

批量生成高质量 colormap 的 Node.js 工具。

## 功能特性

- 自动生成 **48 种参数组合** 的 colormap:
  - 3 种 Hue targets: 100°, 200°, 300°
  - 4 种 Chroma patterns: constant, linear, diverging, thermal
  - 4 种 Luminance patterns: constant, linear, diverging, thermal
  
- **严格质量控制**:
  - Small Window Check (interval=2, min diff≥3)
  - Large Window Check (interval=5, min diff≥10)
  - 自动重试机制，带 hue 微调
  
- **输出格式**: JSON 文件，包含 RGB 值和元数据

## 安装

```bash
cd stimuli/batch_gen
npm install
```

## 使用方法

### 基本用法

```bash
# 生成 48 个 colormaps (每种组合 1 个)
node batch_generate.js

# 生成 96 个 colormaps (每种组合 2 个)
node batch_generate.js --count 2

# 指定输出目录
node batch_generate.js --output results

# 启用详细输出
node batch_generate.js --verbose
```

### 命令行参数

```
-n, --count <n>      每种组合生成多少个 colormap (默认: 1)
-o, --output <dir>   输出目录 (默认: 'output')
-v, --verbose        详细日志
-h, --help           显示帮助信息
```

## 输出结构

生成的 `colormaps.json` 文件包含一个数组，每个元素为:

```json
{
  "id": 0,
  "metadata": {
    "hueTarget": 100,
    "actualHue": 102.3,
    "chromaPattern": "linear",
    "lumiPattern": "diverging",
    "originalChroma": [20, 120],
    "adjustedChroma": [20, 110],
    "deltaC": 10,
    "deltaL": 0,
    "retryCount": 5
  },
  "colormap": [[r, g, b], [r, g, b], ...],  // 256 个 RGB 值
  "hValues": [h1, h2, ...],
  "cValues": [c1, c2, ...],
  "lValues": [l1, l2, ...]
}
```

## 算法详解：贪婪搜索与局部优化 (Greedy Search + Local Optimization)

本工具采用了一套 **"Greedy + Local Optimization"** 的混合搜索策略，旨在保证生成成功率的同时，尽可能寻找离设计初衷偏差最小的“最优解”。

这与网页预览版（First Fit 策略）有显著不同，批处理版本会进行更深度的搜索。

### 核心流程

#### 1. 初始化阶段 (Initialization)
- **参数空间**: 定义 48 种 Hue/Chroma/Luminance 组合。
- **扰动向量池 (Perturbation Vectors)**:
    预计算一系列 `[deltaC, deltaL]` 向量，并按**欧几里得距离 (Euclidean Distance)** 从小到大排序。
    - Fine (0-20, step 2)
    - Medium (25-50, step 5)
    - Coarse (60-100, step 10)
    这意味着算法总是优先尝试修改量最小的方案。

#### 2. 第一阶段：贪婪搜索 (Phase 1: Greedy Search)
目标：**快速找到第一个可行解 (First Feasible Solution)**。

- 按排序后的顺序遍历扰动向量池。
- 对每一对 `[deltaC, deltaL]`：
    1.  **控制点压缩**: `NewMax = Max - delta`。不改变形状，仅压缩极值范围。
    2.  **生成候选**: 根据 CIELAB 路径生成 256 个样本点。
    3.  **Gamut Check**: 检查是否所有点都在 sRGB 色域内。
    4.  **Quality Check**:
        - **Small Window**: 检查局部是否有颜色混淆 (`k=2`, `minDiff >= 3`)。
        - **Large Window**: 检查全局区分度 (`k=5`, `minDiff >= 10`)。
- **行为**: 一旦找到第一个通过所有检查的解，标记为 `firstFeasible`，并立即进入第二阶段。

#### 3. 第二阶段：局部优化 (Phase 2: Local Refinement)
目标：**在可行解附近寻找更优解**。

- 以第一阶段找到的 `firstFeasible` 为中心，定义一个局部搜索窗口（默认为 `±7`）。
- 遍历此窗口内的所有邻居 `[dc, dl]`。
- **优化准则**: 
    - 如果邻居的距离 `dist(dc, dl)` **小于**当前最优解的距离，且该邻居也能通过所有质量检查，则更新最优解。
    - 这确保了我们不仅仅满足于“能用”，而是找到了局部范围内修改量最小的那个配置。

> **优化模式**:
> - **FAST Mode**: 局部窗口 `±3`，且如果距离小于阈值会提前终止。
> - **QUALITY Mode** (默认): 局部窗口 `±7`，进行穷尽式局部搜索。

#### 4. 外层循环：Hue 随机游走 (Hue Random Walk)
如果上述两阶段都无法找到任何可行解（即贪婪搜索失败）：
- **触发重试**: `retryCount++`
- **Hue 偏移**: 对目标 Hue 进行随机微调 `actualHue = targetHue + random(±10°)`。
- **重启**: 使用新的 Hue 重新开始第一阶段的贪婪搜索。
- **终止**: 直到成功或达到 `maxRetries` (100次)。

### 关键差异总结

| 特性 | 网页预览版 (Web) | 批处理生成版 (Batch) |
| :--- | :--- | :--- |
| **搜索策略** | First Fit (首次匹配即止) | Greedy + Local Optimization |
| **优化深度** | 浅 (追求响应速度) | 深 (追求结果质量) |
| **结果质量** | 合格即可 | 局部最优 (偏差最小) |
| **运行时间** | 毫秒级 | 每个 Colormap 约 1-5秒 |

此算法确保了生成的 Colormap 集不仅在感知上是均匀且可区分的 (Uniform & Discriminative)，而且最大程度地保留了设计者设定的 Chroma/Luminance 变化趋势。

## 扩展参数

编辑 `batch_generate.js` 中的 `CONFIG` 对象:

```javascript
const CONFIG = {
    hueTargets: [100, 200, 300],      // 修改 hue 目标
    chromas: [20, 120],                // 修改 chroma 范围
    lumis: [20, 90],                   // 修改 luminance 范围
    
    sampleCount: 30,                   // 采样点数量
    smallIntervalK: 2,                 // Small Window 间隔
    smallMinDiff: 3,                   // Small Window 最小差异
    largeIntervalK: 5,                 // Large Window 间隔
    largeMinDiff: 10,                  // Large Window 最小差异
    
    maxRetries: 100                    // 最大重试次数
};
```

## 注意事项

- 生成过程可能需要数分钟到数十分钟，具体取决于参数和硬件
- 如果某些组合频繁失败，可以降低质量阈值或增加 `maxRetries`
- 生成过程中会显示实时进度和每个 colormap 的重试次数
