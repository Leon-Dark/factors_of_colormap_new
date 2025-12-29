# Stimuli Generator - Modular Structure

## 模块说明

### 核心配置
- **config.js** - 全局变量和配置参数

### 采样和Metrics
- **samplingModes.js** - JND和均匀采样模式的计算函数
- **metrics.js** - 静态metrics计算（CIEDE2000、对比度、色相等）
- **utils.js** - 工具函数（颜色转换、CIEDE2000计算等）

### UI和交互
- **uiControls.js** - UI控制函数（模式切换、参数更新）
- **statistics.js** - 统计计算和显示
- **filters.js** - 过滤和边框更新

### 可视化和生成
- **visualization.js** - 色图可视化函数（绘制色图、曲线等）
- **colorGeneration.js** - 色彩生成算法
- **main.js** - 主入口，初始化和整合所有模块

## 引入顺序

HTML中应按以下顺序引入模块（顺序很重要）：

```html
<script src="js/config.js"></script>
<script src="js/utils.js"></script>
<script src="js/samplingModes.js"></script>
<script src="js/metrics.js"></script>
<script src="js/statistics.js"></script>
<script src="js/filters.js"></script>
<script src="js/uiControls.js"></script>
<script src="js/colorGeneration.js"></script>
<script src="js/visualization.js"></script>
<script src="js/main.js"></script>
```
