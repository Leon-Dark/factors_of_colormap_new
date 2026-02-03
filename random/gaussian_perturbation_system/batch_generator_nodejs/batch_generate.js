const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const archiver = require('archiver');

// ============================================================================
// Core Mathematical Functions (Ported from browser code)
// ============================================================================

// ============================================================================
// Core Mathematical Functions (Ported from browser code: utils.js & common)
// ============================================================================

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function normalize(data) {
    let max = 0;
    let min = Infinity;
    for (let i = 0; i < data.length; i++) {
        max = Math.max(max, data[i]);
        min = Math.min(min, data[i]);
    }
    const range = max - min;
    const normalized = new Float32Array(data.length);

    // If range is effectively zero, return all zeros
    if (Math.abs(range) < 1e-9) return normalized;

    for (let i = 0; i < data.length; i++) {
        normalized[i] = (data[i] - min) / range;
    }
    return normalized;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function smoothstep(x, edge0 = 0.3, edge1 = 0.7) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function makeGaussianKernel(sigma) {
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = new Float32Array(kernelSize);
    const center = Math.floor(kernelSize / 2);
    let sum = 0;

    for (let i = 0; i < kernelSize; i++) {
        const x = i - center;
        kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
        sum += kernel[i];
    }

    for (let i = 0; i < kernelSize; i++) {
        kernel[i] /= sum;
    }

    return kernel;
}

function convolve1D(field, width, height, kernel, direction) {
    const result = new Float32Array(width * height);
    const halfKernel = Math.floor(kernel.length / 2);

    if (direction === 'horizontal') {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                for (let k = 0; k < kernel.length; k++) {
                    const offset = k - halfKernel;
                    // Clamp index to [0, width-1] (Clamp-to-Edge)
                    const sx = Math.min(Math.max(x + offset, 0), width - 1);
                    sum += field[y * width + sx] * kernel[k];
                }
                result[y * width + x] = sum;
            }
        }
    } else { // vertical
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                for (let k = 0; k < kernel.length; k++) {
                    const offset = k - halfKernel;
                    // Clamp index to [0, height-1] (Clamp-to-Edge)
                    const sy = Math.min(Math.max(y + offset, 0), height - 1);
                    sum += field[sy * width + x] * kernel[k];
                }
                result[y * width + x] = sum;
            }
        }
    }

    return result;
}

function gaussianBlur2D(field, width, height, sigma) {
    if (sigma <= 0) return new Float32Array(field);
    const kernel = makeGaussianKernel(sigma);
    const temp = convolve1D(field, width, height, kernel, 'horizontal');
    return convolve1D(temp, width, height, kernel, 'vertical');
}

function computeGradientMagnitudeSquared(field, width, height) {
    const gradientSq = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            let gradX = 0;
            if (x > 0 && x < width - 1) {
                gradX = (field[y * width + (x + 1)] - field[y * width + (x - 1)]) / 2;
            } else if (x === 0 && width > 1) {
                gradX = field[y * width + 1] - field[y * width];
            } else if (x === width - 1 && width > 1) {
                gradX = field[y * width + x] - field[y * width + (x - 1)];
            }

            let gradY = 0;
            if (y > 0 && y < height - 1) {
                gradY = (field[(y + 1) * width + x] - field[(y - 1) * width + x]) / 2;
            } else if (y === 0 && height > 1) {
                gradY = field[width + x] - field[x];
            } else if (y === height - 1 && height > 1) {
                gradY = field[y * width + x] - field[(y - 1) * width + x];
            }

            gradientSq[idx] = gradX * gradX + gradY * gradY;
        }
    }

    return gradientSq;
}

function calculateSSIM(img1, img2, width, height, dynamicRange = 1.0) {
    if (img1.length !== img2.length) return 0;

    const L = dynamicRange;
    const K1 = 0.01;
    const K2 = 0.03;
    const C1 = (K1 * L) ** 2;
    const C2 = (K2 * L) ** 2;

    const sigma = 1.5;

    // Helper for element-wise multiplication
    const multiply = (a, b) => {
        const res = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) res[i] = a[i] * b[i];
        return res;
    };

    const mu1 = gaussianBlur2D(img1, width, height, sigma);
    const mu2 = gaussianBlur2D(img2, width, height, sigma);

    const mu1_sq = multiply(mu1, mu1);
    const mu2_sq = multiply(mu2, mu2);
    const mu1_mu2 = multiply(mu1, mu2);

    const img1_sq = multiply(img1, img1);
    const img2_sq = multiply(img2, img2);
    const img1_img2 = multiply(img1, img2);

    const sigma1_sq = gaussianBlur2D(img1_sq, width, height, sigma);
    const sigma2_sq = gaussianBlur2D(img2_sq, width, height, sigma);
    const sigma12 = gaussianBlur2D(img1_img2, width, height, sigma);

    let ssimSum = 0;
    const totalPixels = width * height;

    for (let i = 0; i < totalPixels; i++) {
        const s1_sq = Math.max(0, sigma1_sq[i] - mu1_sq[i]);
        const s2_sq = Math.max(0, sigma2_sq[i] - mu2_sq[i]);
        const s12 = sigma12[i] - mu1_mu2[i];

        const numerator = (2 * mu1_mu2[i] + C1) * (2 * s12 + C2);
        const denominator = (mu1_sq[i] + mu2_sq[i] + C1) * (s1_sq + s2_sq + C2);

        ssimSum += numerator / denominator;
    }

    return ssimSum / totalPixels;
}

function calculateKLDivergence(imgP, imgQ) {
    if (imgP.length !== imgQ.length) return Infinity;

    const epsilon = 1e-10;
    let sumP = 0, sumQ = 0;

    for (let i = 0; i < imgP.length; i++) {
        sumP += imgP[i] + epsilon;
        sumQ += imgQ[i] + epsilon;
    }

    if (sumP === 0 || sumQ === 0) return 0;

    let kl = 0;
    for (let i = 0; i < imgP.length; i++) {
        const p = (imgP[i] + epsilon) / sumP;
        const q = (imgQ[i] + epsilon) / sumQ;
        kl += p * Math.log(p / q);
    }

    return kl;
}

// ============================================================================
// BiGauss Class (Ported from browser library)
// ============================================================================

class BiGauss {
    constructor(mX, mY, sX, sY, rho, scaler) {
        this.mX = mX;
        this.mY = mY;
        this.sX = sX;
        this.sY = sY;
        this.updateRho(rho);
        this.scaler = (scaler ? scaler : 1);

        this.originalMX = mX;
        this.originalMY = mY;
        this.originalSX = sX;
        this.originalSY = sY;
        this.originalRho = rho;
        this.originalScaler = scaler;

        this.isPerturbed = false;
        this.id = Math.random().toString(36).substr(2, 9);
    }

    updateRho(newRho) {
        this.rho = newRho;
        this.rho2 = this.rho * this.rho;
        this.rhoExpConst = -1 / (2 * (1 - this.rho2));
        this.rhoSqrConst = 1 / (2 * Math.PI * Math.sqrt(1 - this.rho2));
    }

