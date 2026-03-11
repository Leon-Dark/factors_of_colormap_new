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
