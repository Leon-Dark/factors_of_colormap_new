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

    // Failcond1 -> Fail Small, Failcond2 -> Fail Large
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

    // Calculate detailed statistics
    updateDetailedStatistics();

    // Calculate correlation analysis
    updateCorrelationAnalysis();

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

    // Uniform mode only
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

    // Generate HTML for detailed statistics
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


// Correlation Visualization Functions
function updateCorrelationAnalysis() {
    // 1. Get filtered colormaps (only those passing both conditions)
    const passedColormaps = allColormaps.filter(cm => {
        return cm.metrics.uniform_small_window_diff >= UNIFORM_SMALL_MIN_DIFF &&
            cm.metrics.uniform_large_window_diff >= UNIFORM_LARGE_MIN_DIFF;
    });

    if (passedColormaps.length < 2) {
        document.getElementById('correlationHeatmap').innerHTML = '<p style="color: #666; font-style: italic;">Not enough passing colormaps to calculate correlations (need at least 2).</p>';
        return;
    }

    // 2. Define metrics to analyze
    const metricKeys = [
        { key: 'discriminatory_cie', label: 'Discrim. CIE' },
        { key: 'discriminatory_contrast', label: 'Contrast Sens.' },
        { key: 'discriminatory_hue', label: 'Hue Var.' },
        { key: 'luminance_var', label: 'Luminance Var.' },
        { key: 'chromatic_var', label: 'Chroma Var.' },
        { key: 'lab_length', label: 'LAB Length' },
        { key: 'color_name_var', label: 'Name Var.' },
        { key: 'categorization_tendency', label: 'Categ. Tendency' }
    ];

    // 3. Prepare data matrix
    const correlationMatrix = [];

    for (let i = 0; i < metricKeys.length; i++) {
        const row = [];
        for (let j = 0; j < metricKeys.length; j++) {
            if (i === j) {
                row.push(1);
            } else {
                const values1 = passedColormaps.map(cm => cm.metrics[metricKeys[i].key] || 0);
                const values2 = passedColormaps.map(cm => cm.metrics[metricKeys[j].key] || 0);
                row.push(calculatePearsonCorrelation(values1, values2));
            }
        }
        correlationMatrix.push({
            metric: metricKeys[i].label,
            values: row
        });
    }

    // 4. Render Heatmap
    renderCorrelationHeatmap(correlationMatrix, metricKeys.map(m => m.label));
}

function calculatePearsonCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
        sumY2 += y[i] * y[i];
    }

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
}

function renderCorrelationHeatmap(matrix, labels) {
    const margin = { top: 80, right: 30, bottom: 30, left: 100 };
    const gridSize = 40;
    const width = labels.length * gridSize;
    const height = labels.length * gridSize;

    const container = d3.select("#correlationHeatmap");
    container.html(""); // Clear previous

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // X Labels
    svg.selectAll(".xLabel")
        .data(labels)
        .enter().append("text")
        .text(d => d)
        .attr("x", 0)
        .attr("y", 0)
        .style("text-anchor", "start")
        .attr("transform", (d, i) => "translate(" + (i * gridSize + gridSize / 2) + ", -6) rotate(-45)")
        .attr("class", "xLabel mono axis")
        .style("font-size", "10px")
        .style("fill", "#555");

    // Y Labels
    svg.selectAll(".yLabel")
        .data(labels)
        .enter().append("text")
        .text(d => d)
        .attr("x", 0)
        .attr("y", (d, i) => i * gridSize + gridSize / 2)
        .style("text-anchor", "end")
        .attr("transform", "translate(-6, " + 3 + ")")
        .attr("class", "yLabel mono axis")
        .style("font-size", "10px")
        .style("fill", "#555");

    // Color Scale
    const colorScale = d3.scaleLinear()
        .domain([-1, 0, 1])
        .range(["#2196F3", "#ffffff", "#F44336"]); // Blue to White to Red

    // Heatmap cells
    matrix.forEach((row, i) => {
        svg.selectAll(".cell-row-" + i)
            .data(row.values)
            .enter().append("rect")
            .attr("x", (d, j) => j * gridSize)
            .attr("y", i * gridSize)
            .attr("class", "hour bordered")
            .attr("width", gridSize - 1)
            .attr("height", gridSize - 1)
            .style("fill", d => colorScale(d))
            .style("stroke", "#eee")
            .append("title")
            .text((d, j) => `${labels[i]} vs ${labels[j]}: ${d.toFixed(3)}`);

        // Add values text
        svg.selectAll(".cell-text-" + i)
            .data(row.values)
            .enter().append("text")
            .text(d => d.toFixed(2))
            .attr("x", (d, j) => j * gridSize + gridSize / 2)
            .attr("y", i * gridSize + gridSize / 2 + 4)
            .style("text-anchor", "middle")
            .style("font-size", "9px")
            .style("fill", d => Math.abs(d) > 0.6 ? "#fff" : "#333");
    });
}
