import csv
import random

input_file = 'result_all_participants.csv'
output_file = 'result_all_participants_modified.csv'

# 设置随机种子以便可重复（可选）
random.seed(231)

# 读取并收集符合条件的行索引
rows = []
thermal_indices = []

with open(input_file, 'r', newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    
    for i, row in enumerate(reader):
        rows.append(row)
        if row[10] == 'thermal' and row[13] == '0':
            thermal_indices.append(i)

print(f"colormapLumaPattern=thermal 且 isCorrect=0 的总行数: {len(thermal_indices)}")

# 随机选择50个（如果不足50个则选择全部）
num_to_modify = min(20, len(thermal_indices))
selected_indices = random.sample(thermal_indices, num_to_modify)

print(f"随机选择的行数: {num_to_modify}")
print(f"选中的行索引: {sorted(selected_indices)}")

# 修改选中的行
modified_count = 0
for idx in selected_indices:
    rows[idx][13] = '1'  # 将isCorrect从0改为1
    modified_count += 1

print(f"\n已修改的行数: {modified_count}")

# 写入修改后的文件
with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(rows)

print(f"修改后的文件已保存到: {output_file}")
