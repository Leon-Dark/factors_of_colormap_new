/**
 * 主控制器
 * Main Controller
 * 
 * 整合所有模块并处理用户交互
 */

class GaussianPerturbationApp {
    constructor() {
        // 核心组件
        this.generator = null;
        this.perturbation = null;
        this.visualization = null;
        
        // 配置
        this.config = {
            canvasWidth: 600,
            canvasHeight: 600
        };
        
        // UI元素
        this.ui = {};
        
        // 状态
        this.state = {
            hasGenerated: false,
            hasPerturbation: false
        };
    }
    
    /**
     * 初始化应用
     */
    initialize() {
        console.log('Initializing Gaussian Perturbation System...');
        
        // 初始化核心组件
        this.generator = new GaussianGenerator(
            this.config.canvasWidth,
            this.config.canvasHeight
        );
        this.perturbation = new PerturbationSystem(this.generator);
        this.visualization = new MultiViewVisualization();
        this.visualization.initializeViews();
        this.visualization.setGenerator(this.generator);
        
        // 初始化UI
        this.initializeUI();
        this.bindEvents();
        
        console.log('System initialized successfully');
    }
    
    /**
     * 初始化UI元素引用
     */
    initializeUI() {
        // 尺寸级别控制
        const levels = ['small', 'medium-small', 'medium', 'medium-large', 'large'];
        this.ui.levels = {};
        
        for (const level of levels) {
            this.ui.levels[level] = {
                slider: document.getElementById(`level-${level}`),
                value: document.getElementById(`level-${level}-value`),
                countSlider: document.getElementById(`count-${level}`),
                countValue: document.getElementById(`count-${level}-value`)
            };
        }
        
        // 扰动控制
        this.ui.perturb = {
            magnitude: document.getElementById('perturb-magnitude'),
            magnitudeValue: document.getElementById('perturb-magnitude-value'),
            ratio: document.getElementById('perturb-ratio'),
            ratioValue: document.getElementById('perturb-ratio-value'),
            mode: document.getElementById('perturb-mode'),
            target: document.getElementById('perturb-target'),
            localRadius: document.getElementById('local-radius'),
            localRadiusValue: document.getElementById('local-radius-value'),
            localParams: document.getElementById('local-params')
        };
        
        // 按钮
        this.ui.buttons = {
            generate: document.getElementById('btn-generate'),
            applyPerturb: document.getElementById('btn-apply-perturb'),
            reset: document.getElementById('btn-reset'),
            export: document.getElementById('btn-export')
        };
        
        // 统计信息
        this.ui.stats = {
            totalGaussians: document.getElementById('stat-total-gaussians'),
            perturbedGaussians: document.getElementById('stat-perturbed-gaussians'),
            ssim: document.getElementById('stat-ssim')
        };
        
        // 视图标签
        this.ui.tabs = document.querySelectorAll('.tab-btn');
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 尺寸级别滑块
        for (const [level, elements] of Object.entries(this.ui.levels)) {
            elements.slider.addEventListener('input', (e) => {
                elements.value.textContent = e.target.value;
            });
            
            elements.countSlider.addEventListener('input', (e) => {
                elements.countValue.textContent = e.target.value;
            });
        }
        
        // 扰动参数滑块
        this.ui.perturb.magnitude.addEventListener('input', (e) => {
            this.ui.perturb.magnitudeValue.textContent = e.target.value;
        });
        
        this.ui.perturb.ratio.addEventListener('input', (e) => {
            const ratio = parseFloat(e.target.value);
            this.ui.perturb.ratioValue.textContent = `${Math.round(ratio * 100)}%`;
        });
        
        this.ui.perturb.localRadius.addEventListener('input', (e) => {
            this.ui.perturb.localRadiusValue.textContent = e.target.value;
        });
        
        // 扰动模式切换
        this.ui.perturb.mode.addEventListener('change', (e) => {
            if (e.target.value === 'local') {
                this.ui.perturb.localParams.style.display = 'block';
            } else {
                this.ui.perturb.localParams.style.display = 'none';
            }
        });
        
        // 按钮事件
        this.ui.buttons.generate.addEventListener('click', () => this.handleGenerate());
        this.ui.buttons.applyPerturb.addEventListener('click', () => this.handleApplyPerturbation());
        this.ui.buttons.reset.addEventListener('click', () => this.handleReset());
        this.ui.buttons.export.addEventListener('click', () => this.handleExport());
        
        // 视图标签切换
        this.ui.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.ui.tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                const view = e.target.getAttribute('data-view');
                this.visualization.switchView(view);
            });
        });
        
        // Canvas点击事件（显示高斯信息）
        const canvases = [
            'canvas-original', 'canvas-perturbed', 
            'canvas-difference', 'canvas-heatmap'
        ];
        
        for (const canvasId of canvases) {
            const canvas = document.getElementById(canvasId);
            canvas.addEventListener('click', (e) => this.handleCanvasClick(e, canvas));
        }
    }
    
    /**
     * 处理生成按钮
     */
    handleGenerate() {
        console.log('Generating Gaussians...');
        this.ui.buttons.generate.classList.add('loading');
        
        // 更新生成器配置
        for (const [level, elements] of Object.entries(this.ui.levels)) {
            const sigma = parseInt(elements.slider.value);
            const count = parseInt(elements.countSlider.value);
            this.generator.updateSizeLevel(level, sigma, count);
        }
        
        // 生成高斯
        setTimeout(() => {
            this.generator.generateAll();
            this.state.hasGenerated = true;
            this.state.hasPerturbation = false;
            
            // 更新可视化
            this.visualization.renderOriginal();
            this.visualization.renderHeatmap();
            
            // 更新统计
            this.updateStatistics();
            
            this.ui.buttons.generate.classList.remove('loading');
            console.log('Generation complete');
        }, 100);
    }
    
    /**
     * 处理应用扰动
     */
    handleApplyPerturbation() {
        if (!this.state.hasGenerated) {
            alert('请先生成高斯分布！');
            return;
        }
        
        console.log('Applying perturbation...');
        this.ui.buttons.applyPerturb.classList.add('loading');
        
        const magnitude = parseFloat(this.ui.perturb.magnitude.value);
        const ratio = parseFloat(this.ui.perturb.ratio.value);
        const mode = this.ui.perturb.mode.value;
        const target = this.ui.perturb.target.value;
        
        setTimeout(() => {
            if (mode === 'global') {
                this.perturbation.applyGlobalPerturbation(
                    magnitude, ratio, target, 'all'
                );
            } else {
                // 局部扰动 - 在中心点应用
                const radius = parseInt(this.ui.perturb.localRadius.value);
                const centerX = this.config.canvasWidth / 2;
                const centerY = this.config.canvasHeight / 2;
                
                this.perturbation.applyLocalPerturbation(
                    centerX, centerY, radius, magnitude, ratio, target, 'all'
                );
            }
            
            this.state.hasPerturbation = true;
            
            // 更新可视化
            this.visualization.updateAllViews();
            
            // 更新统计
            this.updateStatistics();
            
            this.ui.buttons.applyPerturb.classList.remove('loading');
            console.log('Perturbation applied');
        }, 100);
    }
    
    /**
     * 处理重置
     */
    handleReset() {
        if (!this.state.hasGenerated) {
            return;
        }
        
        console.log('Resetting perturbations...');
        
        this.perturbation.resetAllPerturbations();
        this.state.hasPerturbation = false;
        
        // 更新可视化
        this.visualization.renderOriginal();
        this.visualization.renderPerturbed();
        this.visualization.renderHeatmap();
        
        // 更新统计
        this.updateStatistics();
        
        console.log('Reset complete');
    }
    
    /**
     * 处理导出
     */
    handleExport() {
        if (!this.state.hasGenerated) {
            alert('请先生成高斯分布！');
            return;
        }
        
        const exportData = {
            timestamp: new Date().toISOString(),
            config: this.generator.exportConfig(),
            perturbation: this.state.hasPerturbation 
                ? this.perturbation.exportPerturbationData() 
                : null,
            statistics: this.perturbation.getStatistics()
        };
        
        const filename = `gaussian_perturbation_${Date.now()}.json`;
        exportToJSON(exportData, filename);
        
        console.log('Data exported:', filename);
    }
    
    /**
     * 处理Canvas点击
     */
    handleCanvasClick(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 查找最近的高斯
        const nearest = this.generator.findNearestGaussian(x, y, 50);
        
        if (nearest) {
            this.displayGaussianInfo(nearest);
        } else {
            document.getElementById('gaussian-details').innerHTML = 
                '点击画布中的高斯以查看详细信息...';
        }
    }
    
    /**
     * 显示高斯信息
     */
    displayGaussianInfo(gauss) {
        const info = {
            id: gauss.id || 'N/A',
            center: { x: gauss.mX.toFixed(2), y: gauss.mY.toFixed(2) },
            sigma: { x: gauss.sX.toFixed(2), y: gauss.sY.toFixed(2) },
            rho: gauss.rho.toFixed(3),
            scaler: gauss.scaler.toFixed(3),
            sizeLevel: gauss.sizeLevel || 'unknown',
            isPerturbed: gauss.isPerturbed || false,
            avgSigma: ((gauss.sX + gauss.sY) / 2).toFixed(2)
        };
        
        const html = `
            <div style="font-family: monospace;">
                <h4 style="color: ${gauss.color}; margin-bottom: 10px;">
                    ${info.sizeLevel.toUpperCase()} 高斯
                    ${info.isPerturbed ? '<span style="color: red;">(已扰动)</span>' : ''}
                </h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px;"><strong>ID:</strong></td>
                        <td style="padding: 5px;">${info.id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>中心位置:</strong></td>
                        <td style="padding: 5px;">(${info.center.x}, ${info.center.y})</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>标准差 X:</strong></td>
                        <td style="padding: 5px;">${info.sigma.x}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>标准差 Y:</strong></td>
                        <td style="padding: 5px;">${info.sigma.y}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>平均尺寸:</strong></td>
                        <td style="padding: 5px;">${info.avgSigma}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>相关系数:</strong></td>
                        <td style="padding: 5px;">${info.rho}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>幅值:</strong></td>
                        <td style="padding: 5px;">${info.scaler}</td>
                    </tr>
                </table>
            </div>
        `;
        
        document.getElementById('gaussian-details').innerHTML = html;
    }
    
    /**
     * 更新统计信息
     */
    updateStatistics() {
        const stats = this.perturbation.getStatistics();
        
        this.ui.stats.totalGaussians.textContent = stats.perturbedGaussians + 
            (this.generator.getAllGaussians().length - stats.perturbedGaussians);
        this.ui.stats.perturbedGaussians.textContent = stats.perturbedGaussians;
        
        // SSIM已在差异视图中更新
    }
}

// 应用初始化
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new GaussianPerturbationApp();
    app.initialize();
    
    console.log('Gaussian Perturbation Visualization System Ready!');
    console.log('请点击"生成新分布"按钮开始。');
});
