/**
 * Experiment Controller
 * Handles logic for the 4AFC Gaussian Perturbation Experiment
 */

// ============================================================================
// Viridis Colormap
// ============================================================================

// Viridis colormap lookup table (256 colors)
const VIRIDIS_COLORMAP = [
    [68, 1, 84], [68, 2, 86], [69, 4, 87], [69, 5, 89], [70, 7, 90], [70, 8, 92], [70, 10, 93], [70, 11, 94],
    [71, 13, 96], [71, 14, 97], [71, 16, 99], [71, 17, 100], [71, 19, 101], [72, 20, 103], [72, 22, 104], [72, 23, 105],
    [72, 24, 106], [72, 26, 108], [72, 27, 109], [72, 28, 110], [72, 29, 111], [72, 31, 112], [72, 32, 113], [72, 33, 115],
    [72, 35, 116], [72, 36, 117], [72, 37, 118], [72, 38, 119], [72, 40, 120], [72, 41, 121], [71, 42, 122], [71, 44, 122],
    [71, 45, 123], [71, 46, 124], [71, 47, 125], [70, 48, 126], [70, 50, 126], [70, 51, 127], [70, 52, 128], [69, 53, 129],
    [69, 55, 129], [69, 56, 130], [68, 57, 131], [68, 58, 131], [68, 59, 132], [67, 61, 132], [67, 62, 133], [66, 63, 133],
    [66, 64, 134], [66, 65, 134], [65, 66, 135], [65, 68, 135], [64, 69, 136], [64, 70, 136], [63, 71, 136], [63, 72, 137],
    [62, 73, 137], [62, 74, 137], [62, 76, 138], [61, 77, 138], [61, 78, 138], [60, 79, 138], [60, 80, 139], [59, 81, 139],
    [59, 82, 139], [58, 83, 139], [58, 84, 140], [57, 85, 140], [57, 86, 140], [56, 88, 140], [56, 89, 140], [55, 90, 140],
    [55, 91, 141], [54, 92, 141], [54, 93, 141], [53, 94, 141], [53, 95, 141], [52, 96, 141], [52, 97, 141], [51, 98, 141],
    [51, 99, 141], [50, 100, 142], [50, 101, 142], [49, 102, 142], [49, 103, 142], [49, 104, 142], [48, 105, 142], [48, 106, 142],
    [47, 107, 142], [47, 108, 142], [46, 109, 142], [46, 110, 142], [46, 111, 142], [45, 112, 142], [45, 113, 142], [44, 113, 142],
    [44, 114, 142], [44, 115, 142], [43, 116, 142], [43, 117, 142], [42, 118, 142], [42, 119, 142], [42, 120, 142], [41, 121, 142],
    [41, 122, 142], [41, 123, 142], [40, 124, 142], [40, 125, 142], [39, 126, 142], [39, 127, 142], [39, 128, 142], [38, 129, 142],
    [38, 130, 142], [38, 130, 142], [37, 131, 142], [37, 132, 142], [37, 133, 142], [36, 134, 142], [36, 135, 142], [35, 136, 142],
    [35, 137, 142], [35, 138, 141], [34, 139, 141], [34, 140, 141], [34, 141, 141], [33, 142, 141], [33, 143, 141], [33, 144, 141],
    [33, 145, 140], [32, 146, 140], [32, 146, 140], [32, 147, 140], [31, 148, 140], [31, 149, 139], [31, 150, 139], [31, 151, 139],
    [31, 152, 139], [31, 153, 138], [31, 154, 138], [30, 155, 138], [30, 156, 137], [30, 157, 137], [31, 158, 137], [31, 159, 136],
    [31, 160, 136], [31, 161, 136], [31, 161, 135], [31, 162, 135], [32, 163, 134], [32, 164, 134], [33, 165, 133], [33, 166, 133],
    [34, 167, 133], [34, 168, 132], [35, 169, 131], [36, 170, 131], [37, 171, 130], [37, 172, 130], [38, 173, 129], [39, 173, 129],
    [40, 174, 128], [41, 175, 127], [42, 176, 127], [44, 177, 126], [45, 178, 125], [46, 179, 124], [47, 180, 124], [49, 181, 123],
    [50, 182, 122], [52, 182, 121], [53, 183, 121], [55, 184, 120], [56, 185, 119], [58, 186, 118], [59, 187, 117], [61, 188, 116],
    [63, 188, 115], [64, 189, 114], [66, 190, 113], [68, 191, 112], [70, 192, 111], [72, 193, 110], [74, 193, 109], [76, 194, 108],
    [78, 195, 107], [80, 196, 106], [82, 197, 105], [84, 197, 104], [86, 198, 103], [88, 199, 101], [90, 200, 100], [92, 200, 99],
    [94, 201, 98], [96, 202, 96], [99, 203, 95], [101, 203, 94], [103, 204, 92], [105, 205, 91], [108, 205, 90], [110, 206, 88],
    [112, 207, 87], [115, 208, 86], [117, 208, 84], [119, 209, 83], [122, 209, 81], [124, 210, 80], [127, 211, 78], [129, 211, 77],
    [132, 212, 75], [134, 213, 73], [137, 213, 72], [139, 214, 70], [142, 214, 69], [144, 215, 67], [147, 215, 65], [149, 216, 64],
    [152, 216, 62], [155, 217, 60], [157, 217, 59], [160, 218, 57], [162, 218, 55], [165, 219, 54], [168, 219, 52], [170, 220, 50],
    [173, 220, 48], [176, 221, 47], [178, 221, 45], [181, 222, 43], [184, 222, 41], [186, 222, 40], [189, 223, 38], [192, 223, 37],
    [194, 223, 35], [197, 224, 33], [200, 224, 32], [202, 225, 31], [205, 225, 29], [208, 225, 28], [210, 226, 27], [213, 226, 26],
    [216, 226, 25], [218, 227, 25], [221, 227, 24], [223, 227, 24], [226, 228, 24], [229, 228, 25], [231, 228, 25], [234, 229, 26],
    [236, 229, 27], [239, 229, 28], [241, 229, 29], [244, 230, 30], [246, 230, 32], [248, 230, 33], [251, 231, 35], [253, 231, 37]
];

