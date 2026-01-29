// Static Metrics Calculation Functions

// 1. CIEDE2000 Discriminative Power
function discriminatory_cie(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) {
        console.error("Invalid colors array:", colors);
        return 0;
    }

    let totalSpeed = 0;
    let pairCount = 0;

    for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
            const rgbColor1 = d3.rgb(colors[i].rgb[0], colors[i].rgb[1], colors[i].rgb[2]);
            const rgbColor2 = d3.rgb(colors[j].rgb[0], colors[j].rgb[1], colors[j].rgb[2]);
            const lab1 = d3.lab(rgbColor1);
            const lab2 = d3.lab(rgbColor2);

            const deltaE = ciede2000([lab1.l || lab1.L, lab1.a, lab1.b], [lab2.l || lab2.L, lab2.a, lab2.b]);
            const v_ij = deltaE;
            totalSpeed += v_ij;
            pairCount++;
        }
    }

    const globalDiscriminativePower = pairCount > 0 ? totalSpeed / pairCount : 0;
    return globalDiscriminativePower;
}

// 2. Contrast Sensitivity
function discriminatory_contrast_sensitivity(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) {
        console.error("Invalid colors array:", colors);
        return 0;
    }

    let totalSpeed = 0;
    let pairCount = 0;

    try {
        for (let i = 0; i < colors.length; i++) {
            for (let j = i + 1; j < colors.length; j++) {
                try {
                    const rgbColor1 = d3.rgb(colors[i].rgb[0], colors[i].rgb[1], colors[i].rgb[2]);
                    const rgbColor2 = d3.rgb(colors[j].rgb[0], colors[j].rgb[1], colors[j].rgb[2]);

                    if (!rgbColor1 || !rgbColor2) {
                        continue;
                    }

                    const lab1 = d3.lab(rgbColor1);
                    const lab2 = d3.lab(rgbColor2);

                    const l1 = Number(lab1.l !== undefined ? lab1.l : lab1.L);
                    const a1 = Number(lab1.a);
                    const b1 = Number(lab1.b);
                    const l2 = Number(lab2.l !== undefined ? lab2.l : lab2.L);
                    const a2 = Number(lab2.a);
                    const b2 = Number(lab2.b);

                    const deltaE = computeDeltaE(l1, a1, b1, l2, a2, b2);

                    if (isNaN(deltaE) || deltaE === 0) {
                        continue;
                    }

                    const normalizationFactor = Math.abs((j - i) / (colors.length - 1));

                    if (normalizationFactor === 0) {
                        continue;
                    }

                    const v_ij = deltaE / normalizationFactor;

                    if (isNaN(v_ij)) {
                        continue;
                    }

                    const contribution = 3.4 * Math.pow(v_ij, 0.879);

                    totalSpeed += contribution;
                    pairCount++;

                } catch (error) {
                    console.error(`Error processing color pair [${i}, ${j}]:`, error);
                }
            }
        }

        const globalDiscriminativePower = pairCount > 0 ? totalSpeed / pairCount : 0;
        return globalDiscriminativePower;
    } catch (error) {
        console.error("discriminatory_contrast_sensitivity error:", error);
        return 0;
    }
}

// 3. Hue Variation
function discriminatory_hue(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) {
        console.error("Invalid colors array:", colors);
        return 0;
    }

    const hueValues = [];
    for (let i = 0; i < colors.length; i++) {
        try {
            const r = parseInt(colors[i].rgb[0]);
            const g = parseInt(colors[i].rgb[1]);
            const b = parseInt(colors[i].rgb[2]);

            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                continue;
            }

            const rgbColor = d3.rgb(r, g, b);
            const hcl = d3.hcl(rgbColor);

            const h = isNaN(hcl.h) ? 0 : hcl.h;
            hueValues.push(h);
        } catch (error) {
            console.error(`Error processing color ${i}:`, error);
        }
    }

    if (hueValues.length === 0) {
        return 0;
    }

    let totalVariation = 0;
    for (let i = 1; i < hueValues.length; i++) {
        let diff = Math.abs(hueValues[i] - hueValues[i - 1]);
        if (diff > 180) {
            diff = 360 - diff;
        }
        totalVariation += diff;
    }

    return totalVariation;
}

