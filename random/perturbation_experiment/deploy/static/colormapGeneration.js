// Colormap Generation System
// Ported from stimuli/js/colorGeneration.js and main.js

class ColormapGenerator {
    constructor() {
        // Quality check parameters (from config.js)
        this.SAMPLE_COUNT = 30;
        this.SMALL_INTERVAL_K = 2;
        this.SMALL_MIN_DIFF = 3;
        this.LARGE_INTERVAL_K = 5;
        this.LARGE_MIN_DIFF = 10;

        // Color space parameters (from config.js)
        this.HUE_TARGETS = [100, 200, 300];
        this.CHROMAS = [20, 120];
        this.LUMIS = [20, 90];

        // Pattern definitions
        this.CHROMA_PATTERNS = {
            'Constant': [70, 70],
            'Linear': [20, 120],
            'Diverging': [20, 120, 20],
            'Thermal': [20, 120, 20, 120, 20]
        };

        this.LUMI_PATTERNS = {
            'Constant': [55, 55],
            'Linear': [20, 90],
            'Diverging': [20, 90, 20],
            'Thermal': [20, 90, 20, 90, 20]
        };

        // Perturbation offsets for quality optimization
        this.perturbOffsets = this.generatePerturbOffsets();
    }

    /**
     * Generate perturbation offsets with layered step sizes
     * @returns {Array} - Array of [deltaC, deltaL] pairs
     */
    generatePerturbOffsets() {
        const offsets = [];

        // Fine search: 0-20 with step 2
        for (let i = 0; i <= 20; i += 2) {
            for (let j = 0; j <= 20; j += 2) {
                offsets.push([i, j]);
            }
        }

        // Medium search: 25-50 with step 5
        for (let i = 25; i <= 50; i += 5) {
            for (let j = 25; j <= 50; j += 5) {
                offsets.push([i, j]);
            }
        }

        // Coarse search: 60-100 with step 10
        for (let i = 60; i <= 100; i += 10) {
            for (let j = 60; j <= 70; j += 10) {
                offsets.push([i, j]);
            }
        }

        // Sort by Euclidean distance (prefer smaller adjustments)
        offsets.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));

        return offsets;
    }

    /**
     * Generate all 48 colormaps
     * @returns {Array} - Array of colormap objects
     */
    async generateAll48Colormaps() {
        console.log('Starting colormap generation for 48 combinations...');
        const colormaps = [];
        let successCount = 0;
        let failCount = 0;

        for (const hue of this.HUE_TARGETS) {
            for (const [lumiName, lumiPattern] of Object.entries(this.LUMI_PATTERNS)) {
                for (const [chromaName, chromaPattern] of Object.entries(this.CHROMA_PATTERNS)) {
                    console.log(`Generating: H=${hue}, C=${chromaName}, L=${lumiName}`);

                    const result = this.generateColormap(hue, chromaPattern, lumiPattern, chromaName, lumiName);

                    if (result) {
                        colormaps.push({
                            id: colormaps.length,
                            hue: hue,
                            chromaPattern: chromaName,
                            lumiPattern: lumiName,
                            colormap: result.colormap,
                            hValues: result.hValues,
                            cValues: result.cValues,
                            lValues: result.lValues,
                            adjustedHue: result.actualHue,
                            deltaC: result.usedDeltaC,
                            deltaL: result.usedDeltaL,
                            retries: result.retryCount
                        });
                        successCount++;
                    } else {
                        console.error(`Failed to generate: H=${hue}, C=${chromaName}, L=${lumiName}`);
                        failCount++;
                    }
                }
            }
        }

        console.log(`Colormap generation complete: ${successCount} succeeded, ${failCount} failed`);
        return colormaps;
    }

    /**
     * Generate a single colormap with retry logic
     * @param {number} targetHue - Target hue value
     * @param {Array} chromaPattern - Chroma control points
     * @param {Array} lumiPattern - Luminance control points
     * @param {string} chromaName - Pattern name for logging
     * @param {string} lumiName - Pattern name for logging
     * @returns {Object|null} - Colormap data or null if failed
     */
    generateColormap(targetHue, chromaPattern, lumiPattern, chromaName, lumiName) {
        let colormap = [];
        let adjustedChroma = chromaPattern;
        let adjustedLumi = lumiPattern;
        let usedDeltaC = 0;
        let usedDeltaL = 0;
        let retryCount = 0;
        let actualHue = targetHue;
        let passesQualityCheck = false;
        let bestResult = null;

        // Keep trying until we get a colormap that passes quality checks
        while (!passesQualityCheck && retryCount < 100) {
            // Try different perturbation offsets
            for (let i = 0; i < this.perturbOffsets.length; i++) {
                const [deltaC, deltaL] = this.perturbOffsets[i];

                // Adjust control points while preserving shape
                adjustedChroma = adjustControlPoints(chromaPattern, deltaC);
                adjustedLumi = adjustControlPoints(lumiPattern, deltaL);

                // Calculate target ranges from adjusted control points
                const chroma_target = Math.max(...adjustedChroma) - Math.min(...adjustedChroma);
                const lumi_target = Math.max(...adjustedLumi) - Math.min(...adjustedLumi);

                // Generate colormap with adjusted control points
                colormap = this.generate(actualHue, chroma_target, lumi_target, adjustedChroma, adjustedLumi);

                if (colormap.length > 0) {
                    // Colormap generated successfully, now check quality
                    const actualColormap = colormap[0].colormap;
                    const hclPalette = convertColormapToHCLPalette(actualColormap);
                    const smallWindowDiff = calcUniformIntervalMinDiff(hclPalette, this.SMALL_INTERVAL_K, this.SAMPLE_COUNT);
                    const largeWindowDiff = calcUniformIntervalMinDiff(hclPalette, this.LARGE_INTERVAL_K, this.SAMPLE_COUNT);

                    const passSmall = smallWindowDiff >= this.SMALL_MIN_DIFF;
                    const passLarge = largeWindowDiff >= this.LARGE_MIN_DIFF;

                    if (passSmall && passLarge) {
                        // Quality check passed!
                        usedDeltaC = deltaC;
                        usedDeltaL = deltaL;
                        passesQualityCheck = true;
                        bestResult = {
                            ...colormap[0],
                            actualHue,
                            usedDeltaC,
                            usedDeltaL,
                            retryCount
                        };
                        break;  // Success! Stop trying perturbations
                    } else {
                        // Quality check failed, keep trying
                        colormap = []; // Reset to continue loop
                    }
                }
            }

            // If still failed after all perturbations, try a slightly different hue
            if (!passesQualityCheck) {
                retryCount++;
                actualHue = targetHue + (Math.random() - 0.5) * 20;  // Random offset ±10 degrees
                if (retryCount % 10 === 0) {
                    console.log(`  Retry ${retryCount} with adjusted hue=${actualHue.toFixed(1)}`);
                }
            }
        }

        if (passesQualityCheck && bestResult) {
            if (retryCount > 0) {
                console.log(`  ✓ Quality passed after ${retryCount} retries`);
            }
            return bestResult;
        } else {
            console.error(`  ❌ Failed after ${retryCount} retries`);
            return null;
        }
    }

    /**
     * Core colormap generation logic
     * @param {number} targetH - Hue range
     * @param {number} targetC - Chroma range
     * @param {number} targetL - Luminance range
     * @param {Array} controlPoints_c - Chroma control points
     * @param {Array} controlPoints_l - Luminance control points
     * @returns {Array} - Array of candidate colormaps
     */
    generate(targetH, targetC, targetL, controlPoints_c, controlPoints_l) {
        if (targetC < 0 || targetL < 0) return [];

        const cControls = parseControlPoints(controlPoints_c);
        const lControls = parseControlPoints(controlPoints_l);

        let hue_start = Math.random() * 360;

        const sampleN = 256;
        const step = 20;
        const candidates = [];

        for (let hStart = 0; hStart <= 360; hStart += step) {
            for (let cBase = 20; cBase <= 130 - targetC; cBase += step) {
                for (let lBase = 20; lBase <= 100 - targetL; lBase += step) {
                    const hEnd = (hue_start + hStart - targetH + 360) % 360;
                    const colormap = [];
                    const hValues = [], cValues = [], lValues = [];

                    for (let i = 0; i < sampleN; i++) {
                        const t = i / (sampleN - 1);
                        const h1 = (hue_start + hStart) % 360;
                        const h2 = hEnd;
                        let hue;
                        if (h2 < h1)
                            hue = (h1 + (h2 - h1) * t) % 360;
                        else
                            hue = (h1 + (h2 - h1 - 360) * t + 360) % 360;
                        const h = hue;

                        const cInterp = interpolateMultiSegment(t, cControls);
                        const cMin = d3.min(cControls), cMax = d3.max(cControls);
                        let cNorm = (cInterp - cMin) / Math.max(1e-5, cMax - cMin);
                        let c = cBase + targetC * cNorm;
                        if (controlPoints_c[0] == controlPoints_c[1]) {
                            c = 20 - cBase + controlPoints_c[0];
                        }

                        const lInterp = interpolateMultiSegment(t, lControls);
                        const lMin = d3.min(lControls), lMax = d3.max(lControls);
                        let lNorm = (lInterp - lMin) / Math.max(1e-5, lMax - lMin);
                        let l = lBase + targetL * lNorm;
                        if (controlPoints_l[0] == controlPoints_l[1]) {
                            l = 20 - lBase + controlPoints_l[0];
                        }

                        const rgb = d3.hcl(h, c, l).rgb();
                        if (!rgb.displayable()) break;
                        colormap.push(d3.rgb(rgb.r, rgb.g, rgb.b));
                        hValues.push(h);
                        cValues.push(c);
                        lValues.push(l);
                    }

                    if (colormap.length === sampleN && satisfyDiscriminability(colormap)) {
                        candidates.push({ colormap, hValues, cValues, lValues });
                    }
                }
            }
        }

        // Sort candidates by chroma and luminance error
        candidates.sort((a, b) => {
            const errA = Math.abs(d3.max(a.cValues) - d3.max(controlPoints_c) + d3.min(controlPoints_c) - d3.min(a.cValues)) +
                Math.abs(d3.max(a.lValues) - d3.max(controlPoints_l) + d3.min(controlPoints_l) - d3.min(a.lValues));
            const errB = Math.abs(d3.max(b.cValues) - d3.max(controlPoints_c) + d3.min(controlPoints_c) - d3.min(b.cValues)) +
                Math.abs(d3.max(b.lValues) - d3.max(controlPoints_l) + d3.min(controlPoints_l) - d3.min(b.lValues));
            return errA - errB;
        });

        return candidates;
    }
}
