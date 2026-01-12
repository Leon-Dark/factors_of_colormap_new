/**
 * Experiment Controller
 * Handles logic for the 4AFC Gaussian Perturbation Experiment
 */

class ExperimentController {
    constructor() {
        // --- Configuration ---
        this.config = {
            width: 200,
            height: 200, // Matches canvas size in HTML
            repetitions: 2, // Trials per condition
            ssimTargets: [0.995, 0.990, 0.985, 0.980, 0.975, 0.970, 0.965, 0.960, 0.955, 0.950],
            frequencies: [
                { id: 'low', target: 'large' },
                { id: 'medium', target: 'medium' },
                { id: 'high', target: 'small' }
            ],
            // Gaussian Generation Params
            // User Request: 4 small(σ=15, high), 3 medium(σ=25, mid), 2 large(σ=50, low)
            sizeLevels: {
                'small': { sigma: 15, count: 4, color: '#377eb8' },
                'medium': { sigma: 25, count: 3, color: '#4daf4a' },
                'large': { sigma: 50, count: 2, color: '#ff7f00' }
            }
        };

        // --- State ---
        this.trials = [];
        this.currentTrialIndex = 0;
        this.results = [];
        this.participantId = '';
        this.isTrialActive = false;
        this.isTrialActive = false;
        this.startTime = 0;
        this.nextTrialPromise = null; // Promise for the next trial data
        this.nextTrialIndex = -1;     // Index of the trial being preloaded

        // --- Components ---
        // Initialize Generator & Perturbation Systems
        this.generator = new GaussianGenerator(this.config.width, this.config.height);
        this.perturbation = new PerturbationSystem(this.generator);
        this.softAttribution = new SoftAttributionPerturbation(this.generator);

        // --- DOM Elements ---
        this.screens = {
            intro: document.getElementById('intro-screen'),
            experiment: document.getElementById('experiment-screen'),
            end: document.getElementById('end-screen')
        };

        this.inputs = {
            participantId: document.getElementById('participant-id')
        };

        this.display = {
            trialCurrent: document.getElementById('trial-current'),
            trialTotal: document.getElementById('trial-total'),
            progressBar: document.getElementById('progress-bar'),
            stimuliContainer: document.getElementById('stimuli-container'),
            waitMessage: document.getElementById('wait-message'),
            canvases: Array.from(document.querySelectorAll('.stimulus-item canvas')),
            items: Array.from(document.querySelectorAll('.stimulus-item'))
        };

        this.buttons = {
            start: document.getElementById('btn-start')
        };

        this.bindEvents();
    }

    bindEvents() {
        // Start Button
        this.buttons.start.addEventListener('click', () => {
            const pid = this.inputs.participantId.value.trim();
            if (!pid) {
                alert('Please enter a Participant ID.');
                return;
            }
            this.participantId = pid;
            this.startExperiment();
        });

        // Stimuli Clicks
        this.display.items.forEach(item => {
            item.addEventListener('click', () => {
                if (this.isTrialActive) {
                    const selectedIndex = parseInt(item.getAttribute('data-index'));
                    this.handleSelection(selectedIndex);
                }
            });
        });

        // Download Button
        // Download Button Removed

    }

    // --- Experiment Flow ---

    startExperiment() {
        this.generateTrials();
        this.shuffleArray(this.trials);

        console.log(`Starting experiment with ${this.trials.length} trials.`);

        // UI Update
        this.display.trialTotal.textContent = this.trials.length;
        this.switchScreen('experiment');

        // Start first trial
        this.loadTrial(0);
    }

    generateTrials() {
        this.trials = [];
        let id = 1;

        for (const freq of this.config.frequencies) {
            for (const ssim of this.config.ssimTargets) {
                for (let r = 0; r < this.config.repetitions; r++) {
                    this.trials.push({
                        id: id++,
                        frequencyId: freq.id,
                        targetLevel: freq.target,
                        targetSSIM: ssim,
                        repetition: r + 1
                    });
                }
            }
        }
    }

