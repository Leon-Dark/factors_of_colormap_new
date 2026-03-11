#!/usr/bin/env node

/**
 * Batch Colormap Generator - Pattern-Aware 5-Point Method
 *
 * Uses the same three-stage method:
 * 1) Gamut stage: coarse hue-start search + peak-only compression.
 * 2) Quality stage:
 *    - optimize both peak and valley variables (plus constant-point up/down when needed).
 *    - use simulated annealing + deterministic fallback.
 *    - no global C/L base shift; optimization stays pointwise.
 * 3) Compaction stage: reduce deformation while keeping passAll.
 *
 * Target combinations are controlled by CONFIG.comboMode:
 * - 'focus': keep only combos where C or L is thermal/diverging.
 * - 'all': generate all C/L pattern pairs.
 */

const fs = require('fs');
const path = require('path');
const d3 = require('d3');
const { checkQuality } = require('./lib/quality_checker');
const { interpolateMultiSegment } = require('./lib/utils');

// Configuration
const CONFIG = {
    hueTargets: [100, 200, 300],
    perCombination: 5,
    maxGamutRetries: 5,
    maxSearchRounds: 30,
    qualityRetryUntilPass: true,
    comboMode: 'all', // 'all' | 'focus'
    useAnnealingForAllCombos: true,

    optimizationMode: 'QUALITY',
    incrementalSave: 1,

    // Quality thresholds
    uniformSampleCount:20,
    smallWindowK: 2,
    smallWindowThreshold: 3,
    largeWindowK: 5,
    largeWindowThreshold: 10,
    discriminabilitySampleCount:20,
    discriminabilityMinDiff: 3,
    totalDeficitPassThreshold: 1,

    // Optimization bounds
    peakMaxDeltaC: 100,
    peakMaxDeltaL: 70,
    valleyMaxRaiseC: 60,
    valleyMaxRaiseL: 40,
    chromaMin: 20,
    chromaMax: 120,
    lumiMin: 20,
    lumiMax: 90,
    hueBucketInterval: 20,
    gamutCoarseStep: 5,
    gamutFineStep: 2,
    gamutDebug: false,
    gamutDebugTopN: 6,
    gamutDebugTopK: 3,
    minSegmentGapC: 1,
    minSegmentGapL: 1,
    minSegmentRatioC: 0.2,
    minSegmentRatioL: 0.2,
    minRangeRatioC: 0.2,
    minRangeRatioL: 0.2,
    qualitySteps: [5, 2, 1],
    maxQualityItersPerStep: 40
};

const CHROMA_PATTERNS = {
    constant: [70],
    linear: [20, 120],
    diverging: [20, 120, 20],
    thermal: [20, 120, 20, 120, 20]
};

const LUMI_PATTERNS = {
    constant: [55],
    linear: [20, 90],
    diverging: [20, 90, 20],
    thermal: [20, 90, 20, 90, 20]
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function wrapHue(h) {
    const v = h % 360;
    return v < 0 ? v + 360 : v;
}

function isThermalOrDiverging(name) {
    return name === 'thermal' || name === 'diverging';
}

function getTargetCombinations() {
    const combos = [];
    for (const [chromaName, chromaPattern] of Object.entries(CHROMA_PATTERNS)) {
        for (const [lumiName, lumiPattern] of Object.entries(LUMI_PATTERNS)) {
            if (
                CONFIG.comboMode === 'focus' &&
                !isThermalOrDiverging(chromaName) &&
                !isThermalOrDiverging(lumiName)
            ) {
                continue;
            }
            combos.push({ chromaName, chromaPattern, lumiName, lumiPattern });
        }
    }
    return combos;
}

function classifyExtrema(points) {
    let peaks = [];
    let valleys = [];

    for (let i = 0; i < points.length; i++) {
        const left = i > 0 ? points[i - 1] : points[i];
        const right = i < points.length - 1 ? points[i + 1] : points[i];
        const p = points[i];

        const isPeak = p >= left && p >= right && (p > left || p > right);
        const isValley = p <= left && p <= right && (p < left || p < right);

        if (isPeak) peaks.push(i);
        if (isValley) valleys.push(i);
    }

    // Flat patterns (e.g. constant) have no extrema under strict test.
    // Treat every index as a "peak" so gamut stage can still lower the level.
    if (peaks.length === 0) {
        peaks = points.map((_, i) => i);
    }

    return { peaks, valleys };
}

function buildPatternSpec(name, points, channel) {
    const extrema = classifyExtrema(points);
    const downMax = channel === 'C' ? CONFIG.peakMaxDeltaC : CONFIG.peakMaxDeltaL;
    const upMax = channel === 'C' ? CONFIG.valleyMaxRaiseC : CONFIG.valleyMaxRaiseL;

    return {
        name,
        points: [...points],
        channel,
        peaks: extrema.peaks,
        valleys: extrema.valleys,
        downMax,
        upMax
    };
}

function createComboSpec(chromaName, chromaPattern, lumiName, lumiPattern) {
    return {
        chroma: buildPatternSpec(chromaName, chromaPattern, 'C'),
        lumi: buildPatternSpec(lumiName, lumiPattern, 'L')
    };
}

function getSearchParams() {
    return {
        hueStartStep: 8,
        maxBaseCandidates: 1600,
        maxSeedRefinements: 16,
        seedPruneMargin: 40,
        earlyExitDeformation: 80,
        gamutMaxIters: 90,
        gamutStepC: 2,
        gamutStepL: 2,
        gamutTopKPeaks: 2,
        saMaxIters: 10000,
        saInitialTemp: 12,
        saCooling: 0.993,
        saMinTemp: 0.03,
        saReheatAfter: 120,
        saReheatFactor: 1.3,
        saMaxMutations: 3,
        saHueMoveProb: 0.2,
        saGroupMoveProb: 0.7,
        saDownMoveProb: 0.4,
        saGroupScaleMin: 0.5,
        saGroupScaleMax: 1.8,
        saStepHigh: 5,
        saStepMid: 2,
        saStepLow: 1,
        saHueStepHigh: 6,
        saHueStepMid: 3,
        saHueStepLow: 1,
        gamutDebug: CONFIG.gamutDebug,
        gamutDebugTopN: CONFIG.gamutDebugTopN,
        gamutDebugTopK: CONFIG.gamutDebugTopK
    };
}

function createVariableSpecs(spec) {
    const vars = [];

    // Selective pointwise bidirectional optimization:
    // Only peaks can go down, only valleys can go up.
    // Constant patterns (flat) get both permissions for all points.

    const isChromaConstant = spec.chroma.name === 'constant';
    for (let i = 0; i < spec.chroma.points.length; i++) {
        const isPeak = spec.chroma.peaks.includes(i);
        const isValley = spec.chroma.valleys.includes(i);
        if (isChromaConstant || isValley) {
            vars.push({ key: `c_up_${i}`, max: spec.chroma.upMax });
        }
        if (isChromaConstant || isPeak) {
            vars.push({ key: `c_down_${i}`, max: spec.chroma.downMax });
        }
    }

    const isLumiConstant = spec.lumi.name === 'constant';
    for (let i = 0; i < spec.lumi.points.length; i++) {
        const isPeak = spec.lumi.peaks.includes(i);
        const isValley = spec.lumi.valleys.includes(i);
        if (isLumiConstant || isValley) {
            vars.push({ key: `l_up_${i}`, max: spec.lumi.upMax });
        }
        if (isLumiConstant || isPeak) {
            vars.push({ key: `l_down_${i}`, max: spec.lumi.downMax });
        }
    }

    return vars;
}

function createZeroAdjustments(spec) {
    const cDown = new Array(spec.chroma.points.length).fill(0);
    const cUp = new Array(spec.chroma.points.length).fill(0);
    const lDown = new Array(spec.lumi.points.length).fill(0);
    const lUp = new Array(spec.lumi.points.length).fill(0);
    return { cDown, cUp, lDown, lUp };
}

function canonicalizeOpposingAdjustments(downArr, upArr) {
    const n = Math.min(downArr.length, upArr.length);
    for (let i = 0; i < n; i++) {
        const down = downArr[i] || 0;
        const up = upArr[i] || 0;
        if (down <= 0 || up <= 0) continue;

        if (down >= up) {
            downArr[i] = down - up;
            upArr[i] = 0;
        } else {
            upArr[i] = up - down;
            downArr[i] = 0;
        }
    }
}

function canonicalizeStateInPlace(state, spec) {
    if (!state) return state;
    if (
        spec?.chroma?.name === 'constant' &&
        Array.isArray(state.cDown) &&
        Array.isArray(state.cUp)
    ) {
        canonicalizeOpposingAdjustments(state.cDown, state.cUp);
    }
    if (
        spec?.lumi?.name === 'constant' &&
        Array.isArray(state.lDown) &&
        Array.isArray(state.lUp)
    ) {
        canonicalizeOpposingAdjustments(state.lDown, state.lUp);
    }
    return state;
}

function createInitialState(baseState, spec) {
    const adj = createZeroAdjustments(spec);

    return {
        ...baseState,
        cShift: 0,
        lShift: 0,
        ...adj
    };
}

function nearestPeakIndex(peaks, idx) {
    if (!Array.isArray(peaks) || peaks.length === 0) return null;
    let best = peaks[0];
    let bestDist = Math.abs(best - idx);
    for (let i = 1; i < peaks.length; i++) {
        const p = peaks[i];
        const dist = Math.abs(p - idx);
        if (dist < bestDist) {
            best = p;
            bestDist = dist;
        }
    }
    return best;
}

function nearestIndex(indices, idx) {
    if (!Array.isArray(indices) || indices.length === 0) return null;
    let best = indices[0];
    let bestDist = Math.abs(best - idx);
    for (let i = 1; i < indices.length; i++) {
        const p = indices[i];
        const dist = Math.abs(p - idx);
        if (dist < bestDist) {
            best = p;
            bestDist = dist;
        }
    }
    return best;
}

function incrementMap(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
}

function topMapEntries(map, topN = 3) {
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([idx, count]) => ({ idx, count }));
}

function formatTopEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return '-';
    return entries.map(item => `${item.idx}(${item.count})`).join(', ');
}

function summarizeFailTsForDebug(failTs, spec, topN = 6, topK = 3) {
    const sample = Array.isArray(failTs) ? failTs.slice(0, topN) : [];
    const cIdxHits = new Map();
    const lIdxHits = new Map();
    const cPeakHits = new Map();
    const lPeakHits = new Map();
    const cValleyHits = new Map();
    const lValleyHits = new Map();

    const cMaxIdx = Math.max(0, spec.chroma.points.length - 1);
    const lMaxIdx = Math.max(0, spec.lumi.points.length - 1);

    for (const t of sample) {
        const cIdx = Math.round(t * cMaxIdx);
        const lIdx = Math.round(t * lMaxIdx);
        incrementMap(cIdxHits, cIdx);
        incrementMap(lIdxHits, lIdx);

        const cPeak = nearestPeakIndex(spec.chroma.peaks, cIdx);
        const lPeak = nearestPeakIndex(spec.lumi.peaks, lIdx);
        const cValley = nearestIndex(spec.chroma.valleys, cIdx);
        const lValley = nearestIndex(spec.lumi.valleys, lIdx);
        if (cPeak !== null) incrementMap(cPeakHits, cPeak);
        if (lPeak !== null) incrementMap(lPeakHits, lPeak);
        if (cValley !== null) incrementMap(cValleyHits, cValley);
        if (lValley !== null) incrementMap(lValleyHits, lValley);
    }

    return {
        failCount: Array.isArray(failTs) ? failTs.length : 0,
        failTsSample: sample.map(v => Number(v.toFixed(4))),
        cIdxTop: topMapEntries(cIdxHits, topK),
        lIdxTop: topMapEntries(lIdxHits, topK),
        cNearestPeakTop: topMapEntries(cPeakHits, topK),
        lNearestPeakTop: topMapEntries(lPeakHits, topK),
        cNearestValleyTop: topMapEntries(cValleyHits, topK),
        lNearestValleyTop: topMapEntries(lValleyHits, topK)
    };
}

function pickSeedTraceAnchor(trace, fromStart = true) {
    if (!Array.isArray(trace) || trace.length === 0) return null;
    if (fromStart) {
        for (const entry of trace) {
            if (entry.summary) return entry;
        }
        return trace[0];
    }
    for (let i = trace.length - 1; i >= 0; i--) {
        if (trace[i].summary) return trace[i];
    }
    return trace[trace.length - 1];
}

function compactSeedDebug(seedDebug) {
    if (!seedDebug) return null;
    const first = pickSeedTraceAnchor(seedDebug.trace, true);
    const last = pickSeedTraceAnchor(seedDebug.trace, false);
    return {
        status: seedDebug.status,
        totalSteps: Array.isArray(seedDebug.trace) ? seedDebug.trace.length : 0,
        first: first || null,
        last: last || null
    };
}

function computePeakHitsFromFailures(failTs, spec) {
    const cHits = new Map();
    const lHits = new Map();

    if (!Array.isArray(failTs) || failTs.length === 0) {
        return { cHits, lHits };
    }

    const cMaxIdx = spec.chroma.points.length - 1;
    const lMaxIdx = spec.lumi.points.length - 1;

    for (const t of failTs) {
        const cIdx = Math.round(t * cMaxIdx);
        const lIdx = Math.round(t * lMaxIdx);

        const cPeak = spec.chroma.peaks.includes(cIdx) ? cIdx : nearestPeakIndex(spec.chroma.peaks, cIdx);
        const lPeak = spec.lumi.peaks.includes(lIdx) ? lIdx : nearestPeakIndex(spec.lumi.peaks, lIdx);

        if (cPeak !== null) incrementMap(cHits, cPeak);
        if (lPeak !== null) incrementMap(lHits, lPeak);
    }

    return { cHits, lHits };
}

function buildPeakCompressionPlans(state, spec, channelKey, hitMap, step, topK = Number.POSITIVE_INFINITY) {
    const k = Number.isFinite(topK) ? Math.max(1, topK) : Number.POSITIVE_INFINITY;
    const isChroma = channelKey === 'c';
    const downArrName = isChroma ? 'cDown' : 'lDown';
    const upArrName = isChroma ? 'cUp' : 'lUp';
    const points = isChroma ? spec.chroma.points : spec.lumi.points;
    const fallbackPeaks = isChroma ? spec.chroma.peaks : spec.lumi.peaks;
    const hardMax = isChroma ? spec.chroma.downMax : spec.lumi.downMax;
    const channelMin = isChroma ? CONFIG.chromaMin : CONFIG.lumiMin;

    const downArr = state[downArrName];
    const upArr = state[upArrName];

    const ranked = [...hitMap.entries()].sort((a, b) => b[1] - a[1]);
    const rankedTargets = ranked.map(([idx]) => idx);
    const fallbackTargets = Array.isArray(fallbackPeaks) ? [...fallbackPeaks] : [];
    const targetsRaw = rankedTargets.length > 0 ? rankedTargets : fallbackTargets;
    const targets = Number.isFinite(k) ? targetsRaw.slice(0, k) : targetsRaw;

    const plans = [];
    for (const idx of targets) {
        const current = downArr[idx];
        const oppositeValue = upArr[idx] || 0;
        const base = points[idx];
        const maxByBounds = Math.min(hardMax, base + oppositeValue - channelMin);
        const maxAllowed = Math.max(0, maxByBounds);
        const next = clamp(current + step, 0, maxAllowed);
        if (next === current) {
            continue;
        }
        plans.push({
            channel: channelKey,
            idx,
            from: current,
            to: next,
            delta: next - current,
            maxAllowed
        });
    }

    return {
        channel: channelKey,
        rankTop: topMapEntries(hitMap, 3),
        targets,
        plans
    };
}

