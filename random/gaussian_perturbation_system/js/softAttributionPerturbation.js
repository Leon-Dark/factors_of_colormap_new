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

        // 默认参数 (Adaptive Ratios)
        this.params = {
            // Ratios relative to the band's characteristic sigma
            sigma_E_ratio: 0.4,      // Energy smooth ratio (e.g. 0.5 * sigma)
            sigma_m_ratio: 0.6,      // Mask feathering ratio 
            sigma_Delta_ratio: 0.4,  // Delta low-pass ratio (Critical for cleaning dipoles)

            tau_low: 0.3,        // smoothstep下边界
            tau_high: 0.7,       // smoothstep上边界

            perturbationMode: 'cascading',  // 'strict': 严格分离, 'cascading': 优先级覆盖

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


        const energyFields = {
            low: new Float32Array(width * height),
            mid: new Float32Array(width * height),
            high: new Float32Array(width * height)
        };

        // 对每个频段分别计算
        for (const [sizeLevel, freqBand] of Object.entries(this.frequencyMap)) {
            // FIXED: Use static sizeLevel property instead of dynamic classification
            // This prevents Gaussians from switching bands when compressed/stretched
            const gaussians = this.generator.getAllGaussians().filter(g => g.sizeLevel === sizeLevel);

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

            // FIX: Add small intensity component to prevent zero energy at Gaussian peaks (where gradient is 0)
            const intensityWeight = 0.1;
            for (let k = 0; k < gradientSq.length; k++) {
                gradientSq[k] += intensityWeight * (bandField[k] * bandField[k]);
            }

            // 获取该频段的特征尺度 sigma
            const bandSigma = this.generator.sizeLevels[sizeLevel].sigma;

            // 计算自适应 sigma_E
            const adaptiveSigmaE = bandSigma * this.params.sigma_E_ratio;

            // 高斯模糊得到能量场
            energyFields[freqBand] = gaussianBlur2D(gradientSq, width, height, adaptiveSigmaE);
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

            // 计算自适应 sigma_m
            // Map freqBand (low/mid/high) back to sizeLevel (large/medium/small)
            const freqToSize = { 'low': 'large', 'mid': 'medium', 'high': 'small' };
            const sizeLevel = freqToSize[band];
            const bandSigma = this.generator.sizeLevels[sizeLevel].sigma;

            const adaptiveSigmaM = bandSigma * this.params.sigma_m_ratio;

            // 高斯模糊羽化 (Adaptive)
            masks[band] = gaussianBlur2D(smoothed, width, height, adaptiveSigmaM);
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
        const mode = this.params.perturbationMode;

        const result = new Float32Array(originalField);

        // 根据模式计算有效mask
        const effectiveMasks = this.computeEffectiveMasks(masks, width, height, mode);

        // 对每个频段计算并注入扰动
        for (const band of ['low', 'mid', 'high']) {
            const lambda = this.params.lambda[band];

            if (lambda === 0) {
                continue;
            }

            // ★ Step A: 计算原始 Delta 场
            let deltaField = new Float32Array(width * height);
            for (let i = 0; i < width * height; i++) {
                deltaField[i] = perturbedBands[band][i] - originalBands[band][i];
            }

            // ★ Step B: Delta Blur - 关键修复！
            // 对 Delta 场进行高斯低通滤波，消除几何位移产生的偶极子锐利边缘
            // 使用自适应 Sigma (Adaptive)
            const freqToSize = { 'low': 'large', 'mid': 'medium', 'high': 'small' };
            const sizeLevel = freqToSize[band];
            const bandSigma = this.generator.sizeLevels[sizeLevel].sigma;
            const adaptiveSigmaDelta = bandSigma * this.params.sigma_Delta_ratio;

            if (adaptiveSigmaDelta > 0) {
                deltaField = gaussianBlur2D(deltaField, width, height, adaptiveSigmaDelta);
            }

            // ★ Step C: 应用门控 Mask（使用有效mask）
            let totalDelta = 0;
            let gatedDelta = 0;
            let effectivePixels = 0;

            for (let i = 0; i < width * height; i++) {
                // 使用模糊后的 delta
                const delta = deltaField[i];
                totalDelta += Math.abs(delta);

                // 门控注入：使用有效mask决定扰动在该像素的作用强度
                const gated = lambda * effectiveMasks[band][i] * delta;
                result[i] += gated;

                gatedDelta += Math.abs(gated);
                if (effectiveMasks[band][i] > 0.5) effectivePixels++;
            }

            const suppressionRatio = (totalDelta > 0) ? (gatedDelta / totalDelta) : 0;

        }


        return result;
    }

    /**
     * 计算有效mask（根据模式）
     * @param {Object} masks - 原始门控mask {low, mid, high}
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @param {string} mode - 模式 ('strict' 或 'cascading')
     * @returns {Object} 有效mask {low, mid, high}
     */
    computeEffectiveMasks(masks, width, height, mode) {
        const size = width * height;
        const effectiveMasks = {
            low: new Float32Array(size),
            mid: new Float32Array(size),
            high: new Float32Array(size)
        };

        if (mode === 'strict') {
            // 严格分离模式：每个频段只在自己的主导区域应用

            effectiveMasks.low = new Float32Array(masks.low);
            effectiveMasks.mid = new Float32Array(masks.mid);
            effectiveMasks.high = new Float32Array(masks.high);
        } else if (mode === 'cascading') {
            // 优先级覆盖模式：
            // 高频可以应用在所有区域
            // 中频可以应用在中频+低频区域
            // 低频只能应用在低频区域


            for (let i = 0; i < size; i++) {
                // 高频扰动：应用在所有区域
                effectiveMasks.high[i] = 1.0;

                // 中频扰动：应用在中频和低频区域
                // 使用 (masks.mid + masks.low) 的组合，归一化到 [0,1]
                effectiveMasks.mid[i] = Math.min(1.0, masks.mid[i] + masks.low[i]);

                // 低频扰动：只应用在低频区域
                effectiveMasks.low[i] = masks.low[i];
            }
        } else {
            console.warn(`Unknown perturbation mode: ${mode}, falling back to strict`);
            effectiveMasks.low = new Float32Array(masks.low);
            effectiveMasks.mid = new Float32Array(masks.mid);
            effectiveMasks.high = new Float32Array(masks.high);
        }

        return effectiveMasks;
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
        // FIXED: Use static sizeLevel property
        const gaussians = this.generator.getAllGaussians().filter(g => g.sizeLevel === sizeLevel);
        const field = new Float32Array(width * height);

        // Get weight and exponent to match visual rendering
        const weight = this.generator.bandWeights ? (this.generator.bandWeights[sizeLevel] || 1.0) : 1.0;
        const exponent = this.generator.exponent !== undefined ? this.generator.exponent : 1.0;

        for (const gauss of gaussians) {
            if (useOriginal) {
                // 使用原始参数渲染
                const tempGauss = new biGauss(
                    gauss.originalMX, gauss.originalMY,
                    gauss.originalSX, gauss.originalSY,
                    gauss.originalRho, gauss.originalScaler
                );

                // 使用原始位置计算 bounding box
                const maxSigma = Math.max(gauss.originalSX, gauss.originalSY);
                const range = maxSigma * 3;
                const startX = Math.max(0, Math.floor(gauss.originalMX - range));
                const endX = Math.min(width - 1, Math.ceil(gauss.originalMX + range));
                const startY = Math.max(0, Math.floor(gauss.originalMY - range));
                const endY = Math.min(height - 1, Math.ceil(gauss.originalMY + range));

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        let val = tempGauss.eval(x, y);
                        // Apply weight
                        val *= weight;
                        // Apply exponent
                        if (exponent !== 1.0) val = Math.pow(val, exponent);

                        field[y * width + x] += val;
                    }
                }
            } else {
                // 使用扰动后的当前参数渲染
                const bbox = gauss.getBoundingBox(3);
                const startX = Math.max(0, Math.floor(bbox.minX));
                const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
                const startY = Math.max(0, Math.floor(bbox.minY));
                const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        let val = gauss.eval(x, y);
                        // Apply weight
                        val *= weight;
                        // Apply exponent
                        if (exponent !== 1.0) val = Math.pow(val, exponent);

                        field[y * width + x] += val;
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