// 4. Luminance Variation
function luminance_variation(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) {
        console.error("Invalid colors array:", colors);
        return 0;
    }

    const luminanceValues = [];
    for (let i = 0; i < colors.length; i++) {
        try {
            const r = parseInt(colors[i].rgb[0]);
            const g = parseInt(colors[i].rgb[1]);
            const b = parseInt(colors[i].rgb[2]);

            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                console.error(`Invalid rgb values for color ${i}:`, colors[i].rgb);
                continue;
            }

            const rgbColor = d3.rgb(r, g, b);
            const hcl = d3.hcl(rgbColor);

            const lValue = hcl.l !== undefined ? hcl.l : hcl.L;
            if (hcl && typeof lValue === 'number' && !isNaN(lValue)) {
                luminanceValues.push(lValue);
            } else {
                console.error(`Invalid luminance for color ${i}:`, hcl);
            }
        } catch (error) {
            console.error(`Error processing color ${i}:`, error);
        }
    }

    if (luminanceValues.length === 0) {
        console.error("No valid luminance values calculated");
        return null;
    }

    let totalVariation = 0;
    for (let i = 1; i < luminanceValues.length; i++) {
        totalVariation += Math.abs(luminanceValues[i] - luminanceValues[i - 1]);
    }

    return totalVariation;
}

// 5. Chromatic Variation
function chromatic_variation(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) {
        console.error("Invalid colors array:", colors);
        return 0;
    }

    const saturationValues = [];
    for (let i = 0; i < colors.length; i++) {
        try {
            const r = parseInt(colors[i].rgb[0]);
            const g = parseInt(colors[i].rgb[1]);
            const b = parseInt(colors[i].rgb[2]);

            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                console.error(`Invalid rgb values for color ${i}:`, colors[i].rgb);
                continue;
            }

            const rgbColor = d3.rgb(r, g, b);
            const hcl = d3.hcl(rgbColor);

            const cValue = hcl.c !== undefined ? hcl.c : hcl.C;
            if (hcl && typeof cValue === 'number' && !isNaN(cValue)) {
                saturationValues.push(cValue);
            } else {
                console.error(`Invalid saturation for color ${i}:`, hcl);
            }
        } catch (error) {
            console.error(`Error processing color ${i}:`, error);
        }
    }

    if (saturationValues.length === 0) {
        console.error("No valid saturation values calculated");
        return null;
    }

    let totalVariation = 0;
    for (let i = 1; i < saturationValues.length; i++) {
        totalVariation += Math.abs(saturationValues[i] - saturationValues[i - 1]);
    }

    return totalVariation;
}

// 6. LAB Length
function calculate_lab_length(colormap, sampleCount = 9) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) {
        console.error("Invalid colors array:", colors);
        return 0;
    }

    const samples = [];
    const step = (colors.length - 1) / (sampleCount - 1);

    for (let i = 0; i < sampleCount; i++) {
        const index = Math.min(Math.floor(i * step), colors.length - 1);
        try {
            const r = parseInt(colors[index].rgb[0]);
            const g = parseInt(colors[index].rgb[1]);
            const b = parseInt(colors[index].rgb[2]);

            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                console.error(`Invalid rgb values for sampled color ${i}:`, colors[index].rgb);
                continue;
            }

            const rgbColor = d3.rgb(r, g, b);
            const lab = d3.lab(rgbColor);

            const lValue = lab.l !== undefined ? lab.l : lab.L;
            if (!isNaN(lValue) && !isNaN(lab.a) && !isNaN(lab.b)) {
                samples.push(lab);
            }
        } catch (error) {
            console.error(`Error sampling color ${i}:`, error);
        }
    }

    if (samples.length < 2) {
        console.error("Not enough valid samples for LAB length calculation");
        return 0;
    }

    let totalLabLength = 0;

    for (let i = 0; i < samples.length - 1; i++) {
        const lab1 = samples[i];
        const lab2 = samples[i + 1];

        const l1 = lab1.l !== undefined ? lab1.l : lab1.L;
        const l2 = lab2.l !== undefined ? lab2.l : lab2.L;

        const distance = Math.sqrt(
            Math.pow(l2 - l1, 2) +
            Math.pow(lab2.a - lab1.a, 2) +
            Math.pow(lab2.b - lab1.b, 2)
        );

        if (isNaN(distance)) {
            console.warn(`LAB distance is NaN for samples ${i}-${i + 1}`);
        }

        totalLabLength += distance;
    }

    return totalLabLength;
}

