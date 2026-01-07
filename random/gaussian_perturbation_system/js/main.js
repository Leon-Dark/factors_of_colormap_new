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
        this.softAttribution = null;
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
            hasPerturbation: false,
            useSoftAttribution: true,
            softAttributionData: null
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
        this.softAttribution = new SoftAttributionPerturbation(this.generator);
        this.visualization = new MultiViewVisualization();
        this.visualization.initializeViews();
        this.visualization.setGenerator(this.generator);

        // 初始化UI
        this.initializeUI();
        this.bindEvents();

        // 设置默认视图（差异图）
        this.visualization.switchView('difference');

        // 初始化总数量显示
        this.updateTotalCount();

        console.log('System initialized successfully - Random placement mode');
    }

    /**
     * 初始化UI元素引用
     */
    initializeUI() {
        // 高斯级别控制 - 包含数量和sigma
        const levels = ['small', 'medium', 'large'];
        this.ui.levels = {};

        for (const level of levels) {
            const levelKey = level === 'small' ? 'high' : level === 'medium' ? 'mid' : 'low';
            this.ui.levels[level] = {
                countSlider: document.getElementById(`count-${levelKey}`),
                countValue: document.getElementById(`count-${levelKey}-value`),
                sigmaSlider: document.getElementById(`sigma-${level}`),
                sigmaValue: document.getElementById(`sigma-${level}-value`)
            };
        }

        // 总数量显示
        this.ui.totalCount = document.getElementById('total-count');
        this.ui.totalCountEn = document.getElementById('total-count-en');

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
            localCount: document.getElementById('local-count'),
            localCountValue: document.getElementById('local-count-value'),
            localParams: document.getElementById('local-params'),
            coefficients: {
                position: document.getElementById('coeff-position'),
                positionValue: document.getElementById('coeff-position-value'),
                stretch: document.getElementById('coeff-stretch'),
                stretchValue: document.getElementById('coeff-stretch-value'),
                rotation: document.getElementById('coeff-rotation'),
                rotationValue: document.getElementById('coeff-rotation-value'),
                amplitude: document.getElementById('coeff-amplitude'),
                amplitudeValue: document.getElementById('coeff-amplitude-value')
            }
        };
        // Exponent control
        this.ui.exponent = {
            slider: document.getElementById('exponent-slider'),
            value: document.getElementById('exponent-value')
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

        // 软归因门控参数
        this.ui.softAttribution = {
            enable: document.getElementById('use-soft-attribution'),
            params: document.getElementById('soft-attribution-params'),
            sigmaE: document.getElementById('sigma-e'),
            sigmaEValue: document.getElementById('sigma-e-value'),
            tauLow: document.getElementById('tau-low'),
            tauLowValue: document.getElementById('tau-low-value'),
            tauHigh: document.getElementById('tau-high'),
            tauHighValue: document.getElementById('tau-high-value'),
            sigmaM: document.getElementById('sigma-m'),
            sigmaMValue: document.getElementById('sigma-m-value'),
            lambdaLow: document.getElementById('lambda-low'),
            lambdaLowValue: document.getElementById('lambda-low-value'),
            lambdaMid: document.getElementById('lambda-mid'),
            lambdaMidValue: document.getElementById('lambda-mid-value'),
            lambdaHigh: document.getElementById('lambda-high'),
            lambdaHighValue: document.getElementById('lambda-high-value')
        };

        // 归因权重和门控视图的频段选择
        this.ui.attributionBandRadios = document.querySelectorAll('input[name="attribution-band"]');
        this.ui.gatingBandRadios = document.querySelectorAll('input[name="gating-band"]');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 数量和sigma滑块双向绑定
        for (const [level, elements] of Object.entries(this.ui.levels)) {
            // 数量滑块改变 -> 更新输入框和总数
            elements.countSlider.addEventListener('input', (e) => {
                elements.countValue.value = e.target.value;
                this.updateTotalCount();
            });

            // 数量输入框改变 -> 更新滑块和总数
            elements.countValue.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    elements.countSlider.value = value;
                    this.updateTotalCount();
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

        // 扰动系数滑块
        const coeffs = this.ui.perturb.coefficients;

        coeffs.position.addEventListener('input', (e) => {
            coeffs.positionValue.textContent = parseFloat(e.target.value).toFixed(1);
            this.updatePerturbationCoefficients();
        });

        coeffs.stretch.addEventListener('input', (e) => {
            coeffs.stretchValue.textContent = parseFloat(e.target.value).toFixed(1);
            this.updatePerturbationCoefficients();
        });

        coeffs.rotation.addEventListener('input', (e) => {
            coeffs.rotationValue.textContent = parseFloat(e.target.value).toFixed(1);
            this.updatePerturbationCoefficients();
        });

        coeffs.amplitude.addEventListener('input', (e) => {
            coeffs.amplitudeValue.textContent = parseFloat(e.target.value).toFixed(1);
            this.updatePerturbationCoefficients();
        });

        // 扰动模式切换
        this.ui.perturb.mode.addEventListener('change', (e) => {
            if (e.target.value === 'local') {
                this.ui.perturb.localParams.style.display = 'block';
            } else {
                this.ui.perturb.localParams.style.display = 'none';
            }
        });

        // Exponent slider
        this.ui.exponent.slider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.ui.exponent.value.value = val;

            // Update generator and re-render immediately
            const exponent = parseFloat(val);
            if (!isNaN(exponent)) {
                this.generator.setExponent(exponent);
                if (this.state.hasGenerated) {
                    this.visualization.updateAllViews();
                }
            }
        });

        this.ui.exponent.value.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                this.ui.exponent.slider.value = value;

                // Update generator and re-render immediately
                this.generator.setExponent(value);
                if (this.state.hasGenerated) {
                    this.visualization.updateAllViews();
                }
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

        // 显示网格线开关
        document.getElementById('show-grid').addEventListener('change', (e) => {
            this.handleToggleGrid(e.target.checked);
        });

        // 梯度归一化开关
        /*
        document.getElementById('use-gradient-norm').addEventListener('change', (e) => {
            this.handleToggleGradientNorm(e.target.checked);
        });
        */

        // Colormap 选择器
        this.ui.colormapSelect.addEventListener('change', (e) => {
            this.handleColormapChange(e.target.value);
        });

        // 软归因门控开关
        this.ui.softAttribution.enable.addEventListener('change', (e) => {
            this.handleToggleSoftAttribution(e.target.checked);
        });

        // 软归因门控参数滑块
        const saParams = this.ui.softAttribution;

        saParams.sigmaE.addEventListener('input', (e) => {
            saParams.sigmaEValue.textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSoftAttributionParams();
        });

        saParams.tauLow.addEventListener('input', (e) => {
            saParams.tauLowValue.textContent = parseFloat(e.target.value).toFixed(2);
            this.updateSoftAttributionParams();
        });

        saParams.tauHigh.addEventListener('input', (e) => {
            saParams.tauHighValue.textContent = parseFloat(e.target.value).toFixed(2);
            this.updateSoftAttributionParams();
        });

        saParams.sigmaM.addEventListener('input', (e) => {
            saParams.sigmaMValue.textContent = e.target.value;
            this.updateSoftAttributionParams();
        });

        saParams.lambdaLow.addEventListener('input', (e) => {
            saParams.lambdaLowValue.textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSoftAttributionParams();
        });

        saParams.lambdaMid.addEventListener('input', (e) => {
            saParams.lambdaMidValue.textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSoftAttributionParams();
        });

        saParams.lambdaHigh.addEventListener('input', (e) => {
            saParams.lambdaHighValue.textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSoftAttributionParams();
        });

        // 归因权重和门控视图的频段选择
        this.ui.attributionBandRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.state.softAttributionData) {
                    this.renderAttributionView();
                }
            });
        });

        this.ui.gatingBandRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.state.softAttributionData) {
                    this.renderGatingView();
                }
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
     * 更新总数量显示
     */
    updateTotalCount() {
        let total = 0;
        for (const [level, elements] of Object.entries(this.ui.levels)) {
            const count = parseInt(elements.countValue.value) || 0;
            total += count;
        }

        if (this.ui.totalCount) {
            this.ui.totalCount.textContent = total;
        }
        if (this.ui.totalCountEn) {
            this.ui.totalCountEn.textContent = total;
        }
    }

    /**
     * 处理生成按钮
     */
    handleGenerate() {
        console.log('Generating Gaussians randomly...');
        this.ui.buttons.generate.classList.add('loading');

        // 更新参数
        for (const [level, elements] of Object.entries(this.ui.levels)) {
            const count = parseInt(elements.countValue.value);
            const sigma = parseFloat(elements.sigmaValue.value);

            this.generator.sizeLevels[level].count = count;
            this.generator.sizeLevels[level].sigma = sigma;
        }

        // Set exponent
        const exponent = parseFloat(this.ui.exponent.value.value);
        this.generator.setExponent(exponent);

        // 生成高斯（随机模式）
        setTimeout(() => {
            this.generator.generateAll();
            this.state.hasGenerated = true;
            this.state.hasPerturbation = false;

            // 更新可视化
            this.visualization.renderOriginal();
            this.visualization.renderHeatmap();

            // 更新统计
            this.updateStatistics();

            const totalCount = this.generator.getAllGaussians().length;
            this.ui.buttons.generate.classList.remove('loading');
            console.log(`Generation complete - ${totalCount} Gaussians randomly distributed`);
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

            // 如果启用软归因门控，应用门控扰动
            if (this.state.useSoftAttribution) {
                this.applySoftAttributionPerturbation();
            } else {
                // 否则使用传统方法更新可视化
                this.visualization.updateAllViews();
            }

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
     * 处理显示网格线开关
     */
    handleToggleGrid(show) {
        // 更新所有视图的显示选项
        this.visualization.views.original.options.showGridLines = show;
        this.visualization.views.perturbed.options.showGridLines = show;
        this.visualization.views.heatmap.options.showGridLines = show;
        this.visualization.views.difference.options.showGridLines = show;

        // 重新渲染当前视图
        if (this.state.hasGenerated) {
            this.visualization.updateAllViews();
        }
    }

    /**
     * 处理梯度归一化开关
     */
    /*
    handleToggleGradientNorm(useGradientNorm) {
        console.log('Toggle gradient normalization:', useGradientNorm);
        
        // 更新所有视图的梯度归一化选项
        this.visualization.views.original.options.useGradientNormalization = useGradientNorm;
        this.visualization.views.perturbed.options.useGradientNormalization = useGradientNorm;
        this.visualization.views.heatmap.options.useGradientNormalization = useGradientNorm;
        this.visualization.views.difference.options.useGradientNormalization = useGradientNorm;
        
        // 如果已经生成了数据，重新渲染所有视图
        if (this.state.hasGenerated) {
            this.visualization.updateAllViews();
        }
    }
    */

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

    /**
     * 处理软归因门控开关
     */
    handleToggleSoftAttribution(enabled) {
        this.state.useSoftAttribution = enabled;
        this.ui.softAttribution.params.style.display = enabled ? 'block' : 'none';
        console.log('Soft attribution gating:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * 更新软归因门控参数
     */
    updateSoftAttributionParams() {
        if (!this.state.useSoftAttribution) return;

        const params = {
            sigma_E: parseFloat(this.ui.softAttribution.sigmaE.value),
            tau_low: parseFloat(this.ui.softAttribution.tauLow.value),
            tau_high: parseFloat(this.ui.softAttribution.tauHigh.value),
            sigma_m: parseFloat(this.ui.softAttribution.sigmaM.value),
            lambda: {
                low: parseFloat(this.ui.softAttribution.lambdaLow.value),
                mid: parseFloat(this.ui.softAttribution.lambdaMid.value),
                high: parseFloat(this.ui.softAttribution.lambdaHigh.value)
            }
        };

        this.softAttribution.setParams(params);
        console.log('Soft attribution params updated:', params);

        // 如果已经应用了扰动，重新计算
        if (this.state.hasPerturbation) {
            this.applySoftAttributionPerturbation();
        }
    }

    /**
     * 应用软归因门控扰动
     */
    applySoftAttributionPerturbation() {
        if (!this.state.useSoftAttribution || !this.state.hasPerturbation) return;

        console.log('Applying soft attribution gated perturbation...');

        const result = this.softAttribution.performGatedPerturbation(
            this.config.canvasWidth,
            this.config.canvasHeight
        );

        this.state.softAttributionData = result;

        // 更新扰动后的视图
        this.visualization.renderPerturbedWithData(result.perturbedTotal);
        this.visualization.updateDifferenceView();

        // 关键修复：如果你正盯着归因权重或门控Mask看，它们也应该实时更新！
        // Critical fix: update Attribution/Gating views if they are currently active
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const viewType = activeTab.getAttribute('data-view');
            if (viewType === 'attribution') {
                this.renderAttributionView();
            } else if (viewType === 'gating') {
                this.renderGatingView();
            }
        }

        console.log('Soft attribution gating applied successfully');
    }

    /**
     * 渲染归因权重视图
     */
    renderAttributionView() {
        if (!this.state.softAttributionData) return;

        const selectedBand = document.querySelector('input[name="attribution-band"]:checked').value;
        const weights = this.state.softAttributionData.attributionWeights[selectedBand];

        const canvas = document.getElementById('canvas-attribution');
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const pixels = imageData.data;

        for (let i = 0; i < weights.length; i++) {
            const value = weights[i];
            const color = valueToColor(value, 'viridis');

            const pixelIndex = i * 4;
            pixels[pixelIndex] = color[0];
            pixels[pixelIndex + 1] = color[1];
            pixels[pixelIndex + 2] = color[2];
            pixels[pixelIndex + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);

        document.getElementById('info-attribution').textContent =
            `${selectedBand.toUpperCase()} 频段归因权重 / ${selectedBand.toUpperCase()} band attribution`;
    }

    /**
     * 渲染门控mask视图
     */
    renderGatingView() {
        if (!this.state.softAttributionData) return;

        const selectedBand = document.querySelector('input[name="gating-band"]:checked').value;
        const mask = this.state.softAttributionData.gatingMasks[selectedBand];

        const canvas = document.getElementById('canvas-gating');
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const pixels = imageData.data;

        for (let i = 0; i < mask.length; i++) {
            const value = mask[i];
            const color = valueToColor(value, 'magma');

            const pixelIndex = i * 4;
            pixels[pixelIndex] = color[0];
            pixels[pixelIndex + 1] = color[1];
            pixels[pixelIndex + 2] = color[2];
            pixels[pixelIndex + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);

        document.getElementById('info-gating').textContent =
            `${selectedBand.toUpperCase()} 频段门控Mask / ${selectedBand.toUpperCase()} band gating mask`;
    }

    /**
     * 更新扰动系数
     */
    updatePerturbationCoefficients() {
        const coeffs = this.ui.perturb.coefficients;
        const newCoeffs = {
            position: parseFloat(coeffs.position.value),
            stretch: parseFloat(coeffs.stretch.value),
            rotation: parseFloat(coeffs.rotation.value),
            amplitude: parseFloat(coeffs.amplitude.value)
        };

        this.perturbation.setCoefficients(newCoeffs);
        console.log('Perturbation coefficients updated:', newCoeffs);

        // 如果已经应用了扰动，可以考虑重新应用(但可能有点重)，暂时不自动重新应用以免卡顿
        // 但如果用户想实时看效果，可以在这里调用 handleApplyPerturbation
        // 为了性能，只在拖拽结束时更新最好，但input事件比较平滑
        // 考虑到性能，这里暂不自动重绘，等待用户点击Apply
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
