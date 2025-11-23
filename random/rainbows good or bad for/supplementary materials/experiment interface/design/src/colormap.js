
var COLOR_INTERP_LAB = 1;
var COLOR_INTERP_JAB = 2;
var COLOR_INTERP_ELSE = 10;

function isLabColor(c)
{
	return c !== null && c !== undefined && !isNaN(c.l) && !isNaN(c.a) && !isNaN(c.b);
}

function isJabColor(c) {
	return c !== null && c !== undefined && !isNaN(c.J) && !isNaN(c.a) && !isNaN(c.b);
}

function ColorInterpolator(c1, c2, interpType)
{
	if (isLabColor(c1) || isLabColor(c2) || interpType === 'lab') {
		this.c1 = d3.lab(c1);
		this.c2 = d3.lab(c2);
		this.interpType = COLOR_INTERP_LAB;
	}
	else if (isJabColor(c1) || isJabColor(c2) || interpType==='jab') {
		this.c1 = d3.jab(c1);
		this.c2 = d3.jab(c2);
		this.interpType = COLOR_INTERP_JAB;
	}
	else
	{
		this.interpType = COLOR_INTERP_ELSE
	}
}

ColorInterpolator.prototype.interpolate = function(alpha)
{
	var c1=this.c1, c2=this.c2;
	if (this.interpType == COLOR_INTERP_LAB) {
		return d3.lab(
			c1.l + alpha * (c2.l-c1.l),
			c1.a + alpha * (c2.a-c1.a),
			c1.b + alpha * (c2.b-c1.b)
		);
	}
	else if (this.interpType == COLOR_INTERP_JAB) {
		return d3.jab(
			c1.J + alpha * (c2.J-c1.J),
			c1.a + alpha * (c2.a-c1.a),
			c1.b + alpha * (c2.b-c1.b)
		);
	}
	else {
		// add other interpolators as needed
		return null;
	}
}


function ColorMap(colorset, interpType)
{
	if (isFunction(colorset))
	{
		this.colormapFunc = colorset;
	}
	else if (colorset) {
		this.setMap(colorset, interpType)
	}
}

ColorMap.prototype.getColorSet = function() {
	return this.colorMap;
}

ColorMap.prototype.setMap = function(colorMap, interpType)
{
	if (!interpType) {
		// force interpolation in the CIELAB color space if non other specified
		interpType = 'lab';
	}
	interpType = 'lab';

	this.colorMap = colorMap || this.colorMap;
	this.colorInterpolator = [];
	this.interpType = interpType;

	if (colorMap.length > 1)
	{
		for (var i=0, len=colorMap.length; i<len-1; i++)
		{
			var range = [
				colorMap[i].value,
				colorMap[i+1].value
			];

			var interpolator = null;
			if (colorMap[i].lab && colorMap[i+1].lab)
			{
				var lab1 = colorMap[i].lab;
				var lab2 = colorMap[i+1].lab;

				if (isLabColor(lab1)) {
					lab1 = [lab1.l, lab1.a, lab1.b];
				}
				if (isLabColor(lab2)) {
					lab2 = [lab2.l, lab2.a, lab2.b];
				}

				if (interpType == 'lab')
				{
					interpolator = new ColorInterpolator(
						d3.lab(lab1[0], lab1[1], lab1[2]),
						d3.lab(lab2[0], lab2[1], lab2[2])
					);
				}
				else if (interpType == 'jab') {
					var jab1 = d3.jab( d3.lab(lab1[0], lab1[1], lab1[2]) );
					var jab2 = d3.jab( d3.lab(lab2[0], lab2[1], lab2[2]) );
					interpolator = new ColorInterpolator(
						jab1, jab2
					);
				}
				else if (interpType == 'hsl')
				{
					interpolator = d3.interpolateHsl(
						d3.lab(lab1[0], lab1[1], lab1[2]),
						d3.lab(lab2[0], lab2[1], lab2[2])
					);
				}
				else
				{
					interpolator = d3.interpolateRgb(
						d3.lab(lab1[0], lab1[1], lab1[2]),
						d3.lab(lab2[0], lab2[1], lab2[2])
					);
				}
			}
			else
			{
				// values defined in RGB
				var rgb1 = colorMap[i].rgb;
				var rgb2 = colorMap[i+1].rgb;

				if (interpType == 'lab')
				{
					interpolator = d3.interpolateLab(
						d3.rgb(rgb1[0], rgb1[1], rgb1[2]),
						d3.rgb(rgb2[0], rgb2[1], rgb2[2])
					);
				}
				else if (interpType == 'hsl')
				{
					interpolator = d3.interpolateHsl(
						d3.rgb(rgb1[0], rgb1[1], rgb1[2]),
						d3.rgb(rgb2[0], rgb2[1], rgb2[2])
					);
				}

				else
				{
					interpolator = d3.interpolateRgb(
						d3.rgb(rgb1[0], rgb1[1], rgb1[2]),
						d3.rgb(rgb2[0], rgb2[1], rgb2[2])
					);
				}

				//console.log("Error in creating ColorMap: unspecified 'lab' control points.");
			}

			this.colorInterpolator.push(
			{
				// interpolator
				interpType: interpType == 'lab' ? 1 : 0,
				interpolator: interpolator,

				// the data range
				range: range,
				_len: 1 / (range[1]-range[0]),
			});
		}
	}
}

ColorMap.prototype.getMinMax = function()
{
	if (this.colormapFunc) {
		return [0, 1];
	}
	else if (this.colorMap.length == 0) {
		return null;
	}
	else
	{
		return [
			this.colorMap[0].value,
			this.colorMap[this.colorMap.length-1].value
		];
	}
}

ColorMap.prototype.addColor = function()
{
	var minmax = this.getMinMax();
	var newCount = this.colorMap.length+1;

	var newSet = [];
	for (var i=0; i<newCount; i++)
	{
		var v = i/(newCount-1) * (minmax[1] - minmax[0]) + minmax[0];
		var c = this.mapValue(v);
		newSet.push({
			value: v,
			rgb: [c.r, c.g, c.b]
		});
	}
	this.setMap(newSet, this.interpType);
}

ColorMap.prototype.removeColor = function() {
	if (this.colorMap.length <= 2) {
		// do nothing
		return;
	}

	var minmax = this.getMinMax();
	var newCount = this.colorMap.length-1;

	var newSet = [];
	for (var i=0; i<newCount; i++)
	{
		var v = i/(newCount-1) * (minmax[1] - minmax[0]) + minmax[0];
		var c = this.mapValue(v);
		newSet.push({
			value: v,
			rgb: [c.r, c.g, c.b]
		});
	}

	this.setMap(newSet, this.interpType);
}

ColorMap.prototype.createGPUColormap = function(colorMap)
{
	if (this.gpuTexture !== undefined) {
		this.dispose();
	}

	// create an internal canvas and draw the colorscale onto it
	var internalCanvas = document.createElement('canvas');
	internalCanvas.width = 1024;
	internalCanvas.height = 1;

	// draw color scale
	if (!colorMap) {
		colorMap = this;
	}

	colorMap.drawColorScale(
		internalCanvas.width,
		internalCanvas.height,
		1024,
		'horizontal',
		internalCanvas
	);

	var texture = new THREE.CanvasTexture(
		internalCanvas,
		THREE.UVMapping,
		THREE.ClampToEdgeWrapping,
		THREE.ClampToEdgeWrapping,
		THREE.LinearFilter,
		THREE.LinearFilter,
		THREE.RGBFormat,
		THREE.UnsignedByteType
	);
	texture.needsUpdate = true;
	this.gpuTexture = texture;
	return texture;
}

ColorMap.prototype.dispose = function() {
	if (this.gpuTexture !== undefined)
	{
		this.gpuTexture.dispose();
		this.gpuTexture = undefined;
	}
}

ColorMap.prototype.visualize = function(svg)
{
	/*
	var colorset = this.colorMap.slice(0);
	colorset.reverse();
	*/

	var gColors = svg.select('g.colorRectGroup');
	if (gColors.size() == 0) {
		gColors = svg.append('g').attr('class', 'colorRectGroup').attr('transform', 'translate(15,15)');
	}

	var gLightness = svg.select('g.colorLightnessCurve');
	if (gLightness.size() == 0) {
		gLightness = svg.append('g').attr('class', 'colorLightnessCurve').attr('transform', 'translate(45,15)');
	}
	gLightness.selectAll('*').remove();

	var gColorScale = svg.select('g.colorScale');
	if (gColorScale.size() == 0) {
		gColorScale = svg.append('g').attr('class', 'colorScale').attr('transform', 'translate(80,15)');
	}
	gColorScale.selectAll('*').remove();

	var COLOR_RECT_H = 12;
	var COLOR_RECT_W = 25;
	var COLOR_RECT_OFFSET = 3;

	// make the color
	/*
	var update = gColors.selectAll('rect').data(colorset);
	update.enter().append('rect')
		.attr('x', 0)
		.attr('y', function(d, i) { return i*(COLOR_RECT_H+COLOR_RECT_OFFSET)})
		.attr('width', COLOR_RECT_W).attr('height', COLOR_RECT_H)
		.style('stroke', 'black').style('stroke-width', '1px');

	update
		.style('fill', function(d) { return d3.rgb(d.rgb[0], d.rgb[1], d.rgb[2]).toString() });

	update.exit().remove();
	*/


	var COLOR_LIGHTNESS_W = 40;
	var COLOR_LIGHTNESS_H = 210; //COLOR_RECT_H * colorset.length + Math.max(0, colorset.length-1) * COLOR_RECT_OFFSET;

	var internalCanvas = document.createElement('canvas');
		internalCanvas.width = COLOR_RECT_W;
		internalCanvas.height = COLOR_LIGHTNESS_H;

	this.drawColorScale(
		internalCanvas.width,
		internalCanvas.height,
		COLOR_LIGHTNESS_H/2,
		'vertical',
		internalCanvas);

	gColorScale.append('image')
		.attr('width', COLOR_LIGHTNESS_W)
		.attr('height', COLOR_LIGHTNESS_H)
		.attr('x', -COLOR_LIGHTNESS_W-30)
		.attr('y', 0)
		.attr('xlink:href', internalCanvas.toDataURL());

	// make lightness curve
	var lightnessValues = [], diffValues = [];
	var minmax = this.getMinMax();

	for (var i=0, len=50; i<len; i++)
	{
		var v = (minmax[1]-minmax[0]) * (i/(len-1)) + minmax[0];
		var vv = this.mapValue(v);
		var cLab = d3.lab( d3.rgb(vv.r, vv.g, vv.b) );
		lightnessValues.push({
			x: COLOR_LIGHTNESS_W * cLab.l/100,
			y: COLOR_LIGHTNESS_H - COLOR_LIGHTNESS_H * i/(len-1)
		});
	}

	for (var i=0, len=this.colorDiffs.length; i<len; i++) {
		var d = this.colorDiffs[i];
		diffValues[i] = {
			x: COLOR_LIGHTNESS_W * d,
			y: COLOR_LIGHTNESS_H - COLOR_LIGHTNESS_H * i/(len-1)
		};
	}


	gLightness.append('rect')
		.style('fill', 'none')
		.style('stroke', '#444444').style('stroke-width', '0.5px')
		.attr('width', COLOR_LIGHTNESS_W).attr('height', COLOR_LIGHTNESS_H);

	var pathGenerator = d3.svg.line()
		.x(function(d) { return d.x; }).y(function(d) { return d.y; });

	gLightness.append('path')
		.attr('d', pathGenerator(lightnessValues))
		.style('stroke', '#af010a').style('stroke-width', '1px').style('fill', 'none')

	gLightness.append('path')
		.attr('d', pathGenerator(diffValues))
		.style('stroke', 'black').style('stroke-width', '1px').style('fill', 'none');

}

