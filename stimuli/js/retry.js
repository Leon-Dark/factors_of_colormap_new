// Retry Logic Module - Handle re-generation of failed colormaps

/**
 * Get all currently failed colormaps
 * @returns {Array} Array of failed colormap data with indices
 */
function getFailedColormaps() {
    const failed = [];

    allColormaps.forEach((cm, index) => {
        let isFailed = false;

        if (SAMPLING_MODE === 'jnd') {
            const passCond1 = cm.metrics.jnd_consistency >= JND_STEP;
            const passCond2 = cm.metrics.sample_interval_min_diff >= MIN_INTERVAL_DIFF_J;
            isFailed = !passCond1 || !passCond2;
        } else {
            isFailed = cm.metrics.uniform_min_diff < UNIFORM_MIN_DIFF_THRESHOLD;
        }

        if (isFailed) {
            failed.push({
                index: index,
                data: cm,
                element: colormapElements[index]
            });
        }
    });

    return failed;
}

/**
 * Re-generate a single colormap with expanded search range
 * @param {Object} failedItem - The failed colormap item
 * @param {number} iteration - Current iteration number (1-based)
 * @returns {Object|null} New colormap candidate or null if still failed
 */
function retryGeneration(failedItem, iteration) {
    const cm = failedItem.data;

    // Parse generation parameters from condition string
    const condition = cm.condition;
    const hueMatch = condition.match(/H diff=(\d+)/);
    const chromaMatch = condition.match(/C=\[([^\]]+)\]/);
    const lumiMatch = condition.match(/L=\[([^\]]+)\]/);

    if (!hueMatch || !chromaMatch || !lumiMatch) {
        console.warn('Could not parse condition:', condition);
        return null;
    }

    const targetH = parseInt(hueMatch[1]);
    const chromaVals = chromaMatch[1].split(',').map(v => parseFloat(v.trim()));
    const lumiVals = lumiMatch[1].split(',').map(v => parseFloat(v.trim()));

    // Calculate base targets
    const chroma_target = chromaVals.length > 1 ? chromaVals[1] - chromaVals[0] : 0;
    const luminance_target = lumiVals.length > 1 ? lumiVals[1] - lumiVals[0] : 0;

    // Expand perturbation offsets based on iteration
    const baseExpand = RETRY_SEARCH_RANGE_EXPAND * iteration;
    const perturbOffsets = [];

    for (let i = 0; i <= 70 + baseExpand; i += 5) {
        for (let j = 0; j <= 50 + baseExpand; j += 5) {
            perturbOffsets.push([i, j]);
        }
    }
    perturbOffsets.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));

    // Try to generate with expanded range
    for (let i = 0; i < perturbOffsets.length; i++) {
        const used_chroma = Math.max(0, chroma_target - perturbOffsets[i][0]);
        const used_lumi = Math.max(0, luminance_target - perturbOffsets[i][1]);

        const colormap = generate(targetH, used_chroma, used_lumi, chromaVals, lumiVals);

        if (colormap.length > 0) {
            // Check if new colormap passes
            const newColormap = colormap[0].colormap;
            const hclPalette = newColormap.map(color => {
                const lab = d3.lab(color);
                const hcl = d3.hcl(lab);
                return [hcl.h, hcl.c, hcl.l];
            });

            let passes = false;

            if (SAMPLING_MODE === 'jnd') {
                const jndSamples = generateJndSamples(hclPalette, JND_STEP);
                const jndConsistency = calcJndConsistency(jndSamples, JND_STEP) || 0;
                const intervalDiff = calcSampleIntervalMinDiff(jndSamples, SAMPLE_INTERVAL_K, JND_STEP) || 0;
                passes = jndConsistency >= JND_STEP && intervalDiff >= MIN_INTERVAL_DIFF_J;
            } else {
                const uniformDiff = calcUniformMinDiff(hclPalette, UNIFORM_SAMPLE_COUNT) || 0;
                passes = uniformDiff >= UNIFORM_MIN_DIFF_THRESHOLD;
            }

            if (passes) {
                return {
                    candidate: colormap[0],
                    usedChroma: used_chroma,
                    usedLumi: used_lumi,
                    chromaTarget: chroma_target,
                    lumiTarget: luminance_target
                };
            }
        }
    }

    return null;
}

/**
 * Update the visual display of a colormap after retry
 * @param {number} index - Index in allColormaps
 * @param {Object} newData - New colormap data
 * @param {number} iteration - Iteration that succeeded
 */
function updateColormapDisplay(index, newData, iteration) {
    const element = colormapElements[index];
    if (!element) return;

    const div = d3.select(element);

    // Update border to show improved status (green = pass)
    div.style("border-color", "#4CAF50")
        .style("border-width", "3px");
}

/**
 * Run the complete retry iteration process
 * @param {number} maxIterations - Maximum number of iterations
 */
