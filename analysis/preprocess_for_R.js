/**
 * 数据预处理脚本 (Node.js 版)
 * 使用与浏览器端完全一致的 metrics.js 和 c3 color naming 计算真实指标
 * 替代 preprocess_for_R.py 中的占位符计算
 * 
 * 用法: node preprocess_for_R.js
 */

var khairi_COLOR_PRESETS = {

    greyscale: [
        [0, 0, 0],
        [255, 255, 255]
    ],

    rainbow: [
        [0, 0, 255],
        [0, 255, 255],
        [0, 255, 0],
        [255, 255, 0],
        [255, 0, 0],
    ],

    rainbowcie: [
        [0, 0, 255],
        [0, 255, 255],
        [0, 255, 0],
        [255, 255, 0],
        [255, 0, 0],
    ],

    rainbowjet: [
        [0, 0, 143],
        [0, 0, 159],
        [0, 0, 175],
        [0, 0, 191],
        [0, 0, 207],
        [0, 0, 223],
        [0, 0, 239],
        [0, 0, 255],
        [0, 15, 255],
        [0, 31, 255],
        [0, 47, 255],
        [0, 63, 255],
        [0, 79, 255],
        [0, 95, 255],
        [0, 111, 255],
        [0, 127, 255],
        [0, 143, 255],
        [0, 159, 255],
        [0, 175, 255],
        [0, 191, 255],
        [0, 207, 255],
        [0, 223, 255],
        [0, 239, 255],
        [0, 255, 255],
        [15, 255, 239],
        [31, 255, 223],
        [47, 255, 207],
        [63, 255, 191],
        [79, 255, 175],
        [95, 255, 159],
        [111, 255, 143],
        [127, 255, 127],
        [143, 255, 111],
        [159, 255, 95],
        [175, 255, 79],
        [191, 255, 63],
        [207, 255, 47],
        [223, 255, 31],
        [239, 255, 15],
        [255, 255, 0],
        [255, 239, 0],
        [255, 223, 0],
        [255, 207, 0],
        [255, 191, 0],
        [255, 175, 0],
        [255, 159, 0],
        [255, 143, 0],
        [255, 127, 0],
        [255, 111, 0],
        [255, 95, 0],
        [255, 79, 0],
        [255, 63, 0],
        [255, 47, 0],
        [255, 31, 0],
        [255, 15, 0],
        [255, 0, 0],
        [239, 0, 0],
        [223, 0, 0],
        [207, 0, 0],
        [191, 0, 0],
        [175, 0, 0],
        [159, 0, 0],
        [143, 0, 0],
        [127, 0, 0]
    ],

    // a rainbow without greens
    /*
    rainbowcustomcie: [
        [0, 0, 255],
        [0, 255, 255],
        //[0, 255, 0],
        [255, 255, 0],
        [255, 0, 0],
    ],
    */

    /*
    cubehelix: [
        [0.000, 0.000, 0.000],
        [0.017, 0.006, 0.016],
        [0.032, 0.011, 0.033],
        [0.046, 0.018, 0.051],
        [0.059, 0.025, 0.070],
        [0.070, 0.032, 0.089],
        [0.080, 0.041, 0.109],
        [0.087, 0.050, 0.129],
        [0.094, 0.060, 0.150],
        [0.098, 0.071, 0.169],
        [0.102, 0.083, 0.188],
        [0.104, 0.095, 0.207],
        [0.104, 0.109, 0.224],
        [0.104, 0.123, 0.240],
        [0.103, 0.138, 0.254],
        [0.100, 0.153, 0.267],
        [0.098, 0.169, 0.279],
        [0.095, 0.186, 0.288],
        [0.092, 0.203, 0.296],
        [0.089, 0.221, 0.302],
        [0.086, 0.238, 0.306],
        [0.084, 0.256, 0.308],
        [0.083, 0.274, 0.308],
        [0.082, 0.291, 0.306],
        [0.083, 0.308, 0.303],
        [0.085, 0.325, 0.298],
        [0.089, 0.341, 0.292],
        [0.094, 0.357, 0.284],
        [0.101, 0.372, 0.276],
        [0.109, 0.386, 0.267],
        [0.120, 0.399, 0.257],
        [0.133, 0.412, 0.247],
        [0.147, 0.423, 0.237],
        [0.164, 0.434, 0.227],
        [0.183, 0.443, 0.217],
        [0.203, 0.451, 0.209],
        [0.225, 0.458, 0.201],
        [0.249, 0.464, 0.194],
        [0.275, 0.469, 0.189],
        [0.301, 0.473, 0.186],
        [0.329, 0.476, 0.184],
        [0.358, 0.478, 0.184],
        [0.388, 0.480, 0.186],
        [0.418, 0.481, 0.190],
        [0.449, 0.481, 0.197],
        [0.480, 0.480, 0.206],
        [0.511, 0.479, 0.218],
        [0.541, 0.478, 0.231],
        [0.571, 0.477, 0.247],
        [0.600, 0.476, 0.266],
        [0.628, 0.475, 0.286],
        [0.654, 0.474, 0.309],
        [0.679, 0.474, 0.334],
        [0.703, 0.474, 0.360],
        [0.725, 0.474, 0.388],
        [0.745, 0.476, 0.417],
        [0.763, 0.478, 0.447],
        [0.779, 0.481, 0.479],
        [0.793, 0.485, 0.511],
        [0.805, 0.490, 0.543],
        [0.815, 0.495, 0.575],
        [0.822, 0.503, 0.608],
        [0.828, 0.511, 0.639],
        [0.831, 0.520, 0.671],
        [0.833, 0.530, 0.701],
        [0.833, 0.542, 0.730],
        [0.832, 0.554, 0.758],
        [0.829, 0.568, 0.785],
        [0.825, 0.582, 0.810],
        [0.820, 0.597, 0.833],
        [0.814, 0.614, 0.854],
        [0.807, 0.630, 0.873],
        [0.800, 0.647, 0.890],
        [0.793, 0.665, 0.905],
        [0.786, 0.683, 0.918],
        [0.780, 0.702, 0.929],
        [0.774, 0.720, 0.937],
        [0.768, 0.738, 0.944],
        [0.764, 0.757, 0.949],
        [0.761, 0.775, 0.953],
        [0.759, 0.792, 0.954],
        [0.758, 0.809, 0.955],
        [0.759, 0.826, 0.954],
        [0.761, 0.842, 0.953],
        [0.765, 0.857, 0.950],
        [0.771, 0.872, 0.948],
        [0.779, 0.886, 0.945],
        [0.788, 0.898, 0.942],
        [0.798, 0.910, 0.939],
        [0.810, 0.922, 0.937],
        [0.824, 0.932, 0.936],
        [0.839, 0.941, 0.936],
        [0.855, 0.950, 0.937],
        [0.872, 0.958, 0.939],
        [0.890, 0.965, 0.942],
        [0.908, 0.972, 0.948],
        [0.927, 0.978, 0.954],
        [0.945, 0.984, 0.963],
        [0.964, 0.989, 0.974],
        [0.982, 0.995, 0.986],
        [0.9999, 0.9999, 0.9999]
    ],
    */


    singlehue: [
        [247, 251, 255],
        [222, 235, 247],
        [198, 219, 239],
        [158, 202, 225],
        [107, 174, 214],
        [66, 146, 198],
        [33, 113, 181],
        [8, 81, 156],
        [8, 48, 107]
    ].reverse(),


    multihue: [
        [255, 255, 217],
        [237, 248, 177],
        [199, 233, 180],
        [127, 205, 187],
        [65, 182, 196],
        [29, 145, 192],
        [34, 94, 168],
        [37, 52, 148],
        [8, 29, 88],
    ].reverse(),

    bodyheat: [
        [0, 0, 0, 0],
        [178, 34, 34, 0.39],
        [227, 105, 5, 0.58],
        [238, 210, 20, 0.84],
        [255, 255, 255, 1.0]
    ],
    extendedBlackBody: [
        [0, 0, 0, 0],
        [0, 24, 168, 0.22],
        [99, 0, 228, 0.35],
        [220, 20, 60, 0.47],
        [255, 117, 56, 0.65],
        [238, 210, 20, 0.84],
        [255, 255, 255, 1.0]
    ],


    // via G. Kindlemann
    kindlmann: [
        [0, 0, 0],
        [46, 4, 76],
        [63, 7, 145],
        [8, 66, 165],
        [5, 106, 106],
        [7, 137, 69],
        [8, 168, 26],
        [84, 194, 9],
        [196, 206, 10],
        [252, 220, 197],
        [255, 255, 255]
    ],

    // via Color Brewer
    spectralFull: [
        [158, 1, 66],
        [213, 62, 79],
        [244, 109, 67],
        [253, 174, 97],
        [254, 224, 139],
        [255, 255, 191],
        [230, 245, 152],
        [171, 221, 164],
        [102, 194, 165],
        [50, 136, 189],
        [94, 79, 162]
    ].reverse(),

    // via Moreland
    coolwarmMoreland: [
        [59, 76, 192],
        [68, 90, 204],
        [77, 104, 215],
        [87, 117, 225],
        [98, 130, 234],
        [108, 142, 241],
        [119, 154, 247],
        [130, 165, 251],
        [141, 176, 254],
        [152, 185, 255],
        [163, 194, 255],
        [174, 201, 253],
        [184, 208, 249],
        [194, 213, 244],
        [204, 217, 238],
        [213, 219, 230],
        [221, 221, 221],
        [229, 216, 209],
        [236, 211, 197],
        [241, 204, 185],
        [245, 196, 173],
        [247, 187, 160],
        [247, 177, 148],
        [247, 166, 135],
        [244, 154, 123],
        [241, 141, 111],
        [236, 127, 99],
        [229, 112, 88],
        [222, 96, 77],
        [213, 80, 66],
        [203, 62, 56],
        [192, 40, 47],
        [180, 4, 38]
    ],

    blueyellow: [
        [13, 0, 252],
        [190, 190, 190],
        [252, 252, 0]
    ],

    rainbowhcl: function (t) {
        return d3.rgb(d3.hcl(t * 360, 1, .5));
    },

    viridis: (function () {
        var out = [];
        for (var i = 0; i <= 100; i++) {
            var c = d3.interpolateViridis(i / 100);
            var rgb = d3.color(c);
            out.push([rgb.r, rgb.g, rgb.b]);
        }
        return out
    })(),

    plasma: (function () {
        var out = [];
        for (var i = 0; i <= 100; i++) {
            var c = d3.interpolatePlasma(i / 100);
            var rgb = d3.color(c);
            out.push([rgb.r, rgb.g, rgb.b]);
        }
        return out
    })(),

    redpurple: [
        [255, 247, 243],
        [253, 224, 221],
        [252, 197, 192],
        [250, 159, 181],
        [247, 104, 161],
        [221, 52, 151],
        [174, 1, 126],
        [122, 1, 119],
        [73, 0, 106]
    ].reverse(),

    greyred: [
        [178, 24, 43],
        [214, 96, 77],
        [244, 165, 130],
        [253, 219, 199],
        [255, 255, 255],
        [224, 224, 224],
        [186, 186, 186],
        [135, 135, 135],
        [77, 77, 77]
    ].reverse(),

    coolwarm: [
        [63, 0, 242],
        [83, 41, 240],
        [121, 98, 245],
        [169, 158, 249],
        [225, 223, 252],
        [244, 208, 209],
        [232, 135, 135],
        [221, 70, 73],
        [221, 25, 29],
    ],

    reds:
        [
            [226, 202, 100],
            [225, 180, 87],
            [225, 159, 79],
            [227, 140, 75],
            [219, 118, 71],
            [205, 95, 67],
            [191, 73, 63],
            [169, 50, 57],
            [147, 27, 51]
        ].reverse(),

    purples: [
        [59, 27, 80],
        [79, 37, 94],
        [95, 52, 108],
        [112, 68, 123],
        [135, 84, 140],
        [160, 101, 157],
        [186, 116, 169],
        [206, 131, 176],
        [215, 146, 171],
    ],

    blues:
        [
            [253, 244, 249],
            [214, 207, 230],
            [169, 180, 214],
            [122, 158, 201],
            [76, 133, 184],
            [49, 107, 174],
            [39, 82, 149],
            [27, 61, 103],
            [18, 41, 70],

            /*
            [254,   246,    250],
            [213,   208,    229],
            [171,   180,    212],
            [129,   158,    197],
            [88,    133,    180],
            [63,    107,    168],
            [49,    82,     144],
            [35,    61,     100],
            [23,    41,     68]
            */
        ].reverse(),

    spectral:
        [
            [213, 62, 79],
            [244, 109, 67],
            [253, 174, 97],
            [254, 224, 139],
            [255, 255, 191],
            [230, 245, 152],
            [171, 221, 164],
            [102, 194, 165],
            [50, 136, 189]
        ].reverse(),

    /*
    [
        [72,        0,      84],
        [74,        1,      91],
        [76,        7,      96],
        [77,        14,     102],
        [78,        20,     107],
        [79,        26,     112],
        [80,        32,     116],
        [80,        37,     120],
        [80,        42,     124],
        [79,        48,     127],
        [79,        53,     130],
        [78,        58,     132],
        [77,    63,     134],
        [75,        68,     136],
        [74,        72,     138],
        [72,        77,     139],
        [71,        82,     140],
        [69,    86,     140],
        [67,        91,     141],
        [65,        95,     141],
        [64,        99,     142],
        [62,        103,    142],
        [60,        107,    142],
        [59,        111,    142],
        [57,        115,    142],
        [55,        119,    142],
        [54,        123,    142],
        [52,        127,    142],
        [50,        131,    142],
        [48,    135,    142],
        [46,        138,    141],
        [44,        142,    141],
        [42,        146,    140],
        [39,        150,    139],
        [37,    154,    138],
        [35,        158,    137],
        [34,        162,    135],
        [32,        166,    133],
        [32,        169,    131],
        [33,        173,    129],
        [35,        177,    126],
        [38,        181,    123],
        [42,        184,    120],
        [48,        188,    116],
        [54,        191,    112],
        [61,        195,    108],
        [69,    198,    103],
        [78,        201,    98],
        [86,        204,    93],
        [96,        207,    87],
        [105,   210,    81],
        [115,   212,    74],
        [126,   215,    68],
        [136,   217,    60],
        [147,   219,    53],
        [158,   221,    45],
        [169,   223,    37],
        [180,   225,    28],
        [191,   226,    20],
        [202,   228,    12],
        [212,   229,    9],
        [223,   230,    11],
        [233,   231,    19],
        [243,   233,    28]

],*/

    turbo: [[48, 18, 59], [50, 21, 67], [51, 24, 74], [52, 27, 81], [53, 30, 88], [54, 33, 95], [55, 36, 102], [56, 39, 109], [57, 42, 115], [58, 45, 121], [59, 47, 128], [60, 50, 134], [61, 53, 139], [62, 56, 145], [63, 59, 151], [63, 62, 156], [64, 64, 162], [65, 67, 167], [65, 70, 172], [66, 73, 177], [66, 75, 181], [67, 78, 186], [68, 81, 191], [68, 84, 195], [68, 86, 199], [69, 89, 203], [69, 92, 207], [69, 94, 211], [70, 97, 214], [70, 100, 218], [70, 102, 221], [70, 105, 224], [70, 107, 227], [71, 110, 230], [71, 113, 233], [71, 115, 235], [71, 118, 238], [71, 120, 240], [71, 123, 242], [70, 125, 244], [70, 128, 246], [70, 130, 248], [70, 133, 250], [70, 135, 251], [69, 138, 252], [69, 140, 253], [68, 143, 254], [67, 145, 254], [66, 148, 255], [65, 150, 255], [64, 153, 255], [62, 155, 254], [61, 158, 254], [59, 160, 253], [58, 163, 252], [56, 165, 251], [55, 168, 250], [53, 171, 248], [51, 173, 247], [49, 175, 245], [47, 178, 244], [46, 180, 242], [44, 183, 240], [42, 185, 238], [40, 188, 235], [39, 190, 233], [37, 192, 231], [35, 195, 228], [34, 197, 226], [32, 199, 223], [31, 201, 221], [30, 203, 218], [28, 205, 216], [27, 208, 213], [26, 210, 210], [26, 212, 208], [25, 213, 205], [24, 215, 202], [24, 217, 200], [24, 219, 197], [24, 221, 194], [24, 222, 192], [24, 224, 189], [25, 226, 187], [25, 227, 185], [26, 228, 182], [28, 230, 180], [29, 231, 178], [31, 233, 175], [32, 234, 172], [34, 235, 170], [37, 236, 167], [39, 238, 164], [42, 239, 161], [44, 240, 158], [47, 241, 155], [50, 242, 152], [53, 243, 148], [56, 244, 145], [60, 245, 142], [63, 246, 138], [67, 247, 135], [70, 248, 132], [74, 248, 128], [78, 249, 125], [82, 250, 122], [85, 250, 118], [89, 251, 115], [93, 252, 111], [97, 252, 108], [101, 253, 105], [105, 253, 102], [109, 254, 98], [113, 254, 95], [117, 254, 92], [121, 254, 89], [125, 255, 86], [128, 255, 83], [132, 255, 81], [136, 255, 78], [139, 255, 75], [143, 255, 73], [146, 255, 71], [150, 254, 68], [153, 254, 66], [156, 254, 64], [159, 253, 63], [161, 253, 61], [164, 252, 60], [167, 252, 58], [169, 251, 57], [172, 251, 56], [175, 250, 55], [177, 249, 54], [180, 248, 54], [183, 247, 53], [185, 246, 53], [188, 245, 52], [190, 244, 52], [193, 243, 52], [195, 241, 52], [198, 240, 52], [200, 239, 52], [203, 237, 52], [205, 236, 52], [208, 234, 52], [210, 233, 53], [212, 231, 53], [215, 229, 53], [217, 228, 54], [219, 226, 54], [221, 224, 55], [223, 223, 55], [225, 221, 55], [227, 219, 56], [229, 217, 56], [231, 215, 57], [233, 213, 57], [235, 211, 57], [236, 209, 58], [238, 207, 58], [239, 205, 58], [241, 203, 58], [242, 201, 58], [244, 199, 58], [245, 197, 58], [246, 195, 58], [247, 193, 58], [248, 190, 57], [249, 188, 57], [250, 186, 57], [251, 184, 56], [251, 182, 55], [252, 179, 54], [252, 177, 54], [253, 174, 53], [253, 172, 52], [254, 169, 51], [254, 167, 50], [254, 164, 49], [254, 161, 48], [254, 158, 47], [254, 155, 45], [254, 153, 44], [254, 150, 43], [254, 147, 42], [254, 144, 41], [253, 141, 39], [253, 138, 38], [252, 135, 37], [252, 132, 35], [251, 129, 34], [251, 126, 33], [250, 123, 31], [249, 120, 30], [249, 117, 29], [248, 114, 28], [247, 111, 26], [246, 108, 25], [245, 105, 24], [244, 102, 23], [243, 99, 21], [242, 96, 20], [241, 93, 19], [240, 91, 18], [239, 88, 17], [237, 85, 16], [236, 83, 15], [235, 80, 14], [234, 78, 13], [232, 75, 12], [231, 73, 12], [229, 71, 11], [228, 69, 10], [226, 67, 10], [225, 65, 9], [223, 63, 8], [221, 61, 8], [220, 59, 7], [218, 57, 7], [216, 55, 6], [214, 53, 6], [212, 51, 5], [210, 49, 5], [208, 47, 5], [206, 45, 4], [204, 43, 4], [202, 42, 4], [200, 40, 3], [197, 38, 3], [195, 37, 3], [193, 35, 2], [190, 33, 2], [188, 32, 2], [185, 30, 2], [183, 29, 2], [180, 27, 1], [178, 26, 1], [175, 24, 1], [172, 23, 1], [169, 22, 1], [167, 20, 1], [164, 19, 1], [161, 18, 1], [158, 16, 1], [155, 15, 1], [152, 14, 1], [149, 13, 1], [146, 11, 1], [142, 10, 1], [139, 9, 2], [136, 8, 2], [133, 7, 2], [129, 6, 2], [126, 5, 2], [122, 4, 3]],



    //viridisLike: { URL: '/colormaps/viridis-like.json'}
};