// 7. Color Name Variation
function calculate_color_name_variation(colormap, sampleCount = 9) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) {
        return 0;
    }

    const samples = [];
    const step = (colors.length - 1) / (sampleCount - 1);

    for (let i = 0; i < sampleCount; i++) {
        const index = Math.min(Math.floor(i * step), colors.length - 1);
        try {
            const r = parseInt(colors[index].rgb[0]);
            const g = parseInt(colors[index].rgb[1]);
            const b = parseInt(colors[index].rgb[2]);

            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                continue;
            }

            samples.push(d3.rgb(r, g, b));
        } catch (error) {
            // Skip errors
        }
    }

    if (samples.length < 2) {
        return 0;
    }

    let totalNameDiff = 0;
    let pairCount = 0;

    for (let i = 0; i < samples.length - 1; i++) {
        for (let j = i + 1; j < samples.length; j++) {
            const diff = getNameDifference(samples[i], samples[j]);
            if (!isNaN(diff) && isFinite(diff)) {
                totalNameDiff += diff;
                pairCount++;
            }
        }
    }

    return pairCount > 0 ? totalNameDiff / pairCount : 0;
}

// 8. Color Categorization Tendency
function calculate_color_categorization_tendency(colormap, sampleCount = 100, dissimilarityThreshold = 0.6) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) {
        return 0;
    }

    const samples = [];
    const step = Math.max(1, Math.floor(colors.length / sampleCount));

    for (let i = 0; i < colors.length; i += step) {
        if (samples.length >= sampleCount) break;

        try {
            const r = parseInt(colors[i].rgb[0]);
            const g = parseInt(colors[i].rgb[1]);
            const b = parseInt(colors[i].rgb[2]);

            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                samples.push(d3.rgb(r, g, b));
            }
        } catch (error) {
            // Skip errors
        }
    }

    if (samples.length < 2) {
        return 0;
    }

    // Pre-compute distance matrix
    const distMatrix = new Array(samples.length);
    let minDist = Infinity, maxDist = -Infinity, sumDist = 0, distCount = 0;

    for (let i = 0; i < samples.length; i++) {
        distMatrix[i] = new Array(samples.length);
        for (let j = 0; j < samples.length; j++) {
            if (i === j) {
                distMatrix[i][j] = 0;
            } else if (j > i) {
                distMatrix[i][j] = getNameDifference(samples[i], samples[j]);
                const dist = distMatrix[i][j];
                if (!isNaN(dist) && isFinite(dist)) {
                    minDist = Math.min(minDist, dist);
                    maxDist = Math.max(maxDist, dist);
                    sumDist += dist;
                    distCount++;
                }
            } else {
                distMatrix[i][j] = distMatrix[j][i];
            }
        }
    }

    const avgDist = distCount > 0 ? sumDist / distCount : 0;
    console.log(`Distance stats: min=${minDist.toFixed(3)}, max=${maxDist.toFixed(3)}, avg=${avgDist.toFixed(3)}, threshold=${dissimilarityThreshold}`);

    const clusters = agglomerativeClusteringOptimized(samples, distMatrix, dissimilarityThreshold);
    const K = clusters.length;

    console.log(`Clustering result: K=${K} clusters from ${samples.length} samples`);

    if (K < 2) {
        console.warn('Only 1 cluster found, returning 0');
        return 0;
    }

    const centroids = [];
    for (let cluster of clusters) {
        const clusterColors = cluster.indices.map(idx => samples[idx]);
        const centroid = selectClusterCentroid({ colors: clusterColors });
        if (centroid) {
            centroids.push(centroid);
        }
    }

    if (centroids.length < 2) {
        return 0;
    }

    let totalDeltaE = 0;
    let pairCount = 0;

    for (let i = 0; i < centroids.length; i++) {
        for (let j = i + 1; j < centroids.length; j++) {
            const lab1 = d3.lab(centroids[i]);
            const lab2 = d3.lab(centroids[j]);

            const l1 = lab1.l !== undefined ? lab1.l : lab1.L;
            const l2 = lab2.l !== undefined ? lab2.l : lab2.L;

            const deltaE = ciede2000([l1, lab1.a, lab1.b], [l2, lab2.a, lab2.b]);

            if (!isNaN(deltaE) && isFinite(deltaE)) {
                totalDeltaE += deltaE;
                pairCount++;
            }
        }
    }

    const meanDeltaE = pairCount > 0 ? totalDeltaE / pairCount : 0;
    return K * meanDeltaE;
}

