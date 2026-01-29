// UI Control Functions - Handle user interactions

// Uniform Mode: Update sample count
function updateUniformCount(value) {
    const count = parseInt(value);
    UNIFORM_SAMPLE_COUNT = count;

    // Sync slider and number input
    document.getElementById('uniformCountSlider').value = count;
    document.getElementById('uniformCountValue').value = count;

    // Recalculate uniform metric for all colormaps
    allColormaps.forEach((cm, idx) => {
        const hclPalette = convertColormapToHCLPalette(cm.colormap);
        cm.metrics.uniform_small_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_SMALL_INTERVAL_K, count);
        cm.metrics.uniform_large_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_LARGE_INTERVAL_K, count);

        // Update the metrics display on the card
        if (colormapElements[idx]) {
            updateMetricsDisplay(colormapElements[idx], cm.metrics);
        }
    });

    updateStatistics();
    applyFilter();
    updateColormapBorders();
}

// Uniform Mode: Update Small Window Check
function updateUniformSmallWindow(k, diff) {
    const intervalK = parseInt(k);
    const minDiff = parseFloat(diff);

    UNIFORM_SMALL_INTERVAL_K = intervalK;
    UNIFORM_SMALL_MIN_DIFF = minDiff;

    // Sync sliders and number inputs
    document.getElementById('uniformSmallIntervalSlider').value = intervalK;
    document.getElementById('uniformSmallIntervalValue').value = intervalK;
    document.getElementById('uniformSmallDiffSlider').value = minDiff;
    document.getElementById('uniformSmallDiffValue').value = minDiff;

    // Recalculate metrics
    allColormaps.forEach((cm, idx) => {
        const hclPalette = convertColormapToHCLPalette(cm.colormap);
        cm.metrics.uniform_small_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_SMALL_INTERVAL_K, UNIFORM_SAMPLE_COUNT);

        if (colormapElements[idx]) {
            updateMetricsDisplay(colormapElements[idx], cm.metrics);
        }
    });

    updateStatistics();
    applyFilter();
    updateColormapBorders();
}

// Uniform Mode: Update Large Window Check
function updateUniformLargeWindow(k, diff) {
    const intervalK = parseInt(k);
    const minDiff = parseFloat(diff);

    UNIFORM_LARGE_INTERVAL_K = intervalK;
    UNIFORM_LARGE_MIN_DIFF = minDiff;

    // Sync sliders and number inputs
    document.getElementById('uniformLargeIntervalSlider').value = intervalK;
    document.getElementById('uniformLargeIntervalValue').value = intervalK;
    document.getElementById('uniformLargeDiffSlider').value = minDiff;
    document.getElementById('uniformLargeDiffValue').value = minDiff;

    // Recalculate metrics
    allColormaps.forEach((cm, idx) => {
        const hclPalette = convertColormapToHCLPalette(cm.colormap);
        cm.metrics.uniform_large_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_LARGE_INTERVAL_K, UNIFORM_SAMPLE_COUNT);

        if (colormapElements[idx]) {
            updateMetricsDisplay(colormapElements[idx], cm.metrics);
        }
    });

    updateStatistics();
    applyFilter();
    updateColormapBorders();
}