const fs = require('fs');
const path = require('path');
const d3 = require('d3');

// ============================================================================
// c3 Color Naming Library (ported from browser version)
// ============================================================================

const c3 = { version: "1.0.0" };

function c3_init(json) {
    let i, C, W, T, A, ccount, tcount;

    // parse colors
    c3.color = [];
    for (i = 0; i < json.color.length; i += 3) {
        c3.color[i / 3] = d3.lab(json.color[i], json.color[i + 1], json.color[i + 2]);
    }
    C = c3.color.length;

    // parse terms
    c3.terms = json.terms;
    W = c3.terms.length;

    // parse count table
    c3.T = T = [];
    for (i = 0; i < json.T.length; i += 2) {
        T[json.T[i]] = json.T[i + 1];
    }

    // construct counts
    c3.color.count = ccount = []; for (i = 0; i < C; ++i) ccount[i] = 0;
    c3.terms.count = tcount = []; for (i = 0; i < W; ++i) tcount[i] = 0;
    Object.keys(T).forEach(function (idx) {
        var c = Math.floor(idx / W),
            w = Math.floor(idx % W),
            v = T[idx] || 0;
        ccount[c] += v;
        tcount[w] += v;
    });

    // parse word association matrix
    c3.A = A = json.A;
}

function c3_api() {
    const C = c3.color.length,
        W = c3.terms.length,
        T = c3.T,
        A = c3.A,
        ccount = c3.color.count,
        tcount = c3.terms.count;

    c3.count = function (c, w) {
        return T[c * W + w] || 0;
    };

    c3.terms.prob = function (w, c) {
        return (T[c * W + w] || 0) / tcount[w];
    };

    c3.terms.entropy = function (w) {
        var H = 0, p;
        for (var c = 0; c < C; ++c) {
            p = (T[c * W + w] || 0) / tcount[w];
            if (p > 0) H += p * Math.log(p) / Math.LN2;
        }
        return H;
    };

    c3.color.prob = function (c, w) {
        return (T[c * W + w] || 0) / ccount[c];
    };

    c3.color.entropy = function (c) {
        var H = 0, p;
        for (var w = 0; w < W; ++w) {
            p = (T[c * W + w] || 0) / ccount[c];
            if (p > 0) H += p * Math.log(p) / Math.LN2;
        }
        return H;
    };

    c3.color.cosine = function (a, b) {
        var sa = 0, sb = 0, sc = 0, ta, tb;
        for (var w = 0; w < W; ++w) {
            ta = (T[a * W + w] || 0);
            tb = (T[b * W + w] || 0);
            sa += ta * ta;
            sb += tb * tb;
            sc += ta * tb;
        }
        return sc / (Math.sqrt(sa * sb));
    };

    c3.color.hellinger = function (a, b) {
        var bc = 0, pa, pb, z = Math.sqrt(ccount[a] * ccount[b]);
        for (var w = 0; w < W; ++w) {
            pa = (T[a * W + w] || 0);
            pb = (T[b * W + w] || 0);
            bc += Math.sqrt(pa * pb);
        }
        return Math.sqrt(1 - bc / z);
    };

    c3.terms.relatedColors = function (w, limit) {
        var list = [];
        for (var c = 0; c < C; ++c) {
            var s = (T[c * W + w] || 0) / ccount[c];
            if (s > 0) list.push({ index: c, score: s });
        }
        list.sort(function (a, b) { return b.score - a.score; });
        return limit ? list.slice(0, limit) : list;
    };

    // compute representative colors
    c3.terms.center = Array.from({ length: W }, (_, w) => {
        var list = c3.terms.relatedColors(w, 5)
            .map(function (d) { return c3.color[d.index]; });
        var L = 0, a = 0, b = 0, N = list.length;
        list.forEach(function (c) { L += c.L; a += c.a; b += c.b; });
        return d3.lab(Math.round(L / N), Math.round(a / N), Math.round(b / N));
    });
}

