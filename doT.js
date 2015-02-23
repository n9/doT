// doT.js
// 2011, Laura Doktorova, https://github.com/olado/doT
// Licensed under the MIT license.

(function(global) {
	"use strict";

	var pBegin = "\\{\\{\\s*";
	var pEnd = "\\s*\\}\\}";
	var sIterate = "\@";
	var sConditional = "\\?";
	var sDefine = "\\>";
	var sUse = "\\<";
	var sParam = "\\:";
	var sBlock = "\\#"
	var sComment = "\\*"
	var pAny = "[\\s\\S]"
	var pIdent = "[\\w\\$]";
	var pIdentPath = "[\\w\\$\\.]";
	var lStringChars = "\\'\\\"";
	var pParamContent = "[^" + lStringChars + sParam 
		+ "\\{\\}" // wohak for object notation, e.g. {a: b}
		+ "]";
	
	var re = function(p) {
		return new RegExp(pBegin + p + pEnd, "g");
	};

	var doT = {
		version: '2.0.0',
		templateSettings: {
			interpolate: re("([^" + sIterate + sConditional + sDefine + sUse + sParam + sBlock + sComment + "]" + pAny + "*?)"
				+ "(?:\\s*" + sParam + "\\s*(" + pParamContent + "+?))?"),
			use: re(sUse + "\s*(" + pIdent + "+)"
				+ "(?:\\s*" + sParam + "\\s*(" + pAny + "+?))?"),
			define: re(sDefine + "\\s*(" + pIdent + "+)\\s*" + sParam + "(" + pAny + "*?)" + sUse),
			defineParam: re(sDefine),
			conditionalEnd: re(sConditional + "(" + sConditional + ")?"),
			conditionalBegin: re(sConditional + "(" + sConditional + ")?"
				+ "\\s*(" + pAny + "+?)"
				+ "(?:\\s*" + sParam + "\\s*(" + pIdent + "+))?"),
			iterateEnd: re(sIterate),
			iterateBegin: re(sIterate
				+ "\\s*(" + pAny + "+?)"
				+ "\\s*" + sParam + "\\s*(" + pIdent + "+)"
				+ "(?:\\s*" + sParam + "\\s*(" + pIdent + "+))?"),
			block: re(sBlock + "(?:(" + pIdent + "+@?)(" + pAny + "*?))?(\\.(" + pIdent + "*))?"),
			variable: re(sParam + "(" + pAny + "+?)"),
			comment: re(sComment + pAny + "*?" + sComment),
			innerBeginText: "{{*<*}}",
			innerEndText: "{{*>*}}",
			innerBeginMatch: pBegin + sComment + "<" + sComment + pEnd,
			innerEndMatch: pBegin + sComment + ">" + sComment + pEnd,
			varname:	'it',
			strip:		true,
		},
		template: undefined, //fn, compile template
		compile:  undefined  //fn, for express
	};

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = doT;
	} else if (typeof define === 'function' && define.amd) {
		define(function(){return doT;});
	} else {
		global.doT = doT;
	}

	var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': '&#34;', "'": '&#39;', "/": '&#47;' },
		matchHTML = /&|<|>|"|'|\//g;
	
	doT.encodeHTML = function(t) {
		return t !== undefined && t !== null ? t.toString().replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : t;
	};
	
	doT.interpolate = doT.encodeHTML;
	doT.condition = function(c) { return !!c; };
	doT.blockWriter = function(name, jas, tas) { 
		return "[" + name
			+ Object.keys(jas || {}).map(function(k) { return " " + k + "=" + "[" + jas[k] + "]" }).join("")
			+ Object.keys(tas || {}).map(function(k) { return " " + k + "=" + "[" + tas[k](jas) + "]" }).join("") + "]"; 
	};
	doT.blockSplatter = function (name, jas, tas, _b) {
		var nl = name.length;
		if (!nl || name[nl - 1] != '@')
			return _b(name, jas, tas);
		var out = '';
		var jl = jas ? jas.length : 0;
		name = name.substr(0, nl - 1); 
		for (var i = 0; i < jl; i++)
			out += _b(name, jas[i], tas);
		return out;
	};
	doT.block = function(name, jas, tas) { return doT.blockSplatter(name, jas, tas, doT.blockWriter); }

	var skip = /$^/;

	function resolveDefs(c, block, def) {
		return ((typeof block === 'string') ? block : block.toString())
		.replace(c.define || skip, function(m, key, content) {
			if (!(key in def)) {
				def[key] = content;
			}
			return '';
		})
		.replace(c.use || skip, function(m, key, param) {
			if (key in def) {
				return def[key].replace(c.defineParam, param === undefined
					? '' : param);
			}
			return '';
		});
	}

	function unescape(code) {
		return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, ' ');
	}
	
	function resolveSettings(options) {
		if (!options)
			return doT.templateSettings;
		if (options.prototype === doT.templateSettings)
			return options;
		var resolved = Object.create(doT.templateSettings);
		for (var prop in options) {
			if (Object.prototype.hasOwnProperty.call(options, prop)) {
				resolved[prop] = options[prop];
			}
		}
		return resolved;
	};

	doT.template = function(tmpl, c, def) {
		c = resolveSettings(c);
		var sid = 0, indv,
			str  = (c.use || c.define) ? resolveDefs(c, tmpl, def || {}) : tmpl;
		var vars = {};
		if (c.strip) {
			str = str
				.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g,' ')
				.replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g,'');
		}
		var innerBegin = c.innerBeginText + "'";
		var innerEnd = "'" + c.innerEndText;
		
		str = ("out='" + str
			.replace(/'|\\/g, '\\$&')
			.replace(c.conditionalEnd, function(m, elsecase) {
				return elsecase ?  innerEnd + ";}else{out+=" + innerBegin : innerEnd + ";}out+='";
			})
			.replace(c.conditionalBegin, function(m, elsecase, code, vname) {
				code = unescape(code);
				if (vname) {
					vars[vname] = true;
					code = vname + "=" + code;
				}
				return elsecase ? innerEnd + ";}else if(_c(" + code + ")){out+=" + innerBegin : "';if(_c(" + code + ")){out+=" + innerBegin;
			})
			.replace(c.iterateEnd, function() {
				return innerEnd + ";} } out+='";
			})
			.replace(c.iterateBegin, function(m, iterate, vname, iname) {
				sid += 1; 
				iname = iname || "_i" + sid;
				vars[iname] = true;
				vars[vname] = true; 
				var aname = "_a" + sid;
				var lname = "_l" + sid;
				return "';var " + aname + "=" + unescape(iterate) + ";if(_c(" + aname + ")){var " + lname + "=" + aname + ".length-1;" + iname + "=-1;while(" + iname + "<" + lname + "){"
					+ vname + "=" + aname + "[" + iname + "+=1];out+=" + innerBegin;
			})
			.replace(c.block, function(m, name, args, paramBlock, paramName) {
				var startParam = "'" + (paramName || "content") + "':function(_a){var out=" + innerBegin;
				var endBlock = ")+'";
				if (name) {
					var startBlock = "'+_b('" + name + "'" + ","
						+ (args ? unescape(args) : "null");
					if (paramBlock) {
						return startBlock + ",{" + startParam;
					} else {
						return startBlock + endBlock;
					}
				} else {
					var endParam = innerEnd + ";return out;}"
					if (paramBlock) {
						return endParam + "," + startParam;
					} else {
						return endParam + "}" + endBlock;
					}
				}
			})
			+ "';return out;");
		if (c.strip) {
			str = str
				.replace(new RegExp(c.innerBeginMatch + "' ", "g"), "'")
				.replace(new RegExp(" '" + c.innerEndMatch, "g"), "'")
		}
		str = str
			.replace(c.comment, function(m) { 
				return "";
			})
			.replace(c.interpolate, function(m, code, param) {
				return "'+_i(" + unescape(code) + (param !== undefined
					? ",'" + unescape(param) + "'"
					: "") + ")+'";
			})
			.replace(c.variable, function(m, command) {
				return "';var " + command + ";out+='";
			})					
			.replace(/\/\*<\*\//g, "")
			.replace(/\/\*>\*\//g, "")
			.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')
			.replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''/g, '')
			.replace(/(\s|;|\}|^|\{)out\+=''\+/g,'$1out+=');

		for (var k in vars) {
			str = k + "," + str;
		}
		return "var " + str;
	};

	doT.compile = function(tmpl, c, def) {
		c = resolveSettings(c);
		var str = doT.template(tmpl, c, def);
		try {
			return new Function(c.varname, "_i", "_c", "_b", str);
		} catch (e) {
			if (typeof console !== 'undefined') console.log("Could not create a template function: " + str);
			throw e;
		}
	};
}(this));
