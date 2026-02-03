function Gabor(mX, mY, delta, lambda, angle, aspect, scaler)
{
    this.mX = mX;
    this.mY = mY;
    this.delta = delta;
    this.sigma = delta/2;
    this.sigma2 = Math.pow(this.sigma, 2);
    this.lambda = lambda;
    this.angle = angle;
    this.aspect = aspect;
    this.aspect2 = aspect * aspect;
    this.phase = 0;
    this.scaler = scaler;

    this.cosAngle = Math.cos(-this.angle);
    this.sinAngle = Math.sin(-this.angle);
}

Gabor.prototype.getSigmaX = function() { return this.delta; }
Gabor.prototype.getSigmaY = function() { return this.delta / this.aspect; }
Gabor.prototype.updateSigmaX = function(delta)
{
    var sigmaY = this.getSigmaY();
    this.delta = delta;
    this.sigma = delta/2;
    this.sigma2 = Math.pow(this.sigma, 2);
    this.aspect = delta / sigmaY;
    this.aspect2 = Math.pow(this.aspect, 2);
}
Gabor.prototype.updateSigmaY = function(delta) {
    var sigmaY = delta/2;
    this.aspect = this.sigma/sigmaY;
    this.aspect2 = Math.pow(this.aspect, 2);
}

Gabor.prototype.getAspectRatio = function() { return this.aspect; }
Gabor.prototype.getAngle = function() { return this.angle; }
Gabor.prototype.updateAngle = function(angle) {
    this.angle = angle;
    this.cosAngle = Math.cos(-this.angle);
    this.sinAngle = Math.sin(-this.angle);
}

Gabor.prototype.copy = function()
{
    return new Gabor(
        this.mX, this.mY, this.delta, this.lambda, this.angle, this.aspect, this.scaler
    );
}

Gabor.prototype.perturb = function()
{
}

Gabor.prototype.eval = function(_x, _y)
{
    var x = _x - this.mX;
    var y = _y - this.mY;

    var xPrime =  x * this.cosAngle + y * this.sinAngle;
    var yPrime = -x * this.sinAngle + y * this.cosAngle;

    var e = (Math.pow(xPrime, 2) + this.aspect2 * Math.pow(yPrime, 2)) / (2 * this.sigma2);
    var s = 2 * Math.PI * (xPrime/this.lambda) + this.phase;

    return this.scaler * Math.exp(-e) * Math.sin(s);
}

function GaborContour(x, y, radius, delta, lambda, scaler)
{
    var ANGLE = 0, ASPECT = 1;

    this.radius = radius;
    this.mX = x;
    this.mY = y;
    this.delta = delta;
    this.lambda = lambda;
    this.gaborPatch = new Gabor(0, 0, delta, lambda, ANGLE, ASPECT, 1.0);
    this.scaler = scaler;
    this.noisePhase = Math.random()*1000;

    this.invisible = true;
}
GaborContour.prototype.perturb = function ()
{
}
GaborContour.prototype.copy = function ()
{
    return new GaborContour(this.mX, this.mY, this.radius, this.delta, this.lambda, this.scaler);
}

GaborContour.prototype.eval = function(x, y)
{
    var GABOR_SIGNAL = 1;
    var dX = x - this.mX;
    var dY = y - this.mY;
    var d = Math.sqrt(Math.pow(dX, 2) + Math.pow(dY, 2)) - this.radius;
    var angle = Math.atan2(dY, dX)

    this.gaborPatch.updateAngle(-angle/4);

    // generate noise to scale the contour by
    // (so that it doesn't look like a sharp circle)
    var x = Math.cos(angle) * 5 + this.noisePhase;
    var r = 0.4 * (-1.6 * Math.sin(-1.4 * x) - 0.3 * Math.sin(2.4 * Math.E * x) + 0.9 * Math.sin(0.3 * Math.PI * x));
    r = .5 * (r + 1);

    return this.scaler * this.gaborPatch.eval(d, 0) * GABOR_SIGNAL * r;
}

/* parameters that control noise characteristics */
/* ============================================= */
var NOISE_AMP_MULTIPLIER = 0;

// how much to expend/contract noise ring by
var NOISE_PERTURB = 1.75;

var NOISE_THICKNESS = .1;

// complexity of noise shape: 1 is a regular circle; higher is a more complex sinusodial shape
var NOISE_COMPLEXITY = 1.7;

// number of noise clusters to perturb
var NOISE_PERTURB_COUNT = 2;

