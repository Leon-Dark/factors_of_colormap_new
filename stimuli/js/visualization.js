// Visualization Functions - Drawing colormaps and charts

// Draw a line chart for colormap properties
function drawGivenCurve2(data, div, name, x = 0, y = 1) {
    var svg_width = 220, svg_height = 80, margin = 20
    let linechart_svg = div.append("svg").attr("id", "renderSvg").attr("typeId", "line")
        .attr("width", svg_width).attr("height", svg_height)
        .style("display", "block")
        .style("flex", "1")
        .style("min-width", "180px");

    let linechart = linechart_svg.style("background-color", "#FFF")
        .append("g")
        .attr("transform", "translate(" + margin + "," + margin + ")");

    let m_xScale = d3.scaleLinear().range([0, svg_width - margin * 2]);
    let m_yScale = d3.scaleLinear().range([svg_height - margin * 2, 0]);
    
    m_xScale.domain([0, data[0].length - 1]);
    
    const yMin = d3.min(data, line => d3.min(line));
    const yMax = d3.max(data, line => d3.max(line));
    const yRange = yMax - yMin;
    const padding = yRange === 0 ? (yMin === 0 ? 1 : Math.abs(yMin) * 0.1) : yRange * 0.1;
    m_yScale.domain([yMin - padding, yMax + padding]);

    let valueline = d3.line()
        .x(function (d, i) {
            return m_xScale(i);
        })
        .y(function (d) {
            return m_yScale(d);
        });

    linechart.selectAll('path')
        .data(data).enter().append("path")
        .attr("d", function (d) {
            return valueline(d);
        })
        .attr("class", "linechart")
        .attr("fill", "none")
        .attr("stroke", function (d, i) {
            return i == 0 ? "blue" : "red"
        })
        .style("stroke-width", 1);

    linechart.append("g")
        .attr("transform", "translate(0," + (svg_height - margin * 2) + ")")
        .call(d3.axisBottom(m_xScale))
        .style("font-size", "8px");

    linechart.append("g")
        .call(d3.axisLeft(m_yScale))
        .style("font-size", "8px");

    linechart_svg.append("text").attr("x", 0).attr("y", 15).text(name)
        .attr("font-size", "10px").attr("fill", "#000")
        .attr("text-anchor", "start").attr("font-weight", "bold")
        .attr("transform", "translate(" + (margin) + "," + (margin - 8) + ")");
}

