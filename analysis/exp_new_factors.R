library(lme4)
library(lmerTest)
library(ggplot2)
library(dplyr)
library(emmeans)

# ==================== 数据加载 ====================

# 读取预处理后的数据 - 兼容 RStudio 和命令行
if (requireNamespace("rstudioapi", quietly = TRUE) && rstudioapi::isAvailable()) {
  # 在 RStudio 中运行
  script_dir <- dirname(rstudioapi::getActiveDocumentContext()$path)
  setwd(script_dir)
}

cat("当前工作目录:", getwd(), "\n")
exp1 <- read.csv("output_data/result_for_R.csv")

cat("数据维度(原始):", paste(dim(exp1), collapse=" x "), "\n")

# 过滤控制试验 (用于检查 engagement)
exp1 <- exp1[!(exp1$trialId %in% c(9000, 9001, 9002, 9003)), ]

cat("数据维度(过滤后):", paste(dim(exp1), collapse=" x "), "\n")
cat("列名:\n")
print(names(exp1))

# ==================== 因子设置 ====================

exp1$chromaPattern <- factor(exp1$colormapChromaPattern, 
                             levels = c("constant", "linear", "thermal", "diverging"))

exp1$lumiPattern <- factor(exp1$colormapLumaPattern,
                           levels = c("constant", "linear", "thermal", "diverging"))

exp1$hueTarget <- factor(exp1$colormapHue,
                         levels = c(100, 200, 300),
                         labels = c("Hue100", "Hue200", "Hue300"))

exp1$frequencyId <- factor(exp1$frequencyId, 
                           levels = c("low", "medium", "high"))

exp1$participantId <- factor(exp1$participantId)
exp1$colormapId <- factor(exp1$colormapId)

# 响应变量
exp1$correct <- as.numeric(exp1$correct)

# 标准化 metrics
exp1$ciede2000_scaled <- scale(exp1$ciede2000_discriminative)
exp1$hue_discriminative_scaled <- scale(exp1$hue_discriminative)
exp1$luminance_variation_scaled <- scale(exp1$luminance_variation)
exp1$chromatic_variation_scaled <- scale(exp1$chromatic_variation)
exp1$log_hue_discriminative_scaled <- scale(exp1$log_hue_discriminative)
exp1$log_luminance_variation_scaled <- scale(exp1$log_luminance_variation)
exp1$log_chromatic_variation_scaled <- scale(exp1$log_chromatic_variation)

# ==================== 描述性统计 ====================

cat("\n=== 描述性统计 ===\n")
cat("\nChroma Pattern 分布:\n")
print(table(exp1$chromaPattern))

cat("\nLumi Pattern 分布:\n")
print(table(exp1$lumiPattern))

cat("\nFrequency 分布:\n")
print(table(exp1$frequencyId))

cat("\n总体准确率:", mean(exp1$correct), "\n")

cat("\n按 Chroma Pattern 的准确率:\n")
print(aggregate(correct ~ chromaPattern, data = exp1, FUN = mean))

cat("\n按 Lumi Pattern 的准确率:\n")
print(aggregate(correct ~ lumiPattern, data = exp1, FUN = mean))

cat("\n按 Frequency 的准确率:\n")
print(aggregate(correct ~ frequencyId, data = exp1, FUN = mean))

# ==================== 混合效应模型 ====================

cat("\n=== 模型 1: 基础模型（主效应） ===\n")

model_basic <- glmer(correct ~ chromaPattern + lumiPattern + frequencyId + 
                     (1|participantId) + (1|colormapId),
                     data = exp1,
                     family = binomial(link = "logit"),
                     control = glmerControl(optimizer = "bobyqa"))

print(summary(model_basic))

cat("\n=== 模型 2: 交互效应模型 ===\n")

model_interaction <- glmer(correct ~ chromaPattern * lumiPattern + frequencyId + 
                          (1|participantId) + (1|colormapId),
                          data = exp1,
                          family = binomial(link = "logit"),
                          control = glmerControl(optimizer = "bobyqa"))

print(summary(model_interaction))

cat("\n模型比较（AIC）:\n")
cat("基础模型 AIC:", AIC(model_basic), "\n")
cat("交互模型 AIC:", AIC(model_interaction), "\n")

