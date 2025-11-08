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
     * @param {string} perturbType - 扰动类型
     */
    perturbGaussian(gauss, magnitude, perturbType = 'all') {
        const perturbTypes = perturbType === 'all' 
            ? ['position', 'shape', 'amplitude'] 
            : [perturbType];
        
        for (const type of perturbTypes) {
            switch(type) {
                case 'position':
                    // 扰动位置（中心点）
                    const maxPositionShift = magnitude * Math.max(gauss.sX, gauss.sY) * 0.5;
                    gauss.mX += (Math.random() * 2 - 1) * maxPositionShift;
                    gauss.mY += (Math.random() * 2 - 1) * maxPositionShift;
                    break;
                    
                case 'shape':
                    // 扰动形状（标准差和相关性）
                    const sigmaChange = magnitude * 0.3; // 最多30%的变化
                    gauss.sX *= (1 + (Math.random() * 2 - 1) * sigmaChange);
                    gauss.sY *= (1 + (Math.random() * 2 - 1) * sigmaChange);
                    
                    // 扰动相关系数
                    const rhoChange = magnitude * 0.4;
                    const newRho = gauss.rho + (Math.random() * 2 - 1) * rhoChange;
                    gauss.updateRho(Math.max(-0.99, Math.min(0.99, newRho)));
                    break;
                    
                case 'amplitude':
                    // 扰动幅值
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
     * @param {string} targetLevel - 目标级别 ('all', 'small', 'medium', 'large')
     * @param {string} perturbType - 扰动类型 ('all', 'position', 'shape', 'amplitude')
     */
    applyGlobalPerturbation(magnitude, ratio, targetLevel = 'all', perturbType = 'all') {
        const gaussians = this.getTargetGaussians(targetLevel);
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
            targetLevel,
            perturbType,
            count: toPerturb.length,
            timestamp: Date.now()
        });
        
        console.log(`Applied global perturbation to ${toPerturb.length} Gaussians`);
        return toPerturb;
    }
    
    /**
     * 应用局部扰动
     * @param {number} centerX - 扰动中心X坐标
     * @param {number} centerY - 扰动中心Y坐标
     * @param {number} radius - 扰动半径
     * @param {number} magnitude - 扰动幅度 (0-1)
     * @param {number} ratio - 区域内扰动比例 (0-1)
     * @param {string} targetLevel - 目标级别
     * @param {string} perturbType - 扰动类型
     */
    applyLocalPerturbation(centerX, centerY, radius, magnitude, ratio, targetLevel = 'all', perturbType = 'all') {
        const gaussians = this.getTargetGaussians(targetLevel);
        
        // 找到半径内的所有高斯
        const inRange = gaussians.filter(gauss => {
            const dist = distance(centerX, centerY, gauss.mX, gauss.mY);
            return dist <= radius;
        });
        
        if (inRange.length === 0) {
            console.warn('No Gaussians found in the specified region');
            return [];
        }
        
        // 根据比例选择要扰动的高斯
        const perturbCount = Math.max(1, Math.floor(inRange.length * ratio));
        const shuffled = this.shuffleArray([...inRange]);
        const toPerturb = shuffled.slice(0, perturbCount);
        
        // 应用扰动（可以根据距离调整幅度）
        for (const gauss of toPerturb) {
            const dist = distance(centerX, centerY, gauss.mX, gauss.mY);
            const distFactor = 1 - (dist / radius); // 距离越近，扰动越大
            const adjustedMagnitude = magnitude * distFactor;
            
            this.perturbGaussian(gauss, adjustedMagnitude, perturbType);
        }
        
        // 记录历史
        this.perturbationHistory.push({
            type: 'local',
            center: { x: centerX, y: centerY },
            radius,
            magnitude,
            ratio,
            targetLevel,
            perturbType,
            count: toPerturb.length,
            timestamp: Date.now()
        });
        
        console.log(`Applied local perturbation to ${toPerturb.length} Gaussians`);
        return toPerturb;
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
        
        switch(frequencyRange) {
            case 'high':
                targetLevels = ['small', 'medium-small'];
                break;
            case 'mid':
                targetLevels = ['medium'];
                break;
            case 'low':
                targetLevels = ['medium-large', 'large'];
                break;
            default:
                targetLevels = ['small', 'medium-small', 'medium', 'medium-large', 'large'];
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
     */
    getTargetGaussians(targetLevel) {
        if (targetLevel === 'all') {
            return this.generator.getAllGaussians();
        } else if (targetLevel === 'small') {
            return this.generator.getAllGaussians().filter(g => 
                g.sizeLevel === 'small' || g.sizeLevel === 'medium-small'
            );
        } else if (targetLevel === 'medium') {
            return this.generator.getAllGaussians().filter(g => 
                g.sizeLevel === 'medium'
            );
        } else if (targetLevel === 'large') {
            return this.generator.getAllGaussians().filter(g => 
                g.sizeLevel === 'medium-large' || g.sizeLevel === 'large'
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
        
        const levels = ['small', 'medium-small', 'medium', 'medium-large', 'large'];
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
