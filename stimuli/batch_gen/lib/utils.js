// Shared utility functions for colormap generation

const d3 = require('d3');

/**
 * CIEDE2000 color difference calculation
 */
function ciede2000(lab1, lab2) {
    const [L1, a1, b1] = lab1;
    const [L2, a2, b2] = lab2;

    const kL = 1, kC = 1, kH = 1;
    const deg2rad = angle => angle * (Math.PI / 180);
    const rad2deg = angle => angle * (180 / Math.PI);

    const avgL = (L1 + L2) / 2;
    const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
    const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);
    const avgC = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);

    const C1p = Math.sqrt(a1p ** 2 + b1 ** 2);
    const C2p = Math.sqrt(a2p ** 2 + b2 ** 2);
    const avgCp = (C1p + C2p) / 2;

    let h1p = b1 === 0 && a1p === 0 ? 0 : Math.atan2(b1, a1p);
    let h2p = b2 === 0 && a2p === 0 ? 0 : Math.atan2(b2, a2p);
    if (h1p < 0) h1p += 2 * Math.PI;
    if (h2p < 0) h2p += 2 * Math.PI;

    const avgHp =
        Math.abs(h1p - h2p) <= Math.PI
            ? (h1p + h2p) / 2
            : (h1p + h2p + 2 * Math.PI) / 2;

    const T =
        1 -
        0.17 * Math.cos(avgHp - deg2rad(30)) +
        0.24 * Math.cos(2 * avgHp) +
        0.32 * Math.cos(3 * avgHp + deg2rad(6)) -
        0.2 * Math.cos(4 * avgHp - deg2rad(63));

    let deltaHp = h2p - h1p;
    if (Math.abs(deltaHp) <= Math.PI) {
        deltaHp = deltaHp;
    } else if (deltaHp > Math.PI) {
        deltaHp -= 2 * Math.PI;
    } else {
        deltaHp += 2 * Math.PI;
    }

    const deltaL = L2 - L1;
    const deltaCp = C2p - C1p;
    const deltaH = 2 * Math.sqrt(C1p * C2p) * Math.sin(deltaHp / 2);

    const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
    const SC = 1 + 0.045 * avgCp;
    const SH = 1 + 0.015 * avgCp * T;

    const deltaTheta = deg2rad(30) * Math.exp(-(((rad2deg(avgHp) - 275) / 25) ** 2));
    const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
    const RT = -RC * Math.sin(2 * deltaTheta);

    const deltaE =
        Math.sqrt(
            (deltaL / (kL * SL)) ** 2 +
            (deltaCp / (kC * SC)) ** 2 +
            (deltaH / (kH * SH)) ** 2 +
            RT * (deltaCp / (kC * SC)) * (deltaH / (kH * SH))
        );

    return deltaE;
}

/**
 * Parse control points for interpolation
 */
function parseControlPoints(points) {
    if (Array.isArray(points)) {
        return points;
    }
    return points.split(',').map(p => parseFloat(p.trim()));
}

/**
 * Multi-segment interpolation
 */
function interpolateMultiSegment(t, controlPoints) {
    const n = controlPoints.length - 1;
    const scaledT = t * n;
    const segment = Math.min(Math.floor(scaledT), n - 1);
    const localT = scaledT - segment;
    return controlPoints[segment] * (1 - localT) + controlPoints[segment + 1] * localT;
}

/**
 * Convert colormap to HCL palette
 */
function convertColormapToHCLPalette(colormap) {
    return colormap.map(color => {
        let rgb;

        if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
            rgb = d3.rgb(color.r, color.g, color.b);
        } else if (Array.isArray(color) && color.length >= 3) {
            rgb = d3.rgb(color[0], color[1], color[2]);
        } else {
            rgb = d3.rgb(color);
        }

        const lab = d3.lab(rgb);
        const hcl = d3.hcl(lab);
        return [hcl.h, hcl.c, hcl.l];
    });
}

/**
 * Check if colormap satisfies discriminability
 */
function satisfyDiscriminability(colormap, sampleNum = 10) {
    const sampled_colormap = [];
    for (let i = 0; i < colormap.length; i += Math.floor(colormap.length / sampleNum)) {
        let lab = d3.lab(colormap[i]);
        sampled_colormap.push([lab.l, lab.a, lab.b]);
    }

    for (let i = 0; i < sampled_colormap.length; i++) {
        for (let j = i + 1; j < sampled_colormap.length; j++) {
            let deltaE = ciede2000(sampled_colormap[i], sampled_colormap[j]);
            if (deltaE < 3) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Adjust control points by reducing the range while preserving shape
 */
function adjustControlPoints(controlPoints, delta) {
    // Constant type: no adjustment needed
    if (controlPoints.length === 2 && controlPoints[0] === controlPoints[1]) {
        return [...controlPoints];
    }

    const min = Math.min(...controlPoints);
    const max = Math.max(...controlPoints);
    const newMax = Math.max(min, max - delta);

    // Replace all max values with newMax, keep others unchanged
    return controlPoints.map(p => p === max ? newMax : p);
}

module.exports = {
    ciede2000,
    parseControlPoints,
    interpolateMultiSegment,
    convertColormapToHCLPalette,
    satisfyDiscriminability,
    adjustControlPoints
};
