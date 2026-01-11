// Statistics and Detailed Breakdown Functions

// Helper function to get category labels
function getCategoryLabels(chroma, lumi) {
    let chromaLabel = '';
    let lumiLabel = '';

    if (chroma.length === 2 && chroma[0] === chroma[1]) {
        chromaLabel = 'Constant';
    } else if (chroma.length === 2) {
        chromaLabel = 'Linear';
    } else if (chroma.length === 3) {
        chromaLabel = 'Diverging';
    } else if (chroma.length === 5) {
        chromaLabel = 'Thermal';
    }

    if (lumi.length === 2 && lumi[0] === lumi[1]) {
        lumiLabel = 'Constant';
    } else if (lumi.length === 2) {
        lumiLabel = 'Linear';
    } else if (lumi.length === 3) {
        lumiLabel = 'Diverging';
    } else if (lumi.length === 5) {
        lumiLabel = 'Thermal';
    }

    return { chromaLabel, lumiLabel };
}

// Calculate and update statistics
function updateStatistics() {
    const total = allColormaps.length;

    if (SAMPLING_MODE === 'jnd') {
        // JND Mode: Two conditions
        let passBoth = 0, failCond1 = 0, failCond2 = 0, failBoth = 0;

        allColormaps.forEach(cm => {
            const passCond1 = cm.metrics.jnd_consistency >= JND_STEP;
            const passCond2 = cm.metrics.sample_interval_min_diff >= MIN_INTERVAL_DIFF_J;

            if (passCond1 && passCond2) {
                passBoth++;
            }
            if (!passCond1) {
                failCond1++;
            }
            if (!passCond2) {
                failCond2++;
            }
            if (!passCond1 && !passCond2) {
                failBoth++;
            }
        });

        document.getElementById('totalCount').textContent = total;
        document.getElementById('passCount').textContent = passBoth;
        document.getElementById('passPercent').textContent = total > 0 ? ((passBoth / total) * 100).toFixed(1) : 0;

        document.getElementById('failCond1Count').textContent = failCond1;
        document.getElementById('failCond1Percent').textContent = total > 0 ? ((failCond1 / total) * 100).toFixed(1) : 0;

        document.getElementById('failCond2Count').textContent = failCond2;
        document.getElementById('failCond2Percent').textContent = total > 0 ? ((failCond2 / total) * 100).toFixed(1) : 0;

        document.getElementById('failBothCount').textContent = failBoth;
        document.getElementById('failBothPercent').textContent = total > 0 ? ((failBoth / total) * 100).toFixed(1) : 0;

        document.getElementById('filterAllCount').textContent = total;
        document.getElementById('filterPassCount').textContent = passBoth;
        document.getElementById('filterFailCond1Count').textContent = failCond1;
        document.getElementById('filterFailCond2Count').textContent = failCond2;
        document.getElementById('filterFailBothCount').textContent = failBoth;
    } else {
        // Uniform Mode: Two conditions (Small Window, Large Window)
        let passBoth = 0, failSmall = 0, failLarge = 0, failBoth = 0;

        allColormaps.forEach(cm => {
            const passSmall = cm.metrics.uniform_small_window_diff >= UNIFORM_SMALL_MIN_DIFF;
            const passLarge = cm.metrics.uniform_large_window_diff >= UNIFORM_LARGE_MIN_DIFF;

            if (passSmall && passLarge) {
                passBoth++;
            }
            if (!passSmall) {
                failSmall++;
            }
            if (!passLarge) {
                failLarge++;
            }
            if (!passSmall && !passLarge) {
                failBoth++;
            }
        });

        // Update overall statistics
        document.getElementById('totalCount').textContent = total;
        document.getElementById('passCount').textContent = passBoth;
        document.getElementById('passPercent').textContent = total > 0 ? ((passBoth / total) * 100).toFixed(1) : 0;

        // Reuse JND elements for Uniform mode stats (Fail Cond 1 -> Fail Small, Fail Cond 2 -> Fail Large)
        document.getElementById('failCond1Count').textContent = failSmall;
        document.getElementById('failCond1Percent').textContent = total > 0 ? ((failSmall / total) * 100).toFixed(1) : 0;

        document.getElementById('failCond2Count').textContent = failLarge;
        document.getElementById('failCond2Percent').textContent = total > 0 ? ((failLarge / total) * 100).toFixed(1) : 0;

        document.getElementById('failBothCount').textContent = failBoth;
        document.getElementById('failBothPercent').textContent = total > 0 ? ((failBoth / total) * 100).toFixed(1) : 0;

        // Update Uniform mode filter counts
        document.getElementById('filterAllCountUniform').textContent = total;
        document.getElementById('filterPassCountUniform').textContent = passBoth;
        document.getElementById('filterFailSmallCountUniform').textContent = failSmall;
        document.getElementById('filterFailLargeCountUniform').textContent = failLarge;
        document.getElementById('filterFailBothCountUniform').textContent = failBoth;
    }

    // Calculate detailed statistics
    updateDetailedStatistics();

    // Show statistics panel
    document.getElementById('statisticsPanel').style.display = 'block';
}

