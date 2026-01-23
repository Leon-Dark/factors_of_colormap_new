// Retry Logic Module - Handle re-generation of failed colormaps

// Array to store original failed data for comparison
let retrySnapshots = [];

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
            isFailed = cm.metrics.uniform_small_window_diff < UNIFORM_SMALL_MIN_DIFF ||
                cm.metrics.uniform_large_window_diff < UNIFORM_LARGE_MIN_DIFF;
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
 * Open the Retry Dashboard and populate it with failed items
 */
function retryFailed() {
    const failedItems = getFailedColormaps();
    const dashboard = document.getElementById('retryDashboard');
    const container = document.getElementById('retryComparisonContainer');
    const statusText = document.getElementById('retryStatusText');
    const startBtn = document.getElementById('startRetryBtn');

    if (failedItems.length === 0) {
        alert("No failed colormaps to retry!");
        return;
    }

    // Reset snapshots
    retrySnapshots = [];
    container.innerHTML = '';

    // Disable main scroll
    document.body.style.overflow = 'hidden';

    // Show dashboard
    dashboard.style.display = 'block';
    statusText.innerHTML = `Found ${failedItems.length} failed colormaps. Click "Start Retry" to begin.`;
    startBtn.disabled = false;
    startBtn.style.opacity = "1";
    startBtn.innerHTML = "▶️ Start Retry";

    // Populate comparison rows
    failedItems.forEach(item => {
        // Create deep clone of original data for snapshot
        // Note: d3 objects like colors might need careful cloning if referenced, 
        // but basics are fine. RGB objects are objects.
        const originalClone = JSON.parse(JSON.stringify(item.data));

        retrySnapshots.push({
            index: item.index,
            original: originalClone,
            current: item.data // Reference to live data
        });

        // Create Row UI
        const row = document.createElement('div');
        row.className = 'retry-row';
        row.id = `retry-row-${item.index}`;
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 1fr';
        row.style.gap = '30px';
        row.style.padding = '20px';
        row.style.background = 'white';
        row.style.borderRadius = '8px';
        row.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

        // Left Column (Original)
        const leftCol = document.createElement('div');
        leftCol.id = `retry-original-${item.index}`;
        row.appendChild(leftCol);

        // Right Column (Result)
        const rightCol = document.createElement('div');
        rightCol.id = `retry-result-${item.index}`;
        rightCol.innerHTML = '<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #999; font-style: italic; background: #fafafa; border-radius: 4px; min-height: 200px;">Waiting to retry...</div>';
        row.appendChild(rightCol);

        container.appendChild(row);

        // Render Original Card using d3 in the left column
        // We need to reconstruct the "candidates" structure expected by drawGivenColormap2
        // candidates object has: colormap, hValues, cValues, lValues
        // But our stored data is `item.data` which has `colormap` (array of objects) and `metrics`.
        // We unfortunately lost the original H/C/L arrays in `allColormaps` if we didn't store them.
        // Wait, `allColormaps` push structure in visualization.js:
        // { colormap, metrics, hueDiff, ... } - IT DOES NOT STORE hValues, cValues, lValues!
        // So we need to re-extract them for visualization.

        const originalCandidates = reconstructCandidates(item.data.colormap);

        // Use a temporary wrapper to call drawGivenColormap2, modifying it to append to our specific div
        // Actually, drawGivenColormap2 appends to #colormapsGrid. We need a helper.
        drawComparisonCard(originalCandidates, item.data.condition, d3.select(leftCol));
    });
}

/**
 * Helper to reconstruct H/C/L values from a colormap array for plotting
 */
function reconstructCandidates(colormap) {
    const hValues = [];
    const cValues = [];
    const lValues = [];

    colormap.forEach(c => {
        // c is d3.rgb or similar object with r,g,b
        const rgb = d3.rgb(c.r, c.g, c.b);
        const hcl = d3.hcl(rgb);
        hValues.push(hcl.h);
        cValues.push(hcl.c);
        lValues.push(hcl.l);
    });

    return {
        colormap: colormap,
        hValues: hValues,
        cValues: cValues,
        lValues: lValues
    };
}

/**
 * Render a card specifically for the comparison view
 */