    perturb(rhoP) {
        let newRho = this.rho + rhoP;
        if (newRho > 1 || newRho < -1) {
            rhoP *= -1;
            newRho = this.rho + rhoP;
        }
        this.updateRho(newRho);
    }

    eval(x, y) {
        const stX = (x - this.mX) / this.sX;
        const stY = (y - this.mY) / this.sY;
        const stXY = stX * stY;

        const e = this.rhoExpConst * (stX * stX - 2 * this.rho * stXY + stY * stY);
        const a = this.rhoSqrConst * (1 / (this.sX * this.sY));

        return this.scaler * Math.exp(e) * a;
    }

    getBoundingBox(sigmaMultiplier = 3) {
        const rangeX = this.sX * sigmaMultiplier;
        const rangeY = this.sY * sigmaMultiplier;

        return {
            minX: this.mX - rangeX,
            maxX: this.mX + rangeX,
            minY: this.mY - rangeY,
            maxY: this.mY + rangeY
        };
    }
}

// ============================================================================
// GaussianGenerator Class
// ============================================================================

class GaussianGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.gaussians = [];

        this.sizeLevels = {
            'small': { sigma: 15, count: 2, color: '#377eb8' },
            'medium': { sigma: 25, count: 3, color: '#4daf4a' },
            'large': { sigma: 50, count: 4, color: '#ff7f00' }
        };

        this.exponent = 1.0;
        this.bandWeights = {
            'small': 1.0,
            'medium': 1.5,
            'large': 3.0
        };
    }

    setBandWeight(level, weight) {
        if (this.bandWeights.hasOwnProperty(level)) {
            this.bandWeights[level] = weight;
        }
    }

    setExponent(exp) {
        this.exponent = exp;
    }

    updateDimensions(width, height) {
        this.width = width;
        this.height = height;
    }

    updateSizeLevel(level, sigma, count) {
        if (this.sizeLevels[level]) {
            this.sizeLevels[level].sigma = sigma;
            this.sizeLevels[level].count = count;
        }
    }

    generateAll() {
        this.gaussians = [];

        for (const [level, config] of Object.entries(this.sizeLevels)) {
            this.generateLevel(level, config.sigma, config.count, config.color);
        }
        // console.log(`Generated ${this.gaussians.length} Gaussians randomly distributed`);

        return this.gaussians;
    }

    generateLevel(level, sigma, count, color) {
        const padding = 10;
        const width = this.width;
        const height = this.height;
        const minDistance = 20;

        const levelGaussians = [];
        const maxRetries = 200;

        for (let i = 0; i < count; i++) {
            let bestX, bestY;
            let valid = false;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                const x = padding + Math.random() * (width - 2 * padding);
                const y = padding + Math.random() * (height - 2 * padding);

                let tooClose = false;

                // Check against all existing gaussians (previous levels + current level accumulated)
                for (const g of this.gaussians) {
                    if (levelGaussians.includes(g)) continue;

                    const dx = x - g.mX;
                    const dy = y - g.mY;
                    if (dx * dx + dy * dy < minDistance * minDistance) {
                        tooClose = true;
                        break;
                    }
                }

                if (!tooClose) {
                    for (const g of levelGaussians) {
                        const dx = x - g.mX;
                        const dy = y - g.mY;
                        if (dx * dx + dy * dy < minDistance * minDistance) {
                            tooClose = true;
                            break;
                        }
                    }
                }

                if (!tooClose) {
                    bestX = x;
                    bestY = y;
                    valid = true;
                    break;
                }
            }

            if (valid) {
                const sXVariation = 0.8 + Math.random() * 0.4;
                const sYVariation = 0.8 + Math.random() * 0.4;
                const sX = sigma * sXVariation;
                const sY = sigma * sYVariation;

                const rho = (Math.random() * 2 - 1) * 0.6;
                let scaler = 100;

                // NOTE: Using BiGauss (uppercase) to match class definition in this file
                const gauss = new BiGauss(bestX, bestY, sX, sY, rho, scaler);
                gauss.color = color;
                gauss.sizeLevel = level;

                // Extended properties for perturbation compatibility
                gauss.originalMX = bestX;
                gauss.originalMY = bestY;
                gauss.originalSX = sX;
                gauss.originalSY = sY;
                gauss.originalRho = rho;
                gauss.originalScaler = scaler;
                gauss.isPerturbed = false;
                gauss.id = Math.random().toString(36).substr(2, 9);

                levelGaussians.push(gauss);
                this.gaussians.push(gauss);
            } else {
                console.warn(`Could not place Gaussian ${i + 1}/${count} for level ${level} within ${maxRetries} attempts.`);
            }
        }

        // console.log(`Generated ${levelGaussians.length} Gaussians for level ${level} using Distance Constraint`);

        return levelGaussians;
    }

    getGaussiansByLevel(level) {
        const smallSigma = this.sizeLevels['small'].sigma;
        const mediumSigma = this.sizeLevels['medium'].sigma;
        const largeSigma = this.sizeLevels['large'].sigma;

        return this.gaussians.filter(g => {
            const currentSigma = Math.max(g.sX, g.sY);

            const distToSmall = Math.abs(currentSigma - smallSigma);
            const distToMedium = Math.abs(currentSigma - mediumSigma);
            const distToLarge = Math.abs(currentSigma - largeSigma);

            const minDist = Math.min(distToSmall, distToMedium, distToLarge);

            if (level === 'small') {
                return distToSmall === minDist;
            } else if (level === 'medium') {
                return distToMedium === minDist;
            } else if (level === 'large') {
                return distToLarge === minDist;
            }
            return false;
        });
    }

    getAllGaussians() {
        return this.gaussians;
    }

    clear() {
        this.gaussians = [];
    }

    renderToField(field, useGradientNormalization = true) {
        const width = field[0].length;
        const height = field.length;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                field[y][x] = 0;
            }
        }

        for (const gauss of this.gaussians) {
            const bbox = gauss.getBoundingBox(3);

            const startX = Math.max(0, Math.floor(bbox.minX));
            const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
            const startY = Math.max(0, Math.floor(bbox.minY));
            const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    field[y][x] += gauss.eval(x, y);
                }
            }
        }

        return field;
    }

    renderTo1DArray(width, height, useOriginal = false, useGradientNormalization = true) {
        const data = new Float32Array(width * height);

        for (const gauss of this.gaussians) {
            if (useOriginal) {
                const maxSigma = Math.max(gauss.originalSX, gauss.originalSY);
                const range = maxSigma * 3;

                const startX = Math.max(0, Math.floor(gauss.originalMX - range));
                const endX = Math.min(width - 1, Math.ceil(gauss.originalMX + range));
                const startY = Math.max(0, Math.floor(gauss.originalMY - range));
                const endY = Math.min(height - 1, Math.ceil(gauss.originalMY + range));

                const tempGauss = new BiGauss(
                    gauss.originalMX, gauss.originalMY,
                    gauss.originalSX, gauss.originalSY,
                    gauss.originalRho, gauss.originalScaler
                );
                tempGauss.sizeLevel = gauss.sizeLevel;

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        const index = y * width + x;
                        let val = tempGauss.eval(x, y);

                        if (tempGauss.sizeLevel && this.bandWeights[tempGauss.sizeLevel] !== undefined) {
                            val *= this.bandWeights[tempGauss.sizeLevel];
                        }

                        if (this.exponent !== 1.0) {
                            val = Math.pow(val, this.exponent);
                        }
                        data[index] += val;
                    }
                }
            } else {
                const maxSigma = Math.max(gauss.sX, gauss.sY);
                const range = maxSigma * 3;

                const startX = Math.max(0, Math.floor(gauss.mX - range));
                const endX = Math.min(width - 1, Math.ceil(gauss.mX + range));
                const startY = Math.max(0, Math.floor(gauss.mY - range));
                const endY = Math.min(height - 1, Math.ceil(gauss.mY + range));

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        const index = y * width + x;
                        let val = gauss.eval(x, y);

                        if (gauss.sizeLevel && this.bandWeights[gauss.sizeLevel] !== undefined) {
                            val *= this.bandWeights[gauss.sizeLevel];
                        }

                        if (this.exponent !== 1.0) {
                            val = Math.pow(val, this.exponent);
                        }
                        data[index] += val;
                    }
                }
            }
        }

        return data;
    }

    getStatistics() {
        const stats = {
            total: this.gaussians.length,
            byLevel: {},
            perturbed: this.gaussians.filter(g => g.isPerturbed).length
        };

        for (const level of Object.keys(this.sizeLevels)) {
            const levelGaussians = this.getGaussiansByLevel(level);
            stats.byLevel[level] = {
                count: levelGaussians.length,
                perturbed: levelGaussians.filter(g => g.isPerturbed).length
            };
        }

        return stats;
    }

    exportConfig() {
        return {
            width: this.width,
            height: this.height,
            sizeLevels: this.sizeLevels,
            gaussians: this.gaussians.map(g => ({
                id: g.id,
                mX: g.mX,
                mY: g.mY,
                sX: g.sX,
                sY: g.sY,
                rho: g.rho,
                scaler: g.scaler,
                sizeLevel: g.sizeLevel,
                isPerturbed: g.isPerturbed,
                color: g.color,
                original: {
                    mX: g.originalMX,
                    mY: g.originalMY,
                    sX: g.originalSX,
                    sY: g.originalSY,
                    rho: g.originalRho,
                    scaler: g.originalScaler
                }
            }))
        };
    }

    importConfig(config) {
        this.width = config.width;
        this.height = config.height;
        this.sizeLevels = config.sizeLevels;
        this.gaussians = config.gaussians.map(gData => {
            const g = new BiGauss(gData.mX, gData.mY, gData.sX, gData.sY, gData.rho, gData.scaler);
            g.id = gData.id;
            g.sizeLevel = gData.sizeLevel;
            g.isPerturbed = gData.isPerturbed;
            g.color = gData.color;
            g.originalMX = gData.original.mX;
            g.originalMY = gData.original.mY;
            g.originalSX = gData.original.sX;
            g.originalSY = gData.original.sY;
            g.originalRho = gData.original.rho;
            g.originalScaler = gData.original.scaler;
            return g;
        });
    }

    findNearestGaussian(x, y, maxDistance = 50) {
        let nearest = null;
        let minDist = maxDistance;

        for (const gauss of this.gaussians) {
            const dist = distance(x, y, gauss.mX, gauss.mY);
            if (dist < minDist) {
                minDist = dist;
                nearest = gauss;
            }
        }

        return nearest;
    }

    resetAllPerturbations() {
        for (const gauss of this.gaussians) {
            if (gauss.originalMX !== undefined) {
                gauss.mX = gauss.originalMX;
                gauss.mY = gauss.originalMY;
                gauss.sX = gauss.originalSX;
                gauss.sY = gauss.originalSY;
                gauss.scaler = gauss.originalScaler;
                gauss.updateRho(gauss.originalRho);
                gauss.isPerturbed = false;
            }
        }
    }
}

