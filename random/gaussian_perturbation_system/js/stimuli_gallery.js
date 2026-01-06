/**
 * 刺激图展示长廊控制器
 * Stimuli Gallery Controller
 */

class StimuliGallery {
    constructor() {
        this.config = {
            width: 100,  // 略微缩小尺寸以适应网格
            height: 100
        };

        this.container = document.getElementById('gallery-content');
        this.btnStart = document.getElementById('btn-start');
        this.loadingText = document.getElementById('loading');

        // 只用于生成的临时生成器
        this.generator = new GaussianGenerator(this.config.width, this.config.height);
        this.perturbation = new PerturbationSystem(this.generator);
        this.softAttribution = new SoftAttributionPerturbation(this.generator);

        this.coefficients = {
            position: 1.0,
            stretch: 0.5,
            rotation: 0.6,
            amplitude: 0.6
        };

        this.bindEvents();
    }

    bindEvents() {
        this.btnStart.addEventListener('click', () => this.generateGallery());

        // Mode Switch
        const modeSelect = document.getElementById('generation-mode');
        const groups = {
            'magnitude': document.getElementById('input-group-magnitude'),
            'ssim': document.getElementById('input-group-ssim'),
            'kl': document.getElementById('input-group-kl')
        };

        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                const mode = e.target.value;
                Object.keys(groups).forEach(k => {
                    if (groups[k]) groups[k].style.display = (k === mode) ? 'block' : 'none';
                });
            });
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
            } else {
                // Range generation for SSIM and KL
                const idPrefix = mode === 'ssim' ? 'ssim' : 'kl';
                const start = parseFloat(document.getElementById(`${idPrefix}-start`).value);
                const end = parseFloat(document.getElementById(`${idPrefix}-end`).value);
                step = Math.abs(parseFloat(document.getElementById(`${idPrefix}-step`).value));

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
            const repetitions = 2;

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
            // 4个低频，4个中频，4个高频
            this.generator.updateDimensions(this.config.width, this.config.height);
            this.generator.sizeLevels = {
                'small': { sigma: 7.5, count: 4, color: '#377eb8' },   // 尺寸按比例缩小 (原15 -> 7.5)
                'medium': { sigma: 12.5, count: 4, color: '#4daf4a' }, // (原25 -> 12.5)
                'large': { sigma: 25, count: 4, color: '#ff7f00' }     // (原50 -> 25)
            };
            // 注意：因为画布从200x200缩小到了100x100，所以sigma也应该减半，
            // 但如果用户想要保持视觉上的相对比例，我们需要调整sigma。
            // 这里为了展示清晰，我们使用缩小版的参数

            // 重新生成
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

                const tolerance = step / 2;  // 动态阈值
                const maxRetries = 5;        // 最多重试5次
                const maxIterPerTry = 50;    // 每次尝试最多50次迭代

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

                    let min = 0.0, max = 2.5;
                    let bestDiff = Infinity;

                    // 二分搜索
                    for (let i = 0; i < maxIterPerTry; i++) {
                        const mid = (min + max) / 2;

                        this.perturbation.applyStoredPerturbation(mid);

                        const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
                        const tempPerturbed = saResult.perturbedTotal;

                        let currentMetric = 0;
                        if (mode === 'ssim') {
                            currentMetric = calculateSSIM(dataOriginal, tempPerturbed, this.config.width, this.config.height);
                        } else {
                            currentMetric = calculateKLDivergence(dataOriginal, tempPerturbed);
                        }

                        const diff = Math.abs(currentMetric - targetVal);

                        if (diff < bestDiff) {
                            bestDiff = diff;

                            // 更新本次尝试的最佳结果
                            if (diff < bestOverallDiff) {
                                bestOverallDiff = diff;
                                bestOverallMagnitude = mid;
                                bestOverallData = tempPerturbed;
                                bestOverallMetric = currentMetric;

                                if (mode === 'ssim') {
                                    bestOverallSSIM = currentMetric;
                                    bestOverallKL = calculateKLDivergence(dataOriginal, tempPerturbed);
                                } else {
                                    bestOverallKL = currentMetric;
                                    bestOverallSSIM = calculateSSIM(dataOriginal, tempPerturbed, this.config.width, this.config.height);
                                }
                            }

                            // 达到精度要求
                            if (diff < tolerance) {
                                foundGoodResult = true;
                                break;
                            }
                        }

                        // Bisect
                        if (mode === 'ssim') {
                            if (currentMetric > targetVal) min = mid;
                            else max = mid;
                        } else {
                            if (currentMetric < targetVal) min = mid;
                            else max = mid;
                        }
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

                if (!foundGoodResult) {
                    console.warn(`Warning: Could not achieve tolerance ${tolerance} for target ${targetVal} after ${maxRetries} retries. Best diff: ${bestOverallDiff.toFixed(6)}`);
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

            container.appendChild(card);

            // 稍微延迟一下以免阻塞主线程
            setTimeout(resolve, 0);
        });
    }

    createCanvas(data) {
        const canvas = document.createElement('canvas');
        canvas.width = this.config.width;
        canvas.height = this.config.height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(this.config.width, this.config.height);

        // 简单的灰度映射 + Viridis (为了好看一点，我们这里直接用灰度或者简单的热力图)
        // 为了保持一致性，我们复用 colormaps_presets.js 里的逻辑会比较好，
        // 但这里为了简化，我们暂时用灰度，或者如果 colormaps_presets.js 可用我们可以用它。
        // 由于没有直接引入 main.js，我们这里手写一个简单的渲染

        let min = Infinity, max = -Infinity;
        for (let i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }

        const range = max - min || 1;

        for (let i = 0; i < data.length; i++) {
            const val = (data[i] - min) / range;
            const pixelIndex = i * 4;
            // 灰度
            const color = Math.floor(val * 255);
            imgData.data[pixelIndex] = color;
            imgData.data[pixelIndex + 1] = color;
            imgData.data[pixelIndex + 2] = color;
            imgData.data[pixelIndex + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new StimuliGallery();
});
