/**
 * Image Viewer Logic
 * Optimized to use calculated paths instead of directory scanning
 */

class ImageViewer {
    constructor() {
        // --- Configuration (Must calculate everything to match Batch Generator) ---
        // Defaults matching batch_generate.js and experiment.js
        this.config = {
            ssimStart: 0.99,
            ssimEnd: 0.95,
            ssimStep: 0.002,

            frequencies: [
                { id: 'low', name: 'Low Complexity', offset: 0 },
                { id: 'medium', name: 'Medium Complexity', offset: 21 }, // Determined dynamically typically, but hardcoded here based on known structure
                { id: 'high', name: 'High Complexity', offset: 42 }
            ],

            // Image Naming Rules
            imageNaming: {
                totalReps: 27,
                ssimPerFreq: 21, // (0.99-0.95)/0.002 + 1 = 21
                filesPerRep: 63, // 21 * 3
                basePath: '/perturbation_images/images/'
            }
        };

        // --- DOM Elements ---
        this.inputs = {
            ssimStart: document.getElementById('ssim-start'),
            ssimEnd: document.getElementById('ssim-end'),
            ssimStep: document.getElementById('ssim-step'),
            repetitions: document.getElementById('repetitions'),
            freqLow: document.getElementById('freq-low'),
            freqMedium: document.getElementById('freq-medium'),
            freqHigh: document.getElementById('freq-high')
        };

        this.container = document.getElementById('gallery-content');
        this.btnLoad = document.getElementById('btn-load');
        this.loadingText = document.getElementById('loading');

        // Initialize Lookup Maps
        this.recalculateLookups();

        // Bind Events
        this.bindEvents();
    }

    bindEvents() {
        this.btnLoad.addEventListener('click', () => {
            this.loadImages();
        });
    }

    recalculateLookups() {
        // 1. Generate FULL list of SSIM targets that exist on server (The Source of Truth)
        // This MUST match what was generated.
        // We know from config.json it is 0.99 -> 0.95 step 0.002
        this.serverSSIMTargets = [];
        for (let v = 0.99; v >= 0.95 - 1e-6; v -= 0.002) {
            this.serverSSIMTargets.push(parseFloat(v.toFixed(5)));
        }

        // 2. SSIM Lookup Map (Value -> Index)
        this.ssimLookup = new Map();
        this.serverSSIMTargets.forEach((val, index) => {
            this.ssimLookup.set(val.toFixed(5), index);
        });

        // 3. Frequency Offsets
        const ssimPerFreq = this.serverSSIMTargets.length;
        this.config.imageNaming.ssimPerFreq = ssimPerFreq;
        this.config.imageNaming.filesPerRep = ssimPerFreq * 3;

        this.frequencyOffsets = {
            'low': 0,
            'medium': ssimPerFreq,
            'high': ssimPerFreq * 2
        };
    }

    /**
     * Main Load Function
     */
    loadImages() {
        this.toggleLoading(true);
        this.container.innerHTML = '';

        // Allow UI to update before heavy processing
        setTimeout(() => {
            try {
                this.renderGallery();
            } catch (e) {
                console.error(e);
                alert('Error loading images: ' + e.message);
            } finally {
                this.toggleLoading(false);
            }
        }, 50);
    }