// ============================================================================
// PerturbationSystem Class
// ============================================================================

class PerturbationSystem {
    constructor(generator) {
        this.generator = generator;
        this.coefficients = {
            position: 1.0,
            stretch: 0.5,
            rotation: 0.6,
            amplitude: 0.6
        };
        this.storedDeltas = null;
    }

    setCoefficients(coeffs) {
        this.coefficients = { ...this.coefficients, ...coeffs };
    }

    resetToOriginal() {
        const gaussians = this.generator.getAllGaussians();
        for (const gauss of gaussians) {
            gauss.mX = gauss.originalMX;
            gauss.mY = gauss.originalMY;
            gauss.sX = gauss.originalSX;
            gauss.sY = gauss.originalSY;
            gauss.updateRho(gauss.originalRho);
            gauss.scaler = gauss.originalScaler;
            gauss.isPerturbed = false;
        }
    }

    generatePerturbationDeltas(targetLevel = 'all', ratio = 1.0, perturbType = 'all') {
        let gaussians = this.getTargetGaussians(targetLevel);

        if (gaussians.length === 0) {
            this.storedDeltas = { gaussIds: [], deltas: [], perturbTypes: [] };
            return;
        }

        const perturbCount = Math.floor(gaussians.length * ratio);
        const shuffled = this.shuffleArray([...gaussians]);
        const toPerturb = shuffled.slice(0, perturbCount);

        let perturbTypes;
        if (Array.isArray(perturbType)) {
            perturbTypes = perturbType;
        } else if (perturbType === 'all') {
            perturbTypes = ['position', 'stretch', 'rotation', 'amplitude'];
        } else {
            perturbTypes = [perturbType];
        }

        const deltas = [];
        for (const gauss of toPerturb) {
            const delta = {
                gaussId: gauss.id,
                positionDirX: Math.random() * 2 - 1,
                positionDirY: Math.random() * 2 - 1,
                stretchDirX: Math.random() * 2 - 1,
                stretchDirY: Math.random() * 2 - 1,
                rotationDir: Math.random() * 2 - 1,
                amplitudeDir: Math.random() * 2 - 1,
                basePositionScale: Math.max(gauss.originalSX, gauss.originalSY),
                originalSX: gauss.originalSX,
                originalSY: gauss.originalSY
            };
            deltas.push(delta);
        }

        this.storedDeltas = {
            gaussIds: toPerturb.map(g => g.id),
            deltas: deltas,
            perturbTypes: perturbTypes
        };
    }