// ============================================================================
// Utils (from stimuli/js/utils.js)
// ============================================================================

function ciede2000(lab1, lab2) {
    const [L1, a1, b1] = lab1;
    const [L2, a2, b2] = lab2;

    const kL = 1, kC = 1, kH = 1;
    const deg2rad = angle => angle * (Math.PI / 180);
    const rad2deg = angle => angle * (180 / Math.PI);

    const avgL = (L1 + L2) / 2;
    const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
    const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);
    const avgC = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);

    const C1p = Math.sqrt(a1p ** 2 + b1 ** 2);
    const C2p = Math.sqrt(a2p ** 2 + b2 ** 2);
    const avgCp = (C1p + C2p) / 2;

    let h1p = b1 === 0 && a1p === 0 ? 0 : Math.atan2(b1, a1p);
    let h2p = b2 === 0 && a2p === 0 ? 0 : Math.atan2(b2, a2p);
    if (h1p < 0) h1p += 2 * Math.PI;
    if (h2p < 0) h2p += 2 * Math.PI;

    const avgHp =
        Math.abs(h1p - h2p) <= Math.PI
            ? (h1p + h2p) / 2
            : (h1p + h2p + 2 * Math.PI) / 2;

    const T =
        1 -
        0.17 * Math.cos(avgHp - deg2rad(30)) +
        0.24 * Math.cos(2 * avgHp) +
        0.32 * Math.cos(3 * avgHp + deg2rad(6)) -
        0.2 * Math.cos(4 * avgHp - deg2rad(63));

    let deltaHp = h2p - h1p;
    if (Math.abs(deltaHp) <= Math.PI) {
        deltaHp = deltaHp;
    } else if (deltaHp > Math.PI) {
        deltaHp -= 2 * Math.PI;
    } else {
        deltaHp += 2 * Math.PI;
    }

    const deltaL = L2 - L1;
    const deltaCp = C2p - C1p;
    const deltaH = 2 * Math.sqrt(C1p * C2p) * Math.sin(deltaHp / 2);

    const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
    const SC = 1 + 0.045 * avgCp;
    const SH = 1 + 0.015 * avgCp * T;

    const deltaTheta = deg2rad(30) * Math.exp(-(((rad2deg(avgHp) - 275) / 25) ** 2));
    const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
    const RT = -RC * Math.sin(2 * deltaTheta);

    const deltaE =
        Math.sqrt(
            (deltaL / (kL * SL)) ** 2 +
            (deltaCp / (kC * SC)) ** 2 +
            (deltaH / (kH * SH)) ** 2 +
            RT * (deltaCp / (kC * SC)) * (deltaH / (kH * SH))
        );

    return deltaE;
}