ColorMap.prototype.computeColorDiff = function(m0, m1)
{
	var SAMPLES = 50;
	var minmax = (m0 === undefined || m1 === undefined) ? [0, 1] : [m0, m1];
	var lastCLab = null;
	var diffValues = [];
	var maxDiff = -Number.MAX_VALUE;
	var avgDiff = 0, N=0;

	for (var i=0, len=SAMPLES; i<len; i++)
	{
		var v = (minmax[1]-minmax[0]) * (i/(len-1)) + minmax[0];
		var vv = this.mapValue(v);
		var cLab = d3.lab( d3.rgb(vv.r, vv.g, vv.b) );

		if (lastCLab) {

			var d = ciede2000(cLab.l, cLab.a, cLab.b, lastCLab.l, lastCLab.a, lastCLab.b);//cie76Diff(lastCLab, cLab);
			diffValues.push(d);
			maxDiff = Math.max(d, maxDiff);
			avgDiff += d;
			N++;
		}
		else {
			diffValues.push(0);
		}
		lastCLab = cLab;
	}

	this.avgDiff = avgDiff / N;
	this.colorDiffs = diffValues;
	this.maxColorDiff = maxDiff;
	return {
		avgDiff: this.avgDiff,
		diffValues: diffValues,
		maxColorDiff: this.maxColorDiff
	};
}

ColorMap.prototype.scaleColorDiff = function(s)
{
	console.log("scale color diff: " + s);
	var diffValues = this.colorDiffs;
	for (var i=0, len=diffValues.length; i<len; i++) {
		diffValues[i] /= s;
	}
}

ColorMap.prototype.mapValue = function(v, dontMapAnyway)
{
	if (this.colormapFunc)
	{
		return this.colormapFunc(v);
	}
	else
	{
		var interpolators = this.colorInterpolator;

		for (var i=0, len=interpolators.length; i < len; i++)
		{
			var interpolator = interpolators[i];
			var range = interpolator.range;

			if (range[0] <= v && range[1] >= v)
			{
				var n = (v - range[0]) * interpolator._len
				var interp = interpolator.interpolator;
				var c;

				if (ColorInterpolator.prototype.isPrototypeOf(interp))
				{
					c = interp.interpolate(n);
					if (c.displayable()) {
						return d3.rgb(c);
					}
					else
					{
						// return black
						if (dontMapAnyway) {
							return null;
						}
						else
						{
							return d3.rgb(0,0,0);
						}
					}
				}
				else
				{
					c = interp(n)
					return c;
				}
			}
		}
		return null;
	}
}

ColorMap.prototype.drawColorScale = function(w, h, steps, orientation, canvas, invert)
{
	var minmax = this.getMinMax();
	var internalCanvas = canvas || document.createElement('canvas');
	if (!canvas)
	{
		internalCanvas.width = w;
		internalCanvas.height = h;
	}

	var context = internalCanvas.getContext('2d');
	var pixelStep = orientation == 'vertical' ? h / steps : w / steps;

	var x, y, dX, dY, ww, hh;
	if (orientation == 'vertical') {
		dX = 0;
		dY = -pixelStep;
		ww = w;
		hh = pixelStep;
		x = 0;
		y = h-pixelStep;
	}
	else
	{
		dX = pixelStep;
		dY = 0;
		ww = pixelStep;
		hh = h;
		x = 0;
		y = 0;
	}

	var dontMapAnyway = h > 4;
	for (var i=0; i<steps; i++, x += dX, y += dY)
	{
		var v = (minmax[1]-minmax[0]) * ( (invert ? steps-1-i : i )/(steps-1)) + minmax[0];
		var c = this.mapValue(v, dontMapAnyway);

		context.fillStyle = c !== null ? c.toString() : '#000000';
		context.fillRect(x, y, ww, hh);

		if (c === null)
		{
			// strike through with a red line
			context.strokeStyle="#FFFF00";
			context.lineWidth=2;

			context.beginPath();
			context.moveTo(x,h/2);
			context.lineTo(x+ww,h/2);
			context.stroke();
		}
	}

	return internalCanvas;
}

