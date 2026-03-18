// Viewer Logic for Batch Generated Thermal Colormaps (Independent Peaks)

// Global state
let rawData = [];
let currentFilter = 'all';
let currentFile = '';
const OUTPUT_BASE = './output_thermal';
const baseFiles = [
    'thermal_colormaps.json',
    'thermal_colormaps_pointwise.json',
    'thermal_colormaps_all.json'
];

document.addEventListener('DOMContentLoaded', async () => {
    // Setup filter buttons
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.onclick = (e) => {
            // Update active state
            buttons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Extract filter value based on text
            const text = e.target.innerText;
            if (text.includes('All')) {
                filterByHue('all');
            } else if (text.includes('100')) {
                filterByHue(100);
            } else if (text.includes('200')) {
                filterByHue(200);
            } else if (text.includes('300')) {
                filterByHue(300);
            }
        };
    });

    const fileSelect = document.getElementById('fileSelect');
    fileSelect.onchange = async (e) => {
        await loadData(e.target.value);
    };

    try {
        await initializeFileOptions();
    } catch (e) {
        console.error("Failed to load colormaps:", e);
        document.getElementById('colormapsGrid').innerHTML = `<div style="color:red; padding:20px;">Error loading data: ${e.message}. Check whether JSON files exist under 'output_thermal/'.</div>`;
    }
});

async function initializeFileOptions() {
    const fileSelect = document.getElementById('fileSelect');
    const availableFiles = [];

    for (const file of baseFiles) {
        try {
            const response = await fetch(`${OUTPUT_BASE}/${file}`, { method: 'HEAD' });
            if (response.ok) {
                availableFiles.push(file);
            }
        } catch (e) {
        }
    }

    for (let i = 1; i <= 200; i++) {
        const file = `thermal_colormaps_round_${String(i).padStart(3, '0')}.json`;
        try {
            const response = await fetch(`${OUTPUT_BASE}/${file}`, { method: 'HEAD' });
            if (response.ok) {
                availableFiles.push(file);
            }
        } catch (e) {
        }
    }

    if (availableFiles.length === 0) {
        throw new Error('No JSON files found in output_thermal');
    }

    fileSelect.innerHTML = availableFiles
        .map(file => `<option value="${file}">${file}</option>`)
        .join('');

    await loadData(availableFiles[0]);
}

async function loadData(fileName) {
    currentFile = fileName;
    console.log(`Fetching ${OUTPUT_BASE}/${fileName}...`);
    const response = await fetch(`${OUTPUT_BASE}/${fileName}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    rawData = await response.json();
    console.log(`Loaded ${rawData.length} colormaps`);

    // Update stats
    document.getElementById('currentFile').innerText = fileName;
    document.getElementById('totalCount').innerText = rawData.length;

    // Initial Render
    renderGrid();
    renderDesignSpacePanel();
}

function filterByHue(hue) {
    currentFilter = hue;
    renderGrid();
}

function renderGrid() {
    // Clear grid
    d3.select("#colormapsGrid").selectAll("*").remove();

    // Filter data
    const filteredData = currentFilter === 'all'
        ? rawData
        : rawData.filter(d => d.metadata.hueTarget === currentFilter);

    // Update count
    document.getElementById('visibleCount').innerText = filteredData.length;

    // Render each item
    filteredData.forEach((item, index) => {
        try {
            if (!item.colormap) {
                console.warn(`Skipping item ${index} (no colormap array available - likely Out of Gamut)`);
                return;
            }

            const colormapObjs = item.colormap.map(c => d3.rgb(c[0], c[1], c[2]));

            // Reconstruct condition object compatible with visualization.js
            const candidate = {
                colormap: colormapObjs,
                hValues: item.hValues,
                cValues: item.cValues,
                lValues: item.lValues,
                metadata: {
                    ...item.metadata,
                    qualityMetrics: undefined
                }
            };

            const m = item.metadata;
            const hStart = Math.round(item.hValues[0]);
            const hEnd = Math.round(item.hValues[item.hValues.length - 1]);

            const chromaName = m.chromaPattern || 'unknownC';
            const lumiName = m.lumiPattern || 'unknownL';

            const cDiff = (m.adjustedChroma || []).map((v, i) => {
                const base = (m.originalChroma || [])[i] ?? 0;
                return Math.round((v - base) * 10) / 10;
            });
            const lDiff = (m.adjustedLumi || []).map((v, i) => {
                const base = (m.originalLumi || [])[i] ?? 0;
                return Math.round((v - base) * 10) / 10;
            });

            const fmtDiff = arr => arr.length ? `[${arr.map(v => (v >= 0 ? `+${v}` : `${v}`)).join(',')}]` : '[]';
            const attempts = (m.searchStats && m.searchStats.attempts !== undefined) ? m.searchStats.attempts : '?';
            const deform = (m.deformation !== undefined) ? ` deform=${m.deformation.toFixed(1)}` : '';

            let deficitStr = "";
            const q = m.qualityMetrics || {};
            const isSuccess = item.success;

            if (isSuccess === true) {
                deficitStr = ` ✅ PASS`;
            } else {
                let parts = [];
                if (q.smallDeficit > 0) parts.push(`Small:${q.smallDeficit.toFixed(2)}`);
                if (q.largeDeficit > 0) parts.push(`Large:${q.largeDeficit.toFixed(2)}`);
                if (q.discDeficit > 0) parts.push(`Disc:${q.discDeficit.toFixed(2)}`);

                if (parts.length > 0) {
                    deficitStr = ` ❌ FAIL [${parts.join(', ')}]`;
                } else {
                    deficitStr = ` ❌ FAIL [Out of Gamut / Invalid Shape]`;
                }
            }

            const conditionStr =
                `H=${m.hueTarget} ${chromaName}/${lumiName} ` +
                `ΔC${fmtDiff(cDiff)} ΔL${fmtDiff(lDiff)} (${attempts} steps${deform})${deficitStr}`;

            // Draw card
            drawGivenColormap2(candidate, `#${index + 1} ${conditionStr}`);
        } catch (e) {
            console.error('Error rendering item', index, item, e);
        }
    });
}