function convertColormapToStandardFormat(colormap) {
    if (!colormap || colormap.length === 0) return null;

    const standardizedColors = [];
    for (let i = 0; i < colormap.length; i++) {
        const color = colormap[i];
        let r, g, b;

        if (typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
            r = Math.round(color.r);
            g = Math.round(color.g);
            b = Math.round(color.b);
        } else if (Array.isArray(color) && color.length >= 3) {
            r = Math.round(color[0]);
            g = Math.round(color[1]);
            b = Math.round(color[2]);
        } else {
            continue;
        }

        standardizedColors.push({
            value: i / (colormap.length - 1),
            rgb: [r, g, b]
        });
    }

    return standardizedColors.length > 0 ? standardizedColors : null;
}

function computeDeltaE(L1, a1, b1, L2, a2, b2, wa = 0.1, wb = 0.1) {
    if (isNaN(L1) || isNaN(a1) || isNaN(b1) || isNaN(L2) || isNaN(a2) || isNaN(b2)) return 0;

    let deltaL = L1 - L2;
    let deltaA = a1 - a2;
    let deltaB = b1 - b2;

    const result = Math.sqrt(
        Math.pow(deltaL, 2) +
        wa * Math.pow(deltaA, 2) +
        wb * Math.pow(deltaB, 2)
    );

    return isNaN(result) ? 0 : result;
}

