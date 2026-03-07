"""
数据预处理脚本：将 result.csv 转换为适合 R 分析的格式
"""

import pandas as pd
import json
import numpy as np

print("=== 开始数据预处理 ===")

# 1. 读取数据
print("\n1. 读取数据文件...")
result_df = pd.read_csv('output_data/result_all_participants.csv')
print(f"   - result_all_participants.csv: {len(result_df)} 行")

with open('colormaps.json', 'r') as f:
    colormaps = json.load(f)
print(f"   - colormaps.json: {len(colormaps)} 个色彩映射")

# 创建 colormapId -> colormap 的映射
colormap_dict = {cm['id']: cm for cm in colormaps}

# 2. 简化版 metrics 计算（先用占位符）
print("\n2. 添加 metrics 列（占位符）...")
unique_colormap_ids = result_df['colormapId'].unique()

# 为每个 colormap 添加简单的统计量
metrics_cache = {}
for cm_id in unique_colormap_ids:
    if cm_id not in colormap_dict:
        continue
    
    colormap_lab = np.array(colormap_dict[cm_id]['colormap'])
    
    # 简单计算 LAB 长度
    lab_length = 0
    for i in range(1, len(colormap_lab)):
        lab1 = colormap_lab[i-1]
        lab2 = colormap_lab[i]
        distance = np.sqrt((lab2[0] - lab1[0])**2 + 
                          (lab2[1] - lab1[1])**2 + 
                          (lab2[2] - lab1[2])**2)
        lab_length += distance
    
    # 简单统计
    L_values = colormap_lab[:, 0]
    a_values = colormap_lab[:, 1]
    b_values = colormap_lab[:, 2]
    
    luminance_var = np.sum(np.abs(np.diff(L_values)))
    chroma_values = np.sqrt(a_values**2 + b_values**2)
    chromatic_var = np.sum(np.abs(np.diff(chroma_values)))
    
    metrics_cache[cm_id] = {
        'LAB_Length': lab_length,
        'luminance_variation': luminance_var,
        'chromatic_variation': chromatic_var,
        'ciede2000_discriminative': lab_length / len(colormap_lab),  # 简化版
        'hue_discriminative': chromatic_var / 10,  # 简化版
        'contrast_sensitivity': lab_length / 100,  # 简化版
        'categorization': max(1, int(lab_length / 50))  # 简化版
    }

# 3. 添加 metrics 列
print("\n3. 添加 metrics 列到数据框...")
for metric_name in ['ciede2000_discriminative', 'contrast_sensitivity', 
                    'hue_discriminative', 'luminance_variation', 
                    'chromatic_variation', 'categorization', 'LAB_Length']:
    result_df[metric_name] = result_df['colormapId'].map(
        lambda x: metrics_cache.get(x, {}).get(metric_name, np.nan)
    )

# 4. 重命名列
print("\n4. 重命名列...")
result_df = result_df.rename(columns={
    'isCorrect': 'correct',
    'reactionTimeMs': 'reactionTime'
})

# 5. 添加对数变换
print("\n5. 添加衍生变量...")
result_df['log_categorization'] = np.log(result_df['categorization'] + 1)
result_df['logLAB_Length'] = np.log(result_df['LAB_Length'] + 1)
result_df['log_hue_discriminative'] = np.log(result_df['hue_discriminative'] + 0.1)
result_df['log_luminance_variation'] = np.log(result_df['luminance_variation'] + 1)
result_df['log_chromatic_variation'] = np.log(result_df['chromatic_variation'] + 1)

# 6. 保存
print("\n6. 保存结果...")
import os
os.makedirs('output_data', exist_ok=True)
output_file = 'output_data/result_for_R.csv'
result_df.to_csv(output_file, index=False)
print(f"   保存至: {output_file}")

# 7. 统计信息
print("\n=== 处理完成 ===")
print(f"总行数: {len(result_df)}")
print(f"参与者数: {result_df['participantId'].nunique()}")
print(f"色彩映射数: {result_df['colormapId'].nunique()}")
print(f"频段类型: {sorted(result_df['frequencyId'].unique())}")
print(f"Chroma 模式: {sorted(result_df['colormapChromaPattern'].unique())}")
print(f"Lumi 模式: {sorted(result_df['colormapLumaPattern'].unique())}")
print(f"\n平均准确率: {result_df['correct'].mean():.3f}")
