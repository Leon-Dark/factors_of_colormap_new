/**
 * 软归因门控的分频扰动系统
 * Soft Attribution Gated Frequency-Specific Perturbation System
 * 
 * 核心思想：
 * 1. 使用梯度能量而非像素值来衡量频段主导性
 * 2. 通过软归因权重避免硬分割
 * 3. 使用平滑门控mask避免边界引入假高频
 */

class SoftAttributionPerturbation {
    /**
     * 构造函数
     * @param {GaussianGenerator} generator - 高斯生成器
     */
    constructor(generator) {
        this.generator = generator;

        // 默认参数
        this.params = {
            sigma_E: 4.0,        // 能量平滑尺度
            tau_low: 0.3,        // smoothstep下边界
            tau_high: 0.7,       // smoothstep上边界
            sigma_m: 8.0,        // 门控羽化尺度
            sigma_Delta: 4.0,    // ★ Delta低通滤波尺度 (消除偶极子硬边)
            lambda: {            // 频段扰动强度
                low: 1.0,
                mid: 1.0,
                high: 1.0
            }
        };

        // 频段映射：sizeLevel -> frequency band
        this.frequencyMap = {
            'large': 'low',      // 大sigma = 低频
            'medium': 'mid',     // 中sigma = 中频
            'small': 'high'      // 小sigma = 高频
        };

        // 缓存
        this.cache = {
            energyFields: null,
            attributionWeights: null,
            gatingMasks: null
        };
    }

    /**
     * 设置参数
     * @param {Object} params - 参数对象
     */
    setParams(params) {
        this.params = { ...this.params, ...params };
        this.clearCache();
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache = {
            energyFields: null,
            attributionWeights: null,
            gatingMasks: null
        };
    }

    /**
     * 步骤1：计算频段梯度能量场
     * E_k(x) = GaussianBlur(||∇B_k(x)||^2, σ_E)
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @returns {Object} 三个频段的能量场 {low, mid, high}
     */
    computeGradientEnergyFields(width, height) {
        console.log('Computing gradient energy fields...');

        const energyFields = {
            low: new Float32Array(width * height),
            mid: new Float32Array(width * height),
            high: new Float32Array(width * height)
        };

        // 对每个频段分别计算
        for (const [sizeLevel, freqBand] of Object.entries(this.frequencyMap)) {
            const gaussians = this.generator.getGaussiansByLevel(sizeLevel);

            if (gaussians.length === 0) {
                console.warn(`No gaussians found for level: ${sizeLevel}`);
                continue;
            }

            // 渲染该频段的场 - 使用原始参数（保证mask锚定在原始位置）
            const bandField = new Float32Array(width * height);
            for (const gauss of gaussians) {
                // 使用原始参数创建临时高斯，确保能量场基于原始位置
                const tempGauss = new biGauss(
                    gauss.originalMX, gauss.originalMY,
                    gauss.originalSX, gauss.originalSY,
                    gauss.originalRho, gauss.originalScaler
                );

                const bbox = tempGauss.getBoundingBox(3);
                const startX = Math.max(0, Math.floor(bbox.minX));
                const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
                const startY = Math.max(0, Math.floor(bbox.minY));
                const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        bandField[y * width + x] += tempGauss.eval(x, y);
                    }
                }
            }

            // 计算梯度幅值平方
            const gradientSq = computeGradientMagnitudeSquared(bandField, width, height);