    applyStoredPerturbation(magnitude) {
        if (!this.storedDeltas || this.storedDeltas.deltas.length === 0) {
            return [];
        }

        const allGaussians = this.generator.getAllGaussians();
        const gaussMap = new Map(allGaussians.map(g => [g.id, g]));
        const perturbTypes = this.storedDeltas.perturbTypes;
        const perturbedList = [];

        for (const delta of this.storedDeltas.deltas) {
            const gauss = gaussMap.get(delta.gaussId);
            if (!gauss) continue;

            gauss.mX = gauss.originalMX;
            gauss.mY = gauss.originalMY;
            gauss.sX = gauss.originalSX;
            gauss.sY = gauss.originalSY;
            gauss.updateRho(gauss.originalRho);
            gauss.scaler = gauss.originalScaler;

            if (perturbTypes.includes('position')) {
                const canvasW = this.generator.width;
                const canvasH = this.generator.height;
                const bounds = this.calculateDirectionalConstraints(gauss, canvasW, canvasH);

                // Asymmetric position perturbation
                // Select limit based on direction sign
                const limitX = delta.positionDirX < 0 ? bounds.left : bounds.right;
                const limitY = delta.positionDirY < 0 ? bounds.up : bounds.down;

                const scaleX = limitX * Math.tanh(magnitude * this.coefficients.position);
                const scaleY = limitY * Math.tanh(magnitude * this.coefficients.position);

                gauss.mX += delta.positionDirX * scaleX;
                gauss.mY += delta.positionDirY * scaleY;
            }

            if (perturbTypes.includes('stretch')) {
                const sigmaChange = magnitude * this.coefficients.stretch;
                const sXRatio = 1 + delta.stretchDirX * sigmaChange;
                const sYRatio = 1 + delta.stretchDirY * sigmaChange;
                gauss.sX = Math.max(delta.originalSX * 0.2, 2.5, gauss.sX * sXRatio);
                gauss.sY = Math.max(delta.originalSY * 0.2, 2.5, gauss.sY * sYRatio);
            }

            if (perturbTypes.includes('rotation')) {
                const angle = delta.rotationDir * magnitude * this.coefficients.rotation * Math.PI;
                this.applyRigidRotation(gauss, angle);
            }

            if (perturbTypes.includes('amplitude')) {
                const log_a0 = Math.log(Math.max(1e-6, gauss.originalScaler));
                const log_a = log_a0 + delta.amplitudeDir * magnitude * this.coefficients.amplitude;
                gauss.scaler = Math.exp(log_a);
                gauss.scaler = Math.max(0.01, gauss.scaler);
            }

            gauss.isPerturbed = true;
            perturbedList.push(gauss);
        }

        return perturbedList;
    }

    applyGlobalPerturbation(magnitude, ratio, targetLevel = 'all', perturbType = 'all') {
        this.generatePerturbationDeltas(targetLevel, ratio, perturbType);
        return this.applyStoredPerturbation(magnitude);
    }

    calculateDirectionalConstraints(gauss, canvasWidth, canvasHeight, marginMultiplier = 0.0) {
        // Use smaller margin for large gaussians to allow more movement
        const margin = Math.max(marginMultiplier * Math.max(gauss.sX, gauss.sY), 3);

        return {
            left: Math.max(0, gauss.mX - margin),              // Max move left (negative dx)
            right: Math.max(0, canvasWidth - margin - gauss.mX), // Max move right (positive dx)
            up: Math.max(0, gauss.mY - margin),                // Max move up (negative dy)
            down: Math.max(0, canvasHeight - margin - gauss.mY)  // Max move down (positive dy)
        };
    }

    applyRigidRotation(gauss, angle) {
        const cos_a = Math.cos(angle);
        const sin_a = Math.sin(angle);

        const varX = gauss.sX * gauss.sX;
        const varY = gauss.sY * gauss.sY;
        const covXY = gauss.rho * gauss.sX * gauss.sY;

        const newVarX = varX * cos_a * cos_a + varY * sin_a * sin_a + 2 * covXY * cos_a * sin_a;
        const newVarY = varX * sin_a * sin_a + varY * cos_a * cos_a - 2 * covXY * cos_a * sin_a;
        const newCovXY = (varY - varX) * cos_a * sin_a + covXY * (cos_a * cos_a - sin_a * sin_a);

        gauss.sX = Math.sqrt(Math.max(0, newVarX));
        gauss.sY = Math.sqrt(Math.max(0, newVarY));

        if (gauss.sX > 0 && gauss.sY > 0) {
            gauss.updateRho(newCovXY / (gauss.sX * gauss.sY));
        }
    }

    getTargetGaussians(targetLevel) {
        if (Array.isArray(targetLevel)) {
            const allGaussians = this.generator.getAllGaussians();
            return allGaussians.filter(g => targetLevel.includes(g.sizeLevel));
        }

        if (targetLevel === 'all') {
            return this.generator.getAllGaussians();
        } else {
            return this.generator.getGaussiansByLevel(targetLevel);
        }
    }

    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

// ============================================================================
// SoftAttributionPerturbation Class
// ============================================================================

// ============================================================================
// SoftAttributionPerturbation Class (Ported from browser code)
// ============================================================================

class SoftAttributionPerturbation {
    constructor(generator) {
        this.generator = generator;

        // Default params from SoftAttributionPerturbation.js
        this.params = {
            sigma_E_ratio: 0.4,
            sigma_m_ratio: 0.6,
            sigma_Delta_ratio: 0,
            tau_low: 0.3,
            tau_high: 0.7,
            perturbationMode: 'cascading',
            lambda: {
                low: 1.0,
                mid: 1.0,
                high: 1.0
            }
        };

        this.frequencyMap = {
            'large': 'low',
            'medium': 'mid',
            'small': 'high'
        };

        this.cache = {
            energyFields: null,
            attributionWeights: null,
            gatingMasks: null
        };
    }

    setParams(params) {
        this.params = { ...this.params, ...params };
        this.clearCache();
    }

    clearCache() {
        this.cache = {
            energyFields: null,
            attributionWeights: null,
            gatingMasks: null
        };
    }

    computeGradientEnergyFields(width, height) {
        const energyFields = {
            low: new Float32Array(width * height),
            mid: new Float32Array(width * height),
            high: new Float32Array(width * height)
        };

        for (const [sizeLevel, freqBand] of Object.entries(this.frequencyMap)) {
            // Use filtering to get only specific level gaussians
            const gaussians = this.generator.getAllGaussians().filter(g => g.sizeLevel === sizeLevel);

            if (gaussians.length === 0) continue;

            const bandField = new Float32Array(width * height);
            for (const gauss of gaussians) {
                // Use original properties for energy field base
                const tempGauss = new BiGauss(
                    gauss.originalMX, gauss.originalMY,
                    gauss.originalSX, gauss.originalSY,
                    gauss.originalRho, gauss.originalScaler
                );

                const bbox = tempGauss.getBoundingBox(3);
                const startX = Math.max(0, Math.floor(bbox.minX));
                const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
                const startY = Math.max(0, Math.floor(bbox.minY));
                const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        bandField[y * width + x] += tempGauss.eval(x, y);
                    }
                }
            }

            const gradientSq = computeGradientMagnitudeSquared(bandField, width, height);

            // Add small intensity component
            const intensityWeight = 0.1;
            for (let k = 0; k < gradientSq.length; k++) {
                gradientSq[k] += intensityWeight * (bandField[k] * bandField[k]);
            }