var COLOR_PRESETS =
{

		tealbeige: ['#e6ebb4', '#c8d991', '#a6da93', '#83d99e', '#62d1a7', '#44bea6', '#359f96', '#387372', '#353836'].reverse(),
		pinkpurple: ['#fcebe2', '#facac3', '#f9aeb9', '#f992b1', '#f872a5', '#ef4d9f', '#d01e91', '#9e0077', '#7d0078'].reverse(),

		greenmelon: ["#e6ebb4", "#c8d991", "#a6da93", "#83d99e", "#62d1a7", "#44bea6", "#359f96", "#387372", "#353836"].reverse(),
		redmelon: ["#d13d6b", "#d8595c", "#dd704c", "#e18739", "#e3a227", "#e0c135", "#dcdd64", "#daeb96", "#dee7bd"],

		bluebrown: ['#8c510a','#bf812d','#dfc27d','#f6e8c3','#f5f5f5','#c7eae5','#80cdc1','#35978f','#01665e'].reverse(),
		bluebrownFull: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#f5f5f5','#c7eae5','#80cdc1','#35978f','#01665e','#003c30'].reverse(),
		bluered: ['#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac'].reverse(),


		greenpink: ['#c51b7d','#de77ae','#f1b6da','#fde0ef','#f7f7f7','#e6f5d0','#b8e186','#7fbc41','#4d9221'].reverse(),
		greenpinkFull: ['#8e0152','#c51b7d','#de77ae','#f1b6da','#fde0ef','#f7f7f7','#e6f5d0','#b8e186','#7fbc41','#4d9221','#276419'].reverse(),
		greenpinkBrewer: ['#c5147e', '#d964a2', '#ea9dcb', '#fbd0e8', '#f6f8f6', '#def4c7', '#bbe792', '#86c950', '#42931d'].reverse(),

		orangegreen: ['#d38812', '#f2b756', '#fed39a', '#fbe3d3', '#f3f4ef', '#edffe3', '#dfffba', '#c3ff84', '#94d059'].reverse(),
		//bluebrownBrewer: ['#d8b365', '#f6e8c3', '#f5f5f5', '#c7eae5', '#5ab4ac'].reverse(),

		bluebrownBrewer: ['#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f'].reverse(),

		purpleorange: ['#b35806','#e08214','#fdb863','#fee0b6','#f7f7f7','#d8daeb','#b2abd2','#8073ac','#542788'].reverse(),
		purpleorangeFull: ['#7f3b08','#b35806','#e08214','#fdb863','#fee0b6','#f7f7f7','#d8daeb','#b2abd2','#8073ac','#542788','#2d004b'].reverse(),

		greenpurple: ['#762a83','#9970ab','#c2a5cf','#e7d4e8','#f7f7f7','#d9f0d3','#a6dba0','#5aae61','#1b7837'].reverse(),
		greenpurpleFull: ['#40004b','#762a83','#9970ab','#c2a5cf','#e7d4e8','#f7f7f7','#d9f0d3','#a6dba0','#5aae61','#1b7837','#00441b'].reverse(),

		bluegreenyellow: ['#ffffd9','#edf8b1','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#253494','#081d58'].reverse(),

		blueyellowred: ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695'].reverse(),

		bluebrown2: [
         {
            "x": "0",
            "o": "1",
            "r": "0.164706",
            "g": "0.207843",
            "b": "0.239216"
         },
         {
            "x": "0.025",
            "o": "1",
            "r": "0.184314",
            "g": "0.258824",
            "b": "0.301961"
         },
         {
            "x": "0.05",
            "o": "1",
            "r": "0.188235",
            "g": "0.301961",
            "b": "0.360784"
         },
         {
            "x": "0.1",
            "o": "1",
            "r": "0.184314",
            "g": "0.403922",
            "b": "0.478431"
         },
         {
            "x": "0.15",
            "o": "1",
            "r": "0.211765",
            "g": "0.533333",
            "b": "0.6"
         },
         {
            "x": "0.2",
            "o": "1",
            "r": "0.211765",
            "g": "0.682353",
            "b": "0.701961"
         },
         {
            "x": "0.25",
            "o": "1",
            "r": "0.278431",
            "g": "0.8",
            "b": "0.784314"
         },
         {
            "x": "0.3",
            "o": "1",
            "r": "0.388235",
            "g": "0.901961",
            "b": "0.831373"
         },
         {
            "x": "0.35",
            "o": "1",
            "r": "0.490196",
            "g": "0.941176",
            "b": "0.819608"
         },
         {
            "x": "0.4",
            "o": "1",
            "r": "0.576471",
            "g": "0.960784",
            "b": "0.8"
         },
         {
            "x": "0.45",
            "o": "1",
            "r": "0.792157",
            "g": "0.988235",
            "b": "0.87451"
         },
         {
            "x": "0.49",
            "o": "1",
            "r": "0.878431",
            "g": "1",
            "b": "0.921569"
         },
         {
            "x": "0.5",
            "o": "1",
            "r": "0.988235",
            "g": "0.972549",
            "b": "0.831373"
         },
         {
            "x": "0.55",
            "o": "1",
            "r": "0.921569",
            "g": "0.866667",
            "b": "0.607843"
         },
         {
            "x": "0.6",
            "o": "1",
            "r": "0.890196",
            "g": "0.807843",
            "b": "0.505882"
         },
         {
            "x": "0.65",
            "o": "1",
            "r": "0.839216",
            "g": "0.721569",
            "b": "0.447059"
         },
         {
            "x": "0.7",
            "o": "1",
            "r": "0.760784",
            "g": "0.631373",
            "b": "0.372549"
         },
         {
            "x": "0.75",
            "o": "1",
            "r": "0.65098",
            "g": "0.568627",
            "b": "0.298039"
         },
         {
            "x": "0.8",
            "o": "1",
            "r": "0.541176",
            "g": "0.513725",
            "b": "0.239216"
         },
         {
            "x": "0.85",
            "o": "1",
            "r": "0.439216",
            "g": "0.439216",
            "b": "0.184314"
         },
         {
            "x": "0.9",
            "o": "1",
            "r": "0.305882",
            "g": "0.360784",
            "b": "0.12549"
         },
         {
            "x": "0.95",
            "o": "1",
            "r": "0.203922",
            "g": "0.258824",
            "b": "0.117647"
         },
         {
            "x": "1",
            "o": "1",
            "r": "0.117647",
            "g": "0.160784",
            "b": "0.098039"
         }
      ],

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

		rainbowFull: [
			[0, 0, 255],
			[0, 255, 255],
			[0, 255, 0],
			[255, 255, 0],
			[255, 0, 0],
			[255, 0, 255],

		],


		rainbowcie: [
			[0, 0, 255],
			[0, 255, 255],
			[0, 255, 0],
			[255, 255, 0],
			[255, 0, 0],
		],

		rainbowjet: [
			[  0,   0, 143],
			[  0,   0, 159],
			[  0,   0, 175],
			[  0,   0, 191],
			[  0,   0, 207],
			[  0,   0, 223],
			[  0,   0, 239],
			[  0,   0, 255],
			[  0,  15, 255],
			[  0,  31, 255],
			[  0,  47, 255],
			[  0,  63, 255],
			[  0,  79, 255],
			[  0,  95, 255],
			[  0, 111, 255],
			[  0, 127, 255],
			[  0, 143, 255],
			[  0, 159, 255],
			[  0, 175, 255],
			[  0, 191, 255],
			[  0, 207, 255],
			[  0, 223, 255],
			[  0, 239, 255],
			[  0, 255, 255],
			[ 15, 255, 239],
			[ 31, 255, 223],
			[ 47, 255, 207],
			[ 63, 255, 191],
			[ 79, 255, 175],
			[ 95, 255, 159],
			[111, 255, 143],
			[127, 255, 127],
			[143, 255, 111],
			[159, 255,  95],
			[175, 255,  79],
			[191, 255,  63],
			[207, 255,  47],
			[223, 255,  31],
			[239, 255,  15],
			[255, 255,   0],
			[255, 239,   0],
			[255, 223,   0],
			[255, 207,   0],
			[255, 191,   0],
			[255, 175,   0],
			[255, 159,   0],
			[255, 143,   0],
			[255, 127,   0],
			[255, 111,   0],
			[255,  95,   0],
			[255,  79,   0],
			[255,  63,   0],
			[255,  47,   0],
			[255,  31,   0],
			[255,  15,   0],
			[255,   0,   0],
			[239,   0,   0],
			[223,   0,   0],
			[207,   0,   0],
			[191,   0,   0],
			[175,   0,   0],
			[159,   0,   0],
			[143,   0,   0],
			[127,   0,   0]
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

		/*
		bluegreenyellow: [
			[255,255,217],
			[237,248,177],
			[199,233,180],
			[127,205,187],
			[65,182,196],
			[29,145,192],
			[34,94,168],
			[37,52,148],
			[8,29,88],
		].reverse(),
		*/
		singlehue: [
			[247,251,255],
			[222,235,247],
			[198,219,239],
			[158,202,225],
			[107,174,214],
			[66,146,198],
			[33,113,181],
			[8,81,156],
			[8,48,107]
		].reverse(),


		/*
		multihue: [
			[255,255,217],
			[237,248,177],
			[199,233,180],
			[127,205,187],
			[65,182,196],
			[29,145,192],
			[34,94,168],
			[37,52,148],
			[8,29,88],
		].reverse(),
		*/

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
			[158,1,66],
			[213,62,79],
			[244,109,67],
			[253,174,97],
			[254,224,139],
			[255,255,191],
			[230,245,152],
			[171,221,164],
			[102,194,165],
			[50,136,189],
			[94,79,162]
		].reverse(),

		// via Moreland
		coolwarmMoreland: [
			[59	,	76	,	192],
			[68	,	90	,	204],
			[77	,	104	,	215],
			[87	,	117	,	225],
			[98	,	130	,	234],
			[108,	142	,	241],
			[119,	154	,	247],
			[130,	165	,	251],
			[141,	176	,	254],
			[152,	185	,	255],
			[163,	194	,	255],
			[174,	201	,	253],
			[184,	208	,	249],
			[194,	213	,	244],
			[204,	217	,	238],
			[213,	219	,	230],
			[221,	221	,	221],
			[229,	216	,	209],
			[236,	211	,	197],
			[241,	204	,	185],
			[245,	196	,	173],
			[247,	187	,	160],
			[247,	177	,	148],
			[247,	166	,	135],
			[244,	154	,	123],
			[241,	141	,	111],
			[236,	127	,	99],
			[229,	112	,	88],
			[222,	96	,	77],
			[213,	80	,	66],
			[203,	62	,	56],
			[192,	40	,	47],
			[180,	4	,	38]
		],

		blueyellow: [
			[13, 0, 252],
			[190, 190, 190],
			[252, 252, 0]
		],

		rainbowhcl: function(t)
		{
			t = 1-t;
			t *= .9;
			t -= .15;
			var hcl =  d3.hcl(t * 360, 100, 55);
			var rgb = d3.rgb(hcl);

			var c = rgb;
			c.r = Math.max(0, Math.min(255, c.r))
			c.g = Math.max(0, Math.min(255, c.g))
			c.b = Math.max(0, Math.min(255, c.b))
			return c;
		},

		rainbowhcl100: function(t)
		{
			t = 1-t;
			t *= .9;
			t -= .15;
			var hcl =  d3.hcl(t * 360, 50, 100);
			var rgb = d3.rgb(hcl);

			var c = rgb;
			c.r = Math.max(0, Math.min(255, c.r))
			c.g = Math.max(0, Math.min(255, c.g))
			c.b = Math.max(0, Math.min(255, c.b))
			return c;
		},

		rainbowhcl80: function(t)
		{
			t = 1-t;
			t *= .9;
			t -= .15;
			var hcl =  d3.hcl(t * 360, 70, 80);
			var rgb = d3.rgb(hcl);

			var c = rgb;
			c.r = Math.max(0, Math.min(255, c.r))
			c.g = Math.max(0, Math.min(255, c.g))
			c.b = Math.max(0, Math.min(255, c.b))
			return c;
		},

		rainbowhcl90: function(t)
		{
			t = 1-t;
			t *= .9;
			t -= .15;
			var hcl =  d3.hcl(t * 360, 70, 90);
			var rgb = d3.rgb(hcl);

			var c = rgb;
			c.r = Math.max(0, Math.min(255, c.r))
			c.g = Math.max(0, Math.min(255, c.g))
			c.b = Math.max(0, Math.min(255, c.b))
			return c;
		},





		d3rainbow: function(t) {
			t = 1-t;
			t *= .9;
			var c = d3.rgb(d3.interpolateRainbow(t));
			return c;
		},

		d3sinebow: function(t) {
			t = 1-t;
			t *= .9;
			t-=.25;
			return d3.rgb(d3.interpolateSinebow(t));
		},


		viridis: (function()
		{
			var out = [];
			for (var i=0; i<=100; i++) {
				var c = d3.interpolateViridis(i/100);
				var rgb = d3.color(c);
				out.push([rgb.r, rgb.g, rgb.b]);
			}
			return out
		}) (),

		plasma: (function()
		{
			var out = [];
			for (var i=0; i<=100; i++) {
				var c = d3.interpolatePlasma(i/100);
				var rgb = d3.color(c);
				out.push([rgb.r, rgb.g, rgb.b]);
			}
			return out
		}) (),

		inferno: (function()
		{
			var out = [];
			for (var i=0; i<=100; i++) {
				var c = d3.interpolateInferno(i/100);
				var rgb = d3.color(c);
				out.push([rgb.r, rgb.g, rgb.b]);
			}
			return out
		}) (),


		plasmaShort: (function()
		{
			var out = [];
			for (var i=0; i<=100; i++) {
				var k = (i/100) * (.9) + .1
				var c = d3.interpolatePlasma(k);
				var rgb = d3.color(c);
				out.push([rgb.r, rgb.g, rgb.b]);
			}
			return out
		}) (),

		redpurple: [
			[255,247,243],
			[253,224,221],
			[252,197,192],
			[250,159,181],
			[247,104,161],
			[221,52,151],
			[174,1,126],
			[122,1,119],
			[73,0,106]
		].reverse(),

		greyred: [
			[178,24,43],
			[214,96,77],
			[244,165,130],
			[253,219,199],
			[255,255,255],
			[224,224,224],
			[186,186,186],
			[135,135,135],
			[77,77,77]
		].reverse(),

		coolwarm: [
			[63,	0,		242],
			[83,	41,		240],
			[121,	98,		245],
			[169,	158,	249],
			[225,	223,	252],
			[244,	208,	209],
			[232,	135,	135],
			[221,	70,		73],
			[221,	25,		29],
		],

		reds:
		[
			[226,	202,	100],
			[225,	180,	87],
			[225,	159,	79],
			[227,	140,	75],
			[219,	118,	71],
			[205,	95,		67],
			[191,	73,		63],
			[169,	50,		57],
			[147,	27,		51]
		].reverse(),

		purples: [
			[59,	27,	80],
			[79,	37,	94],
			[95,	52,	108],
			[112,	68,	123],
			[135,	84,	140],
			[160,	101,157],
			[186,	116, 169],
			[206,	131, 176],
			[215,	146, 171],
		],

		blues:
		[
			[253,	244,	249],
			[214,	207,	230],
			[169,	180,	214],
			[122,	158,	201],
			[76,	133,	184],
			[49,	107,	174],
			[39,	82,		149],
			[27,	61,		103],
			[18,	41,		70],

			/*
			[254,	246,	250],
			[213,	208,	229],
			[171,	180,	212],
			[129,	158,	197],
			[88,	133,	180],
			[63,	107,	168],
			[49,	82,		144],
			[35,	61,		100],
			[23,	41,		68]
			*/
		].reverse(),

		spectral:
		[
			[213,62,79],
			[244,109,67],
			[253,174,97],
			[254,224,139],
			[255,255,191],
			[230,245,152],
			[171,221,164],
			[102,194,165],
			[50,136,189]
		].reverse(),

		/*
		[
			[72,		0,		84],
			[74,		1,		91],
			[76,		7,		96],
			[77,		14,		102],
			[78,		20,		107],
			[79,		26,		112],
			[80,		32,		116],
			[80,		37,		120],
			[80,		42,		124],
			[79,		48,		127],
			[79,		53,		130],
			[78,		58,		132],
			[77, 	63,		134],
			[75,		68,		136],
			[74,		72,		138],
			[72,		77,		139],
			[71,		82,		140],
			[69, 	86,		140],
			[67,		91,		141],
			[65,		95,		141],
			[64,		99,		142],
			[62,		103,	142],
			[60,		107,	142],
			[59,		111,	142],
			[57,		115,	142],
			[55,		119,	142],
			[54,		123,	142],
			[52,		127,	142],
			[50,		131,	142],
			[48, 	135,	142],
			[46,		138,	141],
			[44,		142,	141],
			[42,		146,	140],
			[39,		150,	139],
			[37, 	154,	138],
			[35,		158,	137],
			[34,		162,	135],
			[32,		166,	133],
			[32,		169,	131],
			[33,		173,	129],
			[35,		177,	126],
			[38,		181,	123],
			[42,		184,	120],
			[48,		188,	116],
			[54,		191,	112],
			[61,		195,	108],
			[69, 	198,	103],
			[78,		201,	98],
			[86,		204,	93],
			[96,		207,	87],
			[105,	210,	81],
			[115,	212,	74],
			[126,	215,	68],
			[136,	217,	60],
			[147,	219,	53],
			[158,	221,	45],
			[169,	223,	37],
			[180,	225,	28],
			[191,	226,	20],
			[202,	228,	12],
			[212,	229,	9],
			[223,	230,	11],
			[233,	231,	19],
			[243,	233,	28]

	],*/

turbo: [[48,18,59],[50,21,67],[51,24,74],[52,27,81],[53,30,88],[54,33,95],[55,36,102],[56,39,109],[57,42,115],[58,45,121],[59,47,128],[60,50,134],[61,53,139],[62,56,145],[63,59,151],[63,62,156],[64,64,162],[65,67,167],[65,70,172],[66,73,177],[66,75,181],[67,78,186],[68,81,191],[68,84,195],[68,86,199],[69,89,203],[69,92,207],[69,94,211],[70,97,214],[70,100,218],[70,102,221],[70,105,224],[70,107,227],[71,110,230],[71,113,233],[71,115,235],[71,118,238],[71,120,240],[71,123,242],[70,125,244],[70,128,246],[70,130,248],[70,133,250],[70,135,251],[69,138,252],[69,140,253],[68,143,254],[67,145,254],[66,148,255],[65,150,255],[64,153,255],[62,155,254],[61,158,254],[59,160,253],[58,163,252],[56,165,251],[55,168,250],[53,171,248],[51,173,247],[49,175,245],[47,178,244],[46,180,242],[44,183,240],[42,185,238],[40,188,235],[39,190,233],[37,192,231],[35,195,228],[34,197,226],[32,199,223],[31,201,221],[30,203,218],[28,205,216],[27,208,213],[26,210,210],[26,212,208],[25,213,205],[24,215,202],[24,217,200],[24,219,197],[24,221,194],[24,222,192],[24,224,189],[25,226,187],[25,227,185],[26,228,182],[28,230,180],[29,231,178],[31,233,175],[32,234,172],[34,235,170],[37,236,167],[39,238,164],[42,239,161],[44,240,158],[47,241,155],[50,242,152],[53,243,148],[56,244,145],[60,245,142],[63,246,138],[67,247,135],[70,248,132],[74,248,128],[78,249,125],[82,250,122],[85,250,118],[89,251,115],[93,252,111],[97,252,108],[101,253,105],[105,253,102],[109,254,98],[113,254,95],[117,254,92],[121,254,89],[125,255,86],[128,255,83],[132,255,81],[136,255,78],[139,255,75],[143,255,73],[146,255,71],[150,254,68],[153,254,66],[156,254,64],[159,253,63],[161,253,61],[164,252,60],[167,252,58],[169,251,57],[172,251,56],[175,250,55],[177,249,54],[180,248,54],[183,247,53],[185,246,53],[188,245,52],[190,244,52],[193,243,52],[195,241,52],[198,240,52],[200,239,52],[203,237,52],[205,236,52],[208,234,52],[210,233,53],[212,231,53],[215,229,53],[217,228,54],[219,226,54],[221,224,55],[223,223,55],[225,221,55],[227,219,56],[229,217,56],[231,215,57],[233,213,57],[235,211,57],[236,209,58],[238,207,58],[239,205,58],[241,203,58],[242,201,58],[244,199,58],[245,197,58],[246,195,58],[247,193,58],[248,190,57],[249,188,57],[250,186,57],[251,184,56],[251,182,55],[252,179,54],[252,177,54],[253,174,53],[253,172,52],[254,169,51],[254,167,50],[254,164,49],[254,161,48],[254,158,47],[254,155,45],[254,153,44],[254,150,43],[254,147,42],[254,144,41],[253,141,39],[253,138,38],[252,135,37],[252,132,35],[251,129,34],[251,126,33],[250,123,31],[249,120,30],[249,117,29],[248,114,28],[247,111,26],[246,108,25],[245,105,24],[244,102,23],[243,99,21],[242,96,20],[241,93,19],[240,91,18],[239,88,17],[237,85,16],[236,83,15],[235,80,14],[234,78,13],[232,75,12],[231,73,12],[229,71,11],[228,69,10],[226,67,10],[225,65,9],[223,63,8],[221,61,8],[220,59,7],[218,57,7],[216,55,6],[214,53,6],[212,51,5],[210,49,5],[208,47,5],[206,45,4],[204,43,4],[202,42,4],[200,40,3],[197,38,3],[195,37,3],[193,35,2],[190,33,2],[188,32,2],[185,30,2],[183,29,2],[180,27,1],[178,26,1],[175,24,1],[172,23,1],[169,22,1],[167,20,1],[164,19,1],[161,18,1],[158,16,1],[155,15,1],[152,14,1],[149,13,1],[146,11,1],[142,10,1],[139,9,2],[136,8,2],[133,7,2],[129,6,2],[126,5,2],[122,4,3]],

mellowrainbow: [
         {
            "x": "0",
            "o": "1",
            "r": "1",
            "g": "0.988235",
            "b": "0.968627"
         },
         {
            "x": "0.025",
            "o": "1",
            "r": "1",
            "g": "0.960784",
            "b": "0.870588"
         },
         {
            "x": "0.05",
            "o": "1",
            "r": "0.968627",
            "g": "0.921569",
            "b": "0.764706"
         },
         {
            "x": "0.075",
            "o": "1",
            "r": "0.960784",
            "g": "0.913725",
            "b": "0.670588"
         },
         {
            "x": "0.1",
            "o": "1",
            "r": "0.941176",
            "g": "0.905882",
            "b": "0.6"
         },
         {
            "x": "0.125",
            "o": "1",
            "r": "0.929412",
            "g": "0.917647",
            "b": "0.541176"
         },
         {
            "x": "0.15",
            "o": "1",
            "r": "0.898039",
            "g": "0.909804",
            "b": "0.501961"
         },
         {
            "x": "0.175",
            "o": "1",
            "r": "0.847059",
            "g": "0.890196",
            "b": "0.462745"
         },
         {
            "x": "0.2",
            "o": "1",
            "r": "0.772549",
            "g": "0.858824",
            "b": "0.431373"
         },
         {
            "x": "0.225",
            "o": "1",
            "r": "0.686275",
            "g": "0.831373",
            "b": "0.4"
         },
         {
            "x": "0.25",
            "o": "1",
            "r": "0.603922",
            "g": "0.8",
            "b": "0.368627"
         },
         {
            "x": "0.275",
            "o": "1",
            "r": "0.517647",
            "g": "0.768627",
            "b": "0.337255"
         },
         {
            "x": "0.3",
            "o": "1",
            "r": "0.415686",
            "g": "0.721569",
            "b": "0.301961"
         },
         {
            "x": "0.325",
            "o": "1",
            "r": "0.32549",
            "g": "0.678431",
            "b": "0.270588"
         },
         {
            "x": "0.35",
            "o": "1",
            "r": "0.247059",
            "g": "0.65098",
            "b": "0.247059"
         },
         {
            "x": "0.375",
            "o": "1",
            "r": "0.219608",
            "g": "0.611765",
            "b": "0.266667"
         },
         {
            "x": "0.4",
            "o": "1",
            "r": "0.192157",
            "g": "0.580392",
            "b": "0.282353"
         },
         {
            "x": "0.425",
            "o": "1",
            "r": "0.156863",
            "g": "0.560784",
            "b": "0.290196"
         },
         {
            "x": "0.45",
            "o": "1",
            "r": "0.117647",
            "g": "0.541176",
            "b": "0.294118"
         },
         {
            "x": "0.475",
            "o": "1",
            "r": "0.090196",
            "g": "0.521569",
            "b": "0.305882"
         },
         {
            "x": "0.5",
            "o": "1",
            "r": "0.070588",
            "g": "0.509804",
            "b": "0.32549"
         },
         {
            "x": "0.525",
            "o": "1",
            "r": "0.082353",
            "g": "0.509804",
            "b": "0.368627"
         },
         {
            "x": "0.55",
            "o": "1",
            "r": "0.090196",
            "g": "0.521569",
            "b": "0.411765"
         },
         {
            "x": "0.575",
            "o": "1",
            "r": "0.094118",
            "g": "0.529412",
            "b": "0.458824"
         },
         {
            "x": "0.6",
            "o": "1",
            "r": "0.101961",
            "g": "0.541176",
            "b": "0.501961"
         },
         {
            "x": "0.625",
            "o": "1",
            "r": "0.113725",
            "g": "0.54902",
            "b": "0.54902"
         },
         {
            "x": "0.65",
            "o": "1",
            "r": "0.129412",
            "g": "0.529412",
            "b": "0.560784"
         },
         {
            "x": "0.675",
            "o": "1",
            "r": "0.145098",
            "g": "0.521569",
            "b": "0.580392"
         },
         {
            "x": "0.7",
            "o": "1",
            "r": "0.156863",
            "g": "0.498039",
            "b": "0.6"
         },
         {
            "x": "0.725",
            "o": "1",
            "r": "0.164706",
            "g": "0.447059",
            "b": "0.611765"
         },
         {
            "x": "0.75",
            "o": "1",
            "r": "0.172549",
            "g": "0.396078",
            "b": "0.619608"
         },
         {
            "x": "0.775",
            "o": "1",
            "r": "0.176471",
            "g": "0.341176",
            "b": "0.631373"
         },
         {
            "x": "0.8",
            "o": "1",
            "r": "0.184314",
            "g": "0.313725",
            "b": "0.639216"
         },
         {
            "x": "0.825",
            "o": "1",
            "r": "0.184314",
            "g": "0.27451",
            "b": "0.619608"
         },
         {
            "x": "0.85",
            "o": "1",
            "r": "0.184314",
            "g": "0.235294",
            "b": "0.6"
         },
         {
            "x": "0.875",
            "o": "1",
            "r": "0.184314",
            "g": "0.2",
            "b": "0.580392"
         },
         {
            "x": "0.9",
            "o": "1",
            "r": "0.215686",
            "g": "0.196078",
            "b": "0.560784"
         },
         {
            "x": "0.925",
            "o": "1",
            "r": "0.235294",
            "g": "0.192157",
            "b": "0.509804"
         },
         {
            "x": "0.95",
            "o": "1",
            "r": "0.262745",
            "g": "0.2",
            "b": "0.478431"
         },
         {
            "x": "0.975",
            "o": "1",
            "r": "0.286275",
            "g": "0.219608",
            "b": "0.439216"
         },
         {
            "x": "1",
            "o": "1",
            "r": "0.301961",
            "g": "0.239216",
            "b": "0.4"
         }
      ].reverse(),

      bluegreen: [
         {
            "x": "0",
            "o": "1",
            "r": "0.984314",
            "g": "0.988235",
            "b": "0.94902"
         },
         {
            "x": "0.05",
            "o": "1",
            "r": "0.92549",
            "g": "0.960784",
            "b": "0.827451"
         },
         {
            "x": "0.1",
            "o": "1",
            "r": "0.858824",
            "g": "0.94902",
            "b": "0.741176"
         },
         {
            "x": "0.15",
            "o": "1",
            "r": "0.792157",
            "g": "0.941176",
            "b": "0.694118"
         },
         {
            "x": "0.2",
            "o": "1",
            "r": "0.682353",
            "g": "0.929412",
            "b": "0.631373"
         },
         {
            "x": "0.25",
            "o": "1",
            "r": "0.588235",
            "g": "0.921569",
            "b": "0.611765"
         },
         {
            "x": "0.275",
            "o": "1",
            "r": "0.560784",
            "g": "0.921569",
            "b": "0.619608"
         },
         {
            "x": "0.3",
            "o": "1",
            "r": "0.541176",
            "g": "0.929412",
            "b": "0.643137"
         },
         {
            "x": "0.325",
            "o": "1",
            "r": "0.517647",
            "g": "0.941176",
            "b": "0.670588"
         },
         {
            "x": "0.35",
            "o": "1",
            "r": "0.494118",
            "g": "0.94902",
            "b": "0.705882"
         },
         {
            "x": "0.375",
            "o": "1",
            "r": "0.47451",
            "g": "0.929412",
            "b": "0.72549"
         },
         {
            "x": "0.4",
            "o": "1",
            "r": "0.458824",
            "g": "0.921569",
            "b": "0.752941"
         },
         {
            "x": "0.425",
            "o": "1",
            "r": "0.431373",
            "g": "0.901961",
            "b": "0.784314"
         },
         {
            "x": "0.45",
            "o": "1",
            "r": "0.403922",
            "g": "0.901961",
            "b": "0.815686"
         },
         {
            "x": "0.475",
            "o": "1",
            "r": "0.384314",
            "g": "0.890196",
            "b": "0.847059"
         },
         {
            "x": "0.5",
            "o": "1",
            "r": "0.352941",
            "g": "0.878431",
            "b": "0.878431"
         },
         {
            "x": "0.55",
            "o": "1",
            "r": "0.329412",
            "g": "0.807843",
            "b": "0.870588"
         },
         {
            "x": "0.6",
            "o": "1",
            "r": "0.290196",
            "g": "0.709804",
            "b": "0.85098"
         },
         {
            "x": "0.65",
            "o": "1",
            "r": "0.25098",
            "g": "0.623529",
            "b": "0.839216"
         },
         {
            "x": "0.7",
            "o": "1",
            "r": "0.227451",
            "g": "0.545098",
            "b": "0.878431"
         },
         {
            "x": "0.75",
            "o": "1",
            "r": "0.235294",
            "g": "0.478431",
            "b": "0.839216"
         },
         {
            "x": "0.8",
            "o": "1",
            "r": "0.243137",
            "g": "0.419608",
            "b": "0.780392"
         },
         {
            "x": "0.85",
            "o": "1",
            "r": "0.25098",
            "g": "0.388235",
            "b": "0.741176"
         },
         {
            "x": "0.875",
            "o": "1",
            "r": "0.27451",
            "g": "0.380392",
            "b": "0.701961"
         },
         {
            "x": "0.9",
            "o": "1",
            "r": "0.298039",
            "g": "0.380392",
            "b": "0.65098"
         },
         {
            "x": "0.95",
            "o": "1",
            "r": "0.298039",
            "g": "0.352941",
            "b": "0.568627"
         },
         {
            "x": "1",
            "o": "1",
            "r": "0.278431",
            "g": "0.305882",
            "b": "0.45098"
         }
      ].reverse(),
      fiveMellowWave: [
         {
            "x": "0",
            "o": "1",
            "r": "0.984313725490196",
            "g": "0.964705882352941",
            "b": "0.737254901960784"
         },
         {
            "x": "0.0206315793981833",
            "o": "1",
            "r": "0.968627450980392",
            "g": "0.929411764705882",
            "b": "0.635294117647059"
         },
         {
            "x": "0.0412631587963664",
            "o": "1",
            "r": "0.956862745098039",
            "g": "0.901960784313726",
            "b": "0.549019607843137"
         },
         {
            "x": "0.0618947381945497",
            "o": "1",
            "r": "0.945098039215686",
            "g": "0.866666666666667",
            "b": "0.466666666666667"
         },
         {
            "x": "0.0825263175927329",
            "o": "1",
            "r": "0.925490196078431",
            "g": "0.831372549019608",
            "b": "0.403921568627451"
         },
         {
            "x": "0.103157896990916",
            "o": "1",
            "r": "0.909803921568627",
            "g": "0.8",
            "b": "0.368627450980392"
         },
         {
            "x": "0.123789476389099",
            "o": "1",
            "r": "0.894117647058824",
            "g": "0.768627450980392",
            "b": "0.337254901960784"
         },
         {
            "x": "0.144421055787283",
            "o": "1",
            "r": "0.87843137254902",
            "g": "0.733333333333333",
            "b": "0.309803921568627"
         },
         {
            "x": "0.172792568802834",
            "o": "1",
            "r": "0.819846890261985",
            "g": "0.661246947971898",
            "b": "0.291535442288565"
         },
         {
            "x": "0.188001692295074",
            "o": "1",
            "r": "0.764705882352941",
            "g": "0.596078431372549",
            "b": "0.254901960784314"
         },
         {
            "x": "0.205745667219162",
            "o": "1",
            "r": "0.611764705882353",
            "g": "0.419607843137255",
            "b": "0.27843137254902"
         },
         {
            "x": "0.214195191860199",
            "o": "1",
            "r": "0.56078431372549",
            "g": "0.36078431372549",
            "b": "0.247058823529412"
         },
         {
            "x": "0.241656109690666",
            "o": "1",
            "r": "0.588235294117647",
            "g": "0.396078431372549",
            "b": "0.266666666666667"
         },
         {
            "x": "0.26404732465744",
            "o": "1",
            "r": "0.638419246134512",
            "g": "0.451860266059187",
            "b": "0.308394652206041"
         },
         {
            "x": "0.314744412899017",
            "o": "1",
            "r": "0.8",
            "g": "0.635294117647059",
            "b": "0.447058823529412"
         },
         {
            "x": "0.333755820989609",
            "o": "1",
            "r": "0.854901960784314",
            "g": "0.709803921568627",
            "b": "0.505882352941176"
         },
         {
            "x": "0.355724543333054",
            "o": "1",
            "r": "0.909803921568627",
            "g": "0.788235294117647",
            "b": "0.592156862745098"
         },
         {
            "x": "0.374313473701477",
            "o": "1",
            "r": "0.929411764705882",
            "g": "0.831372549019608",
            "b": "0.670588235294118"
         },
         {
            "x": "0.386987745761871",
            "o": "1",
            "r": "0.949019607843137",
            "g": "0.882352941176471",
            "b": "0.772549019607843"
         },
         {
            "x": "0.399239540100098",
            "o": "1",
            "r": "0.886275",
            "g": "0.921569",
            "b": "0.854902"
         },
         {
            "x": "0.426700472831726",
            "o": "1",
            "r": "0.741176",
            "g": "0.788235",
            "b": "0.717647"
         },
         {
            "x": "0.44317701458931",
            "o": "1",
            "r": "0.662745",
            "g": "0.729412",
            "b": "0.65098"
         },
         {
            "x": "0.449438721180243",
            "o": "1",
            "r": "0.639216",
            "g": "0.709804",
            "b": "0.631373"
         },
         {
            "x": "0.459711895186179",
            "o": "1",
            "r": "0.607843",
            "g": "0.690196",
            "b": "0.607843"
         },
         {
            "x": "0.469985069192115",
            "o": "1",
            "r": "0.588235",
            "g": "0.670588",
            "b": "0.596078"
         },
         {
            "x": "0.48025824319805",
            "o": "1",
            "r": "0.564706",
            "g": "0.65098",
            "b": "0.580392"
         },
         {
            "x": "0.490531417203985",
            "o": "1",
            "r": "0.54902",
            "g": "0.631373",
            "b": "0.568627"
         },
         {
            "x": "0.500804591209921",
            "o": "1",
            "r": "0.52549",
            "g": "0.611765",
            "b": "0.552941"
         },
         {
            "x": "0.511077765215856",
            "o": "1",
            "r": "0.505882",
            "g": "0.588235",
            "b": "0.541176"
         },
         {
            "x": "0.521350939221792",
            "o": "1",
            "r": "0.486275",
            "g": "0.568627",
            "b": "0.52549"
         },
         {
            "x": "0.531624113227727",
            "o": "1",
            "r": "0.466667",
            "g": "0.54902",
            "b": "0.513725"
         },
         {
            "x": "0.541897287233663",
            "o": "1",
            "r": "0.447059",
            "g": "0.529412",
            "b": "0.501961"
         },
         {
            "x": "0.552170461239598",
            "o": "1",
            "r": "0.427451",
            "g": "0.509804",
            "b": "0.490196"
         },
         {
            "x": "0.562443635245534",
            "o": "1",
            "r": "0.407843",
            "g": "0.490196",
            "b": "0.47451"
         },
         {
            "x": "0.572716809251469",
            "o": "1",
            "r": "0.380392",
            "g": "0.458824",
            "b": "0.454902"
         },
         {
            "x": "0.582989983257404",
            "o": "1",
            "r": "0.356863",
            "g": "0.431373",
            "b": "0.431373"
         },
         {
            "x": "0.593155920505524",
            "o": "1",
            "r": "0.33756567123389",
            "g": "0.409324037046617",
            "b": "0.409317991422805"
         },
         {
            "x": "0.61339865781734",
            "o": "1",
            "r": "0.305882352941176",
            "g": "0.384313725490196",
            "b": "0.490196078431373"
         },
         {
            "x": "0.633523952055547",
            "o": "1",
            "r": "0.36078431372549",
            "g": "0.443137254901961",
            "b": "0.552941176470588"
         },
         {
            "x": "0.653649246293753",
            "o": "1",
            "r": "0.415686274509804",
            "g": "0.505882352941176",
            "b": "0.615686274509804"
         },
         {
            "x": "0.67377454053196",
            "o": "1",
            "r": "0.474509803921569",
            "g": "0.568627450980392",
            "b": "0.67843137254902"
         },
         {
            "x": "0.693899834770166",
            "o": "1",
            "r": "0.537254901960784",
            "g": "0.635294117647059",
            "b": "0.745098039215686"
         },
         {
            "x": "0.714025129008373",
            "o": "1",
            "r": "0.607843137254902",
            "g": "0.705882352941177",
            "b": "0.803921568627451"
         },
         {
            "x": "0.73415042324658",
            "o": "1",
            "r": "0.67843137254902",
            "g": "0.776470588235294",
            "b": "0.862745098039216"
         },
         {
            "x": "0.749894380569458",
            "o": "1",
            "r": "0.741176470588235",
            "g": "0.83921568627451",
            "b": "0.913725490196078"
         },
         {
            "x": "0.76932829618454",
            "o": "1",
            "r": "0.815686274509804",
            "g": "0.905882352941176",
            "b": "0.96078431372549"
         },
         {
            "x": "0.789607107639313",
            "o": "1",
            "r": "0.882352941176471",
            "g": "0.949019607843137",
            "b": "0.984313725490196"
         },
         {
            "x": "0.806083679199219",
            "o": "1",
            "r": "0.825984561703371",
            "g": "0.955751296838809",
            "b": "0.925740559542068"
         },
         {
            "x": "0.822137713432312",
            "o": "1",
            "r": "0.701961",
            "g": "0.901961",
            "b": "0.858824"
         },
         {
            "x": "0.841994106769562",
            "o": "1",
            "r": "0.560784",
            "g": "0.8",
            "b": "0.764706"
         },
         {
            "x": "0.857625722885132",
            "o": "1",
            "r": "0.466667",
            "g": "0.74902",
            "b": "0.729412"
         },
         {
            "x": "0.876721907366196",
            "o": "1",
            "r": "0.352941",
            "g": "0.65098",
            "b": "0.65098"
         },
         {
            "x": "0.897268256138496",
            "o": "1",
            "r": "0.266667",
            "g": "0.545098",
            "b": "0.568627"
         },
         {
            "x": "0.917814604910797",
            "o": "1",
            "r": "0.196078",
            "g": "0.454902",
            "b": "0.490196"
         },
         {
            "x": "0.938360953683098",
            "o": "1",
            "r": "0.133333",
            "g": "0.376471",
            "b": "0.419608"
         },
         {
            "x": "0.958907302455399",
            "o": "1",
            "r": "0.094118",
            "g": "0.329412",
            "b": "0.380392"
         },
         {
            "x": "0.979453651227699",
            "o": "1",
            "r": "0.047059",
            "g": "0.262745",
            "b": "0.321569"
         },
         {
            "x": "1",
            "o": "1",
            "r": "0",
            "g": "0.188235",
            "b": "0.25098"
         }
      ].reverse(),
blueorange: [
         {
            "v": "0",
            "o": "1",
            "r": "0.0862745098039216",
            "g": "0.00392156862745098",
            "b": "0.298039215686275"
         },
         {
            "v": "0.030334",
            "o": "1",
            "r": "0.113725",
            "g": "0.0235294",
            "b": "0.45098"
         },
         {
            "v": "0.055527",
            "o": "1",
            "r": "0.105882",
            "g": "0.0509804",
            "b": "0.509804"
         },
         {
            "v": "0.073008",
            "o": "1",
            "r": "0.0392157",
            "g": "0.0392157",
            "b": "0.560784"
         },
         {
            "v": "0.089974",
            "o": "1",
            "r": "0.0313725",
            "g": "0.0980392",
            "b": "0.6"
         },
         {
            "v": "0.106427",
            "o": "1",
            "r": "0.0431373",
            "g": "0.164706",
            "b": "0.639216"
         },
         {
            "v": "0.130077",
            "o": "1",
            "r": "0.054902",
            "g": "0.243137",
            "b": "0.678431"
         },
         {
            "v": "0.16144",
            "o": "1",
            "r": "0.054902",
            "g": "0.317647",
            "b": "0.709804"
         },
         {
            "v": "0.2",
            "o": "1",
            "r": "0.0509804",
            "g": "0.396078",
            "b": "0.741176"
         },
         {
            "v": "0.225",
            "o": "1",
            "r": "0.0392157",
            "g": "0.466667",
            "b": "0.768627"
         },
         {
            "v": "0.25",
            "o": "1",
            "r": "0.0313725",
            "g": "0.537255",
            "b": "0.788235"
         },
         {
            "v": "0.276093",
            "o": "1",
            "r": "0.0313725",
            "g": "0.615686",
            "b": "0.811765"
         },
         {
            "v": "0.302828",
            "o": "1",
            "r": "0.0235294",
            "g": "0.709804",
            "b": "0.831373"
         },
         {
            "v": "0.329563",
            "o": "1",
            "r": "0.0509804",
            "g": "0.8",
            "b": "0.85098"
         },
         {
            "v": "0.351671",
            "o": "1",
            "r": "0.0705882",
            "g": "0.854902",
            "b": "0.870588"
         },
         {
            "v": "0.372237",
            "o": "1",
            "r": "0.262745",
            "g": "0.901961",
            "b": "0.862745"
         },
         {
            "v": "0.390231",
            "o": "1",
            "r": "0.423529",
            "g": "0.941176",
            "b": "0.87451"
         },
         {
            "v": "0.417995",
            "o": "1",
            "r": "0.572549",
            "g": "0.964706",
            "b": "0.835294"
         },
         {
            "v": "0.436504",
            "o": "1",
            "r": "0.658824",
            "g": "0.980392",
            "b": "0.843137"
         },
         {
            "v": "0.456041",
            "o": "1",
            "r": "0.764706",
            "g": "0.980392",
            "b": "0.866667"
         },
         {
            "v": "0.468895",
            "o": "1",
            "r": "0.827451",
            "g": "0.980392",
            "b": "0.886275"
         },
         {
            "v": "0.482262",
            "o": "1",
            "r": "0.890196078431372",
            "g": "0.988235294117647",
            "b": "0.925490196078431"
         },
         {
            "v": "0.492545",
            "o": "1",
            "r": "0.913725",
            "g": "0.988235",
            "b": "0.937255"
         },
         {
            "v": "0.501285",
            "o": "1",
            "r": "1",
            "g": "1",
            "b": "0.972549019607843"
         },
         {
            "v": "0.510026",
            "o": "1",
            "r": "0.988235294117647",
            "g": "0.988235294117647",
            "b": "0.905882352941176"
         },
         {
            "v": "0.526478",
            "o": "1",
            "r": "0.992156862745098",
            "g": "0.972549019607843",
            "b": "0.803921568627451"
         },
         {
            "v": "0.539846",
            "o": "1",
            "r": "0.992157",
            "g": "0.964706",
            "b": "0.713725"
         },
         {
            "v": "0.554756",
            "o": "1",
            "r": "0.988235",
            "g": "0.956863",
            "b": "0.643137"
         },
         {
            "v": "0.576864",
            "o": "1",
            "r": "0.980392",
            "g": "0.917647",
            "b": "0.509804"
         },
         {
            "v": "0.599486",
            "o": "1",
            "r": "0.968627",
            "g": "0.87451",
            "b": "0.407843"
         },
         {
            "v": "0.620051",
            "o": "1",
            "r": "0.94902",
            "g": "0.823529",
            "b": "0.321569"
         },
         {
            "v": "0.636504",
            "o": "1",
            "r": "0.929412",
            "g": "0.776471",
            "b": "0.278431"
         },
         {
            "v": "0.660668",
            "o": "1",
            "r": "0.909804",
            "g": "0.717647",
            "b": "0.235294"
         },
         {
            "v": "0.682262",
            "o": "1",
            "r": "0.890196",
            "g": "0.658824",
            "b": "0.196078"
         },
         {
            "v": "0.7",
            "o": "1",
            "r": "0.878431",
            "g": "0.619608",
            "b": "0.168627"
         },
         {
            "v": "0.725",
            "o": "1",
            "r": "0.870588",
            "g": "0.54902",
            "b": "0.156863"
         },
         {
            "v": "0.75",
            "o": "1",
            "r": "0.85098",
            "g": "0.47451",
            "b": "0.145098"
         },
         {
            "v": "0.775",
            "o": "1",
            "r": "0.831373",
            "g": "0.411765",
            "b": "0.133333"
         },
         {
            "v": "0.8",
            "o": "1",
            "r": "0.811765",
            "g": "0.345098",
            "b": "0.113725"
         },
         {
            "v": "0.825",
            "o": "1",
            "r": "0.788235",
            "g": "0.266667",
            "b": "0.0941176"
         },
         {
            "v": "0.85",
            "o": "1",
            "r": "0.741176",
            "g": "0.184314",
            "b": "0.0745098"
         },
         {
            "v": "0.875",
            "o": "1",
            "r": "0.690196",
            "g": "0.12549",
            "b": "0.0627451"
         },
         {
            "v": "0.9",
            "o": "1",
            "r": "0.619608",
            "g": "0.0627451",
            "b": "0.0431373"
         },
         {
            "v": "0.923393",
            "o": "1",
            "r": "0.54902",
            "g": "0.027451",
            "b": "0.0705882"
         },
         {
            "v": "0.943959",
            "o": "1",
            "r": "0.470588",
            "g": "0.0156863",
            "b": "0.0901961"
         },
         {
            "v": "0.967095",
            "o": "1",
            "r": "0.4",
            "g": "0.00392157",
            "b": "0.101961"
         },
         {
            "v": "1",
            "o": "1",
            "r": "0.188235294117647",
            "g": "0",
            "b": "0.0705882352941176"
         }
],

threewave: [
         {
            "x": "0",
            "o": "1",
            "r": "0.7490196078431373",
            "g": "0.9058823529411765",
            "b": "0.9333333333333333"
         },
         {
            "x": "0",
            "o": "1",
            "r": "0.7490196078431373",
            "g": "0.9058823529411765",
            "b": "0.9333333333333333"
         },
         {
            "x": "0.015698778629302978",
            "o": "1",
            "r": "0.6352941176470588",
            "g": "0.8235294117647058",
            "b": "0.8705882352941177"
         },
         {
            "x": "0.031397557258605956",
            "o": "1",
            "r": "0.5764705882352941",
            "g": "0.7686274509803922",
            "b": "0.8352941176470589"
         },
         {
            "x": "0.06279511451721191",
            "o": "1",
            "r": "0.4823529411764706",
            "g": "0.6666666666666666",
            "b": "0.7647058823529411"
         },
         {
            "x": "0.09419267177581787",
            "o": "1",
            "r": "0.403921568627451",
            "g": "0.5647058823529412",
            "b": "0.6941176470588235"
         },
         {
            "x": "0.12559022903442382",
            "o": "1",
            "r": "0.3333333333333333",
            "g": "0.47058823529411764",
            "b": "0.6235294117647059"
         },
         {
            "x": "0.15698778629302979",
            "o": "1",
            "r": "0.27450980392156865",
            "g": "0.39215686274509803",
            "b": "0.5568627450980392"
         },
         {
            "x": "0.18838534355163575",
            "o": "1",
            "r": "0.2196078431372549",
            "g": "0.30980392156862746",
            "b": "0.47843137254901963"
         },
         {
            "x": "0.21978290081024168",
            "o": "1",
            "r": "0.1568627450980392",
            "g": "0.2235294117647059",
            "b": "0.3843137254901961"
         },
         {
            "x": "0.25118045806884765",
            "o": "1",
            "r": "0.10980392156862745",
            "g": "0.1568627450980392",
            "b": "0.3058823529411765"
         },
         {
            "x": "0.28257801532745364",
            "o": "1",
            "r": "0.06274509803921569",
            "g": "0.07450980392156863",
            "b": "0.19215686274509805"
         },
         {
            "x": "0.3139855725860596",
            "o": "1",
            "r": "0.054902",
            "g": "0.109804",
            "b": "0.121569"
         },
         {
            "x": "0.3320312050611973",
            "o": "1",
            "r": "0.07450980392156863",
            "g": "0.16862745098039217",
            "b": "0.17647058823529413"
         },
         {
            "x": "0.350076837536335",
            "o": "1",
            "r": "0.08627450980392157",
            "g": "0.2235294117647059",
            "b": "0.21568627450980393"
         },
         {
            "x": "0.3681224700114727",
            "o": "1",
            "r": "0.09411764705882353",
            "g": "0.27058823529411763",
            "b": "0.24313725490196078"
         },
         {
            "x": "0.38616810248661043",
            "o": "1",
            "r": "0.10588235294117647",
            "g": "0.32941176470588235",
            "b": "0.27058823529411763"
         },
         {
            "x": "0.4042137349617481",
            "o": "1",
            "r": "0.11372549019607843",
            "g": "0.3843137254901961",
            "b": "0.2784313725490196"
         },
         {
            "x": "0.42225936743688586",
            "o": "1",
            "r": "0.11764705882352941",
            "g": "0.43137254901960786",
            "b": "0.27450980392156865"
         },
         {
            "x": "0.44030499991202354",
            "o": "1",
            "r": "0.11764705882352941",
            "g": "0.4745098039215686",
            "b": "0.2549019607843137"
         },
         {
            "x": "0.4583506323871612",
            "o": "1",
            "r": "0.11764705882352941",
            "g": "0.5058823529411764",
            "b": "0.2235294117647059"
         },
         {
            "x": "0.47639626486229897",
            "o": "1",
            "r": "0.11372549019607843",
            "g": "0.5333333333333333",
            "b": "0.1843137254901961"
         },
         {
            "x": "0.4944418973374367",
            "o": "1",
            "r": "0.10196078431372549",
            "g": "0.5647058823529412",
            "b": "0.12941176470588237"
         },
         {
            "x": "0.5124875298125744",
            "o": "1",
            "r": "0.09019607843137255",
            "g": "0.6",
            "b": "0.07450980392156863"
         },
         {
            "x": "0.5305331622877121",
            "o": "1",
            "r": "0.13725490196078433",
            "g": "0.6431372549019608",
            "b": "0.058823529411764705"
         },
         {
            "x": "0.5485787947628498",
            "o": "1",
            "r": "0.23137254901960785",
            "g": "0.6862745098039216",
            "b": "0.08627450980392157"
         },
         {
            "x": "0.5666244272379876",
            "o": "1",
            "r": "0.3333333333333333",
            "g": "0.7254901960784313",
            "b": "0.11764705882352941"
         },
         {
            "x": "0.5846700597131252",
            "o": "1",
            "r": "0.4392156862745098",
            "g": "0.7607843137254902",
            "b": "0.16470588235294117"
         },
         {
            "x": "0.6027156921882629",
            "o": "1",
            "r": "0.5568627450980392",
            "g": "0.8",
            "b": "0.23921568627450981"
         },
         {
            "x": "0.6207613246634006",
            "o": "1",
            "r": "0.6588235294117647",
            "g": "0.8352941176470589",
            "b": "0.2901960784313726"
         },
         {
            "x": "0.6388069571385384",
            "o": "1",
            "r": "0.7686274509803922",
            "g": "0.8745098039215686",
            "b": "0.3803921568627451"
         },
         {
            "x": "0.6568525896136761",
            "o": "1",
            "r": "0.8666666666666667",
            "g": "0.9137254901960784",
            "b": "0.5058823529411764"
         },
         {
            "x": "0.6748982220888138",
            "o": "1",
            "r": "0.9411764705882353",
            "g": "0.9411764705882353",
            "b": "0.6352941176470588"
         },
         {
            "x": "0.6749082220888137",
            "o": "1",
            "r": "0.984313725490196",
            "g": "0.9764705882352941",
            "b": "0.6941176470588235"
         },
         {
            "x": "0.6749082220888137",
            "o": "1",
            "r": "0.984313725490196",
            "g": "0.9764705882352941",
            "b": "0.6941176470588235"
         },
         {
            "x": "0.6755584056446361",
            "o": "1",
            "r": "0.984313725490196",
            "g": "0.9764705882352941",
            "b": "0.6901960784313725"
         },
         {
            "x": "0.691162810984373",
            "o": "1",
            "r": "0.9803921568627451",
            "g": "0.9568627450980393",
            "b": "0.6235294117647059"
         },
         {
            "x": "0.7074173998799324",
            "o": "1",
            "r": "0.9764705882352941",
            "g": "0.9333333333333333",
            "b": "0.5490196078431373"
         },
         {
            "x": "0.7236719887754917",
            "o": "1",
            "r": "0.9686274509803922",
            "g": "0.8980392156862745",
            "b": "0.47058823529411764"
         },
         {
            "x": "0.739926577671051",
            "o": "1",
            "r": "0.9686274509803922",
            "g": "0.8588235294117647",
            "b": "0.3843137254901961"
         },
         {
            "x": "0.7561811665666103",
            "o": "1",
            "r": "0.9607843137254902",
            "g": "0.807843137254902",
            "b": "0.29411764705882354"
         },
         {
            "x": "0.7724357554621696",
            "o": "1",
            "r": "0.9529411764705882",
            "g": "0.7529411764705882",
            "b": "0.23529411764705882"
         },
         {
            "x": "0.7886903443577289",
            "o": "1",
            "r": "0.9450980392156862",
            "g": "0.7019607843137254",
            "b": "0.17254901960784313"
         },
         {
            "x": "0.8049449332532882",
            "o": "1",
            "r": "0.9333333333333333",
            "g": "0.6431372549019608",
            "b": "0.12156862745098039"
         },
         {
            "x": "0.8211995221488475",
            "o": "1",
            "r": "0.9254901960784314",
            "g": "0.5843137254901961",
            "b": "0.0784313725490196"
         },
         {
            "x": "0.8374541110444068",
            "o": "1",
            "r": "0.9176470588235294",
            "g": "0.5294117647058824",
            "b": "0.050980392156862744"
         },
         {
            "x": "0.8537086999399661",
            "o": "1",
            "r": "0.9058823529411765",
            "g": "0.4745098039215686",
            "b": "0.03137254901960784"
         },
         {
            "x": "0.8699632888355254",
            "o": "1",
            "r": "0.8901960784313725",
            "g": "0.40784313725490196",
            "b": "0.0196078431372549"
         },
         {
            "x": "0.8862178777310847",
            "o": "1",
            "r": "0.807843137254902",
            "g": "0.3176470588235294",
            "b": "0"
         },
         {
            "x": "0.902472466626644",
            "o": "1",
            "r": "0.7686274509803922",
            "g": "0.2549019607843137",
            "b": "0"
         },
         {
            "x": "0.9187270555222034",
            "o": "1",
            "r": "0.7098039215686275",
            "g": "0.2",
            "b": "0.00784313725490196"
         },
         {
            "x": "0.9349816444177628",
            "o": "1",
            "r": "0.6392156862745098",
            "g": "0.15294117647058825",
            "b": "0.0196078431372549"
         },
         {
            "x": "0.951236233313322",
            "o": "1",
            "r": "0.5607843137254902",
            "g": "0.09803921568627451",
            "b": "0.027450980392156862"
         },
         {
            "x": "0.9674908222088814",
            "o": "1",
            "r": "0.4745098039215686",
            "g": "0.050980392156862744",
            "b": "0.0392156862745098"
         },
         {
            "x": "0.9837454111044406",
            "o": "1",
            "r": "0.38823529411764707",
            "g": "0.0392156862745098",
            "b": "0.06274509803921569"
         }
]

		//viridisLike: { URL: '/colormaps/viridis-like.json'}
};

