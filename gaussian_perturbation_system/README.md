# 高斯分布合成与扰动可视化系统
# Gaussian Distribution Synthesis and Perturbation Visualization System

## 项目概述 (Overview)

这是一个交互式的可视化系统，用于研究和分析不同空间频率下高斯分布的合成与扰动效果。系统通过不同尺寸的高斯核来模拟图像的多频率结构，并支持多种扰动模式，帮助研究人类对频率扰动的感知变化。

This is an interactive visualization system designed to study and analyze Gaussian distribution synthesis and perturbation effects at different spatial frequencies. The system uses Gaussian kernels of various sizes to simulate multi-frequency image structures and supports multiple perturbation modes to help investigate human perception of frequency disturbances.

## 核心功能 (Key Features)

### 1. 多尺度高斯生成 (Multi-Scale Gaussian Generation)
- **5个频率层级**: 小、中小、中等、中大、大
- **频率映射**: 
  - 小高斯 (Small, σ≈8px) → 高频区域（细节丰富）
  - 大高斯 (Large, σ≈140px) → 低频区域（平滑结构）
- **可调参数**: 每个层级的高斯尺寸和数量均可独立调整

### 2. 扰动控制系统 (Perturbation Control System)
支持三种主要扰动参数：

#### 扰动幅度 (Magnitude)
- 范围: 0-1
- 控制每个高斯的中心、方差、幅值的扰动程度

#### 扰动比例 (Ratio)
- 范围: 0-100%
- 定义被扰动的高斯数量占比

#### 扰动分布 (Distribution)
- **全局扰动**: 随机分布在整个图像范围
- **局部扰动**: 基于ROI的区域性扰动，支持设置扰动中心和半径

### 3. 可视化模式 (Visualization Modes)

#### 原始分布视图
- 显示未扰动的高斯混合分布
- 使用Viridis色彩映射
- 标记高斯中心点

#### 扰动后视图
- 显示应用扰动后的分布
- 高亮显示被扰动的高斯

#### 差异图
- 对比原始和扰动后的差异
- 使用热力图(Hot colormap)显示
- 计算并显示SSIM值

#### 频率热力图
- 显示不同频率层的能量分布
- 高频能量权重更高
- 使用Plasma色彩映射

## 技术架构 (Technical Architecture)

### 核心模块

#### 1. biGauss (来自现有代码)
**直接使用项目中的现有实现**：
- 源文件：`lineup/gaussmix_bivariate.js`
- 二维高斯分布类，支持相关系数控制
- 包含 `eval()` 方法用于计算高斯值
- 支持 `updateRho()` 方法更新相关系数
- 我们在此基础上扩展了扰动和重置功能

#### 2. GaussianGenerator (gaussianGenerator.js)
高斯分布生成器：
- 多层级高斯生成
- 避免重叠的空间布局算法
- 高效的场渲染

#### 3. PerturbationSystem (perturbation.js)
扰动系统：
- 全局随机扰动
- 局部区域扰动
- 频率选择性扰动
- 结构化扰动（簇状）

#### 4. VisualizationSystem (visualization.js)
可视化系统：
- 多视图管理
- 多种色彩映射
- 实时渲染
- SSIM计算

#### 5. Utils (utils.js)
工具函数库：
- 颜色映射 (Viridis, Plasma, Hot, Cool)
- SSIM计算
- 数据导出
- 统计分析

## 使用指南 (Usage Guide)

### 快速开始

1. **打开系统**
   - 在浏览器中打开 `index.html`
   - 系统自动初始化

2. **生成高斯分布**
   - 调整各层级的尺寸和数量参数
   - 点击"生成新分布"按钮
   - 查看原始分布和频率热力图

3. **应用扰动**
   - 设置扰动幅度（0-1）
   - 设置扰动比例（0-100%）
   - 选择扰动模式（全局/局部）
   - 选择目标层级
   - 点击"应用扰动"按钮

4. **查看结果**
   - 切换不同视图标签
   - 查看SSIM值
   - 点击画布查看单个高斯详情

5. **导出数据**
   - 点击"导出数据"按钮
   - 保存JSON格式的完整配置和统计信息

### 参数建议

#### 初始实验设置
```javascript
// 高频层（小高斯）
Small: σ = 8px, count = 15
Medium-Small: σ = 20px, count = 10

// 中频层
Medium: σ = 40px, count = 8

// 低频层（大高斯）
Medium-Large: σ = 80px, count = 5
Large: σ = 140px, count = 3
```

#### 扰动强度级别
- **小扰动**: magnitude = 0.1-0.2, ratio = 10-20%
- **中等扰动**: magnitude = 0.3-0.5, ratio = 30-50%
- **大扰动**: magnitude = 0.6-1.0, ratio = 50-100%

## 研究应用 (Research Applications)

### 1. 频率感知研究
- 研究人类对不同频率扰动的敏感度
- 比较高频vs低频扰动的可察觉性

### 2. 图像质量评估
- 评估扰动对结构相似性的影响
- 建立频率-感知映射关系

### 3. 扰动模式对比
- 对比全局扰动vs局部扰动的效果
- 分析不同扰动比例的影响

### 4. 实验设计
- 生成标准化的测试图像
- 控制变量进行2AFC实验
- 导出数据进行统计分析

## 数据导出格式 (Export Format)

系统导出的JSON包含：

```json
{
  "timestamp": "2024-11-08T10:20:00.000Z",
  "config": {
    "width": 600,
    "height": 600,
    "sizeLevels": {...},
    "gaussians": [...]
  },
  "perturbation": {
    "history": [...],
    "statistics": {...},
    "gaussians": [...]
  },
  "statistics": {
    "totalPerturbations": 1,
    "perturbedGaussians": 15,
    "byLevel": {...}
  }
}
```

## 浏览器要求 (Browser Requirements)

- 现代浏览器（Chrome, Firefox, Safari, Edge）
- 支持HTML5 Canvas
- 支持ES6+ JavaScript
- 推荐屏幕分辨率: 1920x1080或更高

## 性能优化 (Performance)

系统已针对以下方面进行优化：
- 使用Float32Array进行高效数值计算
- 边界框裁剪减少不必要的计算
- 缓存渲染数据避免重复计算
- 使用ImageData直接操作像素

## 未来扩展 (Future Extensions)

- [ ] 支持更多色彩映射方案
- [ ] 添加Gabor滤波器支持
- [ ] 实现频谱分析工具
- [ ] 支持图像上传和叠加
- [ ] 添加动画和时间序列分析
- [ ] 批量实验模式
- [ ] 用户实验数据收集

## 参考文献 (References)

本系统基于以下研究领域的理论：
- 空间频率分析
- 结构相似性(SSIM)
- 高斯混合模型
- 视觉感知心理学

## 开发信息 (Development)

- 开发语言: JavaScript (ES6+), HTML5, CSS3
- 依赖库: D3.js (用于现有代码兼容)
- **集成现有代码**：
  - `gaussmix_bivariate.js` - biGauss类
  - `gauss_w_noise.js` - 噪声高斯混合
  - `scalar.js` - 标量场处理
  - `scalar_sample.js` - 采样系统
- 模块化设计
- 可扩展架构

## 致谢 (Acknowledgments)

本系统的实现参考了项目中现有的Rainbow实验代码框架，特别是高斯分布生成和扰动的相关实现。

---

**版本**: 1.0.0  
**更新日期**: 2024-11-08  
**许可**: MIT License
