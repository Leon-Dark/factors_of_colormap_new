/**
 * 二维高斯分布类
 * Bivariate Gaussian Distribution Class
 * 
 * 基于项目中现有的biGauss实现，支持相关性和扰动
 */

class BiGauss {
    /**
     * 构造函数
     * @param {number} mX - X方向的均值（中心位置）
     * @param {number} mY - Y方向的均值（中心位置）
     * @param {number} sX - X方向的标准差
     * @param {number} sY - Y方向的标准差
     * @param {number} rho - 相关系数 (-1 到 1)
     * @param {number} scaler - 幅值缩放因子
     */
    constructor(mX, mY, sX, sY, rho = 0, scaler = 1.0) {
        this.mX = mX;
        this.mY = mY;
        this.sX = sX;
        this.sY = sY;
        this.scaler = scaler;
        
        // 存储原始参数（用于重置扰动）
        this.originalMX = mX;
        this.originalMY = mY;
        this.originalSX = sX;
        this.originalSY = sY;
        this.originalRho = rho;
        this.originalScaler = scaler;
        
        // 更新相关系数及相关常数
        this.updateRho(rho);
        
        // 高斯所属的尺寸级别
        this.sizeLevel = this.determineSizeLevel();
        
        // 是否被扰动
        this.isPerturbed = false;
        
        // 颜色标记（用于可视化）
        this.color = null;
        
        // ID（用于追踪）
        this.id = Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 确定高斯的尺寸级别
     */
    determineSizeLevel() {
        const avgSigma = (this.sX + this.sY) / 2;
        
        if (avgSigma < 15) return 'small';
        else if (avgSigma < 35) return 'medium-small';
        else if (avgSigma < 65) return 'medium';
        else if (avgSigma < 110) return 'medium-large';
        else return 'large';
    }
    
    /**
     * 更新相关系数
     */
    updateRho(rho) {
        // 限制rho在有效范围内
        this.rho = clamp(rho, -0.99, 0.99);
        this.rho2 = this.rho * this.rho;
        this.rhoExpConst = -1 / (2 * (1 - this.rho2));
        this.rhoSqrConst = 1 / (2 * Math.PI * Math.sqrt(1 - this.rho2));
    }
    
    /**
     * 评估高斯在指定点的值
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {number} 高斯分布的值
     */
    eval(x, y) {
        // 标准化坐标
        const stX = (x - this.mX) / this.sX;
        const stY = (y - this.mY) / this.sY;
        const stXY = stX * stY;
        
        // 计算指数项
        const e = this.rhoExpConst * (stX * stX - 2 * this.rho * stXY + stY * stY);
        
        // 返回高斯值
        return this.scaler * Math.exp(e);
    }
    
    /**
     * 应用扰动
     * @param {number} magnitude - 扰动幅度 (0-1)
     * @param {string} perturbType - 扰动类型: 'position', 'shape', 'amplitude', 'all'
     */
    perturb(magnitude, perturbType = 'all') {
        const perturbTypes = perturbType === 'all' 
            ? ['position', 'shape', 'amplitude'] 
            : [perturbType];
        
        for (const type of perturbTypes) {
            switch(type) {
                case 'position':
                    // 扰动位置（中心点）
                    const maxPositionShift = magnitude * Math.max(this.sX, this.sY) * 0.5;
                    this.mX += (Math.random() * 2 - 1) * maxPositionShift;
                    this.mY += (Math.random() * 2 - 1) * maxPositionShift;
                    break;
                    
                case 'shape':
                    // 扰动形状（标准差和相关性）
                    const sigmaChange = magnitude * 0.3; // 最多30%的变化
                    this.sX *= (1 + (Math.random() * 2 - 1) * sigmaChange);
                    this.sY *= (1 + (Math.random() * 2 - 1) * sigmaChange);
                    
                    // 扰动相关系数
                    const rhoChange = magnitude * 0.4;
                    const newRho = this.rho + (Math.random() * 2 - 1) * rhoChange;
                    this.updateRho(newRho);
                    break;
                    
                case 'amplitude':
                    // 扰动幅值
                    const ampChange = magnitude * 0.4;
                    this.scaler *= (1 + (Math.random() * 2 - 1) * ampChange);
                    this.scaler = Math.max(0.1, this.scaler); // 确保不为负或太小
                    break;
            }
        }
        
        this.isPerturbed = true;
        this.sizeLevel = this.determineSizeLevel(); // 重新确定尺寸级别
    }
    
    /**
     * 重置扰动
     */
    resetPerturbation() {
        this.mX = this.originalMX;
        this.mY = this.originalMY;
        this.sX = this.originalSX;
        this.sY = this.originalSY;
        this.scaler = this.originalScaler;
        this.updateRho(this.originalRho);
        this.isPerturbed = false;
        this.sizeLevel = this.determineSizeLevel();
    }
    
    /**
     * 获取X方向的标准差
     */
    getSigmaX() {
        return this.sX;
    }
    
    /**
     * 获取Y方向的标准差
     */
    getSigmaY() {
        return this.sY;
    }
    
    /**
     * 更新X方向的标准差
     */
    updateSigmaX(sX) {
        this.sX = Math.max(1, sX);
        this.sizeLevel = this.determineSizeLevel();
    }
    
    /**
     * 更新Y方向的标准差
     */
    updateSigmaY(sY) {
        this.sY = Math.max(1, sY);
        this.sizeLevel = this.determineSizeLevel();
    }
    
    /**
     * 复制高斯对象
     */
    copy() {
        const newGauss = new BiGauss(this.mX, this.mY, this.sX, this.sY, this.rho, this.scaler);
        newGauss.originalMX = this.originalMX;
        newGauss.originalMY = this.originalMY;
        newGauss.originalSX = this.originalSX;
        newGauss.originalSY = this.originalSY;
        newGauss.originalRho = this.originalRho;
        newGauss.originalScaler = this.originalScaler;
        newGauss.isPerturbed = this.isPerturbed;
        newGauss.sizeLevel = this.sizeLevel;
        newGauss.color = this.color;
        return newGauss;
    }
    
    /**
     * 获取高斯的边界框
     */
    getBoundingBox(sigmaMultiplier = 3) {
        return {
            minX: this.mX - this.sX * sigmaMultiplier,
            maxX: this.mX + this.sX * sigmaMultiplier,
            minY: this.mY - this.sY * sigmaMultiplier,
            maxY: this.mY + this.sY * sigmaMultiplier
        };
    }
    
    /**
     * 检查点是否在高斯的有效影响范围内
     */
    isInRange(x, y, threshold = 0.01) {
        return this.eval(x, y) > threshold;
    }
    
    /**
     * 获取高斯的详细信息（用于显示）
     */
    getInfo() {
        return {
            id: this.id,
            center: { x: this.mX.toFixed(2), y: this.mY.toFixed(2) },
            sigma: { x: this.sX.toFixed(2), y: this.sY.toFixed(2) },
            rho: this.rho.toFixed(3),
            scaler: this.scaler.toFixed(3),
            sizeLevel: this.sizeLevel,
            isPerturbed: this.isPerturbed,
            avgSigma: ((this.sX + this.sY) / 2).toFixed(2)
        };
    }
    
    /**
     * 导出为JSON格式
     */
    toJSON() {
        return {
            id: this.id,
            mX: this.mX,
            mY: this.mY,
            sX: this.sX,
            sY: this.sY,
            rho: this.rho,
            scaler: this.scaler,
            sizeLevel: this.sizeLevel,
            isPerturbed: this.isPerturbed,
            original: {
                mX: this.originalMX,
                mY: this.originalMY,
                sX: this.originalSX,
                sY: this.originalSY,
                rho: this.originalRho,
                scaler: this.originalScaler
            }
        };
    }
    
    /**
     * 从JSON创建高斯对象
     */
    static fromJSON(json) {
        const gauss = new BiGauss(json.mX, json.mY, json.sX, json.sY, json.rho, json.scaler);
        gauss.id = json.id;
        gauss.originalMX = json.original.mX;
        gauss.originalMY = json.original.mY;
        gauss.originalSX = json.original.sX;
        gauss.originalSY = json.original.sY;
        gauss.originalRho = json.original.rho;
        gauss.originalScaler = json.original.scaler;
        gauss.isPerturbed = json.isPerturbed;
        gauss.sizeLevel = json.sizeLevel;
        return gauss;
    }
}