function getColorNameIndex(c) {
    if (!c3.color || c3.color.length === 0) return 0;

    const x = d3.lab(c);
    let minDist = Number.MAX_VALUE;
    let minIndex = 0;

    // d3 v7 uses lowercase .l for lightness
    const xL = x.l;
    const xA = x.a;
    const xB = x.b;

    for (let i = 0; i < c3.color.length; i++) {
        const c2 = c3.color[i];
        // c3 color objects are d3.lab instances — also lowercase .l in d3 v7
        const c2L = c2.l;
        const c2A = c2.a;
        const c2B = c2.b;

        const dist = Math.sqrt(
            Math.pow(xL - c2L, 2) +
            Math.pow(xA - c2A, 2) +
            Math.pow(xB - c2B, 2)
        );

        if (dist < minDist) {
            minDist = dist;
            minIndex = i;
        }
    }

    return minIndex;
}

function getNameDifference(c0, c1) {
    if (!c3.color || c3.color.length === 0) {
        // Fallback: LAB distance normalized to 0-1
        const lab0 = d3.lab(c0);
        const lab1 = d3.lab(c1);
        const lVal0 = lab0.l !== undefined ? lab0.l : lab0.L;
        const lVal1 = lab1.l !== undefined ? lab1.l : lab1.L;
        const labDiff = Math.sqrt(
            Math.pow(lVal1 - lVal0, 2) +
            Math.pow(lab1.a - lab0.a, 2) +
            Math.pow(lab1.b - lab0.b, 2)
        );
        return Math.min(1.0, labDiff / 150);
    }

    const i0 = getColorNameIndex(c0);
    const i1 = getColorNameIndex(c1);

    if (i0 === i1) return 0;

    try {
        return 1 - c3.color.cosine(i0, i1);
    } catch (e) {
        return 0;
    }
}

