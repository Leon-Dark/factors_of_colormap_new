// Sampling Mode Functions - JND and Uniform Sampling

// Helper: Generate JND samples (shared by both conditions)
function generateJndSamples(palette, jndStep) {
    try {
        // Generate fine samples
        const fineSampleCount = 500;
        const fineSamples = [];
        for (let i = 0; i < fineSampleCount; i++) {
            const t = i / (fineSampleCount - 1);
            const idx = Math.min(Math.floor(t * palette.length), palette.length - 1);
            fineSamples.push(palette[idx]);
        }

        // Sample points using JND step
        const jndSamples = [fineSamples[0]];
        let currentIdx = 0;
        
        while (currentIdx < fineSamples.length - 1) {
            let foundNext = false;
            for (let i = currentIdx + 1; i < fineSamples.length; i++) {
                const diff = ciede2000(fineSamples[currentIdx], fineSamples[i]);
                if (diff >= jndStep) {
                    jndSamples.push(fineSamples[i]);
                    currentIdx = i;
                    foundNext = true;
                    break;
                }
            }
            if (!foundNext) break;
        }
        
        return jndSamples;
    } catch (error) {
        console.error('Error in generateJndSamples:', error);
        return [];
    }
}

// JND Mode: Check consistency - min diff between JND samples should >= JND step
// Can accept either palette+jndStep or pre-generated jndSamples
function calcJndConsistency(paletteOrSamples, jndStep) {
    let min_color_diff = Number.MAX_VALUE;
    try {
        // If it's an array of samples (already JND sampled), use directly
        // Otherwise generate JND samples from palette
        const jndSamples = Array.isArray(paletteOrSamples[0]) && paletteOrSamples[0].length === 3
            ? paletteOrSamples
            : generateJndSamples(paletteOrSamples, jndStep);
        
        if (jndSamples.length < 2) {
            return 0;
        }

        // Calculate min diff between all JND samples
        for (let i = 0; i < jndSamples.length - 1; i++) {
            for (let j = i + 1; j < jndSamples.length; j++) {
                const diff = ciede2000(jndSamples[i], jndSamples[j]);
                if (diff < min_color_diff) {
                    min_color_diff = diff;
                }
            }
        }
        
        return min_color_diff === Number.MAX_VALUE ? 0 : min_color_diff;
    } catch (error) {
        console.error('Error in calcJndConsistency:', error);
        return 0;
    }
}

// JND Mode: Calculate min color diff for samples at interval k
// Can accept either palette+jndStep or pre-generated jndSamples
function calcSampleIntervalMinDiff(paletteOrSamples, intervalK, jndStep) {
    let min_interval_diff = Number.MAX_VALUE;
    try {
        // If it's an array of samples (already JND sampled), use directly
        // Otherwise generate JND samples from palette
        const jndSamples = Array.isArray(paletteOrSamples[0]) && paletteOrSamples[0].length === 3
            ? paletteOrSamples
            : generateJndSamples(paletteOrSamples, jndStep);
        
        if (jndSamples.length <= intervalK) {
            return 0;
        }

        // Calculate min diff between samples i and i+k
        for (let i = 0; i + intervalK < jndSamples.length; i++) {
            const diff = ciede2000(jndSamples[i], jndSamples[i + intervalK]);
            if (diff < min_interval_diff) {
                min_interval_diff = diff;
            }
        }
        
        return min_interval_diff === Number.MAX_VALUE ? 0 : min_interval_diff;
    } catch (error) {
        console.error('Error in calcSampleIntervalMinDiff:', error);
        return 0;
    }
}

// Uniform Mode: Calculate min color diff among uniformly sampled points
function calcUniformMinDiff(palette, sampleCount) {
    let min_color_diff = Number.MAX_VALUE;
    try {
        // Uniformly sample points from the palette
        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
            const t = i / (sampleCount - 1);
            const idx = Math.min(Math.floor(t * palette.length), palette.length - 1);
            samples.push(palette[idx]);
        }

        // Calculate min CIEDE2000 difference between all pairs
        for (let i = 0; i < samples.length - 1; i++) {
            for (let j = i + 1; j < samples.length; j++) {
                const diff = ciede2000(samples[i], samples[j]);
                if (diff < min_color_diff) {
                    min_color_diff = diff;
                }
            }
        }
        
        return min_color_diff === Number.MAX_VALUE ? 0 : min_color_diff;
    } catch (error) {
        console.error('Error in calcUniformMinDiff:', error);
        return 0;
    }
}
