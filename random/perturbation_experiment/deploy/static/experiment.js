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
            repetitions: 1, // Trials per condition
            ssimTargets: [0.995, 0.994, 0.993, 0.992, 0.991, 0.990, 0.989, 0.988, 0.987, 0.986, 0.985, 0.984, 0.983, 0.982, 0.981, 0.980, 0.979, 0.978, 0.977, 0.976],
            frequencies: [
                { id: 'low', target: 'large' },
                { id: 'medium', target: 'medium' },
                { id: 'high', target: 'small' }
            ],
            // Gaussian Generation Params
            // User Request: 4 small(σ=15, high), 3 medium(σ=25, mid), 2 large(σ=50, low)
            sizeLevels: {
                'small': { sigma: 15, count: 2, color: '#377eb8' },
                'medium': { sigma: 25, count: 3, color: '#4daf4a' },
                'large': { sigma: 50, count: 4, color: '#ff7f00' }
            },
            preloadBufferSize: 15, // Maintain a buffer of 15 trials ahead (continuous preload)
            initialPreloadCount: 5 // Initial burst: only 5 trials (fast start)
        };

        // --- State ---
        this.trials = [];
        this.currentTrialIndex = 0;
        this.results = [];
        this.participantId = '';
        this.isTrialActive = false;
        this.startTime = 0;

        // Preloading System
        this.preloadedTrials = new Map(); // Index -> Promise
        this.preloadPointer = 0;
        this.isPreloading = false;
        this.concurrentLoadLimit = 3; // Max concurrent image loads
        this.activeLoads = 0;

        // --- Components ---
        // Image naming configuration (based on generation rules)
        this.imageNaming = {
            totalReps: 20,
            ssimPerFreq: 20,
            filesPerRep: 60, // 20 SSIM × 3 frequencies
            basePath: '/perturbation_images/images/'
        };
        
        // Real-time Generation System (for engagement checks)
        this.generator = new GaussianGenerator(this.config.width, this.config.height);
        this.perturbation = new PerturbationSystem(this.generator);
        this.softAttribution = new SoftAttributionPerturbation(this.generator);
        
        // Initialize Web Worker for SSIM optimization
        this.ssimWorker = new Worker('static/ssim-worker.js');
        this.workerBusy = false;

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
            start: document.getElementById('btn-start'),

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
            
            // Don't wait for library - will load on-demand if needed
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




    }

    // --- Experiment Flow ---

    async startExperiment() {
        this.generateTrials();
        this.shuffleArray(this.trials);
        this.insertEngagementChecks();

        // UI Update
        this.display.trialTotal.textContent = this.trials.length;
        this.switchScreen('experiment');

        // Start first trial immediately (priority)
        this.loadTrial(0);

        // Delay background preload slightly to let first trial load smoothly
        setTimeout(() => {
            this.initialPreloadBackground();
        }, 1000); // Start after 1 second
    }

    /**
     * Pre-generate all engagement check trials in the background (async, non-blocking)
     */
    async preGenerateEngagementChecksAsync() {
        const engagementTrials = this.trials
            .map((trial, index) => ({ trial, index }))
            .filter(item => item.trial.isEngagementCheck);

        console.log(`🔄 Background: Starting to pre-generate ${engagementTrials.length} engagement checks...`);

        for (const { trial, index } of engagementTrials) {
            // Only generate if not already in cache
            if (!this.preloadedTrials.has(index)) {
                const startTime = performance.now();
                
                // Start generation and store the promise immediately (don't await yet)
                const generationPromise = this.generateTrialDataRealtime(trial);
                this.preloadedTrials.set(index, generationPromise);
                
                // Wait for this one to complete before starting the next
                // This prevents overwhelming the CPU but doesn't block the main thread
                try {
                    await generationPromise;
                    const duration = performance.now() - startTime;
                    console.log(`  ✓ Engagement check ${trial.id} (trial #${index + 1}) generated in ${duration.toFixed(0)}ms`);
                } catch (error) {
                    console.error(`  ✗ Failed to generate engagement check ${trial.id}:`, error);
                }
            }
        }

        console.log('✓ All engagement checks pre-generated successfully');
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
                        repetition: r + 1,
                        isEngagementCheck: false
                    });
                }
            }
        }
    }

    insertEngagementChecks() {
        // Insert catch trials at specific indices: 15, 30, 45
        // We do this AFTER shuffling normal trials so their position is fixed absolute
        const checkPositions = [15, 30, 45];

        // Use 'medium' frequency for checks, but very easy SSIM
        const checkTrialTempl = {
            frequencyId: 'medium',
            targetLevel: 'medium',
            targetSSIM: 0.90,
            isEngagementCheck: true,
            repetition: 0
        };

        let insertedCount = 0;
        checkPositions.forEach(pos => {
            // Adjust position for previously inserted items if we wanted relative, 
            // but user likely means absolute index in the final sequence.
            // Since we insert into an array, inserting at 15 shifts everything after.
            // So if we want them at exactly 15, 30, 45 of the FINAL array:
            // We should insert them. Note that inserting at 15 makes the old 15 become 16.
            // If the user meant "after 15th trial" (index 15), "after 30th trial" (index 30)...

            // Let's assume 0-based index 15, 30, 45.
            if (pos <= this.trials.length) {
                const trial = { ...checkTrialTempl, id: 9000 + insertedCount };
                this.trials.splice(pos, 0, trial);
                insertedCount++;
            }
        });

        // Re-index slightly or just keep IDs unique
        this.trials.forEach((t, i) => t.trialIndex = i);
    }

    async loadTrial(index) {
        if (index >= this.trials.length) {
            this.endExperiment();
            return;
        }

        this.currentTrialIndex = index;
        const trial = this.trials[index];
        this.isTrialActive = false; // Block input while loading
        this.isTrialActive = false; // Block input while loading

        // UI Update
        this.display.trialCurrent.textContent = index + 1;
        const progress = ((index) / this.trials.length) * 100;
        this.display.progressBar.style.width = `${progress}%`;

        // Cleanup old preloads
        for (const [key, val] of this.preloadedTrials) {
            if (key < index) this.preloadedTrials.delete(key);
        }

        // Trigger buffering for future trials
        this.queuePreload();

        // Show loading state
        this.display.waitMessage.style.display = 'block';
        this.display.stimuliContainer.style.opacity = '0.5';

        // 1. Get Data (either from preload or generate now)
        let trialData;
        const startTime = performance.now();

        if (this.preloadedTrials.has(index)) {
            // Use preloaded data

            trialData = await this.preloadedTrials.get(index);
        } else {
            // Generate on demand (first trial or if preload failed/mistimmed)

            // Give UI a moment to render "Loading" text
            await new Promise(r => setTimeout(r, 50));

            const p = this.generateTrialData(trial);
            this.preloadedTrials.set(index, p); // Store promise
            trialData = await p;
        }

        // 2. Render to Screen
        this.renderTrialDataToScreen(trialData);

        const loadTime = performance.now() - startTime;


        // 3. UI Ready
        this.display.waitMessage.style.display = 'none';
        this.display.stimuliContainer.style.opacity = '1';
        this.isTrialActive = true;

        this.startTime = performance.now();
    }

    /**
     * Minimal blocking preload: only first 3 trials to start quickly
     */
    async initialPreloadMinimal() {
        const count = Math.min(1, this.trials.length);
        console.log(`Initial preload: Loading first ${count} trials (blocking)...`);
        
        const promises = [];
        for (let i = 0; i < count; i++) {
            if (!this.preloadedTrials.has(i)) {
                const promise = this.generateTrialData(this.trials[i]);
                this.preloadedTrials.set(i, promise);
                promises.push(promise);
            }
        }
        
        // Wait for first 3 to complete
        await Promise.all(promises);
        this.preloadPointer = count;
        
        console.log(`Initial preload complete: ${count} trials ready, starting experiment`);
    }

    /**
     * Background preload: controlled concurrency to avoid overwhelming server
     */
    async initialPreloadBackground() {
        const count = Math.min(this.config.initialPreloadCount, this.trials.length);
        console.log(`Background preload: Loading ${count} trials (controlled concurrency)...`);
        
        // Load in controlled batches to avoid server overload
        for (let i = 0; i < count; i++) {
            // Wait if too many concurrent loads
            while (this.activeLoads >= this.concurrentLoadLimit) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (!this.preloadedTrials.has(i)) {
                this.activeLoads++;
                const promise = this.generateTrialData(this.trials[i]);
                this.preloadedTrials.set(i, promise);
                
                // Decrement counter when done
                promise.finally(() => {
                    this.activeLoads--;
                }).catch(err => {
                    console.error(`Preload trial ${i + 1} failed:`, err);
                });
            }
        }
        
        this.preloadPointer = count;
    }

    /**
     * Manages the background generation of future trials
     */
    async queuePreload() {
        if (this.isPreloading) return; // Already running
        this.isPreloading = true;

        try {
            // Start looking from the next trial
            if (this.preloadPointer <= this.currentTrialIndex) {
                this.preloadPointer = this.currentTrialIndex + 1;
            }

            // Fill buffer
            while (this.preloadPointer < this.trials.length &&
                this.preloadPointer < this.currentTrialIndex + this.config.preloadBufferSize) {

                // If not already in map, generate it
                if (!this.preloadedTrials.has(this.preloadPointer)) {

                    const promise = this.generateTrialData(this.trials[this.preloadPointer]);

                    this.preloadedTrials.set(this.preloadPointer, promise);

                    // Wait for it to finish so we don't hog CPU (sequential background loading)
                    await promise;
                }

                this.preloadPointer++;
            }
        } catch (e) {
            console.error("Preload error:", e);
        } finally {
            this.isPreloading = false;
            // If we still have room (e.g. user moved fast during generation), restart loop
            if (this.preloadPointer < this.trials.length &&
                this.preloadPointer < this.currentTrialIndex + this.config.preloadBufferSize) {
                this.queuePreload();
            }
        }
    }

    /**
     * Calculate image file paths based on naming rules (no metadata loading needed)
     * Naming: {ID}_{frequency}_ssim_{ssimValue}_rep{repetition}_{type}.png
     * Generation order: rep -> frequency (low, medium, high) -> ssim (20 values)
     */
    calculateImagePath(frequencyId, targetSSIM, randomRep = null) {
        // Randomly select a repetition if not specified
        const rep = randomRep || Math.floor(Math.random() * this.imageNaming.totalReps) + 1;
        
        // Calculate frequency offset within each rep
        const freqOffset = {
            'low': 0,
            'medium': this.imageNaming.ssimPerFreq,
            'high': this.imageNaming.ssimPerFreq * 2
        }[frequencyId];
        
        // Find SSIM index in the list (0-19)
        const ssimIndex = this.config.ssimTargets.findIndex(s => 
            Math.abs(s - targetSSIM) < 0.00001
        );
        
        if (ssimIndex === -1) {
            console.warn(`SSIM ${targetSSIM} not found in targets`);
            return null;
        }
        
        // Calculate global file ID
        const repBaseId = (rep - 1) * this.imageNaming.filesPerRep;
        const fileId = repBaseId + freqOffset + ssimIndex + 1;
        
        // Format file name
        const idStr = fileId.toString().padStart(4, '0');
        const ssimStr = targetSSIM.toFixed(5);
        const prefix = `${idStr}_${frequencyId}_ssim_${ssimStr}_rep${rep}`;
        
        return {
            prefix: prefix,
            originalPath: `${this.imageNaming.basePath}${prefix}_original.png`,
            perturbedPath: `${this.imageNaming.basePath}${prefix}_perturbed.png`,
            repetition: rep
        };
    }

    /**
     * Select image path based on trial configuration (rule-based, no metadata needed)
     */
    selectImageForTrial(trial) {
        // Directly calculate the image path based on naming rules
        const imagePaths = this.calculateImagePath(trial.frequencyId, trial.targetSSIM);
        
        if (!imagePaths) {
            console.error(`Failed to calculate image path for trial ${trial.id}`);
            return null;
        }
        
        console.log(`Trial ${trial.id} [${trial.frequencyId}]: SSIM = ${trial.targetSSIM.toFixed(5)}, Rep = ${imagePaths.repetition}, File = ${imagePaths.prefix}`);
        
        return imagePaths;
    }

    /**
     * Load trial data - use real-time generation for engagement checks, 
     * pregenerated images for normal trials
     */
    async generateTrialData(trial) {
        // Check if this is an engagement check trial
        if (trial.isEngagementCheck) {
            // Real-time generation for engagement checks
            return await this.generateTrialDataRealtime(trial);
        } else {
            // Use pregenerated images for normal trials
            return await this.generateTrialDataFromLibrary(trial);
        }
    }

    /**
     * Load trial data from pregenerated images (normal trials)
     */
    async generateTrialDataFromLibrary(trial) {
        // 1. Select appropriate image from library
        const imageInfo = this.selectImageForTrial(trial);
        
        if (!imageInfo) {
            throw new Error(`No suitable image found for trial ${trial.id}`);
        }

        // 2. Load images
        const originalImg = await this.loadImage(imageInfo.originalPath);
        const perturbedImg = await this.loadImage(imageInfo.perturbedPath);

        // Store trial info (actual SSIM/magnitude unknown without loading metadata, use target)
        trial.actualMagnitude = null; // Unknown without metadata
        trial.actualSSIM = trial.targetSSIM; // Assume target is accurate
        trial.actualKL = null; // Unknown without metadata

        // 3. Randomly choose target position
        const targetPos = Math.floor(Math.random() * 4);

        return {
            originalImg: originalImg,
            perturbedImg: perturbedImg,
            targetPos: targetPos,
            trial: trial,
            isRealtime: false
        };
    }

    /**
     * Generate trial data in real-time (for engagement checks)
     */
    async generateTrialDataRealtime(trial) {
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

        // Log SSIM values
        console.log(`Trial ${trial.id} [${trial.frequencyId}] (ENGAGEMENT CHECK): Target SSIM = ${trial.targetSSIM.toFixed(5)}, Actual SSIM = ${trial.actualSSIM.toFixed(5)}, Diff = ${Math.abs(trial.targetSSIM - trial.actualSSIM).toFixed(6)}`);

        // 5. Randomly choose target position
        const targetPos = Math.floor(Math.random() * 4);

        return {
            originalData: originalData,
            perturbedData: optimizationResult.data,
            targetPos: targetPos,
            trial: trial,
            isRealtime: true
        };
    }

    /**
     * Load an image and return as HTMLImageElement (with retry)
     */
    async loadImage(path, retries = 3) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
                    img.src = path + (attempt > 0 ? `?retry=${attempt}` : ''); // Cache busting on retry
                });
            } catch (err) {
                if (attempt === retries) {
                    console.error(`Image load failed after ${retries + 1} attempts: ${path}`);
                    throw err;
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
                console.log(`Retrying image load (attempt ${attempt + 2}/${retries + 1}): ${path}`);
            }
        }
    }

    /**
     * Puts the loaded images or generated data onto the canvas
     */
    renderTrialDataToScreen(trialData) {
        this.currentTargetPos = trialData.targetPos;

        // Render to Canvases
        for (let i = 0; i < 4; i++) {
            const canvas = this.display.canvases[i];
            const ctx = canvas.getContext('2d');

            if (trialData.isRealtime) {
                // Real-time generated data (Float32Array)
                const data = (i === this.currentTargetPos) ? trialData.perturbedData : trialData.originalData;
                this.renderDataToCanvas(ctx, data, this.config.width, this.config.height);
            } else {
                // Preloaded images (HTMLImageElement)
                const img = (i === this.currentTargetPos) ? trialData.perturbedImg : trialData.originalImg;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
        }
    }

    /**
     * Render Float32Array data to canvas (for real-time generation)
     */
    renderDataToCanvas(ctx, data, width, height) {
        const imgData = ctx.createImageData(width, height);

        // Auto-scale (min-max normalization) for display
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

    /**
     * Finds the magnitude that produces a result closest to the target SSIM.
     * Uses Web Worker for heavy computation to keep UI responsive.
     */
    async findMagnitudeForSSIM(targetSSIM, freqTarget, dataOriginal) {
        const coefficients = {
            position: 0,       // Auto-controlled by tanh saturation (in perturbation.js)
            stretch: 0.0,      // Disabled
            rotation: 1.0,     // Free to scale
            amplitude: 1.0     // Free to scale
        };

        // Export generator state for worker
        const generatorState = this.generator.exportConfig();

        // Send optimization task to worker
        return new Promise((resolve, reject) => {
            const messageHandler = (e) => {
                const { type, result, error } = e.data;
                
                if (type === 'SUCCESS') {
                    // Convert array back to Float32Array
                    const perturbedData = new Float32Array(result.data);
                    
                    this.ssimWorker.removeEventListener('message', messageHandler);
                    this.workerBusy = false;
                    
                    resolve({
                        data: perturbedData,
                        magnitude: result.magnitude,
                        ssim: result.ssim
                    });
                } else if (type === 'ERROR') {
                    console.error('Worker error:', error);
                    this.ssimWorker.removeEventListener('message', messageHandler);
                    this.workerBusy = false;
                    reject(new Error(error));
                }
            };

            this.ssimWorker.addEventListener('message', messageHandler);
            this.workerBusy = true;

            // Send task to worker
            this.ssimWorker.postMessage({
                type: 'OPTIMIZE_SSIM',
                data: {
                    targetSSIM,
                    freqTarget,
                    generatorState,
                    width: this.config.width,
                    height: this.config.height,
                    sizeLevels: this.config.sizeLevels,
                    coefficients,
                    tolerance: 0.0001,
                    maxRetries: 6,
                    maxIterPerTry: 60
                }
            });
        });
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

        // Check engagement check performance
        const engagementResults = this.results.filter(r => {
            const trial = this.trials.find(t => t.id === r.trialId);
            return trial && trial.isEngagementCheck;
        });

        const failedChecks = engagementResults.filter(r => r.isCorrect === 0);
        const passedEngagement = failedChecks.length === 0;

        if (passedEngagement) {
            // Success: Show completion code
            document.getElementById('success-container').style.display = 'block';
            document.getElementById('failure-container').style.display = 'none';
            
            const code = 'CMP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            document.getElementById('completion-code').textContent = code;
            
            this.uploadData();
        } else {
            // Failure: Show retry message
            document.getElementById('success-container').style.display = 'none';
            document.getElementById('failure-container').style.display = 'block';
            document.getElementById('end-title').textContent = 'Experiment Incomplete';
            document.getElementById('end-message').textContent = '';
            
            const details = `Failed ${failedChecks.length} out of ${engagementResults.length} attention checks.`;
            document.getElementById('engagement-details').textContent = details;
            
            // Bind restart button
            document.getElementById('btn-restart').addEventListener('click', () => {
                location.reload();
            });
            
            // Do not upload data for failed attempts
            console.log('Engagement check failed. Data will not be uploaded.');
        }
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