// ────────────────────────────────────────────────────
// Design Space Panel — Small Multiple 3-Column Layout
// ────────────────────────────────────────────────────
function renderDesignSpacePanel() {
    const panel = document.getElementById('designSpacePanel');
    if (!rawData || rawData.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    // Only items with full channel data
    const validItems = rawData.filter(d => d.colormap && d.cValues && d.lValues && d.metadata);

    // Group by hue target
    const hueGroups = {};
    validItems.forEach(item => {
        const hue = (item.metadata && item.metadata.hueTarget != null) ? item.metadata.hueTarget : 'unknown';
        if (!hueGroups[hue]) hueGroups[hue] = [];
        hueGroups[hue].push(item);
    });

    const panelEl = d3.select('#designSpacePanel');
    panelEl.html('');

    panelEl.append('h3')
        .attr('class', 'dsp-main-title')
        .text('🎨 色图全览（按色相分组）— 色图 · Chroma · Luminance');

    const sortedHues = Object.keys(hueGroups).sort((a, b) => +a - +b);

    sortedHues.forEach(hue => {
        const items = hueGroups[hue];
        const group = panelEl.append('div').attr('class', 'dsp-hue-group');

        group.append('div').attr('class', 'dsp-hue-label')
            .html(`Hue ${hue}°<span class="dsp-count">${items.length} colormaps</span>`);

        // Column header row
        const header = group.append('div').attr('class', 'dsp-sm-row dsp-sm-header');
        header.append('div').attr('class', 'dsp-sm-col-map').text('色图 Color Map');
        header.append('div').text('Chroma');
        header.append('div').text('Luminance');

        items.forEach((item, idx) => {
            const row = group.append('div')
                .attr('class', `dsp-sm-row${idx % 2 === 1 ? ' dsp-sm-row-alt' : ''}`);

            // Left: colormap strip + pattern label
            const mapCol = row.append('div').attr('class', 'dsp-sm-col-map');
            drawColormapStrip(mapCol, item.colormap, item.success);

            // Middle: chroma sparkline (actual cValues from data)
            drawSparkline(row.append('div'), item.cValues, '#E91E63', [0, 130]);

            // Right: luminance sparkline (actual lValues from data)
            drawSparkline(row.append('div'), item.lValues, '#3F51B5', [0, 100]);
        });
    });
}

/** Draw a horizontal colormap bar + metadata label */
function drawColormapStrip(container, colormap, isSuccess) {
    const W = 220, H = 28;
    const n = colormap.length;

    const wrapper = container.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '5px');

    // Render to canvas, then export as PNG <img> for native right-click copy
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    colormap.forEach((c, i) => {
        const x0 = Math.floor((i / n) * W);
        const x1 = Math.floor(((i + 1) / n) * W) + 1;
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(x0, 0, x1 - x0, H);
    });

    const img = document.createElement('img');
    img.width = W;
    img.height = H;
    img.style.borderRadius = '3px';
    img.style.flexShrink = '0';
    img.style.display = 'block';
    img.src = canvas.toDataURL('image/png');

    wrapper.node().appendChild(img);
}