function drawComparisonCard(candidates, title, container) {
    const colormap = candidates.colormap;

    let div = container.append("div")
        .style("border", "1px solid #ccc")
        .style("padding", "10px").style("background", "#fafafa")
        .style("border-radius", "4px")
        .style("display", "grid")
        .style("grid-template-columns", "1fr")
        .style("gap", "10px")
        .style("width", "100%");

    div.append("div")
        .style("font-size", "11px")
        .style("color", "#666")
        .style("margin-bottom", "5px")
        .text(title);

    let width = colormap.length, height = 40;
    const canvasId = "canvas_comp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    div.append("canvas").attr("id", canvasId)
        .attr("width", width).attr("height", height)
        .style("display", "block")
        .style("margin", "0");

    let canvas = document.getElementById(canvasId);
    // Warning: d3 append doesn't return DOM element directly in same way if we use variable. 
    // container.select("#"+canvasId) is safer. But ID is unique.
    if (canvas) {
        let context = canvas.getContext('2d');
        for (var i = 0; i < canvas.width; i++) {
            let tuple = colormap[i];
            // Handle different color object structures if necessary
            const r = tuple.r !== undefined ? tuple.r : tuple.rgb[0];
            const g = tuple.g !== undefined ? tuple.g : tuple.rgb[1];
            const b = tuple.b !== undefined ? tuple.b : tuple.rgb[2];

            for (var j = 0; j < canvas.height; j++) {
                context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + 1 + ')';
                context.fillRect(i, j, 1, 1);
            }
        }
    }

    let chartsDiv = div.append("div")
        .style("display", "flex")
        .style("gap", "10px")
        .style("justify-content", "space-between")
        .style("flex-wrap", "wrap");

    drawGivenCurve2([candidates['hValues']], chartsDiv, "Hue");
    drawGivenCurve2([candidates['cValues']], chartsDiv, "Chroma");
    drawGivenCurve2([candidates['lValues']], chartsDiv, "Luminance");

    const metrics = calculateAndDisplayMetrics(colormap, title);
    if (metrics) {
        displayMetricsInDiv(div, metrics);

        // Color border logic
        let isPassing = false;
        if (SAMPLING_MODE === 'jnd') {
            const passCond1 = metrics.jnd_consistency >= JND_STEP;
            const passCond2 = metrics.sample_interval_min_diff >= MIN_INTERVAL_DIFF_J;
            isPassing = passCond1 && passCond2;
        } else {
            isPassing = metrics.uniform_small_window_diff >= UNIFORM_SMALL_MIN_DIFF &&
                metrics.uniform_large_window_diff >= UNIFORM_LARGE_MIN_DIFF;
        }

        div.style("border-color", isPassing ? "#4CAF50" : "#f44336").style("border-width", "3px");
    }
}

/**
 * Close dashboard
 */
function closeRetryDashboard() {
    document.getElementById('retryDashboard').style.display = 'none';
    document.body.style.overflow = 'auto'; // Re-enable scroll

    // Refresh main view to reflect changes
    // Since we updated allColormaps in place, we should refresh the main grid.
    // Easiest is to clear grid and redraw all, but we don't store H/C/L in allColormaps fully.
    // However, we modified updateColormapDisplay previously to handle in-place updates.
    // So "Apply" happens automatically because we update `allColormaps` reference.
    // But we should visually refresh any that might have been skipped or for consistency.
    // Let's call the generic update for all improved items just in case.

    // Actually, updateColormapDisplay might not have been called for the main view elements during dashboard operation 
    // unless we explicitly call it. let's call it for all improved items.
    allColormaps.forEach((cm, index) => {
        if (cm.improved) {
            // Reconstruct minimal data structure for updateColormapDisplay
            // It expects { candidate: { colormap: ..., hValues... } }
            // But wait, updateColormapDisplay expects the full candidate object with curves.
            // We need to reconstruct those curves again if we want to update the MAIN view charts.
            const candidates = reconstructCandidates(cm.colormap);
            updateColormapDisplay(index, { candidate: candidates }, cm.improvedIteration);
        }
    });

    updateStatistics();
}

/**
 * Execute logic from dashboard
 */