// Helper: Optimized clustering
function agglomerativeClusteringOptimized(samples, distMatrix, dissimilarityThreshold = 0.6) {
    if (!samples || samples.length === 0) {
        return [];
    }

    let clusters = samples.map((_, i) => ({
        id: i,
        indices: [i]
    }));

    let merged = true;

    while (merged && clusters.length > 1) {
        merged = false;

        let minDissimilarity = Infinity;
        let mergeIndex = -1;

        for (let i = 0; i < clusters.length - 1; i++) {
            const c1 = clusters[i];
            const c2 = clusters[i + 1];

            let totalDissim = 0;
            let pairCount = 0;

            for (let idx1 of c1.indices) {
                for (let idx2 of c2.indices) {
                    const dissim = distMatrix[idx1][idx2];
                    if (!isNaN(dissim) && isFinite(dissim)) {
                        totalDissim += dissim;
                        pairCount++;
                    }
                }
            }

            const avgDissim = pairCount > 0 ? totalDissim / pairCount : Infinity;

            if (avgDissim < minDissimilarity) {
                minDissimilarity = avgDissim;
                mergeIndex = i;
            }
        }

        if (mergeIndex >= 0 && minDissimilarity < dissimilarityThreshold) {
            const c1 = clusters[mergeIndex];
            const c2 = clusters[mergeIndex + 1];

            const mergedCluster = {
                id: c1.id,
                indices: [...c1.indices, ...c2.indices]
            };

            clusters.splice(mergeIndex, 2, mergedCluster);
            merged = true;
        }
    }

    return clusters;
}

// Helper: Select cluster centroid
function selectClusterCentroid(cluster) {
    if (!cluster || !cluster.colors || cluster.colors.length === 0) {
        return null;
    }

    if (typeof nameSalience !== 'function') {
        return cluster.colors[0];
    }

    let maxSaliency = -Infinity;
    let centroid = cluster.colors[0];

    for (let color of cluster.colors) {
        try {
            const saliency = nameSalience(color);
            if (!isNaN(saliency) && saliency > maxSaliency) {
                maxSaliency = saliency;
                centroid = color;
            }
        } catch (e) {
            // Skip errors
        }
    }

    return centroid;
}

// Main function to calculate and display all metrics
function calculateAndDisplayMetrics(colormap, title = "Colormap Metrics") {
    console.log(`\n========== ${title} ==========`);

    try {
        const metrics = {};

        metrics.discriminatory_cie = discriminatory_cie(colormap) || 0;
        console.log('CIEDE2000 Discriminative Power:', metrics.discriminatory_cie.toFixed(3));

        metrics.discriminatory_contrast = discriminatory_contrast_sensitivity(colormap) || 0;
        console.log('Contrast Sensitivity:', metrics.discriminatory_contrast.toFixed(3));

        metrics.discriminatory_hue = discriminatory_hue(colormap) || 0;
        console.log('Hue Discriminative Power:', metrics.discriminatory_hue.toFixed(3));

        metrics.luminance_var = luminance_variation(colormap) || 0;
        console.log('Luminance Variation:', metrics.luminance_var.toFixed(3));

        metrics.chromatic_var = chromatic_variation(colormap) || 0;
        console.log('Chromatic Variation:', metrics.chromatic_var.toFixed(3));

        metrics.lab_length = calculate_lab_length(colormap) || 0;
        console.log('LAB Length:', metrics.lab_length.toFixed(3));

        metrics.color_name_var = calculate_color_name_variation(colormap) || 0;

        metrics.categorization_tendency = calculate_color_categorization_tendency(colormap) || 0;
        console.log('Color Categorization Tendency:', metrics.categorization_tendency.toFixed(3));

        // Convert colormap to HCL format for sampling metrics
        const hclPalette = convertColormapToHCLPalette(colormap);

        // Calculate Uniform mode metrics only
        metrics.uniform_small_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_SMALL_INTERVAL_K, UNIFORM_SAMPLE_COUNT) || 0;
        console.log(`Uniform Small Window Diff (k=${UNIFORM_SMALL_INTERVAL_K}):`, metrics.uniform_small_window_diff.toFixed(3));

        metrics.uniform_large_window_diff = calcUniformIntervalMinDiff(hclPalette, UNIFORM_LARGE_INTERVAL_K, UNIFORM_SAMPLE_COUNT) || 0;
        console.log(`Uniform Large Window Diff (k=${UNIFORM_LARGE_INTERVAL_K}):`, metrics.uniform_large_window_diff.toFixed(3));

        console.log('==========================================\n');

        return metrics;
    } catch (error) {
        console.error('Error calculating metrics:', error);
        console.error('Error stack:', error.stack);
        return null;
    }
}
