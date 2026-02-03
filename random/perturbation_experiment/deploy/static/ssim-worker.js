/**
 * SSIM Optimization Web Worker
 * Handles CPU-intensive SSIM optimization in a separate thread
 */

// Import all necessary dependencies
// Important: gaussmix.js must be imported before gaussmix_bivariate.js
importScripts(
    'gaussmix.js',              // Base class
    'gaussmix_bivariate.js',    // Extends GaussMix
    'utils.js',
    'gaussianGenerator.js',
    'perturbation.js',
    'softAttributionPerturbation.js'
);

// Worker message handler
self.onmessage = async function (e) {
    const { type, data } = e.data;

    if (type === 'OPTIMIZE_SSIM') {
        try {
            const result = await optimizeSSIM(data);
            // Echo back the request ID
            self.postMessage({ type: 'SUCCESS', id: data.id, result });
        } catch (error) {
            self.postMessage({
                type: 'ERROR',
                id: data.id,
                error: error.message || 'Unknown error'
            });
        }
    }
};

/**
 * Performs SSIM optimization using binary search
 */
async function optimizeSSIM(config) {
    const {
        targetSSIM,
        freqTarget,
        generatorState,
        width,
        height,
        sizeLevels,
        coefficients,
        isEngagementCheck = false, // Default to false for backward compatibility
        tolerance = 0.0001,
        maxRetries = 10,
        maxIterPerTry = 80
    } = config;

    // Reconstruct Generator
    const generator = new GaussianGenerator(width, height);
    generator.sizeLevels = sizeLevels;
    generator.importConfig(generatorState);

    // Reconstruct Systems
    const perturbation = new PerturbationSystem(generator);
    const softAttribution = new SoftAttributionPerturbation(generator);

    // Render original data
    const dataOriginal = generator.renderTo1DArray(width, height, false, true);

    // Precompute Soft Attribution Masks (Avoid recomputing in loop)
    let saCache = null;
    if (!isEngagementCheck) {
        // Render 1 time only
        const originalTotal = generator.renderTo1DArray(width, height, true, false);
        const originalBands = {
            low: softAttribution.renderBandField('large', width, height, true),
            mid: softAttribution.renderBandField('medium', width, height, true),
            high: softAttribution.renderBandField('small', width, height, true)
        };

        // Compute fields 1 time only
        const energyFields = softAttribution.computeGradientEnergyFields(width, height);
        const attributionWeights = softAttribution.computeAttributionWeights(energyFields, width, height);
        const gatingMasks = softAttribution.generateGatingMasks(attributionWeights, width, height);

        saCache = {
            originalTotal,
            originalBands,
            gatingMasks
        };
    }

    let bestOverallDiff = Infinity;
    let bestOverallResult = null;
    let bestOverallMagnitude = 0;
    let foundGoodResult = false;

    for (let retry = 0; retry < maxRetries && !foundGoodResult; retry++) {
        perturbation.resetToOriginal();
        perturbation.setCoefficients(coefficients);
        perturbation.generatePerturbationDeltas(freqTarget, 1.0, 'all');

        // Adaptive max magnitude - increased range for better convergence
        const maxMagnitude = (freqTarget === 'large') ? 12.0 : 8.0;
        let min = 0.0, max = maxMagnitude;
        let bestDiff = Infinity;

        for (let i = 0; i < maxIterPerTry; i++) {
            const mid = (min + max) / 2;

            // Apply direct perturbation (position, rotation, etc.)
            perturbation.applyStoredPerturbation(mid);

            let tempPerturbed;

            if (isEngagementCheck) {
                // Engagement checks: Direct rendering (no soft attribution)
                tempPerturbed = generator.renderTo1DArray(width, height, false, true);
            } else {
                // Main trials: Use soft attribution with gating using PRECOMPUTED MASKS

                // Only render the CURRENT perturbed state (fast)
                const perturbedBands = {
                    low: softAttribution.renderBandField('large', width, height, false),
                    mid: softAttribution.renderBandField('medium', width, height, false),
                    high: softAttribution.renderBandField('small', width, height, false)
                };

                // Apply gating using cached masks
                tempPerturbed = softAttribution.applyGatedPerturbation(
                    saCache.originalTotal,
                    saCache.originalBands,
                    perturbedBands,
                    saCache.gatingMasks,
                    width,
                    height
                );
            }

            const currentSSIM = calculateSSIM(dataOriginal, tempPerturbed, width, height);
            const diff = Math.abs(currentSSIM - targetSSIM);

            if (diff < bestDiff) {
                bestDiff = diff;
            }

            if (diff < bestOverallDiff) {
                bestOverallDiff = diff;
                bestOverallMagnitude = mid;
                bestOverallResult = Array.from(tempPerturbed); // Convert to regular array

                if (diff < tolerance) {
                    foundGoodResult = true;
                    break;
                }
            }

            // Binary search
            if (currentSSIM > targetSSIM) {
                min = mid;
            } else {
                max = mid;
            }
        }
    }

    if (!bestOverallResult) {
        // Fallback
        perturbation.applyStoredPerturbation(0);
        // Direct render fallback
        const fallbackData = generator.renderTo1DArray(width, height, false, true);
        return {
            data: Array.from(fallbackData),
            magnitude: 0,
            ssim: 1
        };
    }

    // Calculate final SSIM
    const finalSSIM = calculateSSIM(
        dataOriginal,
        new Float32Array(bestOverallResult),
        width,
        height
    );

    return {
        data: bestOverallResult,
        magnitude: bestOverallMagnitude,
        ssim: finalSSIM
    };
}
