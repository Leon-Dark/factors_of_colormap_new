/**
 * 工具函数集合
 * Utility Functions Collection
 */

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
 */
function calculateSSIM(img1, img2, width, height) {
    if (img1.length !== img2.length) {
        console.error('Image dimensions do not match');
        return 0;
    }
    
    const c1 = 0.01 * 0.01;
    const c2 = 0.03 * 0.03;
    
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
    canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });
}

/**
 * 颜色映射 - 将标量值映射到颜色
 */
function valueToColor(value, colormap = 'viridis') {
    // 确保值在0-1之间
    value = clamp(value, 0, 1);
    
    switch(colormap) {
        case 'viridis':
            return viridisColormap(value);
        case 'plasma':
            return plasmaColormap(value);
        case 'hot':
            return hotColormap(value);
        case 'cool':
            return coolColormap(value);
        case 'grayscale':
            const gray = Math.floor(value * 255);
            return [gray, gray, gray, 255];
        default:
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
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
