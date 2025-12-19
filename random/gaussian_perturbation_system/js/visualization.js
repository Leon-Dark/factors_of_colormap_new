/**
 * 可视化系统
 * Visualization System
 * 
 * 负责渲染高斯分布到canvas
 */

class VisualizationSystem {
    /**
     * 构造函数
     * @param {HTMLCanvasElement} canvas - Canvas元素
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // 渲染选项
        this.options = {
            colormap: 'greyscale',
            showGaussianBorders: false,
            showGaussianCenters: true,
            showGridLines: true,  // 新增：是否显示四宫格网格线
            highlightPerturbed: true,
            normalizeIntensity: true
        };
        
        // 全局 colormap（所有视图共享）
        this.globalColormap = 'greyscale';
        
        // 缓存的渲染数据
        this.cachedData = null;
        this.cachedImageData = null;
    }
    
    /**
     * 渲染高斯分布
     * @param {GaussianGenerator} generator - 高斯生成器
     * @param {boolean} useOriginal - 是否使用原始参数
     */
    renderGaussians(generator, useOriginal = false) {
        // 生成数据
        const data = generator.renderTo1DArray(this.width, this.height, useOriginal);
        
        // 归一化
        let max = 0;
        for (let i = 0; i < data.length; i++) {
            max = Math.max(max, data[i]);
        }
        
        if (max === 0) {
            console.warn('All Gaussian values are zero');
            this.clearCanvas();
            return;
        }
        
        const normalizedData = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) {
            normalizedData[i] = data[i] / max;
        }
        
        // 渲染到canvas
        this.renderDataToCanvas(normalizedData);
        
        // 绘制网格线（如枟选项开启）
        if (this.options.showGridLines) {
            this.drawQuadrantGrid();
        }
        
        // 绘制高斯标记
        if (this.options.showGaussianCenters) {
            this.drawGaussianMarkers(generator, useOriginal);
        }
        
        if (this.options.showGaussianBorders) {
            this.drawGaussianBorders(generator, useOriginal);
        }
        
        // 缓存数据
        this.cachedData = normalizedData;
        