function nameSalience(c) {
    if (!c3.color || c3.color.length === 0) return 0;

    const minE = -4.5;
    const maxE = 0.0;
    const i = getColorNameIndex(c);
    const ent = c3.color.entropy(i);
    return (ent - minE) / (maxE - minE);
}

// ============================================================================
// Metrics (from stimuli/js/metrics.js)
// ============================================================================

// 1. CIEDE2000 Discriminative Power
function discriminatory_cie(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) return 0;

    let totalSpeed = 0;
    let pairCount = 0;

    for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
            const rgbColor1 = d3.rgb(colors[i].rgb[0], colors[i].rgb[1], colors[i].rgb[2]);
            const rgbColor2 = d3.rgb(colors[j].rgb[0], colors[j].rgb[1], colors[j].rgb[2]);
            const lab1 = d3.lab(rgbColor1);
            const lab2 = d3.lab(rgbColor2);

            const deltaE = ciede2000(
                [lab1.l || lab1.L, lab1.a, lab1.b],
                [lab2.l || lab2.L, lab2.a, lab2.b]
            );
            totalSpeed += deltaE;
            pairCount++;
        }
    }

    return pairCount > 0 ? totalSpeed / pairCount : 0;
}

// 2. Contrast Sensitivity
function discriminatory_contrast_sensitivity(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) return 0;

    let totalSpeed = 0;
    let pairCount = 0;

    for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
            const rgbColor1 = d3.rgb(colors[i].rgb[0], colors[i].rgb[1], colors[i].rgb[2]);
            const rgbColor2 = d3.rgb(colors[j].rgb[0], colors[j].rgb[1], colors[j].rgb[2]);
            const lab1 = d3.lab(rgbColor1);
            const lab2 = d3.lab(rgbColor2);

            const l1 = Number(lab1.l !== undefined ? lab1.l : lab1.L);
            const a1 = Number(lab1.a);
            const b1 = Number(lab1.b);
            const l2 = Number(lab2.l !== undefined ? lab2.l : lab2.L);
            const a2 = Number(lab2.a);
            const b2 = Number(lab2.b);

            const deltaE = computeDeltaE(l1, a1, b1, l2, a2, b2);
            if (isNaN(deltaE) || deltaE === 0) continue;

            const normalizationFactor = Math.abs((j - i) / (colors.length - 1));
            if (normalizationFactor === 0) continue;

            const v_ij = deltaE / normalizationFactor;
            if (isNaN(v_ij)) continue;

            const contribution = 3.4 * Math.pow(v_ij, 0.879);
            totalSpeed += contribution;
            pairCount++;
        }
    }

    return pairCount > 0 ? totalSpeed / pairCount : 0;
}

// 3. Hue Variation
function discriminatory_hue(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) return 0;

    const hueValues = [];
    for (let i = 0; i < colors.length; i++) {
        const r = parseInt(colors[i].rgb[0]);
        const g = parseInt(colors[i].rgb[1]);
        const b = parseInt(colors[i].rgb[2]);
        if (isNaN(r) || isNaN(g) || isNaN(b)) continue;

        const rgbColor = d3.rgb(r, g, b);
        const hcl = d3.hcl(rgbColor);
        const h = isNaN(hcl.h) ? 0 : hcl.h;
        hueValues.push(h);
    }

    if (hueValues.length === 0) return 0;

    let totalVariation = 0;
    for (let i = 1; i < hueValues.length; i++) {
        let diff = Math.abs(hueValues[i] - hueValues[i - 1]);
        if (diff > 180) diff = 360 - diff;
        totalVariation += diff;
    }

    return totalVariation;
}

// 4. Luminance Variation
function luminance_variation(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) return 0;

    const luminanceValues = [];
    for (let i = 0; i < colors.length; i++) {
        const r = parseInt(colors[i].rgb[0]);
        const g = parseInt(colors[i].rgb[1]);
        const b = parseInt(colors[i].rgb[2]);
        if (isNaN(r) || isNaN(g) || isNaN(b)) continue;

        const rgbColor = d3.rgb(r, g, b);
        const hcl = d3.hcl(rgbColor);
        const lValue = hcl.l !== undefined ? hcl.l : hcl.L;
        if (typeof lValue === 'number' && !isNaN(lValue)) {
            luminanceValues.push(lValue);
        }
    }

    if (luminanceValues.length === 0) return 0;

    let totalVariation = 0;
    for (let i = 1; i < luminanceValues.length; i++) {
        totalVariation += Math.abs(luminanceValues[i] - luminanceValues[i - 1]);
    }

    return totalVariation;
}