    async loadTrial(index) {
        if (index >= this.trials.length) {
            this.endExperiment();
            return;
        }

        this.currentTrialIndex = index;
        const trial = this.trials[index];
        this.isTrialActive = false; // Block input while loading

        // UI Update
        this.display.trialCurrent.textContent = index + 1;
        const progress = ((index) / this.trials.length) * 100;
        this.display.progressBar.style.width = `${progress}%`;

        // Show loading state
        this.display.waitMessage.style.display = 'block';
        this.display.stimuliContainer.style.opacity = '0.5';

        // 1. Get Data (either from preload or generate now)
        let trialData;
        const startTime = performance.now();

        if (this.nextTrialIndex === index && this.nextTrialPromise) {
            // Use preloaded data
            console.log(`Using preloaded data for trial ${index}`);
            trialData = await this.nextTrialPromise;
        } else {
            // Generate on demand (first trial or if preload failed/mistimmed)
            console.log(`Generating data on demand for trial ${index}`);
            // Give UI a moment to render "Loading" text before freezing in generation
            await new Promise(r => setTimeout(r, 50));
            trialData = await this.generateTrialData(trial);
        }

        // 2. Render to Screen
        this.renderTrialDataToScreen(trialData);

        const loadTime = performance.now() - startTime;
        console.log(`Trial ${index} loaded in ${loadTime.toFixed(0)}ms`);

        // 3. UI Ready
        this.display.waitMessage.style.display = 'none';
        this.display.stimuliContainer.style.opacity = '1';
        this.isTrialActive = true;
        this.startTime = performance.now();

        // 4. Preload NEXT trial (background)
        const nextIndex = index + 1;
        if (nextIndex < this.trials.length) {
            console.log(`Starting preload for trial ${nextIndex}...`);
            this.nextTrialIndex = nextIndex;
            this.nextTrialPromise = this.generateTrialData(this.trials[nextIndex]);
        }
    }

    /**
     * Generates all data needed for a trial (heavy computation)
     */
    async generateTrialData(trial) {
        // 1. Setup Generator
        this.generator.updateDimensions(this.config.width, this.config.height);
        this.generator.sizeLevels = JSON.parse(JSON.stringify(this.config.sizeLevels));

        // 2. Generate Random Distribution (The "Base")
        this.generator.generateAll();

        // 3. Render "Original" (Unperturbed)
        const originalData = this.generator.renderTo1DArray(this.config.width, this.config.height, false, true);

        // 4. Find Perturbation Magnitude that matches SSIM Target
        const optimizationResult = await this.findMagnitudeForSSIM(trial.targetSSIM, trial.targetLevel, originalData);

        // Store optimization results in the trial object for recording later
        trial.actualMagnitude = optimizationResult.magnitude;
        trial.actualSSIM = optimizationResult.ssim;

        // 5. Randomly choose target position
        const targetPos = Math.floor(Math.random() * 4);

        return {
            originalData: originalData,
            perturbedData: optimizationResult.data,
            targetPos: targetPos,
            trial: trial
        };
    }

    /**
     * Puts the generated data onto the canvas
     */
    renderTrialDataToScreen(trialData) {
        this.currentTargetPos = trialData.targetPos;
        const originalData = trialData.originalData;
        const perturbedData = trialData.perturbedData;

        // Render to Canvases
        for (let i = 0; i < 4; i++) {
            const canvas = this.display.canvases[i];
            const ctx = canvas.getContext('2d');
            const data = (i === this.currentTargetPos) ? perturbedData : originalData;

            this.renderDataToCanvas(ctx, data, this.config.width, this.config.height);
        }
    }

