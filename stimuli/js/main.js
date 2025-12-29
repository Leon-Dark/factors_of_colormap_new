// Main Entry Point - Generate All Colormaps

function generateAll() {
    // Clear previous results
    d3.select("#colormapsGrid").selectAll("*").remove();
    allColormaps = [];
    colormapElements = [];
    
    const hue_targets = COLOR_SPACE_PARAMS.hueTargets;
    const chromas = COLOR_SPACE_PARAMS.chromas;
    const lumis = COLOR_SPACE_PARAMS.lumis;
    
    const chroma_array = [
        [70, 70],                                   // Constant
        [chromas[0], chromas[1]],                   // Linear
        [chromas[0], chromas[1], chromas[0]],       // Diverging
        [chromas[0], chromas[1], chromas[0], chromas[1], chromas[0]] // Thermal
    ];
    
    const lumi_array = [
        [55, 55],                                   // Constant
        [lumis[0], lumis[1]],                       // Linear
        [lumis[0], lumis[1], lumis[0]],             // Diverging
        [lumis[0], lumis[1], lumis[0], lumis[1], lumis[0]] // Thermal
    ];

    const perturbOffsets = [];
    for (let i = 0; i <= 70; i += 5) {
        for (let j = 0; j <= 50; j += 5) {
            perturbOffsets.push([i, j]);
        }
    }
    perturbOffsets.sort((a, b) =>
        Math.hypot(...a) - Math.hypot(...b)
    );
    console.log("perturbOffsets", perturbOffsets);
    
    let colormap_count = 0
    let hue_index = 0;
    for (let hue of hue_targets) {
        for (let lumi of lumi_array) {
            let luminance_target = lumi[1] - lumi[0];
            for (let chroma of chroma_array) {
                let chroma_target = chroma[1] - chroma[0];
                let used_chroma = chroma_target, used_lumi = luminance_target;
                let colormap
                for (let i = 0; i < perturbOffsets.length; i++) {
                    used_chroma = Math.max(0, chroma_target - perturbOffsets[i][0]);
                    used_lumi = Math.max(0, luminance_target - perturbOffsets[i][1]);
                    colormap = generate(hue, used_chroma, used_lumi, chroma, lumi);
                    if (colormap.length > 0) {
                        break;
                    }
                }
                if (colormap.length > 0) {
                    const condition = `H diff=${hue}, C=[${chroma}], L=[${lumi}]` + ", chroma diff=" + used_chroma + `(${chroma_target})` + ", lumi diff=" + used_lumi + `(${luminance_target})`;
                    drawGivenColormap2(colormap[0], (colormap_count++) + ", " + condition);
                }
            }
        }
        hue_index++;
    }
    
    // Update statistics after all colormaps are generated
    updateStatistics();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Stimuli Generator loaded - Modular version');
    console.log('Current sampling mode:', SAMPLING_MODE);
    
    // Initialize c3 color naming library (async)
    if (typeof c3 !== 'undefined' && typeof d3 !== 'undefined') {
        try {
            // Use async loading to avoid synchronous XMLHttpRequest issues
            c3.load('../rainbows good or bad for/supplementary materials/experiment interface/lib/colorname/c3_data.json', true);
            console.log('c3 color naming library loading (async)...');
            
            // Check after a delay if c3.color is available
            setTimeout(function() {
                if (c3.color && c3.color.length > 0) {
                    console.log('c3 initialized successfully with', c3.color.length, 'colors');
                } else {
                    console.warn('c3 not fully initialized, using LAB color difference fallback');
                }
            }, 1000);
        } catch (e) {
            console.warn('Failed to initialize c3 (using fallback):', e.message);
        }
    } else {
        console.warn('c3 or d3 not available, using LAB color difference fallback');
    }
});
