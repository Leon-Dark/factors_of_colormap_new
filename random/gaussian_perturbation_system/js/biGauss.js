/**
 * Bivariate Gaussian Distribution
 * 二元高斯分布类 - 与旧版本完全兼容
 */

function biGauss(mX, mY, sX, sY, rho, scaler) {
    this.mX = mX;
    this.mY = mY;
    this.sX = sX;
    this.sY = sY;
    this.updateRho(rho);
    this.scaler = (scaler ? scaler : 1);
    
    // 存储原始参数（用于扰动后恢复）
    this.originalMX = mX;
    this.originalMY = mY;
    this.originalSX = sX;
    this.originalSY = sY;
    this.originalRho = rho;
    this.originalScaler = scaler;
    
    this.isPerturbed = false;
    this.id = Math.random().toString(36).substr(2, 9);
}

biGauss.prototype.getSigmaX = function () { return this.sX; }
biGauss.prototype.getSigmaY = function () { return this.sY; }
biGauss.prototype.updateSigmaX = function (_sX) { this.sX = _sX; }
biGauss.prototype.updateSigmaY = function (_sY) { this.sY = _sY; }

biGauss.prototype.copy = function () {
    return new biGauss(this.mX, this.mY, this.sX, this.sY, this.rho, this.scaler);
}

biGauss.prototype.updateRho = function (_rho) {
    this.rho = _rho;
    this.rho2 = this.rho * this.rho;
    this.rhoExpConst = -1 / (2 * (1 - this.rho2));
    this.rhoSqrConst = 1 / (2 * Math.PI * Math.sqrt(1 - this.rho2));
}

biGauss.prototype.perturb = function (rhoP) {
    var newRho = this.rho + rhoP;
    if (newRho > 1 || newRho < -1) {
        rhoP *= -1;
        newRho = this.rho + rhoP;
    }
    this.updateRho(newRho);
}

biGauss.prototype.eval = function (x, y) {
    var stX = (x - this.mX) / this.sX;
    var stY = (y - this.mY) / this.sY;
    var stXY = stX * stY;

    var e = this.rhoExpConst * (stX * stX - 2 * this.rho * stXY + stY * stY);
    var a = this.rhoSqrConst * (1 / (this.sX * this.sY))

    return this.scaler * Math.exp(e) * a;
}

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