function ClusterOfGauss(x, y, clusterSize, gaussCount, amplitude)
{
    this.x = x;
    this.y = y;

    this.invisible = true;
    this.clusterSize = clusterSize;
    this.members = [];
    this.amplitude = amplitude;

    var clusterRange = {
        x: [Number.MAX_VALUE, Number.MIN_VALUE],
        y: [Number.MAX_VALUE, Number.MIN_VALUE]
    };

    // make is a negative cluster?
    this.negative = Math.random() < .5 ? true : false;

    var theoreticalRange = [0, 0];

    var centroid = {x: this.x, y: this.y};

    for (var g=0; g<gaussCount; g++)
    {
        // gauss center: perturb up to 50% of clusterSize around cluster center
        var mx = this.x + (Math.random()*2-1) * .3 * this.clusterSize;
        var my = this.y + (Math.random()*2-1) * .3 * this.clusterSize;

        // standard deviation
        var MIN_SIGMA = .5 * this.clusterSize * .75;
        var MAX_SIGMA = .5 * this.clusterSize * 1.5;

        var sigmaX = Math.random()*(MAX_SIGMA-MIN_SIGMA) + MIN_SIGMA;
        var sigmaY = Math.random()*(MAX_SIGMA-MIN_SIGMA) + MIN_SIGMA;

        clusterRange.x[0] = Math.min(clusterRange.x[0], mx - sigmaX);
        clusterRange.x[1] = Math.max(clusterRange.x[1], mx + sigmaX);
        clusterRange.y[0] = Math.min(clusterRange.y[0], my - sigmaY);
        clusterRange.y[1] = Math.max(clusterRange.y[1], my + sigmaY);
        centroid.x += (mx - this.x) / gaussCount;
        centroid.y += (my - this.y) / gaussCount;

        // correlation for gaussians (limit to -0.3 to 0.3)
        var rho = (Math.random()*2-1) * .6;
        //var amp = Math.random() * (amplitude[1]-amplitude[0]) + amplitude[0];
        var amp = amplitude[0];
        if (this.negative) {
            amp *= -1;
        }

        // gaussian
        var gauss = new biGauss(mx, my, sigmaX, sigmaY, rho, amp);

        // evaluate gauss at center and at 1.5 SD
        theoreticalRange[1] += gauss.eval(mx, my);
        theoreticalRange[0] += gauss.eval(mx+sigmaX*1.5, my+sigmaY*1.5);

        this.members.push(gauss);
    }

    this.cX = centroid.x;
    this.cY = centroid.y;
    this.spatialRange = clusterRange;
    this.valueRange = theoreticalRange;
    this.densityEnabled = true;
    this.noiseEnabled = false;
}
ClusterOfGauss.prototype.enableNoise = function()
{
    this.noiseEnabled = true;
}

ClusterOfGauss.prototype.disableDensity = function()
{
    this.densityEnabled = false;
}



ClusterOfGauss.prototype.eval = function(x, y)
{
    var v = 0, density = 0, noise = 0;
    var models = this.members;

    for (var i=0, len = models.length; i<len; i++)
    {
        v += models[i].eval(x, y);
    }

    // add density?
    if (this.densityEnabled)
    {
        density += v;
    }

    // add noise?
    if (this.noiseEnabled)
    {
        var angle = Math.atan2(y-this.cY, x-this.cX) * NOISE_COMPLEXITY;
        var sine = Math.cos(angle) * this.noiseRingSize;
        var noiseRange = [this.noiseRange[0]+sine, this.noiseRange[1]+sine];

        if (v >= noiseRange[0] && v <= noiseRange[1])
        {
            var n = (v-noiseRange[0]) / (noiseRange[1]-noiseRange[0]);
            var s = Math.sin(n*Math.PI*2);

            density += this.noiseAmplitude * s;
        }
    }

    return density;
}

ClusterOfGauss.prototype.copy = function()
{
    var c = new ClusterOfGauss(this.x, this.y, this.clusterSize, 0, this.amplitude);
    c.cX = this.cX;
    c.cY = this.cY;
    c.w  = this.w;
    c.h = this.h;

    for (var i=0; i<this.members.length; i++) {
        c.members.push(this.members[i].copy());
    }

    c.negative = this.negative;
    c.invisible = this.invisible;

    //c.spatialRange = this.spatialRange.slice();
    c.valueRange = this.valueRange.slice();

    if (this.originalNoiseRange) {
        c.originalNoiseRange = this.originalNoiseRange.slice();
    }

    if (this.noiseRange) {
        c.noiseRange = this.noiseRange.slice();
    }

    c.noiseAmplitude = this.noiseAmplitude;
    c.noisePerturb = this.noisePerturb;
    c.noiseRingSize = this.noiseRingSize;

    c.noiseEnabled = this.noiseEnabled;
    c.densityEnabled = this.densityEnabled;

    return c;
}

