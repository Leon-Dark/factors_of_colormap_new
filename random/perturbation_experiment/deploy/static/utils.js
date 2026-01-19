/**
 * 工具函数集合
 * Utility Functions Collection
 */

/**
 * 扩展 biGauss 原型：添加 getBoundingBox 方法
 */
if (typeof biGauss !== 'undefined') {
    biGauss.prototype.getBoundingBox = function (sigmaMultiplier = 3) {
        const rangeX = this.sX * sigmaMultiplier;
        const rangeY = this.sY * sigmaMultiplier;

        return {
            minX: this.mX - rangeX,
            maxX: this.mX + rangeX,
            minY: this.mY - rangeY,
            maxY: this.mY + rangeY
        };
    };
}

/**
 * 生成随机数（指定范围）
 */
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * 将值限制在指定范围内
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 计算两点之间的距离
 */
function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * 计算高斯分布的短轴最小像素宽度
 * @param {number} sX - sigma X
 * @param {number} sY - sigma Y
 * @param {number} rho - 相关系数
 * @returns {number} 短轴在1个sigma处的像素宽度 (直径 = 2 * 半径)
 */
function calculateGaussianMinShortAxis(sX, sY, rho) {
    // 协方差矩阵的特征值计算
    // Lambda_min = (sx^2 + sy^2 - sqrt((sx^2-sy^2)^2 + 4*(rho*sx*sy)^2)) / 2
    // 短轴半径 (sigma_min) = sqrt(Lambda_min)

    if (Math.abs(rho) > 0.999) return 0; // 几乎是一条线

    const varX = sX * sX;
    const varY = sY * sY;
    const covXY = rho * sX * sY;

    const term1 = varX + varY;
    const term2 = Math.sqrt(Math.pow(varX - varY, 2) + 4 * covXY * covXY);

    const lambdaMin = (term1 - term2) / 2;

    // 如果计算误差导致略小于0，取0
    const sigmaMin = Math.sqrt(Math.max(0, lambdaMin));

    // 返回直径 (2 * sigma)
    return 2 * sigmaMin;
}

/**
 * Smoothstep 函数（平滑阶跃）
 * @param {number} x - 输入值
 * @param {number} edge0 - 下边界
 * @param {number} edge1 - 上边界
 * @returns {number} 平滑插值结果 [0, 1]
 */
function smoothstep(x, edge0 = 0.3, edge1 = 0.7) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * 生成1D高斯核
 * @param {number} sigma - 标准差
 * @returns {Float32Array} 高斯核
 */
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

    // 归一化
    for (let i = 0; i < kernelSize; i++) {
        kernel[i] /= sum;
    }

    return kernel;
}

/**
 * 1D卷积（水平或垂直）
 * @param {Float32Array} field - 2D场（按行优先存储）
 * @param {number} width - 场宽度
 * @param {number} height - 场高度
 * @param {Float32Array} kernel - 1D卷积核
 * @param {string} direction - 'horizontal' 或 'vertical'
 * @returns {Float32Array} 卷积结果
 */
function convolve1D(field, width, height, kernel, direction) {
    const result = new Float32Array(width * height);
    const halfKernel = Math.floor(kernel.length / 2);

    if (direction === 'horizontal') {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                for (let k = 0; k < kernel.length; k++) {
                    const sx = x + k - halfKernel;
                    if (sx >= 0 && sx < width) {
                        sum += field[y * width + sx] * kernel[k];
                    }
                }
                result[y * width + x] = sum;
            }
        }
    } else { // vertical
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                for (let k = 0; k < kernel.length; k++) {
                    const sy = y + k - halfKernel;
                    if (sy >= 0 && sy < height) {
                        sum += field[sy * width + x] * kernel[k];
                    }
                }
                result[y * width + x] = sum;
            }
        }
    }

    return result;
}

/**
 * 2D高斯模糊（分离卷积）
 * @param {Float32Array} field - 2D场
 * @param {number} width - 场宽度
 * @param {number} height - 场高度
 * @param {number} sigma - 高斯标准差
 * @returns {Float32Array} 模糊后的场
 */
