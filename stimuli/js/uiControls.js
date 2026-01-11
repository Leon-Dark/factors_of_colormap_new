// UI Control Functions - Handle user interactions

// Switch between JND and Uniform sampling modes
function switchSamplingMode() {
    const selectedMode = document.querySelector('input[name="samplingMode"]:checked').value;
    SAMPLING_MODE = selectedMode;

    // Show/hide corresponding parameter panels
    if (selectedMode === 'jnd') {
        document.getElementById('jndModePanel').style.display = 'block';
        document.getElementById('uniformModePanel').style.display = 'none';
        document.getElementById('jndFilterOptions').style.display = 'flex';
        document.getElementById('uniformFilterOptions').style.display = 'none';
        // Reset to "Show all" for JND mode
        document.querySelector('input[name="filterMode"][value="all"]').checked = true;
    } else {
        document.getElementById('jndModePanel').style.display = 'none';
        document.getElementById('uniformModePanel').style.display = 'block';
        // Show/hide filter options
        document.getElementById('jndFilterOptions').style.display = 'none';
        document.getElementById('uniformFilterOptions').style.display = 'flex';
        // Reset to "Show all" for Uniform mode
        document.querySelector('input[name="filterModeUniform"][value="all"]').checked = true;
    }

    // Recalculate all metrics based on new mode
    allColormaps.forEach((cm, idx) => {
        const hclPalette = cm.colormap.map(color => {
            const lab = d3.lab(color);
            const hcl = d3.hcl(lab);
            return [hcl.h, hcl.c, hcl.l];
        });

        if (selectedMode === 'jnd') {
            const jndSamples = generateJndSamples(hclPalette, JND_STEP);
            cm.metrics.jnd_consistency = calcJndConsistency(jndSamples, JND_STEP);
            cm.metrics.sample_interval_min_diff = calcSampleIntervalMinDiff(jndSamples, SAMPLE_INTERVAL_K, JND_STEP);
        } else {
            cm.metrics.uniform_small_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_SMALL_INTERVAL_K, UNIFORM_SAMPLE_COUNT);
            cm.metrics.uniform_large_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_LARGE_INTERVAL_K, UNIFORM_SAMPLE_COUNT);
        }

        // Update the metrics display on the card (important for mode switch)
        if (colormapElements[idx]) {
            updateMetricsDisplay(colormapElements[idx], cm.metrics);
        }
    });

    updateStatistics();
    applyFilter();
    updateColormapBorders();

    // Clear retry results when mode changes
    if (typeof clearRetryResults === 'function') {
        clearRetryResults();
    }
}

// JND Mode: Update JND step size
function updateJndStep(value) {
    const step = parseFloat(value);
    JND_STEP = step;

    // Sync slider and number input
    document.getElementById('jndStepSlider').value = step;
    document.getElementById('jndStepValue').value = step;

    // Recalculate JND metrics for all colormaps
    allColormaps.forEach((cm, idx) => {
        const hclPalette = cm.colormap.map(color => {
            const lab = d3.lab(color);
            const hcl = d3.hcl(lab);
            return [hcl.h, hcl.c, hcl.l];
        });

        const jndSamples = generateJndSamples(hclPalette, step);
        cm.metrics.jnd_consistency = calcJndConsistency(jndSamples, step);
        cm.metrics.sample_interval_min_diff = calcSampleIntervalMinDiff(jndSamples, SAMPLE_INTERVAL_K, step);

        // Update the metrics display on the card
        if (colormapElements[idx]) {
            updateMetricsDisplay(colormapElements[idx], cm.metrics);
        }
    });

    updateStatistics();
    applyFilter();
    updateColormapBorders();
}

// JND Mode: Update interval parameters (k and j)
function updateJndInterval(k, j) {
    const intervalK = parseInt(k);
    const minDiffJ = parseFloat(j);

    SAMPLE_INTERVAL_K = intervalK;
    MIN_INTERVAL_DIFF_J = minDiffJ;

    // Sync sliders and number inputs
    document.getElementById('intervalKSlider').value = intervalK;
    document.getElementById('intervalKValue').value = intervalK;
    document.getElementById('intervalJSlider').value = minDiffJ;
    document.getElementById('intervalJValue').value = minDiffJ;

    // Recalculate condition 2 for all colormaps
    allColormaps.forEach((cm, idx) => {
        const hclPalette = cm.colormap.map(color => {
            const lab = d3.lab(color);
            const hcl = d3.hcl(lab);
            return [hcl.h, hcl.c, hcl.l];
        });

        const jndSamples = generateJndSamples(hclPalette, JND_STEP);
        cm.metrics.sample_interval_min_diff = calcSampleIntervalMinDiff(jndSamples, intervalK, JND_STEP);

        // Update the metrics display on the card
        if (colormapElements[idx]) {
            updateMetricsDisplay(colormapElements[idx], cm.metrics);
        }
    });

    updateStatistics();
    applyFilter();
    updateColormapBorders();
}

// Uniform Mode: Update sample count
function updateUniformCount(value) {
    const count = parseInt(value);
    UNIFORM_SAMPLE_COUNT = count;

    // Sync slider and number input
    document.getElementById('uniformCountSlider').value = count;
    document.getElementById('uniformCountValue').value = count;

    // Recalculate uniform metric for all colormaps
    allColormaps.forEach((cm, idx) => {
        const hclPalette = cm.colormap.map(color => {
            const lab = d3.lab(color);
            const hcl = d3.hcl(lab);
            return [hcl.h, hcl.c, hcl.l];
        });
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
        const hclPalette = cm.colormap.map(color => {
            const lab = d3.lab(color);
            const hcl = d3.hcl(lab);
            return [hcl.h, hcl.c, hcl.l];
        });
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
        const hclPalette = cm.colormap.map(color => {
            const lab = d3.lab(color);
            const hcl = d3.hcl(lab);
            return [hcl.h, hcl.c, hcl.l];
        });
        cm.metrics.uniform_large_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_LARGE_INTERVAL_K, UNIFORM_SAMPLE_COUNT);

        if (colormapElements[idx]) {
            updateMetricsDisplay(colormapElements[idx], cm.metrics);
        }
    });

    updateStatistics();
    applyFilter();
    updateColormapBorders();
}
