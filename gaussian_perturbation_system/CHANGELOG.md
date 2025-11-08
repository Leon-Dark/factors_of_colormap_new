# 更新日志 (Changelog)

## [1.0.1] - 2024-11-08

### 修改 (Changed)
- **集成现有JS文件**：系统现在直接使用项目中已有的高斯分布实现
  - 引入 `gaussmix_bivariate.js` 中的 `biGauss` 类
  - 引入 `gauss_w_noise.js` 中的高斯簇和噪声功能
  - 引入 `scalar.js` 和 `scalar_sample.js` 用于场处理
  - 引入 D3.js 作为必要依赖

### 移除 (Removed)
- 移除自定义的 `BiGauss` 类（`js/biGauss.js`）
- 现在使用现有代码库中的 `biGauss` 实现

### 新增 (Added)
- 扩展 `biGauss` 对象，添加以下属性：
  - `originalMX`, `originalMY` - 存储原始位置
  - `originalSX`, `originalSY` - 存储原始标准差
  - `originalRho`, `originalScaler` - 存储原始参数
  - `isPerturbed` - 标记是否被扰动
  - `sizeLevel` - 高斯所属的尺寸级别
  - `color` - 用于可视化的颜色标记
  - `id` - 唯一标识符

- 在 `PerturbationSystem` 类中添加新方法：
  - `perturbGaussian(gauss, magnitude, perturbType)` - 扰动单个高斯
  - `resetGaussianPerturbation(gauss)` - 重置单个高斯的扰动

### 技术细节 (Technical Details)

#### 文件引入顺序
```html
<!-- D3.js -->
<script src="../rainbows good or bad for/.../d3.min.js"></script>

<!-- 现有高斯模块 -->
<script src="../rainbows good or bad for/.../scalar.js"></script>
<script src="../rainbows good or bad for/.../gaussmix.js"></script>
<script src="../rainbows good or bad for/.../gaussmix_bivariate.js"></script>
<script src="../rainbows good or bad for/.../gauss_w_noise.js"></script>
<script src="../rainbows good or bad for/.../scalar_sample.js"></script>

<!-- 我们的模块 -->
<script src="js/utils.js"></script>
<script src="js/gaussianGenerator.js"></script>
<script src="js/perturbation.js"></script>
<script src="js/visualization.js"></script>
<script src="js/main.js"></script>
```

#### 集成测试
- 新增 `test_integration.html` 用于验证集成
- 测试 `biGauss` 类的基本功能
- 验证所有必要方法可用

### 兼容性 (Compatibility)
- ✅ 完全兼容现有的 Rainbow 实验框架
- ✅ 可以使用现有代码的所有高斯分布功能
- ✅ 保持了原有的可视化系统和用户界面
- ✅ 扰动和重置功能完全正常

### 未来可扩展 (Future Extensions)
基于现有代码集成，可以轻松添加：
- `ClusterOfGauss` - 高斯簇功能
- `GaussMixWithNoise` - 带噪声的高斯混合
- `GaborContour` - Gabor滤波器支持
- 更复杂的扰动模式（如密度扰动、噪声扰动）

---

## [1.0.0] - 2024-11-08

### 初始发布 (Initial Release)
- 基本的高斯分布生成系统
- 多尺度频率层级（5个级别）
- 全局和局部扰动支持
- 四种可视化视图
- 交互式控制面板
- 数据导出功能