async function executeRetryFromDashboard() {
    const startBtn = document.getElementById('startRetryBtn');
    startBtn.disabled = true;
    startBtn.style.opacity = "0.6";
    startBtn.innerHTML = "⏳ Retrying...";

    const statusText = document.getElementById('retryStatusText');
    const failedItems = retrySnapshots; // Use our snapshots list to know indices

    let totalImproved = 0;
    const maxIterations = RETRY_MAX_ITERATIONS;

    for (const item of failedItems) {
        statusText.innerHTML = `Processing Item ${item.index + 1}...`;

        // Find the live object in allColormaps
        const liveItem = {
            index: item.index,
            data: allColormaps[item.index]
        };

        // Retry loop for this item
        let successResult = null;
        let successIter = 0;

        for (let iter = 1; iter <= maxIterations; iter++) {
            const result = retryGeneration(liveItem, iter);
            if (result) {
                successResult = result;
                successIter = iter;
                break;
            }
        }

        if (successResult) {
            totalImproved++;

            // Update Data Model
            const newMetrics = calculateAndDisplayMetrics(successResult.candidate.colormap, allColormaps[item.index].condition);
            allColormaps[item.index].colormap = successResult.candidate.colormap;
            // IMPORTANT: Calculate all metrics including unified ones is handled by calculateAndDisplayMetrics now
            allColormaps[item.index].metrics = newMetrics;
            allColormaps[item.index].improved = true;
            allColormaps[item.index].improvedIteration = successIter;

            // Render Result in Dashboard (Right Column)
            const rightCol = d3.select(`#retry-result-${item.index}`);
            rightCol.html(""); // Clear "Waiting..."
            drawComparisonCard(successResult.candidate, "Optimized Result (Iter " + successIter + ")", rightCol);
        } else {
            // Still failed
            const rightCol = document.getElementById(`retry-result-${item.index}`);
            rightCol.innerHTML = '<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #f44336; background: #ffebee; border: 1px solid #ffcdd2; border-radius: 4px; min-height: 200px;">❌ Failed to improve after ' + maxIterations + ' iterations</div>';
        }

        // Small delay for UI responsivness
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    statusText.innerHTML = `Retry Complete! Improved ${totalImproved} of ${failedItems.length}. Click "Close" to apply.`;
    startBtn.innerHTML = "✅ Done";
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
            const hclPalette = convertColormapToHCLPalette(newColormap);

            let passes = false;

            if (SAMPLING_MODE === 'jnd') {
                const jndSamples = generateJndSamples(hclPalette, JND_STEP);
                const jndConsistency = calcJndConsistency(jndSamples, JND_STEP) || 0;
                const intervalDiff = calcSampleIntervalMinDiff(jndSamples, SAMPLE_INTERVAL_K, JND_STEP) || 0;
                passes = jndConsistency >= JND_STEP && intervalDiff >= MIN_INTERVAL_DIFF_J;
            } else {
                const smallDiff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_SMALL_INTERVAL_K, UNIFORM_SAMPLE_COUNT) || 0;
                const largeDiff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_LARGE_INTERVAL_K, UNIFORM_SAMPLE_COUNT) || 0;
                passes = smallDiff >= UNIFORM_SMALL_MIN_DIFF && largeDiff >= UNIFORM_LARGE_MIN_DIFF;
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
 * Update the visual display of a colormap after retry (Main View Update)
 * @param {number} index - Index in allColormaps
 * @param {Object} newData - New colormap data wrapper
 * @param {number} iteration - Iteration that succeeded
 */
function updateColormapDisplay(index, newData, iteration) {
    const element = colormapElements[index];
    if (!element) return;

    // 1. Update Metrics
    const updatedMetrics = allColormaps[index].metrics;
    updateMetricsDisplay(element, updatedMetrics);

    const div = d3.select(element);

    // 2. Update Canvas
    const canvas = div.select("canvas").node();
    if (canvas) {
        const context = canvas.getContext('2d');
        const colormap = newData.candidate.colormap;

        context.clearRect(0, 0, canvas.width, canvas.height);

        for (var i = 0; i < canvas.width; i++) {
            if (i < colormap.length) {
                let tuple = colormap[i];
                // Handle different object structures
                const r = tuple.r !== undefined ? tuple.r : tuple.rgb[0];
                const g = tuple.g !== undefined ? tuple.g : tuple.rgb[1];
                const b = tuple.b !== undefined ? tuple.b : tuple.rgb[2];

                for (var j = 0; j < canvas.height; j++) {
                    context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + 1 + ')';
                    context.fillRect(i, j, 1, 1);
                }
            }
        }
    }

    // 3. Update Charts
    const chartsDiv = div.selectAll("div")
        .filter(function () {
            return d3.select(this).style("display") === "flex";
        });

    if (!chartsDiv.empty()) {
        chartsDiv.html("");
        drawGivenCurve2([newData.candidate.hValues], chartsDiv, "Hue");
        drawGivenCurve2([newData.candidate.cValues], chartsDiv, "Chroma");
        drawGivenCurve2([newData.candidate.lValues], chartsDiv, "Luminance");
    }

    // 4. Update border
    div.style("border-color", "#4CAF50").style("border-width", "3px");

    // 5. Add improved badge
    if (div.select(".improvement-badge").empty()) {
        div.style("position", "relative");
        div.append("div")
            .attr("class", "improvement-badge")
            .style("position", "absolute")
            .style("top", "-8px")
            .style("right", "-8px")
            .style("background", "#4CAF50")
            .style("color", "white")
            .style("border-radius", "50%")
            .style("width", "20px")
            .style("height", "20px")
            .style("display", "flex")
            .style("align-items", "center")
            .style("justify-content", "center")
            .style("font-size", "12px")
            .style("box-shadow", "0 2px 4px rgba(0,0,0,0.2)")
            .text("✓");
    }
}
