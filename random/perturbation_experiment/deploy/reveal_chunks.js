/**
 * 重现实验中的色图打乱过程
 * 使用与实验相同的种子和算法
 */

class SeededRandom {
    constructor(seed) {
        this.seed = this._hashString(String(seed));
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }

    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

// 读取色图数据
const fs = require('fs');
const colormapsData = JSON.parse(fs.readFileSync('./static/colormaps.json', 'utf8'));

// 提取色图ID和元数据
const colormaps = colormapsData.map(item => ({
    id: item.id,
    hue: item.metadata.hueTarget,
    chromaPattern: item.metadata.chromaPattern,
    lumiPattern: item.metadata.lumiPattern
}));

console.log(`总共 ${colormaps.length} 个色图\n`);

// 使用与实验相同的种子
const globalRng = new SeededRandom("GLOBAL_EXPERIMENT_SEED_V1");

// 克隆并打乱
const shuffledColormaps = [...colormaps];
globalRng.shuffle(shuffledColormaps);

// 分成3个Chunk
const chunkSize = 16;
const chunks = [
    shuffledColormaps.slice(0, chunkSize),              // Chunk A (索引 0)
    shuffledColormaps.slice(chunkSize, chunkSize * 2),  // Chunk B (索引 1)
    shuffledColormaps.slice(chunkSize * 2, chunkSize * 3) // Chunk C (索引 2)
];

// 输出结果
console.log('='.repeat(80));
console.log('全局打乱后的3个Chunk分布');
console.log('='.repeat(80));

chunks.forEach((chunk, chunkIndex) => {
    console.log(`\n📦 Chunk ${String.fromCharCode(65 + chunkIndex)} (索引 ${chunkIndex}):`);
    console.log('-'.repeat(80));
    console.log('色图ID列表:', chunk.map(c => c.id).join(', '));
    console.log('\n详细信息:');
    chunk.forEach((colormap, i) => {
        console.log(`  ${i + 1}. ID=${colormap.id.toString().padStart(2)} | Hue=${colormap.hue} | Chroma=${colormap.chromaPattern.padEnd(10)} | Lumi=${colormap.lumiPattern}`);
    });
});

console.log('\n' + '='.repeat(80));
console.log('拉丁方分配规则:');
console.log('='.repeat(80));
console.log('Group 0: Low=Chunk A (0) | Medium=Chunk B (1) | High=Chunk C (2)');
console.log('Group 1: Low=Chunk B (1) | Medium=Chunk C (2) | High=Chunk A (0)');
console.log('Group 2: Low=Chunk C (2) | Medium=Chunk A (0) | High=Chunk B (1)');
console.log('='.repeat(80));

// 额外：输出每个Chunk的统计信息
console.log('\n统计信息:');
chunks.forEach((chunk, chunkIndex) => {
    const hues = {};
    const chromas = {};
    const lumis = {};

    chunk.forEach(c => {
        hues[c.hue] = (hues[c.hue] || 0) + 1;
        chromas[c.chromaPattern] = (chromas[c.chromaPattern] || 0) + 1;
        lumis[c.lumiPattern] = (lumis[c.lumiPattern] || 0) + 1;
    });

    console.log(`\nChunk ${String.fromCharCode(65 + chunkIndex)}:`);
    console.log(`  Hue分布: ${JSON.stringify(hues)}`);
    console.log(`  Chroma模式: ${JSON.stringify(chromas)}`);
    console.log(`  Lumi模式: ${JSON.stringify(lumis)}`);
});
