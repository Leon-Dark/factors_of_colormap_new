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
            'small': { sigma: 4, count: 8, color: '#e41a1c' },      // 高频 σ=4px
            'medium': { sigma: 16, count: 5, color: '#4daf4a' },    // 中频 σ=16px
            'large': { sigma: 40, count: 3, color: '#ff7f00' }      // 低频 σ=40px
        };
        
        // 四宫格配置
        this.gridEnabled = false; // 是否启用四宫格模式
        this.gridConfig = {
            // 每个分格的高斯数量配置
            perQuadrant: {
                'small': 4,   // 每个分格4个高频
                'medium': 2,  // 每个分格2个中频
                'large': 1    // 每个分格1个低频
            }
        };
        this.activeQuadrant = null; // 当前激活的分格 (0, 1, 2, 3)
        this.quadrants = this.calculateQuadrants();
    }
    
    /**
     * 更新画布尺寸
     */
    updateDimensions(width, height) {
        this.width = width;
        this.height = height;
        this.quadrants = this.calculateQuadrants();
    }
    
    /**
     * 计算四宫格边界
     * @returns {Array} 四个分格的边界信息
     */
    calculateQuadrants() {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        
        return [
            { id: 0, name: '左上 / Top-Left', minX: 0, maxX: halfW, minY: 0, maxY: halfH },
            { id: 1, name: '右上 / Top-Right', minX: halfW, maxX: this.width, minY: 0, maxY: halfH },
            { id: 2, name: '左下 / Bottom-Left', minX: 0, maxX: halfW, minY: halfH, maxY: this.height },
            { id: 3, name: '右下 / Bottom-Right', minX: halfW, maxX: this.width, minY: halfH, maxY: this.height }
        ];
    }
    
    /**
     * 启用/禁用四宫格模式
     */
    setGridMode(enabled) {
        this.gridEnabled = enabled;
        console.log(`Grid mode ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * 设置激活的分格
     */
    setActiveQuadrant(quadrantId) {
        if (quadrantId >= 0 && quadrantId < 4) {
            this.activeQuadrant = quadrantId;
            console.log(`Active quadrant set to ${quadrantId}: ${this.quadrants[quadrantId].name}`);
        }
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
     * 生成所有级别的高斯分布
     */
    generateAll() {
        this.gaussians = [];
        
        if (this.gridEnabled) {
            // 四宫格模式：为每个分格生成高斯
            for (let quadId = 0; quadId < 4; quadId++) {
                for (const [level, config] of Object.entries(this.sizeLevels)) {
                    const count = this.gridConfig.perQuadrant[level];
                    this.generateLevelInQuadrant(level, config.sigma, count, config.color, quadId);
                }
            }
            console.log(`Generated ${this.gaussians.length} Gaussians in 4 quadrants`);
        } else {
            // 传统模式：随机生成
            for (const [level, config] of Object.entries(this.sizeLevels)) {
                this.generateLevel(level, config.sigma, config.count, config.color);
            }
            console.log(`Generated ${this.gaussians.length} Gaussians across all levels`);
        }
        
        return this.gaussians;
    }
    
    /**
     * 在指定分格内生成高斯分布
     */
    generateLevelInQuadrant(level, sigma, count, color, quadrantId) {
        const quad = this.quadrants[quadrantId];
        
        // 动态调整参数，大高斯更宽松
        const paddingRatio = sigma > 30 ? 0.8 : 2.0;
        const distanceRatio = sigma > 30 ? 0.3 : 0.8;
        
        const padding = sigma * paddingRatio;
        const minDistance = sigma * distanceRatio;
        
        const levelGaussians = [];
        let attempts = 0;
        const maxAttempts = count * 100;
        
        while (levelGaussians.length < count && attempts < maxAttempts) {
            attempts++;
            
            // 在分格范围内生成随机位置
            const mX = randomRange(
                Math.max(quad.minX + padding, padding),
                Math.min(quad.maxX - padding, this.width - padding)
            );
            const mY = randomRange(
                Math.max(quad.minY + padding, padding),
                Math.min(quad.maxY - padding, this.height - padding)
            );
            
            // 确保不超出总画布边界
            if (mX < padding || mX > this.width - padding || 
                mY < padding || mY > this.height - padding) {
                continue;
            }
            
            // 检查是否与同分格的已有高斯太近
            let tooClose = false;
            for (const existing of this.gaussians) {
                if (existing.quadrant !== quadrantId) continue; // 只检查同分格的高斯
                
                const dist = distance(mX, mY, existing.mX, existing.mY);
                const avgSigma = (sigma + existing.getSigmaX()) / 2;
                const minDist = avgSigma * distanceRatio;
                if (dist < minDist) {
                    tooClose = true;
                    break;
                }
            }
            
            if (tooClose) continue;
            
            // 生成标准差（添加一些随机变化）
            const sXVariation = 0.7 + Math.random() * 0.6;
            const sYVariation = 0.7 + Math.random() * 0.6;
            const sX = sigma * sXVariation;
            const sY = sigma * sYVariation;
            
            // 生成相关系数
            const rho = (Math.random() * 2 - 1) * 0.6;
            
            // 生成幅值
            const scaler = 0.5 + Math.random() * 0.5;
            
            // 创建高斯
            const gauss = new biGauss(mX, mY, sX, sY, rho, scaler);
            gauss.color = color;
            gauss.sizeLevel = level;
            gauss.quadrant = quadrantId; // 记录所属分格
            
            // 添加扩展属性
            gauss.originalMX = mX;
            gauss.originalMY = mY;
            gauss.originalSX = sX;
            gauss.originalSY = sY;
            gauss.originalRho = rho;
            gauss.originalScaler = scaler;
            gauss.isPerturbed = false;
            gauss.id = Math.random().toString(36).substr(2, 9);
            
            levelGaussians.push(gauss);
            this.gaussians.push(gauss);
        }
        
        if (levelGaussians.length < count) {
            console.warn(`Quadrant ${quadrantId}: Only generated ${levelGaussians.length}/${count} Gaussians for level ${level}`);
        }
        
        return levelGaussians;
    }
    
    /**
     * 生成指定级别的高斯分布（传统随机模式）
     */
    generateLevel(level, sigma, count, color) {
        // 动态调整参数，大高斯更宽松（适配200×200画布）
        const paddingRatio = sigma > 30 ? 0.8 : 2.0;  // 大高斯大幅减少边界填充
        const distanceRatio = sigma > 30 ? 0.3 : 0.8;  // 大高斯允许更近（允许重叠）
        
        const padding = sigma * paddingRatio;
        const minDistance = sigma * distanceRatio;
        
        const levelGaussians = [];
        let attempts = 0;
        const maxAttempts = count * 100; // 增加尝试次数
        
        while (levelGaussians.length < count && attempts < maxAttempts) {
            attempts++;
            
            // 生成随机位置
            const mX = randomRange(padding, this.width - padding);
            const mY = randomRange(padding, this.height - padding);
            
            // 检查是否与已有高斯太近
            let tooClose = false;
            for (const existing of this.gaussians) {
                const dist = distance(mX, mY, existing.mX, existing.mY);
                // 动态计算最小距离
                const avgSigma = (sigma + existing.getSigmaX()) / 2;
                const minDist = avgSigma * distanceRatio;
                if (dist < minDist) {
                    tooClose = true;
                    break;
                }
            }
            
            if (tooClose) continue;
            
            // 生成标准差（添加一些随机变化）
            const sXVariation = 0.7 + Math.random() * 0.6; // 0.7-1.3倍
            const sYVariation = 0.7 + Math.random() * 0.6;
            const sX = sigma * sXVariation;
            const sY = sigma * sYVariation;
            
            // 生成相关系数
            const rho = (Math.random() * 2 - 1) * 0.6; // -0.6 到 0.6
            
            // 生成幅值
            const scaler = 0.5 + Math.random() * 0.5; // 0.5-1.0
            
            // 创建高斯（使用现有的biGauss类）
            const gauss = new biGauss(mX, mY, sX, sY, rho, scaler);
            gauss.color = color;
            gauss.sizeLevel = level;
            gauss.quadrant = null; // 传统模式不属于任何分格
            
            // 添加扩展属性
            gauss.originalMX = mX;
            gauss.originalMY = mY;
            gauss.originalSX = sX;
            gauss.originalSY = sY;
            gauss.originalRho = rho;
            gauss.originalScaler = scaler;
            gauss.isPerturbed = false;
            gauss.id = Math.random().toString(36).substr(2, 9);
            
            levelGaussians.push(gauss);
            this.gaussians.push(gauss);
        }
        
        if (levelGaussians.length < count) {
            console.warn(`Only generated ${levelGaussians.length}/${count} Gaussians for level ${level}`);
        }
        
        return levelGaussians;
    }
    
    /**
     * 获取指定级别的所有高斯
     */
    getGaussiansByLevel(level) {
        return this.gaussians.filter(g => g.sizeLevel === level);
    }
    
    /**
     * 获取指定分格的所有高斯
     */
    getGaussiansByQuadrant(quadrantId) {
        return this.gaussians.filter(g => g.quadrant === quadrantId);
    }
    
    /**
     * 获取指定分格和级别的高斯
     */
    getGaussiansByQuadrantAndLevel(quadrantId, level) {
        return this.gaussians.filter(g => g.quadrant === quadrantId && g.sizeLevel === level);
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
     */
    renderToField(field) {
        const width = field[0].length;
        const height = field.length;
        
        // 初始化场为0
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                field[y][x] = 0;
            }
        }
        
        // 叠加所有高斯
        for (const gauss of this.gaussians) {
            const bbox = gauss.getBoundingBox(3); // 3个标准差范围
            
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
        
        return field;
    }
    
    /**
     * 渲染到1D数组（用于canvas ImageData）
     * @param {number} width - 图像宽度
     * @param {number} height - 图像高度
     * @param {boolean} useOriginal - 是否使用原始参数
     * @returns {Float32Array} 1D数组
     */
    renderTo1DArray(width, height, useOriginal = false) {
        const data = new Float32Array(width * height);
        
        // 叠加所有高斯
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
                        data[index] += tempGauss.eval(x, y);
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
                        data[index] += gauss.eval(x, y);
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
            byQuadrant: {},
            perturbed: this.gaussians.filter(g => g.isPerturbed).length,
            gridEnabled: this.gridEnabled,
            activeQuadrant: this.activeQuadrant
        };
        
        for (const level of Object.keys(this.sizeLevels)) {
            const levelGaussians = this.getGaussiansByLevel(level);
            stats.byLevel[level] = {
                count: levelGaussians.length,
                perturbed: levelGaussians.filter(g => g.isPerturbed).length
            };
        }
        
        if (this.gridEnabled) {
            for (let i = 0; i < 4; i++) {
                const quadGaussians = this.getGaussiansByQuadrant(i);
                stats.byQuadrant[i] = {
                    name: this.quadrants[i].name,
                    count: quadGaussians.length,
                    perturbed: quadGaussians.filter(g => g.isPerturbed).length
                };
            }
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
            gridEnabled: this.gridEnabled,
            gridConfig: this.gridConfig,
            activeQuadrant: this.activeQuadrant,
            gaussians: this.gaussians.map(g => ({
                id: g.id,
                mX: g.mX,
                mY: g.mY,
                sX: g.sX,
                sY: g.sY,
                rho: g.rho,
                scaler: g.scaler,
                sizeLevel: g.sizeLevel,
                quadrant: g.quadrant,
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
        this.gridEnabled = config.gridEnabled || false;
        this.gridConfig = config.gridConfig || this.gridConfig;
        this.activeQuadrant = config.activeQuadrant || null;
        this.quadrants = this.calculateQuadrants();
        this.gaussians = config.gaussians.map(gData => {
            const g = new biGauss(gData.mX, gData.mY, gData.sX, gData.sY, gData.rho, gData.scaler);
            g.id = gData.id;
            g.sizeLevel = gData.sizeLevel;
            g.quadrant = gData.quadrant !== undefined ? gData.quadrant : null;
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
