// Quality checker for colormaps

const { ciede2000, convertColormapToHCLPalette } = require('./utils');

/**
 * Calculate minimum color difference for uniformly sampled points at interval k
 */
function calcUniformIntervalMinDiff(palette, intervalK, sampleCount) {
    let min_interval_diff = Number.MAX_VALUE;
    try {
        // Uniformly sample points from the palette
        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
            const t = i / (sampleCount - 1);
            const idx = Math.min(Math.floor(t * palette.length), palette.length - 1);
            samples.push(palette[idx]);
        }

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

/**
 * Check if colormap passes quality thresholds
 */
function checkQuality(colormap, config) {
    const {
        sampleCount = 30,
        smallIntervalK = 2,
        smallMinDiff = 3,
        largeIntervalK = 5,
        largeMinDiff = 10
    } = config;

    const hclPalette = convertColormapToHCLPalette(colormap);

    const smallWindowDiff = calcUniformIntervalMinDiff(hclPalette, smallIntervalK, sampleCount);
    const largeWindowDiff = calcUniformIntervalMinDiff(hclPalette, largeIntervalK, sampleCount);

    const passSmall = smallWindowDiff >= smallMinDiff;
    const passLarge = largeWindowDiff >= largeMinDiff;

    return {
        passSmall,
        passLarge,
        passAll: passSmall && passLarge,
        smallWindowDiff,
        largeWindowDiff
    };
}

module.exports = {
    calcUniformIntervalMinDiff,
    checkQuality
};