// Calculate detailed breakdown statistics
function updateDetailedStatistics() {
    const stats = {
        byHue: {},
        byChroma: {},
        byLumi: {}
    };

    if (SAMPLING_MODE === 'jnd') {
        allColormaps.forEach(cm => {
            const isPassingCond1 = cm.metrics.jnd_consistency >= JND_STEP;
            const isPassingCond2 = cm.metrics.sample_interval_min_diff >= MIN_INTERVAL_DIFF_J;

            // By Hue Diff
            const hueKey = `Hue diff = ${cm.hueDiff}`;
            if (!stats.byHue[hueKey]) stats.byHue[hueKey] = { total: 0, passBoth: 0, failCond1: 0, failCond2: 0, failBoth: 0 };
            stats.byHue[hueKey].total++;
            if (isPassingCond1 && isPassingCond2) stats.byHue[hueKey].passBoth++;
            if (!isPassingCond1) stats.byHue[hueKey].failCond1++;
            if (!isPassingCond2) stats.byHue[hueKey].failCond2++;
            if (!isPassingCond1 && !isPassingCond2) stats.byHue[hueKey].failBoth++;

            // By Chroma Profile
            const chromaKey = cm.chromaLabel;
            if (!stats.byChroma[chromaKey]) stats.byChroma[chromaKey] = { total: 0, passBoth: 0, failCond1: 0, failCond2: 0, failBoth: 0 };
            stats.byChroma[chromaKey].total++;
            if (isPassingCond1 && isPassingCond2) stats.byChroma[chromaKey].passBoth++;
            if (!isPassingCond1) stats.byChroma[chromaKey].failCond1++;
            if (!isPassingCond2) stats.byChroma[chromaKey].failCond2++;
            if (!isPassingCond1 && !isPassingCond2) stats.byChroma[chromaKey].failBoth++;

            // By Luminance Profile
            const lumiKey = cm.lumiLabel;
            if (!stats.byLumi[lumiKey]) stats.byLumi[lumiKey] = { total: 0, passBoth: 0, failCond1: 0, failCond2: 0, failBoth: 0 };
            stats.byLumi[lumiKey].total++;
            if (isPassingCond1 && isPassingCond2) stats.byLumi[lumiKey].passBoth++;
            if (!isPassingCond1) stats.byLumi[lumiKey].failCond1++;
            if (!isPassingCond2) stats.byLumi[lumiKey].failCond2++;
            if (!isPassingCond1 && !isPassingCond2) stats.byLumi[lumiKey].failBoth++;
        });

        // Generate HTML for detailed statistics (JND mode - 4 columns)
        let html = '<div style="display: grid; gap: 20px;">';

        // By Hue
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Hue Difference</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Hue</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass both</td><td style="padding: 6px; border: 1px solid #ddd; color: #FF9800;">Fail C1</td><td style="padding: 6px; border: 1px solid #ddd; color: #9C27B0;">Fail C2</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail both</td></tr>';
        Object.keys(stats.byHue).sort().forEach(key => {
            const s = stats.byHue[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.passBoth}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failCond1}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failCond2}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failBoth}</td></tr>`;
        });
        html += '</table></div>';

        // By Chroma
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Chroma Profile</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Chroma</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass both</td><td style="padding: 6px; border: 1px solid #ddd; color: #FF9800;">Fail C1</td><td style="padding: 6px; border: 1px solid #ddd; color: #9C27B0;">Fail C2</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail both</td></tr>';
        Object.keys(stats.byChroma).sort().forEach(key => {
            const s = stats.byChroma[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.passBoth}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failCond1}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failCond2}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failBoth}</td></tr>`;
        });
        html += '</table></div>';

        // By Luminance
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Luminance Profile</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Luminance</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass both</td><td style="padding: 6px; border: 1px solid #ddd; color: #FF9800;">Fail C1</td><td style="padding: 6px; border: 1px solid #ddd; color: #9C27B0;">Fail C2</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail both</td></tr>';
        Object.keys(stats.byLumi).sort().forEach(key => {
            const s = stats.byLumi[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.passBoth}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failCond1}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failCond2}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failBoth}</td></tr>`;
        });
        html += '</table></div>';

        html += '</div>';
        document.getElementById('detailedStats').innerHTML = html;
    } else {
        // Uniform mode
        allColormaps.forEach(cm => {
            const passSmall = cm.metrics.uniform_small_window_diff >= UNIFORM_SMALL_MIN_DIFF;
            const passLarge = cm.metrics.uniform_large_window_diff >= UNIFORM_LARGE_MIN_DIFF;

            // By Hue Diff
            const hueKey = `Hue diff = ${cm.hueDiff}`;
            if (!stats.byHue[hueKey]) stats.byHue[hueKey] = { total: 0, passBoth: 0, failSmall: 0, failLarge: 0, failBoth: 0 };
            stats.byHue[hueKey].total++;
            if (passSmall && passLarge) stats.byHue[hueKey].passBoth++;
            if (!passSmall) stats.byHue[hueKey].failSmall++;
            if (!passLarge) stats.byHue[hueKey].failLarge++;
            if (!passSmall && !passLarge) stats.byHue[hueKey].failBoth++;

            // By Chroma Profile
            const chromaKey = cm.chromaLabel;
            if (!stats.byChroma[chromaKey]) stats.byChroma[chromaKey] = { total: 0, passBoth: 0, failSmall: 0, failLarge: 0, failBoth: 0 };
            stats.byChroma[chromaKey].total++;
            if (passSmall && passLarge) stats.byChroma[chromaKey].passBoth++;
            if (!passSmall) stats.byChroma[chromaKey].failSmall++;
            if (!passLarge) stats.byChroma[chromaKey].failLarge++;
            if (!passSmall && !passLarge) stats.byChroma[chromaKey].failBoth++;

            // By Luminance Profile
            const lumiKey = cm.lumiLabel;
            if (!stats.byLumi[lumiKey]) stats.byLumi[lumiKey] = { total: 0, passBoth: 0, failSmall: 0, failLarge: 0, failBoth: 0 };
            stats.byLumi[lumiKey].total++;
            if (passSmall && passLarge) stats.byLumi[lumiKey].passBoth++;
            if (!passSmall) stats.byLumi[lumiKey].failSmall++;
            if (!passLarge) stats.byLumi[lumiKey].failLarge++;
            if (!passSmall && !passLarge) stats.byLumi[lumiKey].failBoth++;
        });

        // Generate HTML for detailed statistics (Uniform mode - 4 columns like JND)
        let html = '<div style="display: grid; gap: 20px;">';

        // By Hue
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Hue Difference</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Hue</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass both</td><td style="padding: 6px; border: 1px solid #ddd; color: #FF9800;">Fail Small</td><td style="padding: 6px; border: 1px solid #ddd; color: #9C27B0;">Fail Large</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail both</td></tr>';
        Object.keys(stats.byHue).sort().forEach(key => {
            const s = stats.byHue[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.passBoth}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failSmall}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failLarge}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failBoth}</td></tr>`;
        });
        html += '</table></div>';

        // By Chroma
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Chroma Profile</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Chroma</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass both</td><td style="padding: 6px; border: 1px solid #ddd; color: #FF9800;">Fail Small</td><td style="padding: 6px; border: 1px solid #ddd; color: #9C27B0;">Fail Large</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail both</td></tr>';
        Object.keys(stats.byChroma).sort().forEach(key => {
            const s = stats.byChroma[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.passBoth}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failSmall}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failLarge}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failBoth}</td></tr>`;
        });
        html += '</table></div>';

        // By Luminance
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Luminance Profile</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Luminance</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass both</td><td style="padding: 6px; border: 1px solid #ddd; color: #FF9800;">Fail Small</td><td style="padding: 6px; border: 1px solid #ddd; color: #9C27B0;">Fail Large</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail both</td></tr>';
        Object.keys(stats.byLumi).sort().forEach(key => {
            const s = stats.byLumi[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.passBoth}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failSmall}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failLarge}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.failBoth}</td></tr>`;
        });
        html += '</table></div>';

        html += '</div>';
        document.getElementById('detailedStats').innerHTML = html;
    }
}