// 5. Chromatic Variation
function chromatic_variation(colormap) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) return 0;

    const saturationValues = [];
    for (let i = 0; i < colors.length; i++) {
        const r = parseInt(colors[i].rgb[0]);
        const g = parseInt(colors[i].rgb[1]);
        const b = parseInt(colors[i].rgb[2]);
        if (isNaN(r) || isNaN(g) || isNaN(b)) continue;

        const rgbColor = d3.rgb(r, g, b);
        const hcl = d3.hcl(rgbColor);
        const cValue = hcl.c !== undefined ? hcl.c : hcl.C;
        if (typeof cValue === 'number' && !isNaN(cValue)) {
            saturationValues.push(cValue);
        }
    }

    if (saturationValues.length === 0) return 0;

    let totalVariation = 0;
    for (let i = 1; i < saturationValues.length; i++) {
        totalVariation += Math.abs(saturationValues[i] - saturationValues[i - 1]);
    }

    return totalVariation;
}

// 6. LAB Length
function calculate_lab_length(colormap, sampleCount = 9) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) return 0;

    const samples = [];
    const step = (colors.length - 1) / (sampleCount - 1);

    for (let i = 0; i < sampleCount; i++) {
        const index = Math.min(Math.floor(i * step), colors.length - 1);
        const r = parseInt(colors[index].rgb[0]);
        const g = parseInt(colors[index].rgb[1]);
        const b = parseInt(colors[index].rgb[2]);
        if (isNaN(r) || isNaN(g) || isNaN(b)) continue;

        const rgbColor = d3.rgb(r, g, b);
        const lab = d3.lab(rgbColor);
        const lValue = lab.l !== undefined ? lab.l : lab.L;
        if (!isNaN(lValue) && !isNaN(lab.a) && !isNaN(lab.b)) {
            samples.push(lab);
        }
    }

    if (samples.length < 2) return 0;

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

        if (!isNaN(distance)) totalLabLength += distance;
    }

    return totalLabLength;
}

// 7. Color Name Variation (CNV)
function calculate_color_name_variation(colormap, sampleCount = 9) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) return 0;

    const samples = [];
    const step = (colors.length - 1) / (sampleCount - 1);

    for (let i = 0; i < sampleCount; i++) {
        const index = Math.min(Math.floor(i * step), colors.length - 1);
        const r = parseInt(colors[index].rgb[0]);
        const g = parseInt(colors[index].rgb[1]);
        const b = parseInt(colors[index].rgb[2]);
        if (isNaN(r) || isNaN(g) || isNaN(b)) continue;

        samples.push(d3.rgb(r, g, b));
    }

    if (samples.length < 2) return 0;

    let totalNameDiff = 0;

    for (let i = 0; i < samples.length - 1; i++) {
        const diff = getNameDifference(samples[i], samples[i + 1]);
        if (!isNaN(diff) && isFinite(diff)) {
            totalNameDiff += diff;
        }
    }

    return totalNameDiff;
}

// 8. Color Categorization Tendency (CCT)
function calculate_color_categorization_tendency(colormap, sampleCount = 100, dissimilarityThreshold = 0.6) {
    const colors = convertColormapToStandardFormat(colormap);
    if (!colors || !colors.length) return 0;

    const samples = [];
    const step = Math.max(1, Math.floor(colors.length / sampleCount));

    for (let i = 0; i < colors.length; i += step) {
        if (samples.length >= sampleCount) break;
        const r = parseInt(colors[i].rgb[0]);
        const g = parseInt(colors[i].rgb[1]);
        const b = parseInt(colors[i].rgb[2]);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            samples.push(d3.rgb(r, g, b));
        }
    }

    if (samples.length < 2) return 0;

    // Pre-compute distance matrix
    const distMatrix = new Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        distMatrix[i] = new Array(samples.length);
        for (let j = 0; j < samples.length; j++) {
            if (i === j) {
                distMatrix[i][j] = 0;
            } else if (j > i) {
                distMatrix[i][j] = getNameDifference(samples[i], samples[j]);
            } else {
                distMatrix[i][j] = distMatrix[j][i];
            }
        }
    }

    // Agglomerative clustering
    let clusters = samples.map((_, i) => ({ id: i, indices: [i] }));
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

    const K = clusters.length;
    if (K < 2) return 0;

    // Select centroids
    const centroids = [];
    for (let cluster of clusters) {
        const clusterColors = cluster.indices.map(idx => samples[idx]);

        // Select centroid by max name salience
        let maxSaliency = -Infinity;
        let centroid = clusterColors[0];

        for (let color of clusterColors) {
            try {
                const saliency = nameSalience(color);
                if (!isNaN(saliency) && saliency > maxSaliency) {
                    maxSaliency = saliency;
                    centroid = color;
                }
            } catch (e) { /* skip */ }
        }

        if (centroid) centroids.push(centroid);
    }

    if (centroids.length < 2) return 0;

    // Compute mean CIEDE2000 between centroids
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

// ============================================================================
// CSV Parser / Writer (minimal, no external dependency)
// ============================================================================

function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[j] || '';
        }
        rows.push(row);
    }

    return rows;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current.trim());
    return result;
}