function isFunction(obj) {
	return !!(obj && obj.constructor && obj.call && obj.apply);
}

var loaded_colormaps = {};
function getColorPreset(preset, m0, m1, brandNew)
{
	if (m0 === undefined || m0 === null || m1 === undefined || m1 === null) {
		m0 = 0;
		m1 = 1;
	}
	var len = m1-m0;

	var colorsets = COLOR_PRESETS;
	var colorScheme = colorsets[preset];
	var specialInterpolation = null;
	if (preset.indexOf('cie') > 0 || preset == 'greyscale') {
		specialInterpolation = 'lab';
	}
	else if (preset == 'blueyellow') {
		specialInterpolation = 'hsl';
	}


	if (!colorScheme)
	{
		console.error("Could not find preset: " + preset);
		return null;
	}
	else
	{
		var colorset = [];
		var normalizedFormat = false;

		if (Array.isArray(colorScheme))
		{
			colorset = [];
			for (var i=0, cLen = colorScheme.length; i<cLen; i++)
			{
				var v = len*(i/(cLen-1));
				var c = colorScheme[i];

				if (Array.isArray(c))
				{
					// if fractional numbers, multiply by 255
					if (c[0] % 1 != 0) c[0] = Math.min(255, Math.floor(.5 + c[0] * 255));
					if (c[1] % 1 != 0) c[1] = Math.min(255, Math.floor(.5 + c[1] * 255));
					if (c[2] % 1 != 0) c[2] = Math.min(255, Math.floor(.5 + c[2] * 255));

					colorset.push({
						value: c.length > 3 ? c[3] : v,
						rgb: [c[0], c[1], c[2]]
					});
				}
				else if (typeof c == 'string') {
					var cc = d3.rgb(d3.color(c));
					colorset.push({
						value: v,
						rgb: [cc.r, cc.g, cc.b]
					});
				}

				else
				{
					var r = +c.r;
					var g = +c.g;
					var b = +c.b;
					if (r % 1 != 0 || g % 1 != 0 || b % 1 != 0) {
						normalizedFormat = true;
					}

					if (r == 1 & normalizedFormat) r = 255;
					if (g == 1 & normalizedFormat) g = 255;
					if (b == 1 & normalizedFormat) b = 255;

					if (r % 1 != 0) r = Math.min(255, Math.floor(.5 + r * 255));
					if (g % 1 != 0) g = Math.min(255, Math.floor(.5 + g * 255));
					if (b % 1 != 0) b = Math.min(255, Math.floor(.5 + b * 255));


					var value;
					if (c.v !== undefined) {
						value = +c.v;
					}
					else if (c.x !== undefined) {
						value = +c.x;
					}
					else
					{
						value = v;
					}
					colorset.push({
						value: v,
						rgb: [r, g, b]
					});
				}
			}
		}
		else if (typeof(colorScheme) === 'object' && colorScheme.colorset)
		{
			colorset = colorScheme.colorset;
			if (colorScheme.interpolation) {
				specialInterpolation = colorScheme.interpolation
			}
		}
		else if (typeof(colorScheme) === 'string') {

		}
		else if (isFunction(colorScheme))
		{
			for (var s = 0, samples=100; s<samples; s++)
			{
				var n = s/(samples-1);
				var theColor = colorScheme(n);


				colorset.push({
					value: s/(samples-1),
					rgb: [theColor.r, theColor.g, theColor.b]
				});
			}
		}

		var preloaded = loaded_colormaps[preset];
		if (preloaded && !brandNew) {
			return preloaded.colormap;
		}
		else
		{
			var newMap = new ColorMap(colorset, specialInterpolation);
			loaded_colormaps[preset] = {
				colormap: newMap,
				m0: m0,
				m1: m1
			};
			return newMap;
		}
	}
}