    renderGallery() {
        // 1. Get User Filter Preferences
        const userStart = parseFloat(this.inputs.ssimStart.value);
        const userEnd = parseFloat(this.inputs.ssimEnd.value);
        const userStep = parseFloat(this.inputs.ssimStep.value);
        const repsToShow = parseInt(this.inputs.repetitions.value);

        const activeFreqs = [];
        if (this.inputs.freqLow.checked) activeFreqs.push('low');
        if (this.inputs.freqMedium.checked) activeFreqs.push('medium');
        if (this.inputs.freqHigh.checked) activeFreqs.push('high');

        // 2. Generate Requested SSIM List
        // Note: User might request a weird step (e.g. 0.01) that subsets the available 0.002 steps
        const requestedSSIMs = [];
        // Direction handling
        if (userStart >= userEnd) {
            for (let v = userStart; v >= userEnd - 1e-6; v -= userStep) {
                requestedSSIMs.push(parseFloat(v.toFixed(5)));
            }
        } else {
            for (let v = userStart; v <= userEnd + 1e-6; v += userStep) {
                requestedSSIMs.push(parseFloat(v.toFixed(5)));
            }
        }

        // 3. Build HTML
        activeFreqs.forEach(freqId => {
            const section = document.createElement('div');
            section.className = 'section-frequency';

            // Header
            const header = document.createElement('h3');
            header.className = `section-header header-${freqId}`;
            header.textContent = freqId.toUpperCase() + ' Frequency';
            section.appendChild(header);

            // Grid
            const grid = document.createElement('div');
            grid.className = 'stimuli-grid';

            requestedSSIMs.forEach(ssimVal => {
                // Check if this SSIM exists in our server generation
                const ssimKey = ssimVal.toFixed(5);
                if (!this.ssimLookup.has(ssimKey)) {
                    return; // Skip invalid SSIMs that don't match server step
                }

                // Show N random repetitions
                for (let i = 0; i < repsToShow; i++) {
                    // Pick a random rep from 1 to 27 (total generated)
                    // Or cyclic? Let's just pick random to show variety
                    const rep = Math.floor(Math.random() * this.config.imageNaming.totalReps) + 1;

                    const paths = this.calculateImagePath(freqId, ssimVal, rep);

                    if (paths) {
                        const card = this.createCard(paths, ssimVal, rep);
                        grid.appendChild(card);
                    }
                }
            });

            section.appendChild(grid);
            this.container.appendChild(section);
        });

        if (this.container.children.length === 0) {
            this.container.innerHTML = '<p style="text-align:center; padding:20px;">No images match your criteria.</p>';
        }
    }

    createCard(paths, ssim, rep) {
        const div = document.createElement('div');
        div.className = 'stimuli-card';

        div.innerHTML = `
            <h4>SSIM: ${ssim.toFixed(5)} <span style="font-weight:normal; font-size:0.9em">(Rep ${rep})</span></h4>
            <div class="image-pair">
                <div>
                    <img src="${paths.originalPath}" loading="lazy" alt="Original">
                    <div class="labels">Original</div>
                </div>
                <div>
                    <img src="${paths.perturbedPath}" loading="lazy" alt="Perturbed">
                    <div class="labels">Perturbed</div>
                </div>
            </div>
            <div class="labels" style="justify-content: center; margin-top:5px;">ID: ${paths.prefix}</div>
        `;
        return div;
    }

    /**
     * Core optimized path calculation (Ported from experiment.js)
     */
    calculateImagePath(frequencyId, targetSSIM, rep) {
        // 1. Get frequency offset
        const freqOffset = this.frequencyOffsets[frequencyId];
        if (freqOffset === undefined) return null;

        // 2. Get SSIM index
        const ssimKey = targetSSIM.toFixed(5);
        const ssimIndex = this.ssimLookup.get(ssimKey);
        if (ssimIndex === undefined) return null;

        // 3. Calculate global file ID
        // Formula: (rep-1) * filesPerRep + freqOffset + ssimIndex + 1
        const repBaseId = (rep - 1) * this.config.imageNaming.filesPerRep;
        const fileId = repBaseId + freqOffset + ssimIndex + 1;

        const idStr = fileId.toString().padStart(4, '0');
        const prefix = `${idStr}_${frequencyId}_ssim_${ssimKey}_rep${rep}`;

        return {
            prefix: prefix,
            originalPath: `${this.config.imageNaming.basePath}${prefix}_original.png`,
            perturbedPath: `${this.config.imageNaming.basePath}${prefix}_perturbed.png`
        };
    }

    toggleLoading(show) {
        this.loadingText.style.display = show ? 'block' : 'none';
        this.btnLoad.disabled = show;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ImageViewer();
});