function betterGamutCandidate(a, b) {
    if (!b) return true;
    if (a.displayable !== b.displayable) return a.displayable;
    if (a.invalidShape !== b.invalidShape) return !a.invalidShape;
    if (a.failCount !== b.failCount) return a.failCount < b.failCount;
    return a.deformation < b.deformation;
}

function applyBestSingleChannelPeakCompression(targetHue, state, spec, hits, step, topK = Number.POSITIVE_INFINITY, debugOut = null) {
    const channelPlanSets = [
        buildPeakCompressionPlans(state, spec, 'c', hits.cHits, step, topK),
        buildPeakCompressionPlans(state, spec, 'l', hits.lHits, step, topK)
    ];
    const candidatePlans = [
        ...channelPlanSets[0].plans,
        ...channelPlanSets[1].plans
    ];

    const candidates = [];
    for (const plan of candidatePlans) {
        const trial = cloneState(state);
        const arrName = plan.channel === 'c' ? 'cDown' : 'lDown';
        trial[arrName][plan.idx] = plan.to;
        const evalResult = evaluateState(targetHue, trial, spec, { requireQuality: false });
        candidates.push({
            channel: plan.channel,
            idx: plan.idx,
            plan,
            displayable: !!evalResult.displayable,
            invalidShape: !!evalResult.invalidShape,
            failCount: Array.isArray(evalResult.failTs) ? evalResult.failTs.length : 256,
            deformation: calcDeformation(trial)
        });
    }

    let best = null;
    for (const candidate of candidates) {
        if (betterGamutCandidate(candidate, best)) best = candidate;
    }

    if (debugOut) {
        debugOut.cRankTop = channelPlanSets[0].rankTop;
        debugOut.cTargets = channelPlanSets[0].targets;
        debugOut.cApplied = best && best.channel === 'c' ? [best.plan] : [];
        debugOut.lRankTop = channelPlanSets[1].rankTop;
        debugOut.lTargets = channelPlanSets[1].targets;
        debugOut.lApplied = best && best.channel === 'l' ? [best.plan] : [];
        debugOut.candidateScores = candidates.map(c => ({
            channel: c.channel,
            idx: c.idx,
            displayable: c.displayable,
            invalidShape: c.invalidShape,
            failCount: c.failCount,
            deformation: c.deformation
        }));
        debugOut.chosenChannel = best ? best.channel : null;
        debugOut.chosenPeakIdx = best ? best.idx : null;
    }

    if (!best) {
        return {
            changed: false,
            extraAttempts: candidates.length,
            chosenChannel: null
        };
    }

    const chosenArrName = best.channel === 'c' ? 'cDown' : 'lDown';
    state[chosenArrName][best.idx] = best.plan.to;
    return {
        changed: true,
        extraAttempts: candidates.length,
        chosenChannel: best.channel
    };
}

function calcDeformation(state) {
    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const peak = sum(state.cDown) + sum(state.lDown);
    const valley = sum(state.cUp) + sum(state.lUp);
    const asym = Math.abs(sum(state.cDown) - sum(state.lDown));
    return peak + (0.7 * valley) + (0.02 * asym);
}

function preserveShape(original, adjusted, channel) {
    const minGap = channel === 'C' ? CONFIG.minSegmentGapC : CONFIG.minSegmentGapL;
    const minRatio = channel === 'C' ? CONFIG.minSegmentRatioC : CONFIG.minSegmentRatioL;
    const minRangeRatio = channel === 'C' ? CONFIG.minRangeRatioC : CONFIG.minRangeRatioL;

    // Keep segment direction and avoid collapsing slopes to near-flat.
    for (let i = 0; i < original.length - 1; i++) {
        const origDiff = original[i + 1] - original[i];
        const adjDiff = adjusted[i + 1] - adjusted[i];
        const minAbsDiff = Math.max(minGap, Math.abs(origDiff) * minRatio);
        if (origDiff > 0 && adjDiff < minAbsDiff) return false;
        if (origDiff < 0 && adjDiff > -minAbsDiff) return false;
    }

    const originalRange = Math.max(...original) - Math.min(...original);
    if (originalRange > 0) {
        const adjustedRange = Math.max(...adjusted) - Math.min(...adjusted);
        const minAllowedRange = originalRange * minRangeRatio;
        if (adjustedRange < minAllowedRange) return false;
    }

    return true;
}

function buildAdjustedControls(points, downArr, upArr, shift = 0) {
    return points.map((v, i) => v + shift - (downArr[i] || 0) + (upArr[i] || 0));
}

function buildControlPoints(state, spec) {
    const cControls = buildAdjustedControls(spec.chroma.points, state.cDown, state.cUp, state.cShift || 0);
    const lControls = buildAdjustedControls(spec.lumi.points, state.lDown, state.lUp, state.lShift || 0);

    if (!preserveShape(spec.chroma.points, cControls, 'C')) return null;
    if (!preserveShape(spec.lumi.points, lControls, 'L')) return null;
    if (cControls.some(v => v < CONFIG.chromaMin || v > CONFIG.chromaMax)) return null;
    if (lControls.some(v => v < CONFIG.lumiMin || v > CONFIG.lumiMax)) return null;

    return { cControls, lControls };
}

function generateFullStrict(hStart, hueDelta, cControls, lControls) {
    const sampleN = 256;
    const colormap = [];
    const hValues = [];
    const cValues = [];
    const lValues = [];
    const failTs = [];
    const cIsConstant = cControls.length === 1;
    const lIsConstant = lControls.length === 1;

    for (let i = 0; i < sampleN; i++) {
        const t = i / (sampleN - 1);
        const h = wrapHue(hStart + hueDelta * t);

        const c = cIsConstant ? cControls[0] : interpolateMultiSegment(t, cControls);

        const l = lIsConstant ? lControls[0] : interpolateMultiSegment(t, lControls);

        const rgb = d3.hcl(h, c, l).rgb();
        if (!rgb.displayable()) {
            failTs.push(t);
            continue;
        }

        colormap.push(d3.rgb(rgb.r, rgb.g, rgb.b));
        hValues.push(h);
        cValues.push(c);
        lValues.push(l);
    }

    if (failTs.length > 0) {
        return { displayable: false, failTs };
    }

    return { displayable: true, colormap, hValues, cValues, lValues };
}

function qualityPassCount(quality) {
    return (quality.passSmall ? 1 : 0) + (quality.passLarge ? 1 : 0) + (quality.passDiscriminability ? 1 : 0);
}

function qualitySpread(quality) {
    return quality.smallWindowDiff + quality.largeWindowDiff + quality.minPairDiff;
}

function usesConstantPattern(spec) {
    return spec.chroma.name === 'constant' || spec.lumi.name === 'constant';
}

