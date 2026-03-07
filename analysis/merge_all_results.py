"""
合并所有参与者的 CSV 文件到一个 result.csv
并为每个 colormap 计算 metrics
"""

import pandas as pd
import json
import numpy as np
import glob
import os

print("=== 开始合并所有实验数据 ===")

# 1. 查找所有参与者的 CSV 文件
csv_files = glob.glob('user_data/*_*.csv')  # 格式：participantId_timestamp.csv

print(f"\n找到 {len(csv_files)} 个参与者数据文件")

# 2. 读取并合并所有数据
all_data = []
for csv_file in csv_files:
    try:
        df = pd.read_csv(csv_file)
        all_data.append(df)
        print(f"  [OK] {csv_file}: {len(df)} rows")
    except Exception as e:
        print(f"  [ERROR] {csv_file}: {e}")

if not all_data:
    print("错误：没有找到有效的数据文件！")
    exit(1)

# 合并所有数据
combined_df = pd.concat(all_data, ignore_index=True)
print(f"\n合并后总行数: {len(combined_df)}")
print(f"参与者数: {combined_df['participantId'].nunique()}")
print(f"色彩映射数: {combined_df['colormapId'].nunique()}")

# 3. 读取 colormaps.json
print("\n读取 colormaps.json...")
with open('colormaps.json', 'r') as f:
    colormaps = json.load(f)

colormap_dict = {cm['id']: cm for cm in colormaps}
print(f"加载了 {len(colormap_dict)} 个色彩映射")

# 4. 计算 metrics
print("\n计算 metrics...")

def lab_length(colormap_lab):
    """LAB 路径长度"""
    if len(colormap_lab) < 2:
        return 0
    total_length = 0
    for i in range(1, len(colormap_lab)):
        lab1 = colormap_lab[i-1]
        lab2 = colormap_lab[i]
        distance = np.sqrt((lab2[0] - lab1[0])**2 + 
                          (lab2[1] - lab1[1])**2 + 
                          (lab2[2] - lab1[2])**2)
        total_length += distance
    return total_length

def luminance_variation(colormap_lab):
    """亮度变化"""
    if len(colormap_lab) == 0:
        return 0
    luminance_values = [lab[0] for lab in colormap_lab]
    total_variation = 0
    for i in range(1, len(luminance_values)):
        total_variation += abs(luminance_values[i] - luminance_values[i-1])
    return total_variation

def chromatic_variation(colormap_lab):
    """色度变化"""
    if len(colormap_lab) == 0:
        return 0
    chroma_values = []
    for lab in colormap_lab:
        L, a, b = lab
        chroma = np.sqrt(a**2 + b**2)
        chroma_values.append(chroma)
    
    total_variation = 0
    for i in range(1, len(chroma_values)):
        total_variation += abs(chroma_values[i] - chroma_values[i-1])
    return total_variation

# 为每个唯一的 colormapId 计算 metrics
unique_colormap_ids = combined_df['colormapId'].unique()
metrics_cache = {}

for cm_id in unique_colormap_ids:
    if cm_id not in colormap_dict:
        continue
    
    colormap_lab = np.array(colormap_dict[cm_id]['colormap'])
    
    lab_len = lab_length(colormap_lab)
    lum_var = luminance_variation(colormap_lab)
    chrom_var = chromatic_variation(colormap_lab)
    
    metrics_cache[cm_id] = {
        'LAB_Length': lab_len,
        'luminance_variation': lum_var,
        'chromatic_variation': chrom_var,
        'ciede2000_discriminative': lab_len / len(colormap_lab) if len(colormap_lab) > 0 else 0,
        'hue_discriminative': chrom_var / 10,
        'contrast_sensitivity': lab_len / 100,
        'categorization': max(1, int(lab_len / 50))
    }

print(f"计算了 {len(metrics_cache)} 个色彩映射的 metrics")

# 5. 添加 metrics 列到数据框
print("\n添加 metrics 列...")
for metric_name in ['ciede2000_discriminative', 'contrast_sensitivity', 
                    'hue_discriminative', 'luminance_variation', 
                    'chromatic_variation', 'categorization', 'LAB_Length']:
    combined_df[metric_name] = combined_df['colormapId'].map(
        lambda x: metrics_cache.get(x, {}).get(metric_name, np.nan)
    )

# 6. 添加对数变换
print("\n添加对数变换...")
combined_df['log_categorization'] = np.log(combined_df['categorization'] + 1)
combined_df['logLAB_Length'] = np.log(combined_df['LAB_Length'] + 1)
combined_df['log_hue_discriminative'] = np.log(combined_df['hue_discriminative'] + 0.1)
combined_df['log_luminance_variation'] = np.log(combined_df['luminance_variation'] + 1)
combined_df['log_chromatic_variation'] = np.log(combined_df['chromatic_variation'] + 1)

# 7. 保存合并后的数据
print("\n保存合并后的数据...")
os.makedirs('output_data', exist_ok=True)
output_file = 'output_data/result_all_participants.csv'
combined_df.to_csv(output_file, index=False)
print(f"保存至: {output_file}")

# 8. 输出统计信息
print("\n=== 合并完成 ===")
print(f"总行数: {len(combined_df)}")
print(f"参与者数: {combined_df['participantId'].nunique()}")
print(f"色彩映射数: {combined_df['colormapId'].nunique()}")
print(f"频段类型: {sorted(combined_df['frequencyId'].unique())}")
print(f"Chroma 模式: {sorted(combined_df['colormapChromaPattern'].unique())}")
print(f"Lumi 模式: {sorted(combined_df['colormapLumaPattern'].unique())}")

# 处理列名差异：isCorrect vs correct
correct_col = 'correct' if 'correct' in combined_df.columns else 'isCorrect'
print(f"\n平均准确率: {combined_df[correct_col].mean():.3f}")

# 按 participantId 统计
print("\n每个参与者的试次数:")
participant_counts = combined_df['participantId'].value_counts()
print(f"  最少: {participant_counts.min()}")
print(f"  最多: {participant_counts.max()}")
print(f"  平均: {participant_counts.mean():.1f}")
