// Main Entry Point - Generate All Colormaps

function generateAll() {
    // Clear previous results
    d3.select("#colormapsGrid").selectAll("*").remove();
    allColormaps = [];
    colormapElements = [];

    const hue_targets = COLOR_SPACE_PARAMS.hueTargets;
    const chromas = COLOR_SPACE_PARAMS.chromas;
    const lumis = COLOR_SPACE_PARAMS.lumis;

    const chroma_array = [
        [70, 70],                                   // Constant
        [chromas[0], chromas[1]],                   // Linear
        [chromas[0], chromas[1], chromas[0]],       // Diverging
        [chromas[0], chromas[1], chromas[0], chromas[1], chromas[0]] // Thermal
    ];

    const lumi_array = [
        [55, 55],                                   // Constant
        [lumis[0], lumis[1]],                       // Linear
        [lumis[0], lumis[1], lumis[0]],             // Diverging
        [lumis[0], lumis[1], lumis[0], lumis[1], lumis[0]] // Thermal
    ];

    // Generate perturbation offsets with layered step sizes
    // Fine search for small adjustments (0-20, step=2)
    // Medium search for moderate adjustments (25-50, step=5)
    // Coarse search for large adjustments (60-100, step=10)
    const perturbOffsets = [];

    // Fine search: 0-20 with step 2
    for (let i = 0; i <= 20; i += 2) {
        for (let j = 0; j <= 20; j += 2) {
            perturbOffsets.push([i, j]);
        }
    }

    // Medium search: 25-50 with step 5
    for (let i = 25; i <= 50; i += 5) {
        for (let j = 25; j <= 50; j += 5) {
            perturbOffsets.push([i, j]);
        }
    }

    // Coarse search: 60-100 with step 10
    for (let i = 60; i <= 100; i += 10) {
        for (let j = 60; j <= 70; j += 10) {
            perturbOffsets.push([i, j]);
        }
    }

    // Sort by Euclidean distance (prefer smaller adjustments)
    perturbOffsets.sort((a, b) =>
        Math.hypot(...a) - Math.hypot(...b)
    );
    console.log(`Generated ${perturbOffsets.length} perturbation offsets`);

    let colormap_count = 0;
    let hue_index = 0;

    for (let hue of hue_targets) {
        for (let lumi of lumi_array) {
            for (let chroma of chroma_array) {
                let colormap = [];
                let adjustedChroma = chroma;
                let adjustedLumi = lumi;
                let usedDeltaC = 0;
                let usedDeltaL = 0;
                let retryCount = 0;
                let actualHue = hue;
                let passesQualityCheck = false;

                // Keep trying until we get a colormap that passes quality checks
                while (!passesQualityCheck && retryCount < 100) {
                    // Try different perturbation offsets
                    for (let i = 0; i < perturbOffsets.length; i++) {
                        const [deltaC, deltaL] = perturbOffsets[i];

                        // Adjust control points while preserving shape
                        adjustedChroma = adjustControlPoints(chroma, deltaC);
                        adjustedLumi = adjustControlPoints(lumi, deltaL);

                        // Calculate target ranges from adjusted control points
                        const chroma_target = Math.max(...adjustedChroma) - Math.min(...adjustedChroma);
                        const lumi_target = Math.max(...adjustedLumi) - Math.min(...adjustedLumi);

                        // Generate colormap with adjusted control points
                        colormap = generate(actualHue, chroma_target, lumi_target, adjustedChroma, adjustedLumi);

                        if (colormap.length > 0) {
                            // Colormap generated successfully, now check quality
                            // Note: generate() returns [{colormap, hValues, cValues, lValues}, ...]
                            const actualColormap = colormap[0].colormap;
                            const hclPalette = convertColormapToHCLPalette(actualColormap);
                            const smallWindowDiff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_SMALL_INTERVAL_K, UNIFORM_SAMPLE_COUNT);
                            const largeWindowDiff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_LARGE_INTERVAL_K, UNIFORM_SAMPLE_COUNT);

                            const passSmall = smallWindowDiff >= UNIFORM_SMALL_MIN_DIFF;
                            const passLarge = largeWindowDiff >= UNIFORM_LARGE_MIN_DIFF;

                            if (passSmall && passLarge) {
                                // Quality check passed!
                                usedDeltaC = deltaC;
                                usedDeltaL = deltaL;
                                passesQualityCheck = true;
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
                        actualHue = hue + (Math.random() - 0.5) * 20;  // Random offset ±10 degrees
                        if (retryCount % 10 === 0) {
                            console.log(`Retry ${retryCount} for H=${hue}, C=[${chroma}], L=[${lumi}] with adjusted hue=${actualHue.toFixed(1)}`);
                        }
                    }
                }

                if (passesQualityCheck && colormap.length > 0) {
                    const hueNote = actualHue !== hue ? ` (adjusted H=${actualHue.toFixed(1)})` : '';
                    const condition = `H diff=${hue}${hueNote}, C=[${chroma}]→[${adjustedChroma}], L=[${adjustedLumi}]` +
                        ` (ΔC=${usedDeltaC}, ΔL=${usedDeltaL})`;
                    if (retryCount > 0) {
                        console.log(`✓ Quality passed after ${retryCount} retries`);
                    }
                    drawGivenColormap2(colormap[0], (colormap_count++) + ", " + condition);
                } else {
                    console.error(`❌ Failed to generate quality colormap after ${retryCount} retries for H=${hue}, C=[${chroma}], L=[${lumi}]`);
                }
            }
        }
        hue_index++;
    }

    // Update statistics after all colormaps are generated
    updateStatistics();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('Stimuli Generator loaded - Modular version');
    console.log('Current sampling mode:', SAMPLING_MODE);

    // Initialize c3 color naming library (async)
    if (typeof c3 !== 'undefined' && typeof d3 !== 'undefined') {
        try {
            // Use async loading to avoid synchronous XMLHttpRequest issues
            c3.load('../rainbows good or bad for/supplementary materials/experiment interface/lib/colorname/c3_data.json', true);
            console.log('c3 color naming library loading (async)...');

            // Check after a delay if c3.color is available
            setTimeout(function () {
                if (c3.color && c3.color.length > 0) {
                    console.log('c3 initialized successfully with', c3.color.length, 'colors');
                } else {
                    console.warn('c3 not fully initialized, using LAB color difference fallback');
                }
            }, 1000);
        } catch (e) {
            console.warn('Failed to initialize c3 (using fallback):', e.message);
        }
    } else {
        console.warn('c3 or d3 not available, using LAB color difference fallback');
    }
});