// Draw a complete colormap with metrics and charts
function drawGivenColormap2(candidates, condition_name) {
    const colormap = candidates['colormap'];
    let div = d3.select("#colormapsGrid").append("div").attr("class", "colormapDiv")
        .style("border", "1px solid #ccc").style("margin-top", "10px")
        .style("padding", "10px").style("background", "#fafafa")
        .style("border-radius", "4px").style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
        .style("display", "grid")
        .style("grid-template-columns", "1fr")
        .style("gap", "10px")
        .style("width", "100%")
        .style("max-width", "400px");

    div.append("div")
        .style("font-size", "11px")
        .style("color", "#666")
        .style("margin-bottom", "5px")
        .text(condition_name);

    let width = colormap.length, height = 40;
    const canvasId = "canvas_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    div.append("canvas").attr("id", canvasId)
        .attr("width", width).attr("height", height)
        .style("display", "block")
        .style("margin", "0");
    let canvas = document.getElementById(canvasId);
    let context = canvas.getContext('2d');

    for (var i = 0; i < canvas.width; i++) {
        let tuple = colormap[i];
        for (var j = 0; j < canvas.height; j++) {
            context.fillStyle = 'rgba(' + tuple.r + ',' + tuple.g + ',' + tuple.b + ',' + 1 + ')';
            context.fillRect(i, j, 1, 1);
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

    const metrics = calculateAndDisplayMetrics(colormap, condition_name);
    if (metrics) {
        displayMetricsInDiv(div, metrics);
        
        const divNode = div.node();
        
        const hueDiffMatch = condition_name.match(/H diff=(\d+)/);
        const hueDiff = hueDiffMatch ? parseInt(hueDiffMatch[1]) : 0;
        
        const chromaMatch = condition_name.match(/C=\[([^\]]+)\]/);
        let chromaLabel = 'Unknown';
        if (chromaMatch) {
            const chromaVals = chromaMatch[1].split(',').map(v => parseFloat(v.trim()));
            if (chromaVals.length === 2 && chromaVals[0] === chromaVals[1]) {
                chromaLabel = 'Constant';
            } else if (chromaVals.length === 2) {
                chromaLabel = 'Linear';
            } else if (chromaVals.length === 3) {
                chromaLabel = 'Diverging';
            } else if (chromaVals.length === 5) {
                chromaLabel = 'Thermal';
            }
        }
        
        const lumiMatch = condition_name.match(/L=\[([^\]]+)\]/);
        let lumiLabel = 'Unknown';
        if (lumiMatch) {
            const lumiVals = lumiMatch[1].split(',').map(v => parseFloat(v.trim()));
            if (lumiVals.length === 2 && lumiVals[0] === lumiVals[1]) {
                lumiLabel = 'Constant';
            } else if (lumiVals.length === 2) {
                lumiLabel = 'Linear';
            } else if (lumiVals.length === 3) {
                lumiLabel = 'Diverging';
            } else if (lumiVals.length === 5) {
                lumiLabel = 'Thermal';
            }
        }
        
        allColormaps.push({
            colormap: colormap,
            metrics: metrics,
            hueDiff: hueDiff,
            chromaLabel: chromaLabel,
            lumiLabel: lumiLabel,
            condition: condition_name
        });
        colormapElements.push(divNode);
        
        let borderColor, badgeColor, badgeText;
        
        if (SAMPLING_MODE === 'jnd') {
            const passCond1 = metrics.jnd_consistency >= JND_STEP;
            const passCond2 = metrics.sample_interval_min_diff >= MIN_INTERVAL_DIFF_J;
            
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
            const isPassing = metrics.uniform_min_diff >= UNIFORM_MIN_DIFF_THRESHOLD;
            
            if (isPassing) {
                borderColor = '#4CAF50';
                badgeColor = '#4CAF50';
                badgeText = '✅ Pass';
            } else {
                borderColor = '#f44336';
                badgeColor = '#f44336';
                badgeText = '❌ Fail';
            }
        }
        
        div.style("border-color", borderColor)
           .style("border-width", "3px");
        
        div.insert("div", ":first-child")
            .style("position", "absolute")
            .style("top", "5px")
            .style("right", "5px")
            .style("padding", "4px 8px")
            .style("border-radius", "3px")
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("background", badgeColor)
            .style("color", "white")
            .text(badgeText);
        
        div.style("position", "relative");
    }
}

// Update metrics display for an existing colormap card
function updateMetricsDisplay(divElement, metrics) {
    // Select the metrics div (should be the last div in the card)
    const metricsDiv = d3.select(divElement).select('div:last-child');
    
    // Clear existing table
    metricsDiv.select('table').remove();
    
    // Create new table
    const table = metricsDiv.append("table")
        .style("width", "100%")
        .style("border-collapse", "collapse")
        .style("font-size", "11px");

    let metricsData = [
        { name: "Hue", value: metrics.discriminatory_hue, color: "#9C27B0" },
        { name: "Chroma Var", value: metrics.chromatic_var, color: "#F44336" },
        { name: "Lumi Var", value: metrics.luminance_var, color: "#4CAF50" },
        { name: "CIEDE", value: metrics.discriminatory_cie, color: "#2196F3" },
        { name: "Contrast", value: metrics.discriminatory_contrast, color: "#FF9800" },
        { name: "LAB Len", value: metrics.lab_length, color: "#607D8B" },
        { name: "CNV", value: metrics.color_name_var, color: "#00BCD4" },
        { name: "Cat. Tend", value: metrics.categorization_tendency, color: "#E91E63" }
    ];

    if (SAMPLING_MODE === 'jnd') {
        const jndLabel = metrics.jnd_sample_count ? `JND Consistency (n=${metrics.jnd_sample_count})` : "JND Consistency";
        metricsData.unshift(
            { name: jndLabel, value: metrics.jnd_consistency, color: "#795548" },
            { name: "Interval Diff", value: metrics.sample_interval_min_diff, color: "#00897B" }
        );
    } else {
        metricsData.unshift(
            { name: "Uniform Min Diff", value: metrics.uniform_min_diff, color: "#795548" }
        );
    }

    for (let i = 0; i < metricsData.length; i += 2) {
        const row = table.append("tr")
            .style("border-bottom", i < metricsData.length - 2 ? "1px solid #eee" : "none");

        const metric1 = metricsData[i];
        row.append("td")
            .style("padding", "4px 6px")
            .style("font-weight", "500")
            .style("color", "#555")
            .style("width", "30%")
            .html(`<span style="color: ${metric1.color}; font-size: 12px;">●</span> ${metric1.name}`);
        
        row.append("td")
            .style("padding", "4px 6px")
            .style("text-align", "right")
            .style("font-weight", "bold")
            .style("color", metric1.color)
            .style("width", "20%")
            .text(metric1.value.toFixed(2));

        if (i + 1 < metricsData.length) {
            const metric2 = metricsData[i + 1];
            row.append("td")
                .style("padding", "4px 6px")
                .style("font-weight", "500")
                .style("color", "#555")
                .style("width", "30%")
                .style("padding-left", "10px")
                .html(`<span style="color: ${metric2.color}; font-size: 12px;">●</span> ${metric2.name}`);
            
            row.append("td")
                .style("padding", "4px 6px")
                .style("text-align", "right")
                .style("font-weight", "bold")
                .style("color", metric2.color)
                .style("width", "20%")
                .text(metric2.value.toFixed(2));
        } else {
            row.append("td").attr("colspan", "2");
        }
    }
}