            const bandSigma = this.generator.sizeLevels[sizeLevel].sigma;
            const adaptiveSigmaE = bandSigma * this.params.sigma_E_ratio;

            energyFields[freqBand] = gaussianBlur2D(gradientSq, width, height, adaptiveSigmaE);
        }

        // Console logging omitted for batch performance
        this.cache.energyFields = energyFields;
        return energyFields;
    }

    computeAttributionWeights(energyFields, width, height) {
        const weights = {
            low: new Float32Array(width * height),
            mid: new Float32Array(width * height),
            high: new Float32Array(width * height)
        };

        const epsilon = 1e-10;

        for (let i = 0; i < width * height; i++) {
            const totalEnergy = energyFields.low[i] +
                energyFields.mid[i] +
                energyFields.high[i] +
                epsilon;

            weights.low[i] = energyFields.low[i] / totalEnergy;
            weights.mid[i] = energyFields.mid[i] / totalEnergy;
            weights.high[i] = energyFields.high[i] / totalEnergy;
        }

        this.cache.attributionWeights = weights;
        return weights;
    }

    generateGatingMasks(attributionWeights, width, height) {
        const masks = {
            low: new Float32Array(width * height),
            mid: new Float32Array(width * height),
            high: new Float32Array(width * height)
        };

        for (const band of ['low', 'mid', 'high']) {
            const smoothed = new Float32Array(width * height);

            for (let i = 0; i < width * height; i++) {
                smoothed[i] = smoothstep(
                    attributionWeights[band][i],
                    this.params.tau_low,
                    this.params.tau_high
                );
            }

            const freqToSize = { 'low': 'large', 'mid': 'medium', 'high': 'small' };
            const sizeLevel = freqToSize[band];
            const bandSigma = this.generator.sizeLevels[sizeLevel].sigma;

            const adaptiveSigmaM = bandSigma * this.params.sigma_m_ratio;

            masks[band] = gaussianBlur2D(smoothed, width, height, adaptiveSigmaM);
        }

        this.cache.gatingMasks = masks;
        return masks;
    }

    applyGatedPerturbation(originalField, originalBands, perturbedBands, masks, width, height) {
        const mode = this.params.perturbationMode;
        const result = new Float32Array(originalField);

        const effectiveMasks = this.computeEffectiveMasks(masks, width, height, mode);

        for (const band of ['low', 'mid', 'high']) {
            const lambda = this.params.lambda[band];

            if (lambda === 0) continue;

            let deltaField = new Float32Array(width * height);
            for (let i = 0; i < width * height; i++) {
                deltaField[i] = perturbedBands[band][i] - originalBands[band][i];
            }

            const freqToSize = { 'low': 'large', 'mid': 'medium', 'high': 'small' };
            const sizeLevel = freqToSize[band];
            const bandSigma = this.generator.sizeLevels[sizeLevel].sigma;
            const adaptiveSigmaDelta = bandSigma * this.params.sigma_Delta_ratio;

            if (adaptiveSigmaDelta > 0) {
                deltaField = gaussianBlur2D(deltaField, width, height, adaptiveSigmaDelta);
            }

            for (let i = 0; i < width * height; i++) {
                const delta = deltaField[i];
                const gated = lambda * effectiveMasks[band][i] * delta;
                result[i] += gated;
            }
        }

        return result;
    }

    computeEffectiveMasks(masks, width, height, mode) {
        const size = width * height;
        const effectiveMasks = {
            low: new Float32Array(size),
            mid: new Float32Array(size),
            high: new Float32Array(size)
        };

        if (mode === 'strict') {
            effectiveMasks.low = new Float32Array(masks.low);
            effectiveMasks.mid = new Float32Array(masks.mid);
            effectiveMasks.high = new Float32Array(masks.high);
        } else if (mode === 'cascading') {
            for (let i = 0; i < size; i++) {
                effectiveMasks.high[i] = 1.0;
                effectiveMasks.mid[i] = Math.min(1.0, masks.mid[i] + masks.low[i]);
                effectiveMasks.low[i] = masks.low[i];
            }
        } else {
            // Default/Fallback
            effectiveMasks.low = new Float32Array(masks.low);
            effectiveMasks.mid = new Float32Array(masks.mid);
            effectiveMasks.high = new Float32Array(masks.high);
        }

        return effectiveMasks;
    }

    renderBandField(sizeLevel, width, height, useOriginal = false) {
        const gaussians = this.generator.getAllGaussians().filter(g => g.sizeLevel === sizeLevel);
        const field = new Float32Array(width * height);

        const weight = this.generator.bandWeights ? (this.generator.bandWeights[sizeLevel] || 1.0) : 1.0;
        const exponent = this.generator.exponent !== undefined ? this.generator.exponent : 1.0;

        for (const gauss of gaussians) {
            // Logic matching js/softAttributionPerturbation.js and taking exponent/weight into account
            if (useOriginal) {
                const tempGauss = new BiGauss(
                    gauss.originalMX, gauss.originalMY,
                    gauss.originalSX, gauss.originalSY,
                    gauss.originalRho, gauss.originalScaler
                );

                const maxSigma = Math.max(gauss.originalSX, gauss.originalSY);
                const range = maxSigma * 3;
                const startX = Math.max(0, Math.floor(gauss.originalMX - range));
                const endX = Math.min(width - 1, Math.ceil(gauss.originalMX + range));
                const startY = Math.max(0, Math.floor(gauss.originalMY - range));
                const endY = Math.min(height - 1, Math.ceil(gauss.originalMY + range));

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        let val = tempGauss.eval(x, y);
                        val *= weight;
                        if (exponent !== 1.0) val = Math.pow(val, exponent);
                        field[y * width + x] += val;
                    }
                }
            } else {
                const bbox = gauss.getBoundingBox(3);
                const startX = Math.max(0, Math.floor(bbox.minX));
                const endX = Math.min(width - 1, Math.ceil(bbox.maxX));
                const startY = Math.max(0, Math.floor(bbox.minY));
                const endY = Math.min(height - 1, Math.ceil(bbox.maxY));

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        let val = gauss.eval(x, y);
                        val *= weight;
                        if (exponent !== 1.0) val = Math.pow(val, exponent);
                        field[y * width + x] += val;
                    }
                }
            }
        }

        return field;
    }

    performGatedPerturbation(width, height) {
        const originalTotal = this.generator.renderTo1DArray(width, height, true, false);

        const originalBands = {
            low: this.renderBandField('large', width, height, true),
            mid: this.renderBandField('medium', width, height, true),
            high: this.renderBandField('small', width, height, true)
        };

        const perturbedBands = {
            low: this.renderBandField('large', width, height, false),
            mid: this.renderBandField('medium', width, height, false),
            high: this.renderBandField('small', width, height, false)
        };

        const energyFields = this.computeGradientEnergyFields(width, height);
        const attributionWeights = this.computeAttributionWeights(energyFields, width, height);
        const gatingMasks = this.generateGatingMasks(attributionWeights, width, height);

        const perturbedTotal = this.applyGatedPerturbation(
            originalTotal,
            originalBands,
            perturbedBands,
            gatingMasks,
            width,
            height
        );

        return {
            originalTotal,
            perturbedTotal,
            originalBands,
            perturbedBands,
            energyFields,
            attributionWeights,
            gatingMasks
        };
    }
}

