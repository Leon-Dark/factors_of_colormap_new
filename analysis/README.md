# Analysis 目录说明

整理参与者原始数据 → 生成分析数据 → 统计建模 → 导出图表。

## 目录结构

```text
analysis/
├─ user_data/                      # 参与者原始 CSV
├─ output_data/                    # 处理后的数据表
├─ output_images/                  # 生成的图表
├─ colormaps.json                  # 48 个 colormap 的 LAB 定义
├─ merge_all_results.py            # 合并数据 + 计算 metrics
├─ preprocess_for_R.py             # 预处理为 R 建模格式
├─ check_colormap_distribution.py  # 检查数据均衡性
├─ exp_new_factors.R               # 主分析脚本（推荐）
├─ exp_ours.R                      # 备用分析脚本
└─ README.md
```

## 文件功能说明

### `merge_all_results.py`

把所有参与者的 CSV 合并成一张总表。同时根据 `colormaps.json` 为每个 colormap 计算色彩 metrics（LAB_Length、luminance_variation、chromatic_variation、ciede2000_discriminative、hue_discriminative、contrast_sensitivity、categorization）及其对数变换。

### `preprocess_for_R.py`

将合并总表转换为 R 可直接建模的格式：列名标准化（`isCorrect → correct`、`reactionTimeMs → reactionTime`），补齐 metrics 与 log 字段。

### `check_colormap_distribution.py`

检查 48 个 colormap 在正式试验中的分布是否均衡，区分控制试验（trialId 9000-9003）和正式试验，报告每个 colormap 的次数及异常。

### `exp_new_factors.R`（主分析 — 多因子设计）

分析 colormap 设计因子对准确率的影响。过滤控制试验后，做混合效应逻辑回归（GLMM）：
- 模型 1：主效应（chromaPattern + lumiPattern + frequencyId）
- 模型 2：交互效应（chromaPattern × lumiPattern）
- 模型 3：色彩 metrics 对准确率的影响
- 随机效应：参与者、colormap

同时导出准确率条形图和交互热图到 `output_images/`。

### `exp_ours.R`（精简版 — 单指标逐个建模）

逐个测试每个色彩 metric 对准确率的预测力。为每个 metric（LAB_Length、categorization、CIEDE2000、hue、luminance、chromatic 及其 log 版本）分别建一个 GLMM，然后比较 AIC/BIC，输出显著性，选出最优单指标模型。不生成图表。

### `colormaps.json`

48 个 colormap 的 LAB 色彩空间路径数据，供 Python 脚本计算色彩指标。

## 运行顺序

```bash
python merge_all_results.py
python preprocess_for_R.py
Rscript exp_new_factors.R
```

## 注意事项

- 控制试验（trialId 9000-9003）用于 engagement check，R 脚本已自动过滤，不参与正式统计。
- 主分析请优先使用 `exp_new_factors.R`。

---