function writeCSV(rows, headers) {
    const lines = [headers.join(',')];
    for (const row of rows) {
        const values = headers.map(h => {
            const val = row[h];
            if (val === undefined || val === null) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        });
        lines.push(values.join(','));
    }
    return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

function main() {
    console.log('=== 开始数据预处理 (Node.js 版) ===');

    // 1. Load c3 color naming data
    console.log('\n1. 加载 c3 色彩命名数据...');
    const c3DataPath = path.join(__dirname, 'c3_data.json');
    if (!fs.existsSync(c3DataPath)) {
        console.error(`   错误: 找不到 ${c3DataPath}`);
        console.error('   请将 c3_data.json 复制到 analysis/ 目录');
        process.exit(1);
    }
    const c3Data = JSON.parse(fs.readFileSync(c3DataPath, 'utf8'));
    c3_init(c3Data);
    c3_api();
    console.log(`   c3 已初始化: ${c3.color.length} 个颜色, ${c3.terms.length} 个术语`);

    // 2. Load colormaps
    console.log('\n2. 加载色彩映射...');
    const colormapsPath = path.join(__dirname, 'colormaps.json');
    if (!fs.existsSync(colormapsPath)) {
        console.error(`   错误: 找不到 ${colormapsPath}`);
        process.exit(1);
    }
    const colormaps = JSON.parse(fs.readFileSync(colormapsPath, 'utf8'));
    console.log(`   加载了 ${colormaps.length} 个色彩映射`);

    // 3. Load result CSV
    console.log('\n3. 加载实验数据...');
    const csvPath = path.join(__dirname, 'output_data', 'result_all_participants.csv');
    if (!fs.existsSync(csvPath)) {
        console.error(`   错误: 找不到 ${csvPath}`);
        process.exit(1);
    }
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(csvText);
    console.log(`   加载了 ${rows.length} 行数据`);

    // 4. Compute metrics for each colormap
    console.log('\n4. 计算色彩映射指标...');
    const metricsCache = {};
    const colormapDict = {};
    for (const cm of colormaps) {
        colormapDict[cm.id] = cm;
    }

    const uniqueIds = [...new Set(rows.map(r => parseInt(r.colormapId)))];
    console.log(`   需要计算 ${uniqueIds.length} 个色彩映射的指标`);

    for (let idx = 0; idx < uniqueIds.length; idx++) {
        const cmId = uniqueIds[idx];
        const cm = colormapDict[cmId];
        if (!cm) {
            console.warn(`   警告: 找不到 colormap ID ${cmId}`);
            continue;
        }

        const colormap = cm.colormap; // [[r,g,b], ...]

        process.stdout.write(`   [${idx + 1}/${uniqueIds.length}] ID=${cmId}...`);
        const startTime = Date.now();

        metricsCache[cmId] = {
            ciede2000_discriminative: discriminatory_cie(colormap) || 0,
            contrast_sensitivity: discriminatory_contrast_sensitivity(colormap) || 0,
            hue_discriminative: discriminatory_hue(colormap) || 0,
            luminance_variation: luminance_variation(colormap) || 0,
            chromatic_variation: chromatic_variation(colormap) || 0,
            LAB_Length: calculate_lab_length(colormap) || 0,
            color_name_variation: calculate_color_name_variation(colormap) || 0,
            categorization: calculate_color_categorization_tendency(colormap) || 0,
        };

        const elapsed = Date.now() - startTime;
        const m = metricsCache[cmId];
        console.log(` done (${elapsed}ms) CIE=${m.ciede2000_discriminative.toFixed(1)} CNV=${m.color_name_variation.toFixed(3)} CCT=${m.categorization.toFixed(1)}`);
    }

    // 5. Merge metrics into result rows
    console.log('\n5. 合并指标到数据行...');
    const metricNames = [
        'ciede2000_discriminative', 'contrast_sensitivity', 'hue_discriminative',
        'luminance_variation', 'chromatic_variation', 'LAB_Length',
        'color_name_variation', 'categorization'
    ];

    for (const row of rows) {
        const cmId = parseInt(row.colormapId);
        const metrics = metricsCache[cmId];

        for (const name of metricNames) {
            row[name] = metrics ? metrics[name] : '';
        }

        // Rename columns
        if (row.isCorrect !== undefined) {
            row.correct = row.isCorrect;
        }
        if (row.reactionTimeMs !== undefined) {
            row.reactionTime = row.reactionTimeMs;
        }

        // Log transforms
        const cat = parseFloat(row.categorization) || 0;
        const labLen = parseFloat(row.LAB_Length) || 0;
        const hueDisc = parseFloat(row.hue_discriminative) || 0;
        const lumVar = parseFloat(row.luminance_variation) || 0;
        const chrVar = parseFloat(row.chromatic_variation) || 0;
        const cnv = parseFloat(row.color_name_variation) || 0;

        row.log_categorization = Math.log(cat + 1);
        row.logLAB_Length = Math.log(labLen + 1);
        row.log_hue_discriminative = Math.log(hueDisc + 0.1);
        row.log_luminance_variation = Math.log(lumVar + 1);
        row.log_chromatic_variation = Math.log(chrVar + 1);
        row.log_color_name_variation = Math.log(cnv + 0.01);
    }

    // 6. Write output
    console.log('\n6. 保存结果...');
    const outputDir = path.join(__dirname, 'output_data');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Build header list (original headers + new ones)
    const originalHeaders = Object.keys(rows[0]).filter(h =>
        !metricNames.includes(h) &&
        !h.startsWith('log_') && h !== 'logLAB_Length' &&
        h !== 'correct' && h !== 'reactionTime'
    );
    const allHeaders = [
        ...originalHeaders,
        'correct', 'reactionTime',
        ...metricNames,
        'log_categorization', 'logLAB_Length', 'log_hue_discriminative',
        'log_luminance_variation', 'log_chromatic_variation', 'log_color_name_variation'
    ];

    const outputPath = path.join(outputDir, 'result_for_R.csv');
    fs.writeFileSync(outputPath, writeCSV(rows, allHeaders));
    console.log(`   保存至: ${outputPath}`);

    // 7. Summary
    console.log('\n=== 处理完成 ===');
    console.log(`总行数: ${rows.length}`);
    const participants = new Set(rows.map(r => r.participantId));
    console.log(`参与者数: ${participants.size}`);
    const cmIds = new Set(rows.map(r => r.colormapId));
    console.log(`色彩映射数: ${cmIds.size}`);

    // Print sample metrics
    console.log('\n--- 指标样本 (ID=0) ---');
    if (metricsCache[0]) {
        const m = metricsCache[0];
        for (const [k, v] of Object.entries(m)) {
            console.log(`  ${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`);
        }
    }
}

main();
