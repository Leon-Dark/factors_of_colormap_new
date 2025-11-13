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
            canvasWidth: 200,
            canvasHeight: 200
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
        
        // 设置默认视图（差异图）
        this.visualization.switchView('difference');
        
        console.log('System initialized successfully');
    }
    
    /**
     * 初始化UI元素引用
     */
    initializeUI() {
        // 高斯级别控制 - 控制数量和sigma
        const levels = ['small', 'medium', 'large'];
        this.ui.levels = {};
        
        for (const level of levels) {
            this.ui.levels[level] = {
                countSlider: document.getElementById(`count-${level}`),
                countValue: document.getElementById(`count-${level}-value`),
                sigmaSlider: document.getElementById(`sigma-${level}`),
                sigmaValue: document.getElementById(`sigma-${level}-value`)
            };
        }
        
        // 扰动控制
        this.ui.perturb = {
            magnitude: document.getElementById('perturb-magnitude'),
            magnitudeValue: document.getElementById('perturb-magnitude-value'),
            ratio: document.getElementById('perturb-ratio'),
            ratioValue: document.getElementById('perturb-ratio-value'),
            mode: document.getElementById('perturb-mode'),
            targetCheckboxes: {
                small: document.getElementById('target-small'),
                medium: document.getElementById('target-medium'),
                large: document.getElementById('target-large')
            },
            typeCheckboxes: {
                position: document.getElementById('type-position'),
                stretch: document.getElementById('type-stretch'),
                rotation: document.getElementById('type-rotation'),
                amplitude: document.getElementById('type-amplitude')
            },
            localCount: document.getElementById('local-count'),
            localCountValue: document.getElementById('local-count-value'),
            localParams: document.getElementById('local-params')
        };
        
        // 按钮
        this.ui.buttons = {
            generate: document.getElementById('btn-generate'),
            applyPerturb: document.getElementById('btn-apply-perturb')
        };
        
        // 统计信息
        this.ui.stats = {
            totalGaussians: document.getElementById('stat-total-gaussians'),
            perturbedGaussians: document.getElementById('stat-perturbed-gaussians'),
            ssim: document.getElementById('stat-ssim')
        };
        
        // 视图标签
        this.ui.tabs = document.querySelectorAll('.tab-btn');
        
        // Colormap 选择器
        this.ui.colormapSelect = document.getElementById('colormap-select');
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 数量和sigma滑块和输入框双向绑定
        for (const [level, elements] of Object.entries(this.ui.levels)) {
            // 数量滑块改变 -> 更新输入框
            elements.countSlider.addEventListener('input', (e) => {
                elements.countValue.value = e.target.value;
            });
            
            // 数量输入框改变 -> 更新滑块
            elements.countValue.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    elements.countSlider.value = value;
                }
            });
            
            // sigma滑块改变 -> 更新输入框
            elements.sigmaSlider.addEventListener('input', (e) => {
                elements.sigmaValue.value = e.target.value;
            });
            
            // sigma输入框改变 -> 更新滑块
            elements.sigmaValue.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    elements.sigmaSlider.value = value;
                }
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
        
        this.ui.perturb.localCount.addEventListener('input', (e) => {
            this.ui.perturb.localCountValue.textContent = e.target.value;
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
        
        // 视图标签切换
        this.ui.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.ui.tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                const view = e.target.getAttribute('data-view');
                this.visualization.switchView(view);
            });
        });
        
        // 显示中心点开关
        document.getElementById('show-centers').addEventListener('change', (e) => {
            this.handleToggleCenters(e.target.checked);
        });
        
        // Colormap 选择器
        this.ui.colormapSelect.addEventListener('change', (e) => {
            this.handleColormapChange(e.target.value);
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
        
        // 更新生成器配置（sigma和count均可调）
        for (const [level, elements] of Object.entries(this.ui.levels)) {
            const sigma = parseFloat(elements.sigmaValue.value);
            const count = parseInt(elements.countValue.value);
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
            alert('请先生成高斯分布！ / Please generate Gaussian distribution first!');
            return;
        }
        
        console.log('Applying perturbation...');
        this.ui.buttons.applyPerturb.classList.add('loading');
        
        const magnitude = parseFloat(this.ui.perturb.magnitude.value);
        const ratio = parseFloat(this.ui.perturb.ratio.value);
        const mode = this.ui.perturb.mode.value;
        
        // 获取选中的扰动目标
        const targets = [];
        if (this.ui.perturb.targetCheckboxes.small.checked) targets.push('small');
        if (this.ui.perturb.targetCheckboxes.medium.checked) targets.push('medium');
        if (this.ui.perturb.targetCheckboxes.large.checked) targets.push('large');
        
        // 获取选中的扰动类型
        const perturbTypes = [];
        if (this.ui.perturb.typeCheckboxes.position.checked) perturbTypes.push('position');
        if (this.ui.perturb.typeCheckboxes.stretch.checked) perturbTypes.push('stretch');
        if (this.ui.perturb.typeCheckboxes.rotation.checked) perturbTypes.push('rotation');
        if (this.ui.perturb.typeCheckboxes.amplitude.checked) perturbTypes.push('amplitude');
        
        // 验证是否有选择
        if (targets.length === 0) {
            alert('请至少选择一个扰动目标！ / Please select at least one perturbation target!');
            return;
        }
        if (perturbTypes.length === 0) {
            alert('请至少选择一个扰动类型！ / Please select at least one perturbation type!');
            return;
        }
        
        setTimeout(() => {
            // 每次扰动前先重置到原始状态
            this.perturbation.resetToOriginal();
            
            if (mode === 'global') {
                this.perturbation.applyGlobalPerturbation(
                    magnitude, ratio, targets, perturbTypes
                );
            } else {
                // 局部扰动 - 自动选择最紧密的m个高斯
                const targetCount = parseInt(this.ui.perturb.localCount.value);
                
                this.perturbation.applyLocalPerturbation(
                    targetCount, magnitude, ratio, targets, perturbTypes
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
     * 处理显示中心点开关
     */
    handleToggleCenters(show) {
        // 更新所有视图的显示选项
        this.visualization.views.original.options.showGaussianCenters = show;
        this.visualization.views.perturbed.options.showGaussianCenters = show;
        this.visualization.views.heatmap.options.showGaussianCenters = show;
        
        // 重新渲染当前视图
        if (this.state.hasGenerated) {
            this.visualization.updateAllViews();
        }
    }
    
    /**
     * 处理 colormap 变化
     */
    handleColormapChange(colormap) {
        console.log('Changing colormap to:', colormap);
        
        // 设置全局 colormap
        this.visualization.setColormap(colormap);
        
        // 如果已经生成了数据，重新渲染所有视图
        if (this.state.hasGenerated) {
            this.visualization.updateAllViews();
        }
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
                'Click on a Gaussian to view details... / 点击画布中的高斯以查看详细信息...';
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
                    ${info.sizeLevel.toUpperCase()} Gaussian / 高斯
                    ${info.isPerturbed ? '<span style="color: red;">(Perturbed / 已扰动)</span>' : ''}
                </h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px;"><strong>ID:</strong></td>
                        <td style="padding: 5px;">${info.id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>Center / 中心位置:</strong></td>
                        <td style="padding: 5px;">(${info.center.x}, ${info.center.y})</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>Sigma X / 标准差 X:</strong></td>
                        <td style="padding: 5px;">${info.sigma.x}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>Sigma Y / 标准差 Y:</strong></td>
                        <td style="padding: 5px;">${info.sigma.y}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>Avg Size / 平均尺寸:</strong></td>
                        <td style="padding: 5px;">${info.avgSigma}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>Correlation / 相关系数:</strong></td>
                        <td style="padding: 5px;">${info.rho}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px;"><strong>Amplitude / 幅值:</strong></td>
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
    console.log('请点击"生成新分布"按钮开始。 / Click "Generate" button to start.');
});
