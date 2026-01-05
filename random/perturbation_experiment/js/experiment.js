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
            magnitudes: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
            frequencies: [
                { id: 'low', target: 'large' },
                { id: 'medium', target: 'medium' },
                { id: 'high', target: 'small' }
            ],
            // Gaussian Generation Params (Same as Gallery but scaled if needed)
            // Here using the standard settings from main app default
            sizeLevels: {
                'small': { sigma: 15, count: 4, color: '#377eb8' },
                'medium': { sigma: 25, count: 4, color: '#4daf4a' },
                'large': { sigma: 50, count: 4, color: '#ff7f00' }
            }
        };

        // --- State ---
        this.trials = [];
        this.currentTrialIndex = 0;
        this.results = [];
        this.participantId = '';
        this.isTrialActive = false;
        this.startTime = 0;

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
            for (const mag of this.config.magnitudes) {
                for (let r = 0; r < this.config.repetitions; r++) {
                    this.trials.push({
                        id: id++,
                        frequencyId: freq.id,
                        targetLevel: freq.target,
                        magnitude: mag,
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
        this.display.waitMessage.style.display = 'block';
        this.display.stimuliContainer.style.opacity = '0.5';

        // Use setTimeout to allow UI to render "Loading" state
        setTimeout(async () => {
            await this.renderTrial(trial);

            this.display.waitMessage.style.display = 'none';
            this.display.stimuliContainer.style.opacity = '1';
            this.isTrialActive = true;
            this.startTime = performance.now();
        }, 50);
    }

    async renderTrial(trial) {
        // 1. Setup Generator
        this.generator.updateDimensions(this.config.width, this.config.height);
        // Force reset params to ensure consistency
        this.generator.sizeLevels = JSON.parse(JSON.stringify(this.config.sizeLevels));

        // 2. Generate Random Distribution (The "Base")
        this.generator.generateAll();

        // 3. Render "Original" (Unperturbed)
        // renderTo1DArray(width, height, useOriginal, useGradientNormalization)
        // We useGradientNormalization=true normally, let's stick to default consistent with main app
        const originalData = this.generator.renderTo1DArray(this.config.width, this.config.height, false, true);

        // 4. Create "Perturbed" version
        // Apply Physical Perturbation
        this.perturbation.resetToOriginal();
        // Perturb 50% of target level (same as gallery)
        this.perturbation.applyGlobalPerturbation(trial.magnitude, 0.5, trial.targetLevel, 'all');

        // Apply Soft Attribution Gating
        const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
        const perturbedData = saResult.perturbedTotal;

        // 5. Assign to Slots
        // Randomly choose target position (0-3)
        const targetPos = Math.floor(Math.random() * 4);
        this.currentTargetPos = targetPos;

        // Render to Canvases
        for (let i = 0; i < 4; i++) {
            const canvas = this.display.canvases[i];
            const ctx = canvas.getContext('2d');
            const data = (i === targetPos) ? perturbedData : originalData;

            this.renderDataToCanvas(ctx, data, this.config.width, this.config.height);
        }
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
            magnitude: trialData.magnitude,
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
