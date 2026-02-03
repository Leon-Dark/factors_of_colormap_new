#!/usr/bin/env node

/**
 * Batch Colormap Generator
 * 
 * Generates 48 high-quality colormaps (3 hue targets × 4 chroma × 4 luminance patterns)
 * with strict quality control using Small/Large Window checks.
 */

const fs = require('fs');
const path = require('path');
const d3 = require('d3');
const { generate } = require('./lib/generator');
const { checkQuality } = require('./lib/quality_checker');
const { adjustControlPoints } = require('./lib/utils');

// Configuration
const CONFIG = {
    hueTargets: [100, 200, 300],  // Three hue targets
    maxRetries: 100,               // Maximum retry attempts per colormap

    // Optimization mode: 'FAST' or 'QUALITY'
    // FAST: ±3 local window, early termination when distance < 3
    // QUALITY: ±7 local window, exhaustive search for global optimum
    optimizationMode: 'QUALITY',  // Change to 'FAST' for speed, 'QUALITY' for best results

    // Incremental save: auto-save every N colormaps (0 = disabled, save only at end)
    incrementalSave: 10,  // Save every 10 colormaps to prevent data loss

    // Quality thresholds (Uniform mode)
    uniformSampleCount: 30,
    smallWindowK: 2,
    smallWindowThreshold: 3,
    largeWindowK: 5,
    largeWindowThreshold: 10
};

// Pattern arrays
const CHROMA_PATTERNS = {
    constant: [70, 70],
    linear: [20, 120],
    diverging: [20, 120, 20],
    thermal: [20, 120, 20, 120, 20]
};

const LUMI_PATTERNS = {
    constant: [55, 55],
    linear: [20, 90],
    diverging: [20, 90, 20],
    thermal: [20, 90, 20, 90, 20]
};

/**
 * Generate sorted perturbation offsets (greedy order: smallest first)
 */
