/**
 * 生成完整的组别-频率-色图映射表
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

const fs = require('fs');
const colormapsData = JSON.parse(fs.readFileSync('./static/colormaps.json', 'utf8'));

const colormaps = colormapsData.map(item => ({
    id: item.id,
    hue: item.metadata.hueTarget,
    chromaPattern: item.metadata.chromaPattern,
    lumiPattern: item.metadata.lumiPattern
}));

// 使用实验的固定种子
const globalRng = new SeededRandom("GLOBAL_EXPERIMENT_SEED_V1");
const shuffledColormaps = [...colormaps];
globalRng.shuffle(shuffledColormaps);

// 分成3个Chunk
const chunkSize = 16;
const chunks = [
    shuffledColormaps.slice(0, chunkSize),              // Chunk A (索引 0)
    shuffledColormaps.slice(chunkSize, chunkSize * 2),  // Chunk B (索引 1)
    shuffledColormaps.slice(chunkSize * 2, chunkSize * 3) // Chunk C (索引 2)
];

const chunkNames = ['A', 'B', 'C'];

console.log('=' .repeat(100));
console.log('实验分组-频率-色图完整映射表');
console.log('=' .repeat(100));

// 为每个组生成映射
for (let group = 0; group < 3; group++) {
    console.log(`\n${'█'.repeat(100)}`);
    console.log(`█ GROUP ${group}`.padEnd(99) + '█');
    console.log('█'.repeat(100));
    
    const assignments = {
        'low': chunks[(group + 0) % 3],
        'medium': chunks[(group + 1) % 3],
        'high': chunks[(group + 2) % 3]
    };
    
    const frequencies = [
        { id: 'low', target: 'large', ssim: 0.954 },
        { id: 'medium', target: 'medium', ssim: 0.982 },
        { id: 'high', target: 'small', ssim: 0.956 }
    ];
    
    frequencies.forEach(freq => {
        const assignedColormaps = assignments[freq.id];
        const chunkIndex = (group + (freq.id === 'low' ? 0 : freq.id === 'medium' ? 1 : 2)) % 3;
        
        console.log(`\n┌${'─'.repeat(98)}┐`);
        console.log(`│ 频率: ${freq.id.toUpperCase().padEnd(6)} | 目标大小: ${freq.target.padEnd(6)} | 目标SSIM: ${freq.ssim} | 使用Chunk: ${chunkNames[chunkIndex]}`.padEnd(99) + '│');
        console.log(`├${'─'.repeat(98)}┤`);
        
        console.log(`│ 色图ID列表 (共${assignedColormaps.length}个):`.padEnd(99) + '│');
        console.log(`│   ${assignedColormaps.map(c => c.id.toString().padStart(2)).join(', ')}`.padEnd(99) + '│');
        console.log(`├${'─'.repeat(98)}┤`);
        console.log(`│ 详细信息:`.padEnd(99) + '│');
        
        assignedColormaps.forEach((colormap, i) => {
            const line = `│   ${(i + 1).toString().padStart(2)}. ID=${colormap.id.toString().padStart(2)} | Hue=${colormap.hue.toString().padStart(3)} | Chroma=${colormap.chromaPattern.padEnd(10)} | Lumi=${colormap.lumiPattern.padEnd(10)}`;
            console.log(line.padEnd(99) + '│');
        });
        
        console.log(`└${'─'.repeat(98)}┘`);
    });
}

console.log(`\n${'='.repeat(100)}`);
console.log('快速查询表');
console.log('='.repeat(100));

console.log('\n┌────────┬──────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐');
console.log('│ Group  │ Low频率 (large, SSIM=0.954)     │ Medium频率 (medium, SSIM=0.982) │ High频率 (small, SSIM=0.956)    │');
console.log('├────────┼──────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤');

for (let group = 0; group < 3; group++) {
    const assignments = {
        'low': chunks[(group + 0) % 3],
        'medium': chunks[(group + 1) % 3],
        'high': chunks[(group + 2) % 3]
    };
    
    const lowChunk = chunkNames[(group + 0) % 3];
    const medChunk = chunkNames[(group + 1) % 3];
    const highChunk = chunkNames[(group + 2) % 3];
    
    const lowIds = assignments['low'].map(c => c.id).join(',');
    const medIds = assignments['medium'].map(c => c.id).join(',');
    const highIds = assignments['high'].map(c => c.id).join(',');
    
    console.log(`│ ${group}      │ Chunk ${lowChunk}                        │ Chunk ${medChunk}                        │ Chunk ${highChunk}                        │`);
    console.log(`│        │ ${lowIds.substring(0, 30).padEnd(30)}   │ ${medIds.substring(0, 30).padEnd(30)}   │ ${highIds.substring(0, 30).padEnd(30)}   │`);
    if (group < 2) {
        console.log('├────────┼──────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤');
    }
}

console.log('└────────┴──────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘');

// 生成JSON格式的映射文件
const mappingData = {};
for (let group = 0; group < 3; group++) {
    mappingData[`group${group}`] = {
        low: {
            chunk: chunkNames[(group + 0) % 3],
            chunkIndex: (group + 0) % 3,
            colormapIds: chunks[(group + 0) % 3].map(c => c.id),
            targetSize: 'large',
            targetSSIM: 0.954
        },
        medium: {
            chunk: chunkNames[(group + 1) % 3],
            chunkIndex: (group + 1) % 3,
            colormapIds: chunks[(group + 1) % 3].map(c => c.id),
            targetSize: 'medium',
            targetSSIM: 0.982
        },
        high: {
            chunk: chunkNames[(group + 2) % 3],
            chunkIndex: (group + 2) % 3,
            colormapIds: chunks[(group + 2) % 3].map(c => c.id),
            targetSize: 'small',
            targetSSIM: 0.956
        }
    };
}

fs.writeFileSync('./group_colormap_mapping.json', JSON.stringify(mappingData, null, 2));
console.log('\n✅ 映射数据已保存到: group_colormap_mapping.json');