ClusterOfGauss.prototype.perturbNoise = function()
{
    if (this.dontPerturbNoise) {
        return;
    }
    else {

        if (!this.originalNoiseRange) {
            this.originalNoiseRange = this.noiseRange.slice();
        }

        var perturbExtent = NOISE_PERTURB;
        this.noiseRange[0] = this.originalNoiseRange[0] + this.noisePerturb * perturbExtent;
        this.noiseRange[1] = this.originalNoiseRange[1] + this.noisePerturb * perturbExtent;
    }
}

ClusterOfGauss.prototype.perturbDensity = function()
{
    var models = this.members;
    for (var i=0, len=models.length; i<len; i++)
    {
        var m = models[i];

        // perturb centers of densities
        var l = 0;
        var r = [0, 0];
        do {
            r = [Math.random()*2-1, Math.random()*2-1];
            l = r[0]*r[0]+r[1]*r[1];
        } while (l==0);

        l = (M_PERTURB * Math.min(this.w, this.h)) / Math.sqrt(l);

        m.mX += r[0] * l;
        m.mY += r[1] * l;

        var rhoP = (Math.random() > .5 ? 1 : -1) * (Math.random() * R_PERTURB);
        //m.perturb(rhoP);
    }
}

ClusterOfGauss.prototype.createNoise = function()
{
    var valRange = this.valueRange[1]-this.valueRange[0];

    // where is the "noise" contour is located at?
    var noiseContour = .7 * valRange;   // old: valRange

    // thickness of the contour
    var noiseRingSize = valRange * NOISE_THICKNESS;
    this.noiseRingSize = noiseRingSize;

    var sign = this.negative ? -1.0 : 1.0;
    this.noiseRange = [noiseContour - sign * noiseRingSize, noiseContour + sign * noiseRingSize];

    this.noiseAmplitude = sign * this.valueRange[1] * .0665 * NOISE_AMP_MULTIPLIER;
    this.noisePerturb = noiseRingSize * (Math.random()<.5 ? -1 : 1);
    this.noiseEnabled = true;
}

function GaussMixWithNoise(w, h, svg)
{
    GaussMixBivariate.call(this, w, h, svg);
}

// which model to perturb (1 for gaussian density, 2 for noise)
var DEFAULT_PERTURB_MODEL = 1;

// chain with parent class
GaussMixWithNoise.prototype = Object.create(GaussMixBivariate.prototype);

GaussMixWithNoise.prototype.randomPerturb = function(modelNumber)
{
    var models = this.models;
    if (!modelNumber) {
        modelNumber = DEFAULT_PERTURB_MODEL;
    }

    for (var i=0, len=models.length; i<len; i++)
    {
        var m = models[i];
        if (modelNumber == 1 && m.densityEnabled)
        {
            m.perturbDensity();
        }
        else if (modelNumber == 2 && m.noiseEnabled)
        {
            if (i<NOISE_PERTURB_COUNT) {
                m.perturbNoise();
            }
        }
    }
    this.updateModel();

}
GaussMixWithNoise.prototype.addCluster = function(_clusterSize, amplitude, clusterList)
{
    var MAX_ITERATIONS = 100;

    // padding as 7% of width/height
    var padX = this.w * .05;
    var padY = this.h * .05;

    // cluster width / height as 15%
    var clusterSize = Math.min(this.w, this.h) * _clusterSize;
    var minClusterDist = clusterSize * 1.0;

    var W = this.w - padX*2;
    var H = this.h - padY*2;

    if (!clusterList) {
        clusterList = this.clusters;
    }
    var generated = true, x, y, iter=0;
    do
    {
        // generate cluster centroid
        x = Math.random() * W + padX;
        y = Math.random() * H + padY;

        // scan list of existing clusters and make sure we're not too close
        // to an existing cluster
        for (var i=0; i<clusterList.length; i++)
        {
            var c = clusterList[i];
            var d = Math.sqrt(Math.pow(c.cX-x, 2) + Math.pow(c.cY-y, 2));
            if (d < minClusterDist)
            {
                // too close
                generated = false;
                break;
            }
            else {
                generated = true;
            }
        }
        iter++;
    } while(++iter < MAX_ITERATIONS && !generated)

    if (!generated)
    {
        return null;
    }

    // how many gaussians?
    var MIN_GAUSS = 3;
    var MAX_GAUSS = 3;
    var gaussCount = MIN_GAUSS + Math.floor(.5 + Math.random() * (MAX_GAUSS-MIN_GAUSS));
    var cluster = new ClusterOfGauss(x, y, clusterSize, gaussCount, amplitude);
    cluster.w = this.w;
    cluster.h = this.h;

    /*
    // gabor patch
    var GABOR_CYCLES = 20;
    var LAMBDA = this.w / GABOR_CYCLES, ANGLE = 0, ASPECT = 1;
    var DELTA = 10;

    //var gabor = new Gabor(mx, my, sigmaX, LAMBDA, ANGLE, ASPECT, scaler * amp);

    if (this.clusters.length <= 1)
    {
        var scaler = cluster.negative ? -1.0 : 1.0;
        var sigma = Math.max(cluster.range.x[1]-cluster.range.x[0], cluster.range.y[1]-cluster.range.y[0]);

        var contour = new GaborContour(cluster.cX, cluster.cY, sigma*.5, DELTA, LAMBDA, scaler);
        this.models.push(contour);
    }
    */

    clusterList.push(cluster);

    return cluster;

}


