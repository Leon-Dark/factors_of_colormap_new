/**
 * 刺激图展示长廊控制器
 * Stimuli Gallery Controller
 */

class StimuliGallery {
    constructor() {
        this.config = {
            width: 200,  // 略微缩小尺寸以适应网格
            height: 200
        };

        this.container = document.getElementById('gallery-content');
        this.btnStart = document.getElementById('btn-start');
        this.loadingText = document.getElementById('loading');

        // 只用于生成的临时生成器
        this.generator = new GaussianGenerator(this.config.width, this.config.height);
        this.perturbation = new PerturbationSystem(this.generator);
        this.softAttribution = new SoftAttributionPerturbation(this.generator);

        this.coefficients = {
            position: 1,     // Enhanced position perturbation
            stretch: 0.0,      // Removed as planned
            rotation: 1,     // Slightly reduced rotation
            amplitude: 1     // Reduced amplitude 
        };

        this.bindEvents();
    }

    bindEvents() {
        this.btnStart.addEventListener('click', () => this.generateGallery());

        // Mode Switch
        const modeSelect = document.getElementById('generation-mode');
        const groups = {
            'magnitude': document.getElementById('input-group-magnitude'),
            'ssim': document.getElementById('input-group-ssim')
        };

        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                const mode = e.target.value;
                Object.keys(groups).forEach(k => {
                    if (groups[k]) groups[k].style.display = (k === mode) ? 'block' : 'none';
                });
            });

            // Trigger initial state
            modeSelect.dispatchEvent(new Event('change'));
        }

        // Coefficient Sliders
        const updateCoeff = (id, key) => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(id + '-value');
            if (slider && valueSpan) {
                slider.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    valueSpan.textContent = val.toFixed(1);
                    this.coefficients[key] = val;
                });
            }
        };

        updateCoeff('coeff-position', 'position');
        updateCoeff('coeff-stretch', 'stretch');
        updateCoeff('coeff-rotation', 'rotation');
        updateCoeff('coeff-amplitude', 'amplitude');

        // Mixing Parameter Sliders
        const updateMixParam = (id) => {
            const slider = document.getElementById(id);
            const numberInput = document.getElementById(id + '-value');

            if (slider && numberInput) {
                // Slider -> Number Input
                slider.addEventListener('input', (e) => {
                    numberInput.value = e.target.value;
                });

                // Number Input -> Slider
                numberInput.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                        slider.value = val;
                    }
                });
            }
        };

        updateMixParam('weight-high');
        updateMixParam('weight-mid');
        updateMixParam('weight-low');
        updateMixParam('exponent-slider');
    }

    async generateGallery() {
        this.btnStart.disabled = true;
        this.loadingText.style.display = 'block';
        this.container.innerHTML = '';

        // 使用setTimeout让UI有机会更新
        setTimeout(async () => {
            const frequencies = [
                { id: 'low', name: 'Low Complexity', target: 'large' },
                { id: 'medium', name: 'Medium Complexity', target: 'medium' },
                { id: 'high', name: 'High Complexity', target: 'small' }
            ];

            const mode = document.getElementById('generation-mode').value;
            let targets = [];
            let step = 0.01;  // 默认步进值

            if (mode === 'magnitude') {
                const input = document.getElementById('magnitudes-input').value;
                targets = input.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
            } else if (mode === 'ssim') {
                // Range generation for SSIM
                const start = parseFloat(document.getElementById('ssim-start').value);
                const end = parseFloat(document.getElementById('ssim-end').value);
                step = Math.abs(parseFloat(document.getElementById('ssim-step').value));

                if (!isNaN(start) && !isNaN(end) && !isNaN(step) && step > 0) {
                    // Determine direction
                    if (start <= end) {
                        for (let v = start; v <= end + 0.000001; v += step) targets.push(v);
                    } else {
                        for (let v = start; v >= end - 0.000001; v -= step) targets.push(v);
                    }

                    // Round to prevent float precision ugly labels (5 decimal places)
                    targets = targets.map(v => parseFloat(v.toFixed(5)));
                }
            }

            if (targets.length === 0) {
                alert('Please enter valid range or values!');
                this.btnStart.disabled = false;
                this.loadingText.style.display = 'none';
                return;
            }
            
            // Get repetitions from input
            const repetitions = parseInt(document.getElementById('repetitions').value) || 1;

            for (const freq of frequencies) {
                const section = document.createElement('div');
                section.className = 'section-frequency';

                // 头部颜色
                let headerClass = '';
                if (freq.id === 'low') headerClass = 'header-low';
                else if (freq.id === 'medium') headerClass = 'header-medium';
                else headerClass = 'header-high';

                section.innerHTML = `
                    <div class="section-header ${headerClass}">${freq.name} (${mode.toUpperCase()} Profile)</div>
                    <div class="stimuli-grid" id="grid-${freq.id}"></div>
                `;
                this.container.appendChild(section);

                const grid = section.querySelector(`#grid-${freq.id}`);

                for (const targetVal of targets) {
                    for (let rep = 1; rep <= repetitions; rep++) {
                        await this.createStimulusCard(grid, freq, targetVal, rep, mode, step);
                    }
                }
            }

            this.btnStart.disabled = false;
            this.loadingText.style.display = 'none';
        }, 100);
    }

    /**
     * Finds the magnitude that produces a result closest to the target metric.
     * Binary search approach + Random Sampling.
     */
    async optimizeMagnitudeForTarget(targetVal, mode, freqTarget) {
        // If mode is magnitude, just return it
        if (mode === 'magnitude') return { magnitude: targetVal, metric: 0 };

        let minMag = 0.0;
        let maxMag = 3.0; // Assume 2.0 is usually enough to destroy structure
        let bestMag = 0.5;
        let bestDiff = Infinity;
        let bestResult = null;

        // Search iterations
        const iterations = 8;

        for (let i = 0; i < iterations; i++) {
            const currentMag = (minMag + maxMag) / 2;

            // Try generating with this mag
            this.perturbation.resetToOriginal();
            this.perturbation.setCoefficients(this.coefficients);
            this.perturbation.applyGlobalPerturbation(currentMag, 1.0, freqTarget, 'all');

            const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
            // Measure metric
            // We need original array first? efficient way:
            // Actually optimizeMagnitude should be called after original is generated once in createStimulusCard
            // To make this method standalone is hard. 
            // Let's integrate this loop inside createStimulusCard instead.
        }
        return { magnitude: bestMag };
    }

    async createStimulusCard(container, freq, targetVal, repetition, mode, step = 0.01) {
        return new Promise(resolve => {
            // 1. 设置生成器参数
            // 4个低频，3个中频，2个高频
            this.generator.updateDimensions(this.config.width, this.config.height);
            this.generator.sizeLevels = {
                'small': { sigma: 15, count: 2, color: '#377eb8' },   // 尺寸按比例缩小 (原15 -> 7.5)
                'medium': { sigma: 25, count: 3, color: '#4daf4a' }, // (原25 -> 12.5)
                'large': { sigma: 50, count: 4, color: '#ff7f00' }     // (原50 -> 25)
            };
            // 注意：因为画布从200x200缩小到了100x100，所以sigma也应该减半，
            // 但如果用户想要保持视觉上的相对比例，我们需要调整sigma。
            // 这里为了展示清晰，我们使用缩小版的参数

            // 重新生成
            this.generator.setBandWeight('small', parseFloat(document.getElementById('weight-high-value').value));
            this.generator.setBandWeight('medium', parseFloat(document.getElementById('weight-mid-value').value));
            this.generator.setBandWeight('large', parseFloat(document.getElementById('weight-low-value').value));
            this.generator.setExponent(parseFloat(document.getElementById('exponent-slider-value').value));

            this.generator.generateAll();

            // 2. 渲染原始图像
            const dataOriginal = this.generator.renderTo1DArray(this.config.width, this.config.height, false, true); // 使用梯度归一化? 暂时保留默认

            // 3. 寻找最佳 Magnitude (Optimization Loop)
            let chosenMagnitude = targetVal;
            let achievedMetric = 0;
            let achievedKL = 0;
            let achievedSSIM = 0;

            let dataPerturbed = null;

            if (mode === 'magnitude') {
                // Direct application
                this.perturbation.resetToOriginal();
                this.perturbation.setCoefficients(this.coefficients);
                this.perturbation.applyGlobalPerturbation(targetVal, 1.0, freq.target, 'all');

                const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
                dataPerturbed = saResult.perturbedTotal;

                achievedSSIM = calculateSSIM(dataOriginal, dataPerturbed, this.config.width, this.config.height);
                achievedKL = calculateKLDivergence(dataOriginal, dataPerturbed);

            } else {
                // Optimization Search (Stable Algorithm with Retry)
                // 如果单次搜索未达到精度，换初始化重试

                const tolerance = 0.0001;  // 动态阈值
                const maxRetries = 6;        // 最多重试5次
                const maxIterPerTry = 60;    // 每次尝试最多50次迭代

                let bestOverallDiff = Infinity;
                let bestOverallMagnitude = 0;
                let bestOverallData = null;
                let bestOverallMetric = 0;
                let bestOverallSSIM = 0;
                let bestOverallKL = 0;
                let foundGoodResult = false;

                for (let retry = 0; retry < maxRetries && !foundGoodResult; retry++) {
                    // 每次重试重新生成扰动方向
                    this.perturbation.resetToOriginal();
                    this.perturbation.setCoefficients(this.coefficients);
                    this.perturbation.generatePerturbationDeltas(freq.target, 1.0, 'all');

                    // Adaptive max magnitude: large gaussians need higher values
                    const maxMagnitude = (freq.target === 'large') ? 8.0 : 5.0;
                    let min = 0.0, max = maxMagnitude;
                    let bestDiff = Infinity;

                    // 二分搜索
                    for (let i = 0; i < maxIterPerTry; i++) {
                        const mid = (min + max) / 2;

                        this.perturbation.applyStoredPerturbation(mid);

                        const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
                        const tempPerturbed = saResult.perturbedTotal;

                        let currentMetric = 0;
                        // Only SSIM mode is supported for optimization
                        currentMetric = calculateSSIM(dataOriginal, tempPerturbed, this.config.width, this.config.height);

                        const diff = Math.abs(currentMetric - targetVal);

                        if (diff < bestDiff) {
                            bestDiff = diff;

                            // 更新本次尝试的最佳结果
                            if (diff < bestOverallDiff) {
                                bestOverallDiff = diff;
                                bestOverallMagnitude = mid;
                                bestOverallData = tempPerturbed;
                                bestOverallMetric = currentMetric;

                                bestOverallSSIM = currentMetric;
                                bestOverallKL = calculateKLDivergence(dataOriginal, tempPerturbed);
                            }

                            // 达到精度要求
                            if (diff < tolerance) {
                                foundGoodResult = true;
                                break;
                            }
                        }

                        // Bisect for SSIM: lower SSIM means more different
                        if (currentMetric > targetVal) min = mid;
                        else max = mid;
                    }

                    if (!foundGoodResult && retry < maxRetries - 1) {
                        console.log(`Retry ${retry + 1}: diff=${bestDiff.toFixed(6)}, target=${targetVal}, trying new initialization...`);
                    }
                }

                // 使用最佳结果
                chosenMagnitude = bestOverallMagnitude;
                dataPerturbed = bestOverallData;
                achievedMetric = bestOverallMetric;
                achievedSSIM = bestOverallSSIM;
                achievedKL = bestOverallKL;

                // 计算并记录扰动幅度
                const perturbedGaussians = this.generator.gaussians.filter(g => g.isPerturbed);
                const perturbStats = this.perturbation.computePerturbationMagnitudes(perturbedGaussians);
                
                console.log(`=== Perturbation Stats for ${freq.name} (Mag: ${chosenMagnitude.toFixed(3)}) ===`);
                console.log(`  Position: avg=${perturbStats.summary.avgPositionShift.toFixed(2)}px, max=${perturbStats.summary.maxPositionShift.toFixed(2)}px`);
                console.log(`  Rotation: avg=${perturbStats.summary.avgRotation.toFixed(4)}, max=${perturbStats.summary.maxRotation.toFixed(4)}`);
                console.log(`  Amplitude: avg=${perturbStats.summary.avgAmplitudeRatio.toFixed(3)}x, range=[${perturbStats.summary.minAmplitudeRatio.toFixed(3)}, ${perturbStats.summary.maxAmplitudeRatio.toFixed(3)}]`);
                
                // 详细信息
                perturbStats.gaussians.forEach(g => {
                    console.log(`    ${g.sizeLevel} #${g.id.substr(0,4)}: pos=${g.positionShift.toFixed(2)}px, amp=${g.amplitudeRatio.toFixed(3)}x`);
                });

                if (!foundGoodResult) {
                    console.warn(`Warning: Could not achieve tolerance ${tolerance} for target ${targetVal} after ${maxRetries} retries. Best diff: ${bestOverallDiff.toFixed(6)}`);
                    resolve();
                    return;
                }
            }

            // 4. 应用软归因门控并渲染 (This step is now integrated into the optimization loop or direct application)
            // The `dataPerturbed` variable now holds the final perturbed data.

            // 5. 创建DOM元素
            const card = document.createElement('div');
            card.className = 'stimuli-card';

            const title = document.createElement('h4');
            // Show Target vs Actual
            if (mode === 'magnitude') {
                title.innerHTML = `Mag: ${targetVal}<br><span style="font-size:10px; font-weight:normal">SSIM:${achievedSSIM.toFixed(5)} | KL:${achievedKL.toFixed(5)}</span>`;
            } else {
                const targetLabel = mode.toUpperCase();
                title.innerHTML = `Target ${targetLabel}: ${targetVal}<br><span style="font-size:10px; font-weight:normal">Mag:${chosenMagnitude.toFixed(3)} | Actual:${achievedMetric.toFixed(5)}</span>`;
            }
            card.appendChild(title);

            const pair = document.createElement('div');
            pair.className = 'canvas-pair';

            const canvasOriginal = this.createCanvas(dataOriginal);
            const canvasPerturbed = this.createCanvas(dataPerturbed);

            pair.appendChild(canvasOriginal);
            pair.appendChild(canvasPerturbed);
            card.appendChild(pair);

            const labels = document.createElement('div');
            labels.className = 'labels';
            labels.innerHTML = '<span>Original</span><span>Perturbed</span>';
            card.appendChild(labels);

            // Add refresh button
            const btnRefresh = document.createElement('button');
            btnRefresh.className = 'btn-refresh';
            btnRefresh.textContent = '🔄 Refresh';
            btnRefresh.addEventListener('click', async () => {
                btnRefresh.disabled = true;
                btnRefresh.textContent = 'Refreshing...';
                await this.refreshStimulusCard(card, freq, targetVal, repetition, mode);
                btnRefresh.textContent = '🔄 Refresh';
                btnRefresh.disabled = false;
            });
            card.appendChild(btnRefresh);

            container.appendChild(card);

            // 稍微延迟一下以免阻塞主线程
            setTimeout(resolve, 0);
        });
    }

    async refreshStimulusCard(card, freq, targetVal, repetition, mode) {
        // Find the canvas pair and title
        const title = card.querySelector('h4');
        const canvasPair = card.querySelector('.canvas-pair');
        const canvases = canvasPair.querySelectorAll('canvas');
        
        // Clear canvases
        canvases.forEach(canvas => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        // Regenerate stimulus
        this.generator.updateDimensions(this.config.width, this.config.height);
        this.generator.sizeLevels = {
            'small': { sigma: 15, count: 2, color: '#377eb8' },
            'medium': { sigma: 25, count: 3, color: '#4daf4a' },
            'large': { sigma: 50, count: 4, color: '#ff7f00' }
        };

        this.generator.setBandWeight('small', parseFloat(document.getElementById('weight-high-value').value));
        this.generator.setBandWeight('medium', parseFloat(document.getElementById('weight-mid-value').value));
        this.generator.setBandWeight('large', parseFloat(document.getElementById('weight-low-value').value));
        this.generator.setExponent(parseFloat(document.getElementById('exponent-slider-value').value));

        this.generator.generateAll();
        const dataOriginal = this.generator.renderTo1DArray(this.config.width, this.config.height, false, true);

        let chosenMagnitude = targetVal;
        let achievedMetric = 0;
        let achievedKL = 0;
        let achievedSSIM = 0;
        let dataPerturbed = null;

        if (mode === 'magnitude') {
            this.perturbation.resetToOriginal();
            this.perturbation.setCoefficients(this.coefficients);
            this.perturbation.applyGlobalPerturbation(targetVal, 1.0, freq.target, 'all');
            const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
            dataPerturbed = saResult.perturbedTotal;
            achievedSSIM = calculateSSIM(dataOriginal, dataPerturbed, this.config.width, this.config.height);
            achievedKL = calculateKLDivergence(dataOriginal, dataPerturbed);
        } else {
            // Run optimization for SSIM
            const tolerance = 0.0001;
            const maxRetries = 6;
            const maxIterPerTry = 60;
            let bestOverallDiff = Infinity;
            let bestOverallMagnitude = 0;
            let bestOverallData = null;
            let bestOverallMetric = 0;
            let bestOverallSSIM = 0;
            let bestOverallKL = 0;
            let foundGoodResult = false;

            for (let retry = 0; retry < maxRetries && !foundGoodResult; retry++) {
                this.perturbation.resetToOriginal();
                this.perturbation.setCoefficients(this.coefficients);
                this.perturbation.generatePerturbationDeltas(freq.target, 1.0, 'all');

                const maxMagnitude = (freq.target === 'large') ? 8.0 : 5.0;
                let min = 0.0, max = maxMagnitude;
                let bestDiff = Infinity;

                for (let i = 0; i < maxIterPerTry; i++) {
                    const mid = (min + max) / 2;
                    this.perturbation.applyStoredPerturbation(mid);
                    const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
                    const tempPerturbed = saResult.perturbedTotal;

                    let currentMetric = 0;
                    // Only SSIM mode is supported for optimization
                    currentMetric = calculateSSIM(dataOriginal, tempPerturbed, this.config.width, this.config.height);

                    const diff = Math.abs(currentMetric - targetVal);
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        if (diff < bestOverallDiff) {
                            bestOverallDiff = diff;
                            bestOverallMagnitude = mid;
                            bestOverallData = tempPerturbed;
                            bestOverallMetric = currentMetric;
                            bestOverallSSIM = currentMetric;
                            bestOverallKL = calculateKLDivergence(dataOriginal, tempPerturbed);
                        }
                        if (diff < tolerance) {
                            foundGoodResult = true;
                            break;
                        }
                    }

                    // SSIM: lower is more different, so adjust search accordingly
                    if (currentMetric > targetVal) min = mid;
                    else max = mid;
                }
            }

            chosenMagnitude = bestOverallMagnitude;
            dataPerturbed = bestOverallData;
            achievedMetric = bestOverallMetric;
            achievedSSIM = bestOverallSSIM;
            achievedKL = bestOverallKL;
        }

        // Update title
        if (mode === 'magnitude') {
            title.innerHTML = `Mag: ${targetVal}<br><span style="font-size:10px; font-weight:normal">SSIM:${achievedSSIM.toFixed(5)} | KL:${achievedKL.toFixed(5)}</span>`;
        } else {
            const targetLabel = mode.toUpperCase();
            title.innerHTML = `Target ${targetLabel}: ${targetVal}<br><span style="font-size:10px; font-weight:normal">Mag:${chosenMagnitude.toFixed(3)} | Actual:${achievedMetric.toFixed(5)}</span>`;
        }

        // Render new canvases
        const canvasOriginal = canvases[0];
        const canvasPerturbed = canvases[1];
        this.renderToCanvas(canvasOriginal, dataOriginal);
        this.renderToCanvas(canvasPerturbed, dataPerturbed);
    }

    renderToCanvas(canvas, data) {
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(this.config.width, this.config.height);

        let max = 0;
        for (let i = 0; i < data.length; i++) {
            max = Math.max(max, data[i]);
        }
        if (max === 0) max = 1;

        const colormap = 'greyscale';
        for (let i = 0; i < data.length; i++) {
            const normalizedVal = data[i] / max;
            const color = valueToColor(normalizedVal, colormap);
            const pixelIndex = i * 4;
            imgData.data[pixelIndex] = color[0];
            imgData.data[pixelIndex + 1] = color[1];
            imgData.data[pixelIndex + 2] = color[2];
            imgData.data[pixelIndex + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    createCanvas(data) {
        const canvas = document.createElement('canvas');
        canvas.width = this.config.width;
        canvas.height = this.config.height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(this.config.width, this.config.height);

        // 使用与 visualization.js 一致的归一化方式：只用 max 归一化
        let max = 0;
        for (let i = 0; i < data.length; i++) {
            max = Math.max(max, data[i]);
        }

        if (max === 0) max = 1; // 防止除零

        // 使用 valueToColor 函数应用 colormap（与 index.html 一致）
        const colormap = 'greyscale'; // 可改为 'viridis', 'plasma' 等

        for (let i = 0; i < data.length; i++) {
            const normalizedVal = data[i] / max;
            const color = valueToColor(normalizedVal, colormap);

            const pixelIndex = i * 4;
            imgData.data[pixelIndex] = color[0];     // R
            imgData.data[pixelIndex + 1] = color[1]; // G
            imgData.data[pixelIndex + 2] = color[2]; // B
            imgData.data[pixelIndex + 3] = 255;      // A
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new StimuliGallery();
});
