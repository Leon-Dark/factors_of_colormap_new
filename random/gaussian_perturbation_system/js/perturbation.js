/**
 * 扰动系统
 * Perturbation System
 * 
 * 负责对高斯分布应用各种扰动
 */

class PerturbationSystem {
    /**
     * 构造函数
     * @param {GaussianGenerator} generator - 高斯生成器实例
     */
    constructor(generator) {
        this.generator = generator;
        this.perturbationHistory = [];
    }

    /**
     * 扰动单个高斯
     * @param {biGauss} gauss - 高斯对象
     * @param {number} magnitude - 扰动幅度
     * @param {string|string[]} perturbType - 扰动类型（可以是单个或数组）
     */
    perturbGaussian(gauss, magnitude, perturbType = 'all') {
        // 支持数组形式的perturbType
        let perturbTypes;
        if (Array.isArray(perturbType)) {
            perturbTypes = perturbType;
        } else if (perturbType === 'all') {
            perturbTypes = ['position', 'stretch', 'rotation', 'amplitude'];
        } else {
            perturbTypes = [perturbType];
        }

        for (const type of perturbTypes) {
            switch (type) {
                case 'position':
                    // 扰动位置（中心点）
                    // Position is safe, keep it strong (1.0)
                    const maxPositionShift = magnitude * Math.max(gauss.sX, gauss.sY) * 0.5;
                    gauss.mX += (Math.random() * 2 - 1) * maxPositionShift;
                    gauss.mY += (Math.random() * 2 - 1) * maxPositionShift;
                    break;

                case 'stretch':
                    // 扰动形状 - 只改变标准差（拉伸/压缩）
                    // Adjusted to 0.5 for balance
                    const sigmaChange = magnitude * 0.3;
                    // Limit sigma shrinkage to prevent artifacting (min 20% of original)
                    const sXRatio = (1 + (Math.random() * 2 - 1) * sigmaChange);
                    const sYRatio = (1 + (Math.random() * 2 - 1) * sigmaChange);

                    gauss.sX = Math.max(gauss.originalSX * 0.2, gauss.sX * sXRatio);
                    gauss.sY = Math.max(gauss.originalSY * 0.2, gauss.sY * sYRatio);
                    break;

                case 'rotation':
                    // 扰动旋转 - 只改变相关系数（旋转/倾斜角度）
                    // Adjusted to 0.6 for balance
                    const rhoChange = magnitude * 0.4;
                    const newRho = gauss.rho + (Math.random() * 2 - 1) * rhoChange;
                    // Strict clamping to avoid aliasing artifacts (0.99 -> 0.92)
                    gauss.updateRho(Math.max(-0.92, Math.min(0.92, newRho)));
                    break;

                case 'shape':
                    // 向后兼容：shape = stretch + rotation
                    const sigmaChange2 = magnitude * 0.3;
                    gauss.sX *= (1 + (Math.random() * 2 - 1) * sigmaChange2);
                    gauss.sY *= (1 + (Math.random() * 2 - 1) * sigmaChange2);

                    const rhoChange2 = magnitude * 0.4;
                    const newRho2 = gauss.rho + (Math.random() * 2 - 1) * rhoChange2;
                    gauss.updateRho(Math.max(-0.99, Math.min(0.99, newRho2)));
                    break;

                case 'amplitude':
                    // 扰动幅值
                    // Adjusted to 0.6 to avoid extreme brightness clipping
                    const ampChange = magnitude * 0.4;
                    gauss.scaler *= (1 + (Math.random() * 2 - 1) * ampChange);
                    gauss.scaler = Math.max(0.1, gauss.scaler); // 确保不为负或太小
                    break;
            }
        }

        gauss.isPerturbed = true;
    }

