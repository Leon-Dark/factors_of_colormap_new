import pandas as pd

df = pd.read_csv('output_data/result_for_R.csv')

# Check control trials
control_trials = [9000, 9001, 9002, 9003]
control = df[df['trialId'].isin(control_trials)]
regular = df[~df['trialId'].isin(control_trials)]

print("=== 控制试验分析 ===")
print(f"控制试验总数: {len(control)}")
print(f"控制试验中的colormap分布:")
print(control['colormapId'].value_counts().sort_index())

print("\n=== 正式试验分析 ===")
print(f"正式试验总数: {len(regular)}")
counts = regular['colormapId'].value_counts().sort_index()
print(f"\n正式试验中每个colormap的次数:")
print(counts.to_string())

print(f"\n统计:")
print(f"最小: {counts.min()}")
print(f"最大: {counts.max()}")
print(f"平均: {counts.mean():.1f}")
print(f"标准差: {counts.std():.1f}")

if counts.std() > 1:
    print("\n⚠️ 分布不均匀！")
    print("异常的colormap:")
    mean = counts.mean()
    std = counts.std()
    for cmap_id, count in counts.items():
        if abs(count - mean) > 2 * std:
            print(f"  Colormap {cmap_id}: {count}次 (偏离均值 {count - mean:.1f})")
