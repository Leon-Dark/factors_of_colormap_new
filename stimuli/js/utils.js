// Utility Functions - Color conversion and calculations

// CIEDE2000 color difference calculation
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

// Helper function to convert RGB colormap to standard format
function convertColormapToStandardFormat(colormap) {
    if (!colormap || colormap.length === 0) {
        console.error("Invalid colormap:", colormap);
        return null;
    }

    const standardizedColors = [];
    for (let i = 0; i < colormap.length; i++) {
        const color = colormap[i];
        let r, g, b;

        if (typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
            r = Math.round(color.r);
            g = Math.round(color.g);
            b = Math.round(color.b);
        } else if (Array.isArray(color) && color.length >= 3) {
            r = Math.round(color[0]);
            g = Math.round(color[1]);
            b = Math.round(color[2]);
        } else {
            console.warn(`Invalid color at index ${i}:`, color);
            continue;
        }

        standardizedColors.push({
            value: i / (colormap.length - 1),
            rgb: [r, g, b]
        });
    }

    if (standardizedColors.length === 0) {
        console.error("No valid colors found in colormap");
        return null;
    }

    return standardizedColors;
}

// Simplified ΔE calculation (for contrast sensitivity)
function computeDeltaE(L1, a1, b1, L2, a2, b2, wa = 0.1, wb = 0.1) {
    if (isNaN(L1) || isNaN(a1) || isNaN(b1) || isNaN(L2) || isNaN(a2) || isNaN(b2)) {
        console.error("computeDeltaE received invalid parameters:", { L1, a1, b1, L2, a2, b2 });
        return 0;
    }

    let deltaL = L1 - L2;
    let deltaA = a1 - a2;
    let deltaB = b1 - b2;

    if (isNaN(deltaL) || isNaN(deltaA) || isNaN(deltaB)) {
        console.error("computeDeltaE calculation error:", { deltaL, deltaA, deltaB });
        return 0;
    }

    const result = Math.sqrt(
        Math.pow(deltaL, 2) +
        wa * Math.pow(deltaA, 2) +
        wb * Math.pow(deltaB, 2)
    );

    if (isNaN(result)) {
        console.error("computeDeltaE final result is NaN");
        return 0;
    }

    return result;
}

// Get color name index (nearest color in c3.color array)
function getColorNameIndex(c) {
    if (typeof c3 === 'undefined' || !c3.color) {
        return 0;
    }

    var x = d3.lab(c);
    var minDist = Number.MAX_VALUE;
    var minIndex = 0;

    var xL = x.l !== undefined ? x.l : x.L;
    var xA = x.a;
    var xB = x.b;

    for (var i = 0; i < c3.color.length; i++) {
        var c2 = c3.color[i];
        var c2L = c2.l !== undefined ? c2.l : c2.L;
        var c2A = c2.a;
        var c2B = c2.b;

        var dist = Math.sqrt(
            Math.pow(xL - c2L, 2) +
            Math.pow(xA - c2A, 2) +
            Math.pow(xB - c2B, 2)
        );

        if (dist < minDist) {
            minDist = dist;
            minIndex = i;
        }
    }

    return minIndex;
}

// Get name difference between two colors
function getNameDifference(c0, c1) {
    if (typeof c3 === 'undefined' || !c3.color) {
        var lab0 = d3.lab(c0);
        var lab1 = d3.lab(c1);
        var lVal0 = lab0.l !== undefined ? lab0.l : lab0.L;
        var lVal1 = lab1.l !== undefined ? lab1.l : lab1.L;
        return Math.sqrt(
            Math.pow(lVal1 - lVal0, 2) +
            Math.pow(lab1.a - lab0.a, 2) +
            Math.pow(lab1.b - lab0.b, 2)
        ) / 100;
    }

    var i0 = getColorNameIndex(c0);
    var i1 = getColorNameIndex(c1);

    if (i0 === i1) {
        return 0;
    }

    try {
        var hellinger = c3.color.hellinger(i0, i1);
        return hellinger;
    } catch (e) {
        return 0;
    }
}

// Get name salience for a color
function nameSalience(c) {
    if (typeof c3 === 'undefined' || !c3.color) {
        return 0;
    }

    var minE = -4.5;
    var maxE = 0.0;
    var i = getColorNameIndex(c);
    var ent = c3.color.entropy(i);
    return (ent - minE) / (maxE - minE);
}

// Parse control points for interpolation
function parseControlPoints(points) {
    if (Array.isArray(points)) {
        return points;
    }
    return points.split(',').map(p => parseFloat(p.trim()));
}

// Multi-segment interpolation
function interpolateMultiSegment(t, controlPoints) {
    const n = controlPoints.length - 1;
    const scaledT = t * n;
    const segment = Math.min(Math.floor(scaledT), n - 1);
    const localT = scaledT - segment;
    return controlPoints[segment] * (1 - localT) + controlPoints[segment + 1] * localT;
}

// Check if colormap satisfies discriminability
function satisfyDiscriminability(colormap, sampleNum = 10) {
    const sampled_colormap = [];
    for (let i = 0; i < colormap.length; i += Math.floor(colormap.length / sampleNum)) {
        let lab = d3.lab(colormap[i]);
        sampled_colormap.push([lab.l, lab.a, lab.b]);
    }

    for (let i = 0; i < sampled_colormap.length; i++) {
        for (let j = i + 1; j < sampled_colormap.length; j++) {
            let deltaE = ciede2000(sampled_colormap[i], sampled_colormap[j])
            if (deltaE < 3) {
                return false
            }
        }
    }
    return true
}