// Display metrics in a div
function displayMetricsInDiv(div, metrics) {
    const metricsDiv = div.append("div")
        .style("margin-top", "0")
        .style("padding", "8px")
        .style("background", "white")
        .style("border", "1px solid #ddd")
        .style("border-radius", "4px");

    metricsDiv.append("h4")
        .text("📊 Metrics")
        .style("margin", "0 0 6px 0")
        .style("color", "#333")
        .style("font-size", "12px")
        .style("border-bottom", "1px solid #4CAF50")
        .style("padding-bottom", "3px");

    const table = metricsDiv.append("table")
        .style("width", "100%")
        .style("border-collapse", "collapse")
        .style("font-size", "11px");

    let metricsData = [
        { name: "Hue", value: metrics.discriminatory_hue, color: "#9C27B0" },
        { name: "Chroma Var", value: metrics.chromatic_var, color: "#F44336" },
        { name: "Lumi Var", value: metrics.luminance_var, color: "#4CAF50" },
        { name: "CIEDE", value: metrics.discriminatory_cie, color: "#2196F3" },
        { name: "Contrast", value: metrics.discriminatory_contrast, color: "#FF9800" },
        { name: "LAB Len", value: metrics.lab_length, color: "#607D8B" },
        { name: "CNV", value: metrics.color_name_var, color: "#00BCD4" },
        { name: "Cat. Tend", value: metrics.categorization_tendency, color: "#E91E63" }
    ];

    if (SAMPLING_MODE === 'jnd') {
        const jndLabel = metrics.jnd_sample_count ? `JND Consistency (n=${metrics.jnd_sample_count})` : "JND Consistency";
        metricsData.unshift(
            { name: jndLabel, value: metrics.jnd_consistency, color: "#795548" },
            { name: "Interval Diff", value: metrics.sample_interval_min_diff, color: "#00897B" }
        );
    } else {
        metricsData.unshift(
            { name: "Uniform Min Diff", value: metrics.uniform_min_diff, color: "#795548" }
        );
    }

    for (let i = 0; i < metricsData.length; i += 2) {
        const row = table.append("tr")
            .style("border-bottom", i < metricsData.length - 2 ? "1px solid #eee" : "none");

        const metric1 = metricsData[i];
        row.append("td")
            .style("padding", "4px 6px")
            .style("font-weight", "500")
            .style("color", "#555")
            .style("width", "30%")
            .html(`<span style="color: ${metric1.color}; font-size: 12px;">●</span> ${metric1.name}`);
        
        row.append("td")
            .style("padding", "4px 6px")
            .style("text-align", "right")
            .style("font-weight", "bold")
            .style("color", metric1.color)
            .style("width", "20%")
            .text(metric1.value.toFixed(2));

        if (i + 1 < metricsData.length) {
            const metric2 = metricsData[i + 1];
            row.append("td")
                .style("padding", "4px 6px")
                .style("font-weight", "500")
                .style("color", "#555")
                .style("width", "30%")
                .style("padding-left", "10px")
                .html(`<span style="color: ${metric2.color}; font-size: 12px;">●</span> ${metric2.name}`);
            
            row.append("td")
                .style("padding", "4px 6px")
                .style("text-align", "right")
                .style("font-weight", "bold")
                .style("color", metric2.color)
                .style("width", "20%")
                .text(metric2.value.toFixed(2));
        } else {
            row.append("td").attr("colspan", "2");
        }
    }
}
