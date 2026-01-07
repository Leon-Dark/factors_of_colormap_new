/**
 * 高斯分布生成器
 * Gaussian Distribution Generator
 * 
 * 负责生成不同尺寸级别的高斯分布
 */

class GaussianGenerator {
    /**
     * 构造函数
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.gaussians = [];

        // 尺寸级别配置 - 三层固定sigma，适配200×200画布
        this.sizeLevels = {
            'small': { sigma: 15, count: 4, color: '#377eb8' },      // 高频 σ=4px (Blue)
            'medium': { sigma: 25, count: 4, color: '#4daf4a' },    // 中频 σ=16px
            'large': { sigma: 50, count: 4, color: '#ff7f00' }      // 低频 σ=40px
        };

        this.exponent = 1.0;
    }

    /**
     * Set exponent
     */
    setExponent(exp) {
        this.exponent = exp;
    }

    /**
     * 更新画布尺寸
     */
    updateDimensions(width, height) {
        this.width = width;
        this.height = height;
    }


    /**
     * 更新尺寸级别配置
     */
    updateSizeLevel(level, sigma, count) {
        if (this.sizeLevels[level]) {
            this.sizeLevels[level].sigma = sigma;
            this.sizeLevels[level].count = count;
        }
    }

    /**
     * 生成所有级别的高斯分布（随机模式）
     */
    generateAll() {
        this.gaussians = [];

        // 在整个空间随机生成
        for (const [level, config] of Object.entries(this.sizeLevels)) {
            this.generateLevel(level, config.sigma, config.count, config.color);
        }
        console.log(`Generated ${this.gaussians.length} Gaussians randomly distributed`);

        return this.gaussians;
    }

    /**
     * 生成指定级别的高斯分布（使用力导向松弛算法）
     */
    generateLevel(level, sigma, count, color) {
        // 1. 准备参数
        const padding = sigma * 1.5;
        const width = this.width;
        const height = this.height;

        // 收集现有的固定点（作为障碍物）
        const staticPoints = this.gaussians.map(g => ({
            x: g.mX,
            y: g.mY,
            radius: (Math.max(g.sX, g.sY) || sigma) * 1.0 // 现有点的排斥半径
        }));

        // 2. 初始随机生成点
        const points = [];
        for (let i = 0; i < count; i++) {
            points.push({
                x: randomRange(padding, width - padding),
                y: randomRange(padding, height - padding),
                radius: sigma * 1.0, // 新点的排斥半径
                vx: 0,
                vy: 0
            });
        }

        // 3. 执行力导向松弛 (Force-Directed Relaxation)
        const iterations = 50; // 迭代次数
        const repulsionStrength = 0.5; // 排斥力度

        for (let iter = 0; iter < iterations; iter++) {
            // 计算位移
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                let fx = 0;
                let fy = 0;

                // 与其他新点的排斥
                for (let j = 0; j < points.length; j++) {
                    if (i === j) continue;
                    const p2 = points[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx * dx + dy * dy;
                    const dist = Math.sqrt(distSq) || 0.1;

                    const desiredDist = (p1.radius + p2.radius) * 1.2; // 期望距离

                    if (dist < desiredDist) {
                        const force = (desiredDist - dist) / desiredDist; // 线性排斥力
                        fx += (dx / dist) * force * repulsionStrength;
                        fy += (dy / dist) * force * repulsionStrength;
                    }
                }

                // 与固定点（障碍物）的排斥
                for (const staticP of staticPoints) {
                    const dx = p1.x - staticP.x;
                    const dy = p1.y - staticP.y;
                    const distSq = dx * dx + dy * dy;
                    const dist = Math.sqrt(distSq) || 0.1;

                    const desiredDist = (p1.radius + staticP.radius) * 1.0;

                    if (dist < desiredDist) {
                        const force = (desiredDist - dist) / desiredDist;
                        fx += (dx / dist) * force * repulsionStrength * 1.5; // 对固定点避让更强
                        fy += (dy / dist) * force * repulsionStrength * 1.5;
                    }
                }

                // 应用力（暂时只累积速度或直接位移，简单的直接位移更稳定）
                p1.vx = fx * 50; // 缩放系数
                p1.vy = fy * 50;
            }

            // 更新位置并应用边界约束
            for (const p of points) {
                p.x += p.vx;
                p.y += p.vy;

                // 边界约束（带缓冲）
                p.x = Math.max(padding, Math.min(width - padding, p.x));
                p.y = Math.max(padding, Math.min(height - padding, p.y));

                // 阻尼
                p.vx *= 0.1;
                p.vy *= 0.1;
            }
        }

        // 4. 将优化后的点转换为高斯对象
        const levelGaussians = [];
        for (const p of points) {
            // 生成标准差（添加一些随机变化）
            const sXVariation = 0.8 + Math.random() * 0.4;
            const sYVariation = 0.8 + Math.random() * 0.4;
            const sX = sigma * sXVariation;
            const sY = sigma * sYVariation;

            // 生成相关系数
            const rho = (Math.random() * 2 - 1) * 0.6;

            // 使用体积归一化生成幅值 (Scaler)
            // 体积近似正比于 scaler * sigma^2
            // 我们希望体积大致恒定（例如 500），这样高频会很亮，低频会很暗
            const targetVolume = 500;
            // 给体积添加一些随机性 (±20%)
            const volumeVariation = 0.8 + Math.random() * 0.4;
            const actualTargetVolume = targetVolume * volumeVariation;

            // 计算所需的 scaler: Scaler = Volume / (sX * sY)
            // 安全措施：限制 scaler 范围，防止极小 sigma 导致数值爆炸或极大 sigma 导致不可见
            let scaler = actualTargetVolume / (sX * sY);

            // 可选：限制最大幅值，防止极小 sigma 产生过亮的光斑
            scaler = Math.min(scaler, 3.0);

            // 可选：限制最小幅值，确保至少有一定的可见度
            scaler = Math.max(scaler, 0.1);

            // 创建高斯
            const gauss = new biGauss(p.x, p.y, sX, sY, rho, scaler);
            gauss.color = color;
            gauss.sizeLevel = level;

            // 添加扩展属性
            gauss.originalMX = p.x;
            gauss.originalMY = p.y;
            gauss.originalSX = sX;
            gauss.originalSY = sY;
            gauss.originalRho = rho;
            gauss.originalScaler = scaler;
            gauss.isPerturbed = false;
            gauss.id = Math.random().toString(36).substr(2, 9);

            levelGaussians.push(gauss);
            this.gaussians.push(gauss);
        }

        console.log(`Generated ${levelGaussians.length} Gaussians for level ${level} using Relaxed Force-Directed`);

        return levelGaussians;
    }