function getViridisColor(normalizedValue) {
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));
    const index = Math.floor(clampedValue * (VIRIDIS_COLORMAP.length - 1));
    return VIRIDIS_COLORMAP[index];
}


// --- Seeded RNG Helper ---
class SeededRandom {
    constructor(seed) {
        this.seed = this._hashString(String(seed));
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Returns a pseudo-random number between 0 and 1
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    // Shuffle array in place
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}


class ExperimentController {
    constructor() {
        // --- Configuration ---
        // Simplified: Only 3 specific SSIM targets
        this.config = {
            width: 200,
            height: 200, // Matches canvas size in HTML
            repetitions: 1, // Trials per condition
            // Map each frequency to its specific SSIM target
            frequencies: [
                { id: 'low', target: 'large', ssim: 0.954 },
                { id: 'medium', target: 'medium', ssim: 0.982 },
                { id: 'high', target: 'small', ssim: 0.956 }
            ],
            // Colormap configuration (will be populated with 48 colormaps)
            useGrayscale: false, // Set to true to use grayscale for testing
            colormaps: [],
            engagementCheckInterval: 16, // Insert engagement check every 24 trials
            // Gaussian Generation Params
            sizeLevels: {
                'small': { sigma: 15, count: 2, color: '#377eb8' },
                'medium': { sigma: 25, count: 3, color: '#4daf4a' },
                'large': { sigma: 50, count: 4, color: '#ff7f00' }
            },
            preloadBufferSize: 10, // Buffer for 144 trials
            initialPreloadCount: 2 // Initial burst
        };

        // --- Optimization Lookups ---
        // No longer needed with simplified trial structure

        // --- Components ---
        // Real-time generation only - no image library needed

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

            // Initialize Retry Count from LocalStorage
            this.retryCount = parseInt(localStorage.getItem('perturb_retry_' + pid) || '0');

            console.log(`Participant ${pid} starting (Retry #${this.retryCount}) with real-time generation`);
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
        // Generate colormaps if not already generated
        // Load colormaps from JSON (or use grayscale) if not already loaded
        if (this.config.colormaps.length === 0) {

            if (this.config.useGrayscale) {
                console.log('Testing Mode: Using Grayscale...');
                // Generate a linear grayscale colormap (0-255)
                const grayscaleMap = [];
                for (let i = 0; i < 256; i++) {
                    grayscaleMap.push({ r: i, g: i, b: i });
                }

                // Create 48 identical "trials" using this grayscale map
                // (We still need 48 items to satisfy the latinsquare/grouping logic)
                for (let i = 0; i < 48; i++) {
                    this.config.colormaps.push({
                        id: `gray_${i}`,
                        hue: 'gray',
                        chromaPattern: 'gray',
                        lumiPattern: 'gray',
                        colormap: grayscaleMap
                    });
                }

                // Fall through to common start logic

            } else {
                console.log('Loading 48 colormaps from JSON...');
                this.switchScreen('experiment');
                this.display.waitMessage.style.display = 'block';
                this.display.waitMessage.textContent = 'Loading colormaps, please wait...';

                try {
                    const response = await fetch('static/colormaps.json');
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const rawColormaps = await response.json();

                    // Map JSON data to expected format
                    this.config.colormaps = rawColormaps.map(item => ({
                        id: item.id,
                        hue: item.metadata.hueTarget,
                        chromaPattern: item.metadata.chromaPattern,
                        lumiPattern: item.metadata.lumiPattern,
                        // Convert [r, g, b] arrays to {r, g, b} objects for compatibility
                        colormap: item.colormap.map(c => ({
                            r: c[0],
                            g: c[1],
                            b: c[2]
                        }))
                    }));

                    console.log(`Successfully loaded ${this.config.colormaps.length} colormaps`);
                } catch (error) {
                    console.error('Failed to load colormaps:', error);
                    alert('Failed to load colormaps. Please refresh the page.');
                    return;
                }
            }

            this.display.waitMessage.style.display = 'none';
        }

        await this.generateTrials();
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
            this.preGenerateEngagementChecksAsync();
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



    async generateTrials() {
        this.trials = [];
        let id = 1;

        // 1. Get Participant Group (Smart Assignment from Server)
        this.display.waitMessage.style.display = 'block';
        this.display.waitMessage.textContent = 'Assigning participant group...';

        let group;
        try {
            // Request assignment from server
            const response = await fetch('/api/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participantId: this.participantId })
            });

            if (!response.ok) throw new Error('Assignment server error');
            const data = await response.json();
            group = data.group;
            console.log(`Server assigned Participant ${this.participantId} to Group ${group}`);

        } catch (error) {
            console.warn('Server assignment failed, falling back to local hash:', error);
            // Fallback to local hash if server fails
            let hash = 0;
            const pidStr = this.participantId;
            for (let i = 0; i < pidStr.length; i++) {
                hash = (hash << 5) - hash + pidStr.charCodeAt(i);
                hash |= 0;
            }
            group = Math.abs(hash) % 3;
            console.log(`Fallback: Participant ${this.participantId} assigned to Group ${group}`);
        }

        // 2. Deterministically Shuffle Colormaps (Global Shuffle)
        // Use a FIXED seed so everyone gets the same "Chunks" of colormaps
        const globalRng = new SeededRandom("GLOBAL_EXPERIMENT_SEED_V1");

        // Clone and Shuffle
        const shuffledColormaps = [...this.config.colormaps];
        globalRng.shuffle(shuffledColormaps);

        // 3. Split into 3 Chunks (A, B, C)
        const chunkSize = 16; // 48 / 3
        const chunks = [
            shuffledColormaps.slice(0, chunkSize),              // Chunk A
            shuffledColormaps.slice(chunkSize, chunkSize * 2),  // Chunk B
            shuffledColormaps.slice(chunkSize * 2, chunkSize * 3) // Chunk C
        ];

        // 4. Assign Chunks to Frequencies (Latin Square)
        const assignments = {
            'low': chunks[(group + 0) % 3],
            'medium': chunks[(group + 1) % 3],
            'high': chunks[(group + 2) % 3]
        };

        console.log('Assignments:', {
            'Low': `Chunk ${(group + 0) % 3} (${assignments['low'].length})`,
            'Medium': `Chunk ${(group + 1) % 3} (${assignments['medium'].length})`,
            'High': `Chunk ${(group + 2) % 3} (${assignments['high'].length})`
        });

        // 5. Generate Trials
        for (const freq of this.config.frequencies) {
            const assignedColormaps = assignments[freq.id];

            for (const colormap of assignedColormaps) {
                for (let r = 0; r < this.config.repetitions; r++) {
                    this.trials.push({
                        id: id++,
                        frequencyId: freq.id,
                        targetLevel: freq.target,
                        targetSSIM: freq.ssim,
                        colormap: colormap, // Include full colormap object
                        colormapId: colormap.id,
                        colormapHue: colormap.hue,
                        colormapChromaPattern: colormap.chromaPattern,
                        colormapLumaPattern: colormap.lumiPattern,
                        repetition: r + 1,
                        isEngagementCheck: false
                    });
                }
            }
        }

        console.log(`Generated ${this.trials.length} main trials (16 per frequency)`);
    }