function isThermalConstantCombo(spec) {
    return (
        (spec.chroma.name === 'thermal' && spec.lumi.name === 'constant') ||
        (spec.chroma.name === 'constant' && spec.lumi.name === 'thermal')
    );
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

function buildRetrySearchParams(baseParams, spec, retryCount) {
    const params = { ...baseParams };
    const hardCombo = isThermalConstantCombo(spec);
    const retryTier = retryCount >= 18 ? 2 : (retryCount >= 8 ? 1 : 0);
    const level = Math.min(2, retryTier + (hardCombo ? 1 : 0));

    if (level === 0) return params;

    if (level === 1) {
        params.maxBaseCandidates = Math.round(params.maxBaseCandidates * 1.7);
        params.maxSeedRefinements = Math.round(params.maxSeedRefinements * 1.8);
        params.gamutMaxIters = Math.round(params.gamutMaxIters * 1.5);
        params.saMaxIters = Math.round(params.saMaxIters * 1.5);
        params.saReheatAfter = Math.round(params.saReheatAfter * 1.2);
        params.hueStartStep = Math.max(4, Math.floor(params.hueStartStep / 2));
        return params;
    }

    params.maxBaseCandidates = Math.round(params.maxBaseCandidates * 3.0);
    params.maxSeedRefinements = Math.round(params.maxSeedRefinements * 2.8);
    params.gamutMaxIters = Math.round(params.gamutMaxIters * 2.0);
    params.saMaxIters = Math.round(params.saMaxIters * 2.4);
    params.saReheatAfter = Math.round(params.saReheatAfter * 1.5);
    params.hueStartStep = Math.max(2, Math.floor(params.hueStartStep / 2));
    return params;
}

function cloneState(state) {
    return {
        ...state,
        cDown: [...state.cDown],
        cUp: [...state.cUp],
        lDown: [...state.lDown],
        lUp: [...state.lUp]
    };
}

function parseVariableSpecs(variableSpecs) {
    return variableSpecs.map(variable => {
        const [channel, type, idxStr] = variable.key.split('_');
        const idx = parseInt(idxStr, 10);
        return {
            ...variable,
            idx,
            arrName: `${channel}${type === 'down' ? 'Down' : 'Up'}`
        };
    });
}

function buildDirectionalGroups(vars) {
    const downGroup = vars.filter(variable => variable.arrName.endsWith('Down'));
    const upGroup = vars.filter(variable => variable.arrName.endsWith('Up'));
    const groups = [];
    if (downGroup.length > 0) groups.push(downGroup);
    if (upGroup.length > 0) groups.push(upGroup);
    return groups;
}

function applyDirectionalGroupMove(trial, group, params, temp) {
    const baseStep = stepFromTemperature(temp, params, 'saStepHigh', 'saStepMid', 'saStepLow');
    const minScale = params.saGroupScaleMin ?? 0.5;
    const maxScale = params.saGroupScaleMax ?? 1.8;
    const scaleRange = Math.max(0, maxScale - minScale);

    let mutated = false;
    for (const variable of group) {
        const scale = minScale + (Math.random() * scaleRange);
        const pointStep = Math.max(1, Math.round(baseStep * scale));
        const prev = trial[variable.arrName][variable.idx];
        const next = clamp(prev + pointStep, 0, variable.max);
        if (next !== prev) {
            trial[variable.arrName][variable.idx] = next;
            mutated = true;
        }
    }

    return mutated;
}

function stepFromTemperature(temp, params, highKey, midKey, lowKey) {
    const ratio = temp / Math.max(1e-9, params.saInitialTemp);
    if (ratio > 0.66) return params[highKey];
    if (ratio > 0.33) return params[midKey];
    return params[lowKey];
}

function annealObjective(evalResult) {
    if (!evalResult) return Number.POSITIVE_INFINITY;
    if (evalResult.invalidShape) return 1e9 + (evalResult.deformation || 0);

    if (!evalResult.displayable) {
        const failPenalty = Array.isArray(evalResult.failTs) ? evalResult.failTs.length : 256;
        return 1e7 + (failPenalty * 2500) + (evalResult.deformation || 0);
    }

    const qualityPenalty = evalResult.quality ? evalResult.quality.score : 1e6;
    return (qualityPenalty * 20000) + evalResult.deformation;
}

function evaluateState(targetHue, state, spec, options = {}) {
    const { requireQuality = true } = options;
    const controls = buildControlPoints(state, spec);
    if (!controls) {
        return {
            displayable: false,
            passAll: false,
            deformation: calcDeformation(state),
            invalidShape: true
        };
    }

    const rendered = generateFullStrict(
        state.hStart,
        -targetHue,
        controls.cControls,
        controls.lControls
    );

    if (!rendered.displayable) {
        return {
            displayable: false,
            passAll: false,
            deformation: calcDeformation(state),
            controls,
            invalidShape: false,
            failTs: rendered.failTs || []
        };
    }

    const deformation = calcDeformation(state);
    if (!requireQuality) {
        return { displayable: true, passAll: false, deformation, controls, rendered };
    }

    const quality = checkQuality(rendered.colormap, CONFIG);
    return {
        displayable: true,
        passAll: quality.passAll,
        quality,
        passCount: qualityPassCount(quality),
        spread: qualitySpread(quality),
        deformation,
        controls,
        rendered
    };
}

function betterForPass(a, b) {
    if (!b) return true;
    if (a.passCount !== b.passCount) return a.passCount > b.passCount;
    if (!a.passAll || !b.passAll) {
        if (Math.abs(a.spread - b.spread) > 1e-9) return a.spread > b.spread;
    }
    return a.deformation < b.deformation;
}

function resultPassCount(result) {
    const q = result?.metadata?.qualityMetrics;
    if (!q) return 0;
    return (q.passSmall ? 1 : 0) + (q.passLarge ? 1 : 0) + (q.passDiscriminability ? 1 : 0);
}

function resultTotalDeficit(result) {
    const total = result?.metadata?.qualityMetrics?.totalDeficit;
    return Number.isFinite(total) ? total : Number.POSITIVE_INFINITY;
}

function resultDeformation(result) {
    const d = result?.metadata?.deformation;
    return Number.isFinite(d) ? d : Number.POSITIVE_INFINITY;
}

function betterResultCandidate(a, b) {
    if (!b) return true;
    if (!!a.success !== !!b.success) return !!a.success;

    const aPassCount = resultPassCount(a);
    const bPassCount = resultPassCount(b);
    if (aPassCount !== bPassCount) return aPassCount > bPassCount;

    const aDeficit = resultTotalDeficit(a);
    const bDeficit = resultTotalDeficit(b);
    if (Math.abs(aDeficit - bDeficit) > 1e-9) return aDeficit < bDeficit;

    return resultDeformation(a) < resultDeformation(b);
}

function createBaseCandidates(spec, hueOffset, params) {
    const bases = [];
    const interval = CONFIG.hueBucketInterval;
    const bucketCount = Math.floor(360 / interval);
    for (let b = 0; b < bucketCount; b++) {
        const hStart = (b * interval) + (Math.random() * interval);
        bases.push({ hStart: wrapHue(hStart) });
    }
    shuffleInPlace(bases);
    return bases;
}

function findGamutSeedForBase(targetHue, baseState, spec, params) {
    let attempts = 0;
    const state = createInitialState(baseState, spec);
    const debugTrace = params.gamutDebug ? [] : null;

    const stepSchedule = [CONFIG.gamutCoarseStep, CONFIG.gamutFineStep];
    for (const step of stepSchedule) {
        for (let iter = 0; iter < params.gamutMaxIters; iter++) {
            const evalResult = evaluateState(targetHue, state, spec, { requireQuality: false });
            attempts++;
            if (evalResult.displayable) {
                return {
                    state,
                    attempts,
                    debug: params.gamutDebug
                        ? { status: 'success', trace: debugTrace }
                        : null
                };
            }
            if (evalResult.invalidShape) {
                if (params.gamutDebug) {
                    debugTrace.push({
                        step,
                        iter,
                        invalidShape: true
                    });
                }
                break;
            }

            const peakHits = computePeakHitsFromFailures(evalResult.failTs, spec);
            const stepDebug = {};
            const move = applyBestSingleChannelPeakCompression(
                targetHue,
                state,
                spec,
                peakHits,
                step,
                params.gamutTopKPeaks,
                params.gamutDebug ? stepDebug : null
            );
            attempts += move.extraAttempts;
            if (params.gamutDebug) {
                debugTrace.push({
                    step,
                    iter,
                    summary: summarizeFailTsForDebug(evalResult.failTs, spec, params.gamutDebugTopN, params.gamutDebugTopK),
                    peakHits: {
                        c: topMapEntries(peakHits.cHits, params.gamutDebugTopK),
                        l: topMapEntries(peakHits.lHits, params.gamutDebugTopK)
                    },
                    changed: move.changed,
                    chosenChannel: move.chosenChannel,
                    applied: stepDebug
                });
            }
            if (!move.changed) break;
        }
    }

    return {
        state: null,
        attempts,
        debug: params.gamutDebug
            ? { status: 'failed', trace: debugTrace }
            : null
    };
}

function evaluateGamutCandidates(targetHue, spec, params, verbose = false) {
    const hueOffset = Math.random() * 360;
    const baseCandidates = createBaseCandidates(spec, hueOffset, params);
    let attempts = 0;
    const validSeeds = [];
    const gamutDebug = params.gamutDebug ? [] : null;

    for (const base of baseCandidates) {
        const seed = findGamutSeedForBase(targetHue, base, spec, params);
        attempts += seed.attempts;
        const isSuccess = !!seed.state;
        let deformation = null;

        if (seed.state) {
            deformation = calcDeformation(seed.state);
            validSeeds.push({
                state: seed.state,
                deformation,
                hStart: base.hStart,
                seedAttempts: seed.attempts
            });
        }

        if (params.gamutDebug) {
            const compact = compactSeedDebug(seed.debug);
            const debugEntry = {
                hStart: base.hStart,
                success: isSuccess,
                attempts: seed.attempts,
                deformation,
                debug: compact
            };
            gamutDebug.push(debugEntry);

            if (verbose) {
                const anchor = compact?.last?.summary || compact?.first?.summary;
                const detail = anchor
                    ? `fail=${anchor.failCount}, cIdx=${formatTopEntries(anchor.cIdxTop)}, lIdx=${formatTopEntries(anchor.lIdxTop)}, cPeak=${formatTopEntries(anchor.cNearestPeakTop)}, lPeak=${formatTopEntries(anchor.lNearestPeakTop)}, cValleyNear=${formatTopEntries(anchor.cNearestValleyTop)}, lValleyNear=${formatTopEntries(anchor.lNearestValleyTop)}`
                    : 'no-fail-summary';
                if (isSuccess) {
                    console.log(`  [Gamut OK] hStart=${base.hStart.toFixed(1)}° attempts=${seed.attempts} deform=${deformation.toFixed(2)} | ${detail}`);
                } else {
                    console.log(`  [Gamut FAIL] hStart=${base.hStart.toFixed(1)}° attempts=${seed.attempts} | ${detail}`);
                }
            }
        }
    }

    validSeeds.sort((a, b) => a.deformation - b.deformation);
    return {
        attempts,
        validSeeds,
        gamutDebug,
        hueOffset,
        baseCount: baseCandidates.length
    };
}

function makeStepRange(min, max, step) {
    const values = [];
    const s = Math.max(1, Math.floor(step));
    let v = min;
    while (v <= max) {
        values.push(v);
        v += s;
    }
    if (values.length === 0 || values[values.length - 1] !== max) {
        values.push(max);
    }
    return values;
}

function buildConstantConstantState(hStart, cTarget, lTarget, spec) {
    const state = createInitialState({ hStart: wrapHue(hStart) }, spec);
    const cBase = spec.chroma.points[0];
    const lBase = spec.lumi.points[0];

    const cDelta = cTarget - cBase;
    if (cDelta >= 0) state.cUp[0] = cDelta;
    else state.cDown[0] = -cDelta;

    const lDelta = lTarget - lBase;
    if (lDelta >= 0) state.lUp[0] = lDelta;
    else state.lDown[0] = -lDelta;

    return state;
}

function searchConstantConstantFast(targetHue, spec, params, verbose = false) {
    let attempts = 0;
    const variableSpecs = createVariableSpecs(spec);

    const cBase = spec.chroma.points[0];
    const lBase = spec.lumi.points[0];
    const cMin = Math.max(CONFIG.chromaMin, cBase - spec.chroma.downMax);
    const cMax = Math.min(CONFIG.chromaMax, cBase + spec.chroma.upMax);
    const lMin = Math.max(CONFIG.lumiMin, lBase - spec.lumi.downMax);
    const lMax = Math.min(CONFIG.lumiMax, lBase + spec.lumi.upMax);

    const coarseC = makeStepRange(cMin, cMax, 6);
    const coarseL = makeStepRange(lMin, lMax, 4);
    const fineCStep = 2;
    const fineLStep = 2;

    let bestPass = null;
    let bestFail = null;

    const consider = (hStart, cTarget, lTarget) => {
        const state = buildConstantConstantState(hStart, cTarget, lTarget, spec);
        const evaluation = evaluateState(targetHue, state, spec, { requireQuality: true });
        attempts++;
        if (!evaluation.displayable) return;

        const candidate = { state, evaluation };
        if (evaluation.passAll) {
            if (!bestPass || evaluation.deformation < bestPass.evaluation.deformation - 1e-9) {
                bestPass = candidate;
            }
            return;
        }
        if (!bestFail || betterForPass(evaluation, bestFail.evaluation)) {
            bestFail = candidate;
        }
    };

    const interval = CONFIG.hueBucketInterval;
    const bucketCount = Math.floor(360 / interval);
    for (let b = 0; b < bucketCount; b++) {
        const hStart = (b * interval) + (Math.random() * interval);
        for (const cTarget of coarseC) {
            for (const lTarget of coarseL) {
                consider(hStart, cTarget, lTarget);
            }
        }
    }

    if (!bestPass && !bestFail) {
        return { best: null, attempts, gamutDebug: null };
    }

    const anchor = bestPass || bestFail;
    const anchorControls = buildControlPoints(anchor.state, spec);
    if (anchorControls) {
        const c0 = anchorControls.cControls[0];
        const l0 = anchorControls.lControls[0];
        const cFineMin = Math.max(cMin, c0 - 6);
        const cFineMax = Math.min(cMax, c0 + 6);
        const lFineMin = Math.max(lMin, l0 - 6);
        const lFineMax = Math.min(lMax, l0 + 6);
        const fineC = makeStepRange(cFineMin, cFineMax, fineCStep);
        const fineL = makeStepRange(lFineMin, lFineMax, fineLStep);

        for (let k = 0; k < 6; k++) {
            const hStart = wrapHue(anchor.state.hStart + ((Math.random() * 8) - 4));
            for (const cTarget of fineC) {
                for (const lTarget of fineL) {
                    consider(hStart, cTarget, lTarget);
                }
            }
        }
    }

    const selected = bestPass || bestFail;
    if (!selected) return { best: null, attempts, gamutDebug: null };

    const compact = selected.evaluation.passAll
        ? minimizeDeformation(targetHue, selected.state, spec, variableSpecs)
        : { state: selected.state, evaluation: selected.evaluation, attempts: 0 };
    attempts += compact.attempts;

    const candidate = buildResult(targetHue, compact.state, compact.evaluation, spec, attempts);
    if (verbose && candidate.success) {
        console.log(`  Fast constant/constant hit deform=${candidate.metadata.deformation.toFixed(2)} @ hStart=${candidate.metadata.hStart.toFixed(1)}°`);
    }

    return { best: candidate, attempts, gamutDebug: null };
}

function optimizeToPassQuality(targetHue, seedState, spec, variableSpecs) {
    let attempts = 0;
    let state = { ...seedState };

    for (const step of CONFIG.qualitySteps) {
        for (let iter = 0; iter < CONFIG.maxQualityItersPerStep; iter++) {
            const currentEval = evaluateState(targetHue, state, spec, { requireQuality: true });
            attempts++;
            if (currentEval.passAll) return { state, evaluation: currentEval, attempts };

            let bestCandidate = null;
            for (const variable of variableSpecs) {
                const [channel, type, idxStr] = variable.key.split('_');
                const idx = parseInt(idxStr, 10);
                const arrName = `${channel}${type === 'down' ? 'Down' : 'Up'}`;
                const currentValue = state[arrName][idx];
                if (currentValue + step > variable.max) continue;

                const trial = {
                    ...state,
                    [arrName]: [...state[arrName]]
                };
                trial[arrName][idx] = clamp(currentValue + step, 0, variable.max);

                const trialEval = evaluateState(targetHue, trial, spec, { requireQuality: true });
                attempts++;
                if (!trialEval.displayable) continue;
                if (!betterForPass(trialEval, currentEval)) continue;
                if (!betterForPass(trialEval, bestCandidate ? bestCandidate.evaluation : null)) continue;

                bestCandidate = { state: trial, evaluation: trialEval };
            }

            if (!bestCandidate) break;
            state = bestCandidate.state;
        }
    }

    const finalEval = evaluateState(targetHue, state, spec, { requireQuality: true });
    attempts++;
    return { state, evaluation: finalEval, attempts };
}

function optimizeToPassQualityAnnealed(targetHue, seedState, spec, variableSpecs, params) {
    if (variableSpecs.length === 0) {
        return optimizeToPassQuality(targetHue, seedState, spec, variableSpecs);
    }

    const vars = parseVariableSpecs(variableSpecs);
    const groups = buildDirectionalGroups(vars);
    let attempts = 0;

    let currentState = cloneState(seedState);
    let currentEval = evaluateState(targetHue, currentState, spec, { requireQuality: true });
    attempts++;
    let currentObjective = annealObjective(currentEval);

    let bestState = cloneState(currentState);
    let bestEval = currentEval;
    let bestObjective = currentObjective;

    let bestPassState = currentEval.passAll ? cloneState(currentState) : null;
    let bestPassEval = currentEval.passAll ? currentEval : null;

    let temp = params.saInitialTemp;
    let stallIters = 0;

    for (let iter = 0; iter < params.saMaxIters; iter++) {
        const trial = cloneState(currentState);
        let mutated = false;

        const useGroupMove = groups.length > 0 && Math.random() < (params.saGroupMoveProb ?? 0.7);
        if (useGroupMove) {
            // Two linked directions only:
            // - Down group: push peaks downward via cDown/lDown increases
            // - Up group: raise valleys via cUp/lUp increases
            const group = groups[Math.floor(Math.random() * groups.length)];
            mutated = applyDirectionalGroupMove(trial, group, params, temp);
        } else {
            // Pointwise micro adjustment with fixed direction:
            // increase adjustment magnitude only (no global shift, no reverse move here).
            const variable = vars[Math.floor(Math.random() * vars.length)];
            const step = stepFromTemperature(temp, params, 'saStepHigh', 'saStepMid', 'saStepLow');
            const prev = trial[variable.arrName][variable.idx];
            const next = clamp(prev + step, 0, variable.max);
            if (next !== prev) {
                trial[variable.arrName][variable.idx] = next;
                mutated = true;
            }
        }

        if (Math.random() < params.saHueMoveProb) {
            const hueStep = stepFromTemperature(temp, params, 'saHueStepHigh', 'saHueStepMid', 'saHueStepLow');
            const direction = Math.random() < 0.5 ? -1 : 1;
            const prevHue = trial.hStart;
            trial.hStart = wrapHue(prevHue + (direction * hueStep));
            mutated = mutated || Math.abs(trial.hStart - prevHue) > 1e-9;
        }

        if (!mutated) {
            temp = Math.max(params.saMinTemp, temp * params.saCooling);
            continue;
        }

        // Auto-Gamut Compression: If a mutation pushes the colormap
        // out of gamut, instead of discarding the attempt, try to force it back into gamut
        // by applying the downward peak constraints.
        let gamutValid = false;
        for (let iter = 0; iter < params.gamutMaxIters; iter++) {
            const basicEval = evaluateState(targetHue, trial, spec, { requireQuality: false });
            attempts++;
            if (basicEval.displayable) {
                gamutValid = true;
                break;
            }
            if (basicEval.invalidShape) break;

            const peakHits = computePeakHitsFromFailures(basicEval.failTs, spec);
            const move = applyBestSingleChannelPeakCompression(
                targetHue,
                trial,
                spec,
                peakHits,
                CONFIG.gamutFineStep,
                params.gamutTopKPeaks
            );
            attempts += move.extraAttempts;
            if (!move.changed) break;
        }

        if (!gamutValid) {
            temp = Math.max(params.saMinTemp, temp * params.saCooling);
            continue;
        }

        const trialEval = evaluateState(targetHue, trial, spec, { requireQuality: true });
        attempts++;
        const trialObjective = annealObjective(trialEval);

        const delta = trialObjective - currentObjective;
        const accept = delta <= 0 || Math.random() < Math.exp(-delta / Math.max(temp, 1e-9));

        if (accept) {
            currentState = trial;
            currentEval = trialEval;
            currentObjective = trialObjective;
            stallIters = 0;

            if (trialObjective < bestObjective) {
                bestObjective = trialObjective;
                bestState = cloneState(trial);
                bestEval = trialEval;
            }

            if (trialEval.passAll && (!bestPassEval || trialEval.deformation < bestPassEval.deformation - 1e-9)) {
                bestPassState = cloneState(trial);
                bestPassEval = trialEval;

                if (CONFIG.optimizationMode === 'FAST' && trialEval.deformation <= params.earlyExitDeformation) {
                    return { state: bestPassState, evaluation: bestPassEval, attempts };
                }
            }
        } else {
            stallIters++;
        }

        temp = Math.max(params.saMinTemp, temp * params.saCooling);
        if (stallIters >= params.saReheatAfter) {
            temp = Math.min(params.saInitialTemp, temp * params.saReheatFactor);
            stallIters = 0;
        }
    }

    if (bestPassEval) {
        return { state: bestPassState, evaluation: bestPassEval, attempts };
    }

    const fallback = optimizeToPassQuality(targetHue, bestState, spec, variableSpecs);
    attempts += fallback.attempts;
    if (fallback.evaluation.passAll || betterForPass(fallback.evaluation, bestEval)) {
        return { state: fallback.state, evaluation: fallback.evaluation, attempts };
    }

    return { state: bestState, evaluation: bestEval, attempts };
}

function minimizeDeformation(targetHue, passState, spec, variableSpecs) {
    let attempts = 0;
    let state = { ...passState };
    let currentEval = evaluateState(targetHue, state, spec, { requireQuality: true });
    attempts++;
    if (!currentEval.passAll) return { state, evaluation: currentEval, attempts };

    for (const step of CONFIG.qualitySteps) {
        let improved = true;
        while (improved) {
            improved = false;
            for (const variable of variableSpecs) {
                const [channel, type, idxStr] = variable.key.split('_');
                const idx = parseInt(idxStr, 10);
                const arrName = `${channel}${type === 'down' ? 'Down' : 'Up'}`;
                const currentValue = state[arrName][idx];
                if (currentValue < step) continue;

                const trial = {
                    ...state,
                    [arrName]: [...state[arrName]]
                };
                trial[arrName][idx] = currentValue - step;

                const trialEval = evaluateState(targetHue, trial, spec, { requireQuality: true });
                attempts++;
                if (!trialEval.displayable || !trialEval.passAll) continue;
                if (trialEval.deformation > currentEval.deformation + 1e-9) continue;

                state = trial;
                currentEval = trialEval;
                improved = true;
            }
        }
    }

    return { state, evaluation: currentEval, attempts };
}

function buildResult(targetHue, finalState, finalEval, spec, attempts) {
    const exportState = cloneState(finalState);
    canonicalizeStateInPlace(exportState, spec);

    return {
        success: finalEval.passAll,
        colormap: {
            colormap: finalEval.rendered.colormap,
            hValues: finalEval.rendered.hValues,
            cValues: finalEval.rendered.cValues,
            lValues: finalEval.rendered.lValues
        },
        metadata: {
            hueTarget: targetHue,
            chromaPattern: spec.chroma.name,
            lumiPattern: spec.lumi.name,
            originalChroma: spec.chroma.points,
            originalLumi: spec.lumi.points,
            adjustedChroma: finalEval.controls.cControls,
            adjustedLumi: finalEval.controls.lControls,
            adjustments: {
                cDown: exportState.cDown,
                cUp: exportState.cUp,
                lDown: exportState.lDown,
                lUp: exportState.lUp
            },
            cBaseSeed: null,
            lBaseSeed: null,
            cShift: exportState.cShift || 0,
            lShift: exportState.lShift || 0,
            hStart: exportState.hStart,
            deformation: calcDeformation(exportState),
            qualityMetrics: {
                passAll: finalEval.passAll,
                passSmall: finalEval.quality.passSmall,
                passLarge: finalEval.quality.passLarge,
                passDiscriminability: finalEval.quality.passDiscriminability,
                smallWindowDiff: finalEval.quality.smallWindowDiff,
                largeWindowDiff: finalEval.quality.largeWindowDiff,
                minPairDiff: finalEval.quality.minPairDiff,
                smallDeficit: finalEval.quality.smallDeficit,
                largeDeficit: finalEval.quality.largeDeficit,
                discDeficit: finalEval.quality.discDeficit,
                totalDeficit: finalEval.quality.totalDeficit
            },
            searchStats: {
                attempts
            }
        }
    };
}

function searchPatternAware(targetHue, spec, retryCount, verbose = false) {
    if (spec.chroma.name === 'constant' && spec.lumi.name === 'constant') {
        const baseParams = getSearchParams();
        const params = buildRetrySearchParams(baseParams, spec, retryCount);
        return searchConstantConstantFast(targetHue, spec, params, verbose);
    }

    const baseParams = getSearchParams();
    const params = buildRetrySearchParams(baseParams, spec, retryCount);
    const variableSpecs = createVariableSpecs(spec);
    const useAnnealing = CONFIG.useAnnealingForAllCombos
        ? true
        : !(spec.chroma.name === 'constant' && spec.lumi.name === 'constant');
    const gamutStage = evaluateGamutCandidates(targetHue, spec, params, verbose);
    let attempts = gamutStage.attempts;
    const validSeeds = gamutStage.validSeeds;

    if (validSeeds.length === 0) {
        return { best: null, attempts, gamutDebug: gamutStage.gamutDebug };
    }

    const seedData = validSeeds[0];

    if (!seedData) {
        return { best: null, attempts, gamutDebug: gamutStage.gamutDebug };
    }

    if (verbose) {
        console.log(`  Trying seed with initial deformation=${seedData.deformation.toFixed(2)}`);
    }

    // 2. Quality optimization: run once on the minimum-deformation seed.
    const runPassSearch = (startState, vars) => (
        useAnnealing
            ? optimizeToPassQualityAnnealed(targetHue, startState, spec, vars, params)
            : optimizeToPassQuality(targetHue, startState, spec, vars)
    );

    const passStage = runPassSearch(seedData.state, variableSpecs);
    attempts += passStage.attempts;

    const compactStage = minimizeDeformation(targetHue, passStage.state, spec, variableSpecs);
    attempts += compactStage.attempts;

    const candidate = buildResult(targetHue, compactStage.state, compactStage.evaluation, spec, attempts);
    if (params.gamutDebug) {
        candidate.metadata.searchStats.gamutDiagnostics = {
            baseCount: gamutStage.baseCount,
            validSeedCount: validSeeds.length,
            selectedSeed: {
                hStart: seedData.hStart,
                deformation: seedData.deformation,
                seedAttempts: seedData.seedAttempts
            },
            entries: gamutStage.gamutDebug
        };
    }
    if (candidate.success && verbose) {
        console.log(`  Improved deformation=${candidate.metadata.deformation.toFixed(2)} @ hStart=${candidate.metadata.hStart.toFixed(1)}°`);
    }

    return { best: candidate, attempts, gamutDebug: gamutStage.gamutDebug };
}

function generateOneColormap(hue, chromaName, chromaPattern, lumiName, lumiPattern, verbose = false) {
    const spec = createComboSpec(chromaName, chromaPattern, lumiName, lumiPattern);
    let retryCount = 0;
    const maxRounds = CONFIG.qualityRetryUntilPass ? CONFIG.maxSearchRounds : CONFIG.maxGamutRetries;

    let finalBest = null;
    let fallbackBest = null;
    let finalAttempts = 0;
    let lastGamutDebug = null;

    while (retryCount < maxRounds) {
        const { best, attempts, gamutDebug } = searchPatternAware(hue, spec, retryCount, verbose);
        finalAttempts += attempts;
        if (gamutDebug) lastGamutDebug = gamutDebug;
        if (best) {
            if (best.success) {
                finalBest = best;
                break;
            }
            if (betterResultCandidate(best, fallbackBest)) {
                fallbackBest = best;
            }
        }
        retryCount++;
    }

    if (finalBest) {
        finalBest.metadata.retryCount = retryCount;
        finalBest.metadata.searchStats.attempts = finalAttempts;
        if (CONFIG.gamutDebug && lastGamutDebug && !finalBest.metadata.searchStats.gamutDiagnostics) {
            finalBest.metadata.searchStats.gamutDiagnostics = {
                baseCount: lastGamutDebug.length,
                validSeedCount: 0,
                selectedSeed: null,
                entries: lastGamutDebug
            };
        }
        return finalBest;
    }

    if (fallbackBest) {
        fallbackBest.metadata.retryCount = retryCount;
        fallbackBest.metadata.searchStats.attempts = finalAttempts;
        if (CONFIG.gamutDebug && lastGamutDebug && !fallbackBest.metadata.searchStats.gamutDiagnostics) {
            fallbackBest.metadata.searchStats.gamutDiagnostics = {
                baseCount: lastGamutDebug.length,
                validSeedCount: 0,
                selectedSeed: null,
                entries: lastGamutDebug
            };
        }
        return fallbackBest;
    }

    return {
        success: false,
        metadata: {
            hueTarget: hue,
            chromaPattern: chromaName,
            lumiPattern: lumiName,
            retryCount,
            searchStats: {
                attempts: finalAttempts,
                gamutDiagnostics: CONFIG.gamutDebug ? {
                    baseCount: Array.isArray(lastGamutDebug) ? lastGamutDebug.length : 0,
                    validSeedCount: 0,
                    selectedSeed: null,
                    entries: lastGamutDebug
                } : null
            }
        }
    };
}

function batchGenerateSplitThermal(options = {}) {
    const {
        perCombination = CONFIG.perCombination,
        outputDir = 'output_thermal',
        verbose = true
    } = options;

    if (typeof options.gamutDebug === 'boolean') {
        CONFIG.gamutDebug = options.gamutDebug;
    }
    if (Number.isFinite(options.gamutDebugTopN)) {
        CONFIG.gamutDebugTopN = Math.max(1, Math.floor(options.gamutDebugTopN));
    }
    if (Number.isFinite(options.gamutDebugTopK)) {
        CONFIG.gamutDebugTopK = Math.max(1, Math.floor(options.gamutDebugTopK));
    }
    if (Number.isFinite(options.maxRounds)) {
        CONFIG.maxSearchRounds = Math.max(1, Math.floor(options.maxRounds));
    }
    if (Number.isFinite(options.maxGamutRetries)) {
        CONFIG.maxGamutRetries = Math.max(1, Math.floor(options.maxGamutRetries));
    }
    if (typeof options.comboMode === 'string') {
        CONFIG.comboMode = options.comboMode === 'focus' ? 'focus' : 'all';
    }
    if (typeof options.annealAll === 'boolean') {
        CONFIG.useAnnealingForAllCombos = options.annealAll;
    }

    const combos = getTargetCombinations();
    const totalTargets = combos.length * CONFIG.hueTargets.length * perCombination;

    console.log('═══════════════════════════════════════════════');
    console.log('  Pattern-Aware 5-Point Generator');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Hue targets: ${CONFIG.hueTargets.join(', ')}°`);
    console.log(`  Pattern combos (C/L): ${combos.length}`);
    console.log(`  Per combo-hue count: ${perCombination}`);
    console.log(`  Total target: ${totalTargets}`);
    console.log(`  Mode: ${CONFIG.optimizationMode}`);
    if (CONFIG.gamutDebug) {
        console.log(`  Gamut debug: ON (sample=${CONFIG.gamutDebugTopN}, topK=${CONFIG.gamutDebugTopK})`);
    }
    console.log('═══════════════════════════════════════════════\n');

    const results = [];
    const roundFiles = [];
    let successCount = 0;
    let generatedCount = 0;

    for (let n = 0; n < perCombination; n++) {
        const roundResults = [];
        for (const hue of CONFIG.hueTargets) {
            for (const combo of combos) {
                generatedCount++;
                const label = `H=${hue} C=${combo.chromaName} L=${combo.lumiName}` + (perCombination > 1 ? ` #${n + 1}` : '');
                process.stdout.write(`[${generatedCount}/${totalTargets}] Generating: ${label}...\n`);

                const result = generateOneColormap(
                    hue,
                    combo.chromaName,
                    combo.chromaPattern,
                    combo.lumiName,
                    combo.lumiPattern,
                    verbose
                );

                if (result.success) {
                    successCount++;
                    const d = result.metadata;
                    console.log(`✓ Hit! ${d.chromaPattern}/${d.lumiPattern} | hStart=${d.hStart.toFixed(1)}° | deform=${d.deformation.toFixed(2)}\n`);
                } else {
                    console.log(`✗ FAILED after ${result.metadata.retryCount} retries (${combo.chromaName}/${combo.lumiName})\n`);
                }

                // Push to results array regardless of success
                const exportData = {
                    id: results.length,
                    success: result.success,
                    metadata: result.metadata
                };

                if (result.colormap) {
                    exportData.colormap = result.colormap.colormap.map(c => [c.r, c.g, c.b]);
                    exportData.hValues = result.colormap.hValues;
                    exportData.cValues = result.colormap.cValues;
                    exportData.lValues = result.colormap.lValues;
                }
                roundResults.push(exportData);
                results.push(exportData);
            }
        }

        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        const roundFile = `thermal_colormaps_round_${String(n + 1).padStart(3, '0')}.json`;
        const roundPath = path.join(outputDir, roundFile);
        fs.writeFileSync(roundPath, JSON.stringify(roundResults, null, 2));
        roundFiles.push(roundPath);
        console.log(`  Saved round ${n + 1}/${perCombination}: ${roundPath}\n`);
    }

    console.log('═══════════════════════════════════════════════');
    console.log(`  Done! Success: ${successCount}/${totalTargets}`);
    console.log(`  Round files: ${roundFiles.length}`);
    console.log('═══════════════════════════════════════════════\n');

    return results;
}

