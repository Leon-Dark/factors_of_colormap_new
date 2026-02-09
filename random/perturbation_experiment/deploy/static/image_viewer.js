
/**
 * Real-time Colormap Viewer
 * Generates Gaussian fields and applies colormaps from JSON
 * NOW UPDATED to match experiment.js logic (Soft Attribution + SSIM Optimization)
 */

class RealtimeViewer {
    constructor() {
        this.width = 200;
        this.height = 200;
        this.container = document.getElementById('gallery-content');
        this.loading = document.getElementById('loading');

        // Generator and Systems
        this.generator = new GaussianGenerator(this.width, this.height);
        this.perturbation = new PerturbationSystem(this.generator);
        this.softAttribution = new SoftAttributionPerturbation(this.generator);

        // SSIM Targets from experiment.js
        this.targets = {
            'low': { id: 'low', target: 'large', ssim: 0.954 },
            'mid': { id: 'mid', target: 'medium', ssim: 0.982 },
            'high': { id: 'high', target: 'small', ssim: 0.956 }
        };

        // Store the original fields (Float32Array) for each band
        this.originalFields = {
            'low': null,
            'mid': null,
            'high': null
        };

        // Store the final perturbed fields (Float32Array) for each band
        this.finalFields = {
            'low': null,
            'mid': null,
            'high': null
        };

        this.init();
    }

    async init() {
        try {
            this.checkDependencies();
            console.log('Dependencies loaded. RealtimeViewer v2 (Distinct Objects).');

            // 1. Generate Master Fields (Base + 3 Optimized Perturbations)
            await this.generateMasterPerturbations();

            // 2. Load Colormaps and Render
            await this.loadColormapsAndRender();

        } catch (e) {
            console.error(e);
            this.loading.textContent = 'Error: ' + e.message;
        }
    }

    checkDependencies() {
        if (typeof GaussianGenerator === 'undefined' ||
            typeof PerturbationSystem === 'undefined' ||
            typeof SoftAttributionPerturbation === 'undefined') {
            throw new Error('Required scripts not loaded. Check html.');
        }
    }

    /**
     * Core Logic:
     * Loop through each frequency band.
     * For each band:
     * 1. Generate a NEW random distribution (Distinct Object).
     * 2. Find the perturbation magnitude that hits the SSIM target.
     * 3. Store the resulting FULL perturbed field.
     */
    async generateMasterPerturbations() {
        this.generator.updateDimensions(this.width, this.height);
        this.generator.sizeLevels = {
            'small': { sigma: 15, count: 2, color: '#377eb8' },
            'medium': { sigma: 25, count: 3, color: '#4daf4a' },
            'large': { sigma: 50, count: 4, color: '#ff7f00' }
        };

        for (const bandKey of ['low', 'mid', 'high']) {
            const config = this.targets[bandKey];

            this.loading.innerText = `Generating & Optimizing Object for ${bandKey.toUpperCase()} (Target: ${config.ssim})...`;
            await new Promise(r => setTimeout(r, 10));

            // 1. Generate NEW Random Distribution for this band's object
            this.generator.generateAll();

            // 2. Render Original Field (for SSIM calc)
            const originalData = this.generator.renderTo1DArray(this.width, this.height, false, true);

            // Store the normalized original field for this band
            this.originalFields[bandKey] = this.normalize(new Float32Array(originalData));

            // 3. Precompute Soft Attribution components for THIS object
            const saCache = this.precomputeSoftAttributionCache();

            console.log(`Optimizing Object ${bandKey}... Target SSIM: ${config.ssim}`);

            // 4. Optimize
            const result = this.findMagnitudeForSSIM(
                config.ssim,
                config.target,
                originalData,
                saCache
            );

            console.log(`  > Done. Magnitude: ${result.magnitude.toFixed(3)}, Actual SSIM: ${result.ssim.toFixed(5)}`);

            // 5. Store result
            this.finalFields[bandKey] = this.normalize(result.data);
        }
    }