            // 高斯模糊得到能量场
            energyFields[freqBand] = gaussianBlur2D(gradientSq, width, height, this.params.sigma_E);
        }

        this.cache.energyFields = energyFields;
        return energyFields;
    }

    /**
     * 步骤2：计算频段主导性权重（软归因）
     * α_k(x) = E_k(x) / (E_L(x) + E_M(x) + E_H(x) + ε)
     * @param {Object} energyFields - 能量场 {low, mid, high}
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @returns {Object} 归一化权重 {low, mid, high}
     */
    computeAttributionWeights(energyFields, width, height) {
        console.log('Computing attribution weights...');

        const weights = {
            low: new Float32Array(width * height),
            mid: new Float32Array(width * height),
            high: new Float32Array(width * height)
        };

        const epsilon = 1e-10;

        for (let i = 0; i < width * height; i++) {
            const totalEnergy = energyFields.low[i] +
                energyFields.mid[i] +
                energyFields.high[i] +
                epsilon;

            weights.low[i] = energyFields.low[i] / totalEnergy;
            weights.mid[i] = energyFields.mid[i] / totalEnergy;
            weights.high[i] = energyFields.high[i] / totalEnergy;
        }

        this.cache.attributionWeights = weights;
        return weights;
    }

    /**
     * 步骤3：生成平滑门控mask
     * m_k(x) = GaussianBlur(smoothstep(α_k(x); τ), σ_m)
     * @param {Object} attributionWeights - 归因权重 {low, mid, high}
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @returns {Object} 门控mask {low, mid, high}
     */
    generateGatingMasks(attributionWeights, width, height) {
        console.log('Generating gating masks...');

        const masks = {
            low: new Float32Array(width * height),
            mid: new Float32Array(width * height),
            high: new Float32Array(width * height)
        };

        // 对每个频段应用smoothstep + 高斯模糊
        for (const band of ['low', 'mid', 'high']) {
            const smoothed = new Float32Array(width * height);

            // 应用smoothstep
            for (let i = 0; i < width * height; i++) {
                smoothed[i] = smoothstep(
                    attributionWeights[band][i],
                    this.params.tau_low,
                    this.params.tau_high
                );
            }

            // 高斯模糊羽化
            masks[band] = gaussianBlur2D(smoothed, width, height, this.params.sigma_m);
        }

        this.cache.gatingMasks = masks;
        return masks;
    }

    /**
     * 步骤4：应用门控扰动
     * I'(x) = I(x) + Σ_k [λ_k · m_k(x) · Δ_k(x)]
     * 其中 Δ_k(x) = T_k(B_k)(x) - B_k(x)
     * @param {Float32Array} originalField - 原始总场
     * @param {Object} originalBands - 原始频段场 {low, mid, high}
     * @param {Object} perturbedBands - 扰动后频段场 {low, mid, high}
     * @param {Object} masks - 门控mask {low, mid, high}
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @returns {Float32Array} 扰动后的总场
     */
    applyGatedPerturbation(originalField, originalBands, perturbedBands, masks, width, height) {
        console.log('Applying gated perturbation...');
        console.log('=== 关键：这里才是真正的软归因门控！===');
        console.log(`  Delta Blur: sigma_Delta = ${this.params.sigma_Delta}`);

        const result = new Float32Array(originalField);

        // 对每个频段计算并注入扰动
        for (const band of ['low', 'mid', 'high']) {
            const lambda = this.params.lambda[band];

            if (lambda === 0) {
                console.log(`  ${band} band: DISABLED (λ=${lambda})`);
                continue;
            }

            // ★ Step A: 计算原始 Delta 场
            let deltaField = new Float32Array(width * height);
            for (let i = 0; i < width * height; i++) {
                deltaField[i] = perturbedBands[band][i] - originalBands[band][i];
            }

            // ★ Step B: Delta Blur - 关键修复！
            // 对 Delta 场进行高斯低通滤波，消除几何位移产生的偶极子锐利边缘
            if (this.params.sigma_Delta > 0) {
                deltaField = gaussianBlur2D(deltaField, width, height, this.params.sigma_Delta);
            }

            // ★ Step C: 应用门控 Mask
            let totalDelta = 0;
            let gatedDelta = 0;
            let effectivePixels = 0;

            for (let i = 0; i < width * height; i++) {
                // 使用模糊后的 delta
                const delta = deltaField[i];
                totalDelta += Math.abs(delta);

                // 门控注入：mask决定了扰动在该像素的作用强度
                const gated = lambda * masks[band][i] * delta;
                result[i] += gated;

                gatedDelta += Math.abs(gated);
                if (masks[band][i] > 0.5) effectivePixels++;
            }

            const suppressionRatio = (totalDelta > 0) ? (gatedDelta / totalDelta) : 0;
            console.log(`  ${band} band: λ=${lambda}, 扰动抑制率=${(1 - suppressionRatio) * 100}%, 有效像素=${effectivePixels}`);
        }

        console.log('=== 软归因门控完成：扰动只在主导区域生效 ===');
        return result;
    }

    /**
     * 渲染频段场（辅助方法）
     * @param {string} sizeLevel - 尺寸级别 (small/medium/large)
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @param {boolean} useOriginal - 是否使用原始参数
     * @returns {Float32Array} 频段场
     */
    renderBandField(sizeLevel, width, height, useOriginal = false) {
        const gaussians = this.generator.getGaussiansByLevel(sizeLevel);
        const field = new Float32Array(width * height);

        for (const gauss of gaussians) {
            const bbox = gauss.getBoundingBox(3);
            const startX = Math.max(0, Math.floor(bbox.minX));
            const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
            const startY = Math.max(0, Math.floor(bbox.minY));
            const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

            if (useOriginal) {
                // 使用原始参数
                const tempGauss = new biGauss(
                    gauss.originalMX, gauss.originalMY,
                    gauss.originalSX, gauss.originalSY,
                    gauss.originalRho, gauss.originalScaler
                );

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        field[y * width + x] += tempGauss.eval(x, y);
                    }
                }
            } else {
                // 使用当前参数
                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        field[y * width + x] += gauss.eval(x, y);
                    }
                }
            }
        }

        return field;
    }

    /**
     * 完整的软归因门控扰动流程
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @returns {Object} 包含所有中间结果和最终结果
     */
    performGatedPerturbation(width, height) {
        console.log('=== Starting Soft Attribution Gated Perturbation ===');

        // 渲染原始总场
        const originalTotal = this.generator.renderTo1DArray(width, height, true, false);

        // 渲染原始频段场
        const originalBands = {
            low: this.renderBandField('large', width, height, true),
            mid: this.renderBandField('medium', width, height, true),
            high: this.renderBandField('small', width, height, true)
        };

        // 渲染扰动后频段场
        const perturbedBands = {
            low: this.renderBandField('large', width, height, false),
            mid: this.renderBandField('medium', width, height, false),
            high: this.renderBandField('small', width, height, false)
        };

        // 步骤1：计算梯度能量场
        const energyFields = this.computeGradientEnergyFields(width, height);

        // 步骤2：计算归因权重
        const attributionWeights = this.computeAttributionWeights(energyFields, width, height);

        // 步骤3：生成门控mask
        const gatingMasks = this.generateGatingMasks(attributionWeights, width, height);

        // 步骤4：应用门控扰动
        const perturbedTotal = this.applyGatedPerturbation(
            originalTotal,
            originalBands,
            perturbedBands,
            gatingMasks,
            width,
            height
        );

        console.log('=== Gated Perturbation Complete ===');

        return {
            originalTotal,
            perturbedTotal,
            originalBands,
            perturbedBands,
            energyFields,
            attributionWeights,
            gatingMasks
        };
    }

    /**
     * 获取可视化数据（用于调试和展示）
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @returns {Object} 可视化数据
     */
    getVisualizationData(width, height) {
        if (!this.cache.energyFields) {
            this.computeGradientEnergyFields(width, height);
        }
        if (!this.cache.attributionWeights) {
            this.computeAttributionWeights(this.cache.energyFields, width, height);
        }
        if (!this.cache.gatingMasks) {
            this.generateGatingMasks(this.cache.attributionWeights, width, height);
        }

        return {
            energyFields: this.cache.energyFields,
            attributionWeights: this.cache.attributionWeights,
            gatingMasks: this.cache.gatingMasks
        };
    }
}