        return normalizedData;
    }
    
    /**
     * 绘制网格线（将画布分为四个区域以便观察）
     */
    drawQuadrantGrid() {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        
        this.ctx.strokeStyle = '#00ffff'; // 青色网格线
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.6;
        this.ctx.setLineDash([5, 5]); // 虚线
        
        // 垂直线
        this.ctx.beginPath();
        this.ctx.moveTo(halfW, 0);
        this.ctx.lineTo(halfW, this.height);
        this.ctx.stroke();
        
        // 水平线
        this.ctx.beginPath();
        this.ctx.moveTo(0, halfH);
        this.ctx.lineTo(this.width, halfH);
        this.ctx.stroke();
        
        // 重置样式
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * 渲染数据到canvas
     */
    renderDataToCanvas(data) {
        const imageData = this.ctx.createImageData(this.width, this.height);
        const pixels = imageData.data;
        
        // 使用全局 colormap 或选项中的 colormap
        const colormapToUse = this.globalColormap || this.options.colormap;
        
        for (let i = 0; i < data.length; i++) {
            const value = data[i];
            const color = valueToColor(value, colormapToUse);
            
            const pixelIndex = i * 4;
            pixels[pixelIndex] = color[0];     // R
            pixels[pixelIndex + 1] = color[1]; // G
            pixels[pixelIndex + 2] = color[2]; // B
            pixels[pixelIndex + 3] = 255;      // A
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        this.cachedImageData = imageData;
    }
    
    /**
     * 绘制高斯中心标记
     * @param {GaussianGenerator} generator - 高斯生成器
     * @param {boolean} useOriginal - 是否使用原始位置
     */
    drawGaussianMarkers(generator, useOriginal = false) {
        const gaussians = generator.getAllGaussians();
        
        for (const gauss of gaussians) {
            // 确定使用原始位置还是当前位置
            const centerX = useOriginal ? gauss.originalMX : gauss.mX;
            const centerY = useOriginal ? gauss.originalMY : gauss.mY;
            
            // 确定颜色
            let markerColor = gauss.color || '#ffffff';

            // 绘制中心点
            this.ctx.fillStyle = markerColor;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 绘制边框
            this.ctx.strokeStyle = '#000000';
            // 如果是被扰动的点，边缘加粗
            if (this.options.highlightPerturbed && gauss.isPerturbed && !useOriginal) {
                this.ctx.lineWidth = 3;
            } else {
                this.ctx.lineWidth = 1;
            }
            this.ctx.stroke();
        }
    }
    
    /**
     * 绘制高斯边界
     * @param {GaussianGenerator} generator - 高斯生成器
     * @param {boolean} useOriginal - 是否使用原始参数
     */
    drawGaussianBorders(generator, useOriginal = false) {
        const gaussians = generator.getAllGaussians();
        
        for (const gauss of gaussians) {
            // 确定使用原始参数还是当前参数
            const centerX = useOriginal ? gauss.originalMX : gauss.mX;
            const centerY = useOriginal ? gauss.originalMY : gauss.mY;
            const sX = useOriginal ? gauss.originalSX : gauss.sX;
            const sY = useOriginal ? gauss.originalSY : gauss.sY;
            
            const color = gauss.color || '#ffffff';
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = (gauss.isPerturbed && !useOriginal) ? 2 : 1;
            this.ctx.globalAlpha = 0.5;
            
            // 绘制椭圆（3个标准差）
            this.ctx.beginPath();
            this.ctx.ellipse(
                centerX, centerY,
                sX * 3, sY * 3,
                0, 0, Math.PI * 2
            );
            this.ctx.stroke();
            
            this.ctx.globalAlpha = 1.0;
        }
    }
    
    /**
     * 渲染差异图
     * @param {Float32Array} originalData - 原始数据
     * @param {Float32Array} perturbedData - 扰动后数据
     * @param {GaussianGenerator} generator - 高斯生成器（可选，用于绘制网格线）
     */
    renderDifference(originalData, perturbedData, generator = null) {
        if (originalData.length !== perturbedData.length) {
            console.error('Data arrays must have the same length');
            return;
        }
        
        const imageData = this.ctx.createImageData(this.width, this.height);
        const pixels = imageData.data;
        
        // 计算差异
        const diffData = new Float32Array(originalData.length);
        let maxDiff = 0;
        
        for (let i = 0; i < originalData.length; i++) {
            const diff = Math.abs(perturbedData[i] - originalData[i]);
            diffData[i] = diff;
            maxDiff = Math.max(maxDiff, diff);
        }
        
        // 归一化并渲染
        if (maxDiff === 0) {
            console.warn('No difference detected');
            this.clearCanvas();
            return;
        }
        
        for (let i = 0; i < diffData.length; i++) {
            const normalizedDiff = diffData[i] / maxDiff;
            const color = valueToColor(normalizedDiff, 'hot');
            
            const pixelIndex = i * 4;
            pixels[pixelIndex] = color[0];
            pixels[pixelIndex + 1] = color[1];
            pixels[pixelIndex + 2] = color[2];
            pixels[pixelIndex + 3] = 255;
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        // 绘制网格线（如果选项开启）
        if (this.options.showGridLines) {
            this.drawQuadrantGrid();
        }
        
        return diffData;
    }
    
    /**
     * 渲染热力图（频率能量分布）
     * @param {GaussianGenerator} generator - 高斯生成器
     */
    renderHeatmap(generator) {
        const imageData = this.ctx.createImageData(this.width, this.height);
        const pixels = imageData.data;
        
        const levels = ['small', 'medium-small', 'medium', 'medium-large', 'large'];
        const levelWeights = [1.0, 0.8, 0.6, 0.4, 0.2]; // 高频权重更高
        
        const energyMap = new Float32Array(this.width * this.height);
        
        // 计算每个级别的能量贡献
        for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
            const level = levels[levelIdx];
            const weight = levelWeights[levelIdx];
            const gaussians = generator.getGaussiansByLevel(level);
            
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let energy = 0;
                    for (const gauss of gaussians) {
                        energy += gauss.eval(x, y);
                    }
                    const index = y * this.width + x;
                    energyMap[index] += energy * weight;
                }
            }
        }
        
        // 归一化
        let maxEnergy = 0;
        for (let i = 0; i < energyMap.length; i++) {
            maxEnergy = Math.max(maxEnergy, energyMap[i]);
        }
        
        if (maxEnergy === 0) {
            this.clearCanvas();
            return;
        }
        
        // 渲染
        for (let i = 0; i < energyMap.length; i++) {
            const normalizedEnergy = energyMap[i] / maxEnergy;
            const color = valueToColor(normalizedEnergy, 'plasma');
            
            const pixelIndex = i * 4;
            pixels[pixelIndex] = color[0];
            pixels[pixelIndex + 1] = color[1];
            pixels[pixelIndex + 2] = color[2];
            pixels[pixelIndex + 3] = 255;
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        // 绘制网格线（如果选项开启）
        if (this.options.showGridLines) {
            this.drawQuadrantGrid();
        }
        
        return energyMap;
    }
    
    /**
     * 清空canvas
     */
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    /**
     * 设置渲染选项
     */
    setOption(key, value) {
        this.options[key] = value;
    }
    
    /**
     * 获取渲染选项
     */
    getOptions() {
        return { ...this.options };
    }
    
    /**
     * 高亮显示特定高斯
     */
    highlightGaussian(gauss) {
        // 绘制高亮圆圈
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = 0.8;
        
        this.ctx.beginPath();
        this.ctx.arc(gauss.mX, gauss.mY, Math.max(gauss.sX, gauss.sY) * 2, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.globalAlpha = 1.0;
    }
    
    /**
     * 导出canvas为图片
     */
    exportImage(filename = 'gaussian_visualization.png') {
        exportCanvasAsImage(this.canvas, filename);
    }
    
    /**
     * 获取缓存的数据
     */
    getCachedData() {
        return this.cachedData;
    }
    
    /**
     * 更新canvas尺寸
     */
    updateDimensions(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this.ctx = this.canvas.getContext('2d');
    }
}

/**
 * 多视图可视化管理器
 * 管理多个canvas视图（原始、扰动、差异、热力图）
 */
class MultiViewVisualization {
    constructor() {
        this.views = {
            original: null,
            perturbed: null,
            difference: null,
            heatmap: null
        };
        
        this.currentView = 'original';
        this.generator = null;
        this.originalData = null;
        this.perturbedData = null;
    }
    
    /**
     * 初始化视图
     */
    initializeViews() {
        this.views.original = new VisualizationSystem(
            document.getElementById('canvas-original')
        );
        this.views.perturbed = new VisualizationSystem(
            document.getElementById('canvas-perturbed')
        );
        this.views.difference = new VisualizationSystem(
            document.getElementById('canvas-difference')
        );
        this.views.heatmap = new VisualizationSystem(
            document.getElementById('canvas-heatmap')
        );
    }
    
    /**
     * 设置生成器
     */
    setGenerator(generator) {
        this.generator = generator;
    }
    
    /**
     * 设置全局 colormap（所有视图共享）
     */
    setColormap(colormap) {
        // 为所有视图设置相同的 colormap
        for (const view of Object.values(this.views)) {
            if (view) {
                view.globalColormap = colormap;
            }
        }
        console.log(`Colormap changed to: ${colormap}`);
    }
    
    /**
     * 渲染原始视图
     */
    renderOriginal() {
        if (!this.generator) return;
        
        this.originalData = this.views.original.renderGaussians(this.generator, true);
        document.getElementById('info-original').textContent = 
            `Displaying ${this.generator.getAllGaussians().length} Gaussians / 显示 ${this.generator.getAllGaussians().length} 个高斯分布`;
    }
    
    /**
     * 渲染扰动视图
     */
    renderPerturbed() {
        if (!this.generator) return;
        
        this.perturbedData = this.views.perturbed.renderGaussians(this.generator);
        const perturbedCount = this.generator.getAllGaussians().filter(g => g.isPerturbed).length;
        document.getElementById('info-perturbed').textContent = 
            `${perturbedCount} perturbed Gaussians / 已扰动 ${perturbedCount} 个高斯`;
    }
    
    /**
     * 渲染差异视图
     */
    renderDifference() {
        if (!this.originalData || !this.perturbedData) {
            console.warn('Need both original and perturbed data');
            return;
        }
        
        const diffData = this.views.difference.renderDifference(
            this.originalData, this.perturbedData, this.generator
        );
        
        // 计算SSIM
        const ssim = calculateSSIM(
            this.originalData, this.perturbedData,
            this.views.difference.width, this.views.difference.height
        );
        
        document.getElementById('info-difference').textContent = 
            `SSIM: ${ssim.toFixed(4)}`;
        document.getElementById('stat-ssim').textContent = ssim.toFixed(3);
    }
    
    /**
     * 渲染热力图
     */
    renderHeatmap() {
        if (!this.generator) return;
        
        this.views.heatmap.renderHeatmap(this.generator);
        document.getElementById('info-heatmap').textContent = 
            'Frequency energy distribution (high freq = bright) / 频率能量分布（高频=亮色）';
    }
    
    /**
     * 切换视图
     */
    switchView(viewName) {
        // 原始和扰动视图始终显示，只切换差异图和热力图
        const analysisViews = ['difference', 'heatmap'];
        
        // 隐藏所有分析视图
        for (const name of analysisViews) {
            const viewElement = document.getElementById(`view-${name}`);
            if (viewElement) {
                viewElement.style.display = 'none';
            }
        }
        
        // 显示选中的视图（如果是分析视图）
        if (analysisViews.includes(viewName)) {
            document.getElementById(`view-${viewName}`).style.display = 'block';
        }
        
        this.currentView = viewName;
    }
    
    /**
     * 更新所有视图
     */
    updateAllViews() {
        this.renderOriginal();
        if (this.generator.getAllGaussians().some(g => g.isPerturbed)) {
            this.renderPerturbed();
            this.renderDifference();
        }
        this.renderHeatmap();
    }
}