    /**
     * 获取指定级别的所有高斯
     * 根据当前高斯的实际 sigma 值动态分类，而非生成时的标签
     * 使用最近邻分类：高斯归属于它最接近的频段标准值
     */
    getGaussiansByLevel(level) {
        // 获取当前的 sigma 标准值
        const smallSigma = this.sizeLevels['small'].sigma;
        const mediumSigma = this.sizeLevels['medium'].sigma;
        const largeSigma = this.sizeLevels['large'].sigma;

        return this.gaussians.filter(g => {
            // 使用高斯当前的最大 sigma 作为特征尺度
            const currentSigma = Math.max(g.sX, g.sY);

            // 计算到三个标准值的距离
            const distToSmall = Math.abs(currentSigma - smallSigma);
            const distToMedium = Math.abs(currentSigma - mediumSigma);
            const distToLarge = Math.abs(currentSigma - largeSigma);

            // 找到最小距离
            const minDist = Math.min(distToSmall, distToMedium, distToLarge);

            // 归类到最近的频段
            if (level === 'small') {
                return distToSmall === minDist;
            } else if (level === 'medium') {
                return distToMedium === minDist;
            } else if (level === 'large') {
                return distToLarge === minDist;
            }
            return false;
        });
    }

    /**
     * 获取所有高斯
     */
    getAllGaussians() {
        return this.gaussians;
    }

    /**
     * 清除所有高斯
     */
    clear() {
        this.gaussians = [];
    }

    /**
     * 计算单个高斯的梯度能量（RMS梯度）
     * @param {biGauss} gauss - 高斯对象
     * @param {number} width - 场宽度
     * @param {number} height - 场高度
     * @returns {number} 梯度能量 g_B
     */
    /*
    calculateGradientEnergy(gauss, width, height) {
        const bbox = gauss.getBoundingBox(3);
        const startX = Math.max(0, Math.floor(bbox.minX));
        const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
        const startY = Math.max(0, Math.floor(bbox.minY));
        const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

        let sumGradientSquared = 0;
        let count = 0;

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                // 计算 x 方向梯度
                const gradX = (x < width - 1)
                    ? gauss.eval(x + 1, y) - gauss.eval(x, y)
                    : 0;

                // 计算 y 方向梯度
                const gradY = (y < height - 1)
                    ? gauss.eval(x, y + 1) - gauss.eval(x, y)
                    : 0;

                // 累积梯度平方
                sumGradientSquared += gradX * gradX + gradY * gradY;
                count++;
            }
        }

        // 计算 RMS 梯度
        const rmsGradient = count > 0
            ? Math.sqrt(sumGradientSquared / count)
            : 0;

        return rmsGradient;
    }
    */

