// Filter and Display Functions

// Apply filter based on selected mode
function applyFilter() {
    // Get filter mode based on current sampling mode
    const filterMode = SAMPLING_MODE === 'jnd'
        ? document.querySelector('input[name="filterMode"]:checked').value
        : document.querySelector('input[name="filterModeUniform"]:checked').value;

    colormapElements.forEach((elem, idx) => {
        const cm = allColormaps[idx];
        let shouldShow = false;

        if (SAMPLING_MODE === 'jnd') {
            const passCond1 = cm.metrics.jnd_consistency >= JND_STEP;
            const passCond2 = cm.metrics.sample_interval_min_diff >= MIN_INTERVAL_DIFF_J;

            if (filterMode === 'all') {
                shouldShow = true;
            } else if (filterMode === 'pass') {
                shouldShow = passCond1 && passCond2;
            } else if (filterMode === 'failCond1') {
                shouldShow = !passCond1;
            } else if (filterMode === 'failCond2') {
                shouldShow = !passCond2;
            } else if (filterMode === 'failBoth') {
                shouldShow = !passCond1 && !passCond2;
            }
        } else {
            // Uniform mode
            const passSmall = cm.metrics.uniform_small_window_diff >= UNIFORM_SMALL_MIN_DIFF;
            const passLarge = cm.metrics.uniform_large_window_diff >= UNIFORM_LARGE_MIN_DIFF;

            if (filterMode === 'all') {
                shouldShow = true;
            } else if (filterMode === 'pass') {
                shouldShow = passSmall && passLarge;
            } else if (filterMode === 'failSmall') {
                shouldShow = !passSmall;
            } else if (filterMode === 'failLarge') {
                shouldShow = !passLarge;
            } else if (filterMode === 'failBoth') {
                shouldShow = !passSmall && !passLarge;
            }
        }

        elem.style.display = shouldShow ? 'block' : 'none';
    });
}

// Update colormap border colors based on current mode
function updateColormapBorders() {
    colormapElements.forEach((elem, idx) => {
        const cm = allColormaps[idx];
        let borderColor, badgeColor, badgeText;

        if (SAMPLING_MODE === 'jnd') {
            const passCond1 = cm.metrics.jnd_consistency >= JND_STEP;
            const passCond2 = cm.metrics.sample_interval_min_diff >= MIN_INTERVAL_DIFF_J;

            if (passCond1 && passCond2) {
                borderColor = '#4CAF50';
                badgeColor = '#4CAF50';
                badgeText = '✅ Pass';
            } else if (!passCond1 && passCond2) {
                borderColor = '#FF9800';
                badgeColor = '#FF9800';
                badgeText = '⚠️ Fail C1';
            } else if (passCond1 && !passCond2) {
                borderColor = '#9C27B0';
                badgeColor = '#9C27B0';
                badgeText = '⚠️ Fail C2';
            } else {
                borderColor = '#f44336';
                badgeColor = '#f44336';
                badgeText = '❌ Fail Both';
            }
        } else {
            const passSmall = cm.metrics.uniform_small_window_diff >= UNIFORM_SMALL_MIN_DIFF;
            const passLarge = cm.metrics.uniform_large_window_diff >= UNIFORM_LARGE_MIN_DIFF;

            if (passSmall && passLarge) {
                borderColor = '#4CAF50';
                badgeColor = '#4CAF50';
                badgeText = '✅ Pass';
            } else if (!passSmall && passLarge) {
                borderColor = '#FF9800';
                badgeColor = '#FF9800';
                badgeText = '⚠️ Fail Small';
            } else if (passSmall && !passLarge) {
                borderColor = '#9C27B0';
                badgeColor = '#9C27B0';
                badgeText = '⚠️ Fail Large';
            } else {
                borderColor = '#f44336';
                badgeColor = '#f44336';
                badgeText = '❌ Fail Both';
            }
        }

        // Update border color
        d3.select(elem).style('border-color', borderColor);

        // Update badge - find the first div child which is the badge
        d3.select(elem).select('div')
            .style('background', badgeColor)
            .text(badgeText);
    });
}
