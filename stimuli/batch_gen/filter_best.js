const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'output', 'colormaps.json');
const OUTPUT_FILE = path.join(__dirname, 'output', 'colormaps_best.json');

function run() {
    console.log(`Reading ${INPUT_FILE}...`);
    if (!fs.existsSync(INPUT_FILE)) {
        console.error("Input file not found!");
        return;
    }

    const rawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    console.log(`Loaded ${rawData.length} colormaps.`);

    // Group by configuration key
    // Key = Hue + C_Pattern + L_Pattern
    const groups = {};

    rawData.forEach(item => {
        const key = `${item.metadata.hueTarget}_${item.metadata.chromaPattern}_${item.metadata.lumiPattern}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
    });

    const bestColormaps = [];
    let keys = Object.keys(groups);
    console.log(`Found ${keys.length} unique configurations.`);

    keys.forEach(key => {
        const candidates = groups[key];

        // Sort by minimal perturbation (Euclidean distance of deltaC, deltaL)
        // If tie, use retryCount (less is better, though retryCount is correlated with difficulty)
        // Or we can use the "attempts" from searchStats as a tie breaker for "search effort"

        candidates.sort((a, b) => {
            const distA = Math.hypot(a.metadata.deltaC, a.metadata.deltaL);
            const distB = Math.hypot(b.metadata.deltaC, b.metadata.deltaL);

            if (Math.abs(distA - distB) > 0.001) {
                return distA - distB; // Smaller distance is better
            }

            // Tie-breaker: original Hue deviation?
            // The algorithm tries to keep hue close to target. 
            // metadata.actualHue vs metadata.hueTarget
            // But wait, actualHue is random start? No, actualHue is the *adjusted* hue after retry.
            // Ideally we want actualHue to be close to hueTarget OR just any working one.
            // Let's use retryCount as tie breaker (less retries = easier to find = maybe more stable?)
            return a.metadata.retryCount - b.metadata.retryCount;
        });

        // Pick the best one
        const best = candidates[0];

        // Assign a new clean ID (optional, but good for viewer)
        // best.id will be reassigned later or we assume current IDs are fine?
        // Let's reassign IDs to be 0..47 for cleanliness

        bestColormaps.push(best);
    });

    // Sort result by Hue -> Lumi -> Chroma for consistent order
    bestColormaps.sort((a, b) => {
        const mA = a.metadata;
        const mB = b.metadata;

        if (mA.hueTarget !== mB.hueTarget) return mA.hueTarget - mB.hueTarget;

        // Custom order for patterns?
        // Constant < Linear < Diverging < Thermal
        const pOrder = { 'constant': 0, 'linear': 1, 'diverging': 2, 'thermal': 3 };

        if (mA.lumiPattern !== mB.lumiPattern) return pOrder[mA.lumiPattern] - pOrder[mB.lumiPattern];
        return pOrder[mA.chromaPattern] - pOrder[mB.chromaPattern];
    });

    // Reassign IDs
    bestColormaps.forEach((item, index) => {
        item.id = index;
    });

    console.log(`Selected ${bestColormaps.length} best colormaps.`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(bestColormaps, null, 2));
    console.log(`Success! Saved to ${OUTPUT_FILE}`);
}

run();