    /**
     * 重置高斯扰动
     * @param {biGauss} gauss - 高斯对象
     */
    resetGaussianPerturbation(gauss) {
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

    /**
     * 应用全局扰动
     * @param {number} magnitude - 扰动幅度 (0-1)
     * @param {number} ratio - 扰动比例 (0-1)
     * @param {string|string[]} targetLevel - 目标级别（单个或数组）
     * @param {string|string[]} perturbType - 扰动类型（单个或数组）
     */
    applyGlobalPerturbation(magnitude, ratio, targetLevel = 'all', perturbType = 'all') {
        let gaussians = this.getTargetGaussians(targetLevel);

        if (gaussians.length === 0) {
            console.warn('No Gaussians selected for perturbation');
            return [];
        }
        const perturbCount = Math.floor(gaussians.length * ratio);

        // 随机选择要扰动的高斯
        const shuffled = this.shuffleArray([...gaussians]);
        const toPerturb = shuffled.slice(0, perturbCount);

        // 应用扰动
        for (const gauss of toPerturb) {
            this.perturbGaussian(gauss, magnitude, perturbType);
        }

        // 记录历史
        this.perturbationHistory.push({
            type: 'global',
            magnitude,
            ratio,
            targetLevel: Array.isArray(targetLevel) ? targetLevel : [targetLevel],
            perturbType: Array.isArray(perturbType) ? perturbType : [perturbType],
            count: toPerturb.length,
            timestamp: Date.now()
        });

        console.log(`Applied global perturbation to ${toPerturb.length} Gaussians across entire space`);
        return toPerturb;
    }

    /**
     * 应用局部扰动（自动选择最紧密的m个高斯）
     * @param {number} targetCount - 目标扰动的高斯数量
     * @param {number} magnitude - 扰动幅度 (0-1)
     * @param {number} ratio - 选中高斯中实际扰动的比例 (0-1)
     * @param {string|string[]} targetLevel - 目标级别（单个或数组）
     * @param {string|string[]} perturbType - 扰动类型（单个或数组）
     */
    applyLocalPerturbation(targetCount, magnitude, ratio, targetLevel = 'all', perturbType = 'all') {
        let gaussians = this.getTargetGaussians(targetLevel);

        if (gaussians.length === 0) {
            console.warn('No Gaussians available for perturbation');
            return [];
        }

        // 计算实际要扰动的数量（targetCount 是簇大小，ratio 是在簇中扰动的比例）
        // 为了让用户直观理解，我们让 targetCount 直接表示要扰动的数量
        // 簇大小设为 targetCount 的 1.5-2 倍，确保有足够的紧密邻居
        const perturbCount = Math.min(targetCount, gaussians.length);
        const clusterSize = Math.min(Math.ceil(perturbCount * 1.5), gaussians.length);

        // 找到最紧密的簇
        const compactCluster = this.findMostCompactCluster(gaussians, clusterSize);

        // 计算包围圆
        const circle = this.calculateBoundingCircle(compactCluster);

        console.log(`Found compact cluster of ${clusterSize} Gaussians with radius ${circle.radius.toFixed(2)}px at (${circle.centerX.toFixed(1)}, ${circle.centerY.toFixed(1)})`);

        // 在簇中选择最中心的 perturbCount 个高斯进行扰动
        const gaussWithDist = compactCluster.map(g => ({
            gauss: g,
            dist: distance(circle.centerX, circle.centerY, g.mX, g.mY)
        }));
        gaussWithDist.sort((a, b) => a.dist - b.dist);
        const toPerturb = gaussWithDist.slice(0, perturbCount).map(item => item.gauss);

        // 应用扰动（根据距离调整幅度）
        for (const gauss of toPerturb) {
            const dist = distance(circle.centerX, circle.centerY, gauss.mX, gauss.mY);
            const distFactor = circle.radius > 0 ? 1 - (dist / circle.radius) : 1;
            const adjustedMagnitude = magnitude * Math.max(0.5, distFactor); // 最小保持50%强度

            this.perturbGaussian(gauss, adjustedMagnitude, perturbType);
        }

        // 记录历史
        this.perturbationHistory.push({
            type: 'local',
            center: { x: circle.centerX, y: circle.centerY },
            radius: circle.radius,
            magnitude,
            ratio,
            targetLevel: Array.isArray(targetLevel) ? targetLevel : [targetLevel],
            perturbType: Array.isArray(perturbType) ? perturbType : [perturbType],
            clusterSize: clusterSize,
            count: toPerturb.length,
            timestamp: Date.now()
        });

        console.log(`Applied local perturbation to ${toPerturb.length} Gaussians in cluster of ${clusterSize}`);
        return { perturbed: toPerturb, cluster: compactCluster, circle };
    }

    /**
     * 找到最紧密的m个高斯（最小包围圆）
     * 优化算法：使用采样+密度启发式，降低时间复杂度
     */
    findMostCompactCluster(gaussians, m) {
        if (m >= gaussians.length) {
            return gaussians;
        }

        const n = gaussians.length;

        // 小规模数据：遍历所有点
        // 大规模数据：采样 sqrt(n) 或最多50个种子点
        const maxSeeds = n < 100 ? n : Math.min(50, Math.ceil(Math.sqrt(n)));

        // 第一步：如果需要采样，选择候选种子
        let seeds;
        if (maxSeeds < n) {
            // 策略：网格采样 - 将空间分成网格，每个格子选一个代表点
            // 这样可以覆盖整个空间，避免遗漏密集区域
            const gridSize = Math.ceil(Math.sqrt(maxSeeds));
            const cellWidth = this.generator.width / gridSize;
            const cellHeight = this.generator.height / gridSize;

            const grid = new Map();
            for (const g of gaussians) {
                const cellX = Math.floor(g.mX / cellWidth);
                const cellY = Math.floor(g.mY / cellHeight);
                const key = `${cellX},${cellY}`;

                if (!grid.has(key)) {
                    grid.set(key, []);
                }
                grid.get(key).push(g);
            }

            // 从每个非空格子中选择一个代表点（选最中心的）
            seeds = [];
            for (const [key, points] of grid.entries()) {
                if (points.length === 0) continue;

                // 计算格子中心
                const centerX = points.reduce((sum, g) => sum + g.mX, 0) / points.length;
                const centerY = points.reduce((sum, g) => sum + g.mY, 0) / points.length;

                // 选择最接近中心的点
                let closest = points[0];
                let minDist = distance(centerX, centerY, closest.mX, closest.mY);

                for (const p of points) {
                    const d = distance(centerX, centerY, p.mX, p.mY);
                    if (d < minDist) {
                        minDist = d;
                        closest = p;
                    }
                }

                seeds.push(closest);
            }

            // 如果种子数不够，随机补充
            if (seeds.length < maxSeeds) {
                const remaining = this.shuffleArray(
                    gaussians.filter(g => !seeds.includes(g))
                ).slice(0, maxSeeds - seeds.length);
                seeds.push(...remaining);
            }
        } else {
            seeds = gaussians;
        }

        // 第二步：对每个种子，找最紧密的m个高斯
        let bestCluster = null;
        let minRadius = Infinity;

        for (const seed of seeds) {
            // 计算所有高斯到seed的距离
            const distances = gaussians.map(g => ({
                gauss: g,
                dist: distance(seed.mX, seed.mY, g.mX, g.mY)
            }));

            // 按距离排序，取最近的m个
            distances.sort((a, b) => a.dist - b.dist);
            const cluster = distances.slice(0, m).map(d => d.gauss);

            // 计算这个簇的包围圆半径
            const circle = this.calculateBoundingCircle(cluster);

            // 如果这个簇更紧密，更新最佳结果
            if (circle.radius < minRadius) {
                minRadius = circle.radius;
                bestCluster = cluster;
            }
        }

        return bestCluster;
    }

    /**
     * 计算一组高斯的最小包围圆（近似算法）
     */
    calculateBoundingCircle(gaussians) {
        if (gaussians.length === 0) {
            return { centerX: 0, centerY: 0, radius: 0 };
        }

        if (gaussians.length === 1) {
            return { centerX: gaussians[0].mX, centerY: gaussians[0].mY, radius: 0 };
        }

        // 计算质心作为圆心
        let sumX = 0, sumY = 0;
        for (const g of gaussians) {
            sumX += g.mX;
            sumY += g.mY;
        }
        const centerX = sumX / gaussians.length;
        const centerY = sumY / gaussians.length;

        // 计算最远点的距离作为半径
        let maxDist = 0;
        for (const g of gaussians) {
            const dist = distance(centerX, centerY, g.mX, g.mY);
            if (dist > maxDist) {
                maxDist = dist;
            }
        }

        return { centerX, centerY, radius: maxDist };
    }

    /**
     * 应用频率选择性扰动
     * @param {string} frequencyRange - 频率范围 ('high', 'mid', 'low')
     * @param {number} magnitude - 扰动幅度
     * @param {number} ratio - 扰动比例
     * @param {string} perturbType - 扰动类型
     */
    applyFrequencySelectivePerturbation(frequencyRange, magnitude, ratio, perturbType = 'all') {
        let targetLevels = [];

        switch (frequencyRange) {
            case 'high':
                targetLevels = ['small'];
                break;
            case 'mid':
                targetLevels = ['medium'];
                break;
            case 'low':
                targetLevels = ['large'];
                break;
            default:
                targetLevels = ['small', 'medium', 'large'];
        }

        const gaussians = this.generator.getAllGaussians().filter(g =>
            targetLevels.includes(g.sizeLevel)
        );

        const perturbCount = Math.floor(gaussians.length * ratio);
        const shuffled = this.shuffleArray([...gaussians]);
        const toPerturb = shuffled.slice(0, perturbCount);

        for (const gauss of toPerturb) {
            this.perturbGaussian(gauss, magnitude, perturbType);
        }

        this.perturbationHistory.push({
            type: 'frequency-selective',
            frequencyRange,
            magnitude,
            ratio,
            perturbType,
            count: toPerturb.length,
            timestamp: Date.now()
        });

        console.log(`Applied frequency-selective perturbation to ${toPerturb.length} Gaussians`);
        return toPerturb;
    }

    /**
     * 应用结构化扰动（局部群组扰动）
     * @param {number} numClusters - 扰动簇的数量
     * @param {number} clusterRadius - 每个簇的半径
     * @param {number} magnitude - 扰动幅度
     * @param {string} targetLevel - 目标级别
     */
    applyStructuredPerturbation(numClusters, clusterRadius, magnitude, targetLevel = 'all') {
        const width = this.generator.width;
        const height = this.generator.height;
        const perturbedGaussians = new Set();

        // 生成随机簇中心
        for (let i = 0; i < numClusters; i++) {
            const centerX = randomRange(clusterRadius, width - clusterRadius);
            const centerY = randomRange(clusterRadius, height - clusterRadius);

            const perturbed = this.applyLocalPerturbation(
                centerX, centerY, clusterRadius, magnitude, 1.0, targetLevel, 'all'
            );

            perturbed.forEach(g => perturbedGaussians.add(g));
        }

        this.perturbationHistory.push({
            type: 'structured',
            numClusters,
            clusterRadius,
            magnitude,
            targetLevel,
            count: perturbedGaussians.size,
            timestamp: Date.now()
        });

        console.log(`Applied structured perturbation to ${perturbedGaussians.size} Gaussians`);
        return Array.from(perturbedGaussians);
    }

    /**
     * 重置所有扰动
     */
    resetAllPerturbations() {
        const gaussians = this.generator.getAllGaussians();
        for (const gauss of gaussians) {
            this.resetGaussianPerturbation(gauss);
        }
        this.perturbationHistory.push({
            type: 'reset',
            timestamp: Date.now()
        });
        console.log('Reset all perturbations');
    }

    /**
     * 获取目标高斯列表
     * @param {string|string[]} targetLevel - 目标级别（单个或数组）
     */
    getTargetGaussians(targetLevel) {
        // 支持数组形式的targetLevel
        if (Array.isArray(targetLevel)) {
            // 如果是数组，合并所有级别的高斯
            const allGaussians = this.generator.getAllGaussians();
            return allGaussians.filter(g => targetLevel.includes(g.sizeLevel));
        }

        // 单个级别的处理
        if (targetLevel === 'all') {
            return this.generator.getAllGaussians();
        } else if (targetLevel === 'small') {
            return this.generator.getAllGaussians().filter(g =>
                g.sizeLevel === 'small'
            );
        } else if (targetLevel === 'medium') {
            return this.generator.getAllGaussians().filter(g =>
                g.sizeLevel === 'medium'
            );
        } else if (targetLevel === 'large') {
            return this.generator.getAllGaussians().filter(g =>
                g.sizeLevel === 'large'
            );
        } else {
            return this.generator.getGaussiansByLevel(targetLevel);
        }
    }

    /**
     * 洗牌数组（Fisher-Yates算法）
     */
    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * 获取扰动统计
     */
    getStatistics() {
        const stats = {
            totalPerturbations: this.perturbationHistory.length,
            perturbedGaussians: this.generator.getAllGaussians().filter(g => g.isPerturbed).length,
            byLevel: {}
        };

        const levels = ['small', 'medium', 'large'];
        for (const level of levels) {
            const levelGaussians = this.generator.getGaussiansByLevel(level);
            stats.byLevel[level] = {
                total: levelGaussians.length,
                perturbed: levelGaussians.filter(g => g.isPerturbed).length,
                ratio: levelGaussians.length > 0
                    ? (levelGaussians.filter(g => g.isPerturbed).length / levelGaussians.length).toFixed(2)
                    : 0
            };
        }

        return stats;
    }

    /**
     * 获取扰动历史
     */
    getHistory() {
        return this.perturbationHistory;
    }

    /**
     * 清除历史
     */
    clearHistory() {
        this.perturbationHistory = [];
    }

    /**
     * 重置所有高斯到原始状态
     */
    resetToOriginal() {
        const gaussians = this.generator.getAllGaussians();
        for (const gauss of gaussians) {
            gauss.mX = gauss.originalMX;
            gauss.mY = gauss.originalMY;
            gauss.sX = gauss.originalSX;
            gauss.sY = gauss.originalSY;
            gauss.updateRho(gauss.originalRho);
            gauss.scaler = gauss.originalScaler;
            gauss.isPerturbed = false;
        }
        this.clearHistory();
        console.log('Reset all Gaussians to original state');
    }

    /**
     * 导出扰动配置
     */
    exportPerturbationData() {
        return {
            history: this.perturbationHistory,
            statistics: this.getStatistics(),
            gaussians: this.generator.getAllGaussians().map(g => ({
                id: g.id,
                sizeLevel: g.sizeLevel,
                isPerturbed: g.isPerturbed,
                original: {
                    mX: g.originalMX,
                    mY: g.originalMY,
                    sX: g.originalSX,
                    sY: g.originalSY
                },
                current: {
                    mX: g.mX,
                    mY: g.mY,
                    sX: g.sX,
                    sY: g.sY
                },
                delta: {
                    mX: g.mX - g.originalMX,
                    mY: g.mY - g.originalMY,
                    sX: g.sX - g.originalSX,
                    sY: g.sY - g.originalSY
                }
            }))
        };
    }
}