// ============================================================================
// BatchGenerator Class - Main Logic
// ============================================================================

class BatchGenerator {
    constructor(config) {
        this.config = config;
        this.generator = new GaussianGenerator(config.width, config.height);
        this.perturbation = new PerturbationSystem(this.generator);
        this.softAttribution = new SoftAttributionPerturbation(this.generator);

        this.generatedData = [];

        this.setupGeneratorParameters();
    }

    setupGeneratorParameters() {
        this.generator.sizeLevels = this.config.sizeLevels;
        this.generator.setBandWeight('small', this.config.mixingParameters.weightHigh);
        this.generator.setBandWeight('medium', this.config.mixingParameters.weightMid);
        this.generator.setBandWeight('large', this.config.mixingParameters.weightLow);
        this.generator.setExponent(this.config.mixingParameters.exponent);

        this.perturbation.setCoefficients(this.config.perturbationCoefficients);
        this.softAttribution.setParams(this.config.softAttributionParams);
    }

    async generateBatch() {
        console.log('Starting batch generation...');

        const frequencies = [
            { id: 'low', name: 'Low Complexity', target: 'large' },
            { id: 'medium', name: 'Medium Complexity', target: 'medium' },
            { id: 'high', name: 'High Complexity', target: 'small' }
        ];

        const mode = this.config.generationMode;
        let targets = [];

        if (mode === 'magnitude') {
            targets = this.config.magnitudes;
        } else {
            const config = this.config[mode];
            const start = config.start;
            const end = config.end;
            const step = Math.abs(config.step);

            if (start <= end) {
                for (let v = start; v <= end + 0.000001; v += step) targets.push(v);
            } else {
                for (let v = start; v >= end - 0.000001; v -= step) targets.push(v);
            }

            targets = targets.map(v => parseFloat(v.toFixed(5)));
        }

        console.log(`Generating ${frequencies.length} frequencies × ${targets.length} targets × ${this.config.repetitions} repetitions = ${frequencies.length * targets.length * this.config.repetitions} stimuli`);

        let totalGenerated = 0;
        const totalToGenerate = frequencies.length * targets.length * this.config.repetitions;

        // Generate by repetition groups: rep1 (all freq/ssim), rep2 (all freq/ssim), ...
        for (let rep = 1; rep <= this.config.repetitions; rep++) {
            console.log(`\n=== Starting Repetition ${rep}/${this.config.repetitions} ===`);

            for (const freq of frequencies) {
                if (!this.config.frequencies.includes(freq.id)) {
                    continue;
                }

                for (const targetVal of targets) {
                    await this.createStimulus(freq, targetVal, rep, mode, totalGenerated);
                    totalGenerated++;

                    if (totalGenerated % 10 === 0) {
                        console.log(`Progress: ${totalGenerated}/${totalToGenerate} (${Math.round(totalGenerated / totalToGenerate * 100)}%)`);
                    }

                    // Save checkpoint JSON every 100 stimuli (disabled - images already saved)
                    // if (totalGenerated % 100 === 0) {
                    //     await this.saveCheckpointJSON();
                    // }
                }
            }

            console.log(`Completed Repetition ${rep}/${this.config.repetitions}`);
        }

        console.log(`Batch generation complete! Generated ${this.generatedData.length} stimuli.`);
    }

    async createStimulus(freq, targetVal, repetition, mode, stimulusIndex) {
        this.generator.updateDimensions(this.config.width, this.config.height);
        this.generator.generateAll();

        const dataOriginalRaw = this.generator.renderTo1DArray(this.config.width, this.config.height, false, true);
        const dataOriginal = normalize(dataOriginalRaw);

        let chosenMagnitude = targetVal;
        let achievedMetric = 0;
        let achievedKL = 0;
        let achievedSSIM = 0;
        let dataPerturbed = null;
        let dataPerturbedRaw = null;
        let bestOverallData = null; // Fix: Hoist variable to outer scope

        if (mode === 'magnitude') {
            this.perturbation.resetToOriginal();
            this.perturbation.applyGlobalPerturbation(targetVal, 1.0, freq.target, 'all');

            const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
            dataPerturbedRaw = saResult.perturbedTotal;
            dataPerturbed = normalize(dataPerturbedRaw);

            achievedSSIM = calculateSSIM(dataOriginal, dataPerturbed, this.config.width, this.config.height);
            achievedKL = calculateKLDivergence(dataOriginal, dataPerturbed);

        } else {
            const tolerance = 0.0001;
            const maxRetries = 10;
            const maxIterPerTry = 80;

            let bestOverallDiff = Infinity;
            let bestOverallMagnitude = 0;
            // let bestOverallData = null; // Removed shadowed declaration
            let bestOverallMetric = 0;
            let bestOverallSSIM = 0;
            let bestOverallKL = 0;
            let foundGoodResult = false;

            for (let retry = 0; retry < maxRetries && !foundGoodResult; retry++) {
                this.perturbation.resetToOriginal();
                // For retries > 0, we might want to re-shuffle or just re-generate deltas
                if (retry > 0) {
                    // console.log(`Retry ${retry}...`);
                }

                this.perturbation.setCoefficients(this.config.perturbationCoefficients);
                this.perturbation.generatePerturbationDeltas(freq.target, 1.0, 'all');

                // Adaptive max magnitude: large gaussians need higher values (matched with stimuli_gallery.js)
                const maxMagnitude = (freq.target === 'large') ? 8.0 : 5.0;
                let min = 0.0, max = maxMagnitude;

                for (let i = 0; i < maxIterPerTry; i++) {
                    const mid = (min + max) / 2;

                    this.perturbation.applyStoredPerturbation(mid);

                    const saResult = this.softAttribution.performGatedPerturbation(this.config.width, this.config.height);
                    const tempPerturbedRaw = saResult.perturbedTotal;
                    const tempPerturbed = normalize(tempPerturbedRaw);

                    let currentMetric = 0;
                    if (mode === 'ssim') {
                        currentMetric = calculateSSIM(dataOriginal, tempPerturbed, this.config.width, this.config.height);
                    } else {
                        currentMetric = calculateKLDivergence(dataOriginal, tempPerturbed);
                    }

                    const diff = Math.abs(currentMetric - targetVal);

                    if (diff < bestOverallDiff) {
                        bestOverallDiff = diff;
                        bestOverallMagnitude = mid;
                        bestOverallData = tempPerturbedRaw; // Keep raw data for saving/rendering logic if needed
                        bestOverallMetric = currentMetric;

                        if (mode === 'ssim') {
                            bestOverallSSIM = currentMetric;
                            bestOverallKL = calculateKLDivergence(dataOriginal, tempPerturbed);
                        } else {
                            bestOverallKL = currentMetric;
                            bestOverallSSIM = calculateSSIM(dataOriginal, tempPerturbed, this.config.width, this.config.height);
                        }
                    }

                    if (diff < tolerance) {
                        foundGoodResult = true;
                        break;
                    }

                    if (mode === 'ssim') {
                        if (currentMetric > targetVal) min = mid;
                        else max = mid;
                    } else {
                        if (currentMetric < targetVal) min = mid;
                        else max = mid;
                    }
                }

                if (foundGoodResult) break;
            }

            chosenMagnitude = bestOverallMagnitude;
            dataPerturbed = bestOverallData;
            achievedMetric = bestOverallMetric;
            achievedSSIM = bestOverallSSIM;
            achievedKL = bestOverallKL;

            if (!foundGoodResult) {
                console.warn(`Warning: Could not achieve tolerance for ${freq.id} target=${targetVal} rep=${repetition}. Best diff: ${bestOverallDiff.toFixed(6)}`);
                return;
            }
        }

        const stimulusData = {
            frequency: freq.id,
            frequencyName: freq.name,
            targetValue: targetVal,
            repetition: repetition,
            mode: mode,
            magnitude: chosenMagnitude,
            ssim: achievedSSIM,
            kl: achievedKL,
            dataOriginal: Array.from(dataOriginalRaw),
            dataPerturbed: Array.from(dataPerturbedRaw || bestOverallData), // Use Raw data for storage/images to preserve intensity info? Or normalized? 
            // WAIT: Stimuli gallery uses raw data effectively for rendering but metrics are normalized. 
            // Actually, renderTo1DArray returns raw. Batch saveCanvas normalizes internally. 
            // So we should save RAW data for maximum info.
            config: {
                width: this.config.width,
                height: this.config.height
            }
        };

        this.generatedData.push(stimulusData);

        // Log meaningful success message
        console.log(`[${freq.name} | ${mode.toUpperCase()} Target: ${targetVal.toFixed(4)}] -> Achieved: ${achievedMetric.toFixed(5)} (Mag: ${chosenMagnitude.toFixed(3)})`);

        // Save immediately if images are enabled
        if (this.config.exportOptions.saveImages) {
            await this.saveStimulusImages(stimulusData, stimulusIndex);
        }
    }

