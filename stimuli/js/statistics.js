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
        // Uniform Mode: Single condition
        let pass = 0, fail = 0;
        
        allColormaps.forEach(cm => {
            const passing = cm.metrics.uniform_min_diff >= UNIFORM_MIN_DIFF_THRESHOLD;
            if (passing) {
                pass++;
            } else {
                fail++;
            }
        });
        
        // Update overall statistics (reuse existing elements, hide unused ones)
        document.getElementById('totalCount').textContent = total;
        document.getElementById('passCount').textContent = pass;
        document.getElementById('passPercent').textContent = total > 0 ? ((pass / total) * 100).toFixed(1) : 0;
        
        // Hide JND-specific stats by setting to "-"
        document.getElementById('failCond1Count').textContent = '-';
        document.getElementById('failCond1Percent').textContent = '-';
        document.getElementById('failCond2Count').textContent = '-';
        document.getElementById('failCond2Percent').textContent = '-';
        document.getElementById('failBothCount').textContent = fail;
        document.getElementById('failBothPercent').textContent = total > 0 ? ((fail / total) * 100).toFixed(1) : 0;
        
        // Update Uniform mode filter counts
        document.getElementById('filterAllCountUniform').textContent = total;
        document.getElementById('filterPassCountUniform').textContent = pass;
        document.getElementById('filterFailCountUniform').textContent = fail;
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
            const isPassing = cm.metrics.uniform_min_diff >= UNIFORM_MIN_DIFF_THRESHOLD;
        
            // By Hue Diff
            const hueKey = `Hue diff = ${cm.hueDiff}`;
            if (!stats.byHue[hueKey]) stats.byHue[hueKey] = { total: 0, pass: 0, fail: 0 };
            stats.byHue[hueKey].total++;
            if (isPassing) {
                stats.byHue[hueKey].pass++;
            } else {
                stats.byHue[hueKey].fail++;
            }

            // By Chroma Profile
            const chromaKey = cm.chromaLabel;
            if (!stats.byChroma[chromaKey]) stats.byChroma[chromaKey] = { total: 0, pass: 0, fail: 0 };
            stats.byChroma[chromaKey].total++;
            if (isPassing) {
                stats.byChroma[chromaKey].pass++;
            } else {
                stats.byChroma[chromaKey].fail++;
            }

            // By Luminance Profile
            const lumiKey = cm.lumiLabel;
            if (!stats.byLumi[lumiKey]) stats.byLumi[lumiKey] = { total: 0, pass: 0, fail: 0 };
            stats.byLumi[lumiKey].total++;
            if (isPassing) {
                stats.byLumi[lumiKey].pass++;
            } else {
                stats.byLumi[lumiKey].fail++;
            }
        });

        // Generate HTML for detailed statistics (Uniform mode - 2 columns)
        let html = '<div style="display: grid; gap: 20px;">';
        
        // By Hue
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Hue Difference</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Hue</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail</td></tr>';
        Object.keys(stats.byHue).sort().forEach(key => {
            const s = stats.byHue[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.pass}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.fail}</td></tr>`;
        });
        html += '</table></div>';
        
        // By Chroma
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Chroma Profile</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Chroma</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail</td></tr>';
        Object.keys(stats.byChroma).sort().forEach(key => {
            const s = stats.byChroma[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.pass}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.fail}</td></tr>`;
        });
        html += '</table></div>';
        
        // By Luminance
        html += '<div><h4 style="margin: 0 0 8px 0; color: #555;">By Luminance Profile</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr style="background: #f0f0f0; font-weight: bold;"><td style="padding: 6px; border: 1px solid #ddd;">Luminance</td><td style="padding: 6px; border: 1px solid #ddd;">Total</td><td style="padding: 6px; border: 1px solid #ddd; color: #4CAF50;">Pass</td><td style="padding: 6px; border: 1px solid #ddd; color: #f44336;">Fail</td></tr>';
        Object.keys(stats.byLumi).sort().forEach(key => {
            const s = stats.byLumi[key];
            html += `<tr><td style="padding: 6px; border: 1px solid #ddd;">${key}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.total}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.pass}</td><td style="padding: 6px; border: 1px solid #ddd;">${s.fail}</td></tr>`;
        });
        html += '</table></div>';
        
        html += '</div>';
        document.getElementById('detailedStats').innerHTML = html;
    }
}