    /**
     * Finds the magnitude that produces a result closest to the target SSIM.
     */
    async findMagnitudeForSSIM(targetSSIM, freqTarget, dataOriginal) {
        const tolerance = 0.001;
        const maxRetries = 5;
        const maxIterPerTry = 40;

        let bestOverallDiff = Infinity;
        let bestOverallResult = null;
        let bestOverallMagnitude = 0;
        let foundGoodResult = false;

        const coefficients = {
            position: 0,       // Auto-controlled by tanh saturation (in perturbation.js)
            stretch: 0.0,      // Disabled
            rotation: 1.0,     // Free to scale
            amplitude: 1.0     // Free to scale
        };

        for (let retry = 0; retry < maxRetries && !foundGoodResult; retry++) {
            this.perturbation.resetToOriginal();
            this.perturbation.setCoefficients(coefficients);
            this.perturbation.generatePerturbationDeltas(freqTarget, 1.0, 'all');

            // Adaptive max magnitude: large gaussians need higher values
            const maxMagnitude = (freqTarget === 'large') ? 8.0 : 5.0;
            let min = 0.0, max = maxMagnitude;
            let bestDiff = Infinity;

            for (let i = 0; i < maxIterPerTry; i++) {
                // Yield to main thread every 5 iterations to keep UI responsive
                if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));

                const mid = (min + max) / 2;

                this.perturbation.applyStoredPerturbation(mid);
                const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
                const tempPerturbed = saResult.perturbedTotal;

                const currentSSIM = calculateSSIM(dataOriginal, tempPerturbed, this.config.width, this.config.height);
                const diff = Math.abs(currentSSIM - targetSSIM);

                if (diff < bestDiff) {
                    bestDiff = diff;
                }

                if (diff < bestOverallDiff) {
                    bestOverallDiff = diff;
                    bestOverallMagnitude = mid;
                    bestOverallResult = tempPerturbed;

                    if (diff < tolerance) {
                        foundGoodResult = true;
                        break;
                    }
                }

                // Bisect (SSIM decreases as Magnitude increases)
                if (currentSSIM > targetSSIM) {
                    // Too similar -> Need more perturbation -> Increase Mag
                    min = mid;
                } else {
                    // Too different -> Need less perturbation -> Decrease Mag
                    max = mid;
                }
            }
        }

        if (!bestOverallResult) {
            console.warn("Failed to find valid perturbation, returning last attempt");
            // Fallback (should rarely happen)
            this.perturbation.applyStoredPerturbation(0);
            const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
            return { data: saResult.perturbedTotal, magnitude: 0, ssim: 1 };
        }

        return {
            data: bestOverallResult,
            magnitude: bestOverallMagnitude,
            ssim: calculateSSIM(dataOriginal, bestOverallResult, this.config.width, this.config.height)
        };
    }

    renderDataToCanvas(ctx, data, width, height) {
        const imgData = ctx.createImageData(width, height);

        // Auto-scale (min-max normalization) for display
        // Note: For 4AFC, strict absolute scaling consistency between Original and Perturbed 
        // is critical so brightness jumps don't give it away. 
        // Since originalData and perturbedData come from the same generator scale roughly,
        // we should ideally use a fixed global scale or per-image scale.
        // GaussianGenerator output is logarithmic. 
        // Let's use per-image min/max for now as brightness difference IS part of the perturbation signal sometimes,
        // BUT if the perturbation is purely shape, normalization might hide/accentuate it artifact-wise.
        // Better to use a consistent scale for the pair? 
        // In the Gallery we did per-image.
        // Let's stick to per-image for now to ensure visibility.

        let min = Infinity, max = -Infinity;
        for (let i = 0; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }

        const range = max - min || 1;

        for (let i = 0; i < data.length; i++) {
            const val = (data[i] - min) / range;
            const pixelIndex = i * 4;
            const color = Math.floor(val * 255);
            imgData.data[pixelIndex] = color;
            imgData.data[pixelIndex + 1] = color;
            imgData.data[pixelIndex + 2] = color;
            imgData.data[pixelIndex + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);
    }

    handleSelection(selectedIndex) {
        if (!this.isTrialActive) return;

        const endTime = performance.now();
        const reactionTime = endTime - this.startTime;
        const isCorrect = (selectedIndex === this.currentTargetPos);

        const trialData = this.trials[this.currentTrialIndex];

        // Record Result
        this.results.push({
            participantId: this.participantId,
            trialId: trialData.id,
            frequencyId: trialData.frequencyId,
            targetSSIM: trialData.targetSSIM,
            actualSSIM: trialData.actualSSIM,
            actualMagnitude: trialData.actualMagnitude,
            repetition: trialData.repetition,
            targetPosition: this.currentTargetPos,
            selectedPosition: selectedIndex,
            isCorrect: isCorrect ? 1 : 0,
            reactionTimeMs: Math.round(reactionTime),
            timestamp: new Date().toISOString()
        });

        // Move to next
        this.loadTrial(this.currentTrialIndex + 1);
    }

    endExperiment() {
        this.switchScreen('end');

        // Generate Completion Code
        const code = 'CMP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        document.getElementById('completion-code').textContent = code;

        // Auto-upload

        // Auto-upload
        this.uploadData();
    }

    // --- Helpers ---

    switchScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[screenName].classList.add('active');
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // --- Data Management ---

    generateCSV() {
        if (this.results.length === 0) return '';

        const headers = Object.keys(this.results[0]);
        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const row of this.results) {
            const values = headers.map(header => {
                const val = row[header];
                return `"${val}"`;
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    }

    async uploadData() {
        const csvData = this.generateCSV();
        if (!csvData) return;

        const statusMsg = document.createElement('p');
        statusMsg.textContent = 'Uploading data...';
        statusMsg.style.color = '#666';
        document.getElementById('upload-status').appendChild(statusMsg);

        try {
            const response = await fetch('/api/save_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participantId: this.participantId,
                    csvData: csvData
                })
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                statusMsg.textContent = '✅ Data saved to server successfully.';
                statusMsg.style.color = 'green';
            } else {
                throw new Error(result.message || 'Server error');
            }
        } catch (err) {
            console.error('Upload failed:', err);
            statusMsg.textContent = '⚠️ Upload failed. Please contact the researcher with your completion code.';
            statusMsg.style.color = 'orange';
        }
    }

    exportData() {
        if (this.results.length === 0) return;

        const csvString = this.generateCSV();
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `experiment_data_${this.participantId}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ExperimentController();
});