    precomputeSoftAttributionCache() {
        // Render 1 time only from current generator state
        const originalTotal = this.generator.renderTo1DArray(this.width, this.height, true, false);
        const originalBands = {
            low: this.softAttribution.renderBandField('large', this.width, this.height, true),
            mid: this.softAttribution.renderBandField('medium', this.width, this.height, true),
            high: this.softAttribution.renderBandField('small', this.width, this.height, true)
        };

        const energyFields = this.softAttribution.computeGradientEnergyFields(this.width, this.height);
        const attributionWeights = this.softAttribution.computeAttributionWeights(energyFields, this.width, this.height);
        const gatingMasks = this.softAttribution.generateGatingMasks(attributionWeights, this.width, this.height);

        return {
            originalTotal,
            originalBands,
            gatingMasks
        };
    }

    /**
     * Simplified synchronous version of SSIM optimization from experiment.js
     * (We don't need a worker here since we only run it once on load)
     */
    findMagnitudeForSSIM(targetSSIM, freqTarget, dataOriginal, saCache) {
        const coefficients = {
            position: 1.0,
            rotation: 1.0,
            amplitude: 0.0
        };

        let bestOverallDiff = Infinity;
        let bestOverallResult = null;
        let bestOverallMagnitude = 0;
        let foundGoodResult = false;

        const tolerance = 0.001;
        const maxRetries = 5;
        const maxIterPerTry = 20;

        for (let retry = 0; retry < maxRetries && !foundGoodResult; retry++) {
            this.perturbation.resetToOriginal(); // Reset gaussians
            this.perturbation.setCoefficients(coefficients);

            // Generate random directions
            this.perturbation.generatePerturbationDeltas(freqTarget, 1.0, 'all');

            const maxMagnitude = (freqTarget === 'large') ? 12.0 : 8.0;
            let min = 0.0, max = maxMagnitude;
            let bestDiff = Infinity;

            for (let i = 0; i < maxIterPerTry; i++) {
                const mid = (min + max) / 2;

                // Apply perturbation
                this.perturbation.applyStoredPerturbation(mid);

                // Render with Soft Attribution
                const perturbedBands = {
                    low: this.softAttribution.renderBandField('large', this.width, this.height, false),
                    mid: this.softAttribution.renderBandField('medium', this.width, this.height, false),
                    high: this.softAttribution.renderBandField('small', this.width, this.height, false)
                };

                const tempPerturbed = this.softAttribution.applyGatedPerturbation(
                    saCache.originalTotal,
                    saCache.originalBands,
                    perturbedBands,
                    saCache.gatingMasks,
                    this.width,
                    this.height
                );

                const currentSSIM = calculateSSIM(dataOriginal, tempPerturbed, this.width, this.height);
                const diff = Math.abs(currentSSIM - targetSSIM);

                if (diff < bestDiff) {
                    bestDiff = diff;
                }

                if (diff < bestOverallDiff) {
                    bestOverallDiff = diff;
                    bestOverallMagnitude = mid;
                    bestOverallResult = new Float32Array(tempPerturbed); // Clone

                    if (diff < tolerance) {
                        foundGoodResult = true;
                        break;
                    }
                }

                // Binary search step
                if (currentSSIM > targetSSIM) {
                    min = mid; // Need more perturbation (reduce SSIM)
                } else {
                    max = mid; // Need less perturbation
                }
            }
        }

        if (!bestOverallResult) {
            console.warn("Optimization failed, returning original");
            return {
                data: dataOriginal,
                magnitude: 0,
                ssim: 1
            };
        }

        const finalSSIM = calculateSSIM(dataOriginal, bestOverallResult, this.width, this.height);
        return {
            data: bestOverallResult,
            magnitude: bestOverallMagnitude,
            ssim: finalSSIM
        };
    }

    normalize(data) {
        let max = -Infinity;
        let min = Infinity;
        for (let i = 0; i < data.length; i++) {
            if (data[i] > max) max = data[i];
            if (data[i] < min) min = data[i];
        }

        const range = max - min;
        const result = new Float32Array(data.length);

        if (range < 1e-9) return result;

        for (let i = 0; i < data.length; i++) {
            result[i] = (data[i] - min) / range;
        }
        return result;
    }

    async loadColormapsAndRender() {
        this.loading.innerText = 'Loading colormaps...';
        const response = await fetch('static/colormaps.json');
        const colormaps = await response.json();

        // Sort by ID
        colormaps.sort((a, b) => a.id - b.id);

        this.container.innerHTML = '';

        // Create Grid Container
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(650px, 1fr))';
        grid.style.gap = '20px';
        this.container.appendChild(grid);