function loadExternalColorPresets(callback)
{
	function loadExternalColorMap(presetName, path, _callback)
	{
		d3.text(path).then(function(text, error)
		{
			if (error) {
				_callback(error);
				throw error;
			}
			else
			{
				var colorScheme = JSON.parse(text);
				var newColorMap = new ColorMap(colorScheme.colorset, colorScheme.interpolation);
				COLOR_PRESETS[presetName] = colorScheme;
				loaded_colormaps[presetName] = {
					colormap: newColorMap,
					m0: 0,
					m1: 1
				};
				_callback();
			}
		});
	}

	// load URL and parse it as JSON
	var q = d3.queue();
	for (var presetName in COLOR_PRESETS)
	{
		if (COLOR_PRESETS.hasOwnProperty(presetName))
		{
			preset = COLOR_PRESETS[presetName];
			if (typeof(preset) === 'object' && preset.URL && typeof(preset.URL) === 'string')
			{
				q.defer( loadExternalColorMap, presetName, preset.URL )
			}
		}
	}
	q.awaitAll(function(error) {
		if (error) {
			throw error;
		}
		if (callback) {
			callback();
		}
	});
}

function drawColorPresets(svg, callback)
{
	var maxColorDiff = -Number.MAX_VALUE;
	var presets = [];
	for (var preset in COLOR_PRESETS)
	{
		if (COLOR_PRESETS.hasOwnProperty(preset))
		{
			var p = {
				name: preset,
				colorSet: COLOR_PRESETS[preset],
				colorMap: getColorPreset(preset),
			};

			// compute color differentials
			p.colorMap.computeColorDiff();
			maxColorDiff = Math.max(maxColorDiff, p.colorMap.maxColorDiff);

			// add to presets
			presets.push(p);
		}
	}
	console.log("max E: " + maxColorDiff);

	// scale color diffrentials according to max
	for (var i=0; i<presets.length; i++) {
		presets[i].colorMap.scaleColorDiff(maxColorDiff);
	}

	var PRESET_H = 15;
	var PRESET_W = 120;
	var PRESET_OFFSET = 5;

	svg.selectAll('image').data(presets).enter().append('image')
		.attr('width', PRESET_W)
		.attr('height', PRESET_H)
		.attr('x', 0)
		.attr('y', function(d, i) { return i *(PRESET_OFFSET + PRESET_H) })
		.attr('xlink:href', function(d, i) {
			var canvas = d.colorMap.drawColorScale(PRESET_W, PRESET_H, Math.floor(.5+PRESET_W/2), 'horizontal');
			return canvas.toDataURL();
		})
		.on('click', function(d) {
			if (callback) {
				callback(getColorPreset(d.name));
			}
		});
}