/** Draw a compact sparkline (small multiple style with minimal axes) */
function drawSparkline(container, values, color, yDomain) {
    if (!values || values.length === 0) {
        container.append('div').style('color', '#ddd').style('font-size', '10px').text('—');
        return;
    }
    const W = 140, H = 52;
    const pad = { t: 4, b: 8, l: 24, r: 4 };
    const iW = W - pad.l - pad.r;
    const iH = H - pad.t - pad.b;

    // Render SVG into DOM first (getBoundingClientRect needs it to be attached)
    const svg = container.append('svg')
        .attr('width', W).attr('height', H)
        .style('background', '#f8f8f8')
        .style('border-radius', '3px');

    const g = svg.append('g').attr('transform', `translate(${pad.l},${pad.t})`);

    const xScale = d3.scaleLinear().domain([0, values.length - 1]).range([0, iW]);
    const yScale = d3.scaleLinear().domain(yDomain).range([iH, 0]);

    // X axis: domain line only, no tick marks or labels
    g.append('g')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(xScale).tickValues([]))
        .call(ax => {
            ax.select('.domain').attr('stroke', '#d6d6d6');
        });

    // Y axis: ticks and labels
    g.append('g')
        .call(d3.axisLeft(yScale).ticks(3).tickFormat(d3.format('d')))
        .style('font-size', '9px')
        .call(ax => {
            ax.select('.domain').attr('stroke', '#d6d6d6');
            ax.selectAll('line').attr('stroke', '#d6d6d6');
            ax.selectAll('text').attr('fill', '#666');
        });

    // Subtle fill area
    g.append('path')
        .datum(values)
        .attr('d', d3.area()
            .x((d, i) => xScale(i))
            .y0(iH)
            .y1(d => yScale(d)))
        .attr('fill', color)
        .attr('opacity', 0.15);

    // Curve line
    g.append('path')
        .datum(values)
        .attr('d', d3.line()
            .x((d, i) => xScale(i))
            .y(d => yScale(d)))
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.5);

    // Convert SVG to PNG <img> for native right-click copy
    const svgNode = svg.node();
    svgToPngBlob(svgNode, 2).then(blob => {
        const url = URL.createObjectURL(blob);
        const img = document.createElement('img');
        img.width = W;
        img.height = H;
        img.style.display = 'block';
        img.style.borderRadius = '3px';
        img.src = url;
        svgNode.parentNode.replaceChild(img, svgNode);
    }).catch(() => { /* fallback: leave SVG in place */ });
}

/** Convert SVG element to PNG blob (returns Promise<Blob>) */
function svgToPngBlob(svgElement, scale = 2) {
    return new Promise((resolve, reject) => {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const bbox = svgElement.getBoundingClientRect();

        const canvas = document.createElement('canvas');
        canvas.width = bbox.width * scale;
        canvas.height = bbox.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = function() {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
        img.src = url;
    });
}

/** Copy SVG element to clipboard as PNG */
function copySVGToClipboard(svgElement, name) {
    // Create the blob Promise first (starts async work immediately)
    const blobPromise = svgToPngBlob(svgElement);

    // Call clipboard.write() SYNCHRONOUSLY within the user gesture,
    // passing the Promise<Blob> directly — browser grants permission now,
    // waits for the blob to resolve without breaking the gesture context.
    navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobPromise })
    ]).then(() => {
        showToast(`${name} 已复制到剪贴板`);
    }).catch(err => {
        console.error('Clipboard API 失败:', err);
        // Fallback: download
        blobPromise.then(blob => {
            const link = document.createElement('a');
            link.download = `${name}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            showToast(`已下载为 ${name}.png（剪贴板不可用）`, false);
        });
    });
}

/** Download SVG element as PNG */
function downloadSVG(svgElement, filename) {
    const svgNode = svgElement;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgNode);
    
    const canvas = document.createElement('canvas');
    const bbox = svgNode.getBoundingClientRect();
    const scale = 2; // Higher resolution
    canvas.width = bbox.width * scale;
    canvas.height = bbox.height * scale;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = function() {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        
        canvas.toBlob(function(blob) {
            const link = document.createElement('a');
            link.download = filename;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
        }, 'image/png');
    };
    
    img.src = url;
}

/** Show toast notification */
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${isError ? '#e74c3c' : '#27ae60'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Convert HCL (H°, C, L in LCH/HCL) to sRGB [0-255] — kept for potential reuse
function hclToRgb(H, C, L) {
    const hRad = H * Math.PI / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);
    let fy = (L + 16) / 116;
    let fx = a / 500 + fy;
    let fz = fy - b / 200;
    const d = 6 / 29;
    const x = (fx > d ? fx ** 3 : (fx - 16 / 116) * 3 * d * d) * 0.95047;
    const y = (fy > d ? fy ** 3 : (fy - 16 / 116) * 3 * d * d) * 1.00000;
    const z = (fz > d ? fz ** 3 : (fz - 16 / 116) * 3 * d * d) * 1.08883;
    let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    let bv = x * 0.0557 + y * -0.2040 + z * 1.0570;
    const gamma = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    r = Math.round(Math.min(255, Math.max(0, gamma(r) * 255)));
    g = Math.round(Math.min(255, Math.max(0, gamma(g) * 255)));
    bv = Math.round(Math.min(255, Math.max(0, gamma(bv) * 255)));
    return [r, g, bv];
}
