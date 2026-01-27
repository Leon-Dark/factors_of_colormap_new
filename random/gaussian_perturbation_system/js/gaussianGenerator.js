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
            'small': { sigma: 15, count: 2, color: '#377eb8' },      // 高频 σ=4px (Blue)
            'medium': { sigma: 25, count: 3, color: '#4daf4a' },    // 中频 σ=16px
            'large': { sigma: 50, count: 4, color: '#ff7f00' }      // 低频 σ=40px
        };

        this.exponent = 1.0;
        this.bandWeights = {
            'small': 1.0,
            'medium': 1.5,
            'large': 3.0
        };
    }

    /**
     * Set band weight
     */
    setBandWeight(level, weight) {
        if (this.bandWeights.hasOwnProperty(level)) {
            this.bandWeights[level] = weight;
        }
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
    /**
     * 生成指定级别的高斯分布（使用最小距离约束）
     */
    generateLevel(level, sigma, count, color) {
        // 1. 准备参数
        const padding = 10;
        const width = this.width;
        const height = this.height;
        const minDistance = 20; // 最小间距 20px

        const levelGaussians = [];
        const maxRetries = 200; // 最大重试次数

        for (let i = 0; i < count; i++) {
            let bestX, bestY;
            let valid = false;

            // 尝试多次生成直到满足距离条件
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                const x = padding + Math.random() * (width - 2 * padding);
                const y = padding + Math.random() * (height - 2 * padding);

                let tooClose = false;

                // 1. 检查与之前所有级别生成的已有高斯的距离
                for (const g of this.gaussians) {
                    // skip newly added ones from this level which are added to this.gaussians as we go?
                    // actually we can just check all in this.gaussians if we push them as we create them.
                    // But allow separating for clarity if needed.
                    // Let's just check against 'this.gaussians' which accumulates everything.
                    if (levelGaussians.includes(g)) continue; // avoid checking itself if logic was different, but here we push AFTER check, so this isn't needed really if we push later.

                    const dx = x - g.mX;
                    const dy = y - g.mY;
                    if (dx * dx + dy * dy < minDistance * minDistance) {
                        tooClose = true;
                        break;
                    }
                }

                if (!tooClose) {
                    // 2. 检查与本级别已生成的点的距离
                    for (const g of levelGaussians) {
                        const dx = x - g.mX;
                        const dy = y - g.mY;
                        if (dx * dx + dy * dy < minDistance * minDistance) {
                            tooClose = true;
                            break;
                        }
                    }
                }

                if (!tooClose) {
                    bestX = x;
                    bestY = y;
                    valid = true;
                    break;
                }
            }

            if (valid) {
                // 生成标准差（添加一些随机变化）
                const sXVariation = 0.8 + Math.random() * 0.4;
                const sYVariation = 0.8 + Math.random() * 0.4;
                const sX = sigma * sXVariation;
                const sY = sigma * sYVariation;

                // 生成相关系数
                const rho = (Math.random() * 2 - 1) * 0.6;
                let scaler = 100;

                // 创建高斯
                // Check if biGauss is available globally (it is used in other methods)
                const gauss = new biGauss(bestX, bestY, sX, sY, rho, scaler);
                gauss.color = color;
                gauss.sizeLevel = level;

                // 添加扩展属性
                gauss.originalMX = bestX;
                gauss.originalMY = bestY;
                gauss.originalSX = sX;
                gauss.originalSY = sY;
                gauss.originalRho = rho;
                gauss.originalScaler = scaler;
                gauss.isPerturbed = false;
                gauss.id = Math.random().toString(36).substr(2, 9);

                levelGaussians.push(gauss);
                // 直接加入总列表，这样下一个点生成时会自动避让他
                // 但是要注意 generateLevel 可能会被循环调用，所以 this.gaussians 里包含了之前 level 的点
                // 这里我们希望本 level 的点不仅避开之前的，也避开本 level 已生成的
                // 所以我们在此处加入 this.gaussians 是正确的
                this.gaussians.push(gauss);
            } else {
                console.warn(`Could not place Gaussian ${i + 1}/${count} for level ${level} within ${maxRetries} attempts.`);
            }
        }

        console.log(`Generated ${levelGaussians.length} Gaussians for level ${level} using Distance Constraint`);

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
                // CRITICAL: Must copy sizeLevel so weights can be applied
                tempGauss.sizeLevel = gauss.sizeLevel;

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        const index = y * width + x;
                        let val = tempGauss.eval(x, y);

                        // Apply band weight
                        if (tempGauss.sizeLevel && this.bandWeights[tempGauss.sizeLevel] !== undefined) {
                            val *= this.bandWeights[tempGauss.sizeLevel];
                        }

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

                        // Apply band weight
                        if (gauss.sizeLevel && this.bandWeights[gauss.sizeLevel] !== undefined) {
                            val *= this.bandWeights[gauss.sizeLevel];
                        }

                        // Apply exponent if not 1.0 (optimize for common case)
                        if (this.exponent !== 1.0) {
                            val = Math.pow(val, this.exponent);
                        }
                        data[index] += val;
                    }
                }
            }
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