# ==================== 事后检验 ====================

cat("\n=== 事后检验 ===\n")

cat("\nChroma Pattern 成对比较:\n")
emmeans_chroma <- emmeans(model_basic, ~ chromaPattern)
print(emmeans_chroma)
print(pairs(emmeans_chroma))

cat("\nLumi Pattern 成对比较:\n")
emmeans_lumi <- emmeans(model_basic, ~ lumiPattern)
print(emmeans_lumi)
print(pairs(emmeans_lumi))

cat("\nFrequency 成对比较:\n")
emmeans_freq <- emmeans(model_basic, ~ frequencyId)
print(emmeans_freq)
print(pairs(emmeans_freq))

# ==================== Metrics 模型 ====================

cat("\n=== 模型 3: Metrics 预测准确率 ===\n")

model_metrics <- glmer(correct ~ log_hue_discriminative_scaled + 
                       log_luminance_variation_scaled + 
                       log_chromatic_variation_scaled + 
                       frequencyId +
                       (1|participantId) + (1|colormapId),
                       data = exp1,
                       family = binomial(link = "logit"),
                       control = glmerControl(optimizer = "bobyqa"))

print(summary(model_metrics))

# ==================== 可视化 ====================

cat("\n=== 生成可视化图表 ===\n")

# 1. Chroma Pattern
p1 <- ggplot(exp1, aes(x = chromaPattern, y = correct)) +
  stat_summary(fun = mean, geom = "bar", fill = "steelblue", alpha = 0.7) +
  stat_summary(fun.data = mean_cl_boot, geom = "errorbar", width = 0.2) +
  labs(title = "Accuracy by Chroma Pattern", x = "Chroma Pattern", y = "Accuracy") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

dir.create("output_images", showWarnings = FALSE)
ggsave("output_images/accuracy_by_chroma_pattern.png", p1, width = 8, height = 6, dpi = 300)

# 2. Lumi Pattern
p2 <- ggplot(exp1, aes(x = lumiPattern, y = correct)) +
  stat_summary(fun = mean, geom = "bar", fill = "coral", alpha = 0.7) +
  stat_summary(fun.data = mean_cl_boot, geom = "errorbar", width = 0.2) +
  labs(title = "Accuracy by Lumi Pattern", x = "Lumi Pattern", y = "Accuracy") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

ggsave("output_images/accuracy_by_lumi_pattern.png", p2, width = 8, height = 6, dpi = 300)

# 3. Frequency
p3 <- ggplot(exp1, aes(x = frequencyId, y = correct)) +
  stat_summary(fun = mean, geom = "bar", fill = "darkgreen", alpha = 0.7) +
  stat_summary(fun.data = mean_cl_boot, geom = "errorbar", width = 0.2) +
  labs(title = "Accuracy by Frequency", x = "Frequency", y = "Accuracy") +
  theme_minimal()

ggsave("output_images/accuracy_by_frequency.png", p3, width = 8, height = 6, dpi = 300)

# 4. 交互效应热图
interaction_data <- exp1 %>%
  group_by(chromaPattern, lumiPattern) %>%
  summarise(accuracy = mean(correct), .groups = 'drop')

p4 <- ggplot(interaction_data, aes(x = chromaPattern, y = lumiPattern, fill = accuracy)) +
  geom_tile() +
  geom_text(aes(label = sprintf("%.2f", accuracy)), color = "white", size = 5) +
  scale_fill_gradient2(low = "red", mid = "yellow", high = "green", midpoint = 0.8) +
  labs(title = "Chroma × Lumi Pattern Interaction", 
       x = "Chroma Pattern", y = "Lumi Pattern", fill = "Accuracy") +
  theme_minimal() +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

ggsave("output_images/interaction_chroma_lumi.png", p4, width = 10, height = 8, dpi = 300)

cat("\n所有分析完成！\n")
cat("生成的图表 (保存在 output_images/):\n")
cat("  - output_images/accuracy_by_chroma_pattern.png\n")
cat("  - output_images/accuracy_by_lumi_pattern.png\n")
cat("  - output_images/accuracy_by_frequency.png\n")
cat("  - output_images/interaction_chroma_lumi.png\n")
