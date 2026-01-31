// Color Generation Functions (Cmax-optimized version)
// Note: getCmax, getCpeak, getCmaxSafe functions are provided by the parent context

/**
 * Wrap hue to [0, 360) range
 */
function wrap360(h) {
    h = h % 360;
    if (h < 0) h += 360;
    return h;
}

/**
 * Presample shape function to 256 points
 */
function presampleShape(controlPoints, sampleCount = 256) {
    const shape = new Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
        const t = i / (sampleCount - 1);
        shape[i] = interpolateMultiSegment(t, controlPoints);
    }
    return shape;
}

/**
 * Adjust control points by reducing the range while preserving shape relationships
 * @param {Array} controlPoints - Original control points (e.g., [20, 120] or [20, 120, 20])
 * @param {number} delta - Amount to reduce the range by
 * @returns {Array} Adjusted control points with preserved shape
 */
function adjustControlPoints(controlPoints, delta) {
    // Constant type: no adjustment needed
    if (controlPoints.length === 2 && controlPoints[0] === controlPoints[1]) {
        return [...controlPoints];
    }

    const min = Math.min(...controlPoints);
    const max = Math.max(...controlPoints);
    const newMax = Math.max(min, max - delta);  // Ensure newMax >= min

    // Replace all max values with newMax, keep others unchanged
    return controlPoints.map(p => p === max ? newMax : p);
}

/**
 * Compute upper bound on αC using Cpeak (for quick pruning)
 */
function computeAlphaCUpperBound(H0, targetH, targetC, sC, samplePoints = 16) {
    let alphaCMax = Infinity;

    for (let i = 0; i < samplePoints; i++) {
        const t = i / (samplePoints - 1);
        const H = wrap360(H0 + targetH * t);
        const cpeak = getCpeak(H);

        const scVal = sC[Math.floor(t * (sC.length - 1))];
        if (scVal > 0) {
            alphaCMax = Math.min(alphaCMax, cpeak / (targetC * scVal));
        }
    }

    return Math.min(1.0, alphaCMax);
}

/**
 * Compute maximum feasible αC given parameters
 */
function computeMaxAlphaC(H0, targetH, alphaL, Lb, targetC, targetL, sC, sL) {
    let alphaCMax = Infinity;

    for (let i = 0; i < sC.length; i++) {
        const t = i / (sC.length - 1);
        const H = wrap360(H0 + targetH * t);
        const L = Lb + alphaL * targetL * sL[i];

        // Use smaller safety margin to allow more space
        const cmax = getCmaxSafe(H, L, 0.2);

        if (sC[i] > 0) {
            const limit = cmax / (targetC * sC[i]);
            alphaCMax = Math.min(alphaCMax, limit);
        }
    }

    return Math.min(1.0, alphaCMax);
}

/**
 * Compute feasible Lb range given αL
 */
function computeLbRange(alphaL, targetL, sL) {
    const sLMin = Math.min(...sL);
    const sLMax = Math.max(...sL);

    const lbMin = Math.max(0, -alphaL * targetL * sLMin);
    const lbMax = Math.min(100, 100 - alphaL * targetL * sLMax);

    return [lbMin, lbMax];
}

/**
 * Compute optimal Cb given other parameters
 */
function computeOptimalCb(H0, targetH, alphaC, alphaL, Lb, targetC, targetL, sC, sL, preferredCb = null) {
    let cbMax = Infinity;

    for (let i = 0; i < sC.length; i++) {
        const t = i / (sC.length - 1);
        const H = wrap360(H0 + targetH * t);
        const L = Lb + alphaL * targetL * sL[i];

        const cmax = getCmaxSafe(H, L, 0.2);
        const limit = cmax - alphaC * targetC * sC[i];
        cbMax = Math.min(cbMax, limit);
    }

    // Prefer value close to original if possible
    if (preferredCb !== null) {
        return Math.max(0, Math.min(preferredCb, cbMax));
    }

    return Math.max(0, cbMax);
}

/**
 * Search for optimal αL and Lb for a given H0
 */
function searchAlphaLAndLb(H0, targetH, targetC, targetL, sC, sL, controlPoints_c, controlPoints_l) {
    let bestCandidate = null;
    let bestScore = -Infinity;

    // Compute ideal bases (what would give exact match to control points)
    const cControls = parseControlPoints(controlPoints_c);
    const lControls = parseControlPoints(controlPoints_l);
    const idealCb = d3.min(cControls);
    const idealLb = d3.min(lControls);

    // Try αL from 1.0 down to 0.0 (balanced granularity)
    for (let alphaL = 1.0; alphaL >= 0; alphaL -= 0.01) {
        const [lbMin, lbMax] = computeLbRange(alphaL, targetL, sL);

        // Scan Lb with finer granularity
        const lbStep = Math.max(0.5, (lbMax - lbMin) / 40);

        for (let Lb = lbMin; Lb <= lbMax; Lb += lbStep) {
            // Compute maximum feasible αC
            const alphaC = computeMaxAlphaC(H0, targetH, alphaL, Lb, targetC, targetL, sC, sL);

            if (alphaC >= 0) {
                // Compute optimal Cb
                const Cb = computeOptimalCb(H0, targetH, alphaC, alphaL, Lb, targetC, targetL, sC, sL, idealCb);

                // Score: prefer less shrinkage, prefer staying close to ideal bases
                const shrinkageScore = alphaC + alphaL;
                const cbError = Math.abs(Cb - idealCb) / 100;
                const lbError = Math.abs(Lb - idealLb) / 100;
                const score = shrinkageScore * 10 - cbError - lbError;

                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = { H0, alphaC, alphaL, Cb, Lb, score };
                }
            }
        }

        // Early exit if we found a good solution at high αL
        if (bestCandidate && alphaL >= 0.9) break;
    }

    return bestCandidate;
}