function generatePerturbOffsets() {
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
 * Greedy search with local optimization
 * Strategy: Find first feasible, then locally refine
 */
function greedyLocalSearch(hue, chromaPattern, lumiPattern, perturbOffsets, verbose = false) {
    let attempts = 0;
    let firstFeasible = null;

    // Optimization parameters based on mode
    const optimizationParams = {
        'FAST': {
            localWindow: 3,
            earlyTerminationThreshold: 3,
            description: 'Fast mode (±3, early stop)'
        },
        'QUALITY': {
            localWindow: 7,
            earlyTerminationThreshold: 0,  // Never early terminate
            description: 'Quality mode (±7, exhaustive)'
        }
    };

    const params = optimizationParams[CONFIG.optimizationMode] || optimizationParams['FAST'];

    // Phase 1: Find first feasible solution (greedy)
    for (const [deltaC, deltaL] of perturbOffsets) {
        attempts++;

        const adjustedChroma = adjustControlPoints(chromaPattern, deltaC);
        const adjustedLumi = adjustControlPoints(lumiPattern, deltaL);

        const chroma_target = Math.max(...adjustedChroma) - Math.min(...adjustedChroma);
        const lumi_target = Math.max(...adjustedLumi) - Math.min(...adjustedLumi);

        const colormap = generate(hue, chroma_target, lumi_target, adjustedChroma, adjustedLumi);

        if (colormap.length > 0) {
            const actualColormap = colormap[0].colormap;
            const quality = checkQuality(actualColormap, CONFIG);

            if (quality.passAll) {
                firstFeasible = {
                    deltaC,
                    deltaL,
                    colormap: colormap[0],
                    adjustedChroma,
                    adjustedLumi,
                    distance: Math.hypot(deltaC, deltaL)
                };
                break;  // Found first feasible, stop greedy search
            }
        }
    }

    if (!firstFeasible) {
        return { solution: null, attempts: attempts };
    }

    // Early termination check (only in FAST mode)
    if (params.earlyTerminationThreshold > 0 && firstFeasible.distance < params.earlyTerminationThreshold) {
        if (verbose) {
            console.log(`  Early termination: distance=${firstFeasible.distance.toFixed(2)} < ${params.earlyTerminationThreshold}`);
        }
        return { solution: firstFeasible, attempts: attempts };
    }

    // Phase 2: Local refinement with adaptive window size
    let bestSolution = firstFeasible;
    const { deltaC: baseC, deltaL: baseL } = firstFeasible;
    const localWindow = params.localWindow;

    for (let dc = Math.max(0, baseC - localWindow); dc <= Math.min(100, baseC + localWindow); dc++) {
        for (let dl = Math.max(0, baseL - localWindow); dl <= Math.min(70, baseL + localWindow); dl++) {
            const dist = Math.hypot(dc, dl);

            // Skip if worse than current best
            if (dist >= bestSolution.distance) continue;

            attempts++;
            const adjustedChroma = adjustControlPoints(chromaPattern, dc);
            const adjustedLumi = adjustControlPoints(lumiPattern, dl);

            const chroma_target = Math.max(...adjustedChroma) - Math.min(...adjustedChroma);
            const lumi_target = Math.max(...adjustedLumi) - Math.min(...adjustedLumi);

            const colormap = generate(hue, chroma_target, lumi_target, adjustedChroma, adjustedLumi);

            if (colormap.length > 0) {
                const actualColormap = colormap[0].colormap;
                const quality = checkQuality(actualColormap, CONFIG);

                if (quality.passAll) {
                    bestSolution = {
                        deltaC: dc,
                        deltaL: dl,
                        colormap: colormap[0],
                        adjustedChroma,
                        adjustedLumi,
                        distance: dist
                    };
                }
            }
        }
    }

    if (verbose && bestSolution) {
        console.log(`  ${params.description}: ${attempts} attempts → [${bestSolution.deltaC}, ${bestSolution.deltaL}] (dist=${bestSolution.distance.toFixed(2)})`);
    }

    return { solution: bestSolution, attempts: attempts };
}

/**
 * Generate a single colormap with greedy + local optimization
 */
function generateOneColormap(hue, chromaPattern, lumiPattern, chromaName, lumiName, perturbOffsets, verbose = false) {
    let retryCount = 0;
    let actualHue = hue;
    let result = null;

    // Keep trying until we get a colormap that passes quality checks
    while (!result && retryCount < CONFIG.maxRetries) {
        const searchResult = greedyLocalSearch(actualHue, chromaPattern, lumiPattern, perturbOffsets, verbose);

        if (searchResult.solution) {
            const best = searchResult.solution;
            result = {
                success: true,
                colormap: best.colormap,
                metadata: {
                    hueTarget: hue,
                    actualHue: actualHue,
                    chromaPattern: chromaName,
                    lumiPattern: lumiName,
                    originalChroma: chromaPattern,
                    originalLumi: lumiPattern,
                    adjustedChroma: best.adjustedChroma,
                    adjustedLumi: best.adjustedLumi,
                    deltaC: best.deltaC,
                    deltaL: best.deltaL,
                    retryCount: retryCount,
                    searchStats: {
                        attempts: searchResult.attempts
                    }
                }
            };
            break;
        }

        // If greedy search failed, try different hue
        if (!result) {
            retryCount++;
            actualHue = hue + (Math.random() - 0.5) * 20;  // Random offset ±10 degrees
            if (verbose && retryCount % 10 === 0) {
                console.log(`  Retry ${retryCount}: adjusting hue to ${actualHue.toFixed(1)}°`);
            }
        }
    }

    if (!result) {
        return {
            success: false,
            metadata: {
                hueTarget: hue,
                chromaPattern: chromaName,
                lumiPattern: lumiName,
                retryCount: retryCount
            }
        };
    }

    return result;
}

/**
 * Main batch generation function
 */
function batchGenerate(options = {}) {
    const {
        perCombination = 1,  // How many colormaps per parameter combination
        outputDir = 'output',
        verbose = false
    } = options;

    console.log('═══════════════════════════════════════════════');
    console.log('  Batch Colormap Generator (Greedy + Local)');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Hue targets: ${CONFIG.hueTargets.join(', ')}°`);
    console.log(`  Chroma patterns: ${Object.keys(CHROMA_PATTERNS).join(', ')}`);
    console.log(`  Luminance patterns: ${Object.keys(LUMI_PATTERNS).join(', ')}`);
    console.log(`  Total combinations: 48`);
    console.log(`  Colormaps per combination: ${perCombination}`);
    console.log(`  Total target: ${48 * perCombination} colormaps`);
    console.log(`  Optimization mode: ${CONFIG.optimizationMode}`);
    const modeDesc = CONFIG.optimizationMode === 'FAST'
        ? '(±3 window, early stop)'
        : '(±7 window, exhaustive)';
    console.log(`  Strategy: Greedy search + Local optimization ${modeDesc}`);
    if (CONFIG.incrementalSave > 0) {
        console.log(`  💾 Auto-save: Every ${CONFIG.incrementalSave} colormaps`);
    }
    console.log('═══════════════════════════════════════════════\n');

    // Generate perturbation offsets
    const perturbOffsets = generatePerturbOffsets();
    if (verbose) {
        console.log(`Generated ${perturbOffsets.length} perturbation offsets\n`);
    }

    // Results storage
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let totalCombinations = 0;
    let totalAttempts = 0;

    // Iterate through all combinations
    for (const hue of CONFIG.hueTargets) {
        for (const [lumiName, lumiPattern] of Object.entries(LUMI_PATTERNS)) {
            for (const [chromaName, chromaPattern] of Object.entries(CHROMA_PATTERNS)) {
                totalCombinations++;

                for (let n = 0; n < perCombination; n++) {
                    const combinationLabel = `H=${hue}, C=${chromaName}, L=${lumiName}` +
                        (perCombination > 1 ? ` #${n + 1}` : '');
                    process.stdout.write(`[${totalCombinations}/48] Generating: ${combinationLabel}... `);

                    const result = generateOneColormap(
                        hue,
                        chromaPattern,
                        lumiPattern,
                        chromaName,
                        lumiName,
                        perturbOffsets,
                        verbose
                    );

                    if (result.success) {
                        successCount++;
                        const stats = result.metadata.searchStats;
                        totalAttempts += stats.attempts;

                        console.log(`✓ [Δ=${result.metadata.deltaC},${result.metadata.deltaL}] (${stats.attempts} attempts)`);

                        // Convert colormap to exportable format
                        const exportData = {
                            id: results.length,
                            metadata: result.metadata,
                            colormap: result.colormap.colormap.map(c => [c.r, c.g, c.b]),
                            hValues: result.colormap.hValues,
                            cValues: result.colormap.cValues,
                            lValues: result.colormap.lValues
                        };

                        results.push(exportData);

                        // Incremental save
                        if (CONFIG.incrementalSave > 0 && results.length % CONFIG.incrementalSave === 0) {
                            if (!fs.existsSync(outputDir)) {
                                fs.mkdirSync(outputDir, { recursive: true });
                            }
                            const outputPath = path.join(outputDir, 'colormaps.json');
                            fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
                            console.log(`  💾 Auto-saved ${results.length} colormaps to ${outputPath}`);
                        }
                    } else {
                        failCount++;
                        console.log(`✗ FAILED after ${result.metadata.retryCount} retries`);
                    }
                }
            }
        }
    }

    // Final save (ensures all data is saved even if not a multiple of incrementalSave)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'colormaps.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    if (CONFIG.incrementalSave > 0) {
        console.log(`\n💾 Final save: ${results.length} colormaps → ${outputPath}`);
    }

    // Print summary
    console.log('\n═══════════════════════════════════════════════');
    console.log('  Generation Complete!');
    console.log('═══════════════════════════════════════════════');
    console.log(`  ✓ Success: ${successCount}/${48 * perCombination}`);
    console.log(`  ✗ Failed:  ${failCount}/${48 * perCombination}`);
    console.log(`  Pass rate: ${(successCount / (48 * perCombination) * 100).toFixed(1)}%`);
    if (successCount > 0) {
        console.log(`  Avg attempts per colormap: ${(totalAttempts / successCount).toFixed(1)}`);
    }
    console.log(`  Output:    ${outputPath}`);
    console.log('═══════════════════════════════════════════════\n');

    return results;
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--count':
            case '-n':
                options.perCombination = parseInt(args[++i]);
                break;
            case '--output':
            case '-o':
                options.outputDir = args[++i];
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--help':
            case '-h':
                console.log(`
Usage: node batch_generate.js [options]

Options:
  -n, --count <n>      Number of colormaps per combination (default: 1)
  -o, --output <dir>   Output directory (default: 'output')
  -v, --verbose        Verbose logging
  -h, --help           Show this help message

Examples:
  node batch_generate.js                    # Generate 48 colormaps (1 per combination)
  node batch_generate.js -n 2 -o results    # Generate 96 colormaps (2 per combination)
  node batch_generate.js -v                 # Generate with verbose output
                `);
                process.exit(0);
        }
    }

    batchGenerate(options);
}

module.exports = { batchGenerate };
