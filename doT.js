// doT.js
// 2011, Laura Doktorova, https://github.com/olado/doT
// Licensed under the MIT license.

/*global define, module */
/*jshint -W014, -W054, -W089 */

(function(global) {
	"use strict";
	
	var doT = { version: '2.0.0' };

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = doT;
	} else if (typeof define === 'function' && define.amd) {
		define(function(){return doT;});
	} else {
		global.doT = doT;
	}

	var pBegin = "\\{\\{\\s*";
	var pEnd = "\\s*\\}\\}";
	var sIterate = "\@";
	var sConditional = "\\?";
	var sDefine = "\\>";
	var sUse = "\\<";
	var sParam = "\\:";
	var sBlock = "\\#";
	var sStatement = "\\;";	
	var sComment = "\\*";
	var pAny = "[\\s\\S]";
	var pIdent = "[\\w\\$]";
	var pIdentWithSlash = "[\\w\\$\\/]";
	var lStringChars = "\\'\\\"";
	var pParamContent = "[^" + lStringChars + sParam 
		+ "\\{\\}" // wohak for object notation, e.g. {a: b}
		+ "]";
	doT.recurseBlock = '%';
	
	var re = function(p) {
		return new RegExp(pBegin + p + pEnd, "g");
	};

	doT.templateSettings = {
		interpolate: re("([^" + sIterate + sConditional + sDefine + sUse + sParam + sBlock + sComment + sStatement + "]" + pAny + "*?)"
			+ "(?:\\s*" + sParam + "\\s*(" + pParamContent + "+?))?"),
		use: re(sUse + "\s*(" + pIdent + "+)"
			+ "(?:\\s*" + sParam + "\\s*(" + pAny + "+?))?"),
		define: re(sDefine + "\\s*(" + pIdent + "+)\\s*" + sParam + "(" + pAny + "*?)" + sUse),
		defineParam: re(sDefine),
		conditionalEnd: re(sConditional + "(" + sConditional + ")?"),
		conditionalBegin: re(sConditional + "(" + sConditional + ")?" + "(?:(" + sBlock + ")(" + pIdentWithSlash + "+))?"
			+ "\\s*(" + pAny + "*?)"
			+ "(?:\\s*" + sParam + "\\s*(" + pIdent + "+))?"),
		iterateEnd: re(sIterate + "(" + sIterate + ")?"),
		iterateBegin: re(sIterate
			+ "\\s*(" + pAny + "+?)"
			+ "(?:\\s*" + sParam + "\\s*(" + pIdent + "*)"
			+ "(?:\\s*" + sParam + "\\s*(" + pIdent + "*)"
			+ "(?:\\s*" + sParam + "\\s*(" + pIdent + "*))?)?)?"),
		blockParam: re("(\\.(" + pIdentWithSlash + "*))"),
		block: re("(?:(?:" + sParam + ")(" + pIdent + "+))?" + sBlock + "(?:((?:" + pIdentWithSlash + "+|" + doT.recurseBlock + ")@?)?(" + pAny + "*?))??(\\.(" + pIdentWithSlash + "*))?"),
		variable: re(sParam + "(" + pAny + "+?)"),
		statement: re(sStatement + "(" + pAny + "+?)"),
		comment: re(sComment + pAny + "*?" + sComment),
		innerBeginText: "{{*<*}}",
		innerEndText: "{{*>*}}",
		innerBeginMatch: pBegin + sComment + "<" + sComment + pEnd,
		innerEndMatch: pBegin + sComment + ">" + sComment + pEnd,
		dataVar: 'it',
		opVar: '_$',
		argVar: '_a',
		blockContent: 'content',
		strip: true
	};

	var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': '&#34;', "'": '&#39;', "/": '&#47;' },
		matchHTML = /&|<|>|"|'|\//g;
	
	doT.encodeHTML = function(t) {
		return t !== undefined && t !== null ? t.toString().replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : t;
	};
	
	function no() { return false; }
	function pass(a) { return a; }
	
	var assign = function(target, source) {
		for (var k in source) {
			target[k] = source[k];
		}
	};
	
	doT.loop = function doTLoop(a, f, sf) { 
		var o = ''; 
		if (a) {
			var l = a.length - 1, i = -1, s = ''; 
			while (i < l) {
				if (sf && i === 0)
					s = sf(this);
				o += s + f(this, a[++i], i, a);
			}
		}
		return o;
	};
	
	doT.blockWriter = function(name, jas, tas) { 
		var _$ = this;
		return "[" + name
			+ Object.keys(jas || {}).map(function(k) { return " " + k + "=" + "[" + jas[k] + "]"; }).join("")
			+ Object.keys(tas || {}).map(function(k) { return " " + k + "=" + "[" + tas[k](_$, jas) + "]"; }).join("") + "]"; 
	};
	doT.blockProcessor = function(name, jas, tas) {
		var _$ = this;
		var block = (tas && tas[name]) || _$.blocks[name];
		if (block) {
			return block(_$.mayDerive(tas), jas);
		}
		return _$.unknownBlock(name, jas, tas);
	};
	doT.blockSplatter = function (name, jas, tas, _b) {
		var _$ = this;
		var nl = name.length;
		if (!nl || name[nl - 1] !== '@')
			return _b.call(_$, name, jas, tas);
		var out = '';
		var jl = jas ? jas.length : 0;
		name = name.substr(0, nl - 1); 
		for (var i = 0; i < jl; i++)
			out += _b.call(_$, name, jas[i], tas);
		return out;
	};

	var cp = { };
	
	cp.i = function(v) {
		if (v instanceof DoTLiteral)
			return v.text;
		return doT.encodeHTML(v);
	};
	
	cp.c = function doTCondition(c) { 
		return !!c && (!(c instanceof Function) || (c.name !== 'DoTBlockDef') 
			|| this.bm(c.blockName, c.blockArguments)); 
	};
	
	cp.l = doT.loop;
	
	cp.b = function doTBlock(name, jas, tas) { 
		return doT.blockSplatter.call(this, name, jas, tas, doT.blockProcessor); 
	};
	
	cp.ib = function doTInlineBlock(dt) { 
		return function(j) { 
			return function(cc, ct) {
				var bs = {};
				assign(bs, dt);
				assign(bs, ct);
				// what about dc blocks (with prototype chain)? (closure vs. block behavior)
				var c = cc.mayDerive(bs);
				return new DoTLiteral(dt[doT.recurseBlock](c, j));
			};
		};
	};
	
	cp.bm = function doTBlockMeta(name, args) {
		var _$ = this;
		return _$.blocks[name] || _$.unknownBlockMeta(name, args);
	};
	
	cp.block = function(name, jas) {
		var blockDef = function DoTBlockDef(c, tas) {
			return new DoTLiteral(c.b(name, jas, tas));
		};
		blockDef.blockName = name;
		blockDef.blockArguments = jas;
		return blockDef;
	};
	
	cp.unknownBlock = doT.blockWriter;
	
	cp.unknownBlockMeta = no;
	
	cp.mayDerive = function(newBlocks) {
		if (!newBlocks)
			return this;
		var _$ = this;
		var blocks = Object.create(_$.blocks);
		assign(blocks, newBlocks);
		return new _$.constructor(blocks);
	};
	
	cp.fullDerive = function() {
		var C = function DoTDerivedContext(blocks) { 
			this.blocks = blocks;
		};
		C.prototype = this;
		C.prototype.constructor = C;
		return new C({});
	};

	function DoTContext(blocks) { 
		this.blocks = blocks || {};
	}
	cp.constructor = DoTContext;
	DoTContext.prototype = cp;
	doT.Context = DoTContext;
	
	function DoTLiteral(v) {
		this.text = v;
	}
	DoTLiteral.prototype = {
		constructor: DoTLiteral,
		toString: function() { return "!DoTLiteral!"; },
	};
	doT.Literal = DoTLiteral;

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
	}

	doT.template = function(tmpl, c, def) {
		c = resolveSettings(c);
		tmpl = tmpl.replace(c.comment, "");
		var sid = 0,
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
		
		function processBlock(declareVar, name, args, paramBlock, paramName) {
			var inlineBlock = declareVar && !name && !args;
			if (!paramName)
				paramName = paramBlock ? c.blockContent : doT.recurseBlock;
			var startParam = "'" + paramName + "':function(" + c.opVar + "," + c.argVar + "){var out=" + innerBegin;
			var endBlock = "));out+='";
			if (name || args || declareVar) {
				var startBlock = "'";
				if (declareVar) {
					startBlock += ";var " + unescape(declareVar) + "=(";
					if (inlineBlock)
						return startBlock + c.opVar + ".ib({" + startParam;
				} else {
					startBlock += name
						? "+("
						: "+" + c.opVar + ".i(";
				}
				args = args ? unescape(args) : "null";
				startBlock += name 
					? c.opVar + ".b('" + name + "'," + (args ? unescape(args) : "null")
					: args + "(" + c.opVar;
				if (paramBlock) {
					return startBlock + ",{" + startParam;
				} else {
					return startBlock + endBlock;
				}
			} else {
				var endParam = innerEnd + ";return out;}";
				if (paramBlock) {
					return endParam + "," + startParam;
				} else {
					return endParam + "}" + endBlock;
				}
			}
		}
		
		str = ("out='" + str
			.replace(/'|\\/g, '\\$&')
			.replace(c.conditionalEnd, function(m, elsecase) {
				return elsecase ?  innerEnd + ";}else{out+=" + innerBegin : innerEnd + ";}out+='";
			})
			.replace(c.conditionalBegin, function(m, elsecase, block, blockName, code, vname) {
				code = unescape(code);
				if (block) {
					code = c.opVar + ".bm('" + blockName + "'," + (code || "null") + ")";
				}
				if (vname) {
					vars[vname] = true;
					code = vname + "=" + code;
				}
				return elsecase ? innerEnd + ";}else if(" + c.opVar + ".c(" + code + ")){out+=" + innerBegin : "';if(" + c.opVar + ".c(" + code + ")){out+=" + innerBegin;
			})
			.replace(c.iterateEnd, function(m, withSeparator) {
				return innerEnd + ";return out;}" + (withSeparator ? ",function(" + c.opVar + "){var out=" + innerBegin : ")+'");
			})
			.replace(c.iterateBegin, function(m, iterate, vname, iname, cname) {
				var args = [c.opVar];
				if (vname) {
					args.push(vname);
					if (iname) {
						args.push(iname);
						if (cname)
							args.push(cname);
					}
				}
				return "'+" + c.opVar + ".l(" + unescape(iterate) + ",function(" + args.join(",") + "){var out=" + innerBegin;
			})
			.replace(c.blockParam, function(m, paramBlock, paramName) {
				return processBlock(null, null, null, paramBlock, paramName);
			})			
			.replace(c.block, function(m, declareVar, name, args, paramBlock, paramName) {
				return processBlock(declareVar, name, args, paramBlock, paramName);
			})
			+ "';return out;");
		if (c.strip) {
			str = str
				.replace(new RegExp(c.innerBeginMatch + "'\\n", "g"), "'")
				.replace(new RegExp("\\n*'" + c.innerEndMatch, "g"), "'")
				.replace(c.comment, "");
		}
		str = str
			.replace(c.statement, function(m, code) {
				return "';" + unescape(code) + ";out+='";
			})	
			.replace(c.variable, function(m, code) {
				return "';var " + unescape(code) + ";out+='";
			})	
			.replace(c.interpolate, function(m, code, param) {
				return "'+" + c.opVar + ".i(" + unescape(code) + (param !== undefined
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
		return "var " + str;
	};

	doT.compile = function(tmpl, c, def) {
		c = resolveSettings(c);
		return doT.wrap(doT.template(tmpl, c, def), c);
	};
	doT.globals = function(c) {
		c = resolveSettings(c);
		return [c.dataVar, c.opVar];
	};
	doT.wrap = function(source, c) {
		c = resolveSettings(c);
		try {
			return new Function(c.opVar, c.dataVar, source);
		} catch (e) {
			if (typeof console !== 'undefined') console.log("Could not create a template function: " + source);
			throw e;
		}
	};
}(this));