async function runRetryIterations(maxIterations) {
    if (isRetrying) {
        console.warn('Retry already in progress');
        return;
    }

    isRetrying = true;
    retryHistory = [];

    const progressDiv = document.getElementById('retryProgress');
    const resultsDiv = document.getElementById('retryResults');

    if (progressDiv) progressDiv.style.display = 'block';
    if (resultsDiv) resultsDiv.innerHTML = '';

    let failedItems = getFailedColormaps();
    const initialFailCount = failedItems.length;

    if (initialFailCount === 0) {
        if (progressDiv) progressDiv.innerHTML = '<span style="color: #4CAF50;">✅ No failed colormaps to retry!</span>';
        isRetrying = false;
        return;
    }

    console.log(`Starting retry: ${initialFailCount} failed colormaps, max ${maxIterations} iterations`);

    let totalImproved = 0;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        if (progressDiv) {
            progressDiv.innerHTML = `<span style="color: #2196F3;">🔄 Iteration ${iteration}/${maxIterations}: Processing ${failedItems.length} failed colormaps...</span>`;
        }

        let improvedThisIteration = 0;
        const stillFailed = [];

        for (const item of failedItems) {
            const result = retryGeneration(item, iteration);

            if (result) {
                // Update the colormap data
                const newMetrics = calculateAndDisplayMetrics(result.candidate.colormap, allColormaps[item.index].condition);

                allColormaps[item.index].colormap = result.candidate.colormap;
                allColormaps[item.index].metrics = newMetrics;
                allColormaps[item.index].improved = true;
                allColormaps[item.index].improvedIteration = iteration;

                // Update visual display
                updateColormapDisplay(item.index, result, iteration);

                improvedThisIteration++;
                totalImproved++;
            } else {
                stillFailed.push(item);
            }
        }

        retryHistory.push({
            iteration: iteration,
            improved: improvedThisIteration,
            remaining: stillFailed.length
        });

        console.log(`Iteration ${iteration}: ${improvedThisIteration} improved, ${stillFailed.length} still failed`);

        failedItems = stillFailed;

        if (failedItems.length === 0) {
            console.log('All colormaps improved!');
            break;
        }

        // Small delay to allow UI update
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Show final results
    const finalFailed = failedItems.length;

    if (progressDiv) {
        progressDiv.innerHTML = `<span style="color: #4CAF50;">✅ Retry complete!</span>`;
    }

    if (resultsDiv) {
        let html = '<div style="margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px;">';
        html += `<div style="font-weight: bold; margin-bottom: 8px;">📊 Retry Results</div>`;
        html += `<div style="color: #666; font-size: 13px;">`;
        html += `<div>Initial failed: <strong>${initialFailCount}</strong></div>`;
        html += `<div style="color: #4CAF50;">✅ Improved: <strong>${totalImproved}</strong></div>`;
        html += `<div style="color: #f44336;">❌ Still failed: <strong>${finalFailed}</strong></div>`;
        html += `</div>`;

        // Per-iteration breakdown
        html += `<details style="margin-top: 8px;"><summary style="cursor: pointer; font-size: 12px; color: #666;">Per-iteration breakdown ▼</summary>`;
        html += `<div style="margin-top: 5px; font-size: 12px;">`;
        retryHistory.forEach(h => {
            html += `<div>Iteration ${h.iteration}: +${h.improved} improved, ${h.remaining} remaining</div>`;
        });
        html += `</div></details>`;

        html += '</div>';
        resultsDiv.innerHTML = html;
    }

    // Update main statistics
    updateStatistics();

    isRetrying = false;
}

/**
 * Update retry iteration count from UI
 * @param {number} value - New iteration count
 */
function updateRetryIterations(value) {
    RETRY_MAX_ITERATIONS = parseInt(value) || 3;
    document.getElementById('retryIterationsSlider').value = RETRY_MAX_ITERATIONS;
    document.getElementById('retryIterationsValue').value = RETRY_MAX_ITERATIONS;
}

/**
 * Global function to start retry process
 */
function retryFailed() {
    runRetryIterations(RETRY_MAX_ITERATIONS);
}

/**
 * Clear retry results (called when sampling mode changes)
 */
function clearRetryResults() {
    retryHistory = [];

    const progressDiv = document.getElementById('retryProgress');
    const resultsDiv = document.getElementById('retryResults');

    if (progressDiv) {
        progressDiv.style.display = 'none';
        progressDiv.innerHTML = '';
    }
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
    }

    // Remove improvement badges from colormaps
    allColormaps.forEach((cm, idx) => {
        cm.improved = false;
        cm.improvedIteration = undefined;

        if (colormapElements[idx]) {
            const badge = d3.select(colormapElements[idx]).select('.improvement-badge');
            if (badge.node()) {
                badge.remove();
            }
        }
    });

    console.log('Retry results cleared due to mode change');
}
