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
	doT.declarationArg = '%';
	
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
		blockDef: re("(" + pIdent + "+)" + sBlock),
		block: re("(?:(?:" + sParam + ")(" + pIdent + "+))?" + sBlock + "(?:((?:" + pIdentWithSlash + "+)\\??@?)?(" + pAny + "*?))??(\\.(" + pIdentWithSlash + "*))?"),
		variable: re(sParam + "(" + pAny + "+?)"),
		statement: re(sStatement + "(" + pAny + "+?)(?:\\s*;\\s*)?"),
		comment: re(sComment + pAny + "*?" + sComment),
		innerBeginText: "{{*<*}}",
		innerEndText: "{{*>*}}",
		innerBeginMatch: pBegin + sComment + "<" + sComment + pEnd,
		innerEndMatch: pBegin + sComment + ">" + sComment + pEnd,
		dataVar: 'it',
		opVar: '_$',
		closureVar: '_c',
		argVar: '_a',
		blockContent: 'content',
		strip: true
	};

	var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': "&#34;" },
		matchHTML = /[&<>"]/g;
	
	doT.encodeHTML = function(t) {
		return t !== undefined && t !== null ? t.toString().replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : t;
	};
	doT.extractText = function(h) {
		var e = document.createElement("b");
		e.innerHTML = h;
		return e.textContent;
	};
	
	function no() { return false; }
	function pass(a) { return a; }
	
	var assign = function(target, source) {
		for (var k in source) {
			target[k] = source[k];
		}
	};
	
	doT.loop = function doTLoop(a, f, sf) { 
		var o = '', l, i, s; 
		if (typeof a === "number") {
			l = a - 1; i = -1; s = ''; 
			while (i < l) {
				if (sf && i === 0)
					s = sf(this);
				o += s + f(this, ++i, i, a);
			}
		} else if (a) {
			l = a.length - 1; i = -1; s = ''; 
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
			+ Object.keys(typeof(jas) === "object" ? jas || {} : {}).map(function(k) { return " " + k + "=" + "[" + jas[k] + "]"; }).join("")
			+ Object.keys(tas || {}).map(function(k) { return " " + k + "=" + "[" + tas[k](_$, jas) + "]"; }).join("") + "]"; 
	};
	doT.blockProcessor = function(cas, name, jas, tas) {
		var _$ = this;
		var nl = name.length;
		var isOptional = nl && name[nl - 1] === '?';
		if (isOptional)
			name = name.substr(0, nl - 1);
		var block = _$.resolveBlock(cas, name, jas) || (!isOptional && function (_$, jas, tas) {
			return _$.unknownBlock(name, jas, tas);
		});
		if (block)
			return block(_$, jas, tas);
		return "";
	};
	doT.blockSplatter = function(cas, name, jas, tas, _b) {
		var _$ = this;
		var nl = name.length;
		if (!nl || name[nl - 1] !== '@')
			return _b.call(_$, cas, name, jas, tas);
		var out = '';
		var jl = jas ? jas.length : 0;
		name = name.substr(0, nl - 1); 
		for (var i = 0; i < jl; i++)
			out += _b.call(_$, cas, name, jas[i], tas);
		return out;
	};
	
	var blockDefType = { };

	var cp = { };
	
	cp.i = function doTInterpolate(v) {
		if (v instanceof DoTLiteral)
			return v.html;
		return doT.encodeHTML(v);
	};
	
	cp.c = function doTCondition(c, a) {
		var _$ = this;
		if (!_$.ic(c))
			return false;
		a(c);
		return true;
	};
	
	cp.ic = function doTInterpolateCondition(c) { 
		return !!c && (c instanceof Array ? !!c.length : (!(c instanceof Function) || (c.type !== blockDefType)
			|| this.bm(c.closureArgs, c.blockName, c.blockArguments))); 
	};
	
	cp.l = doT.loop;
	
	cp.b = function doTBlock(cas, name, jas, tas) { 
		return doT.blockSplatter.call(this, cas, name, jas, tas, doT.blockProcessor); 
	};
		
	cp.bv = function doTBlockVar(cas, name, jas, tas) { 
		return new DoTLiteral(this.b(cas, name, jas, tas));
	};
	
	cp.ib = function doTInlineBlock(dt) { 
		var b = doT.declaration(dt);
		return function(j) { 
			return function(cc, ct) {
				return new DoTLiteral(b(cc, j, ct));
			};
		};
	};
	
	cp.bm = function doTBlockMeta(cas, name, args) {
		var _$ = this;
		var b = _$.resolveBlock(cas, name, args);
		if (!b)
			return null;
		return function(c, j, t) {
			return new DoTLiteral(b(c, j, t));
		};
	};
	
	cp.bd = function doTBlockDefine(name, dt) {
		var _$ = this;
		_$.blocks[name] = doT.declaration(dt);
	};
	
	doT.declaration = function doTDeclaration(dt) {
		var b = dt[doT.declarationArg];
		return function(cc, j, ct) {				
			var bs = {};
			assign(bs, dt);
			assign(bs, ct);
			return b(cc.clone(), j, doT.processArgs(bs));
		};
	};
	cp.resolveBlock = function(cas, name, args) {
		var _$ = this;
		return _$.callBlocks[name] || cas[name] || _$.blocks[name] || _$.unknownBlockMeta(name, args);
	};
	
	cp.block = function(cas, name, jas) {
		var blockDef = function DoTBlockDef(c, tas) {
			return new DoTLiteral(c.b(cas, name, jas, tas));
		};
		blockDef.type = blockDefType;
		blockDef.blockName = name;
		blockDef.blockArguments = jas;
		blockDef.closureArgs = cas;
		return blockDef;
	};
	
	cp.unknownBlock = doT.blockWriter;
	
	cp.unknownBlockMeta = no;
	
	doT.processArgs = function(callBlocks) {
		if (!callBlocks)
			return null;
		var newCallBlocks = {};
		Object.keys(callBlocks).forEach(function(k) {
			var b = callBlocks[k];
			newCallBlocks[k] = function(c, j, t) {
				return b(c.clone(t), j);
			};
		});
		return newCallBlocks;
	};
	
	cp.clone = function(callBlocks) {
		var _$ = this;
		var blocks = Object.create(_$.blocks);
		return new _$.constructor(blocks, doT.processArgs(callBlocks));
	};
	
	cp.fullDerive = function() {
		var C = function DoTDerivedContext(blocks, callBlocks) { 
			DoTContext.call(this, blocks, callBlocks);
		};
		C.prototype = this;
		C.prototype.constructor = C;
		return new C(this.blocks, this.callBlocks);
	};

	function DoTContext(blocks, callBlocks) { 
		this.blocks = blocks || {};
		this.callBlocks = callBlocks || {};
	}
	cp.constructor = DoTContext;
	DoTContext.prototype = cp;
	doT.Context = DoTContext;
	
	function DoTLiteral(v) {
		this.html = v;
	}
	DoTLiteral.prototype = {
		constructor: DoTLiteral,
		toString: function() { return doT.extractText(this.html); },
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
		if (c.strip) {
			str = str
				.replace(/(^|[\r\n])[\t ]*|[ \t]*([\r\n]|$)/g,'\n')
				.replace(/(^|[\r\n])[\t ]*|[ \t]*([\r\n]|$)/g,'\n')
				.replace(/\n+/g,'\n')
				.replace(/^\n|\n$/g,'');
		}
		var innerBegin = c.innerBeginText + "'";
		var innerEnd = "'" + c.innerEndText;
		
		var blockDefToken = {};
		var fullEndBlock = "));out+='";
		
		function processBlock(declareVar, name, args, paramBlock, paramName) {
			var inlineBlock = declareVar && !name && !args;
			var argVar = c.argVar;
			var moreArg = "";
			if (!paramName) {
				if (paramBlock) {
					paramName = c.blockContent;
				} else {
					paramName = doT.declarationArg;
					argVar = c.dataVar + "," + c.closureVar;
				}
			}
			var startParam = "'" + paramName + "':function(" + c.opVar + "," + argVar + "){var out=" + innerBegin;
			if (name || args || declareVar) {
				if (declareVar === blockDefToken)
					return "';(" + c.opVar + ".bd('" + name + "',{" + startParam;
				var startBlock;
				var endBlock = fullEndBlock;
				if (declareVar) {
					startBlock = "';var " + unescape(declareVar) + "=(";
					if (inlineBlock)
						return startBlock + c.opVar + ".ib({" + startParam;
				} else {
					startBlock = "'+" + (name
						? "("
						: c.opVar + ".i(");
					if (!paramBlock)
						endBlock = "))+'";
				}
				args = args ? unescape(args) : "null";
				startBlock += name 
					? c.opVar + (declareVar ? ".bv(" : ".b(") + c.closureVar + ",'" + name + "'," + (args ? unescape(args) : "null")
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
					return endParam + "}" + fullEndBlock;
				}
			}
		}
		
		var condBegin = "{out+=" + innerBegin;
		var condEnd = innerEnd + ";})";
		
		str = ("out='" + str
			.replace(/'|\\/g, '\\$&')
			.replace(c.conditionalEnd, function(m, elsecase) {
				return elsecase 
					? condEnd + "||" + c.opVar + ".c(true,function()" + condBegin
					: condEnd + ";out+='";
			})
			.replace(c.conditionalBegin, function(m, elsecase, block, blockName, code, vname) {
				code = unescape(code);
				if (block) {
					code = c.opVar + ".bm(" + c.closureVar + ",'" + blockName + "'," + (code || "null") + ")";
				}
				code = c.opVar + ".c(" + code + ",function(" + (vname || "") + ")";
				return elsecase 
					? condEnd + "||" + code + condBegin
					: "';" + code + condBegin;
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
			.replace(c.blockDef, function(m, name) {
				return processBlock(blockDefToken, name, null, null, null);
			})
			.replace(c.block, function(m, declareVar, name, args, paramBlock, paramName) {
				return processBlock(declareVar, name, args, paramBlock, paramName);
			})
			+ "';return out;");
		if (c.strip) {
			str = str
				.replace(new RegExp(c.innerBeginMatch + "'\\n", "g"), "'")
				.replace(new RegExp("\\n*'" + c.innerEndMatch, "g"), "'")
				.replace(c.comment, "")
				.replace(/;out\+='\n';/g, ";")
				.replace(/;out\+='\n'\+/g, ";out+=")
				;
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

		return "return " + c.opVar + "({'%':function(" + c.opVar + "," + c.dataVar + "," + c.closureVar + "){var " + str + "}});";
	};

	doT.compile = function(tmpl, c, def) {
		c = resolveSettings(c);
		return doT.wrap(doT.template(tmpl, c, def), c);
	};
	doT.globals = function(c) {
		c = resolveSettings(c);
		return [c.opVar];
	};
	doT.wrap = function(source, c) {
		c = resolveSettings(c);
		try {
			return new Function(c.opVar, source)(doT.declaration);
		} catch (e) {
			if (typeof console !== 'undefined') console.log("Could not create a template function: " + source);
			throw e;
		}
	};
}(this));
