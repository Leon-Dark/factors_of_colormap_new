/**
 * Colormap Presets - 从实验界面复用
 * 简化版本，只包含 colormap 定义和核心功能
 */

// 预定义的 colormap 配色方案
var COLORMAP_PRESETS = {
    viridis: [
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
    ],
    
    plasma: [
        [13, 8, 135],
        [75, 3, 161],
        [125, 3, 168],
        [168, 34, 150],
        [203, 70, 121],
        [229, 107, 93],
        [248, 148, 65],
        [253, 195, 40],
        [240, 249, 33]
    ],
    
    coolwarm: [
        [59, 76, 192],
        [144, 178, 254],
        [220, 220, 220],
        [245, 156, 125],
        [180, 4, 38]
    ],
    
    rainbow: [
        [150, 0, 90],
        [0, 0, 200],
        [0, 25, 255],
        [0, 152, 255],
        [44, 255, 150],
        [151, 255, 0],
        [255, 234, 0],
        [255, 111, 0],
        [255, 0, 0]
    ],
    
    jet: [
        [0, 0, 131],
        [0, 60, 170],
        [5, 255, 255],
        [255, 255, 0],
        [250, 0, 0],
        [128, 0, 0]
    ],
    
    hot: [
        [0, 0, 0],
        [255, 0, 0],
        [255, 255, 0],
        [255, 255, 255]
    ],
    
    turbo: [
        [48,18,59],
        [62,96,155],
        [33,145,140],
        [92,200,99],
        [253,231,37],
        [252,148,56],
        [227,26,28],
        [189,0,38],
        [122,4,3]
    ],
    
    spectral: [
        [94,79,162],
        [50,136,189],
        [102,194,165],
        [171,221,164],
        [230,245,152],
        [255,255,191],
        [254,224,139],
        [253,174,97],
        [244,109,67],
        [213,62,79],
        [158,1,66]
    ],
    
    greyscale: [
        [0, 0, 0],
        [255, 255, 255]
    ]
};

/**
 * 获取可用的 colormap 列表
 */
function getAvailableColormapsList() {
    return Object.keys(COLORMAP_PRESETS).map(key => ({
        value: key,
        name: key.charAt(0).toUpperCase() + key.slice(1)
    }));
}

/**
 * 根据预设名称获取 colormap 函数
 * 使用简单的线性插值
 */
function getColormapFunction(presetName) {
    const preset = COLORMAP_PRESETS[presetName];
    if (!preset) {
        console.warn(`Colormap '${presetName}' not found, using viridis`);
        return getColormapFunction('viridis');
    }
    
    return function(t) {
        // 确保 t 在 [0, 1] 范围内
        t = Math.max(0, Math.min(1, t));
        
        // 找到对应的颜色区间
        const index = t * (preset.length - 1);
        const i = Math.floor(index);
        const f = index - i;
        
        if (i >= preset.length - 1) {
            return [...preset[preset.length - 1], 255];
        }
        
        const c1 = preset[i];
        const c2 = preset[i + 1];
        
        return [
            Math.floor(c1[0] + f * (c2[0] - c1[0])),
            Math.floor(c1[1] + f * (c2[1] - c1[1])),
            Math.floor(c1[2] + f * (c2[2] - c1[2])),
            255
        ];
    };
}