    async saveStimulusImages(stimulusData, index) {
        const imagesDir = path.join(this.config.outputDir, 'images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }

        const prefix = `${String(index + 1).padStart(4, '0')}_${stimulusData.frequency}_${stimulusData.mode}_${stimulusData.targetValue.toFixed(5)}_rep${stimulusData.repetition}`;

        await this.saveCanvas(stimulusData.dataOriginal, path.join(imagesDir, `${prefix}_original.png`));
        await this.saveCanvas(stimulusData.dataPerturbed, path.join(imagesDir, `${prefix}_perturbed.png`));

        const metadata = {
            frequency: stimulusData.frequency,
            frequencyName: stimulusData.frequencyName,
            targetValue: stimulusData.targetValue,
            repetition: stimulusData.repetition,
            mode: stimulusData.mode,
            magnitude: stimulusData.magnitude,
            ssim: stimulusData.ssim,
            kl: stimulusData.kl
        };
        fs.writeFileSync(path.join(imagesDir, `${prefix}_metadata.json`), JSON.stringify(metadata, null, 2));
    }

    async saveResults() {
        const outputDir = this.config.outputDir;

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        if (this.config.exportOptions.saveJSON) {
            await this.saveJSON(outputDir);
        }

        if (this.config.exportOptions.saveImages) {
            await this.saveImages(outputDir);
        }
    }

    async saveCheckpointJSON() {
        const outputDir = this.config.outputDir;
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save only metadata (without pixel data) to avoid string length limit
        const metadataOnly = this.generatedData.map(item => ({
            frequency: item.frequency,
            frequencyName: item.frequencyName,
            targetValue: item.targetValue,
            repetition: item.repetition,
            mode: item.mode,
            magnitude: item.magnitude,
            ssim: item.ssim,
            kl: item.kl,
            config: item.config
        }));

        const filename = path.join(outputDir, `checkpoint_${this.generatedData.length}.json`);
        fs.writeFileSync(filename, JSON.stringify(metadataOnly, null, 2));
        console.log(`  → Checkpoint saved: ${this.generatedData.length} stimuli`);
    }

    async saveJSON(outputDir) {
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = path.join(outputDir, `perturbation_data_${timestamp}.json`);

        fs.writeFileSync(filename, JSON.stringify(this.generatedData, null, 2));
        console.log(`Saved final JSON data to: ${filename}`);
    }

    async saveImages(outputDir) {
        // Images are already saved incrementally during generation
        // Just create the ZIP archive
        const imagesDir = path.join(outputDir, 'images');

        if (fs.existsSync(imagesDir)) {
            console.log(`All images already saved to: ${imagesDir}`);
            console.log(`Total: ${this.generatedData.length * 2} images + ${this.generatedData.length} metadata files`);
            await this.createZipArchive(imagesDir, outputDir);
        } else {
            console.log('No images directory found (saveImages was disabled).');
        }
    }

    async saveCanvas(data, filepath) {
        const width = this.config.width;
        const height = this.config.height;

        // Find max value for normalization
        let max = 0;
        for (let i = 0; i < data.length; i++) {
            max = Math.max(max, data[i]);
        }
        if (max === 0) max = 1;

        // Create RGBA buffer (4 channels)
        const buffer = Buffer.alloc(width * height * 4);

        for (let i = 0; i < data.length; i++) {
            const normalizedVal = data[i] / max;
            const [r, g, b] = getViridisColor(normalizedVal);

            const pixelIndex = i * 4;
            buffer[pixelIndex] = r;     // R
            buffer[pixelIndex + 1] = g; // G
            buffer[pixelIndex + 2] = b; // B
            buffer[pixelIndex + 3] = 255;  // A
        }

        // Use sharp to create PNG
        await sharp(buffer, {
            raw: {
                width: width,
                height: height,
                channels: 4
            }
        })
            .png()
            .toFile(filepath);
    }

    async createZipArchive(sourceDir, outputDir) {
        const timestamp = new Date().toISOString().slice(0, 10);
        const zipPath = path.join(outputDir, `perturbation_images_${timestamp}.zip`);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => {
                console.log(`Created ZIP archive: ${zipPath} (${archive.pointer()} bytes)`);
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);
            archive.directory(sourceDir, 'images');
            archive.finalize();
        });
    }
}

// ============================================================================
// Viridis Colormap
// ============================================================================

