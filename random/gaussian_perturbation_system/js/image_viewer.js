class ImageViewer {
    constructor() {
        this.btnLoad = document.getElementById('btn-load');
        this.loadingText = document.getElementById('loading');
        this.galleryContent = document.getElementById('gallery-content');
        
        this.imageBasePath = 'batch_generator_nodejs/output/images/';
        this.isLoading = false;
        
        this.bindEvents();
    }

    bindEvents() {
        this.btnLoad.addEventListener('click', () => this.loadGallery());
    }

    async loadGallery() {
        // Prevent multiple simultaneous loads
        if (this.isLoading) {
            console.log('Already loading, please wait...');
            return;
        }
        
        this.isLoading = true;
        this.btnLoad.disabled = true;
        this.loadingText.style.display = 'block';
        this.galleryContent.innerHTML = '';

        const ssimStart = parseFloat(document.getElementById('ssim-start').value);
        const ssimEnd = parseFloat(document.getElementById('ssim-end').value);
        const ssimStep = parseFloat(document.getElementById('ssim-step').value);
        const repetitions = parseInt(document.getElementById('repetitions').value);

        const selectedFrequencies = [];
        if (document.getElementById('freq-low').checked) selectedFrequencies.push('low');
        if (document.getElementById('freq-medium').checked) selectedFrequencies.push('medium');
        if (document.getElementById('freq-high').checked) selectedFrequencies.push('high');

        if (selectedFrequencies.length === 0) {
            alert('Please select at least one frequency!');
            this.btnLoad.disabled = false;
            this.loadingText.style.display = 'none';
            return;
        }

        // Generate SSIM targets
        const ssimTargets = [];
        if (ssimStart <= ssimEnd) {
            for (let v = ssimStart; v <= ssimEnd + 0.0001; v += ssimStep) {
                ssimTargets.push(parseFloat(v.toFixed(5)));
            }
        } else {
            for (let v = ssimStart; v >= ssimEnd - 0.0001; v -= ssimStep) {
                ssimTargets.push(parseFloat(v.toFixed(5)));
            }
        }

        const frequencyMap = {
            'low': { name: 'Low Complexity', headerClass: 'header-low' },
            'medium': { name: 'Medium Complexity', headerClass: 'header-medium' },
            'high': { name: 'High Complexity', headerClass: 'header-high' }
        };

        for (const freq of selectedFrequencies) {
            const section = document.createElement('div');
            section.className = 'section-frequency';

            section.innerHTML = `
                <div class="section-header ${frequencyMap[freq].headerClass}">${frequencyMap[freq].name}</div>
                <div class="stimuli-grid" id="grid-${freq}"></div>
            `;

            this.galleryContent.appendChild(section);
            const grid = document.getElementById(`grid-${freq}`);

            for (const ssim of ssimTargets) {
                for (let rep = 0; rep < repetitions; rep++) {
                    await this.createImageCard(grid, freq, ssim, rep);
                }
            }
        }

        this.isLoading = false;
        this.btnLoad.disabled = false;
        this.loadingText.style.display = 'none';
    }

    async createImageCard(grid, frequency, targetSSIM, repIndex) {
        const card = document.createElement('div');
        card.className = 'stimuli-card';

        const title = document.createElement('h4');
        title.innerHTML = `Target SSIM: ${targetSSIM.toFixed(5)}<br><span style="font-size:10px; font-weight:normal">Loading...</span>`;
        card.appendChild(title);

        const imagePair = document.createElement('div');
        imagePair.className = 'image-pair';

        const imgOriginal = document.createElement('img');
        const imgPerturbed = document.createElement('img');
        imgOriginal.alt = 'Original';
        imgPerturbed.alt = 'Perturbed';

        imagePair.appendChild(imgOriginal);
        imagePair.appendChild(imgPerturbed);
        card.appendChild(imagePair);

        const labels = document.createElement('div');
        labels.className = 'labels';
        labels.innerHTML = '<span>Original</span><span>Perturbed</span>';
        card.appendChild(labels);

        grid.appendChild(card);

        // Try to find and load the image with random rep selections
        const ssimStr = targetSSIM.toFixed(5);
        const result = await this.findAndLoadImage(frequency, ssimStr);
        
        if (result.success) {
            imgOriginal.src = result.originalPath;
            imgPerturbed.src = result.perturbedPath;
            
            title.innerHTML = `Target SSIM: ${targetSSIM.toFixed(5)}<br>` +
                `<span style="font-size:10px; font-weight:normal">` +
                `Rep:${result.rep} | Mag:${result.metadata.magnitude.toFixed(3)} | ` +
                `Actual SSIM:${result.metadata.ssim.toFixed(5)} | KL:${result.metadata.kl.toFixed(5)}` +
                `</span>`;
        } else {
            title.innerHTML = `Target SSIM: ${targetSSIM.toFixed(5)}<br>` +
                `<span style="font-size:10px; font-weight:normal; color:red">No data found</span>`;
            
            imgOriginal.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23ffe6e6"/%3E%3Ctext x="50%25" y="50%25" font-size="14" text-anchor="middle" dy=".3em" fill="%23cc0000"%3ENo data%3C/text%3E%3C/svg%3E';
            imgPerturbed.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23ffe6e6"/%3E%3Ctext x="50%25" y="50%25" font-size="14" text-anchor="middle" dy=".3em" fill="%23cc0000"%3ENo data%3C/text%3E%3C/svg%3E';
        }
    }

    async findAndLoadImage(frequency, ssimStr) {
        // New file naming: {ID}_{frequency}_{mode}_{targetValue}_rep{repetition}_{type}
        // Generation order: rep->freq->target
        // Within each rep: low (20 SSIMs) -> medium (20 SSIMs) -> high (20 SSIMs)
        
        // Randomly select one rep to try
        const rep = Math.floor(Math.random() * 60) + 1;
        
        // Calculate the ID range for this frequency within this rep
        const ssimCountPerFreq = 20;  // Assuming 20 SSIM values per frequency
        const filesPerRep = 60;  // 3 frequencies × 20 SSIMs
        
        const repBaseId = (rep - 1) * filesPerRep;
        
        // Determine frequency offset within rep
        let freqOffset = 0;
        if (frequency === 'low') freqOffset = 0;
        else if (frequency === 'medium') freqOffset = ssimCountPerFreq;
        else if (frequency === 'high') freqOffset = ssimCountPerFreq * 2;
        
        const startId = repBaseId + freqOffset + 1;
        const endId = repBaseId + freqOffset + ssimCountPerFreq;
        
        // Search within this frequency's ID range in this rep
        for (let id = startId; id <= endId; id++) {
            const idStr = id.toString().padStart(4, '0');
            const baseName = `${idStr}_${frequency}_ssim_${ssimStr}_rep${rep}`;
            const metadataPath = `${this.imageBasePath}${baseName}_metadata.json`;
            
            try {
                const response = await fetch(metadataPath, { method: 'HEAD' });
                if (response.ok) {
                    // Found it! Load the full metadata
                    const metadataResponse = await fetch(metadataPath);
                    const metadata = await metadataResponse.json();
                    return {
                        success: true,
                        rep: rep,
                        metadata: metadata,
                        originalPath: `${this.imageBasePath}${baseName}_original.png`,
                        perturbedPath: `${this.imageBasePath}${baseName}_perturbed.png`
                    };
                }
            } catch (error) {
                // Continue searching
            }
        }
        
        // If not found in first rep, try a few more
        for (let attempt = 0; attempt < 3; attempt++) {
            const randomRep = Math.floor(Math.random() * 60) + 1;
            if (randomRep === rep) continue;
            
            const startId2 = (randomRep - 1) * filesPerRep + 1;
            const endId2 = randomRep * filesPerRep;
            
            for (let id = startId2; id <= endId2; id++) {
                const idStr = id.toString().padStart(4, '0');
                const baseName = `${idStr}_${frequency}_ssim_${ssimStr}_rep${randomRep}`;
                const metadataPath = `${this.imageBasePath}${baseName}_metadata.json`;
                
                try {
                    const response = await fetch(metadataPath, { method: 'HEAD' });
                    if (response.ok) {
                        const metadataResponse = await fetch(metadataPath);
                        const metadata = await metadataResponse.json();
                        return {
                            success: true,
                            rep: randomRep,
                            metadata: metadata,
                            originalPath: `${this.imageBasePath}${baseName}_original.png`,
                            perturbedPath: `${this.imageBasePath}${baseName}_perturbed.png`
                        };
                    }
                } catch (error) {
                    // Continue searching
                }
            }
        }
        
        console.warn(`Could not find image: ${frequency} SSIM ${ssimStr}`);
        return { success: false };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageViewer();
});
