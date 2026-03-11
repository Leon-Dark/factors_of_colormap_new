// Quality checker for colormaps

const { ciede2000, convertColormapToLabPalette, sampleLabPalette, minPairDeltaE } = require('./utils');

/**
 * Calculate minimum color difference for uniformly sampled points at interval k
 */
function calcUniformIntervalMinDiff(palette, intervalK, sampleCount) {
    let min_interval_diff = Number.MAX_VALUE;
    try {
        const samples = sampleLabPalette(palette, sampleCount);

        if (samples.length <= intervalK) {
            return 0;
        }

        // Calculate min diff between samples i and any j where distance >= k
        for (let i = 0; i < samples.length; i++) {
            for (let j = i + intervalK; j < samples.length; j++) {
                const diff = ciede2000(samples[i], samples[j]);
                if (diff < min_interval_diff) {
                    min_interval_diff = diff;
                }
            }
        }

        return min_interval_diff === Number.MAX_VALUE ? 0 : min_interval_diff;
    } catch (error) {
        console.error('Error in calcUniformIntervalMinDiff:', error);
        return 0;
    }
}

function getQualityConfig(config = {}) {
    return {
        sampleCount: config.sampleCount ?? config.uniformSampleCount ?? 20,
        smallIntervalK: config.smallIntervalK ?? config.smallWindowK ?? 2,
        smallMinDiff: config.smallMinDiff ?? config.smallWindowThreshold ?? 3,
        largeIntervalK: config.largeIntervalK ?? config.largeWindowK ?? 5,
        largeMinDiff: config.largeMinDiff ?? config.largeWindowThreshold ?? 10,
        discriminabilitySampleCount: config.discriminabilitySampleCount ?? 20,
        discriminabilityMinDiff: config.discriminabilityMinDiff ?? 3,
        weightSmallWindow: config.weightSmallWindow ?? 1,
        weightLargeWindow: config.weightLargeWindow ?? 1,
        weightDiscriminability: config.weightDiscriminability ?? 1,
        totalDeficitPassThreshold: config.totalDeficitPassThreshold
    };
}

/**
 * Evaluate quality with continuous penalties (lower is better).
 */
function evaluateQuality(colormap, config = {}) {
    const q = getQualityConfig(config);
    const labPalette = convertColormapToLabPalette(colormap);

    const smallWindowDiff = calcUniformIntervalMinDiff(labPalette, q.smallIntervalK, q.sampleCount);
    const largeWindowDiff = calcUniformIntervalMinDiff(labPalette, q.largeIntervalK, q.sampleCount);
    const sampledForDisc = sampleLabPalette(labPalette, q.discriminabilitySampleCount);
    const minPairDiff = minPairDeltaE(sampledForDisc);

    const smallDeficit = Math.max(0, q.smallMinDiff - smallWindowDiff);
    const largeDeficit = Math.max(0, q.largeMinDiff - largeWindowDiff);
    const discDeficit = Math.max(0, q.discriminabilityMinDiff - minPairDiff);

    const passSmall = smallDeficit === 0;
    const passLarge = largeDeficit === 0;
    const passDiscriminability = discDeficit === 0;
    const totalDeficit = smallDeficit + largeDeficit + discDeficit;

    const score =
        q.weightSmallWindow * (smallDeficit ** 2) +
        q.weightLargeWindow * (largeDeficit ** 2) +
        q.weightDiscriminability * (discDeficit ** 2);

    const passAll = Number.isFinite(q.totalDeficitPassThreshold)
        ? (totalDeficit < q.totalDeficitPassThreshold)
        : (passSmall && passLarge && passDiscriminability);

    return {
        passSmall,
        passLarge,
        passDiscriminability,
        passAll,
        smallWindowDiff,
        largeWindowDiff,
        minPairDiff,
        smallDeficit,
        largeDeficit,
        discDeficit,
        totalDeficit,
        score
    };
}

/**
 * Check if colormap passes quality thresholds
 */
function checkQuality(colormap, config) {
    return evaluateQuality(colormap, config);
}

module.exports = {
    calcUniformIntervalMinDiff,
    evaluateQuality,
    checkQuality
};