/**
 * Validate candidate by actual RGB conversion
 */
function validateByRGB(candidate, targetH, targetC, targetL, controlPoints_c, controlPoints_l) {
    const { H0, alphaC, alphaL, Cb, Lb } = candidate;

    const cControls = parseControlPoints(controlPoints_c);
    const lControls = parseControlPoints(controlPoints_l);

    const sC = presampleShape(cControls, 256);
    const sL = presampleShape(lControls, 256);

    const colormap = [];
    const hValues = [], cValues = [], lValues = [];

    for (let i = 0; i < 256; i++) {
        const t = i / 255;
        const H = wrap360(H0 + targetH * t);
        const C = Cb + alphaC * targetC * sC[i];
        const L = Lb + alphaL * targetL * sL[i];

        const rgb = d3.hcl(H, C, L).rgb();
        if (!rgb.displayable()) {
            return null;  // Validation failed
        }

        colormap.push(d3.rgb(rgb.r, rgb.g, rgb.b));
        hValues.push(H);
        cValues.push(C);
        lValues.push(L);
    }

    // Check basic discriminability
    if (!satisfyDiscriminability(colormap)) {
        return null;
    }

    // Check Uniform Mode quality constraints
    const hclPalette = convertColormapToHCLPalette(colormap);
    const smallWindowDiff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_SMALL_INTERVAL_K, UNIFORM_SAMPLE_COUNT);
    const largeWindowDiff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_LARGE_INTERVAL_K, UNIFORM_SAMPLE_COUNT);

    const passSmall = smallWindowDiff >= UNIFORM_SMALL_MIN_DIFF;
    const passLarge = largeWindowDiff >= UNIFORM_LARGE_MIN_DIFF;

    if (!passSmall || !passLarge) {
        return null;  // Failed Uniform Mode quality check
    }

    return { colormap, hValues, cValues, lValues };
}

// Generate colormap based on parameters (NEW ALGORITHM)
function generate(targetH, targetC, targetL, controlPoints_c, controlPoints_l) {
    if (targetC < 0 || targetL < 0) return [];

    const cControls = parseControlPoints(controlPoints_c);
    const lControls = parseControlPoints(controlPoints_l);

    // Presample shapes
    const sC = presampleShape(cControls, 256);
    const sL = presampleShape(lControls, 256);

    const candidates = [];

    // Scan Hue with Cpeak pruning
    const hueStep = 0.5;  // Very fine scan for maximum coverage

    for (let H0 = 0; H0 < 360; H0 += hueStep) {
        // Quick pruning using Cpeak (very lenient threshold)
        const alphaCUpperBound = computeAlphaCUpperBound(H0, targetH, targetC, sC, 32);
        if (alphaCUpperBound < 0.05) continue;  // Skip only if nearly impossible

        // Search for best αL and Lb
        const candidate = searchAlphaLAndLb(H0, targetH, targetC, targetL, sC, sL, controlPoints_c, controlPoints_l);

        if (candidate) {
            candidates.push(candidate);
        }
    }

    // Sort by score (higher is better)
    candidates.sort((a, b) => b.score - a.score);

    // Validate top candidates
    const validatedResults = [];
    for (let i = 0; i < Math.min(5, candidates.length); i++) {
        const result = validateByRGB(candidates[i], targetH, targetC, targetL, controlPoints_c, controlPoints_l);
        if (result) {
            validatedResults.push(result);
        }
    }

    // If top candidates failed, try with fallback (reduce αC slightly)
    if (validatedResults.length === 0 && candidates.length > 0) {
        for (let i = 0; i < Math.min(50, candidates.length); i++) {
            const candidate = { ...candidates[i] };
            candidate.alphaC *= 0.98;  // Reduce by 2%
            candidate.Cb = computeOptimalCb(
                candidate.H0, targetH, candidate.alphaC, candidate.alphaL, candidate.Lb,
                targetC, targetL, sC, sL, null
            );

            const result = validateByRGB(candidate, targetH, targetC, targetL, controlPoints_c, controlPoints_l);
            if (result) {
                validatedResults.push(result);
                break;
            }
        }
    }

    return validatedResults;
}
