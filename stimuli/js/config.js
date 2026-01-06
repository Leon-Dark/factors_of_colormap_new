// Global Configuration and State Management

// Global arrays for colormaps and DOM elements
let allColormaps = [];
let colormapElements = [];

// Sampling mode: 'jnd' or 'uniform'
let SAMPLING_MODE = 'jnd';

// JND mode parameters
let JND_STEP = 3.0;
let SAMPLE_INTERVAL_K = 5;
let MIN_INTERVAL_DIFF_J = 10;

// Uniform mode parameters
let UNIFORM_SAMPLE_COUNT = 10;
let UNIFORM_MIN_DIFF_THRESHOLD = 10;

// Color generation parameters
const COLOR_SPACE_PARAMS = {
    hueTargets: [100, 200, 300],
    chromas: [20, 120],
    lumis: [20, 90]
};

// Retry iteration parameters
let RETRY_MAX_ITERATIONS = 3;        // 最大迭代次数
let RETRY_SEARCH_RANGE_EXPAND = 10;  // 每次迭代扩大搜索范围

// Retry state tracking
let retryHistory = [];               // 记录每轮迭代的改良数量
let isRetrying = false;              // 是否正在进行重试