    /**
     * 渲染到2D场
     * @param {number[][]} field - 2D数组用于存储渲染结果
     * @param {boolean} useGradientNormalization - 是否使用梯度能量归一化
     */
    renderToField(field, useGradientNormalization = true) {
        const width = field[0].length;
        const height = field.length;
        const epsilon = 1e-10; // 防止除零

        // 初始化场为0
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                field[y][x] = 0;
            }
        }

        // 如果使用梯度能量归一化
        /*
        if (useGradientNormalization) {
            // 对每个高斯单独进行梯度能量归一化后再叠加
            for (const gauss of this.gaussians) {
                // 计算该高斯的梯度能量
                const gradientEnergy = this.calculateGradientEnergy(gauss, width, height);
                const normalizationFactor = gradientEnergy + epsilon;

                const bbox = gauss.getBoundingBox(3);
                const startX = Math.max(0, Math.floor(bbox.minX));
                const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
                const startY = Math.max(0, Math.floor(bbox.minY));
                const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

                // 叠加归一化后的高斯
                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        field[y][x] += gauss.eval(x, y) / Math.pow(normalizationFactor, 0.3);
                    }
                }
            }
        } else {
        */
        // 原始方法：直接叠加所有高斯
        for (const gauss of this.gaussians) {
            const bbox = gauss.getBoundingBox(3);

            const startX = Math.max(0, Math.floor(bbox.minX));
            const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
            const startY = Math.max(0, Math.floor(bbox.minY));
            const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    field[y][x] += gauss.eval(x, y);
                }
            }
        }
        // }

        return field;
    }

    /**
     * 渲染到1D数组（用于canvas ImageData）
     * @param {number} width - 图像宽度
     * @param {number} height - 图像高度
     * @param {boolean} useOriginal - 是否使用原始参数
     * @param {boolean} useGradientNormalization - 是否使用梯度能量归一化
     * @returns {Float32Array} 1D数组
     */
    renderTo1DArray(width, height, useOriginal = false, useGradientNormalization = true) {
        const data = new Float32Array(width * height);
        const epsilon = 1e-10; // 防止除零

        /*
        if (useGradientNormalization) {
            // 使用梯度能量归一化
            for (const gauss of this.gaussians) {
                let gradientEnergy, normalizationFactor;
                let targetGauss = gauss;

                if (useOriginal) {
                    // 临时创建原始状态的高斯用于计算
                    targetGauss = new biGauss(
                        gauss.originalMX, gauss.originalMY,
                        gauss.originalSX, gauss.originalSY,
                        gauss.originalRho, gauss.originalScaler
                    );
                    gradientEnergy = this.calculateGradientEnergy(targetGauss, width, height);
                    normalizationFactor = gradientEnergy + epsilon;

                    const maxSigma = Math.max(gauss.originalSX, gauss.originalSY);
                    const range = maxSigma * 3;

                    const startX = Math.max(0, Math.floor(gauss.originalMX - range));
                    const endX = Math.min(width - 1, Math.ceil(gauss.originalMX + range));
                    const startY = Math.max(0, Math.floor(gauss.originalMY - range));
                    const endY = Math.min(height - 1, Math.ceil(gauss.originalMY + range));

                    for (let y = startY; y <= endY; y++) {
                        for (let x = startX; x <= endX; x++) {
                            const index = y * width + x;
                            data[index] += targetGauss.eval(x, y) / normalizationFactor;
                        }
                    }
                } else {
                    // 使用当前参数渲染
                    gradientEnergy = this.calculateGradientEnergy(gauss, width, height);
                    normalizationFactor = gradientEnergy + epsilon;

                    const maxSigma = Math.max(gauss.sX, gauss.sY);
                    const range = maxSigma * 3;

                    const startX = Math.max(0, Math.floor(gauss.mX - range));
                    const endX = Math.min(width - 1, Math.ceil(gauss.mX + range));
                    const startY = Math.max(0, Math.floor(gauss.mY - range));
                    const endY = Math.min(height - 1, Math.ceil(gauss.mY + range));

                    for (let y = startY; y <= endY; y++) {
                        for (let x = startX; x <= endX; x++) {
                            const index = y * width + x;
                            data[index] += gauss.eval(x, y) / normalizationFactor;
                        }
                    }
                }
            }
        } else {
        */
        // 原始方法：直接叠加所有高斯
        for (const gauss of this.gaussians) {
            if (useOriginal) {
                // 使用原始参数渲染
                const maxSigma = Math.max(gauss.originalSX, gauss.originalSY);
                const range = maxSigma * 3;

                const startX = Math.max(0, Math.floor(gauss.originalMX - range));
                const endX = Math.min(width - 1, Math.ceil(gauss.originalMX + range));
                const startY = Math.max(0, Math.floor(gauss.originalMY - range));
                const endY = Math.min(height - 1, Math.ceil(gauss.originalMY + range));

                // 临时创建原始状态的高斯用于计算
                const tempGauss = new biGauss(
                    gauss.originalMX, gauss.originalMY,
                    gauss.originalSX, gauss.originalSY,
                    gauss.originalRho, gauss.originalScaler
                );

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        const index = y * width + x;
                        let val = tempGauss.eval(x, y);
                        // Apply exponent if not 1.0
                        if (this.exponent !== 1.0) {
                            val = Math.pow(val, this.exponent);
                        }
                        data[index] += val;
                    }
                }
            } else {
                // 使用当前参数渲染
                const maxSigma = Math.max(gauss.sX, gauss.sY);
                const range = maxSigma * 3;

                const startX = Math.max(0, Math.floor(gauss.mX - range));
                const endX = Math.min(width - 1, Math.ceil(gauss.mX + range));
                const startY = Math.max(0, Math.floor(gauss.mY - range));
                const endY = Math.min(height - 1, Math.ceil(gauss.mY + range));

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        const index = y * width + x;
                        let val = gauss.eval(x, y);
                        // Apply exponent if not 1.0 (optimize for common case)
                        if (this.exponent !== 1.0) {
                            val = Math.pow(val, this.exponent);
                        }
                        data[index] += val;
                    }
                }
            }
        }
        // }

        // Apply logarithmic compression
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.log(1 + data[i]);
        }

        return data;
    }

    /**
     * 计算统计信息
     */
    getStatistics() {
        const stats = {
            total: this.gaussians.length,
            byLevel: {},
            perturbed: this.gaussians.filter(g => g.isPerturbed).length
        };

        for (const level of Object.keys(this.sizeLevels)) {
            const levelGaussians = this.getGaussiansByLevel(level);
            stats.byLevel[level] = {
                count: levelGaussians.length,
                perturbed: levelGaussians.filter(g => g.isPerturbed).length
            };
        }

        return stats;
    }

    /**
     * 导出配置
     */
    exportConfig() {
        return {
            width: this.width,
            height: this.height,
            sizeLevels: this.sizeLevels,
            gaussians: this.gaussians.map(g => ({
                id: g.id,
                mX: g.mX,
                mY: g.mY,
                sX: g.sX,
                sY: g.sY,
                rho: g.rho,
                scaler: g.scaler,
                sizeLevel: g.sizeLevel,
                isPerturbed: g.isPerturbed,
                color: g.color,
                original: {
                    mX: g.originalMX,
                    mY: g.originalMY,
                    sX: g.originalSX,
                    sY: g.originalSY,
                    rho: g.originalRho,
                    scaler: g.originalScaler
                }
            }))
        };
    }

    /**
     * 从配置导入
     */
    importConfig(config) {
        this.width = config.width;
        this.height = config.height;
        this.sizeLevels = config.sizeLevels;
        this.gaussians = config.gaussians.map(gData => {
            const g = new biGauss(gData.mX, gData.mY, gData.sX, gData.sY, gData.rho, gData.scaler);
            g.id = gData.id;
            g.sizeLevel = gData.sizeLevel;
            g.isPerturbed = gData.isPerturbed;
            g.color = gData.color;
            g.originalMX = gData.original.mX;
            g.originalMY = gData.original.mY;
            g.originalSX = gData.original.sX;
            g.originalSY = gData.original.sY;
            g.originalRho = gData.original.rho;
            g.originalScaler = gData.original.scaler;
            return g;
        });
    }

    /**
     * 查找给定位置最近的高斯
     */
    findNearestGaussian(x, y, maxDistance = 50) {
        let nearest = null;
        let minDist = maxDistance;

        for (const gauss of this.gaussians) {
            const dist = distance(x, y, gauss.mX, gauss.mY);
            if (dist < minDist) {
                minDist = dist;
                nearest = gauss;
            }
        }

        return nearest;
    }

    /**
     * 获取给定位置的所有高斯（按贡献度排序）
     */
    getGaussiansAtPosition(x, y, threshold = 0.01) {
        const gaussiansAtPos = [];

        for (const gauss of this.gaussians) {
            const value = gauss.eval(x, y);
            if (value > threshold) {
                gaussiansAtPos.push({ gauss, value });
            }
        }

        // 按贡献度降序排序
        gaussiansAtPos.sort((a, b) => b.value - a.value);

        return gaussiansAtPos;
    }

    /**
     * 重置所有高斯的扰动
     */
    resetAllPerturbations() {
        for (const gauss of this.gaussians) {
            if (gauss.originalMX !== undefined) {
                gauss.mX = gauss.originalMX;
                gauss.mY = gauss.originalMY;
                gauss.sX = gauss.originalSX;
                gauss.sY = gauss.originalSY;
                gauss.scaler = gauss.originalScaler;
                gauss.updateRho(gauss.originalRho);
                gauss.isPerturbed = false;
            }
        }
    }
}