function gaussianBlur2D(field, width, height, sigma) {
    if (sigma <= 0) return new Float32Array(field);

    const kernel = makeGaussianKernel(sigma);
    const temp = convolve1D(field, width, height, kernel, 'horizontal');
    return convolve1D(temp, width, height, kernel, 'vertical');
}

/**
 * 计算2D场的梯度幅值平方
 * @param {Float32Array} field - 2D场
 * @param {number} width - 场宽度
 * @param {number} height - 场高度
 * @returns {Float32Array} 梯度幅值平方场
 */
function computeGradientMagnitudeSquared(field, width, height) {
    const gradientSq = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            // x方向梯度（中心差分）
            let gradX = 0;
            if (x > 0 && x < width - 1) {
                gradX = (field[y * width + (x + 1)] - field[y * width + (x - 1)]) / 2;
            } else if (x === 0 && width > 1) {
                gradX = field[y * width + 1] - field[y * width];
            } else if (x === width - 1 && width > 1) {
                gradX = field[y * width + x] - field[y * width + (x - 1)];
            }

            // y方向梯度（中心差分）
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

/**
 * 归一化数组
 */
function normalizeArray(arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min;

    if (range === 0) return arr.map(() => 0);

    return arr.map(v => (v - min) / range);
}

/**
 * 创建2D数组
 */
function create2DArray(width, height, defaultValue = 0) {
    return Array(height).fill(null).map(() => Array(width).fill(defaultValue));
}

/**
 * 计算SSIM (简化版本)
 * 结构相似性指数
 * 动态计算c1和c2基于实际数据范围
 */
function calculateSSIM(img1, img2, width, height) {
    if (img1.length !== img2.length) {
        console.error('Image dimensions do not match');
        return 0;
    }

    // // 动态计算数据范围L
    let maxVal = 0;

    for (let i = 0; i < img1.length; i++) {
        maxVal = Math.max(maxVal, img1[i], img2[i]);
    }

    // 如果数据范围为0，说明图像完全相同
    if (maxVal === 0) return 1.0;

    // 使用动态范围计算常数
    const L = maxVal;

    const k1 = 0.01;
    const k2 = 0.03;
    const c1 = (k1 * L) * (k1 * L);
    const c2 = (k2 * L) * (k2 * L);

    // 计算均值
    let mean1 = 0, mean2 = 0;
    for (let i = 0; i < img1.length; i++) {
        mean1 += img1[i];
        mean2 += img2[i];
    }
    mean1 /= img1.length;
    mean2 /= img2.length;

    // 计算方差和协方差
    let var1 = 0, var2 = 0, covar = 0;
    for (let i = 0; i < img1.length; i++) {
        const diff1 = img1[i] - mean1;
        const diff2 = img2[i] - mean2;
        var1 += diff1 * diff1;
        var2 += diff2 * diff2;
        covar += diff1 * diff2;
    }
    var1 /= img1.length;
    var2 /= img2.length;
    covar /= img1.length;

    // 计算SSIM
    const numerator = (2 * mean1 * mean2 + c1) * (2 * covar + c2);
    const denominator = (mean1 * mean1 + mean2 * mean2 + c1) * (var1 + var2 + c2);

    return numerator / denominator;
}

/**
 * 计算KL散度 (Kullback-Leibler Divergence)
 * D_KL(P || Q) = sum(P(i) * log(P(i) / Q(i)))
 * P: 真实分布 (Original)
 * Q: 近似分布 (Perturbed)
 * 注意：输入数据会被当作概率分布处理（先加epsilon再归一化）
 */
function calculateKLDivergence(imgP, imgQ) {
    if (imgP.length !== imgQ.length) return Infinity;

    // 极小值epsilon避免log(0)和除以0
    const epsilon = 1e-10;

    // 1. 先加epsilon，再计算总和
    let sumP = 0, sumQ = 0;
    for (let i = 0; i < imgP.length; i++) {
        sumP += imgP[i] + epsilon;
        sumQ += imgQ[i] + epsilon;
    }

    if (sumP === 0 || sumQ === 0) return 0; // 避免除零

    // 2. 计算KL散度
    let kl = 0;
    for (let i = 0; i < imgP.length; i++) {
        const p = (imgP[i] + epsilon) / sumP;
        const q = (imgQ[i] + epsilon) / sumQ;

        kl += p * Math.log(p / q);
    }

    return kl;
}

/**
 * 导出为JSON
 */
function exportToJSON(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

/**
 * 导出canvas为图片
 */
function exportCanvasAsImage(canvas, filename) {
    canvas.toBlob(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });
}

/**
 * 获取所有可用的 colormap 列表
 */
function getAvailableColormaps() {
    return [
        { value: 'viridis', name: 'Viridis' },
        { value: 'plasma', name: 'Plasma' },
        { value: 'inferno', name: 'Inferno' },
        { value: 'magma', name: 'Magma' },
        { value: 'turbo', name: 'Turbo' },
        { value: 'rainbow', name: 'Rainbow' },
        { value: 'jet', name: 'Jet' },
        { value: 'hot', name: 'Hot' },
        { value: 'cool', name: 'Cool' },
        { value: 'coolwarm', name: 'Cool-Warm' },
        { value: 'grayscale', name: 'Grayscale' }
    ];
}

/**
 * 颜色映射 - 将标量值映射到颜色
 * 优先使用预设的 colormap，如果没有则回退到内置实现
 */
function valueToColor(value, colormap = 'viridis') {
    // 确保值在0-1之间
    value = clamp(value, 0, 1);

    // 尝试使用预设的 colormap
    if (typeof getColormapFunction !== 'undefined' && typeof COLORMAP_PRESETS !== 'undefined') {
        if (COLORMAP_PRESETS[colormap]) {
            const colormapFunc = getColormapFunction(colormap);
            return colormapFunc(value);
        }
    }

    // 回退到内置实现
    switch (colormap) {
        case 'cool':
            return coolColormap(value);
        case 'grayscale':
            const gray = Math.floor(value * 255);
            return [gray, gray, gray, 255];
        default:
            // 如果都没有，使用 viridis 的内置实现
            if (COLORMAP_PRESETS && COLORMAP_PRESETS['viridis']) {
                const colormapFunc = getColormapFunction('viridis');
                return colormapFunc(value);
            }
            return viridisColormap(value);
    }
}

/**
 * Viridis颜色映射
 */
function viridisColormap(t) {
    const colors = [
        [68, 1, 84],
        [72, 40, 120],
        [62, 73, 137],
        [49, 104, 142],
        [38, 130, 142],
        [31, 158, 137],
        [53, 183, 121],
        [110, 206, 88],
        [181, 222, 43],
        [253, 231, 37]
    ];

    const index = t * (colors.length - 1);
    const i = Math.floor(index);
    const f = index - i;

    if (i >= colors.length - 1) {
        return [...colors[colors.length - 1], 255];
    }

    const c1 = colors[i];
    const c2 = colors[i + 1];

    return [
        Math.floor(c1[0] + f * (c2[0] - c1[0])),
        Math.floor(c1[1] + f * (c2[1] - c1[1])),
        Math.floor(c1[2] + f * (c2[2] - c1[2])),
        255
    ];
}

/**
 * Plasma颜色映射
 */
function plasmaColormap(t) {
    const colors = [
        [13, 8, 135],
        [75, 3, 161],
        [125, 3, 168],
        [168, 34, 150],
        [203, 70, 121],
        [229, 107, 93],
        [248, 148, 65],
        [253, 195, 40],
        [240, 249, 33]
    ];

    const index = t * (colors.length - 1);
    const i = Math.floor(index);
    const f = index - i;

    if (i >= colors.length - 1) {
        return [...colors[colors.length - 1], 255];
    }

    const c1 = colors[i];
    const c2 = colors[i + 1];

    return [
        Math.floor(c1[0] + f * (c2[0] - c1[0])),
        Math.floor(c1[1] + f * (c2[1] - c1[1])),
        Math.floor(c1[2] + f * (c2[2] - c1[2])),
        255
    ];
}

/**
 * Hot颜色映射
 */
function hotColormap(t) {
    if (t < 0.375) {
        return [Math.floor(t / 0.375 * 255), 0, 0, 255];
    } else if (t < 0.75) {
        return [255, Math.floor((t - 0.375) / 0.375 * 255), 0, 255];
    } else {
        return [255, 255, Math.floor((t - 0.75) / 0.25 * 255), 255];
    }
}

/**
 * Cool颜色映射
 */
function coolColormap(t) {
    return [
        Math.floor(t * 255),
        Math.floor((1 - t) * 255),
        255,
        255
    ];
}

/**
 * 计算直方图
 */
function computeHistogram(data, bins = 256) {
    const hist = new Array(bins).fill(0);
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    if (range === 0) return hist;

    for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - min) / range;
        const bin = Math.min(bins - 1, Math.floor(normalized * bins));
        hist[bin]++;
    }

    return hist;
}

