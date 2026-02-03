// Colormap generator - ported from browser version

const d3 = require('d3');
const {
    parseControlPoints,
    interpolateMultiSegment,
    satisfyDiscriminability
} = require('./utils');

/**
 * Generate colormap based on parameters
 */
function generate(targetH, targetC, targetL, controlPoints_c, controlPoints_l) {
    if (targetC < 0 || targetL < 0) return [];

    const cControls = parseControlPoints(controlPoints_c);
    const lControls = parseControlPoints(controlPoints_l);

    let hue_start = Math.random() * 360;

    const sampleN = 256;
    const step = 5;
    const candidates = [];

    for (let hStart = 0; hStart <= 360; hStart += step) {
        for (let cBase = 20; cBase <= 130 - targetC; cBase += step) {
            for (let lBase = 20; lBase <= 100 - targetL; lBase += step) {
                const hEnd = (hue_start + hStart - targetH + 360) % 360;
                const colormap = [];
                const hValues = [], cValues = [], lValues = [];

                for (let i = 0; i < sampleN; i++) {
                    const t = i / (sampleN - 1);
                    const h1 = (hue_start + hStart) % 360;
                    const h2 = hEnd;
                    let hue;
                    if (h2 < h1)
                        hue = (h1 + (h2 - h1) * t) % 360;
                    else
                        hue = (h1 + (h2 - h1 - 360) * t + 360) % 360;
                    const h = hue;

                    const cInterp = interpolateMultiSegment(t, cControls);
                    const cMin = d3.min(cControls), cMax = d3.max(cControls);
                    let cNorm = (cInterp - cMin) / Math.max(1e-5, cMax - cMin);
                    let c = cBase + targetC * cNorm;
                    if (controlPoints_c[0] == controlPoints_c[1]) {
                        c = 20 - cBase + controlPoints_c[0];
                    }

                    const lInterp = interpolateMultiSegment(t, lControls);
                    const lMin = d3.min(lControls), lMax = d3.max(lControls);
                    let lNorm = (lInterp - lMin) / Math.max(1e-5, lMax - lMin);
                    let l = lBase + targetL * lNorm;
                    if (controlPoints_l[0] == controlPoints_l[1]) {
                        l = 20 - lBase + controlPoints_l[0];
                    }

                    const rgb = d3.hcl(h, c, l).rgb();
                    if (!rgb.displayable()) break;
                    colormap.push(d3.rgb(rgb.r, rgb.g, rgb.b));
                    hValues.push(h);
                    cValues.push(c);
                    lValues.push(l);
                }

                if (colormap.length === sampleN && satisfyDiscriminability(colormap)) {
                    candidates.push({ colormap, hValues, cValues, lValues });
                }
            }
        }
    }

    // Sort candidates by chroma and luminance error
    candidates.sort((a, b) => {
        const errA = Math.abs(d3.max(a.cValues) - d3.max(controlPoints_c) + d3.min(controlPoints_c) - d3.min(a.cValues)) +
            Math.abs(d3.max(a.lValues) - d3.max(controlPoints_l) + d3.min(controlPoints_l) - d3.min(a.lValues));
        const errB = Math.abs(d3.max(b.cValues) - d3.max(controlPoints_c) + d3.min(controlPoints_c) - d3.min(b.cValues)) +
            Math.abs(d3.max(b.lValues) - d3.max(controlPoints_l) + d3.min(controlPoints_l) - d3.min(b.lValues));
        return errA - errB;
    });

    return candidates;
}

module.exports = {
    generate
};