// Viridis colormap lookup table (256 colors)
const VIRIDIS_COLORMAP = [
    [68, 1, 84], [68, 2, 86], [69, 4, 87], [69, 5, 89], [70, 7, 90], [70, 8, 92], [70, 10, 93], [70, 11, 94],
    [71, 13, 96], [71, 14, 97], [71, 16, 99], [71, 17, 100], [71, 19, 101], [72, 20, 103], [72, 22, 104], [72, 23, 105],
    [72, 24, 106], [72, 26, 108], [72, 27, 109], [72, 28, 110], [72, 29, 111], [72, 31, 112], [72, 32, 113], [72, 33, 115],
    [72, 35, 116], [72, 36, 117], [72, 37, 118], [72, 38, 119], [72, 40, 120], [72, 41, 121], [71, 42, 122], [71, 44, 122],
    [71, 45, 123], [71, 46, 124], [71, 47, 125], [70, 48, 126], [70, 50, 126], [70, 51, 127], [70, 52, 128], [69, 53, 129],
    [69, 55, 129], [69, 56, 130], [68, 57, 131], [68, 58, 131], [68, 59, 132], [67, 61, 132], [67, 62, 133], [66, 63, 133],
    [66, 64, 134], [66, 65, 134], [65, 66, 135], [65, 68, 135], [64, 69, 136], [64, 70, 136], [63, 71, 136], [63, 72, 137],
    [62, 73, 137], [62, 74, 137], [62, 76, 138], [61, 77, 138], [61, 78, 138], [60, 79, 138], [60, 80, 139], [59, 81, 139],
    [59, 82, 139], [58, 83, 139], [58, 84, 140], [57, 85, 140], [57, 86, 140], [56, 88, 140], [56, 89, 140], [55, 90, 140],
    [55, 91, 141], [54, 92, 141], [54, 93, 141], [53, 94, 141], [53, 95, 141], [52, 96, 141], [52, 97, 141], [51, 98, 141],
    [51, 99, 141], [50, 100, 142], [50, 101, 142], [49, 102, 142], [49, 103, 142], [49, 104, 142], [48, 105, 142], [48, 106, 142],
    [47, 107, 142], [47, 108, 142], [46, 109, 142], [46, 110, 142], [46, 111, 142], [45, 112, 142], [45, 113, 142], [44, 113, 142],
    [44, 114, 142], [44, 115, 142], [43, 116, 142], [43, 117, 142], [42, 118, 142], [42, 119, 142], [42, 120, 142], [41, 121, 142],
    [41, 122, 142], [41, 123, 142], [40, 124, 142], [40, 125, 142], [39, 126, 142], [39, 127, 142], [39, 128, 142], [38, 129, 142],
    [38, 130, 142], [38, 130, 142], [37, 131, 142], [37, 132, 142], [37, 133, 142], [36, 134, 142], [36, 135, 142], [35, 136, 142],
    [35, 137, 142], [35, 138, 141], [34, 139, 141], [34, 140, 141], [34, 141, 141], [33, 142, 141], [33, 143, 141], [33, 144, 141],
    [33, 145, 140], [32, 146, 140], [32, 146, 140], [32, 147, 140], [31, 148, 140], [31, 149, 139], [31, 150, 139], [31, 151, 139],
    [31, 152, 139], [31, 153, 138], [31, 154, 138], [30, 155, 138], [30, 156, 137], [30, 157, 137], [31, 158, 137], [31, 159, 136],
    [31, 160, 136], [31, 161, 136], [31, 161, 135], [31, 162, 135], [32, 163, 134], [32, 164, 134], [33, 165, 133], [33, 166, 133],
    [34, 167, 133], [34, 168, 132], [35, 169, 131], [36, 170, 131], [37, 171, 130], [37, 172, 130], [38, 173, 129], [39, 173, 129],
    [40, 174, 128], [41, 175, 127], [42, 176, 127], [44, 177, 126], [45, 178, 125], [46, 179, 124], [47, 180, 124], [49, 181, 123],
    [50, 182, 122], [52, 182, 121], [53, 183, 121], [55, 184, 120], [56, 185, 119], [58, 186, 118], [59, 187, 117], [61, 188, 116],
    [63, 188, 115], [64, 189, 114], [66, 190, 113], [68, 191, 112], [70, 192, 111], [72, 193, 110], [74, 193, 109], [76, 194, 108],
    [78, 195, 107], [80, 196, 106], [82, 197, 105], [84, 197, 104], [86, 198, 103], [88, 199, 101], [90, 200, 100], [92, 200, 99],
    [94, 201, 98], [96, 202, 96], [99, 203, 95], [101, 203, 94], [103, 204, 92], [105, 205, 91], [108, 205, 90], [110, 206, 88],
    [112, 207, 87], [115, 208, 86], [117, 208, 84], [119, 209, 83], [122, 209, 81], [124, 210, 80], [127, 211, 78], [129, 211, 77],
    [132, 212, 75], [134, 213, 73], [137, 213, 72], [139, 214, 70], [142, 214, 69], [144, 215, 67], [147, 215, 65], [149, 216, 64],
    [152, 216, 62], [155, 217, 60], [157, 217, 59], [160, 218, 57], [162, 218, 55], [165, 219, 54], [168, 219, 52], [170, 220, 50],
    [173, 220, 48], [176, 221, 47], [178, 221, 45], [181, 222, 43], [184, 222, 41], [186, 222, 40], [189, 223, 38], [192, 223, 37],
    [194, 223, 35], [197, 224, 33], [200, 224, 32], [202, 225, 31], [205, 225, 29], [208, 225, 28], [210, 226, 27], [213, 226, 26],
    [216, 226, 25], [218, 227, 25], [221, 227, 24], [223, 227, 24], [226, 228, 24], [229, 228, 25], [231, 228, 25], [234, 229, 26],
    [236, 229, 27], [239, 229, 28], [241, 229, 29], [244, 230, 30], [246, 230, 32], [248, 230, 33], [251, 231, 35], [253, 231, 37]
];

function getViridisColor(normalizedValue) {
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));
    const index = Math.floor(clampedValue * (VIRIDIS_COLORMAP.length - 1));
    return VIRIDIS_COLORMAP[index];
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    let configPath = 'config.json';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--config' && i + 1 < args.length) {
            configPath = args[i + 1];
        }
    }

    if (!fs.existsSync(configPath)) {
        console.error(`Configuration file not found: ${configPath}`);
        console.log('Usage: node batch_generate.js --config <config.json>');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    console.log('='.repeat(70));
    console.log('Gaussian Perturbation Batch Generator');
    console.log('='.repeat(70));
    console.log(`Configuration: ${configPath}`);
    console.log(`Output Directory: ${config.outputDir}`);
    console.log(`Generation Mode: ${config.generationMode}`);
    console.log(`Canvas Size: ${config.width}×${config.height}`);
    console.log(`Repetitions: ${config.repetitions}`);
    console.log('='.repeat(70));

    const generator = new BatchGenerator(config);

    const startTime = Date.now();
    await generator.generateBatch();
    await generator.saveResults();
    const endTime = Date.now();

    const duration = (endTime - startTime) / 1000;
    console.log('='.repeat(70));
    console.log(`Batch generation completed in ${duration.toFixed(2)} seconds`);
    console.log(`Total stimuli generated: ${generator.generatedData.length}`);
    console.log('='.repeat(70));
}

if (require.main === module) {
    main().catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
}

module.exports = { BatchGenerator };