/**
 * 平滑数据（简单移动平均）
 */
function smoothData(data, windowSize = 3) {
    const result = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;

        for (let j = -halfWindow; j <= halfWindow; j++) {
            const index = i + j;
            if (index >= 0 && index < data.length) {
                sum += data[index];
                count++;
            }
        }

        result.push(sum / count);
    }

    return result;
}

/**
 * 格式化数字
 */
function formatNumber(num, decimals = 2) {
    return Number(num).toFixed(decimals);
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Inferno颜色映射
 */
function infernoColormap(t) {
    const colors = [
        [0, 0, 4],
        [40, 11, 84],
        [101, 21, 110],
        [159, 42, 99],
        [212, 72, 66],
        [245, 125, 21],
        [250, 193, 39],
        [252, 255, 164]
    ];
    return interpolateColors(t, colors);
}

/**
 * Magma颜色映射
 */
function magmaColormap(t) {
    const colors = [
        [0, 0, 4],
        [28, 16, 68],
        [79, 18, 123],
        [129, 37, 129],
        [181, 54, 122],
        [229, 80, 100],
        [251, 136, 97],
        [254, 194, 135],
        [252, 253, 191]
    ];
    return interpolateColors(t, colors);
}

/**
 * Turbo颜色映射
 */
function turboColormap(t) {
    const colors = [
        [48, 18, 59],
        [62, 96, 155],
        [33, 145, 140],
        [92, 200, 99],
        [253, 231, 37],
        [252, 148, 56],
        [227, 26, 28],
        [189, 0, 38],
        [122, 4, 3]
    ];
    return interpolateColors(t, colors);
}

/**
 * Rainbow颜色映射
 */
function rainbowColormap(t) {
    const colors = [
        [150, 0, 90],
        [0, 0, 200],
        [0, 25, 255],
        [0, 152, 255],
        [44, 255, 150],
        [151, 255, 0],
        [255, 234, 0],
        [255, 111, 0],
        [255, 0, 0]
    ];
    return interpolateColors(t, colors);
}

/**
 * Jet颜色映射
 */
function jetColormap(t) {
    const colors = [
        [0, 0, 131],
        [0, 60, 170],
        [5, 255, 255],
        [255, 255, 0],
        [250, 0, 0],
        [128, 0, 0]
    ];
    return interpolateColors(t, colors);
}

/**
 * Cool-Warm颜色映射
 */
function coolwarmColormap(t) {
    const colors = [
        [59, 76, 192],
        [144, 178, 254],
        [220, 220, 220],
        [245, 156, 125],
        [180, 4, 38]
    ];
    return interpolateColors(t, colors);
}

/**
 * 颜色插值辅助函数
 */
function interpolateColors(t, colors) {
    const index = t * (colors.length - 1);
    const i = Math.floor(index);
    const f = index - i;

    if (i >= colors.length - 1) {
        return [...colors[colors.length - 1], 255];
    }

    const c1 = colors[i];
    const c2 = colors[i + 1];

    return [
        Math.floor(c1[0] + f * (c2[0] - c1[0])),
        Math.floor(c1[1] + f * (c2[1] - c1[1])),
        Math.floor(c1[2] + f * (c2[2] - c1[2])),
        255
    ];
}