function batchDiagnoseGamut(options = {}) {
    const {
        perCombination = 1,
        outputDir = 'output_thermal',
        verbose = true
    } = options;

    CONFIG.gamutDebug = true;
    if (Number.isFinite(options.gamutDebugTopN)) {
        CONFIG.gamutDebugTopN = Math.max(1, Math.floor(options.gamutDebugTopN));
    }
    if (Number.isFinite(options.gamutDebugTopK)) {
        CONFIG.gamutDebugTopK = Math.max(1, Math.floor(options.gamutDebugTopK));
    }
    if (Number.isFinite(options.maxGamutRetries)) {
        CONFIG.maxGamutRetries = Math.max(1, Math.floor(options.maxGamutRetries));
    }
    if (typeof options.comboMode === 'string') {
        CONFIG.comboMode = options.comboMode === 'focus' ? 'focus' : 'all';
    }

    const combos = getTargetCombinations();
    const totalTargets = combos.length * CONFIG.hueTargets.length * perCombination;

    console.log('═══════════════════════════════════════════════');
    console.log('  Gamut-Only Diagnostics');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Hue targets: ${CONFIG.hueTargets.join(', ')}°`);
    console.log(`  Pattern combos (C/L): ${combos.length}`);
    console.log(`  Per combo-hue count: ${perCombination}`);
    console.log(`  Total target: ${totalTargets}`);
    console.log(`  Gamut debug: ON (sample=${CONFIG.gamutDebugTopN}, topK=${CONFIG.gamutDebugTopK})`);
    console.log('═══════════════════════════════════════════════\n');

    const results = [];
    let successCount = 0;
    let generatedCount = 0;

    for (let n = 0; n < perCombination; n++) {
        for (const hue of CONFIG.hueTargets) {
            for (const combo of combos) {
                generatedCount++;
                const label = `H=${hue} C=${combo.chromaName} L=${combo.lumiName}` + (perCombination > 1 ? ` #${n + 1}` : '');
                process.stdout.write(`[${generatedCount}/${totalTargets}] Gamut diagnose: ${label}...\n`);

                const spec = createComboSpec(combo.chromaName, combo.chromaPattern, combo.lumiName, combo.lumiPattern);
                let retryCount = 0;
                let totalAttempts = 0;
                let finalStage = null;
                let bestSeed = null;

                while (retryCount < CONFIG.maxGamutRetries) {
                    const baseParams = getSearchParams();
                    const params = buildRetrySearchParams(baseParams, spec, retryCount);
                    params.gamutDebug = true;

                    const stage = evaluateGamutCandidates(hue, spec, params, verbose);
                    totalAttempts += stage.attempts;
                    finalStage = stage;

                    if (stage.validSeeds.length > 0) {
                        bestSeed = stage.validSeeds[0];
                        break;
                    }

                    retryCount++;
                }

                const success = !!bestSeed;
                if (success) successCount++;

                const metadata = {
                    hueTarget: hue,
                    chromaPattern: combo.chromaName,
                    lumiPattern: combo.lumiName,
                    retryCount,
                    bestSeed: bestSeed ? {
                        hStart: bestSeed.hStart,
                        deformation: bestSeed.deformation,
                        seedAttempts: bestSeed.seedAttempts
                    } : null,
                    searchStats: {
                        attempts: totalAttempts,
                        baseCount: finalStage ? finalStage.baseCount : 0,
                        validSeedCount: finalStage ? finalStage.validSeeds.length : 0
                    }
                };

                results.push({
                    id: results.length,
                    success,
                    metadata,
                    gamutDiagnostics: finalStage ? finalStage.gamutDebug : null
                });

                if (success) {
                    console.log(`✓ Gamut OK | hStart=${bestSeed.hStart.toFixed(1)}° | deform=${bestSeed.deformation.toFixed(2)} | validSeeds=${finalStage.validSeeds.length}\n`);
                } else {
                    console.log(`✗ Gamut FAIL after ${retryCount} retries (${combo.chromaName}/${combo.lumiName})\n`);
                }
            }
        }
    }

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'gamut_diagnostics.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log('═══════════════════════════════════════════════');
    console.log(`  Gamut Done! Success: ${successCount}/${totalTargets}`);
    console.log(`  Wrote to: ${outputPath}`);
    console.log('═══════════════════════════════════════════════\n');

    return results;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--count':
            case '-n':
                options.perCombination = parseInt(args[++i], 10);
                break;
            case '--output':
            case '-o':
                options.outputDir = args[++i];
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--quiet':
            case '-q':
                options.verbose = false;
                break;
            case '--gamut-only':
                options.gamutOnly = true;
                break;
            case '--gamut-debug':
                options.gamutDebug = true;
                break;
            case '--gamut-debug-topn':
                options.gamutDebugTopN = parseInt(args[++i], 10);
                break;
            case '--gamut-debug-topk':
                options.gamutDebugTopK = parseInt(args[++i], 10);
                break;
            case '--max-rounds':
                options.maxRounds = parseInt(args[++i], 10);
                break;
            case '--max-gamut-retries':
                options.maxGamutRetries = parseInt(args[++i], 10);
                break;
            case '--combo-mode':
                options.comboMode = args[++i];
                break;
            case '--anneal-all':
                options.annealAll = true;
                break;
            case '--no-anneal-all':
                options.annealAll = false;
                break;
        }
    }
    if (options.gamutOnly) {
        options.gamutDebug = true;
        batchDiagnoseGamut(options);
    } else {
        batchGenerateSplitThermal(options);
    }
}

module.exports = { batchGenerateSplitThermal, batchDiagnoseGamut };
