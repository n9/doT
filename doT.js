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
	var sStatement = "\\;";	
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
			interpolate: re("([^" + sIterate + sConditional + sDefine + sUse + sParam + sBlock + sComment + sStatement + "]" + pAny + "*?)"
				+ "(?:\\s*" + sParam + "\\s*(" + pParamContent + "+?))?"),
			use: re(sUse + "\s*(" + pIdent + "+)"
				+ "(?:\\s*" + sParam + "\\s*(" + pAny + "+?))?"),
			define: re(sDefine + "\\s*(" + pIdent + "+)\\s*" + sParam + "(" + pAny + "*?)" + sUse),
			defineParam: re(sDefine),
			conditionalEnd: re(sConditional + "(" + sConditional + ")?"),
			conditionalBegin: re(sConditional + "(" + sConditional + ")?" + "(?:(" + sBlock + ")(" + pIdent + "+))?"
				+ "\\s*(" + pAny + "*?)"
				+ "(?:\\s*" + sParam + "\\s*(" + pIdent + "+))?"),
			iterateEnd: re(sIterate + "(" + sIterate + ")?"),
			iterateBegin: re(sIterate
				+ "\\s*(" + pAny + "+?)"
				+ "\\s*" + sParam + "\\s*(" + pIdent + "+)"
				+ "(?:\\s*" + sParam + "\\s*(" + pIdent + "+))?"),
			blockEnd: re(sBlock + "(\\.(" + pIdent + "*))?"),
			block: re(sBlock + "(?:(" + pIdent + "+@?)?(" + pAny + "*?))?(\\.(" + pIdent + "*))?"),
			variable: re(sParam + "(" + pAny + "+?)"),
			statement: re(sStatement + "(" + pAny + "+?)"),
			comment: re(sComment + pAny + "*?" + sComment),
			innerBeginText: "{{*<*}}",
			innerEndText: "{{*>*}}",
			innerBeginMatch: pBegin + sComment + "<" + sComment + pEnd,
			innerEndMatch: pBegin + sComment + ">" + sComment + pEnd,
			varname: 'it',
			loopFunction: "_l=function(a,f,sf){var o='';if(_c(a)){var l=a.length-1,i=-1,s='';while(i<l){if(sf&&i===0)s=sf();o+=s+f(a[++i],i);}}return o;}",
			strip: true
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
		tmpl = tmpl.replace(c.comment, function(m) { 
			return "";
		});
		var sid = 0, indv,
			str  = (c.use || c.define) ? resolveDefs(c, tmpl, def || {}) : tmpl;
		var vars = {};
		if (c.strip) {
			str = str
				.replace(/(^|\r|\n)[\t ]*|[ \t]*(\r|\n|$)/g,'\n')
				.replace(/(^|\r|\n)[\t ]*|[ \t]*(\r|\n|$)/g,'\n')
				.replace(/\n+/g,'\n')
				.replace(/^\n|\n$/g,'');
		}
		var innerBegin = c.innerBeginText + "'";
		var innerEnd = "'" + c.innerEndText;
		
		function processBlock(name, args, paramBlock, paramName) {
			var startParam = "'" + (paramName || "content") + "':function(_a){var out=" + innerBegin;
			var endBlock = "))+'";
			if (name || args) {
				var startBlock = name 
					? "'+(_b('" + name + "'" + "," + 
						(args ? unescape(args) : "null")
					: "'+_i(" + unescape(args) + "(";
				if (paramBlock) {
					return startBlock + (name ? "," : "") + "{" + startParam;
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
		};
		
		var needsLoop = false;
		str = ("out='" + str
			.replace(/'|\\/g, '\\$&')
			.replace(c.conditionalEnd, function(m, elsecase) {
				return elsecase ?  innerEnd + ";}else{out+=" + innerBegin : innerEnd + ";}out+='";
			})
			.replace(c.conditionalBegin, function(m, elsecase, block, blockName, code, vname) {
				code = unescape(code);
				if (block) {
					code = "_bm('" + blockName + "'," + (code || "null") + ")";
				}
				if (vname) {
					vars[vname] = true;
					code = vname + "=" + code;
				}
				return elsecase ? innerEnd + ";}else if(_c(" + code + ")){out+=" + innerBegin : "';if(_c(" + code + ")){out+=" + innerBegin;
			})
			.replace(c.iterateEnd, function(m, withSeparator) {
				return innerEnd + ";return out;}" + (withSeparator ? ",function(){var out=" + innerBegin : ")+'");
			})
			.replace(c.iterateBegin, function(m, iterate, vname, iname) {
				sid += 1; 
				iname = iname || "_i" + sid;
				vars[iname] = true;
				vars[vname] = true; 
				needsLoop = true;
				return "'+_l(" + unescape(iterate) + ",function(" + vname + "," + iname + "){var out=" + innerBegin;
			})
			.replace(c.blockEnd, function(m, paramBlock, paramName) {
				return processBlock(null, null, paramBlock, paramName);
			})			
			.replace(c.block, function(m, name, args, paramBlock, paramName) {
				return processBlock(name, args, paramBlock, paramName);
			})
			+ "';return out;");
		if (c.strip) {
			str = str
				.replace(new RegExp(c.innerBeginMatch + "'\\n", "g"), "'")
				.replace(new RegExp("\\n*'" + c.innerEndMatch, "g"), "'")
				.replace(c.comment, function(m) { 
					return "";
				});
		}
		str = str
			.replace(c.statement, function(m, code) {
				return "';" + unescape(code) + ";out+='";
			})	
			.replace(c.variable, function(m, code) {
				return "';var " + unescape(code) + ";out+='";
			})	
			.replace(c.interpolate, function(m, code, param) {
				return "'+_i(" + unescape(code) + (param !== undefined
					? ",'" + unescape(param) + "'"
					: "") + ")+'";
			})
			.replace(/\/\*<\*\//g, "")
			.replace(/\/\*>\*\//g, "")
			.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')
			.replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''/g, '')
			.replace(/(\s|;|\}|^|\{)out\+=''\+/g,'$1out+=');

		for (var k in vars) {
			str = k + "," + str;
		}
		if (needsLoop) {
			str = c.loopFunction + ',' + str;
		}
		return "var " + str;
	};

	doT.compile = function(tmpl, c, def) {
		c = resolveSettings(c);
		return doT.wrap(doT.template(tmpl, c, def), c);
	};
	doT.globals = function(c) {
		c = resolveSettings(c);
		return [c.varname, "_i", "_c", "_b", "_bm"];
	},
	doT.wrap = function(source, c) {
		c = resolveSettings(c);
		try {
			return new Function(c.varname, "_i", "_c", "_b", "_bm", source);
		} catch (e) {
			if (typeof console !== 'undefined') console.log("Could not create a template function: " + source);
			throw e;
		}
	};
}(this));
