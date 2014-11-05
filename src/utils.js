/* jshint maxlen:200 */

var zlib = require('zlibjs'),
    Buffer = require('buffer').Buffer,
    decodeB64 = (typeof window !== 'undefined' && window.atob) || require('Base64').atob;

var utils = module.exports = {};

utils.stringToBuffer = function (str) {
    var len = str.length,
        buf = new Buffer(len);

    for(var i = 0; i < len; i++) {
        buf[i] = str.charCodeAt(i);
    }

    return buf;
};

utils.cacheKey = function (key, type, name) {
    return key + '_' + type + (name ? '_' + name : '');
};

utils.decompressBase64Data = function (raw, encoding, compression) {
    //TODO: This assumes base64 encoding, need to check encoding param
    var str = decodeB64(raw),
        buf = utils.stringToBuffer(str);

    //decompress
    if (compression === 'gzip') {
        return zlib.gunzipSync(buf);
    }
    else if (compression === 'zlib') {
        return zlib.inflateSync(buf);
    }

    return buf;
};

/**
 * Parses an array of numbers that represent a hitArea into the actual shape.
 *
 * For example: `[1, 1, 15]` is a Circle (`[x, y, radius]`); `[1, 1, 15, 15]` is a Rectangle
 * (`[x, y, width, height]`); and any length >= 5 is a polygon in the form `[x1, y1, x2, y2, ..., xN, yN]`.
 *
 * @method parseHitArea
 * @param value {Array<Number>} The array to parse
 * @return {Circle|Rectangle|Polygon} The parsed out shape
 */
utils.parseHitArea = function (hv) {
    var shape;

    //odd number of values
    if (hv.length % 2 !== 0 && hv.length !== 3) {
        throw new RangeError(
            'Strange number of values for hitArea! Should be a flat array of values, like: ' +
            '[cx,cy,di] for a circle, [x,y,w,h] for a rectangle, or [x,y,x,y,...] for other polygons.'
        );
    }

    //a circle x,y,r
    if (hv.length === 3) {
        shape = new Phaser.Circle(hv[0], hv[1], hv[2]);
    }
    //a rectangle x,y,w,h
    else if (hv.length === 4) {
        shape = new Phaser.Rectangle(hv[0], hv[1], hv[2], hv[3]);
    }
    //generic polygon
    else {
        shape = new Phaser.Polygon(hv);
    }

    return shape;
};

/**
 * Parses an object of string properties into potential javascript types. First it attempts to
 * convert to a number, if that fails it checks for the string 'true' or 'false' and changes it
 * to the actual Boolean value, then it attempts to parse a string as JSON.
 *
 * @method parseTiledProperties
 * @param value {Array<Number>} The array to parse
 * @return {Circle|Rectangle|Polygon} The parsed out shape
 */
utils.parseTiledProperties = function (obj) {
    obj = obj || {};

    if (!obj || obj.__tiledparsed) {
        return obj;
    }

    for(var k in obj) {
        var v = obj[k],
            n = parseFloat(v, 10);

        // try to massage numbers
        if (n === 0 || n) {
            obj[k] = n;
        }
        // true values
        else if (v === 'true') {
            obj[k] = true;
        }
        // false values
        else if (v === 'false') {
            obj[k] = false;
        }
        // anything else is either a string or json
        else {
            try{
                v = JSON.parse(v);
                obj[k] = v;
            } catch(e) {}
        }
    }

    if (obj.hitArea) {
        obj.hitArea = utils.parseHitArea(obj.hitArea);
    }

    if (obj.body === 'static' || obj.sensor) {
        obj.mass = Infinity;
        obj.inertia = Infinity;
    }

    obj.__tiledparsed = true;

    return obj;
};

/**
 * Parses an XML string into a Document object. Will use window.DOMParser
 * if available, falling back to Microsoft.XMLDOM ActiveXObject in IE.
 *
 * Eventually, it would be nice to include a node.js alternative as well
 * for running in that environment.
 *
 * @method parseXML
 * @param xmlStr {String} The xml string to parse
 * @return {Document} An XML Document
 */
// browser environment
if (typeof window !== 'undefined') {
    //XML Parser in window
    if (typeof window.DOMParser !== 'undefined') {
        utils.parseXML = function(xmlStr) {
            return (new window.DOMParser()).parseFromString(xmlStr, 'text/xml');
        };
    }
    //IE specific XML parser
    else if (typeof window.ActiveXObject !== 'undefined' && new window.ActiveXObject('Microsoft.XMLDOM')) {
        utils.parseXML = function(xmlStr) {
            var xmlDoc = new window.ActiveXObject('Microsoft.XMLDOM');
            xmlDoc.async = 'false';
            xmlDoc.loadXML(xmlStr);
            return xmlDoc;
        };
    }
    // no parser available
    else {
        utils.warn('XML parser not available, trying to parse any XML will result in an error.');
        utils.parseXML = function() {
            throw new Error('Trying to parse XML, but not XML parser is available in this environment');
        };
    }
}
//node.js environment
else {
    utils.parseXML = function(xmlStr) {
        var DOMParser = require('xmldom').DOMParser;
        return (new DOMParser()).parseFromString(xmlStr, 'text/xml');
    };
}