    insertEngagementChecks() {
        // Insert engagement checks every 24 trials (≈6 checks for 144 trials)
        const interval = this.config.engagementCheckInterval;
        let insertCount = 0;

        // Use first colormap for engagement checks (simple constant pattern)
        // Find the specific engagement colormap requested: Thermal Thermal Hue=300
        const engagementColormap = this.config.colormaps.find(c =>
            c.hue === 300 &&
            (c.chromaPattern === 'thermal' || c.chromaPattern === 'Thermal') &&
            (c.lumiPattern === 'thermal' || c.lumiPattern === 'Thermal')
        ) || this.config.colormaps[0] || null;

        if (engagementColormap) {
            console.log(`Using Engagement Colormap: ID=${engagementColormap.id}, Hue=${engagementColormap.hue}, Patterns=${engagementColormap.chromaPattern}/${engagementColormap.lumiPattern}`);
        }

        for (let pos = interval; pos <= this.trials.length; pos += interval + 1) {
            const checkTrial = {
                id: 9000 + insertCount,
                frequencyId: 'medium',
                targetLevel: 'medium',
                targetSSIM: 0.80,
                colormap: engagementColormap,
                colormapId: engagementColormap ? engagementColormap.id : 0,
                colormapHue: engagementColormap ? engagementColormap.hue : 100,
                colormapChromaPattern: engagementColormap ? engagementColormap.chromaPattern : 'Constant',
                colormapLumaPattern: engagementColormap ? engagementColormap.lumiPattern : 'Constant',
                isEngagementCheck: true,
                repetition: 0
            };
            this.trials.splice(pos + insertCount, 0, checkTrial);
            insertCount++;
        }

        // Re-index
        this.trials.forEach((t, i) => t.trialIndex = i);
        console.log(`Inserted ${insertCount} engagement checks`);
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

    // calculateImagePath removed - using real-time generation only

    // getRepetitionOffset and selectImageForTrial removed - using real-time generation only

    /**
     * Load trial data - always use real-time generation
     */
    async generateTrialData(trial) {
        // Always use real-time generation for all trials
        return await this.generateTrialDataRealtime(trial);
    }


    /**
     * Generate trial data in real-time
     */
    async generateTrialDataRealtime(trial) {
        // 1. Setup Generator
        this.generator.updateDimensions(this.config.width, this.config.height);
        this.generator.sizeLevels = JSON.parse(JSON.stringify(this.config.sizeLevels));

        // Set custom colormap if available
        if (trial.colormap) {
            this.generator.setColormap(trial.colormap);
        }

        // 2. Generate Random Distribution (The "Base")
        this.generator.generateAll();

        // 3. Render "Original" (Unperturbed)
        const originalData = this.generator.renderTo1DArray(this.config.width, this.config.height, false, true);

        // 4. Find Perturbation Magnitude that matches SSIM Target
        const optimizationResult = await this.findMagnitudeForSSIM(
            trial.targetSSIM,
            trial.targetLevel,
            originalData,
            trial.isEngagementCheck // New argument
        );

        // Store optimization results in the trial object for recording later
        trial.actualMagnitude = optimizationResult.magnitude;
        trial.actualSSIM = optimizationResult.ssim;

        // Log SSIM values
        console.log(`Trial ${trial.id} [${trial.frequencyId}]: Target SSIM = ${trial.targetSSIM.toFixed(5)}, Actual SSIM = ${trial.actualSSIM.toFixed(5)}, Diff = ${Math.abs(trial.targetSSIM - trial.actualSSIM).toFixed(6)}`);

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
     * Puts the generated data onto the canvas
     */
    renderTrialDataToScreen(trialData) {
        this.currentTargetPos = trialData.targetPos;

        // Render to Canvases (all trials use real-time data now)
        for (let i = 0; i < 4; i++) {
            const canvas = this.display.canvases[i];
            const ctx = canvas.getContext('2d');

            const data = (i === this.currentTargetPos) ? trialData.perturbedData : trialData.originalData;
            this.renderDataToCanvas(ctx, data, this.config.width, this.config.height);
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

        // Get colormap from generator (or fallback to viridis)
        const customColormap = this.generator.currentColormap;

        for (let i = 0; i < data.length; i++) {
            const val = (data[i] - min) / range;
            const pixelIndex = i * 4;

            // Use custom colormap if available, otherwise fallback to viridis
            let r, g, b;
            if (customColormap) {
                [r, g, b] = applyCustomColormap(val, customColormap);
            } else {
                [r, g, b] = getViridisColor(val);
            }

            imgData.data[pixelIndex] = r;
            imgData.data[pixelIndex + 1] = g;
            imgData.data[pixelIndex + 2] = b;
            imgData.data[pixelIndex + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);
    }

    /**
     * Finds the magnitude that produces a result closest to the target SSIM.
     * Uses Web Worker for heavy computation to keep UI responsive.
     */
    async findMagnitudeForSSIM(targetSSIM, freqTarget, dataOriginal, isEngagementCheck = false) {
        const coefficients = {
            position: 1.0,     // Auto-controlled by tanh saturation (in perturbation.js)
            stretch: 0.0,      // Disabled
            rotation: 1.0,     // Free to scale
            amplitude: 0.0     // Free to scale
        };

        // Generate a unique ID for this request
        const requestId = Math.random().toString(36).substring(2, 15);


        // Export generator state for worker
        const generatorState = this.generator.exportConfig();

        // Send optimization task to worker
        return new Promise((resolve, reject) => {
            const messageHandler = (e) => {
                const { type, id, result, error } = e.data;

                // Only process messages matching our request ID
                if (id !== requestId) return;

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
                    id: requestId, // Pass ID to worker
                    targetSSIM,
                    freqTarget,
                    generatorState,
                    width: this.config.width,
                    height: this.config.height,
                    sizeLevels: this.config.sizeLevels,
                    coefficients,
                    isEngagementCheck: isEngagementCheck, // Pass trial type to worker
                    tolerance: 0.001,
                    maxRetries: 6,
                    maxIterPerTry: 20
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
            colormapId: trialData.colormapId,
            colormapHue: trialData.colormapHue,
            colormapChromaPattern: trialData.colormapChromaPattern,
            colormapLumaPattern: trialData.colormapLumaPattern,
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
            document.getElementById('btn-restart').onclick = () => {
                // Increment retry counter for this participant
                const pidKey = 'perturb_retry_' + this.participantId;
                const currentRetries = parseInt(localStorage.getItem(pidKey) || '0');
                localStorage.setItem(pidKey, currentRetries + 1);

                location.reload();
            };

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
