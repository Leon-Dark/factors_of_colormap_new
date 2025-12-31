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

        this.bindEvents();
    }

    bindEvents() {
        this.btnStart.addEventListener('click', () => this.generateGallery());
    }

    async generateGallery() {
        this.btnStart.disabled = true;
        this.loadingText.style.display = 'block';
        this.container.innerHTML = '';

        // 使用setTimeout让UI有机会更新
        setTimeout(async () => {
            const frequencies = [
                { id: 'low', name: 'Low Frequency Perturbation', target: 'large' },
                { id: 'medium', name: 'Medium Frequency Perturbation', target: 'medium' },
                { id: 'high', name: 'High Frequency Perturbation', target: 'small' }
            ];

            const magnitudesInput = document.getElementById('magnitudes-input').value;
            const magnitudes = magnitudesInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

            if (magnitudes.length === 0) {
                alert('Please enter valid magnitudes!');
                this.btnStart.disabled = false;
                this.loadingText.style.display = 'none';
                return;
            }
            const repetitions = 2;

            for (const freq of frequencies) {
                const section = document.createElement('div');
                section.className = 'section-frequency';

                // 头部颜色根据频率决定
                let headerClass = '';
                if (freq.id === 'low') headerClass = 'header-low';
                else if (freq.id === 'medium') headerClass = 'header-medium';
                else headerClass = 'header-high';

                section.innerHTML = `
                    <div class="section-header ${headerClass}">${freq.name}</div>
                    <div class="stimuli-grid" id="grid-${freq.id}"></div>
                `;
                this.container.appendChild(section);

                const grid = section.querySelector(`#grid-${freq.id}`);

                for (const mag of magnitudes) {
                    for (let rep = 1; rep <= repetitions; rep++) {
                        await this.createStimulusCard(grid, freq, mag, rep);
                    }
                }
            }

            this.btnStart.disabled = false;
            this.loadingText.style.display = 'none';
        }, 100);
    }

    async createStimulusCard(container, freq, magnitude, repetition) {
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

            // 3. 应用扰动
            // 目标频率的2个高斯 (总数4个，所以ratio=0.5)
            // 先应用物理扰动
            this.perturbation.resetToOriginal();
            const perturbed = this.perturbation.applyGlobalPerturbation(magnitude, 0.5, freq.target, 'all');

            // Debug Log
            if (repetition === 1 && magnitude === 0.5) {
                console.log(`[Debug] Freq: ${freq.id}, Mag: ${magnitude}`);
                console.log(`[Debug] Perturbed count: ${perturbed.length}`);
                if (perturbed.length > 0) {
                    const g = perturbed[0];
                    console.log(`[Debug] First perturbed gaussian delta: dx=${(g.mX - g.originalMX).toFixed(2)}, dy=${(g.mY - g.originalMY).toFixed(2)}`);
                }
            }

            // 4. 应用软归因门控并渲染
            // 使用 performGatedPerturbation 获取最终结果
            // 注意：这个方法会重新计算所有场的叠加，应用门控
            const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
            const dataPerturbed = saResult.perturbedTotal;

            // 5. 创建DOM元素
            const card = document.createElement('div');
            card.className = 'stimuli-card';

            const title = document.createElement('h4');
            title.textContent = `Magnitude: ${magnitude} (Sample ${repetition})`;
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