GaussMixWithNoise.prototype.init = function()
{
    // large clusters: low frequency / high-amplitude
    var MIN_CLUSTERS = 6;
    var MAX_CLUSTERS = 6;

    // how many of the clusters have noise?
    var NOISE_RATIO = 1/2;


    var CLUSTER_SIZE = 0.4;   // 40% of min(width,height)
    var SMALL_CLUSTER_SIZE = 0.05;
    var CLUSTER_AMPLITUDE = [1.0, 1.0];
    var SMALL_CLUSTER_AMPLITUDE = [.01/1.5, .01/1.5];

    this.clusters = [];
    this.models = [];


    // create clusters, large and small
    var success=false, iter=0, MAX_ITER=200;
    do {
        success = true;

        // how many clusters to create
        var clusterCount = Math.floor(.5 + Math.random() * (MAX_CLUSTERS-MIN_CLUSTERS)) + MIN_CLUSTERS;

        // determine which clusters should have noise on them
        var noiseCount = Math.floor(clusterCount * NOISE_RATIO + .5);
        var noiseList = [], noiseClusters = [];
        for (var i=0; i<clusterCount; i++) {
            noiseList.push(i)
        }

        // permute noise list
        for (var i=0; i<50; i++)
        {
            var r=Math.floor(Math.random() * clusterCount);
            var s=Math.floor(Math.random() * clusterCount);
            if (r!=s) {
                var t = noiseList[r];
                noiseList[r]=noiseList[s];
                noiseList[s]=t;
            }
        }

        // top noiseCount are the ones with noise
        var hasNoise = {};
        for (var i=0;i<noiseCount; i++) {
            hasNoise[noiseList[i]] = true;
        }

        for (var i=0; i<clusterCount; i++)
        {
            var cluster = this.addCluster(CLUSTER_SIZE, CLUSTER_AMPLITUDE);

            if (!cluster)
            {
                success = false;
                break;
            }

            // add cluster to list of models
            this.models.push(cluster);

            if (hasNoise[i])
            {
                // create a new noise cluster
                var noise = this.addCluster(1.3*CLUSTER_SIZE, CLUSTER_AMPLITUDE, noiseClusters)
                if (!noise) {
                    success = false;
                    break;
                }

                // or copy existing ones (this aligns the boundaries of the noise with the cluster)
                //var noise = cluster.copy();

                // addd noise and disable
                noise.createNoise();
                noise.disableDensity();

                /*
                if (noiseClusters.length > NOISE_PERTURB_COUNT) {
                    noiseClusters.dontPerturbNoise = true;
                }
                */

                this.models.push(noise);
            }
        }

        if (!success)
        {
            // reset model and try again
            this.clusters = [];
            this.models = [];
        }
    } while(!success && ++iter <= MAX_ITER);

    if (!success) {
        console.error("Could not generate cluster after " + iter + " tries");
    }

    // sort model so that noise is on to (for debugging)
    this.models.sort(function(a, b) { return a.noiseEnabled ? -1 : 1});

    this.updateModel();
}

GaussMixWithNoise.prototype.copyTo = function(newModel, dontUpdate)
{
    if (!newModel) {
        newModel = new GaussMixWithNoise(this.w, this.h, null);
    }
    else {
        newModel.w = this.w;
        newModel.h = this.h;
    }

    newModel.models = [];
    for (var i=0; i<this.models.length; i++)
    {
        var m = this.models[i];
        newModel.models.push( m.copy() );
    }
    if (!dontUpdate) {
        newModel.updateModel();
    }
    return newModel;
}
