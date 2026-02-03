// Viewer Logic for Batch Generated Colormaps

// Global state
let rawData = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
    } catch (e) {
        console.error("Failed to load colormaps:", e);
        document.getElementById('colormapsGrid').innerHTML = `<div style="color:red; padding:20px;">Error loading data: ${e.message}. Is 'output/colormaps.json' generated?</div>`;
    }
});

async function loadData() {
    console.log("Fetching output/colormaps_best.json...");
    const response = await fetch('output/colormaps_best.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    rawData = await response.json();
    console.log(`Loaded ${rawData.length} colormaps`);

    // Update stats
    document.getElementById('totalCount').innerText = rawData.length;

    // Initial Render
    renderGrid();
}

function renderGrid() {
    // Clear grid
    d3.select("#colormapsGrid").selectAll("*").remove();

    // Use all data
    const filteredData = rawData;

    // Update count
    document.getElementById('visibleCount').innerText = filteredData.length;

    // Render each item
    filteredData.forEach((item, index) => {
        // Transform [r,g,b] array to {r,g,b} object for d3 / visualization.js
        const colormapObjs = item.colormap.map(c => d3.rgb(c[0], c[1], c[2]));

        // Reconstruct condition object compatible with visualization.js
        const candidate = {
            colormap: colormapObjs,
            hValues: item.hValues,
            cValues: item.cValues,
            lValues: item.lValues
        };

        // Construct simplified description string
        const m = item.metadata;
        const hStart = Math.round(item.hValues[0]);
        const hEnd = Math.round(item.hValues[item.hValues.length - 1]);

        const hueDiff = m.hueTarget;

        const formatArr = (arr) => `[${arr.map(v => Math.round(v)).join(',')}]`;

        const conditionStr = `H diff=${hueDiff}, H Range=[${hStart}, ${hEnd}], C=${formatArr(m.adjustedChroma)}, L=${formatArr(m.adjustedLumi)}`;

        // Draw card
        drawGivenColormap2(candidate, `#${item.id + 1} ${conditionStr}`);
    });
}