        let count = 0;
        this.loading.innerText = 'Rendering...';

        // Process in chunks to avoid blocking UI
        const processChunk = () => {
            const chunkSize = 5;
            const end = Math.min(count + chunkSize, colormaps.length);

            for (let i = count; i < end; i++) {
                this.createColormapCard(colormaps[i], grid);
            }

            count = end;
            if (count < colormaps.length) {
                requestAnimationFrame(processChunk);
            } else {
                this.loading.style.display = 'none';
            }
        };

        processChunk();
    }

    createColormapCard(colormapEntry, parent) {
        const card = document.createElement('div');
        card.className = 'stimuli-card';
        card.style.textAlign = 'left';

        const cardHeader = document.createElement('h4');
        cardHeader.innerHTML = `ID: ${colormapEntry.id} <span style="font-weight:normal; font-size:0.9em; float:right">Hue: ${colormapEntry.metadata.hueTarget}</span>`;
        card.appendChild(cardHeader);

        // Create a 3-column grid for the 6 images
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        grid.style.gap = '10px';
        grid.style.justifyItems = 'center';

        // First render the column headers
        const bands = ['low', 'mid', 'high'];
        const bandColors = { 'low': '#ff7f00', 'mid': '#4daf4a', 'high': '#377eb8' };

        // Row 1: Original images
        bands.forEach(band => {
            const wrapper = document.createElement('div');
            wrapper.style.textAlign = 'center';

            const headerLabel = document.createElement('div');
            headerLabel.style.fontWeight = 'bold';
            headerLabel.style.color = bandColors[band];
            headerLabel.style.marginBottom = '5px';
            headerLabel.innerText = `${band.toUpperCase()} Freq`;
            wrapper.appendChild(headerLabel);

            const canvas = this.renderCanvas(this.originalFields[band], colormapEntry.colormap);
            wrapper.appendChild(canvas);

            const label = document.createElement('div');
            label.className = 'labels';
            label.style.justifyContent = 'center';
            label.style.color = '#666';
            label.innerText = 'Original';
            wrapper.appendChild(label);

            grid.appendChild(wrapper);
        });

        // Row 2: Perturbed images
        bands.forEach(band => {
            const wrapper = document.createElement('div');
            wrapper.style.textAlign = 'center';

            const canvas = this.renderCanvas(this.finalFields[band], colormapEntry.colormap);
            wrapper.appendChild(canvas);

            const label = document.createElement('div');
            label.className = 'labels';
            label.style.justifyContent = 'center';
            label.style.color = '#333';
            label.innerText = `Perturbed (SSIM~${this.targets[band].ssim})`;
            wrapper.appendChild(label);

            grid.appendChild(wrapper);
        });

        card.appendChild(grid);

        // Add palette strip
        const palette = document.createElement('div');
        palette.style.height = '10px';
        palette.style.width = '100%';
        palette.style.marginTop = '10px';
        palette.style.background = `linear-gradient(to right, ${this.generateGradientString(colormapEntry.colormap)})`;
        palette.style.borderRadius = '4px';
        card.appendChild(palette);

        parent.appendChild(card);
    }

    renderCanvas(dataField, colormap) {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(this.width, this.height);

        const len = dataField.length;
        const mapLen = colormap.length;

        for (let i = 0; i < len; i++) {
            // value is 0-1
            const val = dataField[i];

            // Map to index
            let idx = Math.floor(val * (mapLen - 1));
            // Clamp just in case
            if (idx < 0) idx = 0;
            if (idx >= mapLen) idx = mapLen - 1;

            const color = colormap[idx]; // [r, g, b]

            const pxOffset = i * 4;
            imgData.data[pxOffset] = color[0];
            imgData.data[pxOffset + 1] = color[1];
            imgData.data[pxOffset + 2] = color[2];
            imgData.data[pxOffset + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    generateGradientString(colormap) {
        const steps = 10;
        let str = '';
        for (let i = 0; i <= steps; i++) {
            const pct = i / steps;
            const idx = Math.floor(pct * (colormap.length - 1));
            const c = colormap[idx];
            str += `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}) ${pct * 100}%`;
            if (i < steps) str += ', ';
        }
        return str;
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    new RealtimeViewer();
});