var TWO_PI = 2*Math.PI;
var SIX = 6*Math.PI/180;
var TWENTY_FIVE = 25 * Math.PI/180;
var THIRTY = 30*Math.PI/180;
var SIXTY = 2 * THIRTY;
var SIXTY_THREE = SIXTY + SIX/2;
var TWO_SEVENTY_FIVE = 275 * Math.PI/180;

var C25 = Math.pow(25, 7);

function cie76Diff(c1, c2)
{
	return Math.sqrt(
		Math.pow(c1.l-c2.l, 2) + Math.pow(c1.a-c2.a, 2) + Math.pow(c1.b-c2.b, 2)
	);
}

function cie2000Diff(c1, c2)
{
	// lightness
	var L1 = c1.l;
	var L2 = c2.l;
	var dL = L2 - L1;

	var a1 = c1.a, a2 = c2.a;
	var b1 = c1.b, b2 = c2.b;

	var b1_2 = Math.pow(b1, 2);
	var b2_2 = Math.pow(b2, 2);

	// chroma
	var C1 = Math.sqrt(Math.pow(a1,2) + b1_2);
	var C2 = Math.sqrt(Math.pow(a2,2) + b2_2);


	var L = .5 * (L1 + L2); //if (L1>0 && L2>0) L /= 2;
	var C = .5 * (C1 + C2); //if (C1>0 && C2>0) C /= 2;
	var C7   = Math.pow(C , 7);

	// (delcared globally) var C25  = Math.pow(25, 7);
	var C725 = Math.sqrt(C7/(C7+C25));

	var a1_ = a1 + .5 * a1 * (1 - C725);
	var a2_ = a2 + .5 * a2 * (1 - C725);

	var C1_ = Math.sqrt(Math.pow(a1_, 2) + b1_2);
	var C2_ = Math.sqrt(Math.pow(a2_, 2) + b2_2);
	var C_  = .5 * (C1_ + C2_); //if (C1_>0 && C2_>0) C_ /= 2;
	var dC = C2_ - C1_;

	// compute hue angle diffrentials
	var dh, dH, H;

	var h1 = Math.atan2(b1, a1_) % TWO_PI;
	var h2 = Math.atan2(b2, a2_) % TWO_PI;

	// note: an indeterminate atan2 happens when both b and a are 0
	// In this case, the Math.atan2 returns 0, which is what is assumed in the following
	// calculations
	var h21 = h2 - h1;

	if (C1_ == 0 || C2_ == 0) {
		dh = 0;
		dH = 0;
		//console.log("dH is 0");
	}
	else
	{
		dh = (Math.abs(h21) <= Math.PI ? h21 : (h2<=h1 ? h21+TWO_PI : h21-TWO_PI));
		dH = 2 * Math.sqrt(C1_ * C2_) * Math.sin(.5 * dh);
	}

	if (Math.abs(h21) <= Math.PI) {
		H = h1 + h2;
	}
	else if (h1+h2 < TWO_PI)
	{
		H = h1 + h2 + TWO_PI;
	}
	else
	{
		H = h1 + h2 - TWO_PI;
	}

	if (C1_ != 0 || C2_ != 0) {
		H *= .5;
	}

	var T = 1 -
		0.17 * Math.cos(H - THIRTY) +
		0.24 * Math.cos(2*H) +
		0.32 * Math.cos(3*H + SIX) -
		0.20 * Math.cos(4*H - SIXTY_THREE);

	var L50 = Math.pow(L - 50, 2);
	var SL = 1 + 0.015 * L50 / (Math.sqrt(20 + L50));
	var SC = 1 + 0.045 * C_;
	var SH = 1 + 0.015 * C_ * T;

	var expH = Math.pow( (H - TWO_SEVENTY_FIVE) / TWENTY_FIVE, 2);
	var RT =
		-2 * C725 *
		Math.sin(SIXTY * Math.exp( -expH ));

	var dCSC = dC/SC;
	var dHSH = dH/SH;

	var deltaE00_2 =
		Math.pow(dL/SL,2) +
		Math.pow(dCSC, 2) +
		Math.pow(dHSH, 2) +
		RT * dCSC * dHSH;

	return Math.sqrt(deltaE00_2);
}

function trimColormap(preset, cutPercent)
{
	var thePreset = COLOR_PRESETS[preset];
	var newPreset = [];

	var cut = Math.floor(.5 + (cutPercent/2) * thePreset.length);
	if (cut > 0) {
		for (var k=0, i=cut; i<thePreset.length-cut; i++, k++) {
			var e = thePreset[i];
			newPreset.push({
				r: e.r,
				b: e.b,
				g: e.g,
				x: k/(thePreset.length-cut*2-1)
			});
		}
		COLOR_PRESETS[preset]=newPreset;
	}
}
