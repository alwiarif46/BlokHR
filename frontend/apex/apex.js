//#region \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, c = (n, r, o) => (o = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule || !a.call(n, "default") ? t(o, "default", {
	value: n,
	enumerable: !0
}) : o, n)), l = /* @__PURE__ */ o(((e) => {
	function t(e, t) {
		var n = e.length;
		e.push(t);
		a: for (; 0 < n;) {
			var r = n - 1 >>> 1, a = e[r];
			if (0 < i(a, t)) e[r] = t, e[n] = a, n = r;
			else break a;
		}
	}
	function n(e) {
		return e.length === 0 ? null : e[0];
	}
	function r(e) {
		if (e.length === 0) return null;
		var t = e[0], n = e.pop();
		if (n !== t) {
			e[0] = n;
			a: for (var r = 0, a = e.length, o = a >>> 1; r < o;) {
				var s = 2 * (r + 1) - 1, c = e[s], l = s + 1, u = e[l];
				if (0 > i(c, n)) l < a && 0 > i(u, c) ? (e[r] = u, e[l] = n, r = l) : (e[r] = c, e[s] = n, r = s);
				else if (l < a && 0 > i(u, n)) e[r] = u, e[l] = n, r = l;
				else break a;
			}
		}
		return t;
	}
	function i(e, t) {
		var n = e.sortIndex - t.sortIndex;
		return n === 0 ? e.id - t.id : n;
	}
	if (e.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
		var a = performance;
		e.unstable_now = function() {
			return a.now();
		};
	} else {
		var o = Date, s = o.now();
		e.unstable_now = function() {
			return o.now() - s;
		};
	}
	var c = [], l = [], u = 1, d = null, f = 3, p = !1, m = !1, h = !1, g = !1, _ = typeof setTimeout == "function" ? setTimeout : null, v = typeof clearTimeout == "function" ? clearTimeout : null, y = typeof setImmediate < "u" ? setImmediate : null;
	function b(e) {
		for (var i = n(l); i !== null;) {
			if (i.callback === null) r(l);
			else if (i.startTime <= e) r(l), i.sortIndex = i.expirationTime, t(c, i);
			else break;
			i = n(l);
		}
	}
	function x(e) {
		if (h = !1, b(e), !m) {
			if (n(c) !== null) m = !0, S || (S = !0, ee());
			else {
				var t = n(l);
				t !== null && re(x, t.startTime - e);
			}
		}
	}
	var S = !1, C = -1, w = 5, T = -1;
	function E() {
		return g ? !0 : !(e.unstable_now() - T < w);
	}
	function D() {
		if (g = !1, S) {
			var t = e.unstable_now();
			T = t;
			var i = !0;
			try {
				a: {
					m = !1, h && (h = !1, v(C), C = -1), p = !0;
					var a = f;
					try {
						b: {
							for (b(t), d = n(c); d !== null && !(d.expirationTime > t && E());) {
								var o = d.callback;
								if (typeof o == "function") {
									d.callback = null, f = d.priorityLevel;
									var s = o(d.expirationTime <= t);
									if (t = e.unstable_now(), typeof s == "function") {
										d.callback = s, b(t), i = !0;
										break b;
									}
									d === n(c) && r(c), b(t);
								} else r(c);
								d = n(c);
							}
							if (d !== null) i = !0;
							else {
								var u = n(l);
								u !== null && re(x, u.startTime - t), i = !1;
							}
						}
						break a;
					} finally {
						d = null, f = a, p = !1;
					}
					i = void 0;
				}
			} finally {
				i ? ee() : S = !1;
			}
		}
	}
	var ee;
	if (typeof y == "function") ee = function() {
		y(D);
	};
	else if (typeof MessageChannel < "u") {
		var te = new MessageChannel(), ne = te.port2;
		te.port1.onmessage = D, ee = function() {
			ne.postMessage(null);
		};
	} else ee = function() {
		_(D, 0);
	};
	function re(t, n) {
		C = _(function() {
			t(e.unstable_now());
		}, n);
	}
	e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(e) {
		e.callback = null;
	}, e.unstable_forceFrameRate = function(e) {
		0 > e || 125 < e ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : w = 0 < e ? Math.floor(1e3 / e) : 5;
	}, e.unstable_getCurrentPriorityLevel = function() {
		return f;
	}, e.unstable_next = function(e) {
		switch (f) {
			case 1:
			case 2:
			case 3:
				var t = 3;
				break;
			default: t = f;
		}
		var n = f;
		f = t;
		try {
			return e();
		} finally {
			f = n;
		}
	}, e.unstable_requestPaint = function() {
		g = !0;
	}, e.unstable_runWithPriority = function(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 5: break;
			default: e = 3;
		}
		var n = f;
		f = e;
		try {
			return t();
		} finally {
			f = n;
		}
	}, e.unstable_scheduleCallback = function(r, i, a) {
		var o = e.unstable_now();
		switch (typeof a == "object" && a ? (a = a.delay, a = typeof a == "number" && 0 < a ? o + a : o) : a = o, r) {
			case 1:
				var s = -1;
				break;
			case 2:
				s = 250;
				break;
			case 5:
				s = 1073741823;
				break;
			case 4:
				s = 1e4;
				break;
			default: s = 5e3;
		}
		return s = a + s, r = {
			id: u++,
			callback: i,
			priorityLevel: r,
			startTime: a,
			expirationTime: s,
			sortIndex: -1
		}, a > o ? (r.sortIndex = a, t(l, r), n(c) === null && r === n(l) && (h ? (v(C), C = -1) : h = !0, re(x, a - o))) : (r.sortIndex = s, t(c, r), m || p || (m = !0, S || (S = !0, ee()))), r;
	}, e.unstable_shouldYield = E, e.unstable_wrapCallback = function(e) {
		var t = f;
		return function() {
			var n = f;
			f = t;
			try {
				return e.apply(this, arguments);
			} finally {
				f = n;
			}
		};
	};
})), u = /* @__PURE__ */ o(((e, t) => {
	t.exports = l();
})), d = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), a = Symbol.for("react.profiler"), o = Symbol.for("react.consumer"), s = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.memo"), d = Symbol.for("react.lazy"), f = Symbol.for("react.activity"), p = Symbol.for("react.view_transition"), m = Symbol.iterator;
	function h(e) {
		return typeof e != "object" || !e ? null : (e = m && e[m] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var g = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, _ = Object.assign, v = {};
	function y(e, t, n) {
		this.props = e, this.context = t, this.refs = v, this.updater = n || g;
	}
	y.prototype.isReactComponent = {}, y.prototype.setState = function(e, t) {
		if (typeof e != "object" && typeof e != "function" && e != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, e, t, "setState");
	}, y.prototype.forceUpdate = function(e) {
		this.updater.enqueueForceUpdate(this, e, "forceUpdate");
	};
	function b() {}
	b.prototype = y.prototype;
	function x(e, t, n) {
		this.props = e, this.context = t, this.refs = v, this.updater = n || g;
	}
	var S = x.prototype = new b();
	S.constructor = x, _(S, y.prototype), S.isPureReactComponent = !0;
	var C = Array.isArray;
	function w() {}
	var T = {
		H: null,
		A: null,
		T: null,
		S: null
	}, E = Object.prototype.hasOwnProperty;
	function D(e, n, r) {
		var i = r.ref;
		return {
			$$typeof: t,
			type: e,
			key: n,
			ref: i === void 0 ? null : i,
			props: r
		};
	}
	function ee(e, t) {
		return D(e.type, t, e.props);
	}
	function te(e) {
		return typeof e == "object" && !!e && e.$$typeof === t;
	}
	function ne(e) {
		var t = {
			"=": "=0",
			":": "=2"
		};
		return "$" + e.replace(/[=:]/g, function(e) {
			return t[e];
		});
	}
	var re = /\/+/g;
	function ie(e, t) {
		return typeof e == "object" && e && e.key != null ? ne("" + e.key) : t.toString(36);
	}
	function ae(e) {
		switch (e.status) {
			case "fulfilled": return e.value;
			case "rejected": throw e.reason;
			default: switch (typeof e.status == "string" ? e.then(w, w) : (e.status = "pending", e.then(function(t) {
				e.status === "pending" && (e.status = "fulfilled", e.value = t);
			}, function(t) {
				e.status === "pending" && (e.status = "rejected", e.reason = t);
			})), e.status) {
				case "fulfilled": return e.value;
				case "rejected": throw e.reason;
			}
		}
		throw e;
	}
	function oe(e, r, i, a, o) {
		var s = typeof e;
		(s === "undefined" || s === "boolean") && (e = null);
		var c = !1;
		if (e === null) c = !0;
		else switch (s) {
			case "bigint":
			case "string":
			case "number":
				c = !0;
				break;
			case "object": switch (e.$$typeof) {
				case t:
				case n:
					c = !0;
					break;
				case d: return c = e._init, oe(c(e._payload), r, i, a, o);
			}
		}
		if (c) return o = o(e), c = a === "" ? "." + ie(e, 0) : a, C(o) ? (i = "", c != null && (i = c.replace(re, "$&/") + "/"), oe(o, r, i, "", function(e) {
			return e;
		})) : o != null && (te(o) && (o = ee(o, i + (o.key == null || e && e.key === o.key ? "" : ("" + o.key).replace(re, "$&/") + "/") + c)), r.push(o)), 1;
		c = 0;
		var l = a === "" ? "." : a + ":";
		if (C(e)) for (var u = 0; u < e.length; u++) a = e[u], s = l + ie(a, u), c += oe(a, r, i, s, o);
		else if (u = h(e), typeof u == "function") for (e = u.call(e), u = 0; !(a = e.next()).done;) a = a.value, s = l + ie(a, u++), c += oe(a, r, i, s, o);
		else if (s === "object") {
			if (typeof e.then == "function") return oe(ae(e), r, i, a, o);
			throw r = String(e), Error("Objects are not valid as a React child (found: " + (r === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : r) + "). If you meant to render a collection of children, use an array instead.");
		}
		return c;
	}
	function se(e, t, n) {
		if (e == null) return e;
		var r = [], i = 0;
		return oe(e, r, "", "", function(e) {
			return t.call(n, e, i++);
		}), r;
	}
	function ce(e) {
		if (e._status === -1) {
			var t = e._result, n = t();
			n.then(function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 1, e._result = t, n.status === void 0 && (n.status = "fulfilled", n.value = t));
			}, function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 2, e._result = t, n.status === void 0 && (n.status = "rejected", n.reason = t));
			}), e._status === -1 && (e._status = 0, e._result = n);
		}
		if (e._status === 1) return e._result.default;
		throw e._result;
	}
	var le = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	};
	function ue(e) {
		var t = T.T, n = {};
		n.types = t === null ? null : t.types, T.T = n;
		try {
			var r = e(), i = T.S;
			i !== null && i(n, r), typeof r == "object" && r && typeof r.then == "function" && r.then(w, le);
		} catch (e) {
			le(e);
		} finally {
			t !== null && n.types !== null && (t.types = n.types), T.T = t;
		}
	}
	function de(e) {
		var t = T.T;
		if (t !== null) {
			var n = t.types;
			n === null ? t.types = [e] : n.indexOf(e) === -1 && n.push(e);
		} else ue(de.bind(null, e));
	}
	var fe = {
		map: se,
		forEach: function(e, t, n) {
			se(e, function() {
				t.apply(this, arguments);
			}, n);
		},
		count: function(e) {
			var t = 0;
			return se(e, function() {
				t++;
			}), t;
		},
		toArray: function(e) {
			return se(e, function(e) {
				return e;
			}) || [];
		},
		only: function(e) {
			if (!te(e)) throw Error("React.Children.only expected to receive a single React element child.");
			return e;
		}
	};
	e.Activity = f, e.Children = fe, e.Component = y, e.Fragment = r, e.Profiler = a, e.PureComponent = x, e.StrictMode = i, e.Suspense = l, e.ViewTransition = p, e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = T, e.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(e) {
			return T.H.useMemoCache(e);
		}
	}, e.addTransitionType = de, e.cache = function(e) {
		return function() {
			return e.apply(null, arguments);
		};
	}, e.cacheSignal = function() {
		return null;
	}, e.cloneElement = function(e, t, n) {
		if (e == null) throw Error("The argument must be a React element, but you passed " + e + ".");
		var r = _({}, e.props), i = e.key;
		if (t != null) for (a in t.key !== void 0 && (i = "" + t.key), t) !E.call(t, a) || a === "key" || a === "__self" || a === "__source" || a === "ref" && t.ref === void 0 || (r[a] = t[a]);
		var a = arguments.length - 2;
		if (a === 1) r.children = n;
		else if (1 < a) {
			for (var o = Array(a), s = 0; s < a; s++) o[s] = arguments[s + 2];
			r.children = o;
		}
		return D(e.type, i, r);
	}, e.createContext = function(e) {
		return e = {
			$$typeof: s,
			_currentValue: e,
			_currentValue2: e,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		}, e.Provider = e, e.Consumer = {
			$$typeof: o,
			_context: e
		}, e;
	}, e.createElement = function(e, t, n) {
		var r, i = {}, a = null;
		if (t != null) for (r in t.key !== void 0 && (a = "" + t.key), t) E.call(t, r) && r !== "key" && r !== "__self" && r !== "__source" && (i[r] = t[r]);
		var o = arguments.length - 2;
		if (o === 1) i.children = n;
		else if (1 < o) {
			for (var s = Array(o), c = 0; c < o; c++) s[c] = arguments[c + 2];
			i.children = s;
		}
		if (e && e.defaultProps) for (r in o = e.defaultProps, o) i[r] === void 0 && (i[r] = o[r]);
		return D(e, a, i);
	}, e.createRef = function() {
		return { current: null };
	}, e.forwardRef = function(e) {
		return {
			$$typeof: c,
			render: e
		};
	}, e.isValidElement = te, e.lazy = function(e) {
		return {
			$$typeof: d,
			_payload: {
				_status: -1,
				_result: e
			},
			_init: ce
		};
	}, e.memo = function(e, t) {
		return {
			$$typeof: u,
			type: e,
			compare: t === void 0 ? null : t
		};
	}, e.startTransition = ue, e.unstable_useCacheRefresh = function() {
		return T.H.useCacheRefresh();
	}, e.use = function(e) {
		return T.H.use(e);
	}, e.useActionState = function(e, t, n) {
		return T.H.useActionState(e, t, n);
	}, e.useCallback = function(e, t) {
		return T.H.useCallback(e, t);
	}, e.useContext = function(e) {
		return T.H.useContext(e);
	}, e.useDebugValue = function() {}, e.useDeferredValue = function(e, t) {
		return T.H.useDeferredValue(e, t);
	}, e.useEffect = function(e, t) {
		return T.H.useEffect(e, t);
	}, e.useEffectEvent = function(e) {
		return T.H.useEffectEvent(e);
	}, e.useId = function() {
		return T.H.useId();
	}, e.useImperativeHandle = function(e, t, n) {
		return T.H.useImperativeHandle(e, t, n);
	}, e.useInsertionEffect = function(e, t) {
		return T.H.useInsertionEffect(e, t);
	}, e.useLayoutEffect = function(e, t) {
		return T.H.useLayoutEffect(e, t);
	}, e.useMemo = function(e, t) {
		return T.H.useMemo(e, t);
	}, e.useOptimistic = function(e, t) {
		return T.H.useOptimistic(e, t);
	}, e.useReducer = function(e, t, n) {
		return T.H.useReducer(e, t, n);
	}, e.useRef = function(e) {
		return T.H.useRef(e);
	}, e.useState = function(e) {
		return T.H.useState(e);
	}, e.useSyncExternalStore = function(e, t, n) {
		return T.H.useSyncExternalStore(e, t, n);
	}, e.useTransition = function() {
		return T.H.useTransition();
	}, e.version = "19.3.0";
})), f = /* @__PURE__ */ o(((e, t) => {
	t.exports = d();
})), p = /* @__PURE__ */ o(((e) => {
	var t = f();
	function n(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function r() {}
	var i = {
		d: {
			f: r,
			r: function() {
				throw Error(n(522));
			},
			D: r,
			C: r,
			L: r,
			m: r,
			X: r,
			S: r,
			M: r
		},
		p: 0,
		findDOMNode: null
	}, a = Symbol.for("react.portal"), o = Symbol.for("react.recoverable"), s = Symbol.for("react.optimistic_key");
	function c(e, t, n) {
		var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
		return {
			$$typeof: a,
			key: r == null ? null : r === s ? s : "" + r,
			children: e,
			containerInfo: t,
			implementation: n
		};
	}
	var l = t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
	function u(e, t) {
		if (e === "font") return "";
		if (typeof t == "string") return t === "use-credentials" ? t : "";
	}
	e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i, e.browser = function(e) {
		return {
			$$typeof: o,
			_reason: e
		};
	}, e.createPortal = function(e, t) {
		var r = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
		if (!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11) throw Error(n(299));
		return c(e, t, null, r);
	}, e.flushSync = function(e) {
		var t = l.T, n = i.p;
		try {
			if (l.T = null, i.p = 2, e) return e();
		} finally {
			l.T = t, i.p = n, i.d.f();
		}
	}, e.preconnect = function(e, t) {
		typeof e == "string" && (t ? (t = t.crossOrigin, t = typeof t == "string" ? t === "use-credentials" ? t : "" : void 0) : t = null, i.d.C(e, t));
	}, e.prefetchDNS = function(e) {
		typeof e == "string" && i.d.D(e);
	}, e.preinit = function(e, t) {
		if (typeof e == "string" && t && typeof t.as == "string") {
			var n = t.as, r = u(n, t.crossOrigin), a = typeof t.integrity == "string" ? t.integrity : void 0, o = typeof t.fetchPriority == "string" ? t.fetchPriority : void 0;
			n === "style" ? i.d.S(e, typeof t.precedence == "string" ? t.precedence : void 0, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o
			}) : n === "script" && i.d.X(e, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0
			});
		}
	}, e.preinitModule = function(e, t) {
		if (typeof e == "string") {
			if (typeof t == "object" && t) {
				if (t.as == null || t.as === "script") {
					var n = u(t.as, t.crossOrigin);
					i.d.M(e, {
						crossOrigin: n,
						integrity: typeof t.integrity == "string" ? t.integrity : void 0,
						nonce: typeof t.nonce == "string" ? t.nonce : void 0,
						fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
					});
				}
			} else t ?? i.d.M(e);
		}
	}, e.preload = function(e, t) {
		if (typeof e == "string" && typeof t == "object" && t && typeof t.as == "string") {
			var n = t.as, r = u(n, t.crossOrigin);
			i.d.L(e, n, {
				crossOrigin: r,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0,
				type: typeof t.type == "string" ? t.type : void 0,
				fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0,
				referrerPolicy: typeof t.referrerPolicy == "string" ? t.referrerPolicy : void 0,
				imageSrcSet: typeof t.imageSrcSet == "string" ? t.imageSrcSet : void 0,
				imageSizes: typeof t.imageSizes == "string" ? t.imageSizes : void 0,
				media: typeof t.media == "string" ? t.media : void 0
			});
		}
	}, e.preloadModule = function(e, t) {
		if (typeof e == "string") {
			if (t) {
				var n = u(t.as, t.crossOrigin);
				i.d.m(e, {
					as: typeof t.as == "string" && t.as !== "script" ? t.as : void 0,
					crossOrigin: n,
					integrity: typeof t.integrity == "string" ? t.integrity : void 0,
					nonce: typeof t.nonce == "string" ? t.nonce : void 0,
					fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
				});
			} else i.d.m(e);
		}
	}, e.requestFormReset = function(e) {
		i.d.r(e);
	}, e.unstable_batchedUpdates = function(e, t) {
		return e(t);
	}, e.useFormState = function(e, t, n) {
		return l.H.useFormState(e, t, n);
	}, e.useFormStatus = function() {
		return l.H.useHostTransitionStatus();
	}, e.version = "19.3.0";
})), m = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = p();
})), h = /* @__PURE__ */ o(((e) => {
	var t = u(), n = f(), r = m();
	function i(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function a(e) {
		return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
	}
	function o(e) {
		for (var t = e, n = t; n && !n.alternate;) t = n, t.flags & 4098 && (e = t.return), n = t.return;
		for (; t.return;) t = t.return;
		return t.tag === 3 ? e : null;
	}
	function s(e) {
		if (e.tag === 13) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function c(e) {
		if (e.tag === 31) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function l(e) {
		if (o(e) !== e) throw Error(i(188));
	}
	function d(e) {
		var t = e.alternate;
		if (!t) {
			if (t = o(e), t === null) throw Error(i(188));
			return t === e ? e : null;
		}
		for (var n = e, r = t;;) {
			var a = n.return;
			if (a === null) break;
			var s = a.alternate;
			if (s === null) {
				if (r = a.return, r !== null) {
					n = r;
					continue;
				}
				break;
			}
			if (a.child === s.child) {
				for (s = a.child; s;) {
					if (s === n) return l(a), e;
					if (s === r) return l(a), t;
					s = s.sibling;
				}
				throw Error(i(188));
			}
			if (n.return !== r.return) n = a, r = s;
			else {
				for (var c = !1, u = a.child; u;) {
					if (u === n) {
						c = !0, n = a, r = s;
						break;
					}
					if (u === r) {
						c = !0, r = a, n = s;
						break;
					}
					u = u.sibling;
				}
				if (!c) {
					for (u = s.child; u;) {
						if (u === n) {
							c = !0, n = s, r = a;
							break;
						}
						if (u === r) {
							c = !0, r = s, n = a;
							break;
						}
						u = u.sibling;
					}
					if (!c) throw Error(i(189));
				}
			}
			if (n.alternate !== r) throw Error(i(190));
		}
		if (n.tag !== 3) throw Error(i(188));
		return n.stateNode.current === n ? e : t;
	}
	function p(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e;
		for (e = e.child; e !== null;) {
			if (t = p(e), t !== null) return t;
			e = e.sibling;
		}
		return null;
	}
	function h(e, t, n, r, i, a) {
		for (; e !== null;) {
			if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && n(e, r, i, a) || (e.tag !== 22 || e.memoizedState === null) && (t || e.tag !== 5 && e.tag !== 27) && h(e.child, t, n, r, i, a)) return !0;
			e = e.sibling;
		}
		return !1;
	}
	function g(e) {
		for (e = e.return; e !== null;) {
			if (e.tag === 3 || e.tag === 5 || e.tag === 27) return e;
			e = e.return;
		}
		return null;
	}
	function _(e) {
		var t = !1;
		for (e = e.return; e !== null && (e.tag === 4 && (t = !0), e.tag !== 3 && e.tag !== 5 && e.tag !== 27);) e = e.return;
		return t;
	}
	function v(e) {
		var t = [null, null], n = g(e);
		return n === null || y(t, e, n.child, { foundSelf: !1 }), t;
	}
	function y(e, t, n, r) {
		for (; n !== null;) {
			if (n === t) r.foundSelf = !0;
			else if (n.tag === 5 || n.tag === 27 || n.tag === 6) {
				if (r.foundSelf) return e[1] = n, !0;
				e[0] = n;
			} else if ((n.tag !== 22 || n.memoizedState === null) && y(e, t, n.child, r)) return !0;
			n = n.sibling;
		}
		return !1;
	}
	function b(e) {
		switch (e.tag) {
			case 5:
			case 27:
			case 6: return e.stateNode;
			case 3: return e.stateNode.containerInfo;
			default: throw Error(i(559));
		}
	}
	var x = null, S = null;
	function C(e, t, n) {
		return e === n || e === t && (x = e, !0);
	}
	function w(e, t, n) {
		return e === n ? (S = e, !1) : e === t && (S !== null && (x = e), !0);
	}
	function T(e) {
		if (e === null) return null;
		do
			e = e === null ? null : e.return;
		while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
		return e || null;
	}
	function E(e, t, n) {
		for (var r = 0, i = e; i; i = n(i)) r++;
		i = 0;
		for (var a = t; a; a = n(a)) i++;
		for (; 0 < r - i;) e = n(e), r--;
		for (; 0 < i - r;) t = n(t), i--;
		for (; r--;) {
			if (e === t || t !== null && e === t.alternate) return e;
			e = n(e), t = n(t);
		}
		return null;
	}
	var D = Object.assign, ee = Symbol.for("react.element"), te = Symbol.for("react.transitional.element"), ne = Symbol.for("react.portal"), re = Symbol.for("react.fragment"), ie = Symbol.for("react.strict_mode"), ae = Symbol.for("react.profiler"), oe = Symbol.for("react.consumer"), se = Symbol.for("react.context"), ce = Symbol.for("react.forward_ref"), le = Symbol.for("react.suspense"), ue = Symbol.for("react.suspense_list"), de = Symbol.for("react.memo"), fe = Symbol.for("react.lazy"), pe = Symbol.for("react.activity"), me = Symbol.for("react.legacy_hidden"), he = Symbol.for("react.memo_cache_sentinel"), ge = Symbol.for("react.view_transition"), _e = Symbol.for("react.recoverable"), ve = Symbol.iterator;
	function ye(e) {
		return typeof e != "object" || !e ? null : (e = ve && e[ve] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var be = Symbol.for("react.client.reference");
	function xe(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === be ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case re: return "Fragment";
			case ae: return "Profiler";
			case ie: return "StrictMode";
			case le: return "Suspense";
			case ue: return "SuspenseList";
			case pe: return "Activity";
			case ge: return "ViewTransition";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case ne: return "Portal";
			case se: return e.displayName || "Context";
			case oe: return (e._context.displayName || "Context") + ".Consumer";
			case ce:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case de: return t = e.displayName || null, t === null ? xe(e.type) || "Memo" : t;
			case fe:
				t = e._payload, e = e._init;
				try {
					return xe(e(t));
				} catch {}
		}
		return null;
	}
	var Se = Array.isArray, O = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, k = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Ce = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, we = [], Te = -1;
	function Ee(e) {
		return { current: e };
	}
	function De(e) {
		0 > Te || (e.current = we[Te], we[Te] = null, Te--);
	}
	function A(e, t) {
		Te++, we[Te] = e.current, e.current = t;
	}
	var Oe = Ee(null), ke = Ee(null), Ae = Ee(null), je = Ee(null);
	function Me(e, t) {
		switch (A(Ae, t), A(ke, e), A(Oe, null), t.nodeType) {
			case 9:
			case 11:
				e = (e = t.documentElement) && (e = e.namespaceURI) ? dp(e) : 0;
				break;
			default: if (e = t.tagName, t = t.namespaceURI) t = dp(t), e = fp(t, e);
			else switch (e) {
				case "svg":
					e = 1;
					break;
				case "math":
					e = 2;
					break;
				default: e = 0;
			}
		}
		De(Oe), A(Oe, e);
	}
	function Ne() {
		De(Oe), De(ke), De(Ae);
	}
	function Pe(e) {
		var t = e.memoizedState;
		t !== null && (sh._currentValue = t.memoizedState, A(je, e)), t = Oe.current;
		var n = fp(t, e.type);
		t !== n && (A(ke, e), A(Oe, n));
	}
	function Fe(e) {
		ke.current === e && (De(Oe), De(ke)), je.current === e && (De(je), sh._currentValue = Ce);
	}
	var Ie, Le;
	function Re(e) {
		if (Ie === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			Ie = t && t[1] || "", Le = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + Ie + e + Le;
	}
	var ze = !1;
	function Be(e, t) {
		if (!e || ze) return "";
		ze = !0;
		var n = Error.prepareStackTrace;
		Error.prepareStackTrace = void 0;
		try {
			var r = { DetermineComponentFrameRoot: function() {
				try {
					if (t) {
						var n = function() {
							throw Error();
						};
						if (Object.defineProperty(n.prototype, "props", { set: function() {
							throw Error();
						} }), typeof Reflect == "object" && Reflect.construct) {
							try {
								Reflect.construct(n, []);
							} catch (e) {
								var r = e;
							}
							Reflect.construct(e, [], n);
						} else {
							try {
								n.call();
							} catch (e) {
								r = e;
							}
							n = !1;
							try {
								var i = Object.getOwnPropertyDescriptor(e.prototype, "props");
								Object.defineProperty(e.prototype, "props", {
									configurable: !0,
									set: function() {
										throw Error();
									}
								}), n = !0, new e();
							} finally {
								n && (i === void 0 ? delete e.prototype.props : Object.defineProperty(e.prototype, "props", i));
							}
						}
					} else {
						try {
							throw Error();
						} catch (e) {
							r = e;
						}
						(n = e()) && typeof n.catch == "function" && n.catch(function() {});
					}
				} catch (e) {
					if (e && r && typeof e.stack == "string") return [e.stack, r.stack];
				}
				return [null, null];
			} };
			r.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
			var i = Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot, "name");
			i && i.configurable && Object.defineProperty(r.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
			var a = r.DetermineComponentFrameRoot(), o = a[0], s = a[1];
			if (o && s) {
				var c = o.split("\n"), l = s.split("\n");
				for (i = r = 0; r < c.length && !c[r].includes("DetermineComponentFrameRoot");) r++;
				for (; i < l.length && !l[i].includes("DetermineComponentFrameRoot");) i++;
				if (r === c.length || i === l.length) for (r = c.length - 1, i = l.length - 1; 1 <= r && 0 <= i && c[r] !== l[i];) i--;
				for (; 1 <= r && 0 <= i; r--, i--) if (c[r] !== l[i]) {
					if (r !== 1 || i !== 1) do
						if (r--, i--, 0 > i || c[r] !== l[i]) {
							var u = "\n" + c[r].replace(" at new ", " at ");
							return e.displayName && u.includes("<anonymous>") && (u = u.replace("<anonymous>", e.displayName)), u;
						}
					while (1 <= r && 0 <= i);
					break;
				}
			}
		} finally {
			ze = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? Re(n) : "";
	}
	function Ve(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return Re(e.type);
			case 16: return Re("Lazy");
			case 13: return e.child !== t && t !== null ? Re("Suspense Fallback") : Re("Suspense");
			case 19: return Re("SuspenseList");
			case 0:
			case 15: return Be(e.type, !1);
			case 11: return Be(e.type.render, !1);
			case 1: return Be(e.type, !0);
			case 31: return Re("Activity");
			case 30: return Re("ViewTransition");
			default: return "";
		}
	}
	function He(e) {
		try {
			var t = "", n = null;
			do
				t += Ve(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var Ue = Object.prototype.hasOwnProperty, We = t.unstable_scheduleCallback, Ge = t.unstable_cancelCallback, Ke = t.unstable_shouldYield, qe = t.unstable_requestPaint, Je = t.unstable_now, Ye = t.unstable_getCurrentPriorityLevel, Xe = t.unstable_ImmediatePriority, Ze = t.unstable_UserBlockingPriority, Qe = t.unstable_NormalPriority, $e = t.unstable_LowPriority, et = t.unstable_IdlePriority, tt = t.log, nt = t.unstable_setDisableYieldValue, rt = null, it = null;
	function at(e) {
		if (typeof tt == "function" && nt(e), it && typeof it.setStrictMode == "function") try {
			it.setStrictMode(rt, e);
		} catch {}
	}
	var ot = Math.clz32 ? Math.clz32 : lt, st = Math.log, ct = Math.LN2;
	function lt(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (st(e) / ct | 0) | 0;
	}
	var ut = 256, dt = 262144, ft = 4194304;
	function pt(e) {
		var t = e & 42;
		if (t !== 0) return t;
		switch (e & -e) {
			case 1: return 1;
			case 2: return 2;
			case 4: return 4;
			case 8: return 8;
			case 16: return 16;
			case 32: return 32;
			case 64: return 64;
			case 128: return 128;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072: return e & -e;
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return e & 3932160;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return e & 62914560;
			case 67108864: return 67108864;
			case 134217728: return 134217728;
			case 268435456: return 268435456;
			case 536870912: return 536870912;
			case 1073741824: return 0;
			default: return e;
		}
	}
	function mt(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = pt(n))) : i = pt(o) : i = pt(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = pt(n))) : i = pt(o)) : i = pt(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function ht(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function gt(e, t) {
		t & 8 && (t |= t & 32);
		var n = e.entangledLanes;
		if (n !== 0) for (e = e.entanglements, n &= t; 0 < n;) {
			var r = 31 - ot(n), i = 1 << r;
			t |= e[r], n &= ~i;
		}
		return t;
	}
	function _t(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 4:
			case 8:
			case 64: return t + 250;
			case 16:
			case 32:
			case 128:
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return t + 5e3;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return -1;
			case 67108864:
			case 134217728:
			case 268435456:
			case 536870912:
			case 1073741824: return -1;
			default: return -1;
		}
	}
	function vt() {
		var e = ft;
		return ft <<= 1, !(ft & 62914560) && (ft = 4194304), e;
	}
	function yt(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function bt(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function xt(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - ot(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && St(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function St(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - ot(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function Ct(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - ot(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function wt(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : Tt(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function Tt(e) {
		switch (e) {
			case 2:
				e = 1;
				break;
			case 8:
				e = 4;
				break;
			case 32:
				e = 16;
				break;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152:
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432:
				e = 128;
				break;
			case 268435456:
				e = 134217728;
				break;
			default: e = 0;
		}
		return e;
	}
	function Et(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function Dt() {
		var e = k.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : Ch(e.type)) : e;
	}
	function Ot(e, t) {
		var n = k.p;
		try {
			return k.p = e, t();
		} finally {
			k.p = n;
		}
	}
	var kt = Math.random().toString(36).slice(2), At = "__reactFiber$" + kt, jt = "__reactProps$" + kt, Mt = "__reactContainer$" + kt, Nt = "__reactEvents$" + kt, Pt = "__reactListeners$" + kt, Ft = "__reactHandles$" + kt, It = "__reactResources$" + kt, Lt = "__reactMarker$" + kt, Rt = "__reactLoad$" + kt;
	function zt(e) {
		delete e[At], delete e[jt], delete e[Pt], delete e[Ft];
	}
	function Bt(e) {
		var t;
		if (t = e[At]) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[Mt] || n[At]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = fm(e); e !== null;) {
					if (n = e[At]) return n;
					e = fm(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function Vt(e) {
		if (e = e[At] || e[Mt]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function Ht(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(i(33));
	}
	function Ut(e) {
		var t = e[It];
		return t ||= e[It] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function Wt(e) {
		e[Lt] = !0;
	}
	function Gt(e) {
		e[Rt] = void 0;
	}
	var Kt = /* @__PURE__ */ new Set(), qt = {};
	function Jt(e, t) {
		Yt(e, t), Yt(e + "Capture", t);
	}
	function Yt(e, t) {
		for (qt[e] = t, e = 0; e < t.length; e++) Kt.add(t[e]);
	}
	var Xt = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), Zt = {}, Qt = {};
	function $t(e) {
		return Ue.call(Qt, e) ? !0 : Ue.call(Zt, e) ? !1 : Xt.test(e) ? Qt[e] = !0 : (Zt[e] = !0, !1);
	}
	var j = !1;
	function en() {
		var e = j;
		return j = !1, e;
	}
	function tn(e, t, n) {
		if ($t(t)) {
			if (n === null) e.removeAttribute(t);
			else {
				switch (typeof n) {
					case "undefined":
					case "function":
					case "symbol":
						e.removeAttribute(t);
						return;
					case "boolean":
						var r = t.toLowerCase().slice(0, 5);
						if (r !== "data-" && r !== "aria-") {
							e.removeAttribute(t);
							return;
						}
				}
				e.setAttribute(t, n);
			}
		}
	}
	function nn(e, t, n) {
		if (n === null) e.removeAttribute(t);
		else {
			switch (typeof n) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(t);
					return;
			}
			e.setAttribute(t, n);
		}
	}
	function rn(e, t, n, r) {
		if (r === null) e.removeAttribute(n);
		else {
			switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(n);
					return;
			}
			e.setAttributeNS(t, n, r);
		}
	}
	function an(e) {
		switch (typeof e) {
			case "bigint":
			case "boolean":
			case "number":
			case "string":
			case "undefined": return e;
			case "object": return e;
			default: return "";
		}
	}
	function on(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function sn(e, t, n) {
		var r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
		if (!e.hasOwnProperty(t) && r !== void 0 && typeof r.get == "function" && typeof r.set == "function") {
			var i = r.get, a = r.set;
			return Object.defineProperty(e, t, {
				configurable: !0,
				get: function() {
					return i.call(this);
				},
				set: function(e) {
					n = "" + e, a.call(this, e);
				}
			}), Object.defineProperty(e, t, { enumerable: r.enumerable }), {
				getValue: function() {
					return n;
				},
				setValue: function(e) {
					n = "" + e;
				},
				stopTracking: function() {
					e._valueTracker = null, delete e[t];
				}
			};
		}
	}
	function cn(e) {
		if (!e._valueTracker) {
			var t = on(e) ? "checked" : "value";
			e._valueTracker = sn(e, t, "" + e[t]);
		}
	}
	function ln(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = on(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n && (t.setValue(e), !0);
	}
	var un = /[\n"\\]/g;
	function dn(e) {
		return e.replace(un, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function fn(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + an(t)) : e.value !== "" + an(t) && (e.value = "" + an(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : mn(e, an(n)) : o === "number" && e.value == t ? mn(e, an(e.value)) : mn(e, an(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + an(s) : e.removeAttribute("name");
	}
	function pn(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				cn(e);
				return;
			}
			n = n == null ? "" : "" + an(n), t = t == null ? n : "" + an(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), cn(e);
	}
	function mn(e, t) {
		e.defaultValue !== "" + t && (e.defaultValue = "" + t);
	}
	function hn(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + an(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function gn(e, t, n) {
		if (t != null && (t = "" + an(t), t !== e.value && (e.value = t), n == null)) {
			e.defaultValue !== t && (e.defaultValue = t);
			return;
		}
		e.defaultValue = n == null ? "" : "" + an(n);
	}
	function _n(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(i(92));
				if (Se(r)) {
					if (1 < r.length) throw Error(i(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = an(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), cn(e);
	}
	function vn(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var yn = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function bn(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || yn.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function xn(e, t, n) {
		if (t != null && typeof t != "object") throw Error(i(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "", j = !0);
			for (var a in t) r = t[a], t.hasOwnProperty(a) && n[a] !== r && (bn(e, a, r), j = !0);
		} else for (var o in t) t.hasOwnProperty(o) && bn(e, o, t[o]);
	}
	function Sn(e) {
		if (e.indexOf("-") === -1) return !1;
		switch (e) {
			case "annotation-xml":
			case "color-profile":
			case "font-face":
			case "font-face-src":
			case "font-face-uri":
			case "font-face-format":
			case "font-face-name":
			case "missing-glyph": return !1;
			default: return !0;
		}
	}
	var Cn = /* @__PURE__ */ new Map([
		["acceptCharset", "accept-charset"],
		["htmlFor", "for"],
		["httpEquiv", "http-equiv"],
		["crossOrigin", "crossorigin"],
		["accentHeight", "accent-height"],
		["alignmentBaseline", "alignment-baseline"],
		["arabicForm", "arabic-form"],
		["baselineShift", "baseline-shift"],
		["capHeight", "cap-height"],
		["clipPath", "clip-path"],
		["clipRule", "clip-rule"],
		["colorInterpolation", "color-interpolation"],
		["colorInterpolationFilters", "color-interpolation-filters"],
		["colorProfile", "color-profile"],
		["colorRendering", "color-rendering"],
		["dominantBaseline", "dominant-baseline"],
		["enableBackground", "enable-background"],
		["fillOpacity", "fill-opacity"],
		["fillRule", "fill-rule"],
		["floodColor", "flood-color"],
		["floodOpacity", "flood-opacity"],
		["fontFamily", "font-family"],
		["fontSize", "font-size"],
		["fontSizeAdjust", "font-size-adjust"],
		["fontStretch", "font-stretch"],
		["fontStyle", "font-style"],
		["fontVariant", "font-variant"],
		["fontWeight", "font-weight"],
		["glyphName", "glyph-name"],
		["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
		["glyphOrientationVertical", "glyph-orientation-vertical"],
		["horizAdvX", "horiz-adv-x"],
		["horizOriginX", "horiz-origin-x"],
		["imageRendering", "image-rendering"],
		["letterSpacing", "letter-spacing"],
		["lightingColor", "lighting-color"],
		["markerEnd", "marker-end"],
		["markerMid", "marker-mid"],
		["markerStart", "marker-start"],
		["maskType", "mask-type"],
		["overlinePosition", "overline-position"],
		["overlineThickness", "overline-thickness"],
		["paintOrder", "paint-order"],
		["panose-1", "panose-1"],
		["pointerEvents", "pointer-events"],
		["renderingIntent", "rendering-intent"],
		["shapeRendering", "shape-rendering"],
		["stopColor", "stop-color"],
		["stopOpacity", "stop-opacity"],
		["strikethroughPosition", "strikethrough-position"],
		["strikethroughThickness", "strikethrough-thickness"],
		["strokeDasharray", "stroke-dasharray"],
		["strokeDashoffset", "stroke-dashoffset"],
		["strokeLinecap", "stroke-linecap"],
		["strokeLinejoin", "stroke-linejoin"],
		["strokeMiterlimit", "stroke-miterlimit"],
		["strokeOpacity", "stroke-opacity"],
		["strokeWidth", "stroke-width"],
		["textAnchor", "text-anchor"],
		["textDecoration", "text-decoration"],
		["textRendering", "text-rendering"],
		["transformOrigin", "transform-origin"],
		["underlinePosition", "underline-position"],
		["underlineThickness", "underline-thickness"],
		["unicodeBidi", "unicode-bidi"],
		["unicodeRange", "unicode-range"],
		["unitsPerEm", "units-per-em"],
		["vAlphabetic", "v-alphabetic"],
		["vHanging", "v-hanging"],
		["vIdeographic", "v-ideographic"],
		["vMathematical", "v-mathematical"],
		["vectorEffect", "vector-effect"],
		["vertAdvY", "vert-adv-y"],
		["vertOriginX", "vert-origin-x"],
		["vertOriginY", "vert-origin-y"],
		["wordSpacing", "word-spacing"],
		["writingMode", "writing-mode"],
		["xmlnsXlink", "xmlns:xlink"],
		["xHeight", "x-height"]
	]), wn = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function Tn(e) {
		return wn.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function En() {}
	var Dn = null;
	function On(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var kn = null, An = null;
	function jn(e) {
		var t = Vt(e);
		if (t && (e = t.stateNode)) {
			var n = e[jt] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (fn(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + dn("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var a = r[jt] || null;
								if (!a) throw Error(i(90));
								fn(r, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && ln(r);
					}
					break a;
				case "textarea":
					gn(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && hn(e, !!n.multiple, t, !1);
			}
		}
	}
	var Mn = !1;
	function Nn(e, t, n) {
		if (Mn) return e(t, n);
		Mn = !0;
		try {
			return e(t);
		} finally {
			if (Mn = !1, (kn !== null || An !== null) && (Bd(), kn && (t = kn, e = An, An = kn = null, jn(t), e))) for (t = 0; t < e.length; t++) jn(e[t]);
		}
	}
	function Pn(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[jt] || null;
		if (r === null) return null;
		n = r[t];
		a: switch (t) {
			case "onClick":
			case "onClickCapture":
			case "onDoubleClick":
			case "onDoubleClickCapture":
			case "onMouseDown":
			case "onMouseDownCapture":
			case "onMouseMove":
			case "onMouseMoveCapture":
			case "onMouseUp":
			case "onMouseUpCapture":
			case "onMouseEnter":
				(r = !r.disabled) || (e = e.type, r = e !== "button" && e !== "input" && e !== "select" && e !== "textarea"), e = !r;
				break a;
			default: e = !1;
		}
		if (e) return null;
		if (n && typeof n != "function") throw Error(i(231, t, typeof n));
		return n;
	}
	var Fn = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, In = !1;
	if (Fn) try {
		var Ln = {};
		Object.defineProperty(Ln, "passive", { get: function() {
			In = !0;
		} }), window.addEventListener("test", Ln, Ln), window.removeEventListener("test", Ln, Ln);
	} catch {
		In = !1;
	}
	var Rn = null, zn = null, Bn = null;
	function Vn() {
		if (Bn) return Bn;
		var e, t = zn, n = t.length, r, i = "value" in Rn ? Rn.value : Rn.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return Bn = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function Hn(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function Un() {
		return !0;
	}
	function Wn() {
		return !1;
	}
	function Gn(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? Un : Wn, this.isPropagationStopped = Wn, this;
		}
		return D(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = Un);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = Un);
			},
			persist: function() {},
			isPersistent: Un
		}), t;
	}
	var Kn = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, qn = Gn(Kn), Jn = D({}, Kn, {
		view: 0,
		detail: 0
	}), Yn = Gn(Jn), Xn, Zn, Qn, $n = D({}, Jn, {
		screenX: 0,
		screenY: 0,
		clientX: 0,
		clientY: 0,
		pageX: 0,
		pageY: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		getModifierState: ur,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== Qn && (Qn && e.type === "mousemove" ? (Xn = e.screenX - Qn.screenX, Zn = e.screenY - Qn.screenY) : Zn = Xn = 0, Qn = e), Xn);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : Zn;
		}
	}), er = Gn($n), tr = Gn(D({}, $n, { dataTransfer: 0 })), nr = Gn(D({}, Jn, { relatedTarget: 0 })), rr = Gn(D({}, Kn, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), ir = Gn(D({}, Kn, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), ar = Gn(D({}, Kn, { data: 0 })), or = {
		Esc: "Escape",
		Spacebar: " ",
		Left: "ArrowLeft",
		Up: "ArrowUp",
		Right: "ArrowRight",
		Down: "ArrowDown",
		Del: "Delete",
		Win: "OS",
		Menu: "ContextMenu",
		Apps: "ContextMenu",
		Scroll: "ScrollLock",
		MozPrintableKey: "Unidentified"
	}, sr = {
		8: "Backspace",
		9: "Tab",
		12: "Clear",
		13: "Enter",
		16: "Shift",
		17: "Control",
		18: "Alt",
		19: "Pause",
		20: "CapsLock",
		27: "Escape",
		32: " ",
		33: "PageUp",
		34: "PageDown",
		35: "End",
		36: "Home",
		37: "ArrowLeft",
		38: "ArrowUp",
		39: "ArrowRight",
		40: "ArrowDown",
		45: "Insert",
		46: "Delete",
		112: "F1",
		113: "F2",
		114: "F3",
		115: "F4",
		116: "F5",
		117: "F6",
		118: "F7",
		119: "F8",
		120: "F9",
		121: "F10",
		122: "F11",
		123: "F12",
		144: "NumLock",
		145: "ScrollLock",
		224: "Meta"
	}, cr = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function lr(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = cr[e]) ? !!t[e] : !1;
	}
	function ur() {
		return lr;
	}
	var dr = Gn(D({}, Jn, {
		key: function(e) {
			if (e.key) {
				var t = or[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = Hn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? sr[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: ur,
		charCode: function(e) {
			return e.type === "keypress" ? Hn(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? Hn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), fr = Gn(D({}, $n, {
		pointerId: 0,
		width: 0,
		height: 0,
		pressure: 0,
		tangentialPressure: 0,
		tiltX: 0,
		tiltY: 0,
		twist: 0,
		pointerType: 0,
		isPrimary: 0
	})), pr = Gn(D({}, Kn, { submitter: 0 })), mr = Gn(D({}, Jn, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: ur
	})), hr = Gn(D({}, Kn, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), gr = Gn(D({}, $n, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), _r = Gn(D({}, Kn, {
		newState: 0,
		oldState: 0,
		source: 0
	})), vr = [
		9,
		13,
		27,
		32
	], yr = Fn && "CompositionEvent" in window, br = null;
	Fn && "documentMode" in document && (br = document.documentMode);
	var xr = Fn && "TextEvent" in window && !br, Sr = Fn && (!yr || br && 8 < br && 11 >= br), Cr = " ", wr = !1;
	function Tr(e, t) {
		switch (e) {
			case "keyup": return vr.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function Er(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var Dr = !1;
	function Or(e, t) {
		switch (e) {
			case "compositionend": return Er(t);
			case "keypress": return t.which === 32 ? (wr = !0, Cr) : null;
			case "textInput": return e = t.data, e === Cr && wr ? null : e;
			default: return null;
		}
	}
	function kr(e, t) {
		if (Dr) return e === "compositionend" || !yr && Tr(e, t) ? (e = Vn(), Bn = zn = Rn = null, Dr = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return Sr && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var Ar = {
		color: !0,
		date: !0,
		datetime: !0,
		"datetime-local": !0,
		email: !0,
		month: !0,
		number: !0,
		password: !0,
		range: !0,
		search: !0,
		tel: !0,
		text: !0,
		time: !0,
		url: !0,
		week: !0
	};
	function jr(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!Ar[e.type] : t === "textarea";
	}
	function Mr(e, t, n, r) {
		kn ? An ? An.push(r) : An = [r] : kn = r, t = Yf(t, "onChange"), 0 < t.length && (n = new qn("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var Nr = null, Pr = null;
	function Fr(e) {
		Hf(e, 0);
	}
	function Ir(e) {
		if (ln(Ht(e))) return e;
	}
	function Lr(e, t) {
		if (e === "change") return t;
	}
	var Rr = !1;
	if (Fn) {
		var zr;
		if (Fn) {
			var Br = "oninput" in document;
			if (!Br) {
				var Vr = document.createElement("div");
				Vr.setAttribute("oninput", "return;"), Br = typeof Vr.oninput == "function";
			}
			zr = Br;
		} else zr = !1;
		Rr = zr && (!document.documentMode || 9 < document.documentMode);
	}
	function Hr() {
		Nr && (Nr.detachEvent("onpropertychange", Ur), Pr = Nr = null);
	}
	function Ur(e) {
		if (e.propertyName === "value" && Ir(Pr)) {
			var t = [];
			Mr(t, Pr, e, On(e)), Nn(Fr, t);
		}
	}
	function Wr(e, t, n) {
		e === "focusin" ? (Hr(), Nr = t, Pr = n, Nr.attachEvent("onpropertychange", Ur)) : e === "focusout" && Hr();
	}
	function Gr(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return Ir(Pr);
	}
	function Kr(e, t) {
		if (e === "click") return Ir(t);
	}
	function qr(e, t) {
		if (e === "input" || e === "change") return Ir(t);
	}
	function Jr(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var Yr = typeof Object.is == "function" ? Object.is : Jr;
	function Xr(e, t) {
		if (Yr(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!Ue.call(t, i) || !Yr(e[i], t[i])) return !1;
		}
		return !0;
	}
	function Zr(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	function Qr(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function $r(e, t) {
		var n = Qr(e);
		e = 0;
		for (var r; n;) {
			if (n.nodeType === 3) {
				if (r = e + n.textContent.length, e <= t && r >= t) return {
					node: n,
					offset: t - e
				};
				e = r;
			}
			a: {
				for (; n;) {
					if (n.nextSibling) {
						n = n.nextSibling;
						break a;
					}
					n = n.parentNode;
				}
				n = void 0;
			}
			n = Qr(n);
		}
	}
	function ei(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? ei(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function ti(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = Zr(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = Zr(e.document);
		}
		return t;
	}
	function ni(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var ri = Fn && "documentMode" in document && 11 >= document.documentMode, ii = null, ai = null, oi = null, si = !1;
	function ci(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		si || ii == null || ii !== Zr(r) || (r = ii, "selectionStart" in r && ni(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), oi && Xr(oi, r) || (oi = r, r = Yf(ai, "onSelect"), 0 < r.length && (t = new qn("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = ii)));
	}
	function li(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var ui = {
		animationend: li("Animation", "AnimationEnd"),
		animationiteration: li("Animation", "AnimationIteration"),
		animationstart: li("Animation", "AnimationStart"),
		transitionrun: li("Transition", "TransitionRun"),
		transitionstart: li("Transition", "TransitionStart"),
		transitioncancel: li("Transition", "TransitionCancel"),
		transitionend: li("Transition", "TransitionEnd")
	}, di = {}, fi = {};
	Fn && (fi = document.createElement("div").style, "AnimationEvent" in window || (delete ui.animationend.animation, delete ui.animationiteration.animation, delete ui.animationstart.animation), "TransitionEvent" in window || delete ui.transitionend.transition);
	function pi(e) {
		if (di[e]) return di[e];
		if (!ui[e]) return e;
		var t = ui[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in fi) return di[e] = t[n];
		return e;
	}
	var mi = pi("animationend"), hi = pi("animationiteration"), gi = pi("animationstart"), _i = pi("transitionrun"), vi = pi("transitionstart"), yi = pi("transitioncancel"), bi = pi("transitionend"), xi = /* @__PURE__ */ new Map(), Si = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	Si.push("scrollEnd");
	function Ci(e, t) {
		xi.set(e, t), Jt(t, [e]);
	}
	var wi = 0;
	function Ti(e, t) {
		if (e.name != null && e.name !== "auto") return e.name;
		if (t.autoName !== null) return t.autoName;
		e = xd.identifierPrefix;
		var n = wi++;
		return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
	}
	function Ei(e) {
		if (e == null || typeof e == "string") return e;
		var t = null, n = kd;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = e[n[r]];
			if (i != null) {
				if (i === "none") return "none";
				t = t == null ? i : t + (" " + i);
			}
		}
		return t ?? e.default;
	}
	function Di(e, t) {
		return e = Ei(e), t = Ei(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
	}
	var Oi = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	}, ki = [], Ai = 0, ji = 0;
	function Mi() {
		for (var e = Ai, t = ji = Ai = 0; t < e;) {
			var n = ki[t];
			ki[t++] = null;
			var r = ki[t];
			ki[t++] = null;
			var i = ki[t];
			ki[t++] = null;
			var a = ki[t];
			if (ki[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && Ii(n, i, a);
		}
	}
	function Ni(e, t, n, r) {
		ki[Ai++] = e, ki[Ai++] = t, ki[Ai++] = n, ki[Ai++] = r, ji |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function Pi(e, t, n, r) {
		return Ni(e, t, n, r), Li(e);
	}
	function Fi(e, t) {
		return Ni(e, null, null, t), Li(e);
	}
	function Ii(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - ot(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function Li(e) {
		if (50 < Ad) throw Ad = 0, jd = null, Error(i(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var Ri = {};
	function zi(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function Bi(e, t, n, r) {
		return new zi(e, t, n, r);
	}
	function M(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function Vi(e, t) {
		var n = e.alternate;
		return n === null ? (n = Bi(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function Hi(e, t) {
		e.flags &= 1206910978;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function Ui(e, t, n, r, a, o) {
		var s = 0;
		if (r = e, typeof r == "function") M(r) && (s = 1);
		else if (typeof r == "string") s = qm(e, n, Oe.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (r) {
			case pe: return e = Bi(31, n, t, a), e.elementType = pe, e.lanes = o, e;
			case re: return Wi(n.children, a, o, t);
			case ie:
				s = 8, a |= 24;
				break;
			case ae: return e = Bi(12, n, t, a | 2), e.elementType = ae, e.lanes = o, e;
			case le: return e = Bi(13, n, t, a), e.elementType = le, e.lanes = o, e;
			case ue: return e = Bi(19, n, t, a), e.elementType = ue, e.lanes = o, e;
			case me:
			case ge: return e = a | 32, e = Bi(30, n, t, e), e.elementType = ge, e.lanes = o, e.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}, e;
			default:
				if (typeof r == "object" && r) switch (r.$$typeof) {
					case se:
						s = 10;
						break a;
					case oe:
						s = 9;
						break a;
					case ce:
						s = 11;
						break a;
					case de:
						s = 14;
						break a;
					case fe:
						s = 16, r = null;
						break a;
				}
				s = 29, n = Error(i(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = Bi(s, n, t, a), t.elementType = e, t.type = r, t.lanes = o, t;
	}
	function Wi(e, t, n, r) {
		return e = Bi(7, e, r, t), e.lanes = n, e;
	}
	function Gi(e, t, n) {
		return e = Bi(6, e, null, t), e.lanes = n, e;
	}
	function Ki(e) {
		var t = Bi(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function qi(e, t, n) {
		return t = Bi(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var Ji = /* @__PURE__ */ new WeakMap();
	function Yi(e, t) {
		if (typeof e == "object" && e) {
			var n = Ji.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: He(t)
			}, Ji.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: He(t)
		};
	}
	var Xi = [], Zi = 0, Qi = null, $i = 0, ea = [], ta = 0, na = null, ra = 1, ia = "";
	function aa(e, t) {
		Xi[Zi++] = $i, Xi[Zi++] = Qi, Qi = e, $i = t;
	}
	function oa(e, t, n) {
		ea[ta++] = ra, ea[ta++] = ia, ea[ta++] = na, na = e;
		var r = ra;
		e = ia;
		var i = 32 - ot(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - ot(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, ra = 1 << 32 - ot(t) + i | n << i | r, ia = a + e;
		} else ra = 1 << a | n << i | r, ia = e;
	}
	function sa(e) {
		e.return !== null && (aa(e, 1), oa(e, 1, 0));
	}
	function ca(e) {
		for (; e === Qi;) Qi = Xi[--Zi], Xi[Zi] = null, $i = Xi[--Zi], Xi[Zi] = null;
		for (; e === na;) na = ea[--ta], ea[ta] = null, ia = ea[--ta], ea[ta] = null, ra = ea[--ta], ea[ta] = null;
	}
	function la(e, t) {
		ea[ta++] = ra, ea[ta++] = ia, ea[ta++] = na, ra = t.id, ia = t.overflow, na = e;
	}
	var N = null, P = null, F = !1, ua = null, da = !1, fa = Error(i(519));
	function pa(e) {
		throw ya(Yi(Error(i(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), fa;
	}
	function ma(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[At] = e, t[jt] = r, n) {
			case "dialog":
				Z("cancel", t), Z("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				Z("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < Bf.length; n++) Z(Bf[n], t);
				break;
			case "source":
				Z("error", t);
				break;
			case "img":
			case "image":
			case "link":
				Z("error", t), Z("load", t);
				break;
			case "details":
				Z("toggle", t);
				break;
			case "input":
				Z("invalid", t), pn(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				Z("invalid", t);
				break;
			case "textarea": Z("invalid", t), _n(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || tp(t.textContent, n) ? (r.popover != null && (Z("beforetoggle", t), Z("toggle", t)), r.onScroll != null && Z("scroll", t), r.onScrollEnd != null && Z("scrollend", t), r.onClick != null && (t.onclick = En), t = !0) : t = !1, t || pa(e, !0);
	}
	function ha(e) {
		for (N = e.return; N;) switch (N.tag) {
			case 5:
			case 31:
			case 13:
				da = !1;
				return;
			case 27:
			case 3:
				da = !0;
				return;
			default: N = N.return;
		}
	}
	function ga(e) {
		if (e !== N) return !1;
		if (!F) return ha(e), F = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = n === "form" || n === "button" || mp(e.type, e.memoizedProps)), n = !n), n && P && pa(e), ha(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			P = dm(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			P = dm(e);
		} else t === 27 ? (t = P, Cp(e.type) ? (e = um, um = null, P = e) : P = t) : P = N ? lm(e.stateNode.nextSibling) : null;
		return !0;
	}
	function _a() {
		P = N = null, F = !1;
	}
	function va() {
		var e = ua;
		return e !== null && (pd === null ? pd = e : pd.push.apply(pd, e), ua = null), e;
	}
	function ya(e) {
		ua === null ? ua = [e] : ua.push(e);
	}
	var ba = Ee(null), xa = null, Sa = null;
	function Ca(e, t, n) {
		A(ba, t._currentValue), t._currentValue = n;
	}
	function wa(e) {
		e._currentValue = ba.current, De(ba);
	}
	function Ta(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function Ea(e, t, n, r) {
		var a = e.child;
		for (a !== null && (a.return = e); a !== null;) {
			var o = a.dependencies;
			if (o !== null) {
				var s = a.child;
				o = o.firstContext;
				a: for (; o !== null;) {
					var c = o;
					o = a;
					for (var l = 0; l < t.length; l++) if (c.context === t[l]) {
						o.lanes |= n, c = o.alternate, c !== null && (c.lanes |= n), Ta(o.return, n, e), r || (s = null);
						break a;
					}
					o = c.next;
				}
			} else if (a.tag === 18) {
				if (s = a.return, s === null) throw Error(i(341));
				s.lanes |= n, o = s.alternate, o !== null && (o.lanes |= n), Ta(s, n, e), s = null;
			} else a.tag === 13 && a.memoizedState !== null && a.memoizedState.dehydrated === null ? (a.lanes |= n, s = a.alternate, s !== null && (s.lanes |= n), Ta(a.return, n, e), s = a.child, s = s === null ? null : s.sibling) : s = a.child;
			if (s !== null) s.return = a;
			else for (s = a; s !== null;) {
				if (s === e) {
					s = null;
					break;
				}
				if (a = s.sibling, a !== null) {
					a.return = s.return, s = a;
					break;
				}
				s = s.return;
			}
			a = s;
		}
	}
	function Da(e, t, n, r) {
		e = null;
		for (var a = t, o = !1; a !== null;) {
			if (!o) {
				if (a.flags & 524288) o = !0;
				else if (a.flags & 262144) break;
			}
			if (a.tag === 10) {
				var s = a.alternate;
				if (s === null) throw Error(i(387));
				if (s = s.memoizedProps, s !== null) {
					var c = a.type;
					Yr(a.pendingProps.value, s.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (a === je.current) {
				if (s = a.alternate, s === null) throw Error(i(387));
				s.memoizedState.memoizedState !== a.memoizedState.memoizedState && (e === null ? e = [sh] : e.push(sh));
			}
			a = a.return;
		}
		return e !== null && Ea(t, e, n, r), t.flags |= 262144, e !== null;
	}
	function Oa(e) {
		for (e = e.firstContext; e !== null;) {
			if (!Yr(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function ka(e) {
		xa = e, Sa = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function Aa(e) {
		return Ma(xa, e);
	}
	function ja(e, t) {
		return xa === null && ka(e), Ma(e, t);
	}
	function Ma(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, Sa === null) {
			if (e === null) throw Error(i(308));
			Sa = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else Sa = Sa.next = t;
		return n;
	}
	var Na = typeof AbortController < "u" ? AbortController : function() {
		var e = [], t = this.signal = {
			aborted: !1,
			addEventListener: function(t, n) {
				e.push(n);
			}
		};
		this.abort = function() {
			t.aborted = !0, e.forEach(function(e) {
				return e();
			});
		};
	}, Pa = t.unstable_scheduleCallback, I = t.unstable_NormalPriority, L = {
		$$typeof: se,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function Fa() {
		return {
			controller: new Na(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function Ia(e) {
		e.refCount--, e.refCount === 0 && Pa(I, function() {
			e.controller.abort();
		});
	}
	function La(e, t) {
		if (e.pendingLanes & 4194048) {
			var n = e.transitionTypes;
			for (n === null && (n = e.transitionTypes = []), e = 0; e < t.length; e++) {
				var r = t[e];
				n.indexOf(r) === -1 && n.push(r);
			}
		}
	}
	var Ra = null;
	function za(e) {
		var t = e.transitionTypes;
		return e.transitionTypes = null, t;
	}
	var Ba = null, Va = 0, Ha = 0, Ua = null;
	function Wa(e, t) {
		if (Ba === null) {
			var n = Ba = [];
			Va = 0, Ha = Ff(), Ua = {
				status: "pending",
				value: void 0,
				then: function(e) {
					n.push(e);
				}
			};
		}
		return Va++, t.then(Ga, Ga), t;
	}
	function Ga() {
		if (--Va === 0 && (Ra = null, Ba !== null)) {
			Ua !== null && (Ua.status = "fulfilled");
			var e = Ba;
			Ba = null, Ha = 0, Ua = null;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
	}
	function Ka(e, t) {
		var n = [], r = {
			status: "pending",
			value: null,
			reason: null,
			then: function(e) {
				n.push(e);
			}
		};
		return e.then(function() {
			r.status = "fulfilled", r.value = t;
			for (var e = 0; e < n.length; e++) (0, n[e])(t);
		}, function(e) {
			for (r.status = "rejected", r.reason = e, e = 0; e < n.length; e++) (0, n[e])(void 0);
		}), r;
	}
	var qa = O.S;
	O.S = function(e, t) {
		if (gd = Je(), typeof t == "object" && t && typeof t.then == "function" && Wa(e, t), Ra !== null) for (var n = xf; n !== null;) La(n, Ra), n = n.next;
		if (n = e.types, n !== null) {
			for (var r = xf; r !== null;) La(r, n), r = r.next;
			if (Ha !== 0) {
				r = Ra, r === null && (r = Ra = []);
				for (var i = 0; i < n.length; i++) {
					var a = n[i];
					r.indexOf(a) === -1 && r.push(a);
				}
			}
		}
		qa !== null && qa(e, t);
	};
	var Ja = Ee(null);
	function Ya() {
		var e = Ja.current;
		return e === null ? K.pooledCache : e;
	}
	function Xa(e, t) {
		t === null ? A(Ja, Ja.current) : A(Ja, t.pool);
	}
	function Za() {
		var e = Ya();
		return e === null ? null : {
			parent: L._currentValue,
			pool: e
		};
	}
	var Qa = Error(i(460)), $a = Error(i(474)), eo = Error(i(542)), to = { then: function() {} };
	function no(e) {
		return e = e.status, e === "fulfilled" || e === "rejected";
	}
	function ro(e, t, n) {
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(En, En), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, so(e), e === void 0 && !("reason" in t) ? Error(i(600)) : e;
			default:
				if (typeof t.status == "string") t.then(En, En);
				else {
					if (e = K, e !== null && 100 < e.shellSuspendCounter) throw Error(i(482));
					e = t, e.status = "pending", e.then(function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "fulfilled", n.value = e;
						}
					}, function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "rejected", n.reason = e;
						}
					});
				}
				switch (t.status) {
					case "fulfilled": return t.value;
					case "rejected": throw e = t.reason, so(e), e;
				}
				throw ao = t, Qa;
		}
	}
	function io(e) {
		try {
			var t = e._init;
			return t(e._payload);
		} catch (e) {
			throw typeof e == "object" && e && typeof e.then == "function" ? (ao = e, Qa) : e;
		}
	}
	var ao = null;
	function oo() {
		if (ao === null) throw Error(i(459));
		var e = ao;
		return ao = null, e;
	}
	function so(e) {
		if (e === Qa || e === eo) throw Error(i(483));
	}
	var co = null, R = 0;
	function lo(e) {
		var t = R;
		return R += 1, co === null && (co = []), ro(co, e, t);
	}
	function uo(e, t) {
		t = t.props.ref, e.ref = t === void 0 ? null : t;
	}
	function fo(e, t) {
		throw t.$$typeof === ee ? Error(i(525)) : (e = Object.prototype.toString.call(t), Error(i(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
	}
	function po(e) {
		function t(t, n) {
			if (e) {
				var r = t.deletions;
				r === null ? (t.deletions = [n], t.flags |= 16) : r.push(n);
			}
		}
		function n(n, r) {
			if (!e) return null;
			for (; r !== null;) t(n, r), r = r.sibling;
			return null;
		}
		function r(e) {
			for (var t = /* @__PURE__ */ new Map(); e !== null;) e.key === null ? t.set(e.index, e) : t.set(e.key, e), e = e.sibling;
			return t;
		}
		function a(e, t) {
			return e = Vi(e, t), e.index = 0, e.sibling = null, e;
		}
		function o(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 134217730, n) : (r = r.index, r < n ? (t.flags |= 2, n) : r)) : (t.flags |= 1048576, n);
		}
		function s(t) {
			return e && t.alternate === null && (t.flags |= 134217730), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = Gi(n, e.mode, r), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var i = n.type;
			return i === re ? (e = d(e, t, n.props.children, r, n.key), uo(e, n), e) : t !== null && (t.elementType === i || typeof i == "object" && i && i.$$typeof === fe && io(i) === t.type) ? (t = a(t, n.props), uo(t, n), t.return = e, t) : (t = Ui(n.type, n.key, n.props, null, e.mode, r), uo(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = qi(n, e.mode, r), t.return = e, t) : (t = a(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, i) {
			return t === null || t.tag !== 7 ? (t = Wi(n, e.mode, r, i), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = Gi("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case te: return n = Ui(t.type, t.key, t.props, null, e.mode, n), uo(n, t), n.return = e, n;
					case ne: return t = qi(t, e.mode, n), t.return = e, t;
					case fe: return t = io(t), f(e, t, n);
				}
				if (Se(t) || ye(t)) return t = Wi(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, lo(t), n);
				if (t.$$typeof === se) return f(e, ja(e, t), n);
				fo(e, t);
			}
			return null;
		}
		function p(e, t, n, r) {
			var i = t === null ? null : t.key;
			if (typeof n == "string" && n !== "" || typeof n == "number" || typeof n == "bigint") return i === null ? c(e, t, "" + n, r) : null;
			if (typeof n == "object" && n) {
				switch (n.$$typeof) {
					case te: return n.key === i ? l(e, t, n, r) : null;
					case ne: return n.key === i ? u(e, t, n, r) : null;
					case fe: return n = io(n), p(e, t, n, r);
				}
				if (Se(n) || ye(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, lo(n), r);
				if (n.$$typeof === se) return p(e, t, ja(e, n), r);
				fo(e, n);
			}
			return null;
		}
		function m(e, t, n, r, i) {
			if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, c(t, e, "" + r, i);
			if (typeof r == "object" && r) {
				switch (r.$$typeof) {
					case te: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
					case ne: return e = e.get(r.key === null ? n : r.key) || null, u(t, e, r, i);
					case fe: return r = io(r), m(e, t, n, r, i);
				}
				if (Se(r) || ye(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, lo(r), i);
				if (r.$$typeof === se) return m(e, t, n, ja(t, r), i);
				fo(t, r);
			}
			return null;
		}
		function h(i, a, s, c) {
			for (var l = null, u = null, d = a, h = a = 0, g = null; d !== null && h < s.length; h++) {
				d.index > h ? (g = d, d = null) : g = d.sibling;
				var _ = p(i, d, s[h], c);
				if (_ === null) {
					d === null && (d = g);
					break;
				}
				e && d && _.alternate === null && t(i, d), a = o(_, a, h), u === null ? l = _ : u.sibling = _, u = _, d = g;
			}
			if (h === s.length) return n(i, d), F && aa(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (a = o(d, a, h), u === null ? l = d : u.sibling = d, u = d);
				return F && aa(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && (_ = g.alternate, _ !== null && d.delete(_.key === null ? h : _.key)), a = o(g, a, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), F && aa(i, h), l;
		}
		function g(a, s, c, l) {
			if (c == null) throw Error(i(151));
			for (var u = null, d = null, h = s, g = s = 0, _ = null, v = c.next(); h !== null && !v.done; g++, v = c.next()) {
				h.index > g ? (_ = h, h = null) : _ = h.sibling;
				var y = p(a, h, v.value, l);
				if (y === null) {
					h === null && (h = _);
					break;
				}
				e && h && y.alternate === null && t(a, h), s = o(y, s, g), d === null ? u = y : d.sibling = y, d = y, h = _;
			}
			if (v.done) return n(a, h), F && aa(a, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(a, v.value, l), v !== null && (s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
				return F && aa(a, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, a, g, v.value, l), v !== null && (e && (_ = v.alternate, _ !== null && h.delete(_.key === null ? g : _.key)), s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(a, e);
			}), F && aa(a, g), u;
		}
		function _(e, r, o, c) {
			if (typeof o == "object" && o && o.type === re && o.key === null && o.props.ref === void 0 && (o = o.props.children), typeof o == "object" && o) {
				switch (o.$$typeof) {
					case te:
						a: {
							for (var l = o.key; r !== null;) {
								if (r.key === l) {
									if (l = o.type, l === re) {
										if (r.tag === 7) {
											n(e, r.sibling), c = a(r, o.props.children), uo(c, o), c.return = e, e = c;
											break a;
										}
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === fe && io(l) === r.type) {
										n(e, r.sibling), c = a(r, o.props), uo(c, o), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							o.type === re ? (c = Wi(o.props.children, e.mode, c, o.key), uo(c, o), c.return = e, e = c) : (c = Ui(o.type, o.key, o.props, null, e.mode, c), uo(c, o), c.return = e, e = c);
						}
						return s(e);
					case ne:
						a: {
							for (l = o.key; r !== null;) {
								if (r.key === l) {
									if (r.tag === 4 && r.stateNode.containerInfo === o.containerInfo && r.stateNode.implementation === o.implementation) {
										n(e, r.sibling), c = a(r, o.children || []), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							c = qi(o, e.mode, c), c.return = e, e = c;
						}
						return s(e);
					case fe: return o = io(o), _(e, r, o, c);
				}
				if (Se(o)) return h(e, r, o, c);
				if (ye(o)) {
					if (l = ye(o), typeof l != "function") throw Error(i(150));
					return o = l.call(o), g(e, r, o, c);
				}
				if (typeof o.then == "function") return _(e, r, lo(o), c);
				if (o.$$typeof === se) return _(e, r, ja(e, o), c);
				fo(e, o);
			}
			return typeof o == "string" && o !== "" || typeof o == "number" || typeof o == "bigint" ? (o = "" + o, r !== null && r.tag === 6 ? (n(e, r.sibling), c = a(r, o), c.return = e, e = c) : (n(e, r), c = Gi(o, e.mode, c), c.return = e, e = c), s(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				R = 0;
				var i = _(e, t, n, r);
				return co = null, i;
			} catch (t) {
				if (t === Qa || t === eo) throw t;
				var a = Bi(29, t, null, e.mode);
				return a.lanes = r, a.return = e, a;
			}
		};
	}
	var mo = po(!0), ho = po(!1), go = !1;
	function _o(e) {
		e.updateQueue = {
			baseState: e.memoizedState,
			firstBaseUpdate: null,
			lastBaseUpdate: null,
			shared: {
				pending: null,
				lanes: 0,
				hiddenCallbacks: null
			},
			callbacks: null
		};
	}
	function vo(e, t) {
		e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
			baseState: e.baseState,
			firstBaseUpdate: e.firstBaseUpdate,
			lastBaseUpdate: e.lastBaseUpdate,
			shared: e.shared,
			callbacks: null
		});
	}
	function yo(e) {
		return {
			lane: e,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function bo(e, t, n) {
		var r = e.updateQueue;
		if (r === null) return null;
		if (r = r.shared, G & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Li(e), Ii(e, null, n), t;
		}
		return Ni(e, r, t, n), Li(e);
	}
	function xo(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Ct(e, n);
		}
	}
	function So(e, t) {
		var n = e.updateQueue, r = e.alternate;
		if (r !== null && (r = r.updateQueue, n === r)) {
			var i = null, a = null;
			if (n = n.firstBaseUpdate, n !== null) {
				do {
					var o = {
						lane: n.lane,
						tag: n.tag,
						payload: n.payload,
						callback: null,
						next: null
					};
					a === null ? i = a = o : a = a.next = o, n = n.next;
				} while (n !== null);
				a === null ? i = a = t : a = a.next = t;
			} else i = a = t;
			n = {
				baseState: r.baseState,
				firstBaseUpdate: i,
				lastBaseUpdate: a,
				shared: r.shared,
				callbacks: r.callbacks
			}, e.updateQueue = n;
			return;
		}
		e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
	}
	var Co = !1;
	function wo() {
		if (Co) {
			var e = Ua;
			if (e !== null) throw e;
		}
	}
	function To(e, t, n, r) {
		Co = !1;
		var i = e.updateQueue;
		go = !1;
		var a = i.firstBaseUpdate, o = i.lastBaseUpdate, s = i.shared.pending;
		if (s !== null) {
			i.shared.pending = null;
			var c = s, l = c.next;
			c.next = null, o === null ? a = l : o.next = l, o = c;
			var u = e.alternate;
			u !== null && (u = u.updateQueue, s = u.lastBaseUpdate, s !== o && (s === null ? u.firstBaseUpdate = l : s.next = l, u.lastBaseUpdate = c));
		}
		if (a !== null) {
			var d = i.baseState;
			o = 0, u = l = c = null, s = a;
			do {
				var f = s.lane & -536870913, p = f !== s.lane;
				if (p ? (J & f) === f : (r & f) === f) {
					f !== 0 && f === Ha && (Co = !0), u !== null && (u = u.next = {
						lane: 0,
						tag: s.tag,
						payload: s.payload,
						callback: null,
						next: null
					});
					a: {
						var m = e, h = s;
						f = t;
						var g = n;
						switch (h.tag) {
							case 1:
								if (m = h.payload, typeof m == "function") {
									d = m.call(g, d, f);
									break a;
								}
								d = m;
								break a;
							case 3: m.flags = m.flags & -65537 | 128;
							case 0:
								if (m = h.payload, f = typeof m == "function" ? m.call(g, d, f) : m, f == null) break a;
								d = D({}, d, f);
								break a;
							case 2: go = !0;
						}
					}
					f = s.callback, f !== null && (e.flags |= 64, p && (e.flags |= 8192), p = i.callbacks, p === null ? i.callbacks = [f] : p.push(f));
				} else p = {
					lane: f,
					tag: s.tag,
					payload: s.payload,
					callback: s.callback,
					next: null
				}, u === null ? (l = u = p, c = d) : u = u.next = p, o |= f;
				if (s = s.next, s === null) {
					if (s = i.shared.pending, s === null) break;
					p = s, s = p.next, p.next = null, i.lastBaseUpdate = p, i.shared.pending = null;
				}
			} while (1);
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), sd |= o, e.lanes = o, e.memoizedState = d;
		}
	}
	function Eo(e, t) {
		if (typeof e != "function") throw Error(i(191, e));
		e.call(t);
	}
	function Do(e, t) {
		var n = e.callbacks;
		if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) Eo(n[e], t);
	}
	var Oo = Ee(null), ko = Ee(0);
	function Ao(e, t) {
		e = ad, A(ko, e), A(Oo, t), ad = e | t.baseLanes;
	}
	function jo() {
		A(ko, ad), A(Oo, Oo.current);
	}
	function Mo() {
		ad = ko.current, De(Oo), De(ko);
	}
	var z = Ee(null), No = null;
	function Po(e) {
		var t = e.alternate;
		A(Ro, Ro.current & 1), A(z, e), No === null && (t === null || Oo.current !== null || t.memoizedState !== null) && (No = e);
	}
	function Fo(e) {
		A(Ro, Ro.current), A(z, e), No === null && (No = e);
	}
	function B(e) {
		e.tag === 22 ? (A(Ro, Ro.current), A(z, e), No === null && (No = e)) : Io();
	}
	function Io() {
		A(Ro, Ro.current), A(z, z.current);
	}
	function Lo(e) {
		De(z), No === e && (No = null), De(Ro);
	}
	var Ro = Ee(0);
	function zo(e, t) {
		A(z, z.current), A(Ro, t);
	}
	function Bo(e) {
		De(Ro), De(z), No === e && (No = null);
	}
	function Vo(e) {
		for (var t = e; t !== null;) {
			if (t.tag === 13) {
				var n = t.memoizedState;
				if (n !== null && (n = n.dehydrated, n === null || om(n) || sm(n))) return t;
			} else if (t.tag === 19 && t.memoizedProps.revealOrder !== "independent") {
				if (t.flags & 128) return t;
			} else if (t.child !== null) {
				t.child.return = t, t = t.child;
				continue;
			}
			if (t === e) break;
			for (; t.sibling === null;) {
				if (t.return === null || t.return === e) return null;
				t = t.return;
			}
			t.sibling.return = t.return, t = t.sibling;
		}
		return null;
	}
	var Ho = 0, V = null, H = null, Uo = null, Wo = !1, Go = !1, Ko = !1, qo = 0, Jo = 0, Yo = null, Xo = 0;
	function Zo() {
		throw Error(i(321));
	}
	function Qo(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!Yr(e[n], t[n])) return !1;
		return !0;
	}
	function $o(e, t, n, r, i, a) {
		return Ho = a, V = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, O.H = e === null || e.memoizedState === null ? gc : _c, Ko = !1, a = n(r, i), Ko = !1, Go && (a = ts(t, n, r, i)), es(e), a;
	}
	function es(e) {
		O.H = hc;
		var t = H !== null && H.next !== null;
		if (Ho = 0, Uo = H = V = null, Wo = !1, Jo = 0, Yo = null, t) throw Error(i(300));
		e === null || Pc || (e = e.dependencies, e !== null && Oa(e) && (Pc = !0));
	}
	function ts(e, t, n, r) {
		V = e;
		var a = 0;
		do {
			if (Go && (Yo = null), Jo = 0, Go = !1, 25 <= a) throw Error(i(301));
			if (a += 1, Uo = H = null, e.updateQueue != null) {
				var o = e.updateQueue;
				o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
			}
			O.H = vc, o = t(n, r);
		} while (Go);
		return o;
	}
	function ns() {
		var e = O.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? ls(t) : t, e = e.useState()[0], (H === null ? null : H.memoizedState) !== e && (V.flags |= 1024), t;
	}
	function rs() {
		var e = qo !== 0;
		return qo = 0, e;
	}
	function is(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function as(e) {
		if (Wo) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			Wo = !1;
		}
		Ho = 0, Uo = H = V = null, Go = !1, Jo = qo = 0, Yo = null;
	}
	function os() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return Uo === null ? V.memoizedState = Uo = e : Uo = Uo.next = e, Uo;
	}
	function ss() {
		if (H === null) {
			var e = V.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = H.next;
		var t = Uo === null ? V.memoizedState : Uo.next;
		if (t !== null) Uo = t, H = e;
		else {
			if (e === null) throw V.alternate === null ? Error(i(467)) : Error(i(310));
			H = e, e = {
				memoizedState: H.memoizedState,
				baseState: H.baseState,
				baseQueue: H.baseQueue,
				queue: H.queue,
				next: null
			}, Uo === null ? V.memoizedState = Uo = e : Uo = Uo.next = e;
		}
		return Uo;
	}
	function cs() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function ls(e) {
		var t = Jo;
		return Jo += 1, Yo === null && (Yo = []), e = ro(Yo, e, t), t = V, (Uo === null ? t.memoizedState : Uo.next) === null && (t = t.alternate, O.H = t === null || t.memoizedState === null ? gc : _c), e;
	}
	function us(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return ls(e);
			if (e.$$typeof === _e) return;
			if (e.$$typeof === se) return Aa(e);
		}
		throw Error(i(438, String(e)));
	}
	function ds(e) {
		var t = null, n = V.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = V.alternate;
			r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (t = {
				data: r.data.map(function(e) {
					return e.slice();
				}),
				index: 0
			})));
		}
		if (t ??= {
			data: [],
			index: 0
		}, n === null && (n = cs(), V.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = he;
		return t.index++, n;
	}
	function fs(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function ps(e) {
		return ms(ss(), H, e);
	}
	function ms(e, t, n) {
		var r = e.queue;
		if (r === null) throw Error(i(311));
		r.lastRenderedReducer = n;
		var a = e.baseQueue, o = r.pending;
		if (o !== null) {
			if (a !== null) {
				var s = a.next;
				a.next = o.next, o.next = s;
			}
			t.baseQueue = a = o, r.pending = null;
		}
		if (o = e.baseState, a === null) e.memoizedState = o;
		else {
			t = a.next;
			var c = s = null, l = null, u = t, d = !1;
			do {
				var f = u.lane & -536870913;
				if (f === u.lane ? (Ho & f) === f : (J & f) === f) {
					var p = u.revertLane;
					if (p === 0) l !== null && (l = l.next = {
						lane: 0,
						revertLane: 0,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}), f === Ha && (d = !0);
					else if ((Ho & p) === p) {
						u = u.next, p === Ha && (d = !0);
						continue;
					} else f = {
						lane: 0,
						revertLane: u.revertLane,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}, l === null ? (c = l = f, s = o) : l = l.next = f, V.lanes |= p, sd |= p;
					f = u.action, Ko && n(o, f), o = u.hasEagerState ? u.eagerState : n(o, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, s = o) : l = l.next = p, V.lanes |= f, sd |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? s = o : l.next = c, !Yr(o, e.memoizedState) && (Pc = !0, d && (n = Ua, n !== null))) throw n;
			e.memoizedState = o, e.baseState = s, e.baseQueue = l, r.lastRenderedState = o;
		}
		return a === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function hs(e) {
		var t = ss(), n = t.queue;
		if (n === null) throw Error(i(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, a = n.pending, o = t.memoizedState;
		if (a !== null) {
			n.pending = null;
			var s = a = a.next;
			do
				o = e(o, s.action), s = s.next;
			while (s !== a);
			Yr(o, t.memoizedState) || (Pc = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
		}
		return [o, r];
	}
	function gs(e, t, n) {
		var r = V, a = ss(), o = F;
		if (o) {
			if (n === void 0) throw Error(i(407));
			n = n();
		} else n = t();
		var s = !Yr((H || a).memoizedState, n);
		if (s && (a.memoizedState = n, Pc = !0), a = a.queue, Vs(ys.bind(null, r, a, e), [e]), e = a.getSnapshot !== t || s || Uo !== null && !!(Uo.memoizedState.tag & 1), Is(e ? 9 : 8, { destroy: void 0 }, vs.bind(null, r, a, n, t), null), e) {
			if (r.flags |= 2048, K === null) throw Error(i(349));
			o || Ho & 127 || _s(r, t, n);
		}
		return n;
	}
	function _s(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = V.updateQueue, t === null ? (t = cs(), V.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function vs(e, t, n, r) {
		t.value = n, t.getSnapshot = r, bs(t) && xs(e);
	}
	function ys(e, t, n) {
		return n(function() {
			bs(t) && xs(e);
		});
	}
	function bs(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !Yr(e, n);
		} catch {
			return !0;
		}
	}
	function xs(e) {
		var t = Fi(e, 2);
		t !== null && Fd(t, e, 2);
	}
	function Ss(e) {
		var t = os();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), Ko) {
				at(!0);
				try {
					n();
				} finally {
					at(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: fs,
			lastRenderedState: e
		}, t;
	}
	function Cs(e, t, n, r) {
		return e.baseState = n, ms(e, H, typeof r == "function" ? r : fs);
	}
	function ws(e, t, n, r, a) {
		if (fc(e)) throw Error(i(485));
		if (e = t.action, e !== null) {
			var o = {
				payload: a,
				action: e,
				next: null,
				isTransition: !0,
				status: "pending",
				value: null,
				reason: null,
				listeners: [],
				then: function(e) {
					o.listeners.push(e);
				}
			};
			O.T === null ? o.isTransition = !1 : n(!0), r(o), n = t.pending, n === null ? (o.next = t.pending = o, Ts(t, o)) : (o.next = n.next, t.pending = n.next = o);
		}
	}
	function Ts(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = O.T, o = {};
			o.types = a === null ? null : a.types, O.T = o;
			try {
				var s = n(i, r), c = O.S;
				c !== null && c(o, s), Es(e, t, s);
			} catch (n) {
				Os(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), O.T = a;
			}
		} else try {
			a = n(i, r), Es(e, t, a);
		} catch (n) {
			Os(e, t, n);
		}
	}
	function Es(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			Ds(e, t, n);
		}, function(n) {
			return Os(e, t, n);
		}) : Ds(e, t, n);
	}
	function Ds(e, t, n) {
		t.status = "fulfilled", t.value = n, ks(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, Ts(e, n)));
	}
	function Os(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, ks(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function ks(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function As(e, t) {
		return t;
	}
	function js(e, t) {
		if (F) {
			var n = K.formState;
			if (n !== null) {
				a: {
					var r = V;
					if (F) {
						if (P) {
							b: {
								for (var i = P, a = da; i.nodeType !== 8;) {
									if (!a) {
										i = null;
										break b;
									}
									if (i = lm(i.nextSibling), i === null) {
										i = null;
										break b;
									}
								}
								a = i.data, i = a === "F!" || a === "F" ? i : null;
							}
							if (i) {
								P = lm(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						pa(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = os(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: As,
			lastRenderedState: t
		}, n.queue = r, n = lc.bind(null, V, r), r.dispatch = n, r = Ss(!1), a = dc.bind(null, V, !1, r.queue), r = os(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = ws.bind(null, V, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function Ms(e) {
		return Ns(ss(), H, e);
	}
	function Ns(e, t, n) {
		if (t = ms(e, t, As)[0], e = ps(fs)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = ls(t);
		} catch (e) {
			throw e === Qa ? eo : e;
		}
		else r = t;
		t = ss();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (V.flags |= 2048, Is(9, { destroy: void 0 }, Ps.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function Ps(e, t) {
		e.action = t;
	}
	function Fs(e) {
		var t = ss(), n = H;
		if (n !== null) return Ns(t, n, e);
		ss(), t = t.memoizedState, n = ss();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function Is(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = V.updateQueue, t === null && (t = cs(), V.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function Ls() {
		return ss().memoizedState;
	}
	function Rs(e, t, n, r) {
		var i = os();
		V.flags |= e, i.memoizedState = Is(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function zs(e, t, n, r) {
		var i = ss();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		H !== null && r !== null && Qo(r, H.memoizedState.deps) ? i.memoizedState = Is(t, a, n, r) : (V.flags |= e, i.memoizedState = Is(1 | t, a, n, r));
	}
	function Bs(e, t) {
		Rs(8390656, 8, e, t);
	}
	function Vs(e, t) {
		zs(2048, 8, e, t);
	}
	function Hs(e) {
		V.flags |= 4;
		var t = V.updateQueue;
		if (t === null) t = cs(), V.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function Us(e) {
		var t = ss().memoizedState;
		return Hs({
			ref: t,
			nextImpl: e
		}), function() {
			if (G & 2) throw Error(i(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function Ws(e, t) {
		return zs(4, 2, e, t);
	}
	function Gs(e, t) {
		return zs(4, 4, e, t);
	}
	function Ks(e, t) {
		if (typeof t == "function") {
			e = e();
			var n = t(e);
			return function() {
				typeof n == "function" ? n() : t(null);
			};
		}
		if (t != null) return e = e(), t.current = e, function() {
			t.current = null;
		};
	}
	function qs(e, t, n) {
		n = n == null ? null : n.concat([e]), zs(4, 4, Ks.bind(null, t, e), n);
	}
	function Js() {}
	function Ys(e, t) {
		var n = ss();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && Qo(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function Xs(e, t) {
		var n = ss();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && Qo(t, r[1])) return r[0];
		if (r = e(), Ko) {
			at(!0);
			try {
				e();
			} finally {
				at(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function Zs(e, t, n) {
		return n === void 0 || Ho & 1073741824 && !(J & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = Nd(), V.lanes |= e, sd |= e, n);
	}
	function Qs(e, t, n, r) {
		return Yr(n, t) ? n : Oo.current === null ? !(Ho & 106) || Ho & 1073741824 && !(J & 261930) ? (Pc = !0, e.memoizedState = n) : (e = Nd(), V.lanes |= e, sd |= e, t) : (e = Zs(e, n, r), Yr(e, t) || (Pc = !0), e);
	}
	function $s(e, t, n, r, i) {
		var a = k.p;
		k.p = a !== 0 && 8 > a ? a : 8;
		var o = O.T, s = {};
		s.types = o === null ? null : o.types, O.T = s, dc(e, !1, t, n);
		try {
			var c = i(), l = O.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? uc(e, t, Ka(c, r), Md(e)) : uc(e, t, r, Md(e));
		} catch (n) {
			uc(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, Md());
		} finally {
			k.p = a, o !== null && s.types !== null && (o.types = s.types), O.T = o;
		}
	}
	function ec() {}
	function tc(e, t, n, r) {
		if (e.tag !== 5) throw Error(i(476));
		var a = nc(e).queue;
		$s(e, a, t, Ce, n === null ? ec : function() {
			return rc(e), n(r);
		});
	}
	function nc(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: Ce,
			baseState: Ce,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: fs,
				lastRenderedState: Ce
			},
			next: null
		};
		var n = {};
		return t.next = {
			memoizedState: n,
			baseState: n,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: fs,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function rc(e) {
		var t = nc(e);
		t.next === null && (t = e.alternate.memoizedState), uc(e, t.next.queue, {}, Md());
	}
	function ic() {
		return Aa(sh);
	}
	function ac() {
		return ss().memoizedState;
	}
	function oc() {
		return ss().memoizedState;
	}
	function sc(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = Md();
					e = yo(n);
					var r = bo(t, e, n);
					r !== null && (Fd(r, t, n), xo(r, t, n)), t = { cache: Fa() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function cc(e, t, n) {
		var r = Md();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, fc(e) ? pc(t, n) : (n = Pi(e, t, n, r), n !== null && (Fd(n, e, r), mc(n, t, r)));
	}
	function lc(e, t, n) {
		uc(e, t, n, Md());
	}
	function uc(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (fc(e)) pc(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, Yr(s, o)) return Ni(e, t, i, 0), K === null && Mi(), !1;
			} catch {}
			if (n = Pi(e, t, i, r), n !== null) return Fd(n, e, r), mc(n, t, r), !0;
		}
		return !1;
	}
	function dc(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: Ff(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, fc(e)) {
			if (t) throw Error(i(479));
		} else t = Pi(e, n, r, 2), t !== null && Fd(t, e, 2);
	}
	function fc(e) {
		var t = e.alternate;
		return e === V || t !== null && t === V;
	}
	function pc(e, t) {
		Go = Wo = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function mc(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Ct(e, n);
		}
	}
	var hc = {
		readContext: Aa,
		use: us,
		useCallback: Zo,
		useContext: Zo,
		useEffect: Zo,
		useImperativeHandle: Zo,
		useLayoutEffect: Zo,
		useInsertionEffect: Zo,
		useMemo: Zo,
		useReducer: Zo,
		useRef: Zo,
		useState: Zo,
		useDebugValue: Zo,
		useDeferredValue: Zo,
		useTransition: Zo,
		useSyncExternalStore: Zo,
		useId: Zo,
		useHostTransitionStatus: Zo,
		useFormState: Zo,
		useActionState: Zo,
		useOptimistic: Zo,
		useMemoCache: Zo,
		useCacheRefresh: Zo,
		useEffectEvent: Zo
	}, gc = {
		readContext: Aa,
		use: us,
		useCallback: function(e, t) {
			return os().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: Aa,
		useEffect: Bs,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), Rs(4194308, 4, Ks.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return Rs(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			Rs(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = os();
			t = t === void 0 ? null : t;
			var r = e();
			if (Ko) {
				at(!0);
				try {
					e();
				} finally {
					at(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = os();
			if (n !== void 0) {
				var i = n(t);
				if (Ko) {
					at(!0);
					try {
						n(t);
					} finally {
						at(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = cc.bind(null, V, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = os();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = Ss(e);
			var t = e.queue, n = lc.bind(null, V, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: Js,
		useDeferredValue: function(e, t) {
			return Zs(os(), e, t);
		},
		useTransition: function() {
			var e = Ss(!1);
			return e = $s.bind(null, V, e.queue, !0, !1), os().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = V, a = os();
			if (F) {
				if (n === void 0) throw Error(i(407));
				n = n();
			} else {
				if (n = t(), K === null) throw Error(i(349));
				J & 127 || _s(r, t, n);
			}
			a.memoizedState = n;
			var o = {
				value: n,
				getSnapshot: t
			};
			return a.queue = o, Bs(ys.bind(null, r, o, e), [e]), r.flags |= 2048, Is(9, { destroy: void 0 }, vs.bind(null, r, o, n, t), null), n;
		},
		useId: function() {
			var e = os(), t = K.identifierPrefix;
			if (F) {
				var n = ia, r = ra;
				n = (r & ~(1 << 32 - ot(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = qo++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = Xo++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: ic,
		useFormState: js,
		useActionState: js,
		useOptimistic: function(e) {
			var t = os();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = dc.bind(null, V, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: ds,
		useCacheRefresh: function() {
			return os().memoizedState = sc.bind(null, V);
		},
		useEffectEvent: function(e) {
			var t = os(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (G & 2) throw Error(i(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, _c = {
		readContext: Aa,
		use: us,
		useCallback: Ys,
		useContext: Aa,
		useEffect: Vs,
		useImperativeHandle: qs,
		useInsertionEffect: Ws,
		useLayoutEffect: Gs,
		useMemo: Xs,
		useReducer: ps,
		useRef: Ls,
		useState: function() {
			return ps(fs);
		},
		useDebugValue: Js,
		useDeferredValue: function(e, t) {
			return Qs(ss(), H.memoizedState, e, t);
		},
		useTransition: function() {
			var e = ps(fs)[0], t = ss().memoizedState;
			return [typeof e == "boolean" ? e : ls(e), t];
		},
		useSyncExternalStore: gs,
		useId: ac,
		useHostTransitionStatus: ic,
		useFormState: Ms,
		useActionState: Ms,
		useOptimistic: function(e, t) {
			return Cs(ss(), H, e, t);
		},
		useMemoCache: ds,
		useCacheRefresh: oc,
		useEffectEvent: Us
	}, vc = {
		readContext: Aa,
		use: us,
		useCallback: Ys,
		useContext: Aa,
		useEffect: Vs,
		useImperativeHandle: qs,
		useInsertionEffect: Ws,
		useLayoutEffect: Gs,
		useMemo: Xs,
		useReducer: hs,
		useRef: Ls,
		useState: function() {
			return hs(fs);
		},
		useDebugValue: Js,
		useDeferredValue: function(e, t) {
			var n = ss();
			return H === null ? Zs(n, e, t) : Qs(n, H.memoizedState, e, t);
		},
		useTransition: function() {
			var e = hs(fs)[0], t = ss().memoizedState;
			return [typeof e == "boolean" ? e : ls(e), t];
		},
		useSyncExternalStore: gs,
		useId: ac,
		useHostTransitionStatus: ic,
		useFormState: Fs,
		useActionState: Fs,
		useOptimistic: function(e, t) {
			var n = ss();
			return H === null ? (n.baseState = e, [e, n.queue.dispatch]) : Cs(n, H, e, t);
		},
		useMemoCache: ds,
		useCacheRefresh: oc,
		useEffectEvent: Us
	};
	function yc(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : D({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var bc = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = Md(), i = yo(r);
			i.payload = t, n != null && (i.callback = n), t = bo(e, i, r), t !== null && (Fd(t, e, r), xo(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = Md(), i = yo(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = bo(e, i, r), t !== null && (Fd(t, e, r), xo(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = Md(), r = yo(n);
			r.tag = 2, t != null && (r.callback = t), t = bo(e, r, n), t !== null && (Fd(t, e, n), xo(t, e, n));
		}
	};
	function xc(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !Xr(n, r) || !Xr(i, a) : !0;
	}
	function Sc(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && bc.enqueueReplaceState(t, t.state, null);
	}
	function Cc(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = D({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function wc(e) {
		Oi(e);
	}
	function Tc(e) {
		console.error(e);
	}
	function Ec(e) {
		Oi(e);
	}
	function Dc(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Oc(e, t, n) {
		try {
			var r = e.onCaughtError;
			r(n.value, {
				componentStack: n.stack,
				errorBoundary: t.tag === 1 ? t.stateNode : null
			});
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function kc(e, t, n) {
		return n = yo(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			Dc(e, t);
		}, n;
	}
	function Ac(e) {
		return e = yo(e), e.tag = 3, e;
	}
	function jc(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				Oc(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			Oc(t, n, r), typeof i != "function" && (yd === null ? yd = /* @__PURE__ */ new Set([this]) : yd.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function Mc(e, t, n, r, a) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && Da(t, n, a, !0), n = z.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13:
					case 19: return No === null ? qd() : n.alternate === null && od === 0 && (od = 3), n.flags &= -257, n.flags |= 65536, n.lanes = a, r === to ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), hf(e, r, a)), !1;
					case 22: return n.flags |= 65536, r === to ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), hf(e, r, a)), !1;
				}
				throw Error(i(435, n.tag));
			}
			return hf(e, r, a), qd(), !1;
		}
		if (F) return t = z.current, t === null ? (r !== fa && (t = Error(i(423), { cause: r }), ya(Yi(t, n))), e = e.current.alternate, e.flags |= 65536, a &= -a, e.lanes |= a, r = Yi(r, n), a = kc(e.stateNode, r, a), So(e, a), od !== 4 && (od = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = a, r !== fa && (e = Error(i(422), { cause: r }), ya(Yi(e, n)))), !1;
		var o = Error(i(520), { cause: r });
		if (o = Yi(o, n), fd === null ? fd = [o] : fd.push(o), od !== 4 && (od = 2), t === null) return !0;
		r = Yi(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = a & -a, n.lanes |= e, e = kc(n.stateNode, r, e), So(n, e), !1;
				case 1:
					if (t = n.type, o = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (yd === null || !yd.has(o)))) return n.flags |= 65536, a &= -a, n.lanes |= a, a = Ac(a), jc(a, e, n, r), So(n, a), !1;
					break;
				case 22: if (n.memoizedState !== null) return n.flags |= 65536, !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var Nc = Error(i(461)), Pc = !1;
	function Fc(e, t, n, r) {
		t.child = e === null ? ho(t, null, n, r) : mo(t, e.child, n, r);
	}
	function Ic(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return ka(t), r = $o(e, t, n, o, a, i), s = rs(), e !== null && !Pc ? (is(e, t, i), ul(e, t, i)) : (F && s && sa(t), t.flags |= 1, Fc(e, t, r, i), t.child);
	}
	function Lc(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !M(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, Rc(e, t, a, r, i)) : (e = Ui(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !dl(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? Xr : n, n(o, r) && e.ref === t.ref) return ul(e, t, i);
		}
		return t.flags |= 1, e = Vi(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function Rc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (Xr(a, r) && e.ref === t.ref) {
				if (Pc = !1, t.pendingProps = r = a, dl(e, i)) e.flags & 131072 && (Pc = !0);
				else return t.lanes = e.lanes, ul(e, t, i);
			}
		}
		return Kc(e, t, n, r, i);
	}
	function zc(e, t, n, r) {
		var i = r.children, a = e === null ? null : e.memoizedState;
		if (e === null && t.stateNode === null && (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), r.mode === "hidden") {
			if (t.flags & 128) {
				if (a = a === null ? n : a.baseLanes | n, e !== null) {
					for (r = t.child = e.child, i = 0; r !== null;) i = i | r.lanes | r.childLanes, r = r.sibling;
					r = i & ~a;
				} else r = 0, t.child = null;
				return Vc(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && Xa(t, a === null ? null : a.cachePool), a === null ? jo() : Ao(t, a), B(t);
			else return r = t.lanes = 536870912, Vc(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && Xa(t, null), jo(), Io()) : (Xa(t, a.cachePool), Ao(t, a), Io(), t.memoizedState = null);
		return Fc(e, t, i, n), t.child;
	}
	function Bc(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function Vc(e, t, n, r, i) {
		var a = Ya();
		return a = a === null ? null : {
			parent: L._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && Xa(t, null), jo(), B(t), e !== null && Da(e, t, r, !0), t.childLanes = i, null;
	}
	function Hc(e, t) {
		return t = tl({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function Uc(e, t, n) {
		return mo(t, e.child, null, n), e = Hc(t, t.pendingProps), e.flags |= 2, Lo(t), t.memoizedState = null, e;
	}
	function Wc(e, t, n) {
		var r = t.pendingProps, a = !!(t.flags & 128);
		if (t.flags &= -129, e === null) {
			if (F) {
				if (r.mode === "hidden") return e = Hc(t, r), t.lanes = 536870912, e.memoizedState = {
					baseLanes: 0,
					cachePool: null
				}, Bc(null, e);
				if (Fo(t), (e = P) ? (e = am(e, da), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: na === null ? null : {
						id: ra,
						overflow: ia
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Ki(e), n.return = t, t.child = n, N = t, P = null)) : e = null, e === null) throw pa(t);
				return t.lanes = 536870912, null;
			}
			return Hc(t, r);
		}
		var o = e.memoizedState;
		if (o !== null) {
			var s = o.dehydrated;
			if (Fo(t), a) {
				if (t.flags & 256) t.flags &= -257, t = Uc(e, t, n);
				else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
				else throw Error(i(558));
			} else if (Pc || Da(e, t, n, !1), a = (n & e.childLanes) !== 0, Pc || a) {
				if (Oo.current === null) {
					if (r = K, r !== null && (s = wt(r, n), s !== 0 && s !== o.retryLane)) throw o.retryLane = s, Fi(e, s), Fd(r, e, s), Nc;
					qd();
				}
				t = Uc(e, t, n);
			} else e = o.treeContext, P = lm(s.nextSibling), N = t, F = !0, ua = null, da = !1, e !== null && la(t, e), t = Hc(t, r), t.flags |= 134221824;
			return t;
		}
		return e = Vi(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function Gc(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(i(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function Kc(e, t, n, r, i) {
		return ka(t), n = $o(e, t, n, r, void 0, i), r = rs(), e !== null && !Pc ? (is(e, t, i), ul(e, t, i)) : (F && r && sa(t), t.flags |= 1, Fc(e, t, n, i), t.child);
	}
	function qc(e, t, n, r, i, a) {
		return ka(t), t.updateQueue = null, n = ts(t, r, n, i), es(e), r = rs(), e !== null && !Pc ? (is(e, t, a), ul(e, t, a)) : (F && r && sa(t), t.flags |= 1, Fc(e, t, n, a), t.child);
	}
	function Jc(e, t, n, r, i) {
		if (ka(t), t.stateNode === null) {
			var a = Ri, o = n.contextType;
			typeof o == "object" && o && (a = Aa(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = bc, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, _o(t), o = n.contextType, a.context = typeof o == "object" && o ? Aa(o) : Ri, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (yc(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && bc.enqueueReplaceState(a, a.state, null), To(t, r, a, i), wo(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = Cc(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = Ri, typeof u == "object" && u && (o = Aa(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && Sc(t, a, r, o), go = !1;
			var f = t.memoizedState;
			a.state = f, To(t, r, a, i), wo(), l = t.memoizedState, s || f !== l || go ? (typeof d == "function" && (yc(t, n, d, r), l = t.memoizedState), (c = go || xc(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, vo(e, t), o = t.memoizedProps, u = Cc(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = Ri, typeof l == "object" && l && (c = Aa(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && Sc(t, a, r, c), go = !1, f = t.memoizedState, a.state = f, To(t, r, a, i), wo();
			var p = t.memoizedState;
			o !== d || f !== p || go || e !== null && e.dependencies !== null && Oa(e.dependencies) ? (typeof s == "function" && (yc(t, n, s, r), p = t.memoizedState), (u = go || xc(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && Oa(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, Gc(e, t), r = !!(t.flags & 128), a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = mo(t, e.child, null, i), t.child = mo(t, null, n, i)) : Fc(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = ul(e, t, i), e;
	}
	function Yc(e, t, n, r) {
		return _a(), t.flags |= 256, Fc(e, t, n, r), t.child;
	}
	var Xc = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function Zc(e) {
		return {
			baseLanes: e,
			cachePool: Za()
		};
	}
	function Qc(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= ud), e;
	}
	function $c(e, t, n) {
		var r = t.pendingProps, i = !1, a = !!(t.flags & 128), o;
		if ((o = a) || (o = e !== null && e.memoizedState === null ? !1 : !!(Ro.current & 2)), o && (i = !0, t.flags &= -129), o = !!(t.flags & 32), t.flags &= -33, e === null) {
			if (F) {
				if (i ? Po(t) : Io(), (e = P) ? (e = am(e, da), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: na === null ? null : {
						id: ra,
						overflow: ia
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Ki(e), n.return = t, t.child = n, N = t, P = null)) : e = null, e === null) throw pa(t);
				return t.lanes = sm(e) ? 32 : 536870912, null;
			}
			return a = r.children, r = r.fallback, i ? (Io(), i = t.mode, a = tl({
				mode: "hidden",
				children: a
			}, i), r = Wi(r, i, n, null), a.return = t, r.return = t, a.sibling = r, t.child = a, r = t.child, r.memoizedState = Zc(n), r.childLanes = Qc(e, o, n), t.memoizedState = Xc, Bc(null, r)) : (Po(t), el(t, a));
		}
		var s = e.memoizedState;
		if (s !== null) {
			var c = s.dehydrated;
			if (c !== null) return rl(e, t, a, o, r, c, s, n);
		}
		return i ? (Io(), i = r.fallback, a = t.mode, s = e.child, c = s.sibling, r = Vi(s, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = s.subtreeFlags & 1206910976, c === null ? (i = Wi(i, a, n, null), i.flags |= 2) : i = Vi(c, i), i.return = t, r.return = t, r.sibling = i, t.child = r, Bc(null, r), r = t.child, i = e.child.memoizedState, i === null ? i = Zc(n) : (a = i.cachePool, a === null ? a = Za() : (s = L._currentValue, a = a.parent === s ? a : {
			parent: s,
			pool: s
		}), i = {
			baseLanes: i.baseLanes | n,
			cachePool: a
		}), r.memoizedState = i, r.childLanes = Qc(e, o, n), t.memoizedState = Xc, Bc(e.child, r)) : (Po(t), n = e.child, e = n.sibling, n = Vi(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (o = t.deletions, o === null ? (t.deletions = [e], t.flags |= 16) : o.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function el(e, t) {
		return t = tl({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function tl(e, t) {
		return e = Bi(22, e, null, t), e.lanes = 0, e;
	}
	function nl(e, t, n) {
		return mo(t, e.child, null, n), e = el(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function rl(e, t, n, r, a, o, s, c) {
		if (n) return t.flags & 256 ? (Po(t), t.flags &= -257, nl(e, t, c)) : t.memoizedState === null ? (Io(), o = a.fallback, s = t.mode, a = tl({
			mode: "visible",
			children: a.children
		}, s), o = Wi(o, s, c, null), o.flags |= 2, a.return = t, o.return = t, a.sibling = o, t.child = a, mo(t, e.child, null, c), a = t.child, a.memoizedState = Zc(c), a.childLanes = Qc(e, r, c), t.memoizedState = Xc, Bc(null, a)) : (Io(), t.child = e.child, t.flags |= 128, null);
		if (Po(t), sm(o)) {
			if (r = o.nextSibling && o.nextSibling.dataset, r) var l = r.dgst;
			return r = l, r !== "" && (a = Error(i(419)), a.stack = "", a.digest = r, ya({
				value: a,
				source: null,
				stack: null
			})), nl(e, t, c);
		}
		if (Pc || Da(e, t, c, !1), r = (c & e.childLanes) !== 0, Pc || r) {
			if (Oo.current !== null) return nl(e, t, c);
			if (r = K, r !== null && (a = wt(r, c), a !== 0 && a !== s.retryLane)) throw s.retryLane = a, Fi(e, a), Fd(r, e, a), Nc;
			return om(o) || qd(), nl(e, t, c);
		}
		return om(o) ? (t.flags |= 192, t.child = e.child, null) : (e = s.treeContext, P = lm(o.nextSibling), N = t, F = !0, ua = null, da = !1, e !== null && la(t, e), t = el(t, a.children), t.flags |= 134221824, t);
	}
	function il(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), Ta(e.return, t, n);
	}
	function al(e) {
		for (var t = null; e !== null;) {
			var n = e.alternate;
			n !== null && Vo(n) === null && (t = e), e = e.sibling;
		}
		return t;
	}
	function ol(e, t, n, r, i, a) {
		var o = e.memoizedState;
		o === null ? e.memoizedState = {
			isBackwards: t,
			rendering: null,
			renderingStartTime: 0,
			last: r,
			tail: n,
			tailMode: i,
			treeForkCount: a
		} : (o.isBackwards = t, o.rendering = null, o.renderingStartTime = 0, o.last = r, o.tail = n, o.tailMode = i, o.treeForkCount = a);
	}
	function sl(e) {
		var t = e.child;
		for (e.child = null; t !== null;) {
			var n = t.sibling;
			t.sibling = e.child, e.child = t, t = n;
		}
	}
	function cl(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = Ro.current;
		if (t.flags & 128) return zo(t, o), null;
		var s = !!(o & 2);
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, zo(t, o), i === "backwards" && e !== null ? (sl(e), Fc(e, t, r, n), sl(e)) : Fc(e, t, r, n), r = F ? $i : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && il(e, n, t);
			else if (e.tag === 19) il(e, n, t);
			else if (e.child !== null) {
				e.child.return = e, e = e.child;
				continue;
			}
			if (e === t) break a;
			for (; e.sibling === null;) {
				if (e.return === null || e.return === t) break a;
				e = e.return;
			}
			e.sibling.return = e.return, e = e.sibling;
		}
		switch (i) {
			case "backwards":
				n = al(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null, sl(t)), ol(t, !0, i, null, a, r);
				break;
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && Vo(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				ol(t, !0, n, null, a, r);
				break;
			case "together":
				ol(t, !1, null, null, void 0, r);
				break;
			case "independent":
				t.memoizedState = null;
				break;
			default: n = al(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), ol(t, !1, i, n, a, r);
		}
		return t.child;
	}
	function ll(e, t, n) {
		var r = t.pendingProps;
		return Ca(t, t.type, r.value), Fc(e, t, r.children, n), t.child;
	}
	function ul(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), sd |= t.lanes, (n & t.childLanes) === 0) {
			if (e !== null) {
				if (Da(e, t, n, !1), (n & t.childLanes) === 0) return null;
			} else return null;
		}
		if (e !== null && t.child !== e.child) throw Error(i(153));
		if (t.child !== null) {
			for (e = t.child, n = Vi(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = Vi(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function dl(e, t) {
		return (e.lanes & t) !== 0 || (e = e.dependencies, !!(e !== null && Oa(e)));
	}
	function fl(e, t, n) {
		switch (t.tag) {
			case 3:
				Me(t, t.stateNode.containerInfo), Ca(t, L, e.memoizedState.cache), _a();
				break;
			case 27:
			case 5:
				Pe(t);
				break;
			case 4:
				Me(t, t.stateNode.containerInfo);
				break;
			case 10:
				Ca(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, Fo(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) {
					if (r.dehydrated !== null) return Po(t), t.flags |= 128, null;
					r = Da(e, t, n, !1);
					var i = t.child.childLanes;
					return r || (n & i) !== 0 ? $c(e, t, n) : (Po(t), e = ul(e, t, n), e === null ? null : e.sibling);
				}
				Po(t);
				break;
			case 19:
				if (t.flags & 128) return cl(e, t, n);
				if (i = !!(e.flags & 128), r = (n & t.childLanes) !== 0, r ||= (Da(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return cl(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), zo(t, Ro.current), r) break;
				return null;
			case 22: return t.lanes = 0, zc(e, t, n, t.pendingProps);
			case 24: Ca(t, L, e.memoizedState.cache);
		}
		return ul(e, t, n);
	}
	function pl(e, t, n) {
		if (e !== null) {
			if (e.memoizedProps !== t.pendingProps) Pc = !0;
			else {
				if (!dl(e, n) && !(t.flags & 128)) return Pc = !1, fl(e, t, n);
				Pc = !!(e.flags & 131072);
			}
		} else Pc = !1, F && t.flags & 1048576 && oa(t, $i, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = io(t.elementType), t.type = e, typeof e == "function") M(e) ? (r = Cc(e, r), t.tag = 1, t = Jc(null, t, e, r, n)) : (t.tag = 0, t = Kc(null, t, e, r, n));
					else {
						if (e != null) {
							var a = e.$$typeof;
							if (a === ce) {
								t.tag = 11, t = Ic(null, t, e, r, n);
								break a;
							}
							if (a === de) {
								t.tag = 14, t = Lc(null, t, e, r, n);
								break a;
							}
							if (a === se) {
								t.tag = 10, t.type = e, t = ll(null, t, n);
								break a;
							}
						}
						throw t = xe(e) || e, Error(i(306, t, ""));
					}
				}
				return t;
			case 0: return Kc(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, a = Cc(r, t.pendingProps), Jc(e, t, r, a, n);
			case 3:
				a: {
					if (Me(t, t.stateNode.containerInfo), e === null) throw Error(i(387));
					r = t.pendingProps;
					var o = t.memoizedState;
					a = o.element, vo(e, t), To(t, r, null, n);
					var s = t.memoizedState;
					if (r = s.cache, Ca(t, L, r), r !== o.cache && Ea(t, [L], n, !0), wo(), r = s.element, o.isDehydrated) {
						if (o = {
							element: r,
							isDehydrated: !1,
							cache: s.cache
						}, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
							t = Yc(e, t, r, n);
							break a;
						}
						if (r !== a) {
							a = Yi(Error(i(424)), t), ya(a), t = Yc(e, t, r, n);
							break a;
						}
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (P = lm(e.firstChild), N = t, F = !0, ua = null, da = !0, n = ho(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 134221824, n = n.sibling;
					} else {
						if (_a(), r === a) {
							t = ul(e, t, n);
							break a;
						}
						Fc(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return Gc(e, t), e === null ? (n = Nm(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : F || (t.stateNode = pp(t.type, t.pendingProps, Ae.current, t)) : t.memoizedState = Nm(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return Pe(t), e === null && F && (r = t.stateNode = hm(t.type, t.pendingProps, Ae.current), N = t, da = !0, a = P, Cp(t.type) ? (um = a, P = lm(r.firstChild)) : P = a), Fc(e, t, t.pendingProps.children, n), Gc(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && F && ((a = r = P) && (r = rm(r, t.type, t.pendingProps, da), r === null ? a = !1 : (t.stateNode = r, N = t, P = lm(r.firstChild), da = !1, a = !0)), a || pa(t)), Pe(t), a = t.type, o = t.pendingProps, s = e === null ? null : e.memoizedProps, r = o.children, mp(a, o) ? r = null : s !== null && mp(a, s) && (t.flags |= 32), t.memoizedState !== null && (a = $o(e, t, ns, null, null, n), sh._currentValue = a), Gc(e, t), Fc(e, t, r, n), t.child;
			case 6: return e === null && F && ((e = n = P) && (n = im(n, t.pendingProps, da), n === null ? e = !1 : (t.stateNode = n, N = t, P = null, e = !0)), e || pa(t)), null;
			case 13: return $c(e, t, n);
			case 4: return Me(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = mo(t, null, r, n) : Fc(e, t, r, n), t.child;
			case 11: return Ic(e, t, t.type, t.pendingProps, n);
			case 7: return r = t.pendingProps, Gc(e, t), Fc(e, t, r, n), t.child;
			case 8: return Fc(e, t, t.pendingProps.children, n), t.child;
			case 12: return Fc(e, t, t.pendingProps.children, n), t.child;
			case 10: return ll(e, t, n);
			case 9: return a = t.type._context, r = t.pendingProps.children, ka(t), a = Aa(a), r = r(a), t.flags |= 1, Fc(e, t, r, n), t.child;
			case 14: return Lc(e, t, t.type, t.pendingProps, n);
			case 15: return Rc(e, t, t.type, t.pendingProps, n);
			case 19: return cl(e, t, n);
			case 31: return Wc(e, t, n);
			case 22: return zc(e, t, n, t.pendingProps);
			case 24: return ka(t), r = Aa(L), e === null ? (a = Ya(), a === null && (a = K, o = Fa(), a.pooledCache = o, o.refCount++, o !== null && (a.pooledCacheLanes |= n), a = o), t.memoizedState = {
				parent: r,
				cache: a
			}, _o(t), Ca(t, L, a)) : ((e.lanes & n) !== 0 && (vo(e, t), To(t, null, null, n), wo()), a = e.memoizedState, o = t.memoizedState, a.parent === r ? (r = o.cache, Ca(t, L, r), r !== a.cache && Ea(t, [L], n, !0)) : (a = {
				parent: r,
				cache: r
			}, t.memoizedState = a, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = a), Ca(t, L, r))), Fc(e, t, t.pendingProps.children, n), t.child;
			case 30: return t.stateNode === null && (t.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}), r = t.pendingProps, r.name != null && r.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : F && sa(t), e !== null && e.memoizedProps.name !== r.name ? t.flags |= 4194816 : Gc(e, t), Fc(e, t, r.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(i(156, t.tag));
	}
	function ml(e) {
		e.flags |= 4;
	}
	function hl(e, t, n, r, i) {
		var a;
		if ((a = !!(e.mode & 32)) && (a = n === null ? Jm(t, r) : Jm(t, r) && (r.src !== n.src || r.srcSet !== n.srcSet)), a) {
			if (e.flags |= 16777216, (i & 335544128) === i) {
				if (e.stateNode.complete) e.flags |= 8192;
				else if (Wd()) e.flags |= 8192;
				else throw ao = to, $a;
			}
		} else e.flags &= -16777217;
	}
	function gl(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !Ym(t)) {
			if (Wd()) e.flags |= 8192;
			else throw ao = to, $a;
		}
	}
	function _l(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : vt(), e.lanes |= t, dd |= t);
	}
	function vl(e, t) {
		if (!F) switch (e.tailMode) {
			case "visible": break;
			case "collapsed":
				for (var n = e.tail, r = null; n !== null;) n.alternate !== null && (r = n), n = n.sibling;
				r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
				break;
			default:
				for (t = e.tail, n = null; t !== null;) t.alternate !== null && (n = t), t = t.sibling;
				n === null ? e.tail = null : n.sibling = null;
		}
	}
	function U(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 1206910976, r |= i.flags & 1206910976, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function yl(e, t, n) {
		var r = t.pendingProps;
		switch (ca(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return U(t), null;
			case 1: return U(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), wa(L), Ne(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (ga(t) ? ml(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, va())), U(t), null;
			case 26:
				var a = t.type, o = t.memoizedState;
				return e === null ? (ml(t), o === null ? (U(t), hl(t, a, null, r, n)) : (U(t), gl(t, o))) : o ? o === e.memoizedState ? (U(t), t.flags &= -16777217) : (ml(t), U(t), gl(t, o)) : (e = e.memoizedProps, e !== r && ml(t), U(t), hl(t, a, e, r, n)), null;
			case 27:
				if (Fe(t), n = Ae.current, a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && ml(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return U(t), t.subtreeFlags &= -33554433, null;
					}
					e = Oe.current, ga(t) ? ma(t, e) : (e = hm(a, r, n), t.stateNode = e, ml(t));
				}
				return U(t), t.subtreeFlags &= -33554433, null;
			case 5:
				if (Fe(t), a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && ml(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return U(t), t.subtreeFlags &= -33554433, null;
					}
					if (o = Oe.current, ga(t)) ma(t, o);
					else {
						var s = up(Ae.current);
						switch (o) {
							case 1:
								o = s.createElementNS("http://www.w3.org/2000/svg", a);
								break;
							case 2:
								o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
								break;
							default: switch (a) {
								case "svg":
									o = s.createElementNS("http://www.w3.org/2000/svg", a);
									break;
								case "math":
									o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
									break;
								case "script":
									o = s.createElement("div"), o.innerHTML = "<script><\/script>", o = o.removeChild(o.firstChild);
									break;
								case "select":
									o = typeof r.is == "string" ? s.createElement("select", { is: r.is }) : s.createElement("select"), r.multiple ? o.multiple = !0 : r.size && (o.size = r.size);
									break;
								default: o = typeof r.is == "string" ? s.createElement(a, { is: r.is }) : s.createElement(a);
							}
						}
						o[At] = t, o[jt] = r;
						a: for (s = t.child; s !== null;) {
							if (s.tag === 5 || s.tag === 6) o.appendChild(s.stateNode);
							else if (s.tag !== 4 && s.tag !== 27 && s.child !== null) {
								s.child.return = s, s = s.child;
								continue;
							}
							if (s === t) break a;
							for (; s.sibling === null;) {
								if (s.return === null || s.return === t) break a;
								s = s.return;
							}
							s.sibling.return = s.return, s = s.sibling;
						}
						t.stateNode = o;
						a: switch (rp(o, a, r), a) {
							case "button":
							case "input":
							case "select":
							case "textarea":
								r = !!r.autoFocus;
								break a;
							case "img":
								r = !0;
								break a;
							default: r = !1;
						}
						r && ml(t);
					}
				}
				return U(t), t.subtreeFlags &= -33554433, hl(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && ml(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(i(166));
					if (e = Ae.current, ga(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, a = N, a !== null) switch (a.tag) {
							case 27:
							case 5: r = a.memoizedProps;
						}
						e[At] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || tp(e.nodeValue, n)), e || pa(t, !0);
					} else e = up(e).createTextNode(r), e[At] = t, t.stateNode = e;
				}
				return U(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = ga(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(i(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(557));
							e[At] = t;
						} else _a(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						U(t), e = !1;
					} else n = va(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (Lo(t), t) : (Lo(t), null);
					if (t.flags & 128) throw Error(i(558));
				}
				return U(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (a = ga(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!a) throw Error(i(318));
							if (a = t.memoizedState, a = a === null ? null : a.dehydrated, !a) throw Error(i(317));
							a[At] = t;
						} else _a(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						U(t), a = !1;
					} else a = va(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), a = !0;
					if (!a) return t.flags & 256 ? (Lo(t), t) : (Lo(t), null);
				}
				return Lo(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, a = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (a = r.alternate.memoizedState.cachePool.pool), o = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (o = r.memoizedState.cachePool.pool), o !== a && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), _l(t, t.updateQueue), U(t), null);
			case 4: return Ne(), e === null && Gf(t.stateNode.containerInfo), t.flags |= 67108864, U(t), null;
			case 10: return wa(t.type), U(t), null;
			case 19:
				if (Bo(t), r = t.memoizedState, r === null) return U(t), null;
				if (a = !!(t.flags & 128), o = r.rendering, o === null) {
					if (a) vl(r, !1);
					else {
						if (od !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
							if (o = Vo(e), o !== null) {
								for (t.flags |= 128, vl(r, !1), e = o.updateQueue, t.updateQueue = e, _l(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) Hi(n, e), n = n.sibling;
								return zo(t, Ro.current & 1 | 2), F && aa(t, r.treeForkCount), t.child;
							}
							e = e.sibling;
						}
						r.tail !== null && Je() > _d && (t.flags |= 128, a = !0, vl(r, !1), t.lanes = 4194304);
					}
				} else {
					if (!a) {
						if (e = Vo(o), e !== null) {
							if (t.flags |= 128, a = !0, e = e.updateQueue, t.updateQueue = e, _l(t, e), vl(r, !0), r.tail === null && r.tailMode !== "collapsed" && r.tailMode !== "visible" && !o.alternate && !F) return U(t), null;
						} else 2 * Je() - r.renderingStartTime > _d && n !== 536870912 && (t.flags |= 128, a = !0, vl(r, !1), t.lanes = 4194304);
					}
					r.isBackwards ? (o.sibling = t.child, t.child = o) : (e = r.last, e === null ? t.child = o : e.sibling = o, r.last = o);
				}
				if (r.tail !== null) {
					e = r.tail;
					a: {
						for (n = e; n !== null;) {
							if (n.alternate !== null) {
								n = !1;
								break a;
							}
							n = n.sibling;
						}
						n = !0;
					}
					return r.rendering = e, r.tail = e.sibling, r.renderingStartTime = Je(), e.sibling = null, o = Ro.current, o = a ? o & 1 | 2 : o & 1, r.tailMode === "visible" || r.tailMode === "collapsed" || !n || F ? zo(t, o) : (n = o, A(z, t), A(Ro, n), No === null && (No = t)), F && aa(t, r.treeForkCount), e;
				}
				return U(t), null;
			case 22:
			case 23: return Lo(t), Mo(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (U(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : U(t), n = t.updateQueue, n !== null && _l(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && De(Ja), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), wa(L), U(t), null;
			case 25: return null;
			case 30: return t.flags |= 33554432, U(t), null;
		}
		throw Error(i(156, t.tag));
	}
	function bl(e, t) {
		switch (ca(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return wa(L), Ne(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return Fe(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (Lo(t), t.alternate === null) throw Error(i(340));
					_a();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (Lo(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(i(340));
					_a();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return Bo(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
			case 4: return Ne(), null;
			case 10: return wa(t.type), null;
			case 22:
			case 23: return Lo(t), Mo(), e !== null && De(Ja), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return wa(L), null;
			case 25: return null;
			default: return null;
		}
	}
	function xl(e, t) {
		switch (ca(t), t.tag) {
			case 3:
				wa(L), Ne();
				break;
			case 26:
			case 27:
			case 5:
				Fe(t);
				break;
			case 4:
				Ne();
				break;
			case 31:
				t.memoizedState !== null && Lo(t);
				break;
			case 13:
				Lo(t);
				break;
			case 19:
				Bo(t);
				break;
			case 10:
				wa(t.type);
				break;
			case 22:
			case 23:
				Lo(t), Mo(), e !== null && De(Ja);
				break;
			case 24: wa(L);
		}
	}
	function Sl(e, t) {
		try {
			var n = t.updateQueue, r = n === null ? null : n.lastEffect;
			if (r !== null) {
				var i = r.next;
				n = i;
				do {
					if ((n.tag & e) === e) {
						r = void 0;
						var a = n.create, o = n.inst;
						r = a(), o.destroy = r;
					}
					n = n.next;
				} while (n !== i);
			}
		} catch (e) {
			X(t, t.return, e);
		}
	}
	function Cl(e, t, n) {
		try {
			var r = t.updateQueue, i = r === null ? null : r.lastEffect;
			if (i !== null) {
				var a = i.next;
				r = a;
				do {
					if ((r.tag & e) === e) {
						var o = r.inst, s = o.destroy;
						if (s !== void 0) {
							o.destroy = void 0, i = t;
							var c = n, l = s;
							try {
								l();
							} catch (e) {
								X(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			X(t, t.return, e);
		}
	}
	function wl(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				Do(t, n);
			} catch (t) {
				X(e, e.return, t);
			}
		}
	}
	function Tl(e, t, n) {
		n.props = Cc(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			X(e, t, n);
		}
	}
	function El(e, t) {
		try {
			var n = e.ref;
			if (n !== null) {
				switch (e.tag) {
					case 26:
					case 27:
					case 5:
						var r = e.stateNode;
						break;
					case 30:
						var i = e.stateNode, a = Ti(e.memoizedProps, i);
						(i.ref === null || i.ref.name !== a) && (i.ref = Pp(a)), r = i.ref;
						break;
					case 7:
						if (e.stateNode === null) {
							var o = new Fp(e);
							h(e.child, !1, Qp, o, void 0, void 0), e.stateNode = o;
						}
						r = e.stateNode;
						break;
					default: r = e.stateNode;
				}
				typeof n == "function" ? e.refCleanup = n(r) : n.current = r;
			}
		} catch (n) {
			X(e, t, n);
		}
	}
	function Dl(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) {
			if (typeof r == "function") try {
				r();
			} catch (n) {
				X(e, t, n);
			} finally {
				e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
			}
			else if (typeof n == "function") try {
				n(null);
			} catch (n) {
				X(e, t, n);
			}
			else n.current = null;
		}
	}
	function Ol(e, t) {
		if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null) for (var n = 0; n < t.length; n++) em(e.stateNode, t[n]);
	}
	function kl(e) {
		for (var t = e.return; t !== null && (Ml(t) && em(e.stateNode, t.stateNode), !jl(t));) t = t.return;
	}
	function Al(e) {
		for (var t = e.return; t !== null && (Ml(t) && tm(e.stateNode, t.stateNode), !jl(t));) t = t.return;
	}
	function jl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 27;
	}
	function Ml(e) {
		return e && e.tag === 7 && e.stateNode !== null;
	}
	function Nl(e) {
		var t = e.type, n = e.memoizedProps, r = e.stateNode;
		try {
			a: switch (t) {
				case "button":
				case "input":
				case "select":
				case "textarea":
					n.autoFocus && r.focus();
					break a;
				case "img": n.src ? r.src = n.src : n.srcSet && (r.srcset = n.srcSet);
			}
		} catch (t) {
			X(e, e.return, t);
		}
	}
	function Pl(e, t, n) {
		try {
			var r = e.stateNode;
			ap(r, e.type, n, t), r[jt] = t;
		} catch (t) {
			X(e, e.return, t);
		}
	}
	function Fl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Cp(e.type) || e.tag === 4;
	}
	function Il(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Fl(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Cp(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function Ll(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(i, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(i), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = En)), Ol(e, r), j = !0;
		else if (i !== 4 && (i === 27 && (Ol(e, r), r = null, Cp(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null)) for (Ll(e, t, n, r), e = e.sibling; e !== null;) Ll(e, t, n, r), e = e.sibling;
	}
	function Rl(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? n.insertBefore(i, t) : n.appendChild(i), Ol(e, r), j = !0;
		else if (i !== 4 && (i === 27 && (Ol(e, r), r = null, Cp(e.type) && (n = e.stateNode)), e = e.child, e !== null)) for (Rl(e, t, n, r), e = e.sibling; e !== null;) Rl(e, t, n, r), e = e.sibling;
	}
	function zl(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			rp(t, r, n), t[At] = e, t[jt] = n;
		} catch (t) {
			X(e, e.return, t);
		}
	}
	var Bl = !1, Vl = null;
	function Hl(e) {
		(e.tag === 30 || e.subtreeFlags & 33554432) && (Bl = !0);
	}
	var Ul = null;
	function Wl() {
		var e = Ul;
		return Ul = null, e;
	}
	var Gl = 0;
	function Kl(e, t, n, r, i) {
		return Gl = 0, ql(e.child, t, n, r, i);
	}
	function ql(e, t, n, r, i) {
		for (var a = !1; e !== null;) {
			if (e.tag === 5) {
				var o = e.stateNode;
				if (r !== null) {
					var s = $(o);
					r.push(s), s.view && (a = !0);
				} else a || $(o).view && (a = !0);
				Bl = !0, Ep(o, Gl === 0 ? t : t + "_" + Gl, n), Gl++;
			} else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && i || ql(e.child, t, n, r, i) && (a = !0));
			e = e.sibling;
		}
		return a;
	}
	function Jl(e, t) {
		for (; e !== null;) e.tag === 5 ? Dp(e.stateNode, e.memoizedProps) : (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && t || Jl(e.child, t)), e = e.sibling;
	}
	function Yl(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if ((e.tag !== 22 || e.memoizedState === null) && (Yl(e), e.tag === 30 && e.flags & 18874368 && e.stateNode.paired)) {
				var t = e.memoizedProps;
				if (t.name == null || t.name === "auto") throw Error(i(544));
				var n = t.name;
				t = Di(t.default, t.share), t !== "none" && (Kl(e, n, t, null, !1) || Jl(e.child, !1));
			}
			e = e.sibling;
		}
	}
	function Xl(e, t) {
		if (e.tag === 30) {
			var n = e.stateNode, r = e.memoizedProps, i = Ti(r, n), a = Di(r.default, n.paired ? r.share : r.enter);
			a === "none" ? Yl(e) : Kl(e, i, a, null, !1) ? (Yl(e), n.paired || t || Pd(e, r.onEnter)) : Jl(e.child, !1);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Xl(e, t), e = e.sibling;
		else Yl(e);
	}
	function Zl(e) {
		if (Vl !== null && Vl.size !== 0) {
			var t = Vl;
			if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
				if (e.tag !== 22 || e.memoizedState === null) {
					if (e.tag === 30 && e.flags & 18874368) {
						var n = e.memoizedProps, r = n.name;
						if (r != null && r !== "auto") {
							var i = t.get(r);
							if (i !== void 0) {
								var a = Di(n.default, n.share);
								if (a !== "none" && (Kl(e, r, a, null, !1) ? (a = e.stateNode, i.paired = a, a.paired = i, Pd(e, n.onShare)) : Jl(e.child, !1)), t.delete(r), t.size === 0) break;
							}
						}
					}
					Zl(e);
				}
				e = e.sibling;
			}
		}
	}
	function Ql(e) {
		if (e.tag === 30) {
			var t = e.memoizedProps, n = Ti(t, e.stateNode), r = Vl === null ? void 0 : Vl.get(n), i = Di(t.default, r === void 0 ? t.exit : t.share);
			i !== "none" && (Kl(e, n, i, null, !1) ? r === void 0 ? Pd(e, t.onExit) : (i = e.stateNode, r.paired = i, i.paired = r, Vl.delete(n), Pd(e, t.onShare)) : Jl(e.child, !1)), Vl !== null && Zl(e);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Ql(e), e = e.sibling;
		else Vl !== null && Zl(e);
	}
	function $l(e) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var t = e.memoizedProps, n = Ti(t, e.stateNode);
				t = Di(t.default, t.update), e.flags &= -5, t !== "none" && Kl(e, n, t, e.memoizedState = [], !1);
			} else e.subtreeFlags & 33554432 && $l(e);
			e = e.sibling;
		}
	}
	function eu(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if (e.tag !== 22 || e.memoizedState === null) {
				if (e.tag === 30 && e.flags & 18874368) {
					var t = e.stateNode;
					t.paired !== null && (t.paired = null, Jl(e.child, !1));
				}
				eu(e);
			}
			e = e.sibling;
		}
	}
	function tu(e) {
		if (e.tag === 30) e.stateNode.paired = null, Jl(e.child, !1), eu(e);
		else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) tu(e), e = e.sibling;
		else eu(e);
	}
	function nu(e) {
		for (e = e.child; e !== null;) e.tag === 30 ? Jl(e.child, !1) : e.subtreeFlags & 33554432 && nu(e), e = e.sibling;
	}
	function ru(e, t, n, r, i, a, o) {
		for (var s = !1; t !== null;) {
			if (t.tag === 5) {
				var c = t.stateNode;
				if (a !== null && Gl < a.length) {
					var l = a[Gl], u = $(c);
					(l.view || u.view) && (s = !0);
					var d;
					if (d = !(e.flags & 4)) {
						if (u.clip) d = !0;
						else {
							d = l.rect;
							var f = u.rect;
							d = d.y !== f.y || d.x !== f.x || d.height !== f.height || d.width !== f.width;
						}
					}
					d && (e.flags |= 4), u.abs ? u = !l.abs : (l = l.rect, u = u.rect, u = l.height !== u.height || l.width !== u.width), u && (e.flags |= 32);
				} else e.flags |= 32;
				e.flags & 4 && Ep(c, Gl === 0 ? n : n + "_" + Gl, i), s && e.flags & 4 || (Ul === null && (Ul = []), Ul.push(c, Gl === 0 ? r : r + "_" + Gl, t.memoizedProps)), Gl++;
			} else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && o ? e.flags |= t.flags & 32 : ru(e, t.child, n, r, i, a, o) && (s = !0));
			t = t.sibling;
		}
		return s;
	}
	function iu(e, t) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var n = e.memoizedProps, r = e.stateNode, i = Ti(n, r), a = Di(n.default, n.update);
				if (t) {
					r = r.clones;
					var o = r === null ? null : r.map(kp);
				} else o = e.memoizedState, e.memoizedState = null;
				r = e;
				var s = e.child;
				Gl = 0, i = ru(r, s, i, i, a, o, !1), e.flags & 4 && i && (t || Pd(e, n.onUpdate));
			} else e.subtreeFlags & 33554432 && iu(e, t);
			e = e.sibling;
		}
	}
	var au = !1, W = !1, ou = !1, su = !1, cu = typeof WeakSet == "function" ? WeakSet : Set, lu = null, uu = !1, du = !1, fu = !1, pu = !1;
	function mu(e, t, n) {
		if (e = e.containerInfo, cp = gh, e = ti(e), ni(e)) {
			if ("selectionStart" in e) var r = {
				start: e.selectionStart,
				end: e.selectionEnd
			};
			else a: {
				r = (r = e.ownerDocument) && r.defaultView || window;
				var i = r.getSelection && r.getSelection();
				if (i && i.rangeCount !== 0) {
					r = i.anchorNode;
					var a = i.anchorOffset, o = i.focusNode;
					i = i.focusOffset;
					try {
						r.nodeType, o.nodeType;
					} catch {
						r = null;
						break a;
					}
					var s = 0, c = -1, l = -1, u = 0, d = 0, f = e, p = null;
					b: for (;;) {
						for (var m; f !== r || a !== 0 && f.nodeType !== 3 || (c = s + a), f !== o || i !== 0 && f.nodeType !== 3 || (l = s + i), f.nodeType === 3 && (s += f.nodeValue.length), (m = f.firstChild) !== null;) p = f, f = m;
						for (;;) {
							if (f === e) break b;
							if (p === r && ++u === a && (c = s), p === o && ++d === i && (l = s), (m = f.nextSibling) !== null) break;
							f = p, p = f.parentNode;
						}
						f = m;
					}
					r = c === -1 || l === -1 ? null : {
						start: c,
						end: l
					};
				} else r = null;
			}
			r ||= {
				start: 0,
				end: 0
			};
		} else r = null;
		for (lp = {
			focusedElem: e,
			selectionRange: r
		}, gh = !1, n = (n & 335544064) === n, lu = t, t = n ? 9270 : 1024; lu !== null;) {
			if (e = lu, n && (r = e.deletions, r !== null)) for (a = 0; a < r.length; a++) n && Ql(r[a]);
			if (e.alternate === null && e.flags & 2) n && Hl(e), hu(n);
			else {
				if (e.tag === 22) {
					if (r = e.alternate, e.memoizedState !== null) {
						r !== null && r.memoizedState === null && n && Ql(r), hu(n);
						continue;
					}
					if (r !== null && r.memoizedState !== null) {
						n && Hl(e), hu(n);
						continue;
					}
				}
				r = e.child, (e.subtreeFlags & t) !== 0 && r !== null ? (r.return = e, lu = r) : (n && $l(e), hu(n));
			}
		}
		Vl = null;
	}
	function hu(e) {
		for (; lu !== null;) {
			var t = lu, n = e, r = t.alternate, a = t.flags;
			switch (t.tag) {
				case 0:
				case 11:
				case 15: break;
				case 1:
					if (a & 1024 && r !== null) {
						n = void 0, a = r.memoizedProps, r = r.memoizedState;
						var o = t.stateNode;
						try {
							var s = Cc(t.type, a);
							n = o.getSnapshotBeforeUpdate(s, r), o.__reactInternalSnapshotBeforeUpdate = n;
						} catch (e) {
							X(t, t.return, e);
						}
					}
					break;
				case 3:
					if (a & 1024) {
						if (r = t.stateNode.containerInfo, n = r.nodeType, n === 9) nm(r);
						else if (n === 1) switch (r.nodeName) {
							case "HEAD":
							case "HTML":
							case "BODY":
								nm(r);
								break;
							default: r.textContent = "";
						}
					}
					break;
				case 5:
				case 26:
				case 27:
				case 6:
				case 4:
				case 17: break;
				case 30:
					n && r !== null && (n = Ti(r.memoizedProps, r.stateNode), a = t.memoizedProps, a = Di(a.default, a.update), a !== "none" && Kl(r, n, a, r.memoizedState = [], !0));
					break;
				default: if (a & 1024) throw Error(i(163));
			}
			if (r = t.sibling, r !== null) {
				r.return = t.return, lu = r;
				break;
			}
			lu = t.return;
		}
	}
	function gu(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				Iu(e, n), r & 4 && Sl(5, n);
				break;
			case 1:
				if (Iu(e, n), r & 4) {
					if (e = n.stateNode, t === null) try {
						e.componentDidMount();
					} catch (e) {
						X(n, n.return, e);
					}
					else {
						var i = Cc(n.type, t.memoizedProps);
						t = t.memoizedState;
						try {
							e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
						} catch (e) {
							X(n, n.return, e);
						}
					}
				}
				r & 64 && wl(n), r & 512 && El(n, n.return);
				break;
			case 3:
				if (Iu(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
					if (t = null, n.child !== null) switch (n.child.tag) {
						case 27:
						case 5:
							t = n.child.stateNode;
							break;
						case 1: t = n.child.stateNode;
					}
					try {
						Do(e, t);
					} catch (e) {
						X(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && zl(n);
			case 26:
			case 5:
				Iu(e, n), t === null && r & 4 && Nl(n), r & 512 && El(n, n.return);
				break;
			case 12:
				Iu(e, n);
				break;
			case 31:
				Iu(e, n), r & 4 && Tu(e, n);
				break;
			case 13:
				Iu(e, n), r & 4 && Eu(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = vf.bind(null, n), cm(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || au, !r) {
					var a = t !== null && t.memoizedState !== null || W;
					t = au, i = W, au = r, (W = a) && !i ? (r = 2, n.subtreeFlags & 8772 && (r |= 1), Ru(e, n, r)) : Iu(e, n), au = t, W = i;
				}
				break;
			case 30:
				Iu(e, n), r & 512 && El(n, n.return);
				break;
			case 7: r & 512 && El(n, n.return);
			default: Iu(e, n);
		}
	}
	function _u(e, t) {
		for (e = e.child; e !== null;) vu(e, t), e = e.sibling;
	}
	function vu(e, t) {
		switch (e.tag) {
			case 5:
			case 26:
				try {
					var n = e.stateNode;
					if (t) {
						var r = n.style;
						typeof r.setProperty == "function" ? r.setProperty("display", "none", "important") : r.display = "none";
					} else {
						var i = e.stateNode, a = e.memoizedProps.style, o = a != null && a.hasOwnProperty("display") ? a.display : null;
						i.style.display = o == null || typeof o == "boolean" ? "" : ("" + o).trim();
					}
				} catch (t) {
					X(e, e.return, t);
				}
				yu(e, t);
				break;
			case 6:
				try {
					e.stateNode.nodeValue = t ? "" : e.memoizedProps, j = !0;
				} catch (t) {
					X(e, e.return, t);
				}
				break;
			case 18:
				try {
					var s = e.stateNode;
					t ? Tp(s, !0) : Tp(e.stateNode, !1);
				} catch (t) {
					X(e, e.return, t);
				}
				break;
			case 22:
			case 23:
				e.memoizedState === null && _u(e, t);
				break;
			default: _u(e, t);
		}
	}
	function yu(e, t) {
		if (e.subtreeFlags & 67108864) for (e = e.child; e !== null;) {
			a: {
				var n = e, r = t;
				switch (n.tag) {
					case 4:
						vu(n, r);
						break a;
					case 22:
						n.memoizedState === null && yu(n, r);
						break a;
					default: yu(n, r);
				}
			}
			e = e.sibling;
		}
	}
	function bu(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, bu(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && zt(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var xu = null, Su = !1;
	function Cu(e, t, n) {
		for (n = n.child; n !== null;) wu(e, t, n), n = n.sibling;
	}
	function wu(e, t, n) {
		if (it && typeof it.onCommitFiberUnmount == "function") try {
			it.onCommitFiberUnmount(rt, n);
		} catch {}
		switch (n.tag) {
			case 26:
				W || Dl(n, t), Cu(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !W && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				W || Dl(n, t), Al(n);
				var r = xu, i = Su;
				Cp(n.type) && (xu = n.stateNode, Su = !1), Cu(e, t, n), gm(n.stateNode, n.type, n.memoizedProps), xu = r, Su = i;
				break;
			case 5: W || Dl(n, t), Al(n);
			case 6:
				if (n.tag === 6 && Al(n), r = xu, i = Su, xu = null, Cu(e, t, n), xu = r, Su = i, xu !== null) {
					if (Su) try {
						(xu.nodeType === 9 ? xu.body : xu.nodeName === "HTML" ? xu.ownerDocument.body : xu).removeChild(n.stateNode), j = !0;
					} catch (e) {
						X(n, t, e);
					}
					else try {
						xu.removeChild(n.stateNode), j = !0;
					} catch (e) {
						X(n, t, e);
					}
				}
				break;
			case 18:
				xu !== null && (Su ? (e = xu, wp(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), Hh(e)) : wp(xu, n.stateNode));
				break;
			case 4:
				r = xu, i = Su, xu = n.stateNode.containerInfo, Su = !0, Cu(e, t, n), xu = r, Su = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				Cl(2, n, t), W || Cl(4, n, t), Cu(e, t, n);
				break;
			case 1:
				W || (Dl(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && Tl(n, t, r)), Cu(e, t, n);
				break;
			case 21:
				Cu(e, t, n);
				break;
			case 22:
				W = (r = W) || n.memoizedState !== null, Cu(e, t, n), W = r;
				break;
			case 30:
				Dl(n, t), Cu(e, t, n);
				break;
			case 7:
				W || Dl(n, t), Cu(e, t, n);
				break;
			default: Cu(e, t, n);
		}
	}
	function Tu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				Hh(e);
			} catch (e) {
				X(t, t.return, e);
			}
		}
	}
	function Eu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			Hh(e);
		} catch (e) {
			X(t, t.return, e);
		}
	}
	function Du(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new cu()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new cu()), t;
			default: throw Error(i(435, e.tag));
		}
	}
	function Ou(e, t) {
		var n = Du(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = yf.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function ku(e, t, n) {
		var r = t.deletions;
		if (r !== null) for (var a = 0; a < r.length; a++) {
			var o = r[a], s = e, c = t, l = c;
			a: for (; l !== null;) {
				switch (l.tag) {
					case 27:
						if (Cp(l.type)) {
							xu = l.stateNode, Su = !1;
							break a;
						}
						break;
					case 5:
						xu = l.stateNode, Su = !1;
						break a;
					case 3:
					case 4:
						xu = l.stateNode.containerInfo, Su = !0;
						break a;
				}
				l = l.return;
			}
			if (xu === null) throw Error(i(160));
			wu(s, c, o), xu = null, Su = !1, s = o.alternate, s !== null && (s.return = null), o.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) ju(t, e, n), t = t.sibling;
	}
	var Au = null;
	function ju(e, t, n) {
		var r = e.alternate, a = e.flags;
		switch (e.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				if (a & 4 && (r = e.updateQueue, r = r === null ? null : r.events, r !== null)) for (var o = 0; o < r.length; o++) {
					var s = r[o];
					s.ref.impl = s.nextImpl;
				}
				ku(t, e, n), Mu(e), a & 4 && (Cl(3, e, e.return), Sl(3, e), Cl(5, e, e.return));
				break;
			case 1:
				ku(t, e, n), Mu(e), a & 512 && (W || r === null || Dl(r, r.return)), a & 64 && au && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? t : n.concat(t))));
				break;
			case 26:
				if (o = Au, ku(t, e, n), Mu(e), a & 512 && (W || r === null || Dl(r, r.return)), a & 4) {
					if (a = r === null ? null : r.memoizedState, n = e.memoizedState, r === null) {
						if (n === null) {
							if (e.stateNode === null) {
								if (au) e.stateNode = pp(e.type, e.memoizedProps, t.containerInfo, e);
								else {
									a: {
										t = e.type, n = e.memoizedProps, a = o.ownerDocument || o;
										b: switch (t) {
											case "title":
												r = a.getElementsByTagName("title")[0], (!r || r[Lt] || r[At] || r.namespaceURI === "http://www.w3.org/2000/svg" || r.hasAttribute("itemprop")) && (r = a.createElement(t), a.head.insertBefore(r, a.querySelector("head > title"))), rp(r, t, n), r[At] = e, Wt(r), t = r;
												break a;
											case "link":
												if (o = Gm("link", "href", a).get(t + (n.href || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && r.getAttribute("rel") === (n.rel == null ? null : n.rel) && r.getAttribute("title") === (n.title == null ? null : n.title) && r.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = a.createElement(t), rp(r, t, n), a.head.appendChild(r);
												break;
											case "meta":
												if (o = Gm("meta", "content", a).get(t + (n.content || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("content") === (n.content == null ? null : "" + n.content) && r.getAttribute("name") === (n.name == null ? null : n.name) && r.getAttribute("property") === (n.property == null ? null : n.property) && r.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && r.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = a.createElement(t), rp(r, t, n), a.head.appendChild(r);
												break;
											default: throw Error(i(468, t));
										}
										r[At] = e, Wt(r), t = r;
									}
									e.stateNode = t;
								}
							} else au || Km(o, e.type, e.stateNode);
						} else e.stateNode = Bm(o, n, e.memoizedProps);
					} else a === n ? n === null && e.stateNode !== null && Pl(e, e.memoizedProps, r.memoizedProps) : (a === null ? (t = r.stateNode, t === null || W || t.parentNode.removeChild(t)) : a.count--, n === null ? au || Km(o, e.type, e.stateNode) : Bm(o, n, e.memoizedProps));
				}
				break;
			case 27:
				ku(t, e, n), Mu(e), a & 512 && (W || r === null || Dl(r, r.return)), r !== null && a & 4 && Pl(e, e.memoizedProps, r.memoizedProps);
				break;
			case 5:
				if (o = ou, ou = !1, ku(t, e, n), ou = o, Mu(e), a & 512 && (W || r === null || Dl(r, r.return)), e.flags & 32) {
					t = e.stateNode;
					try {
						vn(t, ""), j = !0;
					} catch (t) {
						X(e, e.return, t);
					}
				}
				a & 4 && e.stateNode != null && (t = e.memoizedProps, Pl(e, t, r === null ? t : r.memoizedProps)), a & 1024 && (su = !0);
				break;
			case 6:
				if (ku(t, e, n), Mu(e), a & 4) {
					if (e.stateNode === null) throw Error(i(162));
					t = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = t, j = !0;
					} catch (t) {
						X(e, e.return, t);
					}
				}
				break;
			case 3:
				if (j = !1, Wm = null, o = Au, Au = bm(t.containerInfo), ku(t, e, n), Au = o, Mu(e), a & 4 && r !== null && r.memoizedState.isDehydrated) try {
					Hh(t.containerInfo);
				} catch (t) {
					X(e, e.return, t);
				}
				su && (su = !1, Nu(e)), j = !1;
				break;
			case 4:
				a = ou, ou = au, r = en(), o = Au, Au = bm(e.stateNode.containerInfo), ku(t, e, n), Mu(e), Au = o, j && du && (fu = !0), j = r, ou = a;
				break;
			case 12:
				ku(t, e, n), Mu(e);
				break;
			case 31:
				ku(t, e, n), Mu(e), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Ou(e, t)));
				break;
			case 13:
				ku(t, e, n), Mu(e), e.child.flags & 8192 && e.memoizedState !== null != (r !== null && r.memoizedState !== null) && (hd = Je()), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Ou(e, t)));
				break;
			case 22:
				o = e.memoizedState !== null, s = r !== null && r.memoizedState !== null;
				var c = au, l = W, u = ou;
				au = c || o, ou = u || o, W = l || s, ku(t, e, n), W = l, ou = u, au = c, Mu(e), a & 8192 && (t = e.stateNode, t._visibility = o ? t._visibility & -2 : t._visibility | 1, !o || r === null || s || au || W || (t = s || W, n = au, r = W, au = o || au, W = t, Lu(e, 2), au = n, W = r), !o && ou || _u(e, o)), a & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, Ou(e, n))));
				break;
			case 19:
				ku(t, e, n), Mu(e), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Ou(e, t)));
				break;
			case 30:
				a & 512 && (W || r === null || Dl(r, r.return)), a = en(), o = du, s = (n & 335544064) === n, c = e.memoizedProps, du = s && Di(c.default, c.update) !== "none", ku(t, e, n), Mu(e), s && r !== null && j && (e.flags |= 4), du = o, j = a;
				break;
			case 21: break;
			case 7: a & 512 && (W || r === null || Dl(r, r.return)), r && r.stateNode !== null && (r.stateNode._fragmentFiber = e);
			default: ku(t, e, n), Mu(e);
		}
	}
	function Mu(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Fl(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				r = null;
				for (var a = e.return; a !== null;) {
					if (Ml(a)) {
						var o = a.stateNode;
						r === null ? r = [o] : r.push(o);
					}
					if (jl(a)) break;
					a = a.return;
				}
				var s = r;
				if (n == null) throw Error(i(160));
				switch (n.tag) {
					case 27:
						var c = n.stateNode;
						Rl(e, Il(e), c, s);
						break;
					case 5:
						var l = n.stateNode;
						n.flags & 32 && (vn(l, ""), n.flags &= -33), Rl(e, Il(e), l, s);
						break;
					case 3:
					case 4:
						var u = n.stateNode.containerInfo;
						Ll(e, Il(e), u, s);
						break;
					default: throw Error(i(161));
				}
			} catch (t) {
				X(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function Nu(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			Nu(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, gh = !0, t.reset(), gh = !1), e = e.sibling;
		}
	}
	function Pu(e, t) {
		if (t.subtreeFlags & 9270) for (t = t.child; t !== null;) Fu(t, e), t = t.sibling;
		else iu(t, !1);
	}
	function Fu(e, t) {
		var n = e.alternate;
		if (n === null) Xl(e, !1);
		else switch (e.tag) {
			case 3:
				if (pu = uu = !1, Wl(), Pu(t, e), !uu && !fu) {
					if (e = Ul, e !== null) for (var r = 0; r < e.length; r += 3) {
						n = e[r];
						var i = e[r + 1];
						Dp(n, e[r + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate({
							opacity: [0, 0],
							pointerEvents: ["none", "none"]
						}, {
							duration: 0,
							fill: "forwards",
							pseudoElement: "::view-transition-group(" + i + ")"
						});
					}
					e = t.containerInfo, e = e.nodeType === 9 ? e.documentElement : e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "" && (e.style.viewTransitionName = "none", e.animate({
						opacity: [0, 0],
						pointerEvents: ["none", "none"]
					}, {
						duration: 0,
						fill: "forwards",
						pseudoElement: "::view-transition-group(root)"
					}), e.animate({
						width: [0, 0],
						height: [0, 0]
					}, {
						duration: 0,
						fill: "forwards",
						pseudoElement: "::view-transition"
					})), pu = !0;
				}
				Ul = null;
				break;
			case 5:
				Pu(t, e);
				break;
			case 4:
				r = uu, uu = !1, Pu(t, e), uu && (fu = !0), uu = r;
				break;
			case 22:
				e.memoizedState === null && (n.memoizedState === null ? Pu(t, e) : Xl(e, !1));
				break;
			case 30:
				r = uu, i = Wl(), uu = !1, Pu(t, e), uu && (e.flags |= 4);
				var a = e.memoizedProps, o = e.stateNode;
				t = Ti(a, o), o = Ti(n.memoizedProps, o);
				var s = Di(a.default, a.update);
				s === "none" ? t = !1 : (a = n.memoizedState, n.memoizedState = null, n = e.child, Gl = 0, t = ru(e, n, t, o, s, a, !0), Gl !== (a === null ? 0 : a.length) && (e.flags |= 32)), e.flags & 4 && t ? (Pd(e, e.memoizedProps.onUpdate), Ul = i) : i !== null && (i.push.apply(i, Ul), Ul = i), uu = e.flags & 32 ? !0 : r;
				break;
			default: Pu(t, e);
		}
	}
	function Iu(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) gu(e, t.alternate, t), t = t.sibling;
	}
	function Lu(e, t) {
		for (e = e.child; e !== null;) {
			var n = e, r = t;
			switch (n.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					Cl(4, n, n.return), Lu(n, r);
					break;
				case 1:
					Dl(n, n.return);
					var i = n.stateNode;
					typeof i.componentWillUnmount == "function" && Tl(n, n.return, i), Lu(n, r);
					break;
				case 27: r & 2 && gm(n.stateNode, n.type, n.memoizedProps);
				case 5:
					Dl(n, n.return), n.tag !== 5 && n.tag !== 27 || Al(n), Lu(n, r);
					break;
				case 6:
					Al(n);
					break;
				case 26:
					Dl(n, n.return), i = n.stateNode, n.memoizedState !== null || i === null || W || i.parentNode.removeChild(i), Lu(n, r);
					break;
				case 22:
					n.memoizedState === null && Lu(n, r);
					break;
				case 30:
					Dl(n, n.return), Lu(n, r);
					break;
				case 7: Dl(n, n.return);
				default: Lu(n, r);
			}
			e = e.sibling;
		}
	}
	function Ru(e, t, n) {
		for (n = t.subtreeFlags & 8772 ? n : n & -2, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags, s = !!(n & 1);
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					Ru(i, a, n), Sl(4, a);
					break;
				case 1:
					if (Ru(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						X(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var c = r.stateNode;
						try {
							var l = i.shared.hiddenCallbacks;
							if (l !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < l.length; i++) Eo(l[i], c);
						} catch (e) {
							X(r, r.return, e);
						}
					}
					s && o & 64 && wl(a), El(a, a.return);
					break;
				case 27: n & 2 && zl(a);
				case 5:
					a.tag !== 5 && a.tag !== 27 || kl(a), Ru(i, a, n), s && r === null && o & 4 && Nl(a), El(a, a.return);
					break;
				case 6:
					kl(a);
					break;
				case 26:
					c = a.stateNode, a.memoizedState !== null || c === null || au || Km(bm(c.ownerDocument), a.type, c), Ru(i, a, n), s && r === null && o & 4 && Nl(a), El(a, a.return);
					break;
				case 12:
					Ru(i, a, n);
					break;
				case 31:
					Ru(i, a, n), s && o & 4 && Tu(i, a);
					break;
				case 13:
					Ru(i, a, n), s && o & 4 && Eu(i, a);
					break;
				case 22:
					a.memoizedState === null && Ru(i, a, n), El(a, a.return);
					break;
				case 30:
					Ru(i, a, n), El(a, a.return);
					break;
				case 7: El(a, a.return);
				default: Ru(i, a, n);
			}
			t = t.sibling;
		}
	}
	function zu(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && Ia(n));
	}
	function Bu(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && Ia(e));
	}
	function Vu(e, t, n, r) {
		var i = (n & 335544064) === n;
		if (t.subtreeFlags & (i ? 10262 : 10256)) for (t = t.child; t !== null;) Hu(e, t, n, r), t = t.sibling;
		else i && nu(t);
	}
	function Hu(e, t, n, r) {
		var i = (n & 335544064) === n;
		i && t.alternate === null && t.return !== null && t.return.alternate !== null && tu(t);
		var a = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				Vu(e, t, n, r), a & 2048 && Sl(9, t);
				break;
			case 1:
				Vu(e, t, n, r);
				break;
			case 3:
				Vu(e, t, n, r), i && pu && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), a & 2048 && (a = null, t.alternate !== null && (a = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== a && (t.refCount++, a != null && Ia(a)));
				break;
			case 12:
				if (a & 2048) {
					Vu(e, t, n, r), a = t.stateNode;
					try {
						var o = t.memoizedProps, s = o.id, c = o.onPostCommit;
						typeof c == "function" && c(s, t.alternate === null ? "mount" : "update", a.passiveEffectDuration, -0);
					} catch (e) {
						X(t, t.return, e);
					}
				} else Vu(e, t, n, r);
				break;
			case 31:
				Vu(e, t, n, r);
				break;
			case 13:
				Vu(e, t, n, r);
				break;
			case 23: break;
			case 22:
				o = t.stateNode, s = t.alternate, t.memoizedState === null ? (i && s !== null && s.memoizedState !== null && tu(t), o._visibility & 2 ? Vu(e, t, n, r) : (o._visibility |= 2, Uu(e, t, n, r, !!(t.subtreeFlags & 10256) || !1))) : (i && s !== null && s.memoizedState === null && tu(s), o._visibility & 2 ? Vu(e, t, n, r) : Wu(e, t)), a & 2048 && zu(s, t);
				break;
			case 24:
				Vu(e, t, n, r), a & 2048 && Bu(t.alternate, t);
				break;
			case 30:
				i && (a = t.alternate, a !== null && (Jl(a.child, !0), Jl(t.child, !0))), Vu(e, t, n, r);
				break;
			default: Vu(e, t, n, r);
		}
	}
	function Uu(e, t, n, r, i) {
		for (i &&= !!(t.subtreeFlags & 10256) || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					Uu(a, o, s, c, i), Sl(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, Uu(a, o, s, c, i)) : u._visibility & 2 ? Uu(a, o, s, c, i) : Wu(a, o), i && l & 2048 && zu(o.alternate, o);
					break;
				case 24:
					Uu(a, o, s, c, i), i && l & 2048 && Bu(o.alternate, o);
					break;
				default: Uu(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function Wu(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					Wu(n, r), i & 2048 && zu(r.alternate, r);
					break;
				case 24:
					Wu(n, r), i & 2048 && Bu(r.alternate, r);
					break;
				default: Wu(n, r);
			}
			t = t.sibling;
		}
	}
	var Gu = 8192;
	function Ku(e, t, n) {
		if (e.subtreeFlags & Gu) for (e = e.child; e !== null;) qu(e, t, n), e = e.sibling;
	}
	function qu(e, t, n) {
		switch (e.tag) {
			case 26:
				Ku(e, t, n), e.flags & Gu && (e.memoizedState === null ? (e = e.stateNode, (t & 335544128) === t && Zm(n, e)) : Qm(n, Au, e.memoizedState, e.memoizedProps));
				break;
			case 5:
				Ku(e, t, n), e.flags & Gu && (e = e.stateNode, (t & 335544128) === t && Zm(n, e));
				break;
			case 3:
			case 4:
				var r = Au;
				Au = bm(e.stateNode.containerInfo), Ku(e, t, n), Au = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = Gu, Gu = 16777216, Ku(e, t, n), Gu = r) : Ku(e, t, n));
				break;
			case 30:
				if ((e.flags & Gu) !== 0 && (r = e.memoizedProps.name, r != null && r !== "auto")) {
					var i = e.stateNode;
					i.paired = null, Vl === null && (Vl = /* @__PURE__ */ new Map()), Vl.set(r, i);
				}
				Ku(e, t, n);
				break;
			default: Ku(e, t, n);
		}
	}
	function Ju(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function Yu(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				lu = r, Qu(r, e);
			}
			Ju(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) Xu(e), e = e.sibling;
	}
	function Xu(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				Yu(e), e.flags & 2048 && Cl(9, e, e.return);
				break;
			case 3:
				Yu(e);
				break;
			case 12:
				Yu(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Zu(e)) : Yu(e);
				break;
			default: Yu(e);
		}
	}
	function Zu(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				lu = r, Qu(r, e);
			}
			Ju(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					Cl(8, t, t.return), Zu(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, Zu(t));
					break;
				default: Zu(t);
			}
			e = e.sibling;
		}
	}
	function Qu(e, t) {
		for (; lu !== null;) {
			var n = lu;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					Cl(8, n, t);
					break;
				case 23:
				case 22:
					if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
						var r = n.memoizedState.cachePool.pool;
						r != null && r.refCount++;
					}
					break;
				case 24: Ia(n.memoizedState.cache);
			}
			if (r = n.child, r !== null) r.return = n, lu = r;
			else a: for (n = e; lu !== null;) {
				r = lu;
				var i = r.sibling, a = r.return;
				if (bu(r), r === n) {
					lu = null;
					break a;
				}
				if (i !== null) {
					i.return = a, lu = i;
					break a;
				}
				lu = a;
			}
		}
	}
	var $u = {
		getCacheForType: function(e) {
			var t = Aa(L), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return Aa(L).controller.signal;
		}
	}, ed = typeof WeakMap == "function" ? WeakMap : Map, G = 0, K = null, q = null, J = 0, Y = 0, td = null, nd = !1, rd = !1, id = !1, ad = 0, od = 0, sd = 0, cd = 0, ld = 0, ud = 0, dd = 0, fd = null, pd = null, md = !1, hd = 0, gd = 0, _d = Infinity, vd = null, yd = null, bd = 0, xd = null, Sd = null, Cd = 0, wd = 0, Td = null, Ed = null, Dd = null, Od = null, kd = null, Ad = 0, jd = null;
	function Md() {
		return G & 2 && J !== 0 ? J & -J : O.T === null ? Dt() : Ff();
	}
	function Nd() {
		if (ud === 0) {
			if (!(J & 536870912) || F) {
				var e = dt;
				dt <<= 1, !(dt & 3932160) && (dt = 262144), ud = e;
			} else ud = 536870912;
		}
		return e = z.current, e !== null && (e.flags |= 32), ud;
	}
	function Pd(e, t) {
		if (t != null) {
			var n = e.stateNode, r = n.ref;
			r === null && (r = n.ref = Pp(Ti(e.memoizedProps, n))), Od === null && (Od = []), Od.push(t.bind(null, r));
		}
	}
	function Fd(e, t, n) {
		(e === K && (Y === 2 || Y === 9) || e.cancelPendingCommit !== null) && (Hd(e, 0), zd(e, J, ud, !1)), bt(e, n), (!(G & 2) || e !== K) && (e === K && (!(G & 2) && (cd |= n), od === 4 && zd(e, J, ud, !1)), Df(e));
	}
	function Id(e, t, n) {
		if (G & 6) throw Error(i(327));
		var r = !n && !(t & 127) && (t & e.expiredLanes) === 0 || ht(e, t), a = r ? Xd(e, t) : Jd(e, t, !0), o = r;
		do {
			if (a === 0) {
				rd && !r && zd(e, t, 0, !1);
				break;
			}
			if (n = e.current.alternate, o && !Rd(n)) {
				a = Jd(e, t, !1), o = !1;
				continue;
			}
			if (a === 2) {
				if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
				else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
				if (s !== 0) {
					t = s;
					a: {
						var c = e;
						a = fd;
						var l = c.current.memoizedState.isDehydrated;
						if (l && (Hd(c, s).flags |= 256), s = Jd(c, s, !1), s !== 2 && s !== 6) {
							if (id && !l) {
								c.errorRecoveryDisabledLanes |= o, cd |= o, a = 4;
								break a;
							}
							o = pd, pd = a, o !== null && (pd === null ? pd = o : pd.push.apply(pd, o));
						}
						a = s;
					}
					if (o = !1, a !== 2) continue;
				}
			}
			if (a === 1) {
				Hd(e, 0), zd(e, t, 0, !0);
				break;
			}
			a: {
				switch (r = e, o = a, o) {
					case 0:
					case 1: throw Error(i(345));
					case 4: if ((t & 4194048) !== t && (t & 62914560) !== t) break;
					case 6:
						zd(r, t, ud, !nd);
						break a;
					case 2:
						pd = null;
						break;
					case 3:
					case 5: break;
					default: throw Error(i(329));
				}
				if ((t & 62914560) === t && (a = hd + 300 - Je(), 10 < a)) {
					if (zd(r, t, ud, !nd), mt(r, 0, !0) !== 0) break a;
					Cd = t, r.timeoutHandle = _p(Ld.bind(null, r, n, pd, vd, md, t, ud, cd, dd, nd, o, "Throttled", -0, 0), a);
					break a;
				}
				Ld(r, n, pd, vd, md, t, ud, cd, dd, nd, o, null, -0, 0);
			}
			break;
		} while (1);
		Df(e);
	}
	function Ld(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
		e.timeoutHandle = -1;
		var m = t.subtreeFlags, h = (a & 335544064) === a;
		if (d = null, (h || m & 8192 || (m & 16785408) == 16785408) && (d = {
			stylesheets: null,
			count: 0,
			imgCount: 0,
			imgBytes: 0,
			suspenseyImages: [],
			waitingForImages: !0,
			waitingForViewTransition: !1,
			unsuspend: En
		}, Vl = null, qu(t, a, d), h && (m = d, h = e.containerInfo, h = (h.nodeType === 9 ? h : h.ownerDocument).__reactViewTransition, h != null && (m.count++, m.waitingForViewTransition = !0, m = nh.bind(m), h.finished.then(m, m))), m = (a & 62914560) === a ? hd - Je() : (a & 4194048) === a ? gd - Je() : 0, m = eh(d, m), m !== null)) {
			Cd = a, e.cancelPendingCommit = m(rf.bind(null, e, t, a, n, r, i, o, s, c, l, u, d, null, f, p)), zd(e, a, o, !l);
			return;
		}
		rf(e, t, a, n, r, i, o, s, c, l, u, d);
	}
	function Rd(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!Yr(a(), i)) return !1;
				} catch {
					return !1;
				}
			}
			if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
			else {
				if (t === e) break;
				for (; t.sibling === null;) {
					if (t.return === null || t.return === e) return !0;
					t = t.return;
				}
				t.sibling.return = t.return, t = t.sibling;
			}
		}
		return !0;
	}
	function zd(e, t, n, r) {
		t = gt(e, t), t &= ~ld, t &= ~cd, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - ot(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && St(e, n, t);
	}
	function Bd() {
		return G & 6 ? !0 : (Of(0, !1), !1);
	}
	function Vd() {
		if (q !== null) {
			if (Y === 0) var e = q.return;
			else e = q, Sa = xa = null, as(e), co = null, R = 0, e = q;
			for (; e !== null;) xl(e.alternate, e), e = e.return;
			q = null;
		}
	}
	function Hd(e, t) {
		var n = e.timeoutHandle;
		return n !== -1 && (e.timeoutHandle = -1, vp(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), Cd = 0, Vd(), K = e, q = n = Vi(e.current, null), J = t, Y = 0, td = null, nd = !1, rd = ht(e, t), id = !1, dd = ud = ld = cd = sd = od = 0, pd = fd = null, md = !1, ad = gt(e, t), Mi(), n;
	}
	function Ud(e, t) {
		V = null, O.H = hc, t === Qa || t === eo ? (t = oo(), Y = 3) : t === $a ? (t = oo(), Y = 4) : Y = t === Nc ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, td = t, q === null && (od = 1, Dc(e, Yi(t, e.current)));
	}
	function Wd() {
		var e = z.current;
		return e === null ? !0 : (J & 4194048) === J ? No === null : (J & 62914560) === J || J & 536870912 ? e === No : !1;
	}
	function Gd() {
		var e = O.H;
		return O.H = hc, e === null ? hc : e;
	}
	function Kd() {
		var e = O.A;
		return O.A = $u, e;
	}
	function qd() {
		od = 4, nd || (J & 4194048) !== J && z.current !== null || (rd = !0), !(sd & 134217727) && !(cd & 134217727) || K === null || zd(K, J, ud, !1);
	}
	function Jd(e, t, n) {
		var r = G;
		G |= 2;
		var i = Gd(), a = Kd();
		(K !== e || J !== t) && (vd = null, Hd(e, t)), t = !1;
		var o = od;
		a: do
			try {
				if (Y !== 0 && q !== null) {
					var s = q, c = td;
					switch (Y) {
						case 8:
							Vd(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							z.current === null && (t = !0);
							var l = Y;
							if (Y = 0, td = null, ef(e, s, c, l), n && rd) {
								o = 0;
								break a;
							}
							break;
						default: l = Y, Y = 0, td = null, ef(e, s, c, l);
					}
				}
				Yd(), o = od;
				break;
			} catch (t) {
				Ud(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, Sa = xa = null, G = r, O.H = i, O.A = a, q === null && (K = null, J = 0, Mi()), o;
	}
	function Yd() {
		for (; q !== null;) Qd(q);
	}
	function Xd(e, t) {
		var n = G;
		G |= 2;
		var r = Gd(), a = Kd();
		K !== e || J !== t ? (vd = null, _d = Je() + 500, Hd(e, t)) : rd = ht(e, t);
		a: do
			try {
				if (Y !== 0 && q !== null) {
					t = q;
					var o = td;
					b: switch (Y) {
						case 1:
							Y = 0, td = null, ef(e, t, o, 1);
							break;
						case 2:
						case 9:
							if (no(o)) {
								Y = 0, td = null, $d(t);
								break;
							}
							t = function() {
								Y !== 2 && Y !== 9 || K !== e || (Y = 7), Df(e);
							}, o.then(t, t);
							break a;
						case 3:
							Y = 7;
							break a;
						case 4:
							Y = 5;
							break a;
						case 7:
							no(o) ? (Y = 0, td = null, $d(t)) : (Y = 0, td = null, ef(e, t, o, 7));
							break;
						case 5:
							var s = null;
							switch (q.tag) {
								case 26: s = q.memoizedState;
								case 5:
								case 27:
									var c = q;
									if (s ? Ym(s) : c.stateNode.complete) {
										Y = 0, td = null;
										var l = c.sibling;
										if (l !== null) q = l;
										else {
											var u = c.return;
											u === null ? q = null : (q = u, tf(u));
										}
										break b;
									}
							}
							Y = 0, td = null, ef(e, t, o, 5);
							break;
						case 6:
							Y = 0, td = null, ef(e, t, o, 6);
							break;
						case 8:
							Vd(), od = 6;
							break a;
						default: throw Error(i(462));
					}
				}
				Zd();
				break;
			} catch (t) {
				Ud(e, t);
			}
		while (1);
		return Sa = xa = null, O.H = r, O.A = a, G = n, q === null ? (K = null, J = 0, Mi(), od) : 0;
	}
	function Zd() {
		for (; q !== null && !Ke();) Qd(q);
	}
	function Qd(e) {
		var t = pl(e.alternate, e, ad);
		e.memoizedProps = e.pendingProps, t === null ? tf(e) : q = t;
	}
	function $d(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = qc(n, t, t.pendingProps, t.type, void 0, J);
				break;
			case 11:
				t = qc(n, t, t.pendingProps, t.type.render, t.ref, J);
				break;
			case 5:
				as(t);
				var r = t;
				r === N && (F ? (ha(r), r.tag === 5 && r.stateNode != null && (P = r.stateNode)) : (ha(r), F = !0));
			default: xl(n, t), t = q = Hi(t, ad), t = pl(n, t, ad);
		}
		e.memoizedProps = e.pendingProps, t === null ? tf(e) : q = t;
	}
	function ef(e, t, n, r) {
		Sa = xa = null, as(t), co = null, R = 0;
		var i = t.return;
		try {
			if (Mc(e, i, t, n, J)) {
				od = 1, Dc(e, Yi(n, e.current)), q = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw q = i, t;
			od = 1, Dc(e, Yi(n, e.current)), q = null;
			return;
		}
		t.flags & 32768 ? (F || r === 1 ? e = !0 : rd || J & 536870912 ? e = !1 : (nd = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = z.current, r !== null && r.tag === 13 && (r.flags |= 16384))), nf(t, e)) : tf(t);
	}
	function tf(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				nf(t, nd);
				return;
			}
			e = t.return;
			var n = yl(t.alternate, t, ad);
			if (n !== null) {
				q = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				q = t;
				return;
			}
			q = t = e;
		} while (t !== null);
		od === 0 && (od = 5);
	}
	function nf(e, t) {
		do {
			var n = bl(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, q = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				q = e;
				return;
			}
			q = e = n;
		} while (e !== null);
		od = 6, q = null;
	}
	function rf(e, t, n, r, a, o, s, c, l, u, d, f) {
		e.cancelPendingCommit = null;
		do
			ff();
		while (bd !== 0);
		if (G & 6) throw Error(i(327));
		if (t !== null) {
			if (t === e.current) throw Error(i(177));
			e === K && (q = K = null, J = 0), Sd = t, xd = e, Cd = n, Td = a, Ed = r, af(e, t, n, s, c, l, f);
		}
	}
	function af(e, t, n, r, i, a, o) {
		var s = t.lanes | t.childLanes;
		if (wd = s, s |= ji, xt(e, n, s, r, i, a), Od = null, (n & 335544064) === n ? (kd = za(e), r = 10262) : (kd = null, r = 10256), (t.subtreeFlags & r) !== 0 || (t.flags & r) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, bf(Qe, function() {
			return pf(), null;
		})) : (e.callbackNode = null, e.callbackPriority = 0), Bl = !1, r = !!(t.flags & 13878), t.subtreeFlags & 13878 || r) {
			r = O.T, O.T = null, i = k.p, k.p = 2, a = G, G |= 4;
			try {
				mu(e, t, n);
			} finally {
				G = a, k.p = i, O.T = r;
			}
		}
		bd = 1, Bl ? Dd = Mp(o, e.containerInfo, kd, cf, lf, sf, uf, pf, of, null, null) : (cf(), lf(), uf());
	}
	function of(e) {
		if (bd !== 0) {
			var t = xd.onRecoverableError;
			t(e, { componentStack: null });
		}
	}
	function sf() {
		bd === 3 && (bd = 0, Fu(Sd, xd), bd = 4);
	}
	function cf() {
		if (bd === 1) {
			bd = 0;
			var e = xd, t = Sd, n = Cd, r = !!(t.flags & 13878);
			if (t.subtreeFlags & 13878 || r) {
				r = O.T, O.T = null;
				var i = k.p;
				k.p = 2;
				var a = G;
				G |= 4;
				try {
					du = fu = !1, ju(t, e, n), n = lp;
					var o = ti(e.containerInfo), s = n.focusedElem, c = n.selectionRange;
					if (o !== s && s && s.ownerDocument && ei(s.ownerDocument.documentElement, s)) {
						if (c !== null && ni(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = $r(s, h), v = $r(s, g);
									if (_ && v && (p.rangeCount !== 1 || p.anchorNode !== _.node || p.anchorOffset !== _.offset || p.focusNode !== v.node || p.focusOffset !== v.offset)) {
										var y = d.createRange();
										y.setStart(_.node, _.offset), p.removeAllRanges(), h > g ? (p.addRange(y), p.extend(v.node, v.offset)) : (y.setEnd(v.node, v.offset), p.addRange(y));
									}
								}
							}
						}
						for (d = [], p = s; p = p.parentNode;) p.nodeType === 1 && d.push({
							element: p,
							left: p.scrollLeft,
							top: p.scrollTop
						});
						for (typeof s.focus == "function" && s.focus(), s = 0; s < d.length; s++) {
							var b = d[s];
							b.element.scrollLeft = b.left, b.element.scrollTop = b.top;
						}
					}
					gh = !!cp, lp = cp = null;
				} finally {
					G = a, k.p = i, O.T = r;
				}
			}
			e.current = t, bd = 2;
		}
	}
	function lf() {
		if (bd === 2) {
			bd = 0;
			var e = xd, t = Sd, n = !!(t.flags & 8772);
			if (t.subtreeFlags & 8772 || n) {
				n = O.T, O.T = null;
				var r = k.p;
				k.p = 2;
				var i = G;
				G |= 4;
				try {
					gu(e, t.alternate, t);
				} finally {
					G = i, k.p = r, O.T = n;
				}
			}
			bd = 3;
		}
	}
	function uf() {
		if (bd === 4 || bd === 3) {
			bd = 0;
			var e = Dd;
			Dd = null, qe();
			var t = xd, n = Sd, r = Cd, i = Ed, a = (r & 335544064) === r ? 10262 : 10256;
			if ((n.subtreeFlags & a) !== 0 || (n.flags & a) !== 0 ? bd = 5 : (bd = 0, Sd = xd = null, df(t, t.pendingLanes)), a = t.pendingLanes, a === 0 && (yd = null), Et(r), n = n.stateNode, it && typeof it.onCommitFiberRoot == "function") try {
				it.onCommitFiberRoot(rt, n, void 0, (n.current.flags & 128) == 128);
			} catch {}
			if (i !== null) {
				n = O.T, a = k.p, k.p = 2, O.T = null;
				try {
					for (var o = t.onRecoverableError, s = 0; s < i.length; s++) {
						var c = i[s];
						o(c.value, { componentStack: c.stack });
					}
				} finally {
					O.T = n, k.p = a;
				}
			}
			if (i = Od, o = kd, kd = null, i !== null && (Od = null, o === null && (o = []), e !== null)) for (c = 0; c < i.length; c++) n = (0, i[c])(o), n !== void 0 && e.finished.finally(n);
			Cd & 3 && ff(), Df(t), a = t.pendingLanes, r & 261930 && a & 42 ? t === jd ? Ad++ : (Ad = 0, jd = t) : (Ad = 0, jd = null), Of(0, !1);
		}
	}
	function df(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Ia(t)));
	}
	function ff() {
		return Dd !== null && (Dd.skipTransition(), Dd = null), cf(), lf(), uf(), pf();
	}
	function pf() {
		if (bd !== 5) return !1;
		var e = xd, t = wd;
		wd = 0;
		var n = Et(Cd), r = O.T, a = k.p;
		try {
			k.p = 32 > n ? 32 : n, O.T = null, n = Td, Td = null;
			var o = xd, s = Cd;
			if (bd = 0, Sd = xd = null, Cd = 0, G & 6) throw Error(i(331));
			var c = G;
			if (G |= 4, Xu(o.current), Hu(o, o.current, s, n), G = c, Of(0, !1), it && typeof it.onPostCommitFiberRoot == "function") try {
				it.onPostCommitFiberRoot(rt, o);
			} catch {}
			return !0;
		} finally {
			k.p = a, O.T = r, df(e, t);
		}
	}
	function mf(e, t, n) {
		t = Yi(n, t), t = kc(e.stateNode, t, 2), e = bo(e, t, 2), e !== null && (bt(e, 2), Df(e));
	}
	function X(e, t, n) {
		if (e.tag === 3) mf(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				mf(t, e, n);
				break;
			}
			if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (yd === null || !yd.has(r))) {
					e = Yi(n, e), n = Ac(2), r = bo(t, n, 2), r !== null && (jc(n, r, t, e), bt(r, 2), Df(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function hf(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new ed();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (id = !0, i.add(n), e = gf.bind(null, e, t, n), t.then(e, e));
	}
	function gf(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, K === e && (J & n) === n && (od === 4 || od === 3 && (J & 62914560) === J && 300 > Je() - hd ? G & 2 ? ld |= n : Hd(e, 0) : ld |= n, dd === J && (dd = 0)), Df(e);
	}
	function _f(e, t) {
		t === 0 && (t = vt()), e = Fi(e, t), e !== null && (bt(e, t), Df(e));
	}
	function vf(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), _f(e, n);
	}
	function yf(e, t) {
		var n = 0;
		switch (e.tag) {
			case 31:
			case 13:
				var r = e.stateNode, a = e.memoizedState;
				a !== null && (n = a.retryLane);
				break;
			case 19:
				r = e.stateNode;
				break;
			case 22:
				r = e.stateNode._retryCache;
				break;
			default: throw Error(i(314));
		}
		r !== null && r.delete(t), _f(e, n);
	}
	function bf(e, t) {
		return We(e, t);
	}
	var xf = null, Sf = null, Cf = !1, wf = !1, Tf = !1, Ef = 0;
	function Df(e) {
		e !== Sf && e.next === null && (Sf === null ? xf = Sf = e : Sf = Sf.next = e), wf = !0, Cf || (Cf = !0, Pf());
	}
	function Of(e, t) {
		if (!Tf && wf) {
			Tf = !0;
			do
				for (var n = !1, r = xf; r !== null;) {
					if (!t) {
						if (e !== 0) {
							var i = r.pendingLanes;
							if (i === 0) var a = 0;
							else {
								var o = r.suspendedLanes, s = r.pingedLanes;
								a = (1 << 31 - ot(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
							}
							a !== 0 && (n = !0, Nf(r, a));
						} else a = J, a = mt(r, r === K ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || ht(r, a) || (n = !0, Nf(r, a));
					}
					r = r.next;
				}
			while (n);
			Tf = !1;
		}
	}
	function kf() {
		Af();
	}
	function Af() {
		wf = Cf = !1;
		var e = 0;
		Ef !== 0 && gp() && (e = Ef);
		for (var t = Je(), n = null, r = xf; r !== null;) {
			var i = r.next, a = jf(r, t);
			a === 0 ? (r.next = null, n === null ? xf = i : n.next = i, i === null && (Sf = n)) : (n = r, (e !== 0 || a & 3) && (wf = !0)), r = i;
		}
		bd !== 0 && bd !== 5 || Of(e, !1), Ef !== 0 && (Ef = 0);
	}
	function jf(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - ot(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = _t(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = K, n = J, n = mt(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (Y === 2 || Y === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && Ge(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || ht(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && Ge(r), Et(n)) {
				case 2:
				case 8:
					n = Ze;
					break;
				case 32:
					n = Qe;
					break;
				case 268435456:
					n = et;
					break;
				default: n = Qe;
			}
			return r = Mf.bind(null, e), n = We(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && Ge(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function Mf(e, t) {
		if (bd !== 0 && bd !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (ff() && e.callbackNode !== n) return null;
		var r = J;
		return r = mt(e, e === K ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (Id(e, r, t), jf(e, Je()), e.callbackNode != null && e.callbackNode === n ? Mf.bind(null, e) : null);
	}
	function Nf(e, t) {
		if (ff()) return null;
		Id(e, t, !0);
	}
	function Pf() {
		xp(function() {
			G & 6 ? We(Xe, kf) : Af();
		});
	}
	function Ff() {
		if (Ef === 0) {
			var e = Ha;
			e === 0 && (e = ut, ut <<= 1, !(ut & 261888) && (ut = 256)), Ef = e;
		}
		return Ef;
	}
	function If(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : Tn(e);
	}
	function Lf(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = If((i[jt] || null).action), o = r.submitter;
			o && (t = (t = o[jt] || null) ? If(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new qn("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (Ef !== 0) {
								var e = new FormData(i, o);
								tc(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = new FormData(i, o), tc(n, {
							pending: !0,
							data: e,
							method: i.method,
							action: a
						}, a, e));
					},
					currentTarget: i
				}]
			});
		}
	}
	for (var Rf = 0; Rf < Si.length; Rf++) {
		var zf = Si[Rf];
		Ci(zf.toLowerCase(), "on" + (zf[0].toUpperCase() + zf.slice(1)));
	}
	Ci(mi, "onAnimationEnd"), Ci(hi, "onAnimationIteration"), Ci(gi, "onAnimationStart"), Ci("dblclick", "onDoubleClick"), Ci("focusin", "onFocus"), Ci("focusout", "onBlur"), Ci(_i, "onTransitionRun"), Ci(vi, "onTransitionStart"), Ci(yi, "onTransitionCancel"), Ci(bi, "onTransitionEnd"), Yt("onMouseEnter", ["mouseout", "mouseover"]), Yt("onMouseLeave", ["mouseout", "mouseover"]), Yt("onPointerEnter", ["pointerout", "pointerover"]), Yt("onPointerLeave", ["pointerout", "pointerover"]), Jt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), Jt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), Jt("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), Jt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), Jt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), Jt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var Bf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), Vf = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Bf));
	function Hf(e, t) {
		t = !!(t & 4);
		for (var n = 0; n < e.length; n++) {
			var r = e[n], i = r.event;
			r = r.listeners;
			a: {
				var a = void 0;
				if (t) for (var o = r.length - 1; 0 <= o; o--) {
					var s = r[o], c = s.instance, l = s.currentTarget;
					if (s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Oi(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Oi(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function Z(e, t) {
		var n = t[Nt];
		n === void 0 && (n = t[Nt] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (Kf(t, e, 2, !1), n.add(r));
	}
	function Uf(e, t, n) {
		var r = 0;
		t && (r |= 4), Kf(n, e, r, t);
	}
	var Wf = "_reactListening" + Math.random().toString(36).slice(2);
	function Gf(e) {
		if (!e[Wf]) {
			e[Wf] = !0, Kt.forEach(function(t) {
				t !== "selectionchange" && (Vf.has(t) || Uf(t, !1, e), Uf(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[Wf] || (t[Wf] = !0, Uf("selectionchange", !1, t));
		}
	}
	function Kf(e, t, n, r) {
		switch (Ch(t)) {
			case 2:
				var i = _h;
				break;
			case 8:
				i = vh;
				break;
			default: i = yh;
		}
		n = i.bind(null, t, n, e), i = void 0, !In || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function qf(e, t, n, r, i) {
		var a = r;
		if (!(t & 1) && !(t & 2) && r !== null) a: for (;;) {
			if (r === null) return;
			var s = r.tag;
			if (s === 3 || s === 4) {
				var c = r.stateNode.containerInfo;
				if (c === i) break;
				if (s === 4) for (s = r.return; s !== null;) {
					var l = s.tag;
					if ((l === 3 || l === 4) && s.stateNode.containerInfo === i) return;
					s = s.return;
				}
				for (; c !== null;) {
					if (s = Bt(c), s === null) return;
					if (l = s.tag, l === 5 || l === 6 || l === 26 || l === 27) {
						r = a = s;
						continue a;
					}
					c = c.parentNode;
				}
			}
			r = r.return;
		}
		Nn(function() {
			var r = a, i = On(n), s = [];
			a: {
				var c = xi.get(e);
				if (c !== void 0) {
					var l = qn, u = e;
					switch (e) {
						case "keypress": if (Hn(n) === 0) break a;
						case "keydown":
						case "keyup":
							l = dr;
							break;
						case "focusin":
							u = "focus", l = nr;
							break;
						case "focusout":
							u = "blur", l = nr;
							break;
						case "beforeblur":
						case "afterblur":
							l = nr;
							break;
						case "click": if (n.button === 2) break a;
						case "auxclick":
						case "dblclick":
						case "mousedown":
						case "mousemove":
						case "mouseup":
						case "mouseout":
						case "mouseover":
						case "contextmenu":
							l = er;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							l = tr;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							l = mr;
							break;
						case mi:
						case hi:
						case gi:
							l = rr;
							break;
						case bi:
							l = hr;
							break;
						case "scroll":
						case "scrollend":
							l = Yn;
							break;
						case "wheel":
							l = gr;
							break;
						case "copy":
						case "cut":
						case "paste":
							l = ir;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							l = fr;
							break;
						case "submit":
							l = pr;
							break;
						case "toggle":
						case "beforetoggle": l = _r;
					}
					var d = !!(t & 4), f = !d && (e === "scroll" || e === "scrollend"), p = d ? c === null ? null : c + "Capture" : c;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = Pn(m, p), g != null && d.push(Jf(m, g, h))), f) break;
						m = m.return;
					}
					0 < d.length && (c = new l(c, u, null, n, i), s.push({
						event: c,
						listeners: d
					}));
				}
			}
			if (!(t & 7)) {
				a: {
					if (l = e === "mouseover" || e === "pointerover", c = e === "mouseout" || e === "pointerout", l && n !== Dn && (u = n.relatedTarget || n.fromElement) && (Bt(u) || u[Mt])) break a;
					(c || l) && (u = i.window === i ? i : (l = i.ownerDocument) ? l.defaultView || l.parentWindow : window, c ? (l = n.relatedTarget || n.toElement, c = r, l = l ? Bt(l) : null, l !== null && (f = o(l), d = l.tag, l !== f || d !== 5 && d !== 27 && d !== 6) && (l = null)) : (c = null, l = r), c !== l && (d = er, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = fr, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = c == null ? u : Ht(c), h = l == null ? u : Ht(l), u = new d(g, m + "leave", c, n, i), u.target = f, u.relatedTarget = h, g = null, Bt(i) === r && (d = new d(p, m + "enter", l, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, d = c && l ? E(c, l, Xf) : null, c !== null && Zf(s, u, c, d, !1), l !== null && f !== null && Zf(s, f, l, d, !0)));
				}
				a: {
					if (c = r ? Ht(r) : window, l = c.nodeName && c.nodeName.toLowerCase(), l === "select" || l === "input" && c.type === "file") var _ = Lr;
					else if (jr(c)) {
						if (Rr) _ = qr;
						else {
							_ = Gr;
							var v = Wr;
						}
					} else l = c.nodeName, !l || l.toLowerCase() !== "input" || c.type !== "checkbox" && c.type !== "radio" ? r && Sn(r.elementType) && (_ = Lr) : _ = Kr;
					if (_ &&= _(e, r)) {
						Mr(s, _, n, i);
						break a;
					}
					v && v(e, c, r);
				}
				switch (v = r ? Ht(r) : window, e) {
					case "focusin":
						(jr(v) || v.contentEditable === "true") && (ii = v, ai = r, oi = null);
						break;
					case "focusout":
						oi = ai = ii = null;
						break;
					case "mousedown":
						si = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						si = !1, ci(s, n, i);
						break;
					case "selectionchange": if (ri) break;
					case "keydown":
					case "keyup": ci(s, n, i);
				}
				var y;
				if (yr) b: {
					switch (e) {
						case "compositionstart":
							var b = "onCompositionStart";
							break b;
						case "compositionend":
							b = "onCompositionEnd";
							break b;
						case "compositionupdate":
							b = "onCompositionUpdate";
							break b;
					}
					b = void 0;
				}
				else Dr ? Tr(e, n) && (b = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (b = "onCompositionStart");
				b && (Sr && n.locale !== "ko" && (Dr || b !== "onCompositionStart" ? b === "onCompositionEnd" && Dr && (y = Vn()) : (Rn = i, zn = "value" in Rn ? Rn.value : Rn.textContent, Dr = !0)), v = Yf(r, b), 0 < v.length && (b = new ar(b, e, null, n, i), s.push({
					event: b,
					listeners: v
				}), y ? b.data = y : (y = Er(n), y !== null && (b.data = y)))), (y = xr ? Or(e, n) : kr(e, n)) && (b = Yf(r, "onBeforeInput"), 0 < b.length && (v = new ar("onBeforeInput", "beforeinput", null, n, i), s.push({
					event: v,
					listeners: b
				}), v.data = y)), Lf(s, e, r, n, i);
			}
			Hf(s, t);
		});
	}
	function Jf(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function Yf(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = Pn(e, n), i != null && r.unshift(Jf(e, i, a)), i = Pn(e, t), i != null && r.push(Jf(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function Xf(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function Zf(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = Pn(n, a), l != null && o.unshift(Jf(n, l, c))) : i || (l = Pn(n, a), l != null && o.push(Jf(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var Qf = /\r\n?/g, $f = /\u0000|\uFFFD/g;
	function ep(e) {
		return (typeof e == "string" ? e : "" + e).replace(Qf, "\n").replace($f, "");
	}
	function tp(e, t) {
		return t = ep(t), ep(e) === t;
	}
	function Q(e, t, n, r, a, o) {
		switch (n) {
			case "children":
				if (typeof r == "string") t === "body" || t === "textarea" && r === "" || vn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") t !== "body" && vn(e, "" + r);
				else return;
				break;
			case "className":
				nn(e, "class", r);
				break;
			case "tabIndex":
				nn(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				nn(e, n, r);
				break;
			case "style":
				xn(e, r, o);
				return;
			case "data": if (t !== "object") {
				nn(e, "data", r);
				break;
			}
			case "src":
			case "href":
				if (r === "" && (t !== "a" || n !== "href")) {
					e.removeAttribute(n);
					break;
				}
				if (r == null || typeof r == "function" || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = Tn(r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				}
				if (typeof o == "function" && (n === "formAction" ? (t !== "input" && Q(e, t, "name", a.name, a, null), Q(e, t, "formEncType", a.formEncType, a, null), Q(e, t, "formMethod", a.formMethod, a, null), Q(e, t, "formTarget", a.formTarget, a, null)) : (Q(e, t, "encType", a.encType, a, null), Q(e, t, "method", a.method, a, null), Q(e, t, "target", a.target, a, null))), r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = Tn(r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = En);
				return;
			case "onScroll":
				r != null && Z("scroll", e);
				return;
			case "onScrollEnd":
				r != null && Z("scrollend", e);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						o?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "multiple":
				e.multiple = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "muted":
				e.muted = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "defaultValue":
			case "defaultChecked":
			case "innerHTML":
			case "ref": break;
			case "autoFocus": break;
			case "xlinkHref":
				if (r == null || typeof r == "function" || typeof r == "boolean" || typeof r == "symbol") {
					e.removeAttribute("xlink:href");
					break;
				}
				n = Tn(r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
				break;
			case "contentEditable":
			case "spellCheck":
			case "draggable":
			case "value":
			case "autoReverse":
			case "externalResourcesRequired":
			case "focusable":
			case "preserveAlpha":
				r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "inert":
			case "allowFullScreen":
			case "async":
			case "autoPlay":
			case "controls":
			case "credentialless":
			case "default":
			case "defer":
			case "disabled":
			case "disablePictureInPicture":
			case "disableRemotePlayback":
			case "formNoValidate":
			case "hidden":
			case "loop":
			case "noModule":
			case "noValidate":
			case "open":
			case "playsInline":
			case "readOnly":
			case "required":
			case "reversed":
			case "scoped":
			case "seamless":
			case "itemScope":
				r && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
				break;
			case "capture":
			case "download":
				!0 === r ? e.setAttribute(n, "") : !1 !== r && r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "cols":
			case "rows":
			case "size":
			case "span":
				r != null && typeof r != "function" && typeof r != "symbol" && !isNaN(r) && 1 <= r ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "rowSpan":
			case "start":
				r == null || typeof r == "function" || typeof r == "symbol" || isNaN(r) ? e.removeAttribute(n) : e.setAttribute(n, r);
				break;
			case "popover":
				Z("beforetoggle", e), Z("toggle", e), tn(e, "popover", r);
				break;
			case "xlinkActuate":
				rn(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				rn(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				rn(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				rn(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				rn(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				rn(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				rn(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				rn(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				rn(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				tn(e, "is", r);
				break;
			case "innerText":
			case "textContent": return;
			default: if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") n = Cn.get(n) || n, tn(e, n, r);
			else return;
		}
		j = !0;
	}
	function np(e, t, n, r, a, o) {
		switch (n) {
			case "style":
				xn(e, r, o);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						o?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "children":
				if (typeof r == "string") vn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") vn(e, "" + r);
				else return;
				break;
			case "onScroll":
				r != null && Z("scroll", e);
				return;
			case "onScrollEnd":
				r != null && Z("scrollend", e);
				return;
			case "onClick":
				r != null && (e.onclick = En);
				return;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": return;
			case "innerText":
			case "textContent": return;
			default:
				if (!qt.hasOwnProperty(n)) a: {
					if (n[0] === "o" && n[1] === "n" && (a = n.endsWith("Capture"), o = n.slice(2, a ? n.length - 7 : void 0), t = e[jt] || null, t = t == null ? null : t[n], typeof t == "function" && e.removeEventListener(o, t, a), typeof r == "function")) {
						typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(o, r, a);
						break a;
					}
					j = !0, n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : tn(e, n, r);
				}
				return;
		}
		j = !0;
	}
	function rp(e, t, n) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "img":
				Z("error", e), Z("load", e);
				var r = !1, a = !1, o;
				for (o in n) if (n.hasOwnProperty(o)) {
					var s = n[o];
					if (s != null) switch (o) {
						case "src":
							r = !0;
							break;
						case "srcSet":
							a = !0;
							break;
						case "children":
						case "dangerouslySetInnerHTML": throw Error(i(137, t));
						default: Q(e, t, o, s, n, null);
					}
				}
				a && Q(e, t, "srcSet", n.srcSet, n, null), r && Q(e, t, "src", n.src, n, null);
				return;
			case "input":
				Z("invalid", e);
				var c = o = s = a = null, l = null, u = null;
				for (r in n) if (n.hasOwnProperty(r)) {
					var d = n[r];
					if (d != null) switch (r) {
						case "name":
							a = d;
							break;
						case "type":
							s = d;
							break;
						case "checked":
							l = d;
							break;
						case "defaultChecked":
							u = d;
							break;
						case "value":
							o = d;
							break;
						case "defaultValue":
							c = d;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (d != null) throw Error(i(137, t));
							break;
						default: Q(e, t, r, d, n, null);
					}
				}
				pn(e, o, c, l, u, s, a, !1);
				return;
			case "select":
				for (a in Z("invalid", e), r = s = o = null, n) if (n.hasOwnProperty(a) && (c = n[a], c != null)) switch (a) {
					case "value":
						o = c;
						break;
					case "defaultValue":
						s = c;
						break;
					case "multiple": r = c;
					default: Q(e, t, a, c, n, null);
				}
				t = o, n = s, e.multiple = !!r, t == null ? n != null && hn(e, !!r, n, !0) : hn(e, !!r, t, !1);
				return;
			case "textarea":
				for (s in Z("invalid", e), o = a = r = null, n) if (n.hasOwnProperty(s) && (c = n[s], c != null)) switch (s) {
					case "value":
						r = c;
						break;
					case "defaultValue":
						a = c;
						break;
					case "children":
						o = c;
						break;
					case "dangerouslySetInnerHTML":
						if (c != null) throw Error(i(91));
						break;
					default: Q(e, t, s, c, n, null);
				}
				_n(e, r, a, o);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: Q(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				Z("beforetoggle", e), Z("toggle", e), Z("cancel", e), Z("close", e);
				break;
			case "iframe":
			case "object":
				Z("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < Bf.length; r++) Z(Bf[r], e);
				break;
			case "image":
				Z("error", e), Z("load", e);
				break;
			case "details":
				Z("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": Z("error", e), Z("load", e);
			case "area":
			case "base":
			case "br":
			case "col":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "track":
			case "wbr":
			case "menuitem":
				for (u in n) if (n.hasOwnProperty(u) && (r = n[u], r != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML": throw Error(i(137, t));
					default: Q(e, t, u, r, n, null);
				}
				return;
			default: if (Sn(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && np(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && Q(e, t, c, r, n, null));
	}
	var ip = {};
	function ap(e, t, n, r) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "input":
				var a = null, o = null, s = null, c = null, l = null, u = null, d = null;
				for (m in n) {
					var f = n[m];
					if (n.hasOwnProperty(m) && f != null) switch (m) {
						case "checked": break;
						case "value": break;
						case "defaultValue": l = f;
						default: r.hasOwnProperty(m) || Q(e, t, m, null, r, f);
					}
				}
				for (var p in r) {
					var m = r[p];
					if (f = n[p], r.hasOwnProperty(p) && (m != null || f != null)) switch (p) {
						case "type":
							m !== f && (j = !0), o = m;
							break;
						case "name":
							m !== f && (j = !0), a = m;
							break;
						case "checked":
							m !== f && (j = !0), u = m;
							break;
						case "defaultChecked":
							m !== f && (j = !0), d = m;
							break;
						case "value":
							m !== f && (j = !0), s = m;
							break;
						case "defaultValue":
							m !== f && (j = !0), c = m;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (m != null) throw Error(i(137, t));
							break;
						default: m !== f && Q(e, t, p, m, r, f);
					}
				}
				fn(e, s, c, l, u, d, o, a);
				return;
			case "select":
				for (o in m = s = c = p = null, n) if (l = n[o], n.hasOwnProperty(o) && l != null) switch (o) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(o) || Q(e, t, o, null, r, l);
				}
				for (a in r) if (o = r[a], l = n[a], r.hasOwnProperty(a) && (o != null || l != null)) switch (a) {
					case "value":
						o !== l && (j = !0), p = o;
						break;
					case "defaultValue":
						o !== l && (j = !0), c = o;
						break;
					case "multiple": o !== l && (j = !0), s = o;
					default: o !== l && Q(e, t, a, o, r, l);
				}
				t = c, n = s, r = m, p == null ? !!r != !!n && (t == null ? hn(e, !!n, n ? [] : "", !1) : hn(e, !!n, t, !0)) : hn(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (a = n[c], n.hasOwnProperty(c) && a != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: Q(e, t, c, null, r, a);
				}
				for (s in r) if (a = r[s], o = n[s], r.hasOwnProperty(s) && (a != null || o != null)) switch (s) {
					case "value":
						a !== o && (j = !0), p = a;
						break;
					case "defaultValue":
						a !== o && (j = !0), m = a;
						break;
					case "children": break;
					case "dangerouslySetInnerHTML":
						if (a != null) throw Error(i(91));
						break;
					default: a !== o && Q(e, t, s, a, r, o);
				}
				gn(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: Q(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						p !== m && (j = !0), e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: Q(e, t, l, p, r, m);
				}
				return;
			case "img":
			case "link":
			case "area":
			case "base":
			case "br":
			case "col":
			case "embed":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "source":
			case "track":
			case "wbr":
			case "menuitem":
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && Q(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(i(137, t));
						break;
					default: Q(e, t, u, p, r, m);
				}
				return;
			default: if (Sn(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && np(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || np(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && Q(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || Q(e, t, f, p, r, m);
	}
	function op(e) {
		switch (e) {
			case "css":
			case "script":
			case "font":
			case "img":
			case "image":
			case "input":
			case "link": return !0;
			default: return !1;
		}
	}
	function sp() {
		if (typeof performance.getEntriesByType == "function") {
			for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
				var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
				if (a && s && op(o)) {
					for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
						var c = n[r], l = c.startTime;
						if (l > s) break;
						var u = c.transferSize, d = c.initiatorType;
						u && op(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
					}
					if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
				}
			}
			if (0 < e) return t / e / 1e6;
		}
		return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
	}
	var cp = null, lp = null;
	function up(e) {
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	function dp(e) {
		switch (e) {
			case "http://www.w3.org/2000/svg": return 1;
			case "http://www.w3.org/1998/Math/MathML": return 2;
			default: return 0;
		}
	}
	function fp(e, t) {
		if (e === 0) switch (t) {
			case "svg": return 1;
			case "math": return 2;
			default: return 0;
		}
		return e === 1 && t === "foreignObject" ? 0 : e;
	}
	function pp(e, t, n, r) {
		return n = up(n).createElement(e), n[At] = r, n[jt] = t, rp(n, e, t), Wt(n), n;
	}
	function mp(e, t) {
		return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
	}
	var hp = null;
	function gp() {
		var e = window.event;
		return e && e.type === "popstate" ? e !== hp && (hp = e, !0) : (hp = null, !1);
	}
	var _p = typeof setTimeout == "function" ? setTimeout : void 0, vp = typeof clearTimeout == "function" ? clearTimeout : void 0, yp = typeof Promise == "function" ? Promise : void 0, bp = typeof requestAnimationFrame == "function" ? requestAnimationFrame : _p, xp = typeof queueMicrotask == "function" ? queueMicrotask : yp === void 0 ? _p : function(e) {
		return yp.resolve(null).then(e).catch(Sp);
	};
	function Sp(e) {
		setTimeout(function() {
			throw e;
		});
	}
	function Cp(e) {
		return e === "head";
	}
	function wp(e, t) {
		var n = t, r = 0;
		do {
			var i = n.nextSibling;
			if (e.removeChild(n), i && i.nodeType === 8) {
				if (n = i.data, n === "/$" || n === "/&") {
					if (r === 0) {
						e.removeChild(i), Hh(t);
						return;
					}
					r--;
				} else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") r++;
				else if (n === "html") _m(e.ownerDocument.documentElement);
				else if (n === "head") {
					n = e.ownerDocument.head, _m(n);
					for (var a = n.firstChild; a;) {
						var o = a.nextSibling, s = a.nodeName;
						a[Lt] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
					}
				} else n === "body" && _m(e.ownerDocument.body);
			}
			n = i;
		} while (n);
		Hh(t);
	}
	function Tp(e, t) {
		var n = e;
		e = 0;
		do {
			var r = n.nextSibling;
			if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), r && r.nodeType === 8) {
				if (n = r.data, n === "/$") {
					if (e === 0) break;
					e--;
				} else n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || e++;
			}
			n = r;
		} while (n);
	}
	function Ep(e, t, n) {
		if (t = CSS.escape(t) === t ? t : "r-" + btoa(t).replace(/=/g, ""), e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
			if (t = e.getClientRects(), t.length === 1) var r = 1;
			else for (var i = r = 0; i < t.length; i++) {
				var a = t[i];
				0 < a.width && 0 < a.height && r++;
			}
			r === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom);
		}
	}
	function Dp(e, t) {
		e = e.style, t = t.style;
		var n = t == null ? null : t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null;
		e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t == null ? null : t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n == null ? (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t) : e.margin = n));
	}
	function Op(e, t, n) {
		return n = n.ownerDocument.defaultView, {
			rect: e,
			abs: t.position === "absolute" || t.position === "fixed",
			clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
			view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
		};
	}
	function $(e) {
		return Op(e.getBoundingClientRect(), getComputedStyle(e), e);
	}
	function kp(e) {
		var t = e.getBoundingClientRect();
		t = new DOMRect(t.x + 2e4, t.y + 2e4, t.width, t.height);
		var n = getComputedStyle(e);
		return Op(t, n, e);
	}
	function Ap(e) {
		return e.documentElement.clientHeight;
	}
	function jp(e) {
		this.addEventListener("load", e), this.addEventListener("error", e);
	}
	function Mp(e, t, n, r, i, a, o, s, c) {
		var l = t.nodeType === 9 ? t : t.ownerDocument;
		try {
			var u = l.startViewTransition({
				update: function() {
					var t = l.defaultView, n = t.navigation && t.navigation.transition, o = l.fonts.status;
					r();
					var s = [];
					if (o === "loaded" && (Ap(l), l.fonts.status === "loading" && s.push(l.fonts.ready)), o = s.length, e !== null) for (var c = e.suspenseyImages, u = 0, d = 0; d < c.length; d++) {
						var f = c[d];
						if (!f.complete) {
							var p = f.getBoundingClientRect();
							if (0 < p.bottom && 0 < p.right && p.top < t.innerHeight && p.left < t.innerWidth) {
								if (u += Xm(f), u > $m) {
									s.length = o;
									break;
								}
								f = new Promise(jp.bind(f)), s.push(f);
							}
						}
					}
					if (0 < s.length) return t = Promise.race([Promise.all(s), new Promise(function(e) {
						return setTimeout(e, 500);
					})]).then(i, i), (n ? Promise.allSettled([n.finished, t]) : t).then(a, a);
					if (i(), n) return n.finished.then(a, a);
					a();
				},
				types: n
			});
			l.__reactViewTransition = u;
			var d = [];
			return u.ready.then(function() {
				for (var e = l.documentElement.getAnimations({ subtree: !0 }), t = 0; t < e.length; t++) {
					var n = e[t], r = n.effect, i = r.pseudoElement;
					if (i != null && i.startsWith("::view-transition")) {
						d.push(n), n = r.getKeyframes();
						for (var a = i = void 0, s = !0, c = 0; c < n.length; c++) {
							var u = n[c], f = u.width;
							if (i === void 0) i = f;
							else if (i !== f) {
								s = !1;
								break;
							}
							if (f = u.height, a === void 0) a = f;
							else if (a !== f) {
								s = !1;
								break;
							}
							delete u.width, delete u.height, u.transform === "none" && delete u.transform;
						}
						s && i !== void 0 && a !== void 0 && (r.setKeyframes(n), s = getComputedStyle(r.target, r.pseudoElement), s.width !== i || s.height !== a) && (s = n[0], s.width = i, s.height = a, s = n[n.length - 1], s.width = i, s.height = a, r.setKeyframes(n));
					}
				}
				o();
			}, function(e) {
				l.__reactViewTransition === u && (l.__reactViewTransition = null);
				try {
					if (typeof e == "object" && e) switch (e.name) {
						case "InvalidStateError": (e.message === "View transition was skipped because document visibility state is hidden." || e.message === "Skipping view transition because document visibility state has become hidden." || e.message === "Skipping view transition because viewport size changed." || e.message === "Transition was aborted because of invalid state") && (e = null);
					}
					e !== null && c(e);
				} finally {
					r(), i(), o();
				}
			}), u.finished.finally(function() {
				for (var e = 0; e < d.length; e++) d[e].cancel();
				l.__reactViewTransition === u && (l.__reactViewTransition = null), s();
			}), u;
		} catch {
			return r(), i(), o(), null;
		}
	}
	function Np(e, t) {
		this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
	}
	Np.prototype.animate = function(e, t) {
		return t = typeof t == "number" ? { duration: t } : D({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
	}, Np.prototype.getAnimations = function() {
		for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), r = [], i = 0; i < n.length; i++) {
			var a = n[i].effect;
			a !== null && a.target === e && a.pseudoElement === t && r.push(n[i]);
		}
		return r;
	}, Np.prototype.getComputedStyle = function() {
		return getComputedStyle(this._scope, this._selector);
	};
	function Pp(e) {
		return {
			name: e,
			group: new Np("group", e),
			imagePair: new Np("image-pair", e),
			old: new Np("old", e),
			new: new Np("new", e)
		};
	}
	function Fp(e) {
		this._fragmentFiber = e, this._observers = this._eventListeners = null;
	}
	Fp.prototype.addEventListener = function(e, t, n) {
		var r = null, i = null;
		if (!(n != null && typeof n != "boolean" && (r = n.signal || null, r !== null && r.aborted))) {
			this._eventListeners === null && (this._eventListeners = []);
			var a = this._eventListeners;
			if (Bp(a, e, t, n) === -1) {
				var o = this, s = t;
				n != null && typeof n != "boolean" && !0 === n.once && (s = function(r) {
					o.removeEventListener(e, t, n), typeof t == "function" ? t.call(this, r) : t.handleEvent(r);
				}), r !== null && (i = o.removeEventListener.bind(o, e, t, n), r.addEventListener("abort", i, { once: !0 }), i = r.removeEventListener.bind(r, "abort", i)), r = Rp(n), a.push({
					type: e,
					listener: t,
					optionsOrUseCapture: n,
					attachedListener: s,
					cleanup: i
				}), h(this._fragmentFiber.child, !1, Ip, e, s, r);
			}
			this._eventListeners = a;
		}
	};
	function Ip(e, t, n, r) {
		return b(e).addEventListener(t, n, r), !1;
	}
	Fp.prototype.removeEventListener = function(e, t, n) {
		var r = this._eventListeners;
		if (r !== null && (t = Bp(r, e, t, n), t !== -1)) {
			var i = r[t];
			n = i.attachedListener;
			var a = i.cleanup;
			i = Rp(i.optionsOrUseCapture), h(this._fragmentFiber.child, !1, Lp, e, n, i), r.splice(t, 1), a !== null && a();
		}
	};
	function Lp(e, t, n, r) {
		return b(e).removeEventListener(t, n, r), !1;
	}
	function Rp(e) {
		return e != null && typeof e != "boolean" && (!0 === e.once || e.signal instanceof AbortSignal) ? {
			capture: e.capture,
			passive: e.passive
		} : e;
	}
	function zp(e) {
		return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
	}
	function Bp(e, t, n, r) {
		if (e.length === 0) return -1;
		r = zp(r);
		for (var i = 0; i < e.length; i++) {
			var a = e[i];
			if (a.type === t && a.listener === n && zp(a.optionsOrUseCapture) === r) return i;
		}
		return -1;
	}
	Fp.prototype.dispatchEvent = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return !0;
		t = b(t);
		var n = this._eventListeners;
		if (n !== null && 0 < n.length || !e.bubbles) {
			var r = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
			if (n) for (var i = 0; i < n.length; i++) {
				var a = n[i];
				r.addEventListener(a.type, a.attachedListener, Rp(a.optionsOrUseCapture));
			}
			if (t.appendChild(r), e = r.dispatchEvent(e), n) for (i = 0; i < n.length; i++) a = n[i], r.removeEventListener(a.type, a.attachedListener, Rp(a.optionsOrUseCapture));
			return t.removeChild(r), e;
		}
		return t.dispatchEvent(e);
	}, Fp.prototype.focus = function(e) {
		h(this._fragmentFiber.child, !0, Vp, e, void 0, void 0);
	};
	function Vp(e, t) {
		return e.tag !== 6 && (e = b(e), pm(e, t));
	}
	Fp.prototype.focusLast = function(e) {
		var t = [];
		h(this._fragmentFiber.child, !0, Hp, t, void 0, void 0);
		for (var n = t.length - 1; 0 <= n && !Vp(t[n], e); n--);
	};
	function Hp(e, t) {
		return t.push(e), !1;
	}
	Fp.prototype.blur = function() {
		var e = g(this._fragmentFiber);
		e !== null && (e = b(e), e = up(e).activeElement, e !== null && h(this._fragmentFiber.child, !1, Up, e, void 0, void 0));
	};
	function Up(e, t) {
		return e.tag !== 6 && (e = b(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
	}
	Fp.prototype.observeUsing = function(e) {
		this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), h(this._fragmentFiber.child, !1, Wp, e, void 0, void 0);
	};
	function Wp(e, t) {
		return e.tag !== 6 && (e = b(e), t.observe(e), !1);
	}
	Fp.prototype.unobserveUsing = function(e) {
		var t = this._observers;
		if (t !== null && t.has(e)) {
			t.delete(e), h(this._fragmentFiber.child, !1, Gp, e, void 0, void 0);
			for (var n = t = 0; n < Kp.length; n++) {
				var r = Kp[n];
				r.fragmentInstance === this && r.observer === e ? e.unobserve(r.instance) : Kp[t++] = r;
			}
			Kp.length = t;
		}
	};
	function Gp(e, t) {
		return e.tag !== 6 && (e = b(e), t.unobserve(e), !1);
	}
	var Kp = [], qp = !1;
	function Jp(e, t, n) {
		Kp.push({
			fragmentInstance: e,
			observer: t,
			instance: n
		}), qp || (qp = !0, mm(function() {
			qp = !1;
			var e = Kp;
			Kp = [];
			for (var t = 0; t < e.length; t++) {
				var n = e[t];
				n.observer.unobserve(n.instance);
			}
		}));
	}
	Fp.prototype.getClientRects = function() {
		var e = [];
		return h(this._fragmentFiber.child, !1, Yp, e, void 0, void 0), e;
	};
	function Yp(e, t) {
		if (e.tag === 6) {
			e = e.stateNode;
			var n = e.ownerDocument.createRange();
			n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
		} else e = b(e), t.push.apply(t, e.getClientRects());
		return !1;
	}
	Fp.prototype.getRootNode = function(e) {
		var t = g(this._fragmentFiber);
		return t === null ? this : b(t).getRootNode(e);
	}, Fp.prototype.compareDocumentPosition = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		var n = [];
		h(this._fragmentFiber.child, !1, Hp, n, void 0, void 0);
		var r = b(t);
		if (n.length === 0) {
			if (n = r, _(this._fragmentFiber)) {
				a: {
					for (t = this._fragmentFiber.return; t !== null;) {
						if (t.tag === 4) {
							t = t.stateNode.containerInfo;
							break a;
						}
						if (t.tag === 3 || t.tag === 5 || t.tag === 27) break;
						t = t.return;
					}
					t = null;
				}
				t != null && (n = t);
			}
			t = this._fragmentFiber;
			var i = r = n.compareDocumentPosition(e);
			return n === e ? i = Node.DOCUMENT_POSITION_CONTAINS : r & Node.DOCUMENT_POSITION_CONTAINED_BY && (n = v(t)[1], n === null ? i = Node.DOCUMENT_POSITION_PRECEDING : (e = b(n).compareDocumentPosition(e), i = e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), i |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
		}
		t = b(n[0]), i = b(n[n.length - 1]);
		var a = _(this._fragmentFiber) ? t.parentElement : r;
		if (a == null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		r = a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY, a = a.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_CONTAINED_BY;
		var o = t.compareDocumentPosition(e), s = i.compareDocumentPosition(e), c = o & Node.DOCUMENT_POSITION_CONTAINED_BY || s & Node.DOCUMENT_POSITION_CONTAINED_BY;
		return s = r && a && o & Node.DOCUMENT_POSITION_FOLLOWING && s & Node.DOCUMENT_POSITION_PRECEDING, t = r && t === e || a && i === e || c || s ? Node.DOCUMENT_POSITION_CONTAINED_BY : !r && t === e || !a && i === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : o, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || Xp(t, this._fragmentFiber, n[0], n[n.length - 1], e) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
	};
	function Xp(e, t, n, r, i) {
		var a = Bt(i);
		if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
			if (n = !!a) a: {
				for (; a !== null;) {
					if (a.tag === 7 && (a === t || a.alternate === t)) {
						n = !0;
						break a;
					}
					a = a.return;
				}
				n = !1;
			}
			return n;
		}
		if (e & Node.DOCUMENT_POSITION_CONTAINS) {
			if (a === null) return a = i.ownerDocument, i === a || i === a.documentElement || i === a.body;
			a: {
				for (a = t, t = g(t); a !== null;) {
					if (!(a.tag !== 5 && a.tag !== 3 && a.tag !== 27 || a !== t && a.alternate !== t)) {
						a = !0;
						break a;
					}
					a = a.return;
				}
				a = !1;
			}
			return a;
		}
		return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!a) && !(t = a === n) && (t = E(n, a, T), t === null ? t = !1 : (h(t, !0, C, a, n), a = x, x = null, t = a !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!a) && !(t = a === r) && (t = E(r, a, T), t === null ? t = !1 : (h(t, !0, w, a, r), a = x, S = x = null, t = a !== null)), t) : !1;
	}
	function Zp(e, t) {
		var n = e.ownerDocument.createRange();
		n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(window.scrollX + e.left, t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight);
	}
	Fp.prototype.scrollIntoView = function(e) {
		if (typeof e == "object") throw Error(i(566));
		var t = [];
		h(this._fragmentFiber.child, !1, Hp, t, void 0, void 0);
		var n = !1 !== e;
		if (t.length === 0) {
			var r = v(this._fragmentFiber);
			if (r = n ? r[1] || r[0] || g(this._fragmentFiber) : r[0] || r[1], r === null) return;
			if (r.tag === 6) {
				e = b(r), Zp(e, n);
				return;
			}
			if (r = b(r), r.nodeType !== 9) {
				if (r.nodeType === 11) {
					n = "host" in r ? r.host : null, n !== null && n.scrollIntoView(e);
					return;
				}
				r.scrollIntoView(e);
			}
		}
		for (r = n ? t.length - 1 : 0; r !== (n ? -1 : t.length);) {
			var a = t[r];
			a.tag === 6 ? (a = b(a), Zp(a, n)) : b(a).scrollIntoView(e), r += n ? -1 : 1;
		}
	};
	function Qp(e, t) {
		return e = b(e), $p(e, t), !1;
	}
	function $p(e, t) {
		e.reactFragments ??= /* @__PURE__ */ new Set(), e.reactFragments.add(t);
	}
	function em(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.addEventListener(i.type, i.attachedListener, Rp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			for (var r = 0, i = 0; i < Kp.length; i++) {
				var a = Kp[i];
				(a.fragmentInstance !== t || a.observer !== n || a.instance !== e) && (Kp[r++] = a);
			}
			Kp.length = r, n.observe(e);
		}), $p(e, t));
	}
	function tm(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.removeEventListener(i.type, i.attachedListener, Rp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			typeof n.rootMargin == "string" ? Jp(t, n, e) : n.unobserve(e);
		}), e.reactFragments != null && e.reactFragments.delete(t));
	}
	function nm(e) {
		var t = e.firstChild;
		for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
			var n = t;
			switch (t = t.nextSibling, n.nodeName) {
				case "HTML":
				case "HEAD":
				case "BODY":
					nm(n), zt(n);
					continue;
				case "SCRIPT":
				case "STYLE": continue;
				case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
			}
			e.removeChild(n);
		}
	}
	function rm(e, t, n, r) {
		for (; e.nodeType === 1;) {
			var i = n;
			if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
				if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
			} else if (!r) {
				if (t === "input" && e.type === "hidden") {
					var a = i.name == null ? null : "" + i.name;
					if (i.type === "hidden" && e.getAttribute("name") === a) return e;
				} else return e;
			} else if (!e[Lt]) switch (t) {
				case "meta":
					if (!e.hasAttribute("itemprop")) break;
					return e;
				case "link":
					if (a = e.getAttribute("rel"), a === "stylesheet" && e.hasAttribute("data-precedence") || a !== i.rel || e.getAttribute("href") !== (i.href == null || i.href === "" ? null : i.href) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin) || e.getAttribute("title") !== (i.title == null ? null : i.title)) break;
					return e;
				case "style":
					if (e.hasAttribute("data-precedence")) break;
					return e;
				case "script":
					if (a = e.getAttribute("src"), (a !== (i.src == null ? null : i.src) || e.getAttribute("type") !== (i.type == null ? null : i.type) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin)) && a && e.hasAttribute("async") && !e.hasAttribute("itemprop")) break;
					return e;
				default: return e;
			}
			if (e = lm(e.nextSibling), e === null) break;
		}
		return null;
	}
	function im(e, t, n) {
		if (t === "") return null;
		for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = lm(e.nextSibling), e === null)) return null;
		return e;
	}
	function am(e, t) {
		for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = lm(e.nextSibling), e === null)) return null;
		return e;
	}
	function om(e) {
		return e.data === "$?" || e.data === "$~";
	}
	function sm(e) {
		return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
	}
	function cm(e, t) {
		var n = e.ownerDocument;
		if (e.data === "$~") e._reactRetry = t;
		else if (e.data !== "$?" || n.readyState !== "loading") t();
		else {
			var r = function() {
				t(), n.removeEventListener("DOMContentLoaded", r);
			};
			n.addEventListener("DOMContentLoaded", r), e._reactRetry = r;
		}
	}
	function lm(e) {
		for (; e != null; e = e.nextSibling) {
			var t = e.nodeType;
			if (t === 1 || t === 3) break;
			if (t === 8) {
				if (t = e.data, t === "$" || t === "$!" || t === "$?" || t === "$~" || t === "&" || t === "F!" || t === "F") break;
				if (t === "/$" || t === "/&") return null;
			}
		}
		return e;
	}
	var um = null;
	function dm(e) {
		e = e.nextSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "/$" || n === "/&") {
					if (t === 0) return lm(e.nextSibling);
					t--;
				} else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
			}
			e = e.nextSibling;
		}
		return null;
	}
	function fm(e) {
		e = e.previousSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
					if (t === 0) return e;
					t--;
				} else n !== "/$" && n !== "/&" || t++;
			}
			e = e.previousSibling;
		}
		return null;
	}
	function pm(e, t) {
		function n() {
			r = !0;
		}
		if (e.ownerDocument.activeElement === e) return !0;
		var r = !1;
		try {
			e.ownerDocument.addEventListener("focus", n, !0), (e.focus || HTMLElement.prototype.focus).call(e, t);
		} finally {
			e.ownerDocument.removeEventListener("focus", n, !0);
		}
		return r;
	}
	function mm(e) {
		bp(function() {
			bp(function(t) {
				return e(t);
			});
		});
	}
	function hm(e, t, n) {
		switch (t = up(n), e) {
			case "html":
				if (e = t.documentElement, !e) throw Error(i(452));
				return e;
			case "head":
				if (e = t.head, !e) throw Error(i(453));
				return e;
			case "body":
				if (e = t.body, !e) throw Error(i(454));
				return e;
			default: throw Error(i(451));
		}
	}
	function gm(e, t, n) {
		for (var r in n) {
			var i = n[r];
			n.hasOwnProperty(r) && i != null && Q(e, t, r, null, ip, i);
		}
		n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === En && (e.onclick = null), zt(e);
	}
	function _m(e) {
		for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
		zt(e);
	}
	var vm = /* @__PURE__ */ new Map(), ym = /* @__PURE__ */ new Set();
	function bm(e) {
		if (typeof e.getRootNode == "function") {
			var t = e.getRootNode();
			if (t.nodeType === 9 || t.nodeType === 11) return t;
		}
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	var xm = k.d;
	k.d = {
		f: Sm,
		r: Cm,
		D: Em,
		C: Dm,
		L: Om,
		m: km,
		X: jm,
		S: Am,
		M: Mm
	};
	function Sm() {
		var e = xm.f(), t = Bd();
		return e || t;
	}
	function Cm(e) {
		var t = Vt(e);
		t !== null && t.tag === 5 && t.type === "form" ? rc(t) : xm.r(e);
	}
	var wm = typeof document > "u" ? null : document;
	function Tm(e, t, n) {
		var r = wm;
		if (r && typeof t == "string" && t) {
			var i = dn(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), ym.has(i) || (ym.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), rp(t, "link", e), Wt(t), r.head.appendChild(t)));
		}
	}
	function Em(e) {
		xm.D(e), Tm("dns-prefetch", e, null);
	}
	function Dm(e, t) {
		xm.C(e, t), Tm("preconnect", e, t);
	}
	function Om(e, t, n) {
		xm.L(e, t, n);
		var r = wm;
		if (r && e && t) {
			var i = "link[rel=\"preload\"][as=\"" + dn(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + dn(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + dn(n.imageSizes) + "\"]")) : i += "[href=\"" + dn(e) + "\"]";
			var a = i;
			switch (t) {
				case "style":
					a = Pm(e);
					break;
				case "script": a = Rm(e);
			}
			if (!(vm.has(a) || (e = D({
				rel: "preload",
				href: t === "image" && n && n.imageSrcSet ? void 0 : e,
				as: t
			}, n), vm.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(Fm(a)) || t === "script" && r.querySelector(zm(a))))) {
				var o = r.createElement("link");
				rp(o, "link", e), t === "style" && (o[Rt] = !0, o.onload = o.onerror = function() {
					Gt(o);
				}), Wt(o), r.head.appendChild(o);
			}
		}
	}
	function km(e, t) {
		xm.m(e, t);
		var n = wm;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + dn(r) + "\"][href=\"" + dn(e) + "\"]", a = i;
			switch (r) {
				case "audioworklet":
				case "paintworklet":
				case "serviceworker":
				case "sharedworker":
				case "worker":
				case "script": a = Rm(e);
			}
			if (!vm.has(a) && (e = D({
				rel: "modulepreload",
				href: e
			}, t), vm.set(a, e), n.querySelector(i) === null)) {
				switch (r) {
					case "audioworklet":
					case "paintworklet":
					case "serviceworker":
					case "sharedworker":
					case "worker":
					case "script": if (n.querySelector(zm(a))) return;
				}
				r = n.createElement("link"), rp(r, "link", e), Wt(r), n.head.appendChild(r);
			}
		}
	}
	function Am(e, t, n) {
		xm.S(e, t, n);
		var r = wm;
		if (r && e) {
			var i = Ut(r).hoistableStyles, a = Pm(e);
			t ||= "default";
			var o = i.get(a);
			if (!o) {
				var s = {
					loading: 0,
					preload: null
				};
				if (o = r.querySelector(Fm(a))) s.loading = 5;
				else {
					e = D({
						rel: "stylesheet",
						href: e,
						"data-precedence": t
					}, n), (n = vm.get(a)) && Hm(e, n);
					var c = o = r.createElement("link");
					Wt(c), rp(c, "link", e), c._p = new Promise(function(e, t) {
						c.onload = e, c.onerror = t;
					}), c.addEventListener("load", function() {
						s.loading |= 1;
					}), c.addEventListener("error", function() {
						s.loading |= 2;
					}), s.loading |= 4, Vm(o, t, r);
				}
				o = {
					type: "stylesheet",
					instance: o,
					count: 1,
					state: s
				}, i.set(a, o);
			}
		}
	}
	function jm(e, t) {
		xm.X(e, t);
		var n = wm;
		if (n && e) {
			var r = Ut(n).hoistableScripts, i = Rm(e), a = r.get(i);
			a || (a = n.querySelector(zm(i)), a || (e = D({
				src: e,
				async: !0
			}, t), (t = vm.get(i)) && Um(e, t), a = n.createElement("script"), Wt(a), rp(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Mm(e, t) {
		xm.M(e, t);
		var n = wm;
		if (n && e) {
			var r = Ut(n).hoistableScripts, i = Rm(e), a = r.get(i);
			a || (a = n.querySelector(zm(i)), a || (e = D({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = vm.get(i)) && Um(e, t), a = n.createElement("script"), Wt(a), rp(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Nm(e, t, n, r) {
		var a = (a = Ae.current) ? bm(a) : null;
		if (!a) throw Error(i(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (n = Pm(n.href), t = Ut(a).hoistableStyles, r = t.get(n), r || (r = {
				type: "style",
				instance: null,
				count: 0,
				state: null
			}, t.set(n, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			case "link":
				if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
					e = Pm(n.href);
					var o = Ut(a).hoistableStyles, s = o.get(e);
					if (s || (a = a.ownerDocument || a, s = {
						type: "stylesheet",
						instance: null,
						count: 0,
						state: {
							loading: 0,
							preload: null
						}
					}, o.set(e, s), (o = a.querySelector(Fm(e))) ? o._p || (s.instance = o, s.state.loading = 5) : (o = vm.get(e), o || (o = {
						rel: "preload",
						as: "style",
						href: n.href,
						crossOrigin: n.crossOrigin,
						integrity: n.integrity,
						media: n.media,
						hrefLang: n.hrefLang,
						referrerPolicy: n.referrerPolicy
					}, vm.set(e, o)), Lm(a, e, o, s.state))), t && r === null) throw Error(i(528, ""));
					return s;
				}
				if (t && r !== null) throw Error(i(529, ""));
				return null;
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = Rm(n), t = Ut(a).hoistableScripts, r = t.get(n), r || (r = {
				type: "script",
				instance: null,
				count: 0,
				state: null
			}, t.set(n, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			default: throw Error(i(444, e));
		}
	}
	function Pm(e) {
		return "href=\"" + dn(e) + "\"";
	}
	function Fm(e) {
		return "link[rel=\"stylesheet\"][" + e + "]";
	}
	function Im(e) {
		return D({}, e, {
			"data-precedence": e.precedence,
			precedence: null
		});
	}
	function Lm(e, t, n, r) {
		if (t = e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]")) {
			if (!0 !== t[Rt]) {
				r.loading = 1;
				return;
			}
		} else t = e.createElement("link"), t[Rt] = !0, t.onload = t.onerror = Gt.bind(null, t), rp(t, "link", n), Wt(t), e.head.appendChild(t);
		r.preload = t, t.addEventListener("load", function() {
			return r.loading |= 1;
		}), t.addEventListener("error", function() {
			return r.loading |= 2;
		});
	}
	function Rm(e) {
		return "[src=\"" + dn(e) + "\"]";
	}
	function zm(e) {
		return "script[async]" + e;
	}
	function Bm(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + dn(n.href) + "\"]");
				if (r) return t.instance = r, Wt(r), r;
				var a = D({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), Wt(r), rp(r, "style", a), Vm(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				a = Pm(n.href);
				var o = e.querySelector(Fm(a));
				if (o) return t.state.loading |= 4, t.instance = o, Wt(o), o;
				r = Im(n), (a = vm.get(a)) && Hm(r, a), o = (e.ownerDocument || e).createElement("link"), Wt(o);
				var s = o;
				return s._p = new Promise(function(e, t) {
					s.onload = e, s.onerror = t;
				}), rp(o, "link", r), t.state.loading |= 4, Vm(o, n.precedence, e), t.instance = o;
			case "script": return o = Rm(n.src), (a = e.querySelector(zm(o))) ? (t.instance = a, Wt(a), a) : (r = n, (a = vm.get(o)) && (r = D({}, n), Um(r, a)), e = e.ownerDocument || e, a = e.createElement("script"), Wt(a), rp(a, "link", r), e.head.appendChild(a), t.instance = a);
			case "void": return null;
			default: throw Error(i(443, t.type));
		}
		else t.type === "stylesheet" && !(t.state.loading & 4) && (r = t.instance, t.state.loading |= 4, Vm(r, n.precedence, e));
		return t.instance;
	}
	function Vm(e, t, n) {
		for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
			var s = r[o];
			if (s.dataset.precedence === t) a = s;
			else if (a !== i) break;
		}
		a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
	}
	function Hm(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
	}
	function Um(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
	}
	var Wm = null;
	function Gm(e, t, n) {
		if (Wm === null) {
			var r = /* @__PURE__ */ new Map(), i = Wm = /* @__PURE__ */ new Map();
			i.set(n, r);
		} else i = Wm, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
		if (r.has(e)) return r;
		for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
			var a = n[i];
			if (!(a[Lt] || a[At] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
				var o = a.getAttribute(t) || "";
				o = e + o;
				var s = r.get(o);
				s ? s.push(a) : r.set(o, [a]);
			}
		}
		return r;
	}
	function Km(e, t, n) {
		e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
	}
	function qm(e, t, n) {
		if (n === 1 || t.itemProp != null) return !1;
		switch (e) {
			case "meta":
			case "title": return !0;
			case "style":
				if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") break;
				return !0;
			case "link":
				if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) break;
				switch (t.rel) {
					case "stylesheet": return e = t.disabled, typeof t.precedence == "string" && e == null;
					default: return !0;
				}
			case "script": if (t.async && typeof t.async != "function" && typeof t.async != "symbol" && !t.onLoad && !t.onError && t.src && typeof t.src == "string") return !0;
		}
		return !1;
	}
	function Jm(e, t) {
		return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
	}
	function Ym(e) {
		return !(e.type === "stylesheet" && !(e.state.loading & 3));
	}
	function Xm(e) {
		return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * .25;
	}
	function Zm(e, t) {
		typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += Xm(t), e.suspenseyImages.push(t)), e = rh.bind(e), t.decode().then(e, e));
	}
	function Qm(e, t, n, r) {
		if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && !(n.state.loading & 4)) {
			if (n.instance === null) {
				var i = Pm(r.href), a = t.querySelector(Fm(i));
				if (a) {
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = nh.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, Wt(a);
					return;
				}
				a = t.ownerDocument || t, r = Im(r), (i = vm.get(i)) && Hm(r, i), a = a.createElement("link"), Wt(a);
				var o = a;
				o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), rp(a, "link", r), n.instance = a;
			}
			e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && !(n.state.loading & 3) && (e.count++, n = nh.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
		}
	}
	var $m = 0;
	function eh(e, t) {
		return e.stylesheets && e.count === 0 && ah(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
			var r = setTimeout(function() {
				if (e.stylesheets && ah(e, e.stylesheets), e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, 6e4 + t);
			0 < e.imgBytes && $m === 0 && ($m = 62500 * sp());
			var i = setTimeout(function() {
				if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && ah(e, e.stylesheets), e.unsuspend)) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, (e.imgBytes > $m ? 50 : 800) + t);
			return e.unsuspend = n, function() {
				e.unsuspend = null, clearTimeout(r), clearTimeout(i);
			};
		} : null;
	}
	function th(e) {
		if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
			if (e.stylesheets) ah(e, e.stylesheets);
			else if (e.unsuspend) {
				var t = e.unsuspend;
				e.unsuspend = null, t();
			}
		}
	}
	function nh() {
		this.count--, th(this);
	}
	function rh() {
		this.imgCount--, th(this);
	}
	var ih = null;
	function ah(e, t) {
		e.stylesheets = null, e.unsuspend !== null && (e.count++, ih = /* @__PURE__ */ new Map(), t.forEach(oh, e), ih = null, nh.call(e));
	}
	function oh(e, t) {
		if (!(t.state.loading & 4)) {
			var n = ih.get(e);
			if (n) var r = n.get(null);
			else {
				n = /* @__PURE__ */ new Map(), ih.set(e, n);
				for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
					var o = i[a];
					(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
				}
				r && n.set(null, r);
			}
			i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(null, i), n.set(o, i), this.count++, r = nh.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= 4;
		}
	}
	var sh = {
		$$typeof: se,
		Provider: null,
		Consumer: null,
		_currentValue: Ce,
		_currentValue2: Ce,
		_threadCount: 0
	};
	function ch(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = yt(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = yt(0), this.hiddenUpdates = yt(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function lh(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new ch(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = Bi(3, null, null, t), e.current = a, a.stateNode = e, t = Fa(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, _o(a), e;
	}
	function uh(e) {
		return e ? (e = Ri, e) : Ri;
	}
	function dh(e, t, n, r, i, a) {
		i = uh(i), r.context === null ? r.context = i : r.pendingContext = i, r = yo(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = bo(e, r, t), n !== null && (Fd(n, e, t), xo(n, e, t));
	}
	function fh(e, t) {
		if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
			var n = e.retryLane;
			e.retryLane = n !== 0 && n < t ? n : t;
		}
	}
	function ph(e, t) {
		fh(e, t), (e = e.alternate) && fh(e, t);
	}
	function mh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Fi(e, 67108864);
			t !== null && Fd(t, e, 67108864), ph(e, 67108864);
		}
	}
	function hh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Md();
			t = Tt(t);
			var n = Fi(e, t);
			n !== null && Fd(n, e, t), ph(e, t);
		}
	}
	var gh = !0;
	function _h(e, t, n, r) {
		var i = O.T;
		O.T = null;
		var a = k.p;
		try {
			k.p = 2, yh(e, t, n, r);
		} finally {
			k.p = a, O.T = i;
		}
	}
	function vh(e, t, n, r) {
		var i = O.T;
		O.T = null;
		var a = k.p;
		try {
			k.p = 8, yh(e, t, n, r);
		} finally {
			k.p = a, O.T = i;
		}
	}
	function yh(e, t, n, r) {
		if (gh) {
			var i = bh(r);
			if (i === null) qf(e, t, r, xh, n), Mh(e, r);
			else if (Ph(i, e, t, n, r)) r.stopPropagation();
			else if (Mh(e, r), t & 4 && -1 < jh.indexOf(e)) {
				for (; i !== null;) {
					var a = Vt(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = pt(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - ot(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									Df(a), !(G & 6) && (_d = Je() + 500, Of(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = Fi(a, 2), s !== null && Fd(s, a, 2), Bd(), ph(a, 2);
					}
					if (a = bh(r), a === null && qf(e, t, r, xh, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else qf(e, t, r, null, n);
		}
	}
	function bh(e) {
		return e = On(e), Sh(e);
	}
	var xh = null;
	function Sh(e) {
		if (xh = null, e = Bt(e), e !== null) {
			var t = o(e);
			if (t === null) e = null;
			else {
				var n = t.tag;
				if (n === 13) {
					if (e = s(t), e !== null) return e;
					e = null;
				} else if (n === 31) {
					if (e = c(t), e !== null) return e;
					e = null;
				} else if (n === 3) {
					if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
					e = null;
				} else t !== e && (e = null);
			}
		}
		return xh = e, null;
	}
	function Ch(e) {
		switch (e) {
			case "beforetoggle":
			case "cancel":
			case "click":
			case "close":
			case "contextmenu":
			case "copy":
			case "cut":
			case "auxclick":
			case "dblclick":
			case "dragend":
			case "dragstart":
			case "drop":
			case "focusin":
			case "focusout":
			case "input":
			case "invalid":
			case "keydown":
			case "keypress":
			case "keyup":
			case "mousedown":
			case "mouseup":
			case "paste":
			case "pause":
			case "play":
			case "pointercancel":
			case "pointerdown":
			case "pointerup":
			case "ratechange":
			case "reset":
			case "seeked":
			case "submit":
			case "toggle":
			case "touchcancel":
			case "touchend":
			case "touchstart":
			case "volumechange":
			case "change":
			case "selectionchange":
			case "textInput":
			case "compositionstart":
			case "compositionend":
			case "compositionupdate":
			case "beforeblur":
			case "afterblur":
			case "beforeinput":
			case "blur":
			case "fullscreenchange":
			case "fullscreenerror":
			case "focus":
			case "hashchange":
			case "popstate":
			case "select":
			case "selectstart": return 2;
			case "drag":
			case "dragenter":
			case "dragexit":
			case "dragleave":
			case "dragover":
			case "mousemove":
			case "mouseout":
			case "mouseover":
			case "pointermove":
			case "pointerout":
			case "pointerover":
			case "resize":
			case "scroll":
			case "touchmove":
			case "wheel":
			case "mouseenter":
			case "mouseleave":
			case "pointerenter":
			case "pointerleave": return 8;
			case "message": switch (Ye()) {
				case Xe: return 2;
				case Ze: return 8;
				case Qe:
				case $e: return 32;
				case et: return 268435456;
				default: return 32;
			}
			default: return 32;
		}
	}
	var wh = !1, Th = null, Eh = null, Dh = null, Oh = /* @__PURE__ */ new Map(), kh = /* @__PURE__ */ new Map(), Ah = [], jh = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
	function Mh(e, t) {
		switch (e) {
			case "focusin":
			case "focusout":
				Th = null;
				break;
			case "dragenter":
			case "dragleave":
				Eh = null;
				break;
			case "mouseover":
			case "mouseout":
				Dh = null;
				break;
			case "pointerover":
			case "pointerout":
				Oh.delete(t.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": kh.delete(t.pointerId);
		}
	}
	function Nh(e, t, n, r, i, a) {
		return e === null || e.nativeEvent !== a ? (e = {
			blockedOn: t,
			domEventName: n,
			eventSystemFlags: r,
			nativeEvent: a,
			targetContainers: [i]
		}, t !== null && (t = Vt(t), t !== null && mh(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
	}
	function Ph(e, t, n, r, i) {
		switch (t) {
			case "focusin": return Th = Nh(Th, e, t, n, r, i), !0;
			case "dragenter": return Eh = Nh(Eh, e, t, n, r, i), !0;
			case "mouseover": return Dh = Nh(Dh, e, t, n, r, i), !0;
			case "pointerover":
				var a = i.pointerId;
				return Oh.set(a, Nh(Oh.get(a) || null, e, t, n, r, i)), !0;
			case "gotpointercapture": return a = i.pointerId, kh.set(a, Nh(kh.get(a) || null, e, t, n, r, i)), !0;
		}
		return !1;
	}
	function Fh(e) {
		var t = Bt(e.target);
		if (t !== null) {
			var n = o(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = s(n), t !== null) {
						e.blockedOn = t, Ot(e.priority, function() {
							hh(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = c(n), t !== null) {
						e.blockedOn = t, Ot(e.priority, function() {
							hh(n);
						});
						return;
					}
				} else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
					e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
					return;
				}
			}
		}
		e.blockedOn = null;
	}
	function Ih(e) {
		if (e.blockedOn !== null) return !1;
		for (var t = e.targetContainers; 0 < t.length;) {
			var n = bh(e.nativeEvent);
			if (n === null) {
				n = e.nativeEvent;
				var r = new n.constructor(n.type, n);
				Dn = r, n.target.dispatchEvent(r), Dn = null;
			} else return t = Vt(n), t !== null && mh(t), e.blockedOn = n, !1;
			t.shift();
		}
		return !0;
	}
	function Lh(e, t, n) {
		Ih(e) && n.delete(t);
	}
	function Rh() {
		wh = !1, Th !== null && Ih(Th) && (Th = null), Eh !== null && Ih(Eh) && (Eh = null), Dh !== null && Ih(Dh) && (Dh = null), Oh.forEach(Lh), kh.forEach(Lh);
	}
	function zh(e, n) {
		e.blockedOn === n && (e.blockedOn = null, wh || (wh = !0, t.unstable_scheduleCallback(t.unstable_NormalPriority, Rh)));
	}
	var Bh = null;
	function Vh(e) {
		Bh !== e && (Bh = e, t.unstable_scheduleCallback(t.unstable_NormalPriority, function() {
			Bh === e && (Bh = null);
			for (var t = 0; t < e.length; t += 3) {
				var n = e[t], r = e[t + 1], i = e[t + 2];
				if (typeof r != "function") {
					if (Sh(r || n) === null) continue;
					break;
				}
				var a = Vt(n);
				a !== null && (e.splice(t, 3), t -= 3, tc(a, {
					pending: !0,
					data: i,
					method: n.method,
					action: r
				}, r, i));
			}
		}));
	}
	function Hh(e) {
		function t(t) {
			return zh(t, e);
		}
		Th !== null && zh(Th, e), Eh !== null && zh(Eh, e), Dh !== null && zh(Dh, e), Oh.forEach(t), kh.forEach(t);
		for (var n = 0; n < Ah.length; n++) {
			var r = Ah[n];
			r.blockedOn === e && (r.blockedOn = null);
		}
		for (; 0 < Ah.length && (n = Ah[0], n.blockedOn === null);) Fh(n), n.blockedOn === null && Ah.shift();
		if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
			var i = n[r], a = n[r + 1], o = i[jt] || null;
			if (typeof a == "function") o || Vh(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[jt] || null) s = o.formAction;
					else if (Sh(i) !== null) continue;
				} else s = o.action;
				typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), Vh(n);
			}
		}
	}
	function Uh() {
		function e(e) {
			e.canIntercept && e.info === "react-transition" && e.intercept({
				handler: function() {
					return new Promise(function(e) {
						return i = e;
					});
				},
				focusReset: "manual",
				scroll: "manual"
			});
		}
		function t() {
			i !== null && (i(), i = null), r || setTimeout(n, 20);
		}
		function n() {
			if (!r && !navigation.transition) {
				var e = navigation.currentEntry;
				e && e.url != null && navigation.navigate(e.url, {
					state: e.getState(),
					info: "react-transition",
					history: "replace"
				});
			}
		}
		if (typeof navigation == "object") {
			var r = !1, i = null;
			return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
				r = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), i !== null && (i(), i = null);
			};
		}
	}
	function Wh(e) {
		this._internalRoot = e;
	}
	Gh.prototype.render = Wh.prototype.render = function(e) {
		var t = this._internalRoot;
		if (t === null) throw Error(i(409));
		var n = t.current;
		dh(n, Md(), e, t, null, null);
	}, Gh.prototype.unmount = Wh.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			dh(e.current, 2, null, e, null, null), Bd(), t[Mt] = null;
		}
	};
	function Gh(e) {
		this._internalRoot = e;
	}
	Gh.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = Dt();
			e = {
				blockedOn: null,
				target: e,
				priority: t
			};
			for (var n = 0; n < Ah.length && t !== 0 && t < Ah[n].priority; n++);
			Ah.splice(n, 0, e), n === 0 && Fh(e);
		}
	};
	var Kh = n.version;
	if (Kh !== "19.3.0") throw Error(i(527, Kh, "19.3.0"));
	k.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(i(188)) : (e = Object.keys(e).join(","), Error(i(268, e)));
		return e = d(t), e = e === null ? null : p(e), e = e === null ? null : e.stateNode, e;
	};
	var qh = {
		bundleType: 0,
		version: "19.3.0",
		rendererPackageName: "react-dom",
		currentDispatcherRef: O,
		reconcilerVersion: "19.3.0"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var Jh = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!Jh.isDisabled && Jh.supportsFiber) try {
			rt = Jh.inject(qh), it = Jh;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!a(e)) throw Error(i(299));
		var n = !1, r = "", o = wc, s = Tc, c = Ec;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (s = t.onCaughtError), t.onRecoverableError !== void 0 && (c = t.onRecoverableError)), t = lh(e, 1, !1, null, null, n, r, null, o, s, c, Uh), e[Mt] = t.current, Gf(e), new Wh(t);
	};
})), g = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = h();
})), _ = /* @__PURE__ */ c(f(), 1), v = /^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i, y = /^[\\/]{2}/;
function b(e, t) {
	return t + e.replace(/\\/g, "/");
}
var x = "popstate";
function S(e) {
	return typeof e == "object" && !!e && "pathname" in e && "search" in e && "hash" in e && "state" in e && "key" in e;
}
function C(e = {}) {
	function t(e, t) {
		let { pathname: n = "/", search: r = "", hash: i = "" } = ne(e.location.hash.substring(1));
		return !n.startsWith("/") && !n.startsWith(".") && (n = "/" + n), ee("", {
			pathname: n,
			search: r,
			hash: i
		}, t.state && t.state.usr || null, t.state && t.state.key || "default");
	}
	function n(e, t) {
		let n = e.document.querySelector("base"), r = "";
		if (n && n.getAttribute("href")) {
			let t = e.location.href, n = t.indexOf("#");
			r = n === -1 ? t : t.slice(0, n);
		}
		return r + "#" + (typeof t == "string" ? t : te(t));
	}
	function r(e, t) {
		T(e.pathname.charAt(0) === "/", `relative pathnames are not supported in hash history.push(${JSON.stringify(t)})`);
	}
	return re(t, n, r, e);
}
function w(e, t) {
	if (e === !1 || e == null) throw Error(t);
}
function T(e, t) {
	if (!e) {
		typeof console < "u" && console.warn(t);
		try {
			throw Error(t);
		} catch {}
	}
}
function E() {
	return Math.random().toString(36).substring(2, 10);
}
function D(e, t) {
	return {
		usr: e.state,
		key: e.key,
		idx: t,
		masked: e.mask ? {
			pathname: e.pathname,
			search: e.search,
			hash: e.hash
		} : void 0
	};
}
function ee(e, t, n = null, r, i) {
	return {
		pathname: typeof e == "string" ? e : e.pathname,
		search: "",
		hash: "",
		...typeof t == "string" ? ne(t) : t,
		state: n,
		key: t && t.key || r || E(),
		mask: i
	};
}
function te({ pathname: e = "/", search: t = "", hash: n = "" }) {
	return t && t !== "?" && (e += t.charAt(0) === "?" ? t : "?" + t), n && n !== "#" && (e += n.charAt(0) === "#" ? n : "#" + n), e;
}
function ne(e) {
	let t = {};
	if (e) {
		let n = e.indexOf("#");
		n >= 0 && (t.hash = e.substring(n), e = e.substring(0, n));
		let r = e.indexOf("?");
		r >= 0 && (t.search = e.substring(r), e = e.substring(0, r)), e && (t.pathname = e);
	}
	return t;
}
function re(e, t, n, r = {}) {
	let { window: i = document.defaultView, v5Compat: a = !1 } = r, o = i.history, s = "POP", c = null, l = u();
	l ?? (l = 0, o.replaceState({
		...o.state,
		idx: l
	}, ""));
	function u() {
		return (o.state || { idx: null }).idx;
	}
	function d() {
		s = "POP";
		let e = u(), t = e == null ? null : e - l;
		l = e, c && c({
			action: s,
			location: h.location,
			delta: t
		});
	}
	function f(e, t) {
		s = "PUSH";
		let r = S(e) ? e : ee(h.location, e, t);
		n && n(r, e), l = u() + 1;
		let d = D(r, l), f = h.createHref(r.mask || r);
		try {
			o.pushState(d, "", f);
		} catch (e) {
			if (e instanceof DOMException && e.name === "DataCloneError") throw e;
			i.location.assign(f);
		}
		a && c && c({
			action: s,
			location: h.location,
			delta: 1
		});
	}
	function p(e, t) {
		s = "REPLACE";
		let r = S(e) ? e : ee(h.location, e, t);
		n && n(r, e), l = u();
		let i = D(r, l), d = h.createHref(r.mask || r);
		o.replaceState(i, "", d), a && c && c({
			action: s,
			location: h.location,
			delta: 0
		});
	}
	function m(e) {
		return ie(i, e);
	}
	let h = {
		get action() {
			return s;
		},
		get location() {
			return e(i, o);
		},
		listen(e) {
			if (c) throw Error("A history only accepts one active listener");
			return i.addEventListener(x, d), c = e, () => {
				i.removeEventListener(x, d), c = null;
			};
		},
		createHref(e) {
			return t(i, e);
		},
		createURL: m,
		encodeLocation(e) {
			let t = m(e);
			return {
				pathname: t.pathname,
				search: t.search,
				hash: t.hash
			};
		},
		push: f,
		replace: p,
		go(e) {
			return o.go(e);
		}
	};
	return h;
}
function ie(e, t, n = !1) {
	let r = "http://localhost";
	e && (r = e.location.origin === "null" ? e.location.href : e.location.origin), w(r, "No window.location.(origin|href) available to create URL");
	let i = typeof t == "string" ? t : te(t);
	return i = i.replace(/ $/, "%20"), !n && y.test(i) && (i = r + i), new URL(i, r);
}
function ae(e, t, n = "/") {
	return oe(e, t, n, !1);
}
function oe(e, t, n, r, i) {
	let a = Ce((typeof t == "string" ? ne(t) : t).pathname || "/", n);
	if (a == null) return null;
	let o = i ?? se(e), s = null, c = k(a);
	for (let e = 0; s == null && e < o.length; ++e) s = be(o[e], c, r);
	return s;
}
function se(e) {
	let t = ce(e);
	return ue(t), t;
}
function ce(e, t = [], n = [], r = "", i = !1) {
	let a = (e, a, o = i, s) => {
		let c = {
			relativePath: s === void 0 ? e.path || "" : s,
			caseSensitive: e.caseSensitive === !0,
			childrenIndex: a,
			route: e
		};
		if (c.relativePath.startsWith("/")) {
			if (!c.relativePath.startsWith(r) && o) return;
			w(c.relativePath.startsWith(r), `Absolute route path "${c.relativePath}" nested under path "${r}" is not valid. An absolute child route path must start with the combined path of all its parent routes.`), c.relativePath = c.relativePath.slice(r.length);
		}
		let l = Ae([r, c.relativePath]), u = n.concat(c);
		e.children && e.children.length > 0 && (w(e.index !== !0, `Index routes must not have child routes. Please remove all child routes from route path "${l}".`), ce(e.children, t, u, l, o)), (e.path != null || e.index) && t.push({
			path: l,
			score: ve(l, e.index),
			routesMeta: u.map((e, t) => {
				let [n, r] = O(e.relativePath, e.caseSensitive, t === u.length - 1);
				return {
					...e,
					matcher: n,
					compiledParams: r
				};
			})
		});
	};
	return e.forEach((e, t) => {
		if (e.path === "" || !e.path?.includes("?")) a(e, t);
		else for (let n of le(e.path)) a(e, t, !0, n);
	}), t;
}
function le(e) {
	let t = e.split("/");
	if (t.length === 0) return [];
	let [n, ...r] = t, i = n.endsWith("?"), a = n.replace(/\?$/, "");
	if (r.length === 0) return i ? [a, ""] : [a];
	let o = le(r.join("/")), s = [];
	return s.push(...o.map((e) => e === "" ? a : [a, e].join("/"))), i && s.push(...o), s.map((t) => e.startsWith("/") && t === "" ? "/" : t);
}
function ue(e) {
	e.sort((e, t) => e.score === t.score ? ye(e.routesMeta.map((e) => e.childrenIndex), t.routesMeta.map((e) => e.childrenIndex)) : t.score - e.score);
}
var de = /^:[\w-]+$/, fe = 3, pe = 2, me = 1, he = 10, ge = -2, _e = (e) => e === "*";
function ve(e, t) {
	let n = e.split("/"), r = n.length;
	return n.some(_e) && (r += ge), t && (r += pe), n.filter((e) => !_e(e)).reduce((e, t) => e + (de.test(t) ? fe : t === "" ? me : he), r);
}
function ye(e, t) {
	return e.length === t.length && e.slice(0, -1).every((e, n) => e === t[n]) ? e[e.length - 1] - t[t.length - 1] : 0;
}
function be(e, t, n = !1) {
	let { routesMeta: r } = e, i = {}, a = "/", o = [];
	for (let e = 0; e < r.length; ++e) {
		let s = r[e], c = e === r.length - 1, l = a === "/" ? t : t.slice(a.length) || "/", u = {
			path: s.relativePath,
			caseSensitive: s.caseSensitive,
			end: c
		}, d = s.matcher && s.compiledParams ? Se(u, l, s.matcher, s.compiledParams) : xe(u, l), f = s.route;
		if (!d && c && n && !r[r.length - 1].route.index && (d = xe({
			path: s.relativePath,
			caseSensitive: s.caseSensitive,
			end: !1
		}, l)), !d) return null;
		Object.assign(i, d.params), o.push({
			params: i,
			pathname: Ae([a, d.pathname]),
			pathnameBase: Me(Ae([a, d.pathnameBase])),
			route: f
		}), d.pathnameBase !== "/" && (a = Ae([a, d.pathnameBase]));
	}
	return o;
}
function xe(e, t) {
	typeof e == "string" && (e = {
		path: e,
		caseSensitive: !1,
		end: !0
	});
	let [n, r] = O(e.path, e.caseSensitive, e.end);
	return Se(e, t, n, r);
}
function Se(e, t, n, r) {
	let i = t.match(n);
	if (!i) return null;
	let a = i[0], o = je(a, 1), s = i.slice(1);
	return {
		params: r.reduce((e, { paramName: t, isOptional: n }, r) => {
			if (t === "*") {
				let e = s[r] || "";
				o = je(a.slice(0, a.length - e.length), 1);
			}
			let i = s[r];
			return e[t] = n && !i ? void 0 : (i || "").replace(/%2F/g, "/"), e;
		}, {}),
		pathname: a,
		pathnameBase: o,
		pattern: e
	};
}
function O(e, t = !1, n = !0) {
	T(e === "*" || !e.endsWith("*") || e.endsWith("/*"), `Route path "${e}" will be treated as if it were "${e.replace(/\*$/, "/*")}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${e.replace(/\*$/, "/*")}".`);
	let r = [], i = "^" + e.replace(/\/*\*?$/, "").replace(/^\/*/, "/").replace(/[\\.*+^${}|()[\]]/g, "\\$&").replace(/\/:([\w-]+)(\?)?/g, (e, t, n, i, a) => {
		if (r.push({
			paramName: t,
			isOptional: n != null
		}), n) {
			let t = a.charAt(i + e.length);
			return t && t !== "/" ? "/([^\\/]*)" : "(?:/([^\\/]*))?";
		}
		return "/([^\\/]+)";
	}).replace(/\/([\w-]+)\?(\/|$)/g, "(/$1)?$2");
	return e.endsWith("*") ? (r.push({ paramName: "*" }), i += e === "*" || e === "/*" ? "(.*)$" : "(?:\\/(.+)|\\/*)$") : n ? i += "\\/*$" : e !== "" && e !== "/" && (i += "(?:(?=\\/|$))"), [new RegExp(i, t ? void 0 : "i"), r];
}
function k(e) {
	try {
		return e.split("/").map((e) => decodeURIComponent(e).replace(/\//g, "%2F")).join("/");
	} catch (t) {
		return T(!1, `The URL path "${e}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${t}).`), e;
	}
}
function Ce(e, t) {
	if (t === "/") return e;
	if (!e.toLowerCase().startsWith(t.toLowerCase())) return null;
	let n = t.endsWith("/") ? t.length - 1 : t.length, r = e.charAt(n);
	return r && r !== "/" ? null : e.slice(n) || "/";
}
function we(e, t = "/") {
	let { pathname: n, search: r = "", hash: i = "" } = typeof e == "string" ? ne(e) : e, a;
	return n ? (n = ke(n), a = n.startsWith("/") || n.startsWith("\\") ? Te(n.substring(1), "/") : Te(n, t)) : a = t, {
		pathname: a,
		search: Ne(r),
		hash: Pe(i)
	};
}
function Te(e, t) {
	let n = je(t).split("/");
	return e.split("/").forEach((e) => {
		e === ".." ? n.length > 1 && n.pop() : e !== "." && n.push(e);
	}), n.length > 1 ? n.join("/") : "/";
}
function Ee(e, t, n, r) {
	return `Cannot include a '${e}' character in a manually specified \`to.${t}\` field [${JSON.stringify(r)}].  Please separate it out to the \`to.${n}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`;
}
function De(e) {
	return e.filter((e, t) => t === 0 || e.route.path && e.route.path.length > 0);
}
function A(e) {
	let t = De(e);
	return t.map((e, n) => n === t.length - 1 ? e.pathname : e.pathnameBase);
}
function Oe(e, t, n, r = !1) {
	let i;
	typeof e == "string" ? i = ne(e) : (i = { ...e }, w(!i.pathname || !i.pathname.includes("?"), Ee("?", "pathname", "search", i)), w(!i.pathname || !i.pathname.includes("#"), Ee("#", "pathname", "hash", i)), w(!i.search || !i.search.includes("#"), Ee("#", "search", "hash", i)));
	let a = e === "" || i.pathname === "", o = a ? "/" : i.pathname, s;
	if (o == null) s = n;
	else {
		let e = t.length - 1;
		if (!r && o.startsWith("..")) {
			let t = o.split("/");
			for (; t[0] === "..";) t.shift(), --e;
			i.pathname = t.join("/");
		}
		s = e >= 0 ? t[e] : "/";
	}
	let c = we(i, s), l = o && o !== "/" && o.endsWith("/"), u = (a || o === ".") && n.endsWith("/");
	return !c.pathname.endsWith("/") && (l || u) && (c.pathname += "/"), c;
}
var ke = (e) => e.replace(/[\\/]{2,}/g, "/"), Ae = (e) => ke(e.join("/"));
function je(e, t = 0) {
	let n = e.length;
	for (; n > t && e.charCodeAt(n - 1) === 47;) n--;
	return n === e.length ? e : e.slice(0, n);
}
var Me = (e) => je(e).replace(/^\/*/, "/"), Ne = (e) => !e || e === "?" ? "" : e.startsWith("?") ? e : "?" + e, Pe = (e) => !e || e === "#" ? "" : e.startsWith("#") ? e : "#" + e, Fe = class {
	constructor(e, t, n, r = !1) {
		this.status = e, this.statusText = t || "", this.internal = r, n instanceof Error ? (this.data = n.toString(), this.error = n) : this.data = n;
	}
};
function Ie(e) {
	return e != null && typeof e.status == "number" && typeof e.statusText == "string" && typeof e.internal == "boolean" && "data" in e;
}
function Le(e) {
	return Ae(e.map((e) => e.route.path).filter(Boolean)) || "/";
}
var Re = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0;
function ze(e, t) {
	let n = e;
	if (typeof n != "string" || !v.test(n)) return {
		absoluteURL: void 0,
		isExternal: !1,
		to: n
	};
	let r = n, i = !1;
	if (Re) try {
		let e = new URL(window.location.href), r = y.test(n) ? new URL(b(n, e.protocol)) : new URL(n), a = Ce(r.pathname, t);
		r.origin === e.origin && a != null ? n = a + r.search + r.hash : i = !0;
	} catch {
		T(!1, `<Link to="${n}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`);
	}
	return {
		absoluteURL: r,
		isExternal: i,
		to: n
	};
}
Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
var Be = new URL("http://localhost");
function Ve(e) {
	if (e.createURL) return e.createURL("/");
	try {
		return new URL(e.createHref("/"), Be);
	} catch {
		return Be;
	}
}
function He(e, t) {
	return e.origin === t.origin && (e.origin !== "null" || e.protocol === t.protocol && e.host === t.host);
}
function Ue(e, t) {
	if (e.startsWith("//")) return !0;
	let n = t.protocol.toLowerCase();
	return e.toLowerCase().startsWith(n) ? t.host === "" || e.slice(n.length).startsWith("//") : !1;
}
function We(e, t, n, r) {
	let i = null;
	try {
		i = e == null ? null : new URL(e, n);
	} catch {}
	let a = new URL(t, n), o = i != null && !He(i, n), s = !He(a, n);
	if (r === "reject") {
		if (o || s) throw Error("External navigation is not allowed");
	} else if (s && (i == null || !Ue(e, i) || !He(i, a))) throw Error("External navigation is not allowed");
}
var Ge = [
	"POST",
	"PUT",
	"PATCH",
	"DELETE"
];
new Set(Ge);
var Ke = ["GET", ...Ge];
new Set(Ke);
var qe = [
	"about:",
	"blob:",
	"chrome:",
	"chrome-untrusted:",
	"content:",
	"data:",
	"devtools:",
	"file:",
	"filesystem:",
	"javascript:"
];
function Je(e) {
	try {
		return qe.includes(new URL(e).protocol);
	} catch {
		return !1;
	}
}
var Ye = _.createContext(null);
Ye.displayName = "DataRouter";
var Xe = _.createContext(null);
Xe.displayName = "DataRouterState";
var Ze = _.createContext(!1);
function Qe() {
	return _.useContext(Ze);
}
var $e = _.createContext({ isTransitioning: !1 });
$e.displayName = "ViewTransition";
var et = _.createContext(/* @__PURE__ */ new Map());
et.displayName = "Fetchers";
var tt = _.createContext(null);
tt.displayName = "Await";
var nt = _.createContext(null);
nt.displayName = "Navigation";
var rt = _.createContext(null);
rt.displayName = "Location";
var it = _.createContext({
	outlet: null,
	matches: [],
	isDataRoute: !1
});
it.displayName = "Route";
var at = _.createContext(null);
at.displayName = "RouteError";
var ot = "REACT_ROUTER_ERROR", st = "REDIRECT", ct = "ROUTE_ERROR_RESPONSE";
function lt(e) {
	if (e.startsWith(`${ot}:${st}:{`)) try {
		let t = JSON.parse(e.slice(28));
		if (typeof t == "object" && t && typeof t.status == "number" && typeof t.statusText == "string" && typeof t.location == "string" && typeof t.reloadDocument == "boolean" && typeof t.replace == "boolean") return t;
	} catch {}
}
function ut(e) {
	if (e.startsWith(`${ot}:${ct}:{`)) try {
		let t = JSON.parse(e.slice(40));
		if (typeof t == "object" && t && typeof t.status == "number" && typeof t.statusText == "string") return new Fe(t.status, t.statusText, t.data);
	} catch {}
}
function dt(e, { relative: t } = {}) {
	w(ft(), "useHref() may be used only in the context of a <Router> component.");
	let { basename: n, navigator: r } = _.useContext(nt), { hash: i, pathname: a, search: o } = bt(e, { relative: t }), s = a;
	return n !== "/" && (s = a === "/" ? n : Ae([n, a])), r.createHref({
		pathname: s,
		search: o,
		hash: i
	});
}
function ft() {
	return _.useContext(rt) != null;
}
function pt() {
	return w(ft(), "useLocation() may be used only in the context of a <Router> component."), _.useContext(rt).location;
}
var mt = "You should call navigate() in a React.useEffect(), not when your component is first rendered.";
function ht(e) {
	_.useContext(nt).static || _.useLayoutEffect(e);
}
function gt() {
	let { isDataRoute: e } = _.useContext(it);
	return e ? Lt() : _t();
}
function _t() {
	w(ft(), "useNavigate() may be used only in the context of a <Router> component.");
	let e = _.useContext(Ye), { basename: t, navigator: n } = _.useContext(nt), { matches: r } = _.useContext(it), { pathname: i } = pt(), a = JSON.stringify(A(r)), o = _.useRef(!1);
	return ht(() => {
		o.current = !0;
	}), _.useCallback((r, s = {}) => {
		if (T(o.current, mt), !o.current) return;
		if (typeof r == "number") {
			n.go(r);
			return;
		}
		let c = Oe(r, JSON.parse(a), i, s.relative === "path");
		e == null && t !== "/" && (c.pathname = c.pathname === "/" ? t : Ae([t, c.pathname])), We(typeof r == "string" ? r : te(r), n.createHref(c), Ve(n), "reject"), (s.replace ? n.replace : n.push)(c, s.state, s);
	}, [
		t,
		n,
		a,
		i,
		e
	]);
}
var vt = _.createContext(null);
function yt(e) {
	let t = _.useContext(it).outlet;
	return _.useMemo(() => t && /* @__PURE__ */ _.createElement(vt.Provider, { value: e }, t), [t, e]);
}
function bt(e, { relative: t } = {}) {
	let { matches: n } = _.useContext(it), { pathname: r } = pt(), i = JSON.stringify(A(n));
	return _.useMemo(() => Oe(e, JSON.parse(i), r, t === "path"), [
		e,
		i,
		r,
		t
	]);
}
function xt(e, t) {
	return St(e, t);
}
function St(e, t, n) {
	w(ft(), "useRoutes() may be used only in the context of a <Router> component.");
	let { navigator: r } = _.useContext(nt), { matches: i } = _.useContext(it), a = i[i.length - 1], o = a ? a.params : {}, s = a ? a.pathname : "/", c = a ? a.pathnameBase : "/", l = a && a.route;
	{
		let e = l && l.path || "";
		zt(s, !l || e.endsWith("*") || e.endsWith("*?"), `You rendered descendant <Routes> (or called \`useRoutes()\`) at "${s}" (under <Route path="${e}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${e}"> to <Route path="${e === "/" ? "*" : `${e}/*`}">.`);
	}
	let u = pt(), d;
	if (t) {
		let e = typeof t == "string" ? ne(t) : t;
		w(c === "/" || e.pathname?.startsWith(c), `When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, the location pathname must begin with the portion of the URL pathname that was matched by all parent routes. The current pathname base is "${c}" but pathname "${e.pathname}" was given in the \`location\` prop.`), d = e;
	} else d = u;
	let f = d.pathname || "/", p = f;
	if (c !== "/") {
		let e = c.replace(/^\//, "").split("/");
		p = "/" + f.replace(/^\//, "").split("/").slice(e.length).join("/");
	}
	let m = n && n.state.matches.length ? n.state.matches.map((e) => Object.assign(e, { route: n.manifest[e.route.id] || e.route })) : ae(e, { pathname: p });
	T(l || m != null, `No routes matched location "${d.pathname}${d.search}${d.hash}" `), T(m == null || m[m.length - 1].route.element !== void 0 || m[m.length - 1].route.Component !== void 0 || m[m.length - 1].route.lazy !== void 0, `Matched leaf route at location "${d.pathname}${d.search}${d.hash}" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`);
	let h = kt(m && m.map((e) => Object.assign({}, e, {
		params: Object.assign({}, o, e.params),
		pathname: Ae([c, r.encodeLocation ? r.encodeLocation(e.pathname.replace(/%/g, "%25").replace(/\?/g, "%3F").replace(/#/g, "%23")).pathname : e.pathname]),
		pathnameBase: e.pathnameBase === "/" ? c : Ae([c, r.encodeLocation ? r.encodeLocation(e.pathnameBase.replace(/%/g, "%25").replace(/\?/g, "%3F").replace(/#/g, "%23")).pathname : e.pathnameBase])
	})), i, n);
	return t && h ? /* @__PURE__ */ _.createElement(rt.Provider, { value: {
		location: {
			pathname: "/",
			search: "",
			hash: "",
			state: null,
			key: "default",
			mask: void 0,
			...d
		},
		navigationType: "POP"
	} }, h) : h;
}
function Ct() {
	let e = It(), t = Ie(e) ? `${e.status} ${e.statusText}` : e instanceof Error ? e.message : JSON.stringify(e), n = e instanceof Error ? e.stack : null, r = "rgba(200,200,200, 0.5)", i = {
		padding: "0.5rem",
		backgroundColor: r
	}, a = {
		padding: "2px 4px",
		backgroundColor: r
	}, o = null;
	return console.error("Error handled by React Router default ErrorBoundary:", e), o = /* @__PURE__ */ _.createElement(_.Fragment, null, /* @__PURE__ */ _.createElement("p", null, "💿 Hey developer 👋"), /* @__PURE__ */ _.createElement("p", null, "You can provide a way better UX than this when your app throws errors by providing your own ", /* @__PURE__ */ _.createElement("code", { style: a }, "ErrorBoundary"), " or", " ", /* @__PURE__ */ _.createElement("code", { style: a }, "errorElement"), " prop on your route.")), /* @__PURE__ */ _.createElement(_.Fragment, null, /* @__PURE__ */ _.createElement("h2", null, "Unexpected Application Error!"), /* @__PURE__ */ _.createElement("h3", { style: { fontStyle: "italic" } }, t), n ? /* @__PURE__ */ _.createElement("pre", { style: i }, n) : null, o);
}
var wt = /* @__PURE__ */ _.createElement(Ct, null), Tt = class extends _.Component {
	constructor(e) {
		super(e), this.state = {
			location: e.location,
			revalidation: e.revalidation,
			error: e.error
		};
	}
	static getDerivedStateFromError(e) {
		return { error: e };
	}
	static getDerivedStateFromProps(e, t) {
		return t.location !== e.location || t.revalidation !== "idle" && e.revalidation === "idle" ? {
			error: e.error,
			location: e.location,
			revalidation: e.revalidation
		} : {
			error: e.error === void 0 ? t.error : e.error,
			location: t.location,
			revalidation: e.revalidation || t.revalidation
		};
	}
	componentDidCatch(e, t) {
		this.props.onError ? this.props.onError(e, t) : console.error("React Router caught the following error during render", e);
	}
	render() {
		let e = this.state.error;
		if (this.context && typeof e == "object" && e && "digest" in e && typeof e.digest == "string") {
			let t = ut(e.digest);
			t && (e = t);
		}
		let t = e === void 0 ? this.props.children : /* @__PURE__ */ _.createElement(it.Provider, { value: this.props.routeContext }, /* @__PURE__ */ _.createElement(at.Provider, {
			value: e,
			children: this.props.component
		}));
		return this.context ? /* @__PURE__ */ _.createElement(Dt, { error: e }, t) : t;
	}
};
Tt.contextType = Ze;
var Et = /* @__PURE__ */ new WeakMap();
function Dt({ children: e, error: t }) {
	let { basename: n, navigator: r } = _.useContext(nt);
	if (typeof t == "object" && t && "digest" in t && typeof t.digest == "string") {
		let e = lt(t.digest);
		if (e) {
			let i = Et.get(t);
			if (i) throw i;
			let a = ze(e.location, n), o = a.absoluteURL || a.to;
			if (We(e.location, o, Ve(r), "allow-explicit"), Je(o)) throw Error("Invalid redirect location");
			if (Re && !Et.get(t)) {
				if (a.isExternal || e.reloadDocument) window.location.href = o;
				else {
					let n = Promise.resolve().then(() => window.__reactRouterDataRouter.navigate(a.to, { replace: e.replace }));
					throw Et.set(t, n), n;
				}
			}
			return /* @__PURE__ */ _.createElement("meta", {
				httpEquiv: "refresh",
				content: `0;url=${o}`
			});
		}
	}
	return e;
}
function Ot({ routeContext: e, match: t, children: n }) {
	let r = _.useContext(Ye);
	return r && r.static && r.staticContext && (t.route.errorElement || t.route.ErrorBoundary) && (r.staticContext._deepestRenderedBoundaryId = t.route.id), /* @__PURE__ */ _.createElement(it.Provider, { value: e }, n);
}
function kt(e, t = [], n) {
	let r = n?.state;
	if (e == null) {
		if (!r) return null;
		if (r.errors) e = r.matches;
		else if (t.length === 0 && !r.initialized && r.matches.length > 0) e = r.matches;
		else return null;
	}
	let i = e, a = r?.errors;
	if (a != null) {
		let e = i.findIndex((e) => e.route.id && a?.[e.route.id] !== void 0);
		w(e >= 0, `Could not find a matching route for errors on route IDs: ${Object.keys(a).join(",")}`), i = i.slice(0, Math.min(i.length, e + 1));
	}
	let o = !1, s = -1;
	if (n && r) {
		o = r.renderFallback;
		for (let e = 0; e < i.length; e++) {
			let t = i[e];
			if ((t.route.HydrateFallback || t.route.hydrateFallbackElement) && (s = e), t.route.id) {
				let { loaderData: e, errors: a } = r, c = t.route.loader && !e.hasOwnProperty(t.route.id) && (!a || a[t.route.id] === void 0);
				if (t.route.lazy || c) {
					n.isStatic && (o = !0), i = s >= 0 ? i.slice(0, s + 1) : [i[0]];
					break;
				}
			}
		}
	}
	let c = n?.onError, l = r && c ? (e, t) => {
		c(e, {
			location: r.location,
			params: r.matches?.[0]?.params ?? {},
			pattern: Le(r.matches),
			errorInfo: t
		});
	} : void 0;
	return i.reduceRight((e, n, c) => {
		let u, d = !1, f = null, p = null;
		r && (u = a && n.route.id ? a[n.route.id] : void 0, f = n.route.errorElement || wt, o && (s < 0 && c === 0 ? (zt("route-fallback", !1, "No `HydrateFallback` element provided to render during initial hydration"), d = !0, p = null) : s === c && (d = !0, p = n.route.hydrateFallbackElement || null)));
		let m = t.concat(i.slice(0, c + 1)), h = () => {
			let t;
			return t = u ? f : d ? p : n.route.Component ? /* @__PURE__ */ _.createElement(n.route.Component, null) : n.route.element ? n.route.element : e, /* @__PURE__ */ _.createElement(Ot, {
				match: n,
				routeContext: {
					outlet: e,
					matches: m,
					isDataRoute: r != null
				},
				children: t
			});
		};
		return r && (n.route.ErrorBoundary || n.route.errorElement || c === 0) ? /* @__PURE__ */ _.createElement(Tt, {
			location: r.location,
			revalidation: r.revalidation,
			component: f,
			error: u,
			children: h(),
			routeContext: {
				outlet: null,
				matches: m,
				isDataRoute: !0
			},
			onError: l
		}) : h();
	}, null);
}
function At(e) {
	return `${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function jt(e) {
	let t = _.useContext(Ye);
	return w(t, At(e)), t;
}
function Mt(e) {
	let t = _.useContext(Xe);
	return w(t, At(e)), t;
}
function Nt(e) {
	let t = _.useContext(it);
	return w(t, At(e)), t;
}
function Pt(e) {
	let t = Nt(e), n = t.matches[t.matches.length - 1];
	return w(n.route.id, `${e} can only be used on routes that contain a unique "id"`), n.route.id;
}
function Ft() {
	return Pt("useRouteId");
}
function It() {
	let e = _.useContext(at), t = Mt("useRouteError"), n = Pt("useRouteError");
	return e === void 0 ? t.errors?.[n] : e;
}
function Lt() {
	let { router: e } = jt("useNavigate"), t = Pt("useNavigate"), n = _.useRef(!1);
	return ht(() => {
		n.current = !0;
	}), _.useCallback(async (r, i = {}) => {
		T(n.current, mt), n.current && (typeof r == "number" ? await e.navigate(r) : await e.navigate(r, {
			fromRouteId: t,
			...i
		}));
	}, [e, t]);
}
var Rt = {};
function zt(e, t, n) {
	!t && !Rt[e] && (Rt[e] = !0, T(!1, n));
}
_.memo(Bt);
function Bt({ routes: e, manifest: t, future: n, state: r, isStatic: i, onError: a }) {
	return St(e, void 0, {
		manifest: t,
		state: r,
		isStatic: i,
		onError: a,
		future: n
	});
}
function Vt({ to: e, replace: t, state: n, relative: r }) {
	w(ft(), "<Navigate> may be used only in the context of a <Router> component.");
	let { static: i, navigator: a } = _.useContext(nt);
	T(!i, "<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.");
	let { matches: o } = _.useContext(it), { pathname: s } = pt(), c = gt(), l = Oe(e, A(o), s, r === "path");
	We(typeof e == "string" ? e : te(e), a.createHref(l), Ve(a), "reject");
	let u = JSON.stringify(l);
	return _.useEffect(() => {
		c(JSON.parse(u), {
			replace: t,
			state: n,
			relative: r
		});
	}, [
		c,
		u,
		r,
		t,
		n
	]), null;
}
function Ht(e) {
	return yt(e.context);
}
function Ut(e) {
	w(!1, "A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.");
}
function Wt({ basename: e = "/", children: t = null, location: n, navigationType: r = "POP", navigator: i, static: a = !1, useTransitions: o }) {
	w(!ft(), "You cannot render a <Router> inside another <Router>. You should never have more than one in your app.");
	let s = e.replace(/^\/*/, "/"), c = _.useMemo(() => ({
		basename: s,
		navigator: i,
		static: a,
		useTransitions: o,
		future: {}
	}), [
		s,
		i,
		a,
		o
	]);
	typeof n == "string" && (n = ne(n));
	let { pathname: l = "/", search: u = "", hash: d = "", state: f = null, key: p = "default", mask: m } = n, h = _.useMemo(() => {
		let e = Ce(l, s);
		return e == null ? null : {
			location: {
				pathname: e,
				search: u,
				hash: d,
				state: f,
				key: p,
				mask: m
			},
			navigationType: r
		};
	}, [
		s,
		l,
		u,
		d,
		f,
		p,
		r,
		m
	]);
	return T(h != null, `<Router basename="${s}"> is not able to match the URL "${l}${u}${d}" because it does not start with the basename, so the <Router> won't render anything.`), h == null ? null : /* @__PURE__ */ _.createElement(nt.Provider, { value: c }, /* @__PURE__ */ _.createElement(rt.Provider, {
		children: t,
		value: h
	}));
}
function Gt({ children: e, location: t }) {
	return xt(Kt(e), t);
}
_.Component;
function Kt(e, t = []) {
	let n = [];
	return _.Children.forEach(e, (e, r) => {
		if (!_.isValidElement(e)) return;
		let i = [...t, r];
		if (e.type === _.Fragment) {
			n.push.apply(n, Kt(e.props.children, i));
			return;
		}
		w(e.type === Ut, `[${typeof e.type == "string" ? e.type : e.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`), w(!e.props.index || !e.props.children, "An index route cannot have child routes.");
		let a = {
			id: e.props.id || i.join("-"),
			caseSensitive: e.props.caseSensitive,
			element: e.props.element,
			Component: e.props.Component,
			index: e.props.index,
			path: e.props.path,
			middleware: e.props.middleware,
			loader: e.props.loader,
			action: e.props.action,
			hydrateFallbackElement: e.props.hydrateFallbackElement,
			HydrateFallback: e.props.HydrateFallback,
			errorElement: e.props.errorElement,
			ErrorBoundary: e.props.ErrorBoundary,
			hasErrorBoundary: e.props.hasErrorBoundary === !0 || e.props.ErrorBoundary != null || e.props.errorElement != null,
			shouldRevalidate: e.props.shouldRevalidate,
			handle: e.props.handle,
			lazy: e.props.lazy
		};
		e.props.children && (a.children = Kt(e.props.children, i)), n.push(a);
	}), n;
}
var qt = "get", Jt = "application/x-www-form-urlencoded";
function Yt(e) {
	return typeof HTMLElement < "u" && e instanceof HTMLElement;
}
function Xt(e) {
	return Yt(e) && e.tagName.toLowerCase() === "button";
}
function Zt(e) {
	return Yt(e) && e.tagName.toLowerCase() === "form";
}
function Qt(e) {
	return Yt(e) && e.tagName.toLowerCase() === "input";
}
function $t(e) {
	return !!(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey);
}
function j(e, t) {
	return e.button === 0 && (!t || t === "_self") && !$t(e);
}
var en = null;
function tn() {
	if (en === null) try {
		new FormData(document.createElement("form"), 0), en = !1;
	} catch {
		en = !0;
	}
	return en;
}
var nn = /* @__PURE__ */ new Set([
	"application/x-www-form-urlencoded",
	"multipart/form-data",
	"text/plain"
]);
function rn(e) {
	return e != null && !nn.has(e) ? (T(!1, `"${e}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${Jt}"`), null) : e;
}
function an(e, t) {
	let n, r, i, a, o;
	if (Zt(e)) {
		let o = e.getAttribute("action");
		r = o ? Ce(o, t) : null, n = e.getAttribute("method") || qt, i = rn(e.getAttribute("enctype")) || Jt, a = new FormData(e);
	} else if (Xt(e) || Qt(e) && (e.type === "submit" || e.type === "image")) {
		let o = e.form;
		if (o == null) throw Error("Cannot submit a <button> or <input type=\"submit\"> without a <form>");
		let s = e.getAttribute("formaction") || o.getAttribute("action");
		if (r = s ? Ce(s, t) : null, n = e.getAttribute("formmethod") || o.getAttribute("method") || qt, i = rn(e.getAttribute("formenctype")) || rn(o.getAttribute("enctype")) || Jt, a = new FormData(o, e), !tn()) {
			let { name: t, type: n, value: r } = e;
			if (n === "image") {
				let e = t ? `${t}.` : "";
				a.append(`${e}x`, "0"), a.append(`${e}y`, "0");
			} else t && a.append(t, r);
		}
	} else if (Yt(e)) throw Error("Cannot submit element that is not <form>, <button>, or <input type=\"submit|image\">");
	else n = qt, r = null, i = Jt, o = e;
	return a && i === "text/plain" && (o = a, a = void 0), {
		action: r,
		method: n.toLowerCase(),
		encType: i,
		formData: a,
		body: o
	};
}
Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function on(e, t) {
	if (e === !1 || e == null) throw Error(t);
}
function sn(e, t, n, r) {
	let i = typeof e == "string" ? new URL(e, typeof window > "u" ? "server://singlefetch/" : window.location.origin) : e;
	return i.pathname = n ? i.pathname.endsWith("/") ? `${i.pathname}_.${r}` : `${i.pathname}.${r}` : i.pathname === "/" ? `_root.${r}` : t && Ce(i.pathname, t) === "/" ? `${je(t)}/_root.${r}` : `${je(i.pathname)}.${r}`, i;
}
async function cn(e, t) {
	if (e.id in t) return t[e.id];
	try {
		let n = await import(
			/* @vite-ignore */
			/* webpackIgnore: true */
			e.module
);
		return t[e.id] = n, n;
	} catch (t) {
		return console.error(`Error loading route module \`${e.module}\`, reloading page...`), console.error(t), window.__reactRouterContext && window.__reactRouterContext.isSpaMode, window.location.reload(), new Promise(() => {});
	}
}
function ln(e) {
	return e != null && typeof e.page == "string";
}
function un(e) {
	return e == null ? !1 : e.href == null ? e.rel === "preload" && typeof e.imageSrcSet == "string" && typeof e.imageSizes == "string" : typeof e.rel == "string" && typeof e.href == "string";
}
async function dn(e, t, n) {
	return gn((await Promise.all(e.map(async (e) => {
		let r = t.routes[e.route.id];
		if (r) {
			let e = await cn(r, n);
			return e.links ? e.links() : [];
		}
		return [];
	}))).flat(1).filter(un).filter((e) => e.rel === "stylesheet" || e.rel === "preload").map((e) => e.rel === "stylesheet" ? {
		...e,
		rel: "prefetch",
		as: "style"
	} : {
		...e,
		rel: "prefetch"
	}));
}
function fn(e, t, n, r, i, a) {
	let o = (e, t) => !n[t] || e.route.id !== n[t].route.id, s = (e, t) => n[t].pathname !== e.pathname || n[t].route.path?.endsWith("*") && n[t].params["*"] !== e.params["*"];
	return a === "assets" ? t.filter((e, t) => o(e, t) || s(e, t)) : a === "data" ? t.filter((t, a) => {
		let c = r.routes[t.route.id];
		if (!c || !c.hasLoader) return !1;
		if (o(t, a) || s(t, a)) return !0;
		if (t.route.shouldRevalidate) {
			let r = t.route.shouldRevalidate({
				currentUrl: new URL(i.pathname + i.search + i.hash, window.origin),
				currentParams: n[0]?.params || {},
				nextUrl: new URL(e, window.origin),
				nextParams: t.params,
				defaultShouldRevalidate: !0
			});
			if (typeof r == "boolean") return r;
		}
		return !0;
	}) : [];
}
function pn(e, t, { includeHydrateFallback: n } = {}) {
	return mn(e.map((e) => {
		let r = t.routes[e.route.id];
		if (!r) return [];
		let i = [r.module];
		return r.clientActionModule && (i = i.concat(r.clientActionModule)), r.clientLoaderModule && (i = i.concat(r.clientLoaderModule)), n && r.hydrateFallbackModule && (i = i.concat(r.hydrateFallbackModule)), r.imports && (i = i.concat(r.imports)), i;
	}).flat(1));
}
function mn(e) {
	return [...new Set(e)];
}
function hn(e) {
	let t = {}, n = Object.keys(e).sort();
	for (let r of n) t[r] = e[r];
	return t;
}
function gn(e, t) {
	let n = /* @__PURE__ */ new Set(), r = new Set(t);
	return e.reduce((e, i) => {
		if (t && !ln(i) && i.as === "script" && i.href && r.has(i.href)) return e;
		let a = JSON.stringify(hn(i));
		return n.has(a) || (n.add(a), e.push({
			key: a,
			link: i
		})), e;
	}, []);
}
function _n() {
	let e = _.useContext(Ye);
	return on(e, "You must render this element inside a <DataRouterContext.Provider> element"), e;
}
function vn() {
	let e = _.useContext(Xe);
	return on(e, "You must render this element inside a <DataRouterStateContext.Provider> element"), e;
}
var yn = _.createContext(void 0);
yn.displayName = "FrameworkContext";
function bn() {
	let e = _.useContext(yn);
	return on(e, "You must render this element inside a <HydratedRouter> element"), e;
}
function xn(e, t) {
	let n = _.useContext(yn), [r, i] = _.useState(!1), [a, o] = _.useState(!1), { onFocus: s, onBlur: c, onMouseEnter: l, onMouseLeave: u, onTouchStart: d } = t, f = _.useRef(null);
	_.useEffect(() => {
		if (e === "render" && o(!0), e === "viewport") {
			let e = new IntersectionObserver((e) => {
				e.forEach((e) => {
					o(e.isIntersecting);
				});
			}, { threshold: .5 });
			return f.current && e.observe(f.current), () => {
				e.disconnect();
			};
		}
	}, [e]), _.useEffect(() => {
		if (r) {
			let e = setTimeout(() => {
				o(!0);
			}, 100);
			return () => {
				clearTimeout(e);
			};
		}
	}, [r]);
	let p = () => {
		i(!0);
	}, m = () => {
		i(!1), o(!1);
	};
	return n ? e === "intent" ? [
		a,
		f,
		{
			onFocus: Sn(s, p),
			onBlur: Sn(c, m),
			onMouseEnter: Sn(l, p),
			onMouseLeave: Sn(u, m),
			onTouchStart: Sn(d, p)
		}
	] : [
		a,
		f,
		{}
	] : [
		!1,
		f,
		{}
	];
}
function Sn(e, t) {
	return (n) => {
		e && e(n), n.defaultPrevented || t(n);
	};
}
function Cn({ page: e, ...t }) {
	let n = Qe(), { nonce: r } = bn(), { router: i } = _n(), a = _.useMemo(() => ae(i.routes, e, i.basename), [
		i.routes,
		e,
		i.basename
	]);
	return a ? (t.nonce == null && r && (t = {
		...t,
		nonce: r
	}), n ? /* @__PURE__ */ _.createElement(Tn, {
		page: e,
		matches: a,
		...t
	}) : /* @__PURE__ */ _.createElement(En, {
		page: e,
		matches: a,
		...t
	})) : null;
}
function wn(e) {
	let { manifest: t, routeModules: n } = bn(), [r, i] = _.useState([]);
	return _.useEffect(() => {
		let r = !1;
		return dn(e, t, n).then((e) => {
			r || i(e);
		}), () => {
			r = !0;
		};
	}, [
		e,
		t,
		n
	]), r;
}
function Tn({ page: e, matches: t, ...n }) {
	let r = pt(), { future: i } = bn(), { basename: a } = _n(), o = _.useMemo(() => {
		if (e === r.pathname + r.search + r.hash) return [];
		let n = sn(e, a, i.v8_trailingSlashAwareDataRequests, "rsc"), o = !1, s = [];
		for (let e of t) typeof e.route.shouldRevalidate == "function" ? o = !0 : s.push(e.route.id);
		return o && s.length > 0 && n.searchParams.set("_routes", s.join(",")), [n.pathname + n.search];
	}, [
		a,
		i.v8_trailingSlashAwareDataRequests,
		e,
		r,
		t
	]);
	return /* @__PURE__ */ _.createElement(_.Fragment, null, o.map((e) => /* @__PURE__ */ _.createElement("link", {
		key: e,
		rel: "prefetch",
		as: "fetch",
		href: e,
		...n
	})));
}
function En({ page: e, matches: t, ...n }) {
	let r = pt(), { future: i, manifest: a, routeModules: o } = bn(), { basename: s } = _n(), { loaderData: c, matches: l } = vn(), u = _.useMemo(() => fn(e, t, l, a, r, "data"), [
		e,
		t,
		l,
		a,
		r
	]), d = _.useMemo(() => fn(e, t, l, a, r, "assets"), [
		e,
		t,
		l,
		a,
		r
	]), f = _.useMemo(() => {
		if (e === r.pathname + r.search + r.hash) return [];
		let n = /* @__PURE__ */ new Set(), l = !1;
		if (t.forEach((e) => {
			let t = a.routes[e.route.id];
			t && t.hasLoader && (!u.some((t) => t.route.id === e.route.id) && e.route.id in c && o[e.route.id]?.shouldRevalidate || t.hasClientLoader ? l = !0 : n.add(e.route.id));
		}), n.size === 0) return [];
		let d = sn(e, s, i.v8_trailingSlashAwareDataRequests, "data");
		return l && n.size > 0 && d.searchParams.set("_routes", t.filter((e) => n.has(e.route.id)).map((e) => e.route.id).join(",")), [d.pathname + d.search];
	}, [
		s,
		i.v8_trailingSlashAwareDataRequests,
		c,
		r,
		a,
		u,
		t,
		e,
		o
	]), p = _.useMemo(() => pn(d, a), [d, a]), m = wn(d);
	return /* @__PURE__ */ _.createElement(_.Fragment, null, f.map((e) => /* @__PURE__ */ _.createElement("link", {
		key: e,
		rel: "prefetch",
		as: "fetch",
		href: e,
		...n
	})), p.map((e) => /* @__PURE__ */ _.createElement("link", {
		key: e,
		rel: "modulepreload",
		href: e,
		...n
	})), m.map(({ key: e, link: t }) => /* @__PURE__ */ _.createElement("link", {
		key: e,
		nonce: n.nonce,
		...t,
		crossOrigin: t.crossOrigin ?? n.crossOrigin
	})));
}
function Dn(...e) {
	return (t) => {
		e.forEach((e) => {
			typeof e == "function" ? e(t) : e != null && (e.current = t);
		});
	};
}
_.Component;
var On = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0;
try {
	On && (window.__reactRouterVersion = "7.18.4");
} catch {}
function kn({ basename: e, children: t, useTransitions: n, window: r }) {
	let i = _.useRef();
	i.current ??= C({
		window: r,
		v5Compat: !0
	});
	let a = i.current, [o, s] = _.useState({
		action: a.action,
		location: a.location
	}), c = _.useCallback((e) => {
		n === !1 ? s(e) : _.startTransition(() => s(e));
	}, [n]);
	return _.useLayoutEffect(() => a.listen(c), [a, c]), /* @__PURE__ */ _.createElement(Wt, {
		basename: e,
		children: t,
		location: o.location,
		navigationType: o.action,
		navigator: a,
		useTransitions: n
	});
}
var An = _.forwardRef(function({ onClick: e, discover: t = "render", prefetch: n = "none", relative: r, reloadDocument: i, replace: a, mask: o, state: s, target: c, to: l, preventScrollReset: u, viewTransition: d, defaultShouldRevalidate: f, ...p }, m) {
	let { basename: h, navigator: g, useTransitions: y } = _.useContext(nt), b = typeof l == "string" && v.test(l), x = ze(l, h);
	l = x.to;
	let S = dt(l, { relative: r }), C = pt(), w = null;
	if (o) {
		let e = Oe(o, [], C.mask ? C.mask.pathname : "/", !0);
		h !== "/" && (e.pathname = e.pathname === "/" ? h : Ae([h, e.pathname])), w = g.createHref(e);
	}
	let [T, E, D] = xn(n, p), ee = Fn(l, {
		replace: a,
		mask: o,
		state: s,
		target: c,
		preventScrollReset: u,
		relative: r,
		viewTransition: d,
		defaultShouldRevalidate: f,
		useTransitions: y
	});
	function te(t) {
		e && e(t), t.defaultPrevented || ee(t);
	}
	let ne = !(x.isExternal || i), re = /* @__PURE__ */ _.createElement("a", {
		...p,
		...D,
		href: (ne ? w : void 0) || x.absoluteURL || S,
		onClick: ne ? te : e,
		ref: Dn(m, E),
		target: c,
		"data-discover": !b && t === "render" ? "true" : void 0
	});
	return T && !b ? /* @__PURE__ */ _.createElement(_.Fragment, null, re, /* @__PURE__ */ _.createElement(Cn, { page: S })) : re;
});
An.displayName = "Link";
var jn = _.forwardRef(function({ "aria-current": e = "page", caseSensitive: t = !1, className: n = "", end: r = !1, style: i, to: a, viewTransition: o, children: s, ...c }, l) {
	let u = bt(a, { relative: c.relative }), d = pt(), f = _.useContext(Xe), { navigator: p, basename: m } = _.useContext(nt), h = f != null && Bn(u) && o === !0, g = p.encodeLocation ? p.encodeLocation(u).pathname : u.pathname, v = d.pathname, y = f && f.navigation && f.navigation.location ? f.navigation.location.pathname : null;
	t || (v = v.toLowerCase(), y = y ? y.toLowerCase() : null, g = g.toLowerCase()), y && m && (y = Ce(y, m) || y);
	let b = g !== "/" && g.endsWith("/") ? g.length - 1 : g.length, x = v === g || !r && v.startsWith(g) && v.charAt(b) === "/", S = y != null && (y === g || !r && y.startsWith(g) && y.charAt(g.length) === "/"), C = {
		isActive: x,
		isPending: S,
		isTransitioning: h
	}, w = x ? e : void 0, T;
	T = typeof n == "function" ? n(C) : [
		n,
		x ? "active" : null,
		S ? "pending" : null,
		h ? "transitioning" : null
	].filter(Boolean).join(" ");
	let E = typeof i == "function" ? i(C) : i;
	return /* @__PURE__ */ _.createElement(An, {
		...c,
		"aria-current": w,
		className: T,
		ref: l,
		style: E,
		to: a,
		viewTransition: o
	}, typeof s == "function" ? s(C) : s);
});
jn.displayName = "NavLink";
var Mn = _.forwardRef(({ discover: e = "render", fetcherKey: t, navigate: n, reloadDocument: r, replace: i, state: a, method: o = qt, action: s, onSubmit: c, relative: l, preventScrollReset: u, viewTransition: d, defaultShouldRevalidate: f, ...p }, m) => {
	let { useTransitions: h } = _.useContext(nt), g = Rn(), y = zn(s, { relative: l }), b = o.toLowerCase() === "get" ? "get" : "post", x = typeof s == "string" && v.test(s);
	return /* @__PURE__ */ _.createElement("form", {
		ref: m,
		method: b,
		action: y,
		onSubmit: r ? c : (e) => {
			if (c && c(e), e.defaultPrevented) return;
			e.preventDefault();
			let r = e.nativeEvent.submitter, s = r?.getAttribute("formmethod") || o, p = () => g(r || e.currentTarget, {
				fetcherKey: t,
				method: s,
				navigate: n,
				replace: i,
				state: a,
				relative: l,
				preventScrollReset: u,
				viewTransition: d,
				defaultShouldRevalidate: f
			});
			h && n !== !1 ? _.startTransition(() => p()) : p();
		},
		...p,
		"data-discover": !x && e === "render" ? "true" : void 0
	});
});
Mn.displayName = "Form";
function Nn(e) {
	return `${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function Pn(e) {
	let t = _.useContext(Ye);
	return w(t, Nn(e)), t;
}
function Fn(e, { target: t, replace: n, mask: r, state: i, preventScrollReset: a, relative: o, viewTransition: s, defaultShouldRevalidate: c, useTransitions: l } = {}) {
	let u = gt(), d = pt(), f = bt(e, { relative: o });
	return _.useCallback((p) => {
		if (j(p, t)) {
			p.preventDefault();
			let t = n === void 0 ? te(d) === te(f) : n, m = () => u(e, {
				replace: t,
				mask: r,
				state: i,
				preventScrollReset: a,
				relative: o,
				viewTransition: s,
				defaultShouldRevalidate: c
			});
			l ? _.startTransition(() => m()) : m();
		}
	}, [
		d,
		u,
		f,
		n,
		r,
		i,
		t,
		e,
		a,
		o,
		s,
		c,
		l
	]);
}
var In = 0, Ln = () => `__${String(++In)}__`;
function Rn() {
	let { router: e } = Pn("useSubmit"), { basename: t } = _.useContext(nt), n = Ft(), r = e.fetch, i = e.navigate;
	return _.useCallback(async (e, a = {}) => {
		let { action: o, method: s, encType: c, formData: l, body: u } = an(e, t);
		if (a.navigate === !1) {
			let e = a.fetcherKey || Ln();
			await r(e, n, a.action || o, {
				defaultShouldRevalidate: a.defaultShouldRevalidate,
				preventScrollReset: a.preventScrollReset,
				formData: l,
				body: u,
				formMethod: a.method || s,
				formEncType: a.encType || c,
				flushSync: a.flushSync
			});
		} else await i(a.action || o, {
			defaultShouldRevalidate: a.defaultShouldRevalidate,
			preventScrollReset: a.preventScrollReset,
			formData: l,
			body: u,
			formMethod: a.method || s,
			formEncType: a.encType || c,
			replace: a.replace,
			state: a.state,
			fromRouteId: n,
			flushSync: a.flushSync,
			viewTransition: a.viewTransition
		});
	}, [
		r,
		i,
		t,
		n
	]);
}
function zn(e, { relative: t } = {}) {
	let { basename: n } = _.useContext(nt), r = _.useContext(it);
	w(r, "useFormAction must be used inside a RouteContext");
	let [i] = r.matches.slice(-1), a = { ...bt(e || ".", { relative: t }) }, o = pt();
	if (e == null) {
		a.search = o.search;
		let e = new URLSearchParams(a.search), t = e.getAll("index");
		if (t.some((e) => e === "")) {
			e.delete("index"), t.filter((e) => e).forEach((t) => e.append("index", t));
			let n = e.toString();
			a.search = n ? `?${n}` : "";
		}
	}
	return (!e || e === ".") && i.route.index && (a.search = a.search ? a.search.replace(/^\?/, "?index&") : "?index"), n !== "/" && (a.pathname = a.pathname === "/" ? n : Ae([n, a.pathname])), te(a);
}
function Bn(e, { relative: t } = {}) {
	let n = _.useContext($e);
	w(n != null, "`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?");
	let { basename: r } = Pn("useViewTransitionState"), i = bt(e, { relative: t });
	if (!n.isTransitioning) return !1;
	let a = Ce(n.currentLocation.pathname, r) || n.currentLocation.pathname, o = Ce(n.nextLocation.pathname, r) || n.nextLocation.pathname;
	return xe(i.pathname, o) != null || xe(i.pathname, a) != null;
}
//#endregion
//#region node_modules/@iconify/react/dist/iconify.js
var Vn = g();
function Hn(e, t) {
	let n = e.icons, r = e.aliases || Object.create(null), i = Object.create(null);
	function a(e) {
		if (n[e]) return i[e] = [];
		if (!(e in i)) {
			i[e] = null;
			let t = r[e] && r[e].parent, n = t && a(t);
			n && (i[e] = [t].concat(n));
		}
		return i[e];
	}
	return Object.keys(n).concat(Object.keys(r)).forEach(a), i;
}
var Un = Object.freeze({
	left: 0,
	top: 0,
	width: 16,
	height: 16
}), Wn = Object.freeze({
	rotate: 0,
	vFlip: !1,
	hFlip: !1
}), Gn = Object.freeze({
	...Un,
	...Wn
}), Kn = Object.freeze({
	...Gn,
	body: "",
	hidden: !1
});
function qn(e, t) {
	let n = {};
	!e.hFlip != !t.hFlip && (n.hFlip = !0), !e.vFlip != !t.vFlip && (n.vFlip = !0);
	let r = ((e.rotate || 0) + (t.rotate || 0)) % 4;
	return r && (n.rotate = r), n;
}
function Jn(e, t) {
	let n = qn(e, t);
	for (let r in Kn) r in Wn ? r in e && !(r in n) && (n[r] = Wn[r]) : r in t ? n[r] = t[r] : r in e && (n[r] = e[r]);
	return n;
}
function Yn(e, t, n) {
	let r = e.icons, i = e.aliases || Object.create(null), a = {};
	function o(e) {
		a = Jn(r[e] || i[e], a);
	}
	return o(t), n.forEach(o), Jn(e, a);
}
function Xn(e, t) {
	let n = [];
	if (typeof e != "object" || typeof e.icons != "object") return n;
	e.not_found instanceof Array && e.not_found.forEach((e) => {
		t(e, null), n.push(e);
	});
	let r = Hn(e);
	for (let i in r) {
		let a = r[i];
		a && (t(i, Yn(e, i, a)), n.push(i));
	}
	return n;
}
var Zn = {
	provider: "",
	aliases: {},
	not_found: {},
	...Un
};
function Qn(e, t) {
	for (let n in t) if (n in e && typeof e[n] != typeof t[n]) return !1;
	return !0;
}
function $n(e) {
	if (typeof e != "object" || !e) return null;
	let t = e;
	if (typeof t.prefix != "string" || !e.icons || typeof e.icons != "object" || !Qn(e, Zn)) return null;
	let n = t.icons;
	for (let e in n) {
		let t = n[e];
		if (!e || typeof t.body != "string" || !Qn(t, Kn)) return null;
	}
	let r = t.aliases || Object.create(null);
	for (let e in r) {
		let t = r[e], i = t.parent;
		if (!e || typeof i != "string" || !n[i] && !r[i] || !Qn(t, Kn)) return null;
	}
	return t;
}
var er = Object.create(null);
function tr(e, t) {
	return {
		provider: e,
		prefix: t,
		icons: Object.create(null),
		missing: /* @__PURE__ */ new Set()
	};
}
function nr(e, t) {
	let n = er[e] || (er[e] = Object.create(null));
	return n[t] || (n[t] = tr(e, t));
}
function rr(e, t) {
	return $n(t) ? Xn(t, (t, n) => {
		n ? e.icons[t] = n : e.missing.add(t);
	}) : [];
}
function ir(e, t, n) {
	try {
		if (typeof n.body == "string") return e.icons[t] = { ...n }, !0;
	} catch {}
	return !1;
}
var ar = /^[a-z0-9]+(-[a-z0-9]+)*$/, or = (e, t, n, r = "") => {
	let i = e.split(":");
	if (e.slice(0, 1) === "@") {
		if (i.length < 2 || i.length > 3) return null;
		r = i.shift().slice(1);
	}
	if (i.length > 3 || !i.length) return null;
	if (i.length > 1) {
		let e = i.pop(), n = i.pop(), a = {
			provider: i.length > 0 ? i[0] : r,
			prefix: n,
			name: e
		};
		return t && !sr(a) ? null : a;
	}
	let a = i[0], o = a.split("-");
	if (o.length > 1) {
		let e = {
			provider: r,
			prefix: o.shift(),
			name: o.join("-")
		};
		return t && !sr(e) ? null : e;
	}
	if (n && r === "") {
		let e = {
			provider: r,
			prefix: "",
			name: a
		};
		return t && !sr(e, n) ? null : e;
	}
	return null;
}, sr = (e, t) => e ? !!((t && e.prefix === "" || e.prefix) && e.name) : !1, cr = !1;
function lr(e) {
	return typeof e == "boolean" && (cr = e), cr;
}
function ur(e) {
	let t = typeof e == "string" ? or(e, !0, cr) : e;
	if (t) {
		let e = nr(t.provider, t.prefix), n = t.name;
		return e.icons[n] || (e.missing.has(n) ? null : void 0);
	}
}
function dr(e, t) {
	let n = or(e, !0, cr);
	if (!n) return !1;
	let r = nr(n.provider, n.prefix);
	return t ? ir(r, n.name, t) : (r.missing.add(n.name), !0);
}
function fr(e, t) {
	if (typeof e != "object") return !1;
	if (typeof t != "string" && (t = e.provider || ""), cr && !t && !e.prefix) {
		let t = !1;
		return $n(e) && (e.prefix = "", Xn(e, (e, n) => {
			dr(e, n) && (t = !0);
		})), t;
	}
	let n = e.prefix;
	return sr({
		prefix: n,
		name: "a"
	}) ? !!rr(nr(t, n), e) : !1;
}
var pr = Object.freeze({
	width: null,
	height: null
}), mr = Object.freeze({
	...pr,
	...Wn
}), hr = /(-?[0-9.]*[0-9]+[0-9.]*)/g, gr = /^-?[0-9.]*[0-9]+[0-9.]*$/g;
function _r(e, t, n) {
	if (t === 1) return e;
	if (n ||= 100, typeof e == "number") return Math.ceil(e * t * n) / n;
	if (typeof e != "string") return e;
	let r = e.split(hr);
	if (r === null || !r.length) return e;
	let i = [], a = r.shift(), o = gr.test(a);
	for (;;) {
		if (o) {
			let e = parseFloat(a);
			isNaN(e) ? i.push(a) : i.push(Math.ceil(e * t * n) / n);
		} else i.push(a);
		if (a = r.shift(), a === void 0) return i.join("");
		o = !o;
	}
}
function vr(e, t = "defs") {
	let n = "", r = e.indexOf("<" + t);
	for (; r >= 0;) {
		let i = e.indexOf(">", r), a = e.indexOf("</" + t);
		if (i === -1 || a === -1) break;
		let o = e.indexOf(">", a);
		if (o === -1) break;
		n += e.slice(i + 1, a).trim(), e = e.slice(0, r).trim() + e.slice(o + 1);
	}
	return {
		defs: n,
		content: e
	};
}
function yr(e, t) {
	return e ? "<defs>" + e + "</defs>" + t : t;
}
function br(e, t, n) {
	let r = vr(e);
	return yr(r.defs, t + r.content + n);
}
var xr = (e) => e === "unset" || e === "undefined" || e === "none";
function Sr(e, t) {
	let n = {
		...Gn,
		...e
	}, r = {
		...mr,
		...t
	}, i = {
		left: n.left,
		top: n.top,
		width: n.width,
		height: n.height
	}, a = n.body;
	[n, r].forEach((e) => {
		let t = [], n = e.hFlip, r = e.vFlip, o = e.rotate;
		n ? r ? o += 2 : (t.push("translate(" + (i.width + i.left).toString() + " " + (0 - i.top).toString() + ")"), t.push("scale(-1 1)"), i.top = i.left = 0) : r && (t.push("translate(" + (0 - i.left).toString() + " " + (i.height + i.top).toString() + ")"), t.push("scale(1 -1)"), i.top = i.left = 0);
		let s;
		switch (o < 0 && (o -= Math.floor(o / 4) * 4), o %= 4, o) {
			case 1:
				s = i.height / 2 + i.top, t.unshift("rotate(90 " + s.toString() + " " + s.toString() + ")");
				break;
			case 2:
				t.unshift("rotate(180 " + (i.width / 2 + i.left).toString() + " " + (i.height / 2 + i.top).toString() + ")");
				break;
			case 3: s = i.width / 2 + i.left, t.unshift("rotate(-90 " + s.toString() + " " + s.toString() + ")");
		}
		o % 2 == 1 && (i.left !== i.top && (s = i.left, i.left = i.top, i.top = s), i.width !== i.height && (s = i.width, i.width = i.height, i.height = s)), t.length && (a = br(a, "<g transform=\"" + t.join(" ") + "\">", "</g>"));
	});
	let o = r.width, s = r.height, c = i.width, l = i.height, u, d;
	o === null ? (d = s === null ? "1em" : s === "auto" ? l : s, u = _r(d, c / l)) : (u = o === "auto" ? c : o, d = s === null ? _r(u, l / c) : s === "auto" ? l : s);
	let f = {}, p = (e, t) => {
		xr(t) || (f[e] = t.toString());
	};
	p("width", u), p("height", d);
	let m = [
		i.left,
		i.top,
		c,
		l
	];
	return f.viewBox = m.join(" "), {
		attributes: f,
		viewBox: m,
		body: a
	};
}
var Cr = /\sid="(\S+)"/g, wr = "IconifyId" + Date.now().toString(16) + (Math.random() * 16777216 | 0).toString(16), Tr = 0;
function Er(e, t = wr) {
	let n = [], r;
	for (; r = Cr.exec(e);) n.push(r[1]);
	if (!n.length) return e;
	let i = "suffix" + (Math.random() * 16777216 | Date.now()).toString(16);
	return n.forEach((n) => {
		let r = typeof t == "function" ? t(n) : t + (Tr++).toString(), a = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		e = e.replace(RegExp("([#;\"])(" + a + ")([\")]|\\.[a-z])", "g"), "$1" + r + i + "$3");
	}), e = e.replace(new RegExp(i, "g"), ""), e;
}
var Dr = Object.create(null);
function Or(e, t) {
	Dr[e] = t;
}
function kr(e) {
	return Dr[e] || Dr[""];
}
function Ar(e) {
	let t;
	if (typeof e.resources == "string") t = [e.resources];
	else if (t = e.resources, !(t instanceof Array) || !t.length) return null;
	return {
		resources: t,
		path: e.path || "/",
		maxURL: e.maxURL || 500,
		rotate: e.rotate || 750,
		timeout: e.timeout || 5e3,
		random: e.random === !0,
		index: e.index || 0,
		dataAfterTimeout: e.dataAfterTimeout !== !1
	};
}
for (var jr = Object.create(null), Mr = ["https://api.simplesvg.com", "https://api.unisvg.com"], Nr = []; Mr.length > 0;) Mr.length === 1 || Math.random() > .5 ? Nr.push(Mr.shift()) : Nr.push(Mr.pop());
jr[""] = Ar({ resources: ["https://api.iconify.design"].concat(Nr) });
function Pr(e, t) {
	let n = Ar(t);
	return n !== null && (jr[e] = n, !0);
}
function Fr(e) {
	return jr[e];
}
var Ir = (() => {
	let e;
	try {
		if (e = fetch, typeof e == "function") return e;
	} catch {}
})();
function Lr(e, t) {
	let n = Fr(e);
	if (!n) return 0;
	let r;
	if (!n.maxURL) r = 0;
	else {
		let e = 0;
		n.resources.forEach((t) => {
			e = Math.max(e, t.length);
		});
		let i = t + ".json?icons=";
		r = n.maxURL - e - n.path.length - i.length;
	}
	return r;
}
function Rr(e) {
	return e === 404;
}
var zr = (e, t, n) => {
	let r = [], i = Lr(e, t), a = "icons", o = {
		type: a,
		provider: e,
		prefix: t,
		icons: []
	}, s = 0;
	return n.forEach((n, c) => {
		s += n.length + 1, s >= i && c > 0 && (r.push(o), o = {
			type: a,
			provider: e,
			prefix: t,
			icons: []
		}, s = n.length), o.icons.push(n);
	}), r.push(o), r;
};
function Br(e) {
	if (typeof e == "string") {
		let t = Fr(e);
		if (t) return t.path;
	}
	return "/";
}
var Vr = {
	prepare: zr,
	send: (e, t, n) => {
		if (!Ir) {
			n("abort", 424);
			return;
		}
		let r = Br(t.provider);
		switch (t.type) {
			case "icons": {
				let e = t.prefix, n = t.icons.join(","), i = new URLSearchParams({ icons: n });
				r += e + ".json?" + i.toString();
				break;
			}
			case "custom": {
				let e = t.uri;
				r += e.slice(0, 1) === "/" ? e.slice(1) : e;
				break;
			}
			default:
				n("abort", 400);
				return;
		}
		let i = 503;
		Ir(e + r).then((e) => {
			let t = e.status;
			if (t !== 200) {
				setTimeout(() => {
					n(Rr(t) ? "abort" : "next", t);
				});
				return;
			}
			return i = 501, e.json();
		}).then((e) => {
			if (typeof e != "object" || !e) {
				setTimeout(() => {
					e === 404 ? n("abort", e) : n("next", i);
				});
				return;
			}
			setTimeout(() => {
				n("success", e);
			});
		}).catch(() => {
			n("next", i);
		});
	}
};
function Hr(e, t) {
	e.forEach((e) => {
		let n = e.loaderCallbacks;
		n && (e.loaderCallbacks = n.filter((e) => e.id !== t));
	});
}
function Ur(e) {
	e.pendingCallbacksFlag || (e.pendingCallbacksFlag = !0, setTimeout(() => {
		e.pendingCallbacksFlag = !1;
		let t = e.loaderCallbacks ? e.loaderCallbacks.slice(0) : [];
		if (!t.length) return;
		let n = !1, r = e.provider, i = e.prefix;
		t.forEach((t) => {
			let a = t.icons, o = a.pending.length;
			a.pending = a.pending.filter((t) => {
				if (t.prefix !== i) return !0;
				let o = t.name;
				if (e.icons[o]) a.loaded.push({
					provider: r,
					prefix: i,
					name: o
				});
				else if (e.missing.has(o)) a.missing.push({
					provider: r,
					prefix: i,
					name: o
				});
				else return n = !0, !0;
				return !1;
			}), a.pending.length !== o && (n || Hr([e], t.id), t.callback(a.loaded.slice(0), a.missing.slice(0), a.pending.slice(0), t.abort));
		});
	}));
}
var Wr = 0;
function Gr(e, t, n) {
	let r = Wr++, i = Hr.bind(null, n, r);
	if (!t.pending.length) return i;
	let a = {
		id: r,
		icons: t,
		callback: e,
		abort: i
	};
	return n.forEach((e) => {
		(e.loaderCallbacks ||= []).push(a);
	}), i;
}
function Kr(e) {
	let t = {
		loaded: [],
		missing: [],
		pending: []
	}, n = Object.create(null);
	e.sort((e, t) => e.provider === t.provider ? e.prefix === t.prefix ? e.name.localeCompare(t.name) : e.prefix.localeCompare(t.prefix) : e.provider.localeCompare(t.provider));
	let r = {
		provider: "",
		prefix: "",
		name: ""
	};
	return e.forEach((e) => {
		if (r.name === e.name && r.prefix === e.prefix && r.provider === e.provider) return;
		r = e;
		let i = e.provider, a = e.prefix, o = e.name, s = n[i] || (n[i] = Object.create(null)), c = s[a] || (s[a] = nr(i, a)), l;
		l = o in c.icons ? t.loaded : a === "" || c.missing.has(o) ? t.missing : t.pending;
		let u = {
			provider: i,
			prefix: a,
			name: o
		};
		l.push(u);
	}), t;
}
function qr(e, t = !0, n = !1) {
	let r = [];
	return e.forEach((e) => {
		let i = typeof e == "string" ? or(e, t, n) : e;
		i && r.push(i);
	}), r;
}
var Jr = {
	resources: [],
	index: 0,
	timeout: 2e3,
	rotate: 750,
	random: !1,
	dataAfterTimeout: !1
};
function Yr(e, t, n, r) {
	let i = e.resources.length, a = e.random ? Math.floor(Math.random() * i) : e.index, o;
	if (e.random) {
		let t = e.resources.slice(0);
		for (o = []; t.length > 1;) {
			let e = Math.floor(Math.random() * t.length);
			o.push(t[e]), t = t.slice(0, e).concat(t.slice(e + 1));
		}
		o = o.concat(t);
	} else o = e.resources.slice(a).concat(e.resources.slice(0, a));
	let s = Date.now(), c = "pending", l = 0, u, d = null, f = [], p = [];
	typeof r == "function" && p.push(r);
	function m() {
		d &&= (clearTimeout(d), null);
	}
	function h() {
		c === "pending" && (c = "aborted"), m(), f.forEach((e) => {
			e.status === "pending" && (e.status = "aborted");
		}), f = [];
	}
	function g(e, t) {
		t && (p = []), typeof e == "function" && p.push(e);
	}
	function _() {
		return {
			startTime: s,
			payload: t,
			status: c,
			queriesSent: l,
			queriesPending: f.length,
			subscribe: g,
			abort: h
		};
	}
	function v() {
		c = "failed", p.forEach((e) => {
			e(void 0, u);
		});
	}
	function y() {
		f.forEach((e) => {
			e.status === "pending" && (e.status = "aborted");
		}), f = [];
	}
	function b(t, n, r) {
		let i = n !== "success";
		switch (f = f.filter((e) => e !== t), c) {
			case "pending": break;
			case "failed":
				if (i || !e.dataAfterTimeout) return;
				break;
			default: return;
		}
		if (n === "abort") {
			u = r, v();
			return;
		}
		if (i) {
			u = r, f.length || (o.length ? x() : v());
			return;
		}
		if (m(), y(), !e.random) {
			let n = e.resources.indexOf(t.resource);
			n !== -1 && n !== e.index && (e.index = n);
		}
		c = "completed", p.forEach((e) => {
			e(r);
		});
	}
	function x() {
		if (c !== "pending") return;
		m();
		let r = o.shift();
		if (r === void 0) {
			if (f.length) {
				d = setTimeout(() => {
					m(), c === "pending" && (y(), v());
				}, e.timeout);
				return;
			}
			v();
			return;
		}
		let i = {
			status: "pending",
			resource: r,
			callback: (e, t) => {
				b(i, e, t);
			}
		};
		f.push(i), l++, d = setTimeout(x, e.rotate), n(r, t, i.callback);
	}
	return setTimeout(x), _;
}
function Xr(e) {
	let t = {
		...Jr,
		...e
	}, n = [];
	function r() {
		n = n.filter((e) => e().status === "pending");
	}
	function i(e, i, a) {
		let o = Yr(t, e, i, (e, t) => {
			r(), a && a(e, t);
		});
		return n.push(o), o;
	}
	function a(e) {
		return n.find((t) => e(t)) || null;
	}
	return {
		query: i,
		find: a,
		setIndex: (e) => {
			t.index = e;
		},
		getIndex: () => t.index,
		cleanup: r
	};
}
function Zr() {}
var Qr = Object.create(null);
function $r(e) {
	if (!Qr[e]) {
		let t = Fr(e);
		if (!t) return;
		Qr[e] = {
			config: t,
			redundancy: Xr(t)
		};
	}
	return Qr[e];
}
function ei(e, t, n) {
	let r, i;
	if (typeof e == "string") {
		let t = kr(e);
		if (!t) return n(void 0, 424), Zr;
		i = t.send;
		let a = $r(e);
		a && (r = a.redundancy);
	} else {
		let t = Ar(e);
		if (t) {
			r = Xr(t);
			let n = kr(e.resources ? e.resources[0] : "");
			n && (i = n.send);
		}
	}
	return !r || !i ? (n(void 0, 424), Zr) : r.query(t, i, n)().abort;
}
function ti() {}
function ni(e) {
	e.iconsLoaderFlag || (e.iconsLoaderFlag = !0, setTimeout(() => {
		e.iconsLoaderFlag = !1, Ur(e);
	}));
}
function ri(e) {
	let t = [], n = [];
	return e.forEach((e) => {
		(e.match(ar) ? t : n).push(e);
	}), {
		valid: t,
		invalid: n
	};
}
function ii(e, t, n) {
	function r() {
		let n = e.pendingIcons;
		t.forEach((t) => {
			n && n.delete(t), e.icons[t] || e.missing.add(t);
		});
	}
	if (n && typeof n == "object") try {
		if (!rr(e, n).length) {
			r();
			return;
		}
	} catch (e) {
		console.error(e);
	}
	r(), ni(e);
}
function ai(e, t) {
	e instanceof Promise ? e.then((e) => {
		t(e);
	}).catch(() => {
		t(null);
	}) : t(e);
}
function oi(e, t) {
	e.iconsToLoad = e.iconsToLoad ? e.iconsToLoad.concat(t).sort() : t, e.iconsQueueFlag || (e.iconsQueueFlag = !0, setTimeout(() => {
		e.iconsQueueFlag = !1;
		let { provider: t, prefix: n } = e, r = e.iconsToLoad;
		if (delete e.iconsToLoad, !r || !r.length) return;
		let i = e.loadIcon;
		if (e.loadIcons && (r.length > 1 || !i)) {
			ai(e.loadIcons(r, n, t), (t) => {
				ii(e, r, t);
			});
			return;
		}
		if (i) {
			r.forEach((r) => {
				ai(i(r, n, t), (t) => {
					ii(e, [r], t ? {
						prefix: n,
						icons: { [r]: t }
					} : null);
				});
			});
			return;
		}
		let { valid: a, invalid: o } = ri(r);
		if (o.length && ii(e, o, null), !a.length) return;
		let s = n.match(ar) ? kr(t) : null;
		if (!s) {
			ii(e, a, null);
			return;
		}
		s.prepare(t, n, a).forEach((n) => {
			ei(t, n, (t) => {
				ii(e, n.icons, t);
			});
		});
	}));
}
var si = (e, t) => {
	let n = Kr(qr(e, !0, lr()));
	if (!n.pending.length) {
		let e = !0;
		return t && setTimeout(() => {
			e && t(n.loaded, n.missing, n.pending, ti);
		}), () => {
			e = !1;
		};
	}
	let r = Object.create(null), i = [], a, o;
	return n.pending.forEach((e) => {
		let { provider: t, prefix: n } = e;
		if (n === o && t === a) return;
		a = t, o = n, i.push(nr(t, n));
		let s = r[t] || (r[t] = Object.create(null));
		s[n] || (s[n] = []);
	}), n.pending.forEach((e) => {
		let { provider: t, prefix: n, name: i } = e, a = nr(t, n), o = a.pendingIcons ||= /* @__PURE__ */ new Set();
		o.has(i) || (o.add(i), r[t][n].push(i));
	}), i.forEach((e) => {
		let t = r[e.provider][e.prefix];
		t.length && oi(e, t);
	}), t ? Gr(t, n, i) : ti;
};
function ci(e, t) {
	let n = { ...e };
	for (let e in t) {
		let r = t[e], i = typeof r;
		e in pr ? (r === null || r && (i === "string" || i === "number")) && (n[e] = r) : i === typeof n[e] && (n[e] = e === "rotate" ? r % 4 : r);
	}
	return n;
}
var li = /[\s,]+/;
function ui(e, t) {
	t.split(li).forEach((t) => {
		switch (t.trim()) {
			case "horizontal":
				e.hFlip = !0;
				break;
			case "vertical": e.vFlip = !0;
		}
	});
}
function di(e, t = 0) {
	let n = e.replace(/^-?[0-9.]*/, "");
	function r(e) {
		for (; e < 0;) e += 4;
		return e % 4;
	}
	if (n === "") {
		let t = parseInt(e);
		return isNaN(t) ? 0 : r(t);
	}
	if (n !== e) {
		let t = 0;
		switch (n) {
			case "%":
				t = 25;
				break;
			case "deg": t = 90;
		}
		if (t) {
			let i = parseFloat(e.slice(0, e.length - n.length));
			return isNaN(i) ? 0 : (i /= t, i % 1 == 0 ? r(i) : 0);
		}
	}
	return t;
}
function fi(e, t) {
	let n = e.indexOf("xlink:") === -1 ? "" : " xmlns:xlink=\"http://www.w3.org/1999/xlink\"";
	for (let e in t) n += " " + e + "=\"" + t[e] + "\"";
	return "<svg xmlns=\"http://www.w3.org/2000/svg\"" + n + ">" + e + "</svg>";
}
function pi(e) {
	return e.replace(/"/g, "'").replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/\s+/g, " ");
}
function mi(e) {
	return "data:image/svg+xml," + pi(e);
}
function hi(e) {
	return "url(\"" + mi(e) + "\")";
}
var gi;
function _i() {
	try {
		gi = window.trustedTypes.createPolicy("iconify", { createHTML: (e) => e });
	} catch {
		gi = null;
	}
}
function vi(e) {
	return gi === void 0 && _i(), gi ? gi.createHTML(e) : e;
}
var yi = {
	...mr,
	inline: !1
}, bi = {
	xmlns: "http://www.w3.org/2000/svg",
	xmlnsXlink: "http://www.w3.org/1999/xlink",
	"aria-hidden": !0,
	role: "img"
}, xi = { display: "inline-block" }, Si = { backgroundColor: "currentColor" }, Ci = { backgroundColor: "transparent" }, wi = {
	Image: "var(--svg)",
	Repeat: "no-repeat",
	Size: "100% 100%"
}, Ti = {
	WebkitMask: Si,
	mask: Si,
	background: Ci
};
for (let e in Ti) {
	let t = Ti[e];
	for (let n in wi) t[e + n] = wi[n];
}
var Ei = {
	...yi,
	inline: !0
};
function Di(e) {
	return e + (e.match(/^[-0-9.]+$/) ? "px" : "");
}
var Oi = (e, t, n) => {
	let r = t.inline ? Ei : yi, i = ci(r, t), a = t.mode || "svg", o = {}, s = t.style || {}, c = { ...a === "svg" ? bi : {} };
	if (n) {
		let e = or(n, !1, !0);
		if (e) {
			let t = ["iconify"];
			for (let n of ["provider", "prefix"]) e[n] && t.push("iconify--" + e[n]);
			c.className = t.join(" ");
		}
	}
	for (let e in t) {
		let n = t[e];
		if (n !== void 0) switch (e) {
			case "icon":
			case "style":
			case "children":
			case "onLoad":
			case "mode":
			case "ssr":
			case "fallback": break;
			case "_ref":
				c.ref = n;
				break;
			case "className":
				c[e] = (c[e] ? c[e] + " " : "") + n;
				break;
			case "inline":
			case "hFlip":
			case "vFlip":
				i[e] = n === !0 || n === "true" || n === 1;
				break;
			case "flip":
				typeof n == "string" && ui(i, n);
				break;
			case "color":
				o.color = n;
				break;
			case "rotate":
				typeof n == "string" ? i[e] = di(n) : typeof n == "number" && (i[e] = n);
				break;
			case "ariaHidden":
			case "aria-hidden":
				n !== !0 && n !== "true" && delete c["aria-hidden"];
				break;
			default: r[e] === void 0 && (c[e] = n);
		}
	}
	let l = Sr(e, i), u = l.attributes;
	if (i.inline && (o.verticalAlign = "-0.125em"), a === "svg") {
		c.style = {
			...o,
			...s
		}, Object.assign(c, u);
		let e = 0, n = t.id;
		return typeof n == "string" && (n = n.replace(/-/g, "_")), c.dangerouslySetInnerHTML = { __html: vi(Er(l.body, n ? () => n + "ID" + e++ : "iconifyReact")) }, (0, _.createElement)("svg", c);
	}
	let { body: d, width: f, height: p } = e, m = a === "mask" || a !== "bg" && d.indexOf("currentColor") !== -1, h = fi(d, {
		...u,
		width: f + "",
		height: p + ""
	});
	return c.style = {
		...o,
		"--svg": hi(h),
		width: Di(u.width),
		height: Di(u.height),
		...xi,
		...m ? Si : Ci,
		...s
	}, (0, _.createElement)("span", c);
};
if (lr(!0), Or("", Vr), typeof document < "u" && typeof window < "u") {
	let e = window;
	if (e.IconifyPreload !== void 0) {
		let t = e.IconifyPreload, n = "Invalid IconifyPreload syntax.";
		typeof t == "object" && t && (t instanceof Array ? t : [t]).forEach((e) => {
			try {
				(typeof e != "object" || !e || e instanceof Array || typeof e.icons != "object" || typeof e.prefix != "string" || !fr(e)) && console.error(n);
			} catch {
				console.error(n);
			}
		});
	}
	if (e.IconifyProviders !== void 0) {
		let t = e.IconifyProviders;
		if (typeof t == "object" && t) for (let e in t) {
			let n = "IconifyProviders[" + e + "] is invalid.";
			try {
				let r = t[e];
				if (typeof r != "object" || !r || r.resources === void 0) continue;
				Pr(e, r) || console.error(n);
			} catch {
				console.error(n);
			}
		}
	}
}
function ki(e) {
	let [t, n] = (0, _.useState)(!!e.ssr), [r, i] = (0, _.useState)({});
	function a(t) {
		if (t) {
			let t = e.icon;
			if (typeof t == "object") return {
				name: "",
				data: t
			};
			let n = ur(t);
			if (n) return {
				name: t,
				data: n
			};
		}
		return { name: "" };
	}
	let [o, s] = (0, _.useState)(a(!!e.ssr));
	function c() {
		let e = r.callback;
		e && (e(), i({}));
	}
	function l(e) {
		if (JSON.stringify(o) !== JSON.stringify(e)) return c(), s(e), !0;
	}
	function u() {
		var t;
		let n = e.icon;
		if (typeof n == "object") {
			l({
				name: "",
				data: n
			});
			return;
		}
		let r = ur(n);
		if (l({
			name: n,
			data: r
		})) {
			if (r === void 0) {
				let e = si([n], u);
				i({ callback: e });
			} else r && ((t = e.onLoad) == null || t.call(e, n));
		}
	}
	(0, _.useEffect)(() => (n(!0), c), []), (0, _.useEffect)(() => {
		t && u();
	}, [e.icon, t]);
	let { name: d, data: f } = o;
	return f ? Oi({
		...Gn,
		...f
	}, e, d) : e.children ? e.children : e.fallback ? e.fallback : (0, _.createElement)("span", {});
}
var Ai = (0, _.forwardRef)((e, t) => ki({
	...e,
	_ref: t
}));
(0, _.forwardRef)((e, t) => ki({
	inline: !0,
	...e,
	_ref: t
}));
//#endregion
//#region app/apex/marketing-copy.ts
var ji = "13blok", Mi = [
	{
		id: "modules",
		label: "Modules",
		path: "/modules"
	},
	{
		id: "setup",
		label: "Setup",
		path: "/setup"
	},
	{
		id: "access",
		label: "Access",
		path: "/access"
	},
	{
		id: "campus",
		label: "Campus",
		path: "/campus"
	},
	{
		id: "workforce",
		label: "Workforce",
		path: "/workforce"
	},
	{
		id: "pricing",
		label: "Pricing",
		path: "/pricing"
	}
], Ni = {
	eyebrow: "Modular HRMS & campus ops",
	headline: "Switch on what you actually run.",
	lede: "Motorola sketched a phone you built from blocks. Google called it Project Ara and shelved it. 13blok is that idea, shipped as software: 50 modules on one spine, each with its own switch. Attendance today, payroll next quarter, biometrics when you are ready.",
	primaryCta: "Create your workspace",
	secondaryCta: "I already have one",
	meta: "No card to start · setup takes 4 steps"
}, Pi = "Off means gone from the sidebar and 404 from its own API. On means back on the next load.", Fi = [
	"[X] schools in [REGION]",
	"[N] staff clocking in daily",
	"\"[QUOTE]\" [NAME], [ROLE], [SCHOOL]"
], Ii = {
	title: "One spine, two racks",
	subtitle: "Pick your workspace type once.",
	workforce: {
		name: "Workforce, BlokHR",
		body: "Attendance, leaves, holidays, regularizations, timesheets, overtime, expenses, org chart, training. Face, iris, geo-fence and kiosk capture bolt on when you want them."
	},
	campus: {
		name: "Campus, BlokSchool",
		body: "Roll call, timetable and cover, academics and homework, exams, report cards, library, fees, transport, circulars, surveys, and a parent portal your guardians actually sign into."
	}
}, Li = [
	{
		n: "01",
		title: "Type",
		body: "Workforce or Campus. Permanent for this workspace."
	},
	{
		n: "02",
		title: "Branding",
		body: "Your name, your logo, your login line."
	},
	{
		n: "03",
		title: "Auth",
		body: "Password, magic link, Microsoft, Google or SAML."
	},
	{
		n: "04",
		title: "Plan",
		body: "Start a trial, or paste the licence token you were sent."
	}
], Ri = {
	title: "Who sees what",
	lead: "A teacher sees her sections. Nothing else.",
	body: "Six checks stand between a request and a record: what your tenant owns, which flags are on, who the caller is, what that role may call, which rows they own, and only then the screen. Hiding a button is never the boundary here.",
	roles: [
		"employee",
		"manager",
		"hr",
		"teacher",
		"office",
		"school_admin",
		"admin",
		"parent",
		"guardian"
	],
	layers: [
		{
			n: "01",
			title: "Tenant",
			body: "Your workspace boundary first."
		},
		{
			n: "02",
			title: "Flags",
			body: "Only modules you switched on."
		},
		{
			n: "03",
			title: "Identity",
			body: "Who is calling this API."
		},
		{
			n: "04",
			title: "Role",
			body: "What that role may invoke."
		},
		{
			n: "05",
			title: "Rows",
			body: "Which records they own."
		},
		{
			n: "06",
			title: "Screen",
			body: "UI last, never the gate."
		}
	]
}, zi = {
	modules: {
		eyebrow: "Admin › Features",
		title: "50 modules. Each with a switch.",
		lede: Pi,
		stripLabel: "Adding a feature takes one click, not a project",
		bullets: [
			"One rack per workspace, flags per module.",
			"Off removes the route and its API surface.",
			"On restores the module on the next load.",
			"Core, campus, and add-ons share the same spine."
		],
		meta: "Admin › Features · drag any tile",
		aside: "Drag tiles on the board to see how the rack feels. Off modules stay grey until you turn them on. Your real workspace keeps the same switch model: one flag per module, scoped to your tenant."
	},
	setup: {
		eyebrow: "Onboarding",
		title: "Four steps, then you are inside.",
		lede: "Type, branding, auth, plan. Permanent choices where they should be, flexible everywhere else.",
		stripLabel: "Setup is four steps. Then you are inside.",
		bullets: [
			"Pick Workforce or Campus once.",
			"Brand the login with your name and mark.",
			"Wire password, magic link, or SSO.",
			"Start a trial or paste a licence token."
		],
		meta: "No card to start · four steps to first login",
		aside: "Workspace type is locked after create so HR and campus data never mix by accident. Branding and auth stay editable. Plan and entitlements stay on the tenant you just opened."
	},
	access: {
		eyebrow: "Security model",
		title: Ri.title,
		lede: Ri.body,
		stripLabel: "Six checks before a record. UI is never the gate.",
		bullets: [
			"Tenant boundary first, every request.",
			"Feature flags gate modules before roles.",
			"Roles and row ownership close the loop.",
			"Screens hide controls; APIs enforce them."
		],
		meta: "Six layers · named roles · per-tenant isolation",
		aside: "A teacher sees her sections. An admin sees the tenant with audit. Parents and guardians only get what you release. The board is a map of the checks, not a shortcut around them."
	},
	campus: {
		eyebrow: "BlokSchool",
		title: "Campus ops on the same spine.",
		lede: Ii.campus.body,
		stripLabel: "Campus modules share one spine with workforce.",
		bullets: [
			"Roll call and timetable stay live for teachers.",
			"Exams and report cards publish when you lock.",
			"Library and transport wait until you switch on.",
			"Parents sign into a portal that only shows released data."
		],
		meta: "BlokSchool · same spine as BlokHR",
		aside: "Campus and workforce share one product spine. You pick Campus once at setup, then switch on the school modules you run this term. Staff attendance can still sit beside roll call when you need both."
	},
	workforce: {
		eyebrow: "BlokHR",
		title: "Workforce modules you can grow into.",
		lede: Ii.workforce.body,
		stripLabel: "Workforce modules you grow into, not rebuild.",
		bullets: [
			"Clock-in and leaves run from day one.",
			"Overtime and payroll stay off until ready.",
			"Face and iris bolt on as add-ons.",
			"Geo-fence and kiosk share the same capture path."
		],
		meta: "BlokHR · same spine as BlokSchool",
		aside: "Start with clock-in and leaves. Add overtime, capture, or payroll when operations are ready. You do not rebuild the workspace; you flip switches on the same tenant spine."
	},
	pricing: {
		eyebrow: "Plans",
		title: "Start a trial. Bring a licence when ready.",
		lede: "No invented price list. Your commercial team issues a licence token, or you begin a trial from setup step four. Entitlements stay per tenant.",
		stripLabel: "Trial first. Licence when your team is ready.",
		bullets: [
			"Trial from setup, no card required.",
			"Licence tokens are issued per tenant.",
			"Entitlements and plan limits stay scoped.",
			"Commercial terms live outside this board."
		],
		meta: "Trial or licence · entitlements per tenant",
		aside: "This page does not list dollars. Trial unlocks a workspace so you can configure modules. A licence token from your commercial team binds plan limits to that tenant only."
	}
}, Bi = "Adding a feature takes one click, not a project", M = {
	mint: "#7CE3A2",
	gold: "#EDC457",
	coral: "#DE695A",
	blue: "#5D87ED",
	blueSoft: "#A8C2F7",
	charcoal: "#2D2F31",
	midGray: "#53565C",
	darkFace: "#121314",
	radiusPx: 14
}, Vi = [
	{
		bg: M.mint,
		tone: "light"
	},
	{
		bg: M.gold,
		tone: "light"
	},
	{
		bg: M.coral,
		tone: "light"
	},
	{
		bg: M.blueSoft,
		tone: "light"
	},
	{
		bg: M.charcoal,
		tone: "dark"
	},
	{
		bg: M.midGray,
		tone: "dark"
	},
	{
		bg: M.darkFace,
		tone: "dark"
	}
];
function Hi(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) t = t * 31 + e.charCodeAt(n) >>> 0;
	return t;
}
function Ui(e) {
	return Vi[Hi(e) % Vi.length];
}
var Wi = {
	bg: M.darkFace,
	tone: "dark"
}, Gi = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element");
	function n(e, n, r) {
		var i = null;
		if (r !== void 0 && (i = "" + r), n.key !== void 0 && (i = "" + n.key), "key" in n) for (var a in r = {}, n) a !== "key" && (r[a] = n[a]);
		else r = n;
		return n = r.ref, {
			$$typeof: t,
			type: e,
			key: i,
			ref: n === void 0 ? null : n,
			props: r
		};
	}
	e.jsx = n, e.jsxs = n;
})), Ki = /* @__PURE__ */ o(((e, t) => {
	t.exports = Gi();
})), qi = (0, _.createContext)({});
//#endregion
//#region node_modules/framer-motion/dist/es/utils/use-constant.mjs
function Ji(e) {
	let t = (0, _.useRef)(null);
	return t.current === null && (t.current = e()), t.current;
}
//#endregion
//#region node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs
var Yi = typeof window < "u" ? _.useLayoutEffect : _.useEffect, Xi = /* @__PURE__ */ (0, _.createContext)(null);
//#endregion
//#region node_modules/motion-utils/dist/es/array.mjs
function Zi(e, t) {
	e.indexOf(t) === -1 && e.push(t);
}
function Qi(e, t) {
	let n = e.indexOf(t);
	n > -1 && e.splice(n, 1);
}
//#endregion
//#region node_modules/motion-utils/dist/es/clamp.mjs
var $i = (e, t, n) => n > t ? t : n < e ? e : n, ea = {}, ta = (e) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(e), na = (e) => typeof e == "object" && !!e, ra = (e) => /^0[^.\s]+$/u.test(e);
//#endregion
//#region node_modules/motion-utils/dist/es/memo.mjs
/*#__NO_SIDE_EFFECTS__*/
function ia(e) {
	let t;
	return () => (t === void 0 && (t = e()), t);
}
//#endregion
//#region node_modules/motion-utils/dist/es/noop.mjs
var aa = /* @__NO_SIDE_EFFECTS__ */ (e) => e, oa = (...e) => e.reduce((e, t) => (n) => t(e(n))), sa = /* @__NO_SIDE_EFFECTS__ */ (e, t, n) => {
	let r = t - e;
	return r ? (n - e) / r : 1;
}, ca = class {
	constructor() {
		this.subscriptions = [];
	}
	add(e) {
		return Zi(this.subscriptions, e), () => this.remove(e);
	}
	remove(e) {
		Qi(this.subscriptions, e);
	}
	notify(e, t, n) {
		let r = this.subscriptions.length;
		if (r) {
			if (r === 1) this.subscriptions[0](e, t, n);
			else for (let i = 0; i < r; i++) {
				let r = this.subscriptions[i];
				r && r(e, t, n);
			}
		}
	}
	getSize() {
		return this.subscriptions.length;
	}
	clear() {
		this.subscriptions.length = 0;
	}
}, la = /* @__NO_SIDE_EFFECTS__ */ (e) => e * 1e3, N = /* @__NO_SIDE_EFFECTS__ */ (e) => e / 1e3, P = /* @__NO_SIDE_EFFECTS__ */ (e, t) => t ? 1e3 / t * e : 0, F = (e, t, n) => (((1 - 3 * n + 3 * t) * e + (3 * n - 6 * t)) * e + 3 * t) * e, ua = 1e-7, da = 12;
function fa(e, t, n, r, i) {
	let a, o, s = 0;
	do
		o = t + (n - t) / 2, a = F(o, r, i) - e, a > 0 ? n = o : t = o;
	while (Math.abs(a) > ua && ++s < da);
	return o;
}
/*#__NO_SIDE_EFFECTS__*/
function pa(e, t, n, r) {
	if (e === t && n === r) return aa;
	let i = (t) => fa(t, 0, 1, e, n);
	return (e) => e === 0 || e === 1 ? e : F(i(e), t, r);
}
//#endregion
//#region node_modules/motion-utils/dist/es/easing/modifiers/mirror.mjs
var ma = /* @__NO_SIDE_EFFECTS__ */ (e) => (t) => t <= .5 ? e(2 * t) / 2 : (2 - e(2 * (1 - t))) / 2, ha = /* @__NO_SIDE_EFFECTS__ */ (e) => (t) => 1 - e(1 - t), ga = /*@__PURE__*/ pa(.33, 1.53, .69, .99), _a = /*@__PURE__*/ ha(ga), va = /*@__PURE__*/ ma(_a), ya = (e) => e >= 1 ? 1 : (e *= 2) < 1 ? .5 * _a(e) : .5 * (2 - 2 ** (-10 * (e - 1))), ba = (e) => 1 - Math.sin(Math.acos(e)), xa = /* @__PURE__ */ ha(ba), Sa = /* @__PURE__ */ ma(ba), Ca = /*@__PURE__*/ pa(.42, 0, 1, 1), wa = /*@__PURE__*/ pa(0, 0, .58, 1), Ta = /*@__PURE__*/ pa(.42, 0, .58, 1), Ea = /* @__NO_SIDE_EFFECTS__ */ (e) => Array.isArray(e) && typeof e[0] != "number", Da = /* @__NO_SIDE_EFFECTS__ */ (e) => Array.isArray(e) && typeof e[0] == "number", Oa = {
	linear: aa,
	easeIn: Ca,
	easeInOut: Ta,
	easeOut: wa,
	circIn: ba,
	circInOut: Sa,
	circOut: xa,
	backIn: _a,
	backInOut: va,
	backOut: ga,
	anticipate: ya
}, ka = (e) => typeof e == "string", Aa = (e) => {
	if (/* @__PURE__ */ Da(e)) {
		e.length;
		let [t, n, r, i] = e;
		return /* @__PURE__ */ pa(t, n, r, i);
	}
	return ka(e) ? (Oa[e], `${e}`, Oa[e]) : e;
}, ja = [
	"setup",
	"read",
	"resolveKeyframes",
	"preUpdate",
	"update",
	"preRender",
	"render",
	"postRender"
];
//#endregion
//#region node_modules/motion-dom/dist/es/frameloop/render-step.mjs
function Ma(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = !1, i = !1, a = /* @__PURE__ */ new Set(), o = {
		delta: 0,
		timestamp: 0,
		isProcessing: !1
	};
	function s(t) {
		a.has(t) && (n.add(t), e()), t(o);
	}
	let c = {
		schedule: (e, i = !1, o = !1) => {
			let s = o && r ? t : n;
			return i && a.add(e), s.add(e), e;
		},
		cancel: (e) => {
			n.delete(e), a.delete(e);
		},
		process: (e) => {
			if (o = e, r) {
				i = !0;
				return;
			}
			r = !0;
			let a = t;
			t = n, n = a, t.forEach(s), t.clear(), r = !1, i && (i = !1, c.process(e));
		}
	};
	return c;
}
//#endregion
//#region node_modules/motion-dom/dist/es/frameloop/batcher.mjs
var Na = 40;
function Pa(e, t) {
	let n = !1, r = !0, i = {
		delta: 0,
		timestamp: 0,
		isProcessing: !1
	}, a = () => n = !0, o = ja.reduce((e, t) => (e[t] = Ma(a), e), {}), { setup: s, read: c, resolveKeyframes: l, preUpdate: u, update: d, preRender: f, render: p, postRender: m } = o, h = () => {
		let a = ea.useManualTiming, o = a ? i.timestamp : performance.now();
		n = !1, a || (i.delta = r ? 1e3 / 60 : Math.max(Math.min(o - i.timestamp, Na), 1)), i.timestamp = o, i.isProcessing = !0, s.process(i), c.process(i), l.process(i), u.process(i), d.process(i), f.process(i), p.process(i), m.process(i), i.isProcessing = !1, n && t && (r = !1, e(h));
	}, g = () => {
		n = !0, r = !0, i.isProcessing || e(h);
	};
	return {
		schedule: ja.reduce((e, t) => {
			let r = o[t];
			return e[t] = (e, t = !1, i = !1) => (n || g(), r.schedule(e, t, i)), e;
		}, {}),
		cancel: (e) => {
			for (let t = 0; t < ja.length; t++) o[ja[t]].cancel(e);
		},
		state: i,
		steps: o
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/frameloop/frame.mjs
var { schedule: I, cancel: L, state: Fa, steps: Ia } = /* @__PURE__ */ Pa(typeof requestAnimationFrame < "u" ? requestAnimationFrame : aa, !0), La;
function Ra() {
	La = void 0;
}
var za = {
	now: () => (La === void 0 && za.set(Fa.isProcessing || ea.useManualTiming ? Fa.timestamp : performance.now()), La),
	set: (e) => {
		La = e, queueMicrotask(Ra);
	}
}, Ba = (e) => Math.round(e * 1e5) / 1e5, Va = (e) => (t) => typeof t == "string" && t.startsWith(e), Ha = /*@__PURE__*/ Va("--"), Ua = /*@__PURE__*/ Va("var(--"), Wa = (e) => Ua(e) ? Ga.test(e.split("/*")[0].trim()) : !1, Ga = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
function Ka(e) {
	return typeof e == "string" && e.split("/*")[0].includes("var(--");
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/numbers/index.mjs
var qa = {
	test: (e) => typeof e == "number",
	parse: parseFloat,
	transform: (e) => e
}, Ja = {
	...qa,
	transform: (e) => $i(0, 1, e)
}, Ya = {
	...qa,
	default: 1
}, Xa = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/utils/is-nullish.mjs
function Za(e) {
	return e == null;
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/utils/single-color-regex.mjs
var Qa = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu, $a = (e, t) => (n) => !!(typeof n == "string" && Qa.test(n) && n.startsWith(e) || t && !Za(n) && Object.prototype.hasOwnProperty.call(n, t)), eo = (e, t, n) => (r) => {
	if (typeof r != "string") return r;
	let [i, a, o, s] = r.match(Xa);
	return {
		[e]: parseFloat(i),
		[t]: parseFloat(a),
		[n]: parseFloat(o),
		alpha: s === void 0 ? 1 : parseFloat(s)
	};
}, to = (e) => $i(0, 255, e), no = {
	...qa,
	transform: (e) => Math.round(to(e))
}, ro = {
	test: /*@__PURE__*/ $a("rgb", "red"),
	parse: /*@__PURE__*/ eo("red", "green", "blue"),
	transform: ({ red: e, green: t, blue: n, alpha: r = 1 }) => "rgba(" + no.transform(e) + ", " + no.transform(t) + ", " + no.transform(n) + ", " + Ba(Ja.transform(r)) + ")"
};
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/color/hex.mjs
function io(e) {
	let t = "", n = "", r = "", i = "";
	return e.length > 5 ? (t = e.substring(1, 3), n = e.substring(3, 5), r = e.substring(5, 7), i = e.substring(7, 9)) : (t = e.substring(1, 2), n = e.substring(2, 3), r = e.substring(3, 4), i = e.substring(4, 5), t += t, n += n, r += r, i += i), {
		red: parseInt(t, 16),
		green: parseInt(n, 16),
		blue: parseInt(r, 16),
		alpha: i ? parseInt(i, 16) / 255 : 1
	};
}
var ao = {
	test: /*@__PURE__*/ $a("#"),
	parse: io,
	transform: ro.transform
}, oo = /* @__NO_SIDE_EFFECTS__ */ (e) => ({
	test: (t) => typeof t == "string" && t.endsWith(e) && t.split(" ").length === 1,
	parse: parseFloat,
	transform: (t) => `${t}${e}`
}), so = /*@__PURE__*/ oo("deg"), co = /*@__PURE__*/ oo("%"), R = /*@__PURE__*/ oo("px"), lo = /*@__PURE__*/ oo("vh"), uo = /*@__PURE__*/ oo("vw"), fo = {
	...co,
	parse: (e) => co.parse(e) / 100,
	transform: (e) => co.transform(e * 100)
}, po = {
	test: /*@__PURE__*/ $a("hsl", "hue"),
	parse: /*@__PURE__*/ eo("hue", "saturation", "lightness"),
	transform: ({ hue: e, saturation: t, lightness: n, alpha: r = 1 }) => "hsla(" + Math.round(e) + ", " + co.transform(Ba(t)) + ", " + co.transform(Ba(n)) + ", " + Ba(Ja.transform(r)) + ")"
}, mo = {
	test: (e) => ro.test(e) || ao.test(e) || po.test(e),
	parse: (e) => ro.test(e) ? ro.parse(e) : po.test(e) ? po.parse(e) : ao.parse(e),
	transform: (e) => typeof e == "string" ? e : e.hasOwnProperty("red") ? ro.transform(e) : po.transform(e),
	getAnimatableNone: (e) => {
		let t = mo.parse(e);
		return t.alpha = 0, mo.transform(t);
	}
}, ho = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu, go = /*@__PURE__*/ new RegExp(Xa.source), _o = /*@__PURE__*/ new RegExp(ho.source, "i");
function vo(e) {
	return isNaN(e) && typeof e == "string" && (go.test(e) || _o.test(e));
}
var yo = "number", bo = "color", xo = "var", So = "var(", Co = "${}", wo = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
function To(e) {
	let t = e.toString();
	return go.test(t) || _o.test(t);
}
function Eo(e) {
	let t = e.toString(), n = [], r = {
		color: [],
		number: [],
		var: []
	}, i = [], a = 0;
	return {
		values: n,
		split: t.replace(wo, (e) => (mo.test(e) ? (r.color.push(a), i.push(bo), n.push(mo.parse(e))) : e.startsWith(So) ? (r.var.push(a), i.push(xo), n.push(e)) : (r.number.push(a), i.push(yo), n.push(parseFloat(e))), ++a, Co)).split(Co),
		indexes: r,
		types: i
	};
}
function Do(e) {
	return Eo(e).values;
}
function Oo({ split: e, types: t }) {
	let n = e.length;
	return (r) => {
		let i = "";
		for (let a = 0; a < n; a++) if (i += e[a], r[a] !== void 0) {
			let e = t[a];
			i += e === yo ? Ba(r[a]) : e === bo ? mo.transform(r[a]) : r[a];
		}
		return i;
	};
}
function ko(e) {
	return Oo(Eo(e));
}
var Ao = (e) => typeof e == "number" ? 0 : mo.test(e) ? mo.getAnimatableNone(e) : e, jo = (e, t) => typeof e == "number" ? t?.trim().endsWith("/") ? e : 0 : Ao(e);
function Mo(e) {
	let t = Eo(e);
	return Oo(t)(t.values.map((e, n) => jo(e, t.split[n])));
}
var z = {
	test: vo,
	parse: Do,
	createTransformer: ko,
	getAnimatableNone: Mo
};
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/color/hsla-to-rgba.mjs
function No(e, t, n) {
	return n < 0 && (n += 1), n > 1 && --n, n < 1 / 6 ? e + (t - e) * 6 * n : n < 1 / 2 ? t : n < 2 / 3 ? e + (t - e) * (2 / 3 - n) * 6 : e;
}
function Po({ hue: e, saturation: t, lightness: n, alpha: r }) {
	e /= 360, t /= 100, n /= 100;
	let i = 0, a = 0, o = 0;
	if (!t) i = a = o = n;
	else {
		let r = n < .5 ? n * (1 + t) : n + t - n * t, s = 2 * n - r;
		i = No(s, r, e + 1 / 3), a = No(s, r, e), o = No(s, r, e - 1 / 3);
	}
	return {
		red: Math.round(i * 255),
		green: Math.round(a * 255),
		blue: Math.round(o * 255),
		alpha: r
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/mix/immediate.mjs
function Fo(e, t) {
	return (n) => n > 0 ? t : e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/mix/number.mjs
var B = (e, t, n) => e + (t - e) * n, Io = (e, t, n) => {
	let r = e * e, i = n * (t * t - r) + r;
	return i < 0 ? 0 : Math.sqrt(i);
}, Lo = [
	ao,
	ro,
	po
], Ro = (e) => Lo.find((t) => t.test(e));
function zo(e) {
	let t = Ro(e);
	if (!t) return `${e}`, !1;
	let n = t.parse(e);
	return t === po && (n = Po(n)), n;
}
var Bo = (e, t) => {
	let n = zo(e), r = zo(t);
	if (!n || !r) return Fo(e, t);
	let i = { ...n };
	return (e) => (i.red = Io(n.red, r.red, e), i.green = Io(n.green, r.green, e), i.blue = Io(n.blue, r.blue, e), i.alpha = B(n.alpha, r.alpha, e), ro.transform(i));
}, Vo = /* @__PURE__ */ new Set(["none", "hidden"]);
function Ho(e, t) {
	return Vo.has(e) ? (n) => n <= 0 ? e : t : (n) => n >= 1 ? t : e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/mix/complex.mjs
function V(e, t) {
	return (n) => B(e, t, n);
}
function H(e) {
	return typeof e == "number" ? V : typeof e == "string" ? Wa(e) ? Fo : mo.test(e) ? Bo : Ko : Array.isArray(e) ? Uo : typeof e == "object" ? mo.test(e) ? Bo : Wo : Fo;
}
function Uo(e, t) {
	let n = [...e], r = n.length, i = e.map((e, n) => H(e)(e, t[n]));
	return (e) => {
		for (let t = 0; t < r; t++) n[t] = i[t](e);
		return n;
	};
}
function Wo(e, t) {
	let n = {
		...e,
		...t
	}, r = {};
	for (let i in n) e[i] !== void 0 && t[i] !== void 0 && (r[i] = H(e[i])(e[i], t[i]));
	return (e) => {
		for (let t in r) n[t] = r[t](e);
		return n;
	};
}
function Go(e, t) {
	let n = [], r = {
		color: 0,
		var: 0,
		number: 0
	};
	for (let i = 0; i < t.values.length; i++) {
		let a = t.types[i], o = e.indexes[a][r[a]], s = e.values[o] ?? 0;
		n[i] = s, r[a]++;
	}
	return n;
}
var Ko = (e, t) => {
	let n = z.createTransformer(t), r = Eo(e), i = Eo(t);
	return r.indexes.var.length === i.indexes.var.length && r.indexes.color.length === i.indexes.color.length && r.indexes.number.length >= i.indexes.number.length ? Vo.has(e) && !i.values.length || Vo.has(t) && !r.values.length ? Ho(e, t) : oa(Uo(Go(r, i), i.values), n) : (`${e}${t}`, Fo(e, t));
}, qo = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/iu;
function Jo(e, t) {
	let n = qo.exec(e);
	if (!n) return;
	let r = qo.exec(t);
	if (!r || n[2] !== r[2]) return;
	let i = n[2], a = parseFloat(n[1]), o = parseFloat(r[1]);
	return (e) => Ba(B(a, o, e)) + i;
}
function Yo(e, t, n) {
	if (typeof e == "number" && typeof t == "number" && typeof n == "number") return B(e, t, n);
	if (typeof e == "string" && typeof t == "string") {
		let n = Jo(e, t);
		if (n) return n;
	}
	return H(e)(e, t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/drivers/frame.mjs
var Xo = (e) => {
	let t = ({ timestamp: t }) => e(t);
	return {
		start: (e = !0) => I.update(t, e),
		stop: () => L(t),
		now: () => Fa.isProcessing ? Fa.timestamp : za.now()
	};
}, Zo = (e, t, n = 10) => {
	let r = "", i = Math.max(Math.round(t / n), 2);
	for (let t = 0; t < i; t++) r += Math.round(e(t / (i - 1)) * 1e4) / 1e4 + ", ";
	return `linear(${r.substring(0, r.length - 2)})`;
}, Qo = 2e4;
function $o(e, t = 50, n = Qo, r) {
	let i = 0, a = e.next(i);
	for (r?.push(a.value); !a.done && i < n;) i += t, a = e.next(i), r?.push(a.value);
	return i >= n ? Infinity : i;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/utils/create-generator-easing.mjs
function es(e, t = 100, n) {
	let r = n({
		...e,
		keyframes: [0, t]
	}), i = Math.min($o(r), Qo);
	return {
		type: "keyframes",
		ease: (e) => r.next(i * e).value / t,
		duration: /* @__PURE__ */ N(i)
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/spring.mjs
var ts = {
	stiffness: 100,
	damping: 10,
	mass: 1,
	velocity: 0,
	duration: 800,
	bounce: .3,
	visualDuration: .3,
	restSpeed: {
		granular: .01,
		default: 2
	},
	restDelta: {
		granular: .005,
		default: .5
	},
	minDuration: .01,
	maxDuration: 10,
	minDamping: .05,
	maxDamping: 1
};
function ns(e, t) {
	return e * Math.sqrt(1 - t * t);
}
var rs = 12;
function is(e, t, n) {
	let r = n;
	for (let n = 1; n < rs; n++) r -= e(r) / t(r);
	return r;
}
var as = .001;
function os({ duration: e = ts.duration, bounce: t = ts.bounce, velocity: n = ts.velocity, mass: r = ts.mass }) {
	let i, a;
	ts.maxDuration;
	let o = 1 - t;
	o = $i(ts.minDamping, ts.maxDamping, o), e = $i(ts.minDuration, ts.maxDuration, /* @__PURE__ */ N(e)), o < 1 ? (i = (t) => {
		let r = t * o, i = r * e, a = r - n, s = ns(t, o), c = Math.exp(-i);
		return as - a / s * c;
	}, a = (t) => {
		let r = t * o * e, a = r * n + n, s = o * o * t * t * e, c = Math.exp(-r), l = ns(t * t, o);
		return (-i(t) + as > 0 ? -1 : 1) * ((a - s) * c) / l;
	}) : (i = (t) => -.001 + Math.exp(-t * e) * ((t - n) * e + 1), a = (t) => Math.exp(-t * e) * ((n - t) * (e * e)));
	let s = 5 / e, c = is(i, a, s);
	if (e = /* @__PURE__ */ la(e), isNaN(c)) return {
		stiffness: ts.stiffness,
		damping: ts.damping,
		duration: e
	};
	{
		let t = c * c * r;
		return {
			stiffness: t,
			damping: o * 2 * Math.sqrt(r * t),
			duration: e
		};
	}
}
var ss = ["duration", "bounce"], cs = [
	"stiffness",
	"damping",
	"mass"
];
function ls(e, t) {
	return t.some((t) => e[t] !== void 0);
}
function us(e) {
	let t = {
		velocity: ts.velocity,
		stiffness: ts.stiffness,
		damping: ts.damping,
		mass: ts.mass,
		isResolvedFromDuration: !1,
		...e
	};
	if (!ls(e, cs) && ls(e, ss)) {
		if (t.velocity = 0, e.visualDuration) {
			let n = e.visualDuration, r = 2 * Math.PI / (n * 1.2), i = r * r, a = 2 * $i(.05, 1, 1 - (e.bounce || 0)) * Math.sqrt(i);
			t = {
				...t,
				mass: ts.mass,
				stiffness: i,
				damping: a
			};
		} else {
			let n = os({
				...e,
				velocity: 0
			});
			t = {
				...t,
				...n,
				mass: ts.mass
			}, t.isResolvedFromDuration = !0;
		}
	}
	return t;
}
function ds(e = ts.visualDuration, t = ts.bounce) {
	let n = typeof e == "object" ? e : {
		visualDuration: e,
		keyframes: [0, 1],
		bounce: t
	}, r = n.keyframes[0], i = n.keyframes[n.keyframes.length - 1], a = {
		done: !1,
		value: r
	}, { stiffness: o, damping: s, mass: c, duration: l, velocity: u, isResolvedFromDuration: d } = us({
		...n,
		velocity: -/* @__PURE__ */ N(n.velocity || 0)
	}), f = s / (2 * Math.sqrt(o * c)), p = /* @__PURE__ */ N(Math.sqrt(o / c)), m = f * p, h = {
		target: i,
		delta: i - r,
		velocity: u || 0,
		restSpeed: 0,
		restDelta: 0
	}, g = () => {
		let e = Math.abs(h.delta) < 5;
		h.restSpeed = n.restSpeed || (e ? ts.restSpeed.granular : ts.restSpeed.default), h.restDelta = n.restDelta || (e ? ts.restDelta.granular : ts.restDelta.default);
	};
	g();
	let _, v, y;
	if (f < 1) {
		let e = ns(p, f), t = {
			A: 0,
			sinC: 0,
			cosC: 0,
			t: -1,
			env: 0,
			sin: 0,
			cos: 0
		};
		y = () => {
			t.A = (h.velocity + m * h.delta) / e, t.sinC = m * t.A + h.delta * e, t.cosC = m * h.delta - t.A * e;
		};
		let n = (n) => {
			n !== t.t && (t.t = n, t.env = Math.exp(-m * n), t.sin = Math.sin(e * n), t.cos = Math.cos(e * n));
		};
		_ = (e) => (n(e), h.target - t.env * (t.A * t.sin + h.delta * t.cos)), v = (e) => (n(e), t.env * (t.sinC * t.sin + t.cosC * t.cos));
	} else if (f === 1) {
		_ = (e) => h.target - Math.exp(-p * e) * (h.delta + (h.velocity + p * h.delta) * e);
		let e = { C: 0 };
		y = () => {
			e.C = h.velocity + p * h.delta;
		}, v = (t) => Math.exp(-p * t) * (p * e.C * t - h.velocity);
	} else {
		let e = p * Math.sqrt(f * f - 1);
		_ = (t) => {
			let n = Math.exp(-m * t), r = Math.min(e * t, 300);
			return h.target - n * ((h.velocity + m * h.delta) * Math.sinh(r) + e * h.delta * Math.cosh(r)) / e;
		};
		let t = {
			P: 0,
			sinh: 0,
			cosh: 0
		};
		y = () => {
			t.P = (h.velocity + m * h.delta) / e, t.sinh = m * t.P - h.delta * e, t.cosh = m * h.delta - t.P * e;
		}, v = (n) => {
			let r = Math.exp(-m * n), i = Math.min(e * n, 300);
			return r * (t.sinh * Math.sinh(i) + t.cosh * Math.cosh(i));
		};
	}
	y();
	let b = !ls(n, cs) && ls(n, ss), x = d && l || null, S = {
		calculatedDuration: x,
		retarget: (e, t) => {
			h.target = e[e.length - 1], h.delta = h.target - e[0], h.velocity = b ? 0 : -/* @__PURE__ */ N(t), n.restSpeed && n.restDelta || g(), S.calculatedDuration = x, a.done = !1, y();
		},
		velocity: (e) => /* @__PURE__ */ la(v(e)),
		next: (e) => {
			let t = _(e);
			if (d) a.done = e >= l;
			else {
				let n = /* @__PURE__ */ la(v(e));
				a.done = Math.abs(n) <= h.restSpeed && Math.abs(h.target - t) <= h.restDelta;
			}
			return a.value = a.done ? h.target : t, a;
		},
		toString: () => {
			let e = Math.min($o(S), Qo), t = Zo((t) => S.next(e * t).value, e, 30);
			return e + "ms " + t;
		},
		toTransition: () => {}
	};
	return S;
}
ds.applyToOptions = (e) => {
	let t = es(e, 100, ds);
	return e.ease = t.ease, e.duration = /* @__PURE__ */ la(t.duration), e.type = "keyframes", e;
};
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/inertia.mjs
function fs({ keyframes: e, velocity: t = 0, power: n = .8, timeConstant: r = 325, bounceDamping: i = 10, bounceStiffness: a = 500, modifyTarget: o, min: s, max: c, restDelta: l = .5, restSpeed: u }) {
	let d = e[0], f = {
		done: !1,
		value: d
	}, p = (e) => e < s || e > c, m = (e) => s === void 0 ? c : c === void 0 || Math.abs(s - e) < Math.abs(c - e) ? s : c, h = n * t, g = d + h, _ = o === void 0 ? g : o(g);
	_ !== g && (h = _ - d);
	let v = (e) => -h * Math.exp(-e / r), y = (e) => {
		let t = v(e);
		f.done = Math.abs(t) <= l, f.value = f.done ? _ : _ + t;
	}, b, x, S = (e) => {
		p(f.value) && (b = e, x = ds({
			keyframes: [f.value, m(f.value)],
			velocity: -v(e) / r * 1e3,
			damping: i,
			stiffness: a,
			restDelta: l,
			restSpeed: u
		}));
	};
	return S(0), {
		calculatedDuration: null,
		next: (e) => {
			let t = !1;
			return !x && b === void 0 && (t = !0, y(e), S(e)), b !== void 0 && e >= b ? x.next(e - b) : (!t && y(e), f);
		}
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/interpolate.mjs
function ps(e, t, n) {
	let r = [], i = n || ea.mix || Yo, a = e.length - 1;
	for (let n = 0; n < a; n++) {
		let a = i(e[n], e[n + 1]);
		t && (a = oa(Array.isArray(t) ? t[n] || aa : t, a)), r.push(a);
	}
	return r;
}
function ms(e, t, { clamp: n = !0, ease: r, mixer: i } = {}) {
	let a = e.length;
	if (t.length, a === 1) return () => t[0];
	if (a === 2 && t[0] === t[1]) return () => t[1];
	let o = e[0] === e[1];
	e[0] > e[a - 1] && (e = [...e].reverse(), t = [...t].reverse());
	let s = ps(t, r, i), c = s.length, l = (n) => {
		if (o && n < e[0]) return t[0];
		let r = 0;
		if (c > 1) for (; r < e.length - 2 && !(n < e[r + 1]); r++);
		let i = /* @__PURE__ */ sa(e[r], e[r + 1], n);
		return s[r](i);
	};
	return n ? (t) => l($i(e[0], e[a - 1], t)) : l;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/offsets/fill.mjs
function hs(e, t) {
	let n = e[e.length - 1];
	for (let r = 1; r <= t; r++) {
		let i = /* @__PURE__ */ sa(0, t, r);
		e.push(B(n, 1, i));
	}
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/offsets/default.mjs
function gs(e) {
	let t = [0];
	return hs(t, e.length - 1), t;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/offsets/time.mjs
function _s(e, t) {
	return e.map((e) => e * t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/keyframes.mjs
function vs(e, t) {
	return e.map(() => t || Ta).splice(0, e.length - 1);
}
function ys({ duration: e = 300, keyframes: t, times: n, ease: r = "easeInOut" }) {
	let i = /* @__PURE__ */ Ea(r) ? r.map(Aa) : Aa(r), a = {
		done: !1,
		value: t[0]
	};
	if (t.length === 2 && !Array.isArray(i) && (!n || n.length !== 2 || n[0] === 0 && n[1] === 1)) {
		let [n, r] = t, o = n === r ? void 0 : (ea.mix || Yo)(n, r);
		return {
			calculatedDuration: e,
			next: (t) => (a.value = o ? o(i(e > 0 ? $i(0, 1, t / e) : 1)) : r, a.done = t >= e, a)
		};
	}
	let o = ms(_s(n && n.length === t.length ? n : gs(t), e), t, { ease: Array.isArray(i) ? i : vs(t, i) });
	return {
		calculatedDuration: e,
		next: (t) => (a.value = o(t), a.done = t >= e, a)
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/utils/velocity.mjs
var bs = 5;
function xs(e, t, n) {
	let r = Math.max(t - bs, 0);
	return /* @__PURE__ */ P(n - e(r), t - r);
}
function Ss(e, t, n = 0) {
	return t <= 0 ? n : e.velocity ? e.velocity(t) : xs((t) => e.next(t).value, t, e.next(t).value);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/get-final.mjs
var Cs = (e) => e !== null;
function ws(e, { repeat: t, repeatType: n = "loop" }, r, i = 1) {
	let a = e.filter(Cs), o = i < 0 || t && n !== "loop" && t % 2 == 1 ? 0 : a.length - 1;
	return !o || r === void 0 ? a[o] : r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/replace-transition-type.mjs
var Ts = {
	decay: fs,
	inertia: fs,
	tween: ys,
	keyframes: ys,
	spring: ds
};
function Es(e) {
	typeof e.type == "string" && (e.type = Ts[e.type]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/notify-inspector.mjs
function Ds(e, t) {
	return {
		kind: e,
		animation: t,
		timestamp: za.now(),
		frameTimestamp: Fa.timestamp,
		frameIsProcessing: Fa.isProcessing
	};
}
function Os(e, t, n) {
	let r = globalThis.__MOTION_INSPECT__;
	if (r) try {
		r({
			...Ds("animation-start", e),
			options: n ? {
				...t,
				...n
			} : t
		});
	} catch {}
}
function ks(e, t) {
	let n = globalThis.__MOTION_INSPECT__;
	if (n) try {
		n({
			...Ds("layout-animation-start", e),
			node: t
		});
	} catch {}
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/WithPromise.mjs
var As = class {
	constructor() {
		this.isResolved = !1;
	}
	get finished() {
		return this._finished ||= this.isResolved ? Promise.resolve() : new Promise((e) => {
			this._resolve = e;
		}), this._finished;
	}
	updateFinished() {
		this._finished = this._resolve = void 0, this.isResolved = !1;
	}
	notifyFinished() {
		this.isResolved = !0, this._resolve?.();
	}
	then(e, t) {
		return this.finished.then(e, t);
	}
}, js = (e) => e / 100, Ms = class extends As {
	constructor(e) {
		super(), this.state = "idle", this.startTime = null, this.isStopped = !1, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.delayState = {
			done: !1,
			value: void 0
		}, this.stop = () => {
			let { motionValue: e } = this.options;
			e && e.updatedAt !== za.now() && this.tick(za.now()), this.isStopped = !0, this.state !== "idle" && (this.teardown(), this.options.onStop?.());
		}, this.options = e, this.initAnimation(), this.play(), e.autoplay === !1 && this.pause(), Os(this, this.options);
	}
	initAnimation() {
		let { options: e } = this;
		Es(e);
		let { type: t = ys, repeat: n = 0, repeatDelay: r = 0, repeatType: i, velocity: a = 0 } = e, { keyframes: o } = e, s = t || ys;
		s !== ys && typeof o[0] != "number" && (this.mixKeyframes = oa(js, Yo(o[0], o[1])), o = [0, 100]);
		let c = s(o === e.keyframes ? e : {
			...e,
			keyframes: o
		});
		i === "mirror" && (this.mirroredGenerator = s({
			...e,
			keyframes: [...o].reverse(),
			velocity: -a
		})), c.calculatedDuration === null && (c.calculatedDuration = $o(c));
		let { calculatedDuration: l } = c;
		this.calculatedDuration = l, this.resolvedDuration = l + r, this.totalDuration = this.resolvedDuration * (n + 1) - r, this.generator = c;
	}
	updateTime(e) {
		let t = Math.round(e - this.startTime) * this.playbackSpeed;
		this.currentTime = this.holdTime === null ? t : this.holdTime;
	}
	tick(e, t = !1) {
		let { generator: n, totalDuration: r, mixKeyframes: i, mirroredGenerator: a, resolvedDuration: o, calculatedDuration: s } = this;
		if (this.startTime === null) return n.next(0);
		let { delay: c = 0, keyframes: l, repeat: u, repeatType: d, repeatDelay: f, type: p, onUpdate: m, finalKeyframe: h } = this.options;
		this.speed > 0 ? this.startTime = Math.min(this.startTime, e) : this.speed < 0 && (this.startTime = Math.min(e - r / this.speed, this.startTime)), t ? this.currentTime = e : this.updateTime(e);
		let g = this.currentTime - c * (this.playbackSpeed >= 0 ? 1 : -1), _ = this.playbackSpeed >= 0 ? g < 0 : g > r;
		this.currentTime = Math.max(g, 0), this.state === "finished" && this.holdTime === null && (this.currentTime = r);
		let v = this.currentTime, y = n;
		if (u) {
			let e = Math.min(this.currentTime, r) / o, t = Math.floor(e), n = e % 1;
			!n && e >= 1 && (n = 1), n === 1 && t--, t = Math.min(t, u + 1), t % 2 && (d === "reverse" ? (n = 1 - n, f && (n -= f / o)) : d === "mirror" && (y = a)), v = $i(0, 1, n) * o;
		}
		let b;
		_ ? (this.delayState.value = l[0], b = this.delayState) : b = y.next(v), i && !_ && (b.value = i(b.value));
		let { done: x } = b;
		!_ && s !== null && (x = this.playbackSpeed >= 0 ? this.currentTime >= r : this.currentTime <= 0);
		let S = this.holdTime === null && (this.state === "finished" || this.state === "running" && x);
		return S && p !== fs && (b.value = ws(l, this.options, h, this.speed)), m && m(b.value), S && this.finish(), b;
	}
	then(e, t) {
		return this.finished.then(e, t);
	}
	get duration() {
		return /* @__PURE__ */ N(this.calculatedDuration);
	}
	get iterationDuration() {
		let { delay: e = 0 } = this.options || {};
		return this.duration + /* @__PURE__ */ N(e);
	}
	get time() {
		return /* @__PURE__ */ N(this.currentTime);
	}
	set time(e) {
		e = /* @__PURE__ */ la(e), this.currentTime = e, this.startTime === null || this.holdTime !== null || this.playbackSpeed === 0 ? this.holdTime = e : this.driver && (this.startTime = this.driver.now() - e / this.playbackSpeed), this.driver ? this.driver.start(!1) : (this.startTime = 0, this.state = "paused", this.holdTime = e, this.tick(e));
	}
	getGeneratorVelocity() {
		return Ss(this.generator, this.currentTime, this.options.velocity);
	}
	get speed() {
		return this.playbackSpeed;
	}
	set speed(e) {
		let t = this.playbackSpeed !== e;
		t && this.driver && this.updateTime(za.now()), this.playbackSpeed = e, t && this.driver && (this.time = /* @__PURE__ */ N(this.currentTime));
	}
	play() {
		if (this.isStopped) return;
		let { driver: e = Xo, startTime: t } = this.options;
		this.driver ||= e((e) => this.tick(e)), this.options.onPlay?.();
		let n = this.driver.now();
		this.state === "finished" ? (this.updateFinished(), this.startTime = n) : this.holdTime === null ? this.startTime ||= t ?? n : this.startTime = n - this.holdTime, this.state === "finished" && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
	}
	pause() {
		this.state = "paused", this.updateTime(za.now()), this.holdTime = this.currentTime;
	}
	complete() {
		this.state !== "running" && this.play(), this.state = "finished", this.holdTime = null;
	}
	finish() {
		this.notifyFinished(), this.teardown(), this.state = "finished", this.options.onComplete?.();
	}
	cancel() {
		this.holdTime = null, this.startTime = 0, this.tick(0), this.teardown(), this.options.onCancel?.();
	}
	teardown() {
		this.state = "idle", this.stopDriver(), this.startTime = this.holdTime = null;
	}
	stopDriver() {
		this.driver &&= (this.driver.stop(), void 0);
	}
	sample(e) {
		return this.startTime = 0, this.tick(e, !0);
	}
	attachTimeline(e) {
		return this.options.allowFlatten && (this.options.type = "keyframes", this.options.ease = "linear", this.initAnimation()), this.driver?.stop(), e.observe(this);
	}
}, Ns = /* @__PURE__ */ new Set([
	"brightness",
	"contrast",
	"saturate",
	"opacity"
]);
function Ps(e) {
	let [t, n] = e.slice(0, -1).split("(");
	if (t === "drop-shadow") return e;
	let [r] = n.match(Xa) || [];
	if (!r) return e;
	let i = n.replace(r, ""), a = +!!Ns.has(t);
	return r !== n && (a *= 100), t + "(" + a + i + ")";
}
var Fs = /\b([a-z-]*)\(.*?\)/gu, Is = {
	...z,
	getAnimatableNone: (e) => {
		let t = e.match(Fs);
		return t ? t.map(Ps).join(" ") : e;
	}
}, Ls = {
	...z,
	getAnimatableNone: (e) => {
		let t = z.parse(e);
		return z.createTransformer(e)(t.map((e) => typeof e == "number" ? 0 : typeof e == "object" ? {
			...e,
			alpha: 1
		} : e));
	}
}, Rs = {
	...qa,
	transform: Math.round
}, zs = {
	borderWidth: R,
	borderTopWidth: R,
	borderRightWidth: R,
	borderBottomWidth: R,
	borderLeftWidth: R,
	borderRadius: R,
	borderTopLeftRadius: R,
	borderTopRightRadius: R,
	borderBottomRightRadius: R,
	borderBottomLeftRadius: R,
	width: R,
	maxWidth: R,
	height: R,
	maxHeight: R,
	top: R,
	right: R,
	bottom: R,
	left: R,
	inset: R,
	insetBlock: R,
	insetBlockStart: R,
	insetBlockEnd: R,
	insetInline: R,
	insetInlineStart: R,
	insetInlineEnd: R,
	padding: R,
	paddingTop: R,
	paddingRight: R,
	paddingBottom: R,
	paddingLeft: R,
	paddingBlock: R,
	paddingBlockStart: R,
	paddingBlockEnd: R,
	paddingInline: R,
	paddingInlineStart: R,
	paddingInlineEnd: R,
	margin: R,
	marginTop: R,
	marginRight: R,
	marginBottom: R,
	marginLeft: R,
	marginBlock: R,
	marginBlockStart: R,
	marginBlockEnd: R,
	marginInline: R,
	marginInlineStart: R,
	marginInlineEnd: R,
	fontSize: R,
	backgroundPositionX: R,
	backgroundPositionY: R,
	rotate: so,
	pathRotation: so,
	rotateX: so,
	rotateY: so,
	rotateZ: so,
	scale: Ya,
	scaleX: Ya,
	scaleY: Ya,
	scaleZ: Ya,
	skew: so,
	skewX: so,
	skewY: so,
	distance: R,
	translateX: R,
	translateY: R,
	translateZ: R,
	x: R,
	y: R,
	z: R,
	perspective: R,
	transformPerspective: R,
	opacity: Ja,
	originX: fo,
	originY: fo,
	originZ: R,
	zIndex: Rs,
	fillOpacity: Ja,
	strokeOpacity: Ja,
	numOctaves: Rs
}, Bs = {
	...zs,
	color: mo,
	backgroundColor: mo,
	outlineColor: mo,
	fill: mo,
	stroke: mo,
	borderColor: mo,
	borderTopColor: mo,
	borderRightColor: mo,
	borderBottomColor: mo,
	borderLeftColor: mo,
	filter: Is,
	WebkitFilter: Is,
	mask: Ls,
	WebkitMask: Ls
}, Vs = (e) => Bs[e], Hs = /*@__PURE__*/ new Set([Is, Ls]);
function Us(e, t) {
	let n = Vs(e);
	return Hs.has(n) || (n = z), n.getAnimatableNone ? n.getAnimatableNone(t) : void 0;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/utils/fill-wildcards.mjs
function Ws(e) {
	for (let t = 1; t < e.length; t++) e[t] ?? (e[t] = e[t - 1]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/dom/parse-transform.mjs
var Gs = (e) => e * 180 / Math.PI, Ks = (e) => Js(Gs(Math.atan2(e[1], e[0]))), qs = {
	x: 4,
	y: 5,
	translateX: 4,
	translateY: 5,
	scaleX: 0,
	scaleY: 3,
	scale: (e) => (Math.abs(e[0]) + Math.abs(e[3])) / 2,
	rotate: Ks,
	rotateZ: Ks,
	skewX: (e) => Gs(Math.atan(e[1])),
	skewY: (e) => Gs(Math.atan(e[2])),
	skew: (e) => (Math.abs(e[1]) + Math.abs(e[2])) / 2
}, Js = (e) => (e %= 360, e < 0 && (e += 360), e), Ys = Ks, Xs = (e) => Math.sqrt(e[0] * e[0] + e[1] * e[1]), Zs = (e) => Math.sqrt(e[4] * e[4] + e[5] * e[5]), Qs = {
	x: 12,
	y: 13,
	z: 14,
	translateX: 12,
	translateY: 13,
	translateZ: 14,
	scaleX: Xs,
	scaleY: Zs,
	scale: (e) => (Xs(e) + Zs(e)) / 2,
	rotateX: (e) => Js(Gs(Math.atan2(e[6], e[5]))),
	rotateY: (e) => Js(Gs(Math.atan2(-e[2], e[0]))),
	rotateZ: Ys,
	rotate: Ys,
	skewX: (e) => Gs(Math.atan(e[4])),
	skewY: (e) => Gs(Math.atan(e[1])),
	skew: (e) => (Math.abs(e[1]) + Math.abs(e[4])) / 2
};
function $s(e) {
	return +!!e.includes("scale");
}
function ec(e, t) {
	if (!e || e === "none") return $s(t);
	let n = e.match(/^matrix3d\(([-\d.e\s,]+)\)$/u), r, i;
	if (n) r = Qs, i = n;
	else {
		let t = e.match(/^matrix\(([-\d.e\s,]+)\)$/u);
		r = qs, i = t;
	}
	if (!i) return $s(t);
	let a = r[t], o = i[1].split(",").map(nc);
	return typeof a == "function" ? a(o) : o[a];
}
var tc = (e, t) => {
	let { transform: n = "none" } = getComputedStyle(e);
	return ec(n, t);
};
function nc(e) {
	return parseFloat(e.trim());
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/keys-transform.mjs
var rc = [
	"transformPerspective",
	"x",
	"y",
	"z",
	"translateX",
	"translateY",
	"translateZ",
	"scale",
	"scaleX",
	"scaleY",
	"rotate",
	"rotateX",
	"rotateY",
	"rotateZ",
	"skew",
	"skewX",
	"skewY"
], ic = /* @__PURE__ */ new Set([...rc, "pathRotation"]), ac = (e) => e === qa || e === R, oc = /* @__PURE__ */ new Set([
	"x",
	"y",
	"z"
]), sc = rc.filter((e) => !oc.has(e));
function cc(e) {
	let t = [];
	return sc.forEach((n) => {
		let r = e.getValue(n);
		if (r !== void 0) {
			let e = r.get(), i = +!!n.startsWith("scale");
			if (e === i) return;
			t.push([n, e]), r.set(i);
		}
	}), t;
}
var lc = /* @__PURE__ */ new Set(["bottom", "right"]);
function uc(e, t, n, r, i, a) {
	let o = parseFloat(e);
	if (!isNaN(o)) return o;
	let { min: s, max: c } = t()[n], l = c - s;
	return a === "border-box" ? l : l - parseFloat(r) - parseFloat(i);
}
var dc = {
	width: ({ width: e, paddingLeft: t = "0", paddingRight: n = "0", boxSizing: r }, i) => uc(e, i, "x", t, n, r),
	height: ({ height: e, paddingTop: t = "0", paddingBottom: n = "0", boxSizing: r }, i) => uc(e, i, "y", t, n, r),
	top: ({ top: e }) => parseFloat(e),
	left: ({ left: e }) => parseFloat(e),
	bottom: ({ top: e }, t) => {
		let { y: n } = t();
		return parseFloat(e) + (n.max - n.min);
	},
	right: ({ left: e }, t) => {
		let { x: n } = t();
		return parseFloat(e) + (n.max - n.min);
	},
	x: ({ transform: e }) => ec(e, "x"),
	y: ({ transform: e }) => ec(e, "y")
};
dc.translateX = dc.x, dc.translateY = dc.y;
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/KeyframesResolver.mjs
var fc = /* @__PURE__ */ new Set(), pc = !1, mc = !1, hc = !1;
function gc() {
	if (mc) {
		let e = [], t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
		fc.forEach((r) => {
			r.needsMeasurement && (e.push(r), t.add(r.element), lc.has(r.name) && n.add(r.element));
		});
		let r = /* @__PURE__ */ new Map();
		n.forEach((e) => {
			let t = cc(e);
			t.length && (r.set(e, t), e.render());
		}), e.forEach((e) => e.measureInitialState()), t.forEach((e) => {
			e.render();
			let t = r.get(e);
			t && t.forEach(([t, n]) => {
				e.getValue(t)?.set(n);
			});
		}), e.forEach((e) => e.measureEndState()), e.forEach((e) => {
			e.suspendedScrollY !== void 0 && window.scrollTo(0, e.suspendedScrollY);
		});
	}
	mc = !1, pc = !1, fc.forEach((e) => e.complete(hc)), fc.clear();
}
function _c() {
	fc.forEach((e) => {
		e.readKeyframes(), e.needsMeasurement && (mc = !0);
	});
}
function vc() {
	hc = !0, _c(), gc(), hc = !1;
}
function yc(e, t, n) {
	if (typeof e == "string") {
		if (ta(e) || ra(e)) return parseFloat(e);
		if (!z.test(e) && z.test(n)) return Us(t, n);
	}
	return e ?? void 0;
}
var bc = class {
	constructor(e, t, n, r, i, a = !1) {
		this.state = "pending", this.isAsync = !1, this.needsMeasurement = !1, this.unresolvedKeyframes = [...e], this.onComplete = t, this.name = n, this.motionValue = r, this.element = i, this.isAsync = a;
	}
	scheduleResolve() {
		this.state = "scheduled", this.isAsync ? (fc.add(this), pc || (pc = !0, I.read(_c), I.resolveKeyframes(gc))) : (this.readKeyframes(), this.complete());
	}
	readKeyframes() {
		let { unresolvedKeyframes: e, name: t, element: n, motionValue: r } = this;
		if (e[0] === null) {
			let i = r?.get(), a = e[e.length - 1];
			if (i !== void 0) e[0] = i;
			else if (n && t) {
				let r = yc(n.readValue(t, a), t, a);
				r !== void 0 && (e[0] = r);
			}
			e[0] === void 0 && (e[0] = a), r && i === void 0 && r.set(e[0]);
		}
		Ws(e);
	}
	setFinalKeyframe() {}
	measureInitialState() {}
	renderEndStyles() {}
	measureEndState() {}
	complete(e = !1) {
		this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, e), fc.delete(this);
	}
	cancel() {
		this.state === "scheduled" && (fc.delete(this), this.state = "pending");
	}
	resume() {
		this.state === "pending" && this.scheduleResolve();
	}
}, xc = (e) => e.startsWith("--");
//#endregion
//#region node_modules/motion-dom/dist/es/render/dom/style-set.mjs
function Sc(e, t, n) {
	xc(t) ? e.style.setProperty(t, n) : e.style[t] = n;
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/supports/flags.mjs
var Cc = {};
//#endregion
//#region node_modules/motion-dom/dist/es/utils/supports/memo.mjs
function wc(e, t) {
	let n = /* @__PURE__ */ ia(e);
	return () => Cc[t] ?? n();
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/supports/scroll-timeline.mjs
var Tc = /* @__PURE__ */ wc(() => window.ScrollTimeline !== void 0, "scrollTimeline"), Ec = /*@__PURE__*/ wc(() => {
	try {
		document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
	} catch {
		return !1;
	}
	return !0;
}, "linearEasing"), Dc = ([e, t, n, r]) => `cubic-bezier(${e}, ${t}, ${n}, ${r})`, Oc = {
	linear: "linear",
	ease: "ease",
	easeIn: "ease-in",
	easeOut: "ease-out",
	easeInOut: "ease-in-out",
	circIn: /*@__PURE__*/ Dc([
		0,
		.65,
		.55,
		1
	]),
	circOut: /*@__PURE__*/ Dc([
		.55,
		0,
		1,
		.45
	]),
	backIn: /*@__PURE__*/ Dc([
		.31,
		.01,
		.66,
		-.59
	]),
	backOut: /*@__PURE__*/ Dc([
		.33,
		1.53,
		.69,
		.99
	])
};
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/easing/map-easing.mjs
function kc(e, t) {
	if (e) return typeof e == "function" ? Ec() ? Zo(e, t) : "ease-out" : /* @__PURE__ */ Da(e) ? Dc(e) : Array.isArray(e) ? e.map((e) => kc(e, t) || Oc.easeOut) : Oc[e];
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/start-waapi-animation.mjs
function Ac(e, t, n, { delay: r = 0, duration: i = 300, repeat: a = 0, repeatType: o = "loop", ease: s = "easeOut", times: c } = {}, l = void 0) {
	let u = { [t]: n };
	c && (u.offset = c);
	let d = kc(s, i);
	Array.isArray(d) && (u.easing = d);
	let f = {
		delay: r,
		duration: i,
		easing: Array.isArray(d) ? "linear" : d,
		fill: "both",
		iterations: a + 1,
		direction: o === "reverse" ? "alternate" : "normal"
	};
	return l && (f.pseudoElement = l), e.animate(u, f);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/utils/is-generator.mjs
function jc(e) {
	return typeof e == "function" && "applyToOptions" in e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/utils/apply-generator.mjs
function Mc({ type: e, ...t }) {
	return jc(e) && Ec() ? e.applyToOptions(t) : (t.duration ??= 300, t.ease ??= "easeOut", t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/NativeAnimation.mjs
var Nc = class extends As {
	constructor(e) {
		if (super(), this.finishedTime = null, this.isStopped = !1, this.manualStartTime = null, !e) return;
		let { element: t, name: n, keyframes: r, pseudoElement: i, allowFlatten: a = !1, finalKeyframe: o, onComplete: s } = e;
		this.isPseudoElement = !!i, this.allowFlatten = a, this.options = e, e.type;
		let c = Mc(e);
		this.animation = Ac(t, n, r, c, i), c.autoplay === !1 && this.animation.pause(), this.animation.onfinish = () => {
			if (this.finishedTime = this.time, !i) {
				let e = ws(r, this.options, o, this.speed);
				this.updateMotionValue && this.updateMotionValue(e), Sc(t, n, e), this.animation.cancel();
			}
			s?.(), this.notifyFinished();
		}, Os(this, e, c);
	}
	play() {
		this.isStopped || (this.manualStartTime = null, this.animation.play(), this.state === "finished" && this.updateFinished());
	}
	pause() {
		this.animation.pause();
	}
	complete() {
		this.animation.finish?.();
	}
	cancel() {
		try {
			this.animation.cancel();
		} catch {}
	}
	stop() {
		if (this.isStopped) return;
		this.isStopped = !0;
		let { state: e } = this;
		e !== "idle" && e !== "finished" && (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel());
	}
	commitStyles() {
		let e = this.options?.element;
		!this.isPseudoElement && e?.isConnected && this.animation.commitStyles?.();
	}
	get duration() {
		let e = this.animation.effect?.getComputedTiming?.().duration || 0;
		return /* @__PURE__ */ N(Number(e));
	}
	get iterationDuration() {
		let { delay: e = 0 } = this.options || {};
		return this.duration + /* @__PURE__ */ N(e);
	}
	get time() {
		return /* @__PURE__ */ N(Number(this.animation.currentTime) || 0);
	}
	set time(e) {
		let t = this.finishedTime !== null;
		this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = /* @__PURE__ */ la(e), t && this.animation.pause();
	}
	get speed() {
		return this.animation.playbackRate;
	}
	set speed(e) {
		e < 0 && (this.finishedTime = null), this.animation.playbackRate = e;
	}
	get state() {
		return this.finishedTime === null ? this.animation.playState : "finished";
	}
	get startTime() {
		return this.manualStartTime ?? Number(this.animation.startTime);
	}
	set startTime(e) {
		this.manualStartTime = this.animation.startTime = e;
	}
	attachTimeline({ timeline: e, rangeStart: t, rangeEnd: n, observe: r }) {
		return this.allowFlatten && this.animation.effect?.updateTiming({ easing: "linear" }), this.animation.onfinish = null, e && Tc() ? (this.animation.timeline = e, t && (this.animation.rangeStart = t), n && (this.animation.rangeEnd = n), aa) : r(this);
	}
}, Pc = {
	anticipate: ya,
	backInOut: va,
	circInOut: Sa
};
function Fc(e) {
	return e in Pc;
}
function Ic(e) {
	typeof e.ease == "string" && Fc(e.ease) && (e.ease = Pc[e.ease]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/NativeAnimationExtended.mjs
var Lc = 10, Rc = class extends Nc {
	constructor(e) {
		Ic(e), Es(e), super(e), e.startTime !== void 0 && e.autoplay !== !1 && (this.startTime = e.startTime), this.options = e;
	}
	updateMotionValue(e) {
		let { motionValue: t, onUpdate: n, onComplete: r, element: i, ...a } = this.options;
		if (!t) return;
		if (e !== void 0) {
			t.set(e);
			return;
		}
		let o = new Ms({
			...a,
			autoplay: !1
		}), s = Math.max(Lc, za.now() - this.startTime), c = $i(0, Lc, s - Lc), l = o.sample(s).value, { name: u } = this.options;
		i && u && Sc(i, u, l), t.setWithVelocity(o.sample(Math.max(0, s - c)).value, l, c), o.stop();
	}
}, zc = (e, t) => t !== "zIndex" && !!(typeof e == "number" || Array.isArray(e) || typeof e == "string" && (z.test(e) || e === "0") && !e.startsWith("url("));
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/can-animate.mjs
function Bc(e) {
	let t = e[0];
	if (e.length === 1) return !0;
	for (let n = 0; n < e.length; n++) if (e[n] !== t) return !0;
}
function Vc(e, t, n, r) {
	let i = e[0];
	if (i === null) return !1;
	if (t === "display" || t === "visibility") return !0;
	let a = e[e.length - 1], o = zc(i, t), s = zc(a, t);
	return !o || !s ? (o !== s && `${t}${i}${a}${o ? a : i}`, !1) : Bc(e) || (n === "spring" || jc(n)) && r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/make-animation-instant.mjs
function Hc(e) {
	e.duration = 0, e.type = "keyframes";
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/utils/accelerated-values.mjs
var Uc = /* @__PURE__ */ new Set([
	"opacity",
	"clipPath",
	"filter",
	"transform",
	"backgroundColor"
]), Wc = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/;
function Gc(e) {
	for (let t = 0; t < e.length; t++) if (typeof e[t] == "string" && Wc.test(e[t])) return !0;
	return !1;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/supports/waapi.mjs
var Kc = /* @__PURE__ */ new Set([
	"color",
	"backgroundColor",
	"outlineColor",
	"fill",
	"stroke",
	"borderColor",
	"borderTopColor",
	"borderRightColor",
	"borderBottomColor",
	"borderLeftColor"
]), qc = /*@__PURE__*/ ia(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
function Jc(e) {
	let { motionValue: t, name: n, repeatDelay: r, repeatType: i, damping: a, type: o, keyframes: s } = e;
	if (!n || !(Uc.has(n) || Kc.has(n))) return !1;
	let c = t?.owner?.current;
	if (!(c instanceof HTMLElement) && !(c instanceof SVGElement)) return !1;
	let { onUpdate: l, transformTemplate: u } = t.owner.getProps();
	return qc() && (Uc.has(n) || Kc.has(n) && Gc(s)) && (n !== "transform" || !u) && !l && !r && i !== "mirror" && a !== 0 && o !== "inertia";
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/AsyncMotionValueAnimation.mjs
var Yc = 40, Xc = class extends As {
	constructor(e) {
		super(), this.stop = () => {
			this._animation && (this._animation.stop(), this.stopTimeline?.()), this.keyframeResolver?.cancel();
		}, this.createdAt = za.now();
		let { keyframes: t, name: n, motionValue: r, element: i } = e, a = e;
		a.autoplay ??= !0, a.delay ??= 0, a.type ??= "keyframes", a.repeat ??= 0, a.repeatDelay ??= 0, a.repeatType ??= "loop";
		let o = i?.KeyframeResolver || bc;
		this.keyframeResolver = new o(t, (e, t, n) => this.onKeyframesResolved(e, t, a, !n), n, r, i), this.keyframeResolver?.scheduleResolve();
	}
	onKeyframesResolved(e, t, n, r) {
		this.keyframeResolver = void 0;
		let { name: i, type: a, velocity: o, delay: s, isHandoff: c, onUpdate: l } = n;
		this.resolvedAt = za.now();
		let u = !0;
		Vc(e, i, a, o) || (u = !1, (ea.instantAnimations || !s) && l?.(ws(e, n, t)), e[0] = e[e.length - 1], Hc(n), n.repeat = 0);
		let d = r ? this.resolvedAt && this.resolvedAt - this.createdAt > Yc ? this.resolvedAt : this.createdAt : void 0, { onComplete: f } = n;
		n.startTime ??= d, n.finalKeyframe = t, n.keyframes = e, n.onComplete = () => {
			f?.(), this.notifyFinished();
		};
		let p = u && !c && Jc(n), m;
		if (p) {
			n.element = n.motionValue?.owner?.current;
			try {
				m = new Rc(n);
			} catch {
				m = new Ms(n);
			}
		} else m = new Ms(n);
		this.pendingTimeline &&= (this.stopTimeline = m.attachTimeline(this.pendingTimeline), void 0), this._animation = m;
	}
	get finished() {
		return this._animation ? this._animation.finished : super.finished;
	}
	then(e, t) {
		return this.finished.finally(e).then(() => {});
	}
	get animation() {
		return this._animation || (this.keyframeResolver?.resume(), vc()), this._animation;
	}
	get duration() {
		return this.animation.duration;
	}
	get iterationDuration() {
		return this.animation.iterationDuration;
	}
	get time() {
		return this.animation.time;
	}
	set time(e) {
		this.animation.time = e;
	}
	get speed() {
		return this.animation.speed;
	}
	get state() {
		return this.animation.state;
	}
	set speed(e) {
		this.animation.speed = e;
	}
	get startTime() {
		return this.animation.startTime;
	}
	attachTimeline(e) {
		return this._animation ? this.stopTimeline = this.animation.attachTimeline(e) : this.pendingTimeline = e, () => this.stop();
	}
	play() {
		this.animation.play();
	}
	pause() {
		this.animation.pause();
	}
	complete() {
		this.animation.complete();
	}
	cancel() {
		this._animation && this.animation.cancel(), this.keyframeResolver?.cancel();
	}
};
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/calc-child-stagger.mjs
function Zc(e, t, n, r = 0, i = 1) {
	let a = Array.from(e).sort((e, t) => e.sortNodePosition(t)).indexOf(t), o = e.size, s = (o - 1) * r;
	return typeof n == "function" ? n(a, o) : i === 1 ? a * r : s - a * r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/index.mjs
var Qc = 30, $c = (e) => !isNaN(parseFloat(e)), el = { current: void 0 }, tl = class {
	constructor(e, t = {}) {
		this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (e) => {
			let t = za.now();
			if (this.updatedAt !== t && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(e), this.current !== this.prev && (this.notifyChange(), this.dependents)) for (let e of this.dependents) e.dirty();
		}, this.hasAnimated = !1, this.setCurrent(e), this.owner = t.owner;
	}
	setCurrent(e) {
		this.current = e, this.updatedAt = za.now(), this.canTrackVelocity === null && e !== void 0 && (this.canTrackVelocity = $c(this.current));
	}
	setPrevFrameValue(e = this.current) {
		this.prevFrameValue = e, this.prevUpdatedAt = this.updatedAt;
	}
	onChange(e) {
		return this.on("change", e);
	}
	on(e, t) {
		var n;
		return e === "change" ? this.onChangeSubscribe(t) : ((n = this.events)[e] || (n[e] = new ca())).add(t);
	}
	onChangeSubscribe(e) {
		let { events: t } = this;
		return !t.change && !this.changeSubscriber ? this.changeSubscriber = e : (t.change || (t.change = new ca(), t.change.add(this.changeSubscriber), this.changeSubscriber = void 0), t.change.add(e)), () => {
			this.changeSubscriber === e ? this.changeSubscriber = void 0 : t.change?.remove(e), this.stopIfUnobserved();
		};
	}
	stopIfUnobserved() {
		I.read(() => {
			!this.changeSubscriber && !this.events.change?.getSize() && this.stop();
		});
	}
	clearListeners() {
		this.changeSubscriber = void 0;
		for (let e in this.events) this.events[e].clear();
	}
	attach(e, t) {
		this.passiveEffect = e, this.stopPassiveEffect = t;
	}
	set(e) {
		this.passiveEffect ? this.passiveEffect(e, this.updateAndNotify) : this.updateAndNotify(e);
	}
	setWithVelocity(e, t, n) {
		this.set(t), this.prev = void 0, this.prevFrameValue = e, this.prevUpdatedAt = this.updatedAt - n;
	}
	jump(e, t = !0) {
		this.updateAndNotify(e), this.prev = e, this.prevUpdatedAt = this.prevFrameValue = void 0, t && this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
	}
	dirty() {
		this.notifyChange();
	}
	notifyChange() {
		let { current: e, changeSubscriber: t } = this;
		t ? t(e) : this.events.change?.notify(e);
	}
	addDependent(e) {
		this.dependents ||= /* @__PURE__ */ new Set(), this.dependents.add(e);
	}
	removeDependent(e) {
		this.dependents && this.dependents.delete(e);
	}
	get() {
		return el.current && el.current.push(this), this.current;
	}
	getPrevious() {
		return this.prev;
	}
	getVelocity() {
		let e = za.now();
		if (!this.canTrackVelocity || this.prevFrameValue === void 0 || e - this.updatedAt > Qc) return 0;
		let t = Math.min(this.updatedAt - this.prevUpdatedAt, Qc);
		return /* @__PURE__ */ P(parseFloat(this.current) - parseFloat(this.prevFrameValue), t);
	}
	start(e) {
		return this.stop(), new Promise((t) => {
			this.hasAnimated = !0;
			let n = !1, r;
			r = e(() => {
				n = !0, this.events.animationComplete?.notify(), this.animation === r && this.clearAnimation(), t();
			}), n || (this.animation = r), this.events.animationStart?.notify();
		});
	}
	stop() {
		this.animation && (this.animation.stop(), this.events.animationCancel && this.events.animationCancel.notify()), this.clearAnimation();
	}
	isAnimating() {
		return !!this.animation;
	}
	clearAnimation() {
		this.animation = void 0;
	}
	destroy() {
		this.dependents?.clear(), this.events.destroy?.notify(), this.clearListeners(), this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
	}
};
function nl(e, t) {
	return new tl(e, t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/resolve-transition.mjs
function rl(e, t) {
	if (e?.inherit && t) {
		let { inherit: n, ...r } = e;
		return {
			...t,
			...r
		};
	}
	return e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/get-value-transition.mjs
function il(e, t) {
	let n = e?.[t] ?? e?.default ?? e;
	return n === e ? n : rl(n, e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/default-transitions.mjs
var al = {
	type: "spring",
	stiffness: 500,
	damping: 25,
	restSpeed: 10
}, ol = (e) => ({
	type: "spring",
	stiffness: 550,
	damping: e === 0 ? 2 * Math.sqrt(550) : 30,
	restSpeed: 10
}), sl = {
	type: "keyframes",
	duration: .8
}, cl = {
	type: "keyframes",
	ease: [
		.25,
		.1,
		.35,
		1
	],
	duration: .3
}, ll = (e, { keyframes: t }) => t.length > 2 ? sl : ic.has(e) ? e.startsWith("scale") ? ol(t[1]) : al : cl, ul = /* @__PURE__ */ new Set([
	"when",
	"delay",
	"delayChildren",
	"staggerChildren",
	"staggerDirection",
	"repeat",
	"repeatType",
	"repeatDelay",
	"from",
	"elapsed"
]);
function dl(e) {
	for (let t in e) if (!ul.has(t)) return !0;
	return !1;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/interfaces/motion-value.mjs
var fl = (e, t, n, r = {}, i, a) => (o) => {
	let s = il(r, e) || {}, c = s.delay || r.delay || 0, { elapsed: l = 0 } = r;
	l -= /* @__PURE__ */ la(c);
	let u = {
		keyframes: Array.isArray(n) ? n : [null, n],
		ease: "easeOut",
		velocity: t.getVelocity(),
		...s,
		delay: -l,
		onUpdate: (e) => {
			t.set(e), s.onUpdate && s.onUpdate(e);
		},
		onComplete: () => {
			o(), s.onComplete && s.onComplete();
		},
		name: e,
		motionValue: t,
		element: a ? void 0 : i
	};
	dl(s) || Object.assign(u, ll(e, u)), u.duration &&= /* @__PURE__ */ la(u.duration), u.repeatDelay &&= /* @__PURE__ */ la(u.repeatDelay), u.from !== void 0 && (u.keyframes[0] = u.from);
	let d = !1;
	if ((u.type === !1 || u.duration === 0 && !u.repeatDelay) && (Hc(u), u.delay === 0 && (d = !0)), (ea.instantAnimations || ea.skipAnimations || i?.shouldSkipAnimations || s.skipAnimations) && (d = !0, Hc(u), u.delay = 0), u.allowFlatten = !s.type && !s.ease, d && !a && t.get() !== void 0) {
		let e = ws(u.keyframes, s);
		if (e !== void 0) {
			I.update(() => {
				u.onUpdate(e), u.onComplete();
			});
			return;
		}
	}
	return s.isSync ? new Ms(u) : new Xc(u);
}, pl = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
function ml(e) {
	let t = pl.exec(e);
	if (!t) return [,];
	let [, n, r, i] = t;
	return [`--${n ?? r}`, i];
}
function hl(e, t, n = 1) {
	`${e}`;
	let [r, i] = ml(e);
	if (!r) return;
	let a = window.getComputedStyle(t).getPropertyValue(r);
	if (a) {
		let e = a.trim();
		return ta(e) ? parseFloat(e) : e;
	}
	return Wa(i) ? hl(i, t, n + 1) : i;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/resolve-variants.mjs
function gl(e) {
	let t = [{}, {}];
	return e?.values.forEach((e, n) => {
		t[0][n] = e.get(), t[1][n] = e.getVelocity();
	}), t;
}
function _l(e, t, n, r) {
	if (typeof t == "function") {
		let [i, a] = gl(r);
		t = t(n === void 0 ? e.custom : n, i, a);
	}
	if (typeof t == "string" && (t = e.variants && e.variants[t]), typeof t == "function") {
		let [i, a] = gl(r);
		t = t(n === void 0 ? e.custom : n, i, a);
	}
	return t;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/resolve-dynamic-variants.mjs
function vl(e, t, n) {
	let r = e.getProps();
	return _l(r, t, n === void 0 ? r.custom : n, e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/keys-position.mjs
var U = /* @__PURE__ */ new Set([
	"width",
	"height",
	"top",
	"left",
	"right",
	"bottom",
	...rc
]), yl = (e) => Array.isArray(e);
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/setters.mjs
function bl(e, t, n) {
	e.hasValue(t) ? e.getValue(t).set(n) : e.addValue(t, nl(n));
}
function xl(e) {
	return yl(e) ? e[e.length - 1] || 0 : e;
}
function Sl(e, t) {
	let { transitionEnd: n = {}, transition: r = {}, ...i } = vl(e, t) || {};
	i = {
		...i,
		...n
	};
	for (let t in i) bl(e, t, xl(i[t]));
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/utils/is-motion-value.mjs
var Cl = (e) => !!(e && e.getVelocity);
//#endregion
//#region node_modules/motion-dom/dist/es/value/will-change/is.mjs
function wl(e) {
	return !!(Cl(e) && e.add);
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/will-change/add-will-change.mjs
function Tl(e, t) {
	let n = e.getValue("willChange");
	if (wl(n)) return n.add(t);
	if (!n && ea.WillChange) {
		let n = new ea.WillChange("auto");
		e.addValue("willChange", n), n.add(t);
	}
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/dom/utils/camel-to-dash.mjs
function El(e) {
	return e.replace(/([A-Z])/g, (e) => `-${e.toLowerCase()}`);
}
var Dl = "data-" + El("framerAppearId");
//#endregion
//#region node_modules/motion-dom/dist/es/animation/optimized-appear/get-appear-id.mjs
function Ol(e) {
	return e.props[Dl];
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/interfaces/visual-element-target.mjs
var kl = typeof window < "u";
function Al({ protectedKeys: e, needsAnimating: t }, n) {
	let r = e.hasOwnProperty(n) && t[n] !== !0;
	return t[n] = !1, r;
}
function jl(e, t, { delay: n = 0, transitionOverride: r, type: i } = {}) {
	let { transition: a, transitionEnd: o, ...s } = t, c = e.getDefaultTransition();
	a = a ? rl(a, c) : c;
	let l = a?.reduceMotion, u = a?.skipAnimations;
	r && (a = r);
	let d = [], f = i && e.animationState && e.animationState.getState()[i], p = a?.path;
	p && p.animateVisualElement(e, s, a, n, d);
	for (let t in s) {
		let r = e.getValue(t, e.latestValues[t] ?? null), i = s[t];
		if (i === void 0 || f && Al(f, t)) continue;
		let o = {
			delay: n,
			...il(a || {}, t)
		};
		u && (o.skipAnimations = !0);
		let c = r.get();
		if (c !== void 0 && !r.isAnimating() && !Array.isArray(i) && i === c && !o.velocity) {
			I.update(() => r.set(i));
			continue;
		}
		let p = !1;
		if (kl && window.MotionHandoffAnimation) {
			let n = Ol(e);
			if (n) {
				let e = window.MotionHandoffAnimation(n, t, I);
				e !== null && (o.startTime = e, p = !0);
			}
		}
		Tl(e, t);
		let m = l ?? e.shouldReduceMotion;
		r.start(fl(t, r, i, m && U.has(t) ? { type: !1 } : o, e, p));
		let h = r.animation;
		h && d.push(h);
	}
	if (o) {
		let t = () => I.update(() => {
			o && Sl(e, o);
		});
		d.length ? Promise.all(d).then(t) : t();
	}
	return d;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/interfaces/visual-element-variant.mjs
function Ml(e, t, n = {}) {
	let r = vl(e, t, n.type === "exit" ? e.presenceContext?.custom : void 0), { transition: i = e.getDefaultTransition() || {} } = r || {};
	n.transitionOverride && (i = n.transitionOverride);
	let a = r ? () => Promise.all(jl(e, r, n)) : () => Promise.resolve(), o = e.variantChildren && e.variantChildren.size ? (r = 0) => {
		let { delayChildren: a = 0, staggerChildren: o, staggerDirection: s } = i;
		return Nl(e, t, r, a, o, s, n);
	} : () => Promise.resolve(), { when: s } = i;
	if (s) {
		let [e, t] = s === "beforeChildren" ? [a, o] : [o, a];
		return e().then(() => t());
	}
	return Promise.all([a(), o(n.delay)]);
}
function Nl(e, t, n = 0, r = 0, i = 0, a = 1, o) {
	let s = [];
	for (let c of e.variantChildren) c.notify("AnimationStart", t), s.push(Ml(c, t, {
		...o,
		delay: n + (typeof r == "function" ? 0 : r) + Zc(e.variantChildren, c, r, i, a)
	}).then(() => c.notify("AnimationComplete", t)));
	return Promise.all(s);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/interfaces/visual-element.mjs
function Pl(e, t, n = {}) {
	e.notify("AnimationStart", t);
	let r;
	if (Array.isArray(t)) {
		let i = t.map((t) => Ml(e, t, n));
		r = Promise.all(i);
	} else if (typeof t == "string") r = Ml(e, t, n);
	else {
		let i = typeof t == "function" ? vl(e, t, n.custom) : t;
		r = Promise.all(jl(e, i, n));
	}
	return r.then(() => {
		e.notify("AnimationComplete", t);
	});
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/auto.mjs
var Fl = {
	test: (e) => e === "auto",
	parse: (e) => e
}, Il = (e) => (t) => t.test(e), Ll = [
	qa,
	R,
	co,
	so,
	uo,
	lo,
	Fl
], Rl = (e) => Ll.find(Il(e));
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/utils/is-none.mjs
function zl(e) {
	return typeof e == "number" ? e === 0 : e === null || e === "none" || e === "0" || ra(e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/utils/make-none-animatable.mjs
var Bl = /* @__PURE__ */ new Set([
	"auto",
	"none",
	"0"
]);
function Vl(e, t, n) {
	let r = 0, i;
	for (; r < e.length && !i;) {
		let t = e[r];
		typeof t == "string" && !Bl.has(t) && To(t) && (i = e[r]), r++;
	}
	if (i && n) for (let r of t) e[r] !== i && (e[r] = Us(n, i));
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/DOMKeyframesResolver.mjs
var Hl = class extends bc {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i, !0);
	}
	readKeyframes() {
		let { unresolvedKeyframes: e, element: t, name: n } = this;
		if (!t || !t.current) return;
		super.readKeyframes();
		for (let n = 0; n < e.length; n++) {
			let r = e[n];
			if (typeof r == "string" && (r = r.trim(), Wa(r))) {
				let i = hl(r, t.current);
				i !== void 0 && (e[n] = i), n === e.length - 1 && (this.finalKeyframe = r);
			}
		}
		if (this.resolveNoneKeyframes(), !U.has(n) || e.length !== 2) return;
		let [r, i] = e;
		if (typeof r == "number" && typeof i == "number") return;
		let a = Rl(r), o = Rl(i);
		if (Ka(r) !== Ka(i) && dc[n]) {
			this.needsMeasurement = !0;
			return;
		}
		if (a !== o) {
			if (ac(a) && ac(o)) for (let t = 0; t < e.length; t++) {
				let n = e[t];
				typeof n == "string" && (e[t] = parseFloat(n));
			}
			else dc[n] && (this.needsMeasurement = !0);
		}
	}
	resolveNoneKeyframes() {
		let { unresolvedKeyframes: e, name: t } = this, n = [];
		for (let t = 0; t < e.length; t++) (e[t] === null || zl(e[t])) && n.push(t);
		n.length && Vl(e, n, t);
	}
	measure() {
		let { element: e, name: t } = this;
		return dc[t](window.getComputedStyle(e.current), () => e.measureViewportBox());
	}
	measureInitialState() {
		let { element: e, unresolvedKeyframes: t, name: n } = this;
		if (!e || !e.current) return;
		n === "height" && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = this.measure(), t[0] = this.measuredOrigin;
		let r = t[t.length - 1];
		r !== void 0 && this.motionValue?.jump(r, !1);
	}
	measureEndState() {
		let { element: e, unresolvedKeyframes: t } = this;
		if (!e || !e.current) return;
		this.motionValue?.jump(this.measuredOrigin, !1);
		let n = t.length - 1, r = t[n];
		t[n] = this.measure(), r !== null && this.finalKeyframe === void 0 && (this.finalKeyframe = r), this.removedTransforms?.length && this.removedTransforms.forEach(([t, n]) => {
			e.getValue(t).set(n);
		}), this.resolveNoneKeyframes();
	}
}, Ul = [
	"borderTopLeftRadius",
	"borderTopRightRadius",
	"borderBottomRightRadius",
	"borderBottomLeftRadius"
];
//#endregion
//#region node_modules/motion-dom/dist/es/utils/is-html-element.mjs
function Wl(e) {
	return na(e) && "offsetHeight" in e && !("ownerSVGElement" in e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/is-svg-element.mjs
function Gl(e) {
	return na(e) && "ownerSVGElement" in e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/utils/get-as-type.mjs
var Kl = (e, t) => t && typeof e == "number" ? t.transform(e) : e;
//#endregion
//#region node_modules/motion-dom/dist/es/utils/resolve-elements.mjs
function ql(e, t, n) {
	if (e == null) return [];
	if (e instanceof EventTarget) return [e];
	if (typeof e == "string") {
		let r = document;
		t && (r = t.current);
		let i = n?.[e] ?? r.querySelectorAll(e);
		return i ? Array.from(i) : [];
	}
	return Array.from(e).filter((e) => e != null);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/utils/build-transform.mjs
var Jl = {
	x: "translateX",
	y: "translateY",
	z: "translateZ",
	transformPerspective: "perspective"
}, Yl = rc.length;
function Xl(e, t, n) {
	let r = "", i = !0;
	for (let a = 0; a < Yl; a++) {
		let o = rc[a], s = e[o];
		if (s === void 0) continue;
		let c = !0;
		if (typeof s == "number") c = s === +!!o.startsWith("scale");
		else {
			let e = parseFloat(s);
			c = o.startsWith("scale") ? e === 1 : e === 0;
		}
		if (!c || n) {
			let e = Kl(s, zs[o]);
			if (!c) {
				i = !1;
				let t = Jl[o] || o;
				r += `${t}(${e}) `;
			}
			n && (t[o] = e);
		}
	}
	let a = e.pathRotation;
	return a && (i = !1, r += `rotate(${Kl(a, zs.pathRotation)}) `), r = r.trim(), n ? r = n(t, i ? "" : r) : i && (r = "none"), r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/utils/build-styles.mjs
function Zl(e, t, n) {
	let { style: r, vars: i, transformOrigin: a } = e, o = !1, s = !1;
	for (let e in t) {
		let n = t[e];
		if (ic.has(e)) {
			o = !0;
			continue;
		}
		if (Ha(e)) {
			i[e] = n;
			continue;
		}
		{
			let t = Kl(n, zs[e]);
			e.startsWith("origin") ? (s = !0, a[e] = t) : r[e] = t;
		}
	}
	if (t.transform || (o || n ? r.transform = Xl(t, e.transform, n) : r.transform &&= "none"), s) {
		let { originX: e = "50%", originY: t = "50%", originZ: n = 0 } = a;
		r.transformOrigin = `${e} ${t} ${n}`;
	}
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/utils/path.mjs
var Ql = {
	offset: "stroke-dashoffset",
	array: "stroke-dasharray"
}, $l = {
	offset: "strokeDashoffset",
	array: "strokeDasharray"
};
function eu(e, t, n = 1, r = 0, i = !0) {
	e.pathLength = 1;
	let a = i ? Ql : $l;
	e[a.offset] = `${-r}`, e[a.array] = `${t} ${n}`;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/utils/build-attrs.mjs
var tu = [
	"transform",
	"opacity",
	"offsetDistance",
	"offsetPath",
	"offsetRotate",
	"offsetAnchor"
];
function nu(e, { attrX: t, attrY: n, attrScale: r, pathLength: i, pathSpacing: a = 1, pathOffset: o = 0, ...s }, c, l, u) {
	if (Zl(e, s, l), c) {
		e.style.viewBox && (e.attrs.viewBox = e.style.viewBox);
		return;
	}
	e.attrs = e.style, e.style = {};
	let { attrs: d, style: f } = e;
	for (let e of tu) d[e] !== void 0 && (f[e] = d[e], delete d[e]);
	(f.transform || d.transformOrigin) && (f.transformOrigin = d.transformOrigin ?? "50% 50%", delete d.transformOrigin), f.transform && (f.transformBox = u?.transformBox ?? "fill-box", delete d.transformBox), t !== void 0 && (d.x = t), n !== void 0 && (d.y = n), r !== void 0 && (d.scale = r), i !== void 0 && eu(d, i, a, o, !1);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/conversion.mjs
function ru({ top: e, left: t, right: n, bottom: r }) {
	return {
		x: {
			min: t,
			max: n
		},
		y: {
			min: e,
			max: r
		}
	};
}
function iu({ x: e, y: t }) {
	return {
		top: t.min,
		right: e.max,
		bottom: t.max,
		left: e.min
	};
}
function au(e, t) {
	if (!t) return e;
	let n = t({
		x: e.left,
		y: e.top
	}), r = t({
		x: e.right,
		y: e.bottom
	});
	return {
		top: n.y,
		left: n.x,
		bottom: r.y,
		right: r.x
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/utils/has-transform.mjs
function W(e) {
	return e === void 0 || e === 1;
}
function ou({ scale: e, scaleX: t, scaleY: n }) {
	return !W(e) || !W(t) || !W(n);
}
function su(e) {
	return ou(e) || cu(e) || e.z || e.rotate || e.rotateX || e.rotateY || e.skewX || e.skewY;
}
function cu(e) {
	return lu(e.x) || lu(e.y);
}
function lu(e) {
	return e && e !== "0%";
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/delta-apply.mjs
function uu(e, t, n) {
	return n + t * (e - n);
}
function du(e, t, n, r, i) {
	return i !== void 0 && (e = uu(e, i, r)), uu(e, n, r) + t;
}
function fu(e, t = 0, n = 1, r, i) {
	e.min = du(e.min, t, n, r, i), e.max = du(e.max, t, n, r, i);
}
function pu(e, { x: t, y: n }) {
	fu(e.x, t.translate, t.scale, t.originPoint), fu(e.y, n.translate, n.scale, n.originPoint);
}
var mu = .999999999999, hu = 1.0000000000001;
function gu(e, t, n, r = !1) {
	let i = n.length;
	if (!i) return;
	t.x = t.y = 1;
	let a, o;
	for (let s = 0; s < i; s++) {
		a = n[s], o = a.projectionDelta;
		let { visualElement: i } = a.options;
		i && i.props.style && i.props.style.display === "contents" || (r && a.options.layoutScroll && a.scroll && a !== a.root && (_u(e.x, -a.scroll.offset.x), _u(e.y, -a.scroll.offset.y)), o && (t.x *= o.x.scale, t.y *= o.y.scale, pu(e, o)), r && su(a.latestValues) && bu(e, a.latestValues, a.layout?.layoutBox));
	}
	t.x < hu && t.x > mu && (t.x = 1), t.y < hu && t.y > mu && (t.y = 1);
}
function _u(e, t) {
	e.min += t, e.max += t;
}
function vu(e, t, n, r, i = .5) {
	fu(e, t, n, B(e.min, e.max, i), r);
}
function yu(e, t) {
	return typeof e == "string" ? parseFloat(e) / 100 * (t.max - t.min) : e;
}
function bu(e, t, n) {
	let r = n ?? e;
	vu(e.x, yu(t.x, r.x), t.scaleX, t.scale, t.originX), vu(e.y, yu(t.y, r.y), t.scaleY, t.scale, t.originY);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/utils/measure.mjs
function xu(e, t) {
	return ru(au(e.getBoundingClientRect(), t));
}
function Su(e, t, n) {
	let r = xu(e, n), { scroll: i } = t;
	return i && (_u(r.x, i.offset.x), _u(r.y, i.offset.y)), r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/frameloop/microtask.mjs
var { schedule: Cu, cancel: wu } = /* @__PURE__ */ Pa(queueMicrotask, !1), Tu = {
	x: !1,
	y: !1
};
function Eu() {
	return Tu.x || Tu.y;
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/drag/state/set-active.mjs
function Du(e) {
	return e === "x" || e === "y" ? Tu[e] ? null : (Tu[e] = !0, () => {
		Tu[e] = !1;
	}) : Tu.x || Tu.y ? null : (Tu.x = Tu.y = !0, () => {
		Tu.x = Tu.y = !1;
	});
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/utils/setup.mjs
function Ou(e, t) {
	let n = ql(e), r = new AbortController();
	return [
		n,
		{
			passive: !0,
			...t,
			signal: r.signal
		},
		() => r.abort()
	];
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/hover.mjs
function ku(e) {
	return !(e.pointerType === "touch" || Eu());
}
function Au(e, t, n = {}) {
	let [r, i, a] = Ou(e, n);
	return r.forEach((e) => {
		let n = !1, r = !1, a, o = () => {
			e.removeEventListener("pointerleave", u);
		}, s = (e) => {
			a &&= (a(e), void 0), o();
		}, c = (e) => {
			n = !1, window.removeEventListener("pointerup", c), window.removeEventListener("pointercancel", c), r && (r = !1, s(e));
		}, l = () => {
			n = !0, window.addEventListener("pointerup", c, i), window.addEventListener("pointercancel", c, i);
		}, u = (e) => {
			if (e.pointerType !== "touch") {
				if (n) {
					r = !0;
					return;
				}
				s(e);
			}
		};
		e.addEventListener("pointerenter", (n) => {
			if (!ku(n)) return;
			r = !1;
			let o = t(e, n);
			typeof o == "function" && (a = o, e.addEventListener("pointerleave", u, i));
		}, i), e.addEventListener("pointerdown", l, i);
	}), a;
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/utils/is-node-or-child.mjs
var ju = (e, t) => t ? e === t || ju(e, t.parentElement) : !1, Mu = (e) => e.pointerType === "mouse" ? typeof e.button != "number" || e.button <= 0 : e.isPrimary !== !1, Nu = /* @__PURE__ */ new Set([
	"BUTTON",
	"INPUT",
	"SELECT",
	"TEXTAREA",
	"A"
]);
function Pu(e) {
	return Nu.has(e.tagName) || e.isContentEditable === !0;
}
var Fu = /* @__PURE__ */ new Set([
	"INPUT",
	"SELECT",
	"TEXTAREA"
]);
function Iu(e) {
	return Fu.has(e.tagName) || e.isContentEditable === !0;
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/press/utils/state.mjs
var Lu = /* @__PURE__ */ new WeakSet();
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/press/utils/keyboard.mjs
function Ru(e) {
	return (t) => {
		t.key === "Enter" && e(t);
	};
}
function zu(e, t) {
	e.dispatchEvent(new PointerEvent("pointer" + t, {
		isPrimary: !0,
		bubbles: !0
	}));
}
var Bu = (e, t) => {
	let n = e.currentTarget;
	if (!n) return;
	let r = Ru(() => {
		if (Lu.has(n)) return;
		zu(n, "down");
		let e = Ru(() => {
			zu(n, "up");
		});
		n.addEventListener("keyup", e, t), n.addEventListener("blur", () => zu(n, "cancel"), t);
	});
	n.addEventListener("keydown", r, t), n.addEventListener("blur", () => n.removeEventListener("keydown", r), t);
};
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/press/index.mjs
function Vu(e) {
	return Mu(e) && !Eu();
}
var Hu = /* @__PURE__ */ new WeakSet();
function Uu(e, t, n = {}) {
	let [r, i, a] = Ou(e, n), o = (e) => {
		let r = e.currentTarget;
		if (!Vu(e) || Hu.has(e)) return;
		Lu.add(r), n.stopPropagation && Hu.add(e);
		let a = t(r, e), o = {
			...i,
			capture: !0
		}, s = (e, t) => {
			window.removeEventListener("pointerup", c, o), window.removeEventListener("pointercancel", l, o), Lu.has(r) && Lu.delete(r), Vu(e) && typeof a == "function" && a(e, { success: t });
		}, c = (e) => {
			s(e, r === window || r === document || n.useGlobalTarget || ju(r, e.target));
		}, l = (e) => {
			s(e, !1);
		};
		window.addEventListener("pointerup", c, o), window.addEventListener("pointercancel", l, o);
	};
	return r.forEach((e) => {
		(n.useGlobalTarget ? window : e).addEventListener("pointerdown", o, i), Wl(e) && (e.addEventListener("focus", (e) => Bu(e, i)), !Pu(e) && !e.hasAttribute("tabindex") && (e.tabIndex = 0));
	}), a;
}
//#endregion
//#region node_modules/motion-dom/dist/es/resize/handle-element.mjs
var Wu = /* @__PURE__ */ new WeakMap(), Gu, Ku = (e, t, n) => (r, i) => i && i[0] ? i[0][e + "Size"] : Gl(r) && "getBBox" in r ? r.getBBox()[t] : r[n], qu = /*@__PURE__*/ Ku("inline", "width", "offsetWidth"), Ju = /*@__PURE__*/ Ku("block", "height", "offsetHeight");
function Yu({ target: e, borderBoxSize: t }) {
	Wu.get(e)?.forEach((n) => {
		n(e, {
			get width() {
				return qu(e, t);
			},
			get height() {
				return Ju(e, t);
			}
		});
	});
}
function Xu(e) {
	e.forEach(Yu);
}
function Zu() {
	typeof ResizeObserver < "u" && (Gu = new ResizeObserver(Xu));
}
function Qu(e, t) {
	Gu || Zu();
	let n = ql(e);
	return n.forEach((e) => {
		let n = Wu.get(e);
		n || (n = /* @__PURE__ */ new Set(), Wu.set(e, n)), n.add(t), Gu?.observe(e);
	}), () => {
		n.forEach((e) => {
			let n = Wu.get(e);
			n?.delete(t), n?.size || Gu?.unobserve(e);
		});
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/resize/handle-window.mjs
var $u = /* @__PURE__ */ new Set(), ed;
function G() {
	ed = () => {
		let e = {
			get width() {
				return window.innerWidth;
			},
			get height() {
				return window.innerHeight;
			}
		};
		$u.forEach((t) => t(e));
	}, window.addEventListener("resize", ed);
}
function K(e) {
	return $u.add(e), ed || G(), () => {
		$u.delete(e), !$u.size && typeof ed == "function" && (window.removeEventListener("resize", ed), ed = void 0);
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/resize/index.mjs
function q(e, t) {
	return typeof e == "function" ? K(e) : Qu(e, t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/stats/buffer.mjs
var J = {
	value: null,
	addProjectionMetrics: null
};
//#endregion
//#region node_modules/motion-dom/dist/es/utils/is-svg-svg-element.mjs
function Y(e) {
	return Gl(e) && e.tagName === "svg";
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/models.mjs
var td = () => ({
	translate: 0,
	scale: 1,
	origin: 0,
	originPoint: 0
}), nd = () => ({
	x: td(),
	y: td()
}), rd = () => ({
	min: 0,
	max: 0
}), id = () => ({
	x: rd(),
	y: rd()
}), ad = /* @__PURE__ */ new WeakMap();
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/is-animation-controls.mjs
function od(e) {
	return typeof e == "object" && !!e && typeof e.start == "function";
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/is-variant-label.mjs
function sd(e) {
	return typeof e == "string" || Array.isArray(e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/variant-props.mjs
var cd = [
	"animate",
	"whileInView",
	"whileFocus",
	"whileHover",
	"whileTap",
	"whileDrag",
	"exit"
], ld = ["initial", ...cd];
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/is-controlling-variants.mjs
function ud(e) {
	if (od(e.animate)) return !0;
	for (let t = 0; t < ld.length; t++) if (sd(e[ld[t]])) return !0;
	return !1;
}
function dd(e) {
	return !!(ud(e) || e.variants);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/motion-values.mjs
function fd(e, t, n) {
	for (let r in t) {
		let i = t[r], a = n[r];
		if (Cl(i)) e.addValue(r, i);
		else if (Cl(a)) e.addValue(r, nl(i, { owner: e }));
		else if (a !== i) {
			if (e.hasValue(r)) {
				let t = e.getValue(r);
				t.liveStyle === !0 ? t.jump(i) : t.hasAnimated || t.set(i);
			} else {
				let t = e.getStaticValue(r);
				e.addValue(r, nl(t === void 0 ? i : t, { owner: e }));
			}
		}
	}
	for (let r in n) t[r] === void 0 && e.removeValue(r);
	return t;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/reduced-motion/state.mjs
var pd = { current: null }, md = { current: !1 }, hd = typeof window < "u";
function gd() {
	if (md.current = !0, hd) {
		if (window.matchMedia) {
			let e = window.matchMedia("(prefers-reduced-motion)"), t = () => pd.current = e.matches;
			e.addEventListener("change", t), t();
		} else pd.current = !1;
	}
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/VisualElement.mjs
var _d = [
	"AnimationStart",
	"AnimationComplete",
	"Update",
	"BeforeLayoutMeasure",
	"LayoutMeasure",
	"LayoutAnimationStart",
	"LayoutAnimationComplete"
], vd = {};
function yd(e) {
	vd = e;
}
function bd() {
	return vd;
}
var xd = class {
	scrapeMotionValuesFromProps(e, t, n) {
		return {};
	}
	constructor({ parent: e, props: t, presenceContext: n, reducedMotionConfig: r, skipAnimations: i, blockInitialAnimation: a, visualState: o }, s = {}) {
		this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = !1, this.isControllingVariants = !1, this.shouldReduceMotion = null, this.shouldSkipAnimations = !1, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = bc, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = !1, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
			this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
		}, this.renderScheduledAt = 0, this.scheduleRender = () => {
			let e = za.now();
			this.renderScheduledAt < e && (this.renderScheduledAt = e, I.render(this.render, !1, !0));
		};
		let { latestValues: c, renderState: l } = o;
		this.latestValues = c, this.baseTarget = { ...c }, this.initialValues = t.initial ? { ...c } : {}, this.renderState = l, this.parent = e, this.props = t, this.presenceContext = n, this.depth = e ? e.depth + 1 : 0, this.reducedMotionConfig = r, this.skipAnimationsConfig = i, this.options = s, this.blockInitialAnimation = !!a, this.isControllingVariants = ud(t), this.isVariantNode = dd(t), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(e && e.current);
		let { willChange: u, ...d } = this.scrapeMotionValuesFromProps(t, {}, this);
		for (let e in d) {
			let t = d[e];
			c[e] !== void 0 && Cl(t) && t.set(c[e]);
		}
	}
	mount(e) {
		if (this.hasBeenMounted) for (let e in this.initialValues) this.values.get(e)?.jump(this.initialValues[e]), this.latestValues[e] = this.initialValues[e];
		this.current = e, ad.set(e, this), this.projection && !this.projection.instance && this.projection.mount(e), this.parent && this.isVariantNode && !this.isControllingVariants && (this.removeFromVariantTree = this.parent.addVariantChild(this)), this.values.forEach((e, t) => this.bindToMotionValue(t, e)), this.reducedMotionConfig === "never" ? this.shouldReduceMotion = !1 : this.reducedMotionConfig === "always" ? this.shouldReduceMotion = !0 : (md.current || gd(), this.shouldReduceMotion = pd.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? !1, this.parent?.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = !0;
	}
	unmount() {
		this.projection && this.projection.unmount(), L(this.notifyUpdate), L(this.render), this.valueSubscriptions.forEach((e) => e()), this.valueSubscriptions.clear(), this.removeFromVariantTree && this.removeFromVariantTree(), this.parent?.removeChild(this);
		for (let e in this.events) this.events[e].clear();
		for (let e in this.features) {
			let t = this.features[e];
			t && (t.unmount(), t.isMounted = !1);
		}
		this.current = null;
	}
	addChild(e) {
		this.children.add(e), this.enteringChildren ??= /* @__PURE__ */ new Set(), this.enteringChildren.add(e);
	}
	removeChild(e) {
		this.children.delete(e), this.enteringChildren && this.enteringChildren.delete(e);
	}
	bindToMotionValue(e, t) {
		if (this.valueSubscriptions.has(e) && this.valueSubscriptions.get(e)(), t.accelerate && Uc.has(e) && this.current instanceof HTMLElement) {
			let { factory: n, keyframes: r, times: i, ease: a, duration: o } = t.accelerate, s = new Nc({
				element: this.current,
				name: e,
				keyframes: r,
				times: i,
				ease: a,
				duration: /* @__PURE__ */ la(o)
			}), c = n(s);
			this.valueSubscriptions.set(e, () => {
				c(), s.cancel();
			});
			return;
		}
		let n = ic.has(e);
		n && this.onBindTransform && this.onBindTransform();
		let r = t.on("change", (t) => {
			this.latestValues[e] = t, this.props.onUpdate && I.preRender(this.notifyUpdate), n && this.projection && (this.projection.isTransformDirty = !0), this.scheduleRender();
		}), i;
		typeof window < "u" && window.MotionCheckAppearSync && (i = window.MotionCheckAppearSync(this, e, t)), this.valueSubscriptions.set(e, () => {
			r(), i && i();
		});
	}
	sortNodePosition(e) {
		return !this.current || !this.sortInstanceNodePosition || this.type !== e.type ? 0 : this.sortInstanceNodePosition(this.current, e.current);
	}
	updateFeatures() {
		let e = "animation";
		for (e in vd) {
			let t = vd[e];
			if (!t) continue;
			let { isEnabled: n, Feature: r } = t;
			if (!this.features[e] && r && n(this.props) && (this.features[e] = new r(this)), this.features[e]) {
				let t = this.features[e];
				t.isMounted ? t.update() : (t.mount(), t.isMounted = !0);
			}
		}
	}
	triggerBuild() {
		this.build(this.renderState, this.latestValues, this.props);
	}
	measureViewportBox() {
		return this.current ? this.measureInstanceViewportBox(this.current, this.props) : id();
	}
	getStaticValue(e) {
		return this.latestValues[e];
	}
	setStaticValue(e, t) {
		this.latestValues[e] = t;
	}
	update(e, t) {
		(e.transformTemplate || this.props.transformTemplate) && this.scheduleRender(), this.prevProps = this.props, this.props = e, this.prevPresenceContext = this.presenceContext, this.presenceContext = t;
		for (let t = 0; t < _d.length; t++) {
			let n = _d[t];
			this.propEventSubscriptions[n] && (this.propEventSubscriptions[n](), delete this.propEventSubscriptions[n]);
			let r = e["on" + n];
			r && (this.propEventSubscriptions[n] = this.on(n, r));
		}
		this.prevMotionValues = fd(this, this.scrapeMotionValuesFromProps(e, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
	}
	getProps() {
		return this.props;
	}
	getVariant(e) {
		return this.props.variants ? this.props.variants[e] : void 0;
	}
	getDefaultTransition() {
		return this.props.transition;
	}
	getTransformPagePoint() {
		return this.props.transformPagePoint;
	}
	getClosestVariantNode() {
		return this.isVariantNode ? this : this.parent ? this.parent.getClosestVariantNode() : void 0;
	}
	addVariantChild(e) {
		let t = this.getClosestVariantNode();
		if (t) return t.variantChildren && t.variantChildren.add(e), () => t.variantChildren.delete(e);
	}
	addValue(e, t) {
		let n = this.values.get(e);
		t !== n && (n && this.removeValue(e), this.bindToMotionValue(e, t), this.values.set(e, t), this.latestValues[e] = t.get());
	}
	removeValue(e) {
		this.values.delete(e);
		let t = this.valueSubscriptions.get(e);
		t && (t(), this.valueSubscriptions.delete(e)), delete this.latestValues[e], this.removeValueFromRenderState(e, this.renderState);
	}
	hasValue(e) {
		return this.values.has(e);
	}
	getValue(e, t) {
		if (this.props.values && this.props.values[e]) return this.props.values[e];
		let n = this.values.get(e);
		return n === void 0 && t !== void 0 && (n = nl(t === null ? void 0 : t, { owner: this }), this.addValue(e, n)), n;
	}
	readValue(e, t) {
		let n = this.latestValues[e] !== void 0 || !this.current ? this.latestValues[e] : this.getBaseTargetFromProps(this.props, e) ?? this.readValueFromInstance(this.current, e, this.options);
		return n != null && (typeof n == "string" && (ta(n) || ra(n)) ? n = parseFloat(n) : typeof n != "number" && !z.test(n) && z.test(t) && (n = Us(e, t)), this.setBaseTarget(e, Cl(n) ? n.get() : n)), Cl(n) ? n.get() : n;
	}
	setBaseTarget(e, t) {
		this.baseTarget[e] = t;
	}
	getBaseTarget(e) {
		let { initial: t } = this.props, n;
		if (typeof t == "string" || typeof t == "object") {
			let r = _l(this.props, t, this.presenceContext?.custom);
			r && (n = r[e]);
		}
		if (t && n !== void 0) return n;
		let r = this.getBaseTargetFromProps(this.props, e);
		return r !== void 0 && !Cl(r) ? r : this.initialValues[e] !== void 0 && n === void 0 ? void 0 : this.baseTarget[e];
	}
	on(e, t) {
		return this.events[e] || (this.events[e] = new ca()), this.events[e].add(t);
	}
	notify(e, ...t) {
		this.events[e] && this.events[e].notify(...t);
	}
	scheduleRenderMicrotask() {
		Cu.render(this.render);
	}
}, Sd = class extends xd {
	constructor() {
		super(...arguments), this.KeyframeResolver = Hl;
	}
	sortInstanceNodePosition(e, t) {
		return e.compareDocumentPosition(t) & 2 ? 1 : -1;
	}
	getBaseTargetFromProps(e, t) {
		let n = e.style;
		return n ? n[t] : void 0;
	}
	removeValueFromRenderState(e, { vars: t, style: n }) {
		delete t[e], delete n[e];
	}
	handleChildMotionValue() {
		this.childSubscription && (this.childSubscription(), delete this.childSubscription);
		let { children: e } = this.props;
		Cl(e) && (this.childSubscription = e.on("change", (e) => {
			this.current && (this.current.textContent = `${e}`);
		}));
	}
}, Cd = class {
	constructor(e) {
		this.isMounted = !1, this.node = e;
	}
	update() {}
};
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/utils/render.mjs
function wd(e, { style: t, vars: n }, r, i) {
	let a = e.style, o;
	for (o in t) a[o] = t[o];
	for (o in i?.applyProjectionStyles(a, r), n) a.setProperty(o, n[o]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/styles/scale-border-radius.mjs
function Td(e, t) {
	return t.max === t.min ? 0 : e / (t.max - t.min) * 100;
}
var Ed = { correct: (e, t) => {
	if (!t.target) return e;
	if (typeof e == "string") {
		if (R.test(e)) e = parseFloat(e);
		else return e;
	}
	return `${Td(e, t.target.x)}% ${Td(e, t.target.y)}%`;
} }, Dd = { correct: (e, { treeScale: t, projectionDelta: n }) => {
	let r = e, i = z.parse(e);
	if (i.length > 5) return r;
	let a = z.createTransformer(e), o = typeof i[0] == "number" ? 0 : 1, s = n.x.scale * t.x, c = n.y.scale * t.y;
	i[0 + o] /= s, i[1 + o] /= c;
	let l = B(s, c, .5);
	return typeof i[2 + o] == "number" && (i[2 + o] /= l), typeof i[3 + o] == "number" && (i[3 + o] /= l), a(i);
} }, Od = {
	borderRadius: {
		...Ed,
		applyTo: [...Ul]
	},
	borderTopLeftRadius: Ed,
	borderTopRightRadius: Ed,
	borderBottomLeftRadius: Ed,
	borderBottomRightRadius: Ed,
	boxShadow: Dd
};
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/is-forced-motion-value.mjs
function kd(e, { layout: t, layoutId: n }) {
	return ic.has(e) || e.startsWith("origin") || (t || n !== void 0) && (!!Od[e] || e === "opacity");
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/utils/scrape-motion-values.mjs
function Ad(e, t, n) {
	let r = e.style, i = t?.style, a = {};
	if (!r) return a;
	for (let t in r) (Cl(r[t]) || i && Cl(i[t]) || kd(t, e) || n?.getValue(t)?.liveStyle !== void 0) && (a[t] = r[t]);
	return a;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/HTMLVisualElement.mjs
function jd(e) {
	return window.getComputedStyle(e);
}
var Md = class extends Sd {
	constructor() {
		super(...arguments), this.type = "html", this.renderInstance = wd;
	}
	mount(e) {
		e.style, super.mount(e);
	}
	readValueFromInstance(e, t) {
		if (ic.has(t)) return this.projection?.isProjecting ? $s(t) : tc(e, t);
		{
			let n = jd(e), r = (Ha(t) ? n.getPropertyValue(t) : n[t]) || 0;
			return typeof r == "string" ? r.trim() : r;
		}
	}
	measureInstanceViewportBox(e, { transformPagePoint: t }) {
		return xu(e, t);
	}
	build(e, t, n) {
		Zl(e, t, n.transformTemplate);
	}
	scrapeMotionValuesFromProps(e, t, n) {
		return Ad(e, t, n);
	}
}, Nd = /* @__PURE__ */ new Set([
	"baseFrequency",
	"diffuseConstant",
	"kernelMatrix",
	"kernelUnitLength",
	"keySplines",
	"keyTimes",
	"limitingConeAngle",
	"markerHeight",
	"markerWidth",
	"numOctaves",
	"targetX",
	"targetY",
	"surfaceScale",
	"specularConstant",
	"specularExponent",
	"stdDeviation",
	"tableValues",
	"viewBox",
	"gradientTransform",
	"pathLength",
	"startOffset",
	"textLength",
	"lengthAdjust"
]), Pd = (e) => typeof e == "string" && e.toLowerCase() === "svg";
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/utils/render.mjs
function Fd(e, t, n, r) {
	wd(e, t, void 0, r);
	for (let n in t.attrs) e.setAttribute(Nd.has(n) ? n : El(n), t.attrs[n]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/utils/scrape-motion-values.mjs
function Id(e, t, n) {
	let r = Ad(e, t, n);
	for (let n in e) if (Cl(e[n]) || Cl(t[n])) {
		let t = rc.indexOf(n) === -1 ? n : "attr" + n.charAt(0).toUpperCase() + n.substring(1);
		r[t] = e[n];
	}
	return r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/SVGVisualElement.mjs
var Ld = class extends Sd {
	constructor() {
		super(...arguments), this.type = "svg", this.isSVGTag = !1, this.measureInstanceViewportBox = id;
	}
	getBaseTargetFromProps(e, t) {
		return e[t];
	}
	readValueFromInstance(e, t) {
		if (ic.has(t)) {
			let e = Vs(t);
			return e && e.default || 0;
		}
		if (tu.includes(t)) {
			let n = getComputedStyle(e)[t];
			if (typeof n == "string" && n) return n.trim();
		}
		return t = Nd.has(t) ? t : El(t), e.getAttribute(t);
	}
	scrapeMotionValuesFromProps(e, t, n) {
		return Id(e, t, n);
	}
	build(e, t, n) {
		nu(e, t, this.isSVGTag, n.transformTemplate, n.style);
	}
	renderInstance(e, t, n, r) {
		Fd(e, t, n, r);
	}
	mount(e) {
		this.isSVGTag = Pd(e.tagName), super.mount(e);
	}
}, Rd = ld.length;
function zd(e) {
	if (!e) return;
	if (!e.isControllingVariants) {
		let t = e.parent && zd(e.parent) || {};
		return e.props.initial !== void 0 && (t.initial = e.props.initial), t;
	}
	let t = {};
	for (let n = 0; n < Rd; n++) {
		let r = ld[n], i = e.props[r];
		(sd(i) || i === !1) && (t[r] = i);
	}
	return t;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/shallow-compare.mjs
function Bd(e, t) {
	if (!Array.isArray(t)) return !1;
	let n = t.length;
	if (n !== e.length) return !1;
	for (let r = 0; r < n; r++) if (t[r] !== e[r]) return !1;
	return !0;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/animation-state.mjs
var Vd = [...cd].reverse(), Hd = cd.length;
function Ud(e) {
	return (t) => Promise.all(t.map(({ animation: t, options: n }) => Pl(e, t, n)));
}
function Wd(e) {
	let t = Ud(e), n = qd(), r = !0, i = !1, a = (t) => (n, r) => {
		let i = vl(e, r, t === "exit" ? e.presenceContext?.custom : void 0);
		if (i) {
			let { transition: e, transitionEnd: t, ...r } = i;
			n = {
				...n,
				...r,
				...t
			};
		}
		return n;
	};
	function o(n) {
		t = n(e);
	}
	function s(o) {
		let { props: s } = e, c = zd(e.parent) || {}, l = [], u = /* @__PURE__ */ new Set(), d = {}, f = Infinity;
		for (let t = 0; t < Hd; t++) {
			let p = Vd[t], m = n[p], h = s[p] === void 0 ? c[p] : s[p], g = sd(h), _ = p === o ? m.isActive : null;
			_ === !1 && (f = t);
			let v = h === c[p] && h !== s[p] && g;
			if (v && (r || i) && e.manuallyAnimateOnMount && (v = !1), m.protectedKeys = { ...d }, !m.isActive && _ === null || !h && !m.prevProp || od(h) || typeof h == "boolean") continue;
			if (p === "exit" && m.isActive && _ !== !0) {
				m.prevResolvedValues && (d = {
					...d,
					...m.prevResolvedValues
				});
				continue;
			}
			let y = Gd(m.prevProp, h), b = y || p === o && m.isActive && !v && g || t > f && g, x = !1, S = Array.isArray(h) ? h : [h], C = S.reduce(a(p), {});
			_ === !1 && (C = {});
			let { prevResolvedValues: w = {} } = m, T = {
				...w,
				...C
			}, E = (t) => {
				b = !0, u.has(t) && (x = !0, u.delete(t)), m.needsAnimating[t] = !0;
				let n = e.getValue(t);
				n && (n.liveStyle = !1);
			};
			for (let e in T) {
				let t = C[e], n = w[e];
				if (d.hasOwnProperty(e)) continue;
				let r = !1;
				r = yl(t) && yl(n) ? !Bd(t, n) || y : t !== n, r ? t == null ? u.add(e) : E(e) : t !== void 0 && u.has(e) ? E(e) : m.protectedKeys[e] = !0;
			}
			m.prevProp = h, m.prevResolvedValues = C, m.isActive && (d = {
				...d,
				...C
			}), (r || i) && e.blockInitialAnimation && (b = !1);
			let D = v && y;
			b && (!D || x) && l.push(...S.map((t) => {
				let n = { type: p };
				if (typeof t == "string" && (r || i) && !D && e.manuallyAnimateOnMount && e.parent) {
					let { parent: r } = e, i = vl(r, t);
					if (r.enteringChildren && i) {
						let { delayChildren: t } = i.transition || {};
						n.delay = Zc(r.enteringChildren, e, t);
					}
				}
				return {
					animation: t,
					options: n
				};
			}));
		}
		if (u.size) {
			let t = {};
			if (typeof s.initial != "boolean") {
				let n = vl(e, Array.isArray(s.initial) ? s.initial[0] : s.initial);
				n && n.transition && (t.transition = n.transition);
			}
			u.forEach((n) => {
				let r = e.getBaseTarget(n), i = e.getValue(n);
				i && (i.liveStyle = !0), t[n] = r ?? null;
			}), l.push({ animation: t });
		}
		let p = !!l.length;
		return r && (s.initial === !1 || s.initial === s.animate) && !e.manuallyAnimateOnMount && (p = !1), r = !1, i = !1, p ? t(l) : Promise.resolve();
	}
	function c(t, r) {
		if (n[t].isActive === r) return Promise.resolve();
		e.variantChildren?.forEach((e) => e.animationState?.setActive(t, r)), n[t].isActive = r;
		let i = s(t);
		for (let e in n) n[e].protectedKeys = {};
		return i;
	}
	return {
		animateChanges: s,
		setActive: c,
		setAnimateFunction: o,
		getState: () => n,
		reset: () => {
			n = qd(), i = !0;
		}
	};
}
function Gd(e, t) {
	return typeof t == "string" ? t !== e : Array.isArray(t) ? !Bd(t, e) : !1;
}
function Kd(e = !1) {
	return {
		isActive: e,
		protectedKeys: {},
		needsAnimating: {},
		prevResolvedValues: {}
	};
}
function qd() {
	return {
		animate: Kd(!0),
		whileInView: Kd(),
		whileHover: Kd(),
		whileTap: Kd(),
		whileDrag: Kd(),
		whileFocus: Kd(),
		exit: Kd()
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/copy.mjs
function Jd(e, t) {
	e.min = t.min, e.max = t.max;
}
function Yd(e, t) {
	Jd(e.x, t.x), Jd(e.y, t.y);
}
function Xd(e, t) {
	e.translate = t.translate, e.scale = t.scale, e.originPoint = t.originPoint, e.origin = t.origin;
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/delta-calc.mjs
var Zd = .9999, Qd = 1.0001, $d = -.01, ef = .01;
function tf(e) {
	return e.max - e.min;
}
function nf(e, t, n) {
	return Math.abs(e - t) <= n;
}
function rf(e, t, n, r = .5) {
	e.origin = r, e.originPoint = B(t.min, t.max, e.origin), e.scale = tf(n) / tf(t), e.translate = B(n.min, n.max, e.origin) - e.originPoint, (e.scale >= Zd && e.scale <= Qd || isNaN(e.scale)) && (e.scale = 1), (e.translate >= $d && e.translate <= ef || isNaN(e.translate)) && (e.translate = 0);
}
function af(e, t, n, r) {
	rf(e.x, t.x, n.x, r ? r.originX : void 0), rf(e.y, t.y, n.y, r ? r.originY : void 0);
}
function of(e, t, n, r = 0) {
	e.min = (r ? B(n.min, n.max, r) : n.min) + t.min, e.max = e.min + tf(t);
}
function sf(e, t, n, r) {
	of(e.x, t.x, n.x, r?.x), of(e.y, t.y, n.y, r?.y);
}
function cf(e, t, n, r = 0) {
	let i = r ? B(n.min, n.max, r) : n.min;
	e.min = t.min - i, e.max = e.min + tf(t);
}
function lf(e, t, n, r) {
	cf(e.x, t.x, n.x, r?.x), cf(e.y, t.y, n.y, r?.y);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/delta-remove.mjs
function uf(e, t, n, r, i) {
	return e -= t, e = uu(e, 1 / n, r), i !== void 0 && (e = uu(e, 1 / i, r)), e;
}
function df(e, t = 0, n = 1, r = .5, i, a = e, o = e) {
	if (co.test(t) && (t = parseFloat(t), t = B(o.min, o.max, t / 100) - o.min), typeof t != "number") return;
	let s = B(a.min, a.max, r);
	e === a && (s -= t), e.min = uf(e.min, t, n, s, i), e.max = uf(e.max, t, n, s, i);
}
function ff(e, t, [n, r, i], a, o) {
	df(e, t[n], t[r], t[i], t.scale, a, o);
}
var pf = [
	"x",
	"scaleX",
	"originX"
], mf = [
	"y",
	"scaleY",
	"originY"
];
function X(e, t, n, r) {
	ff(e.x, t, pf, n ? n.x : void 0, r ? r.x : void 0), ff(e.y, t, mf, n ? n.y : void 0, r ? r.y : void 0);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/utils.mjs
function hf(e) {
	return e.translate === 0 && e.scale === 1;
}
function gf(e) {
	return hf(e.x) && hf(e.y);
}
function _f(e, t) {
	return e.min === t.min && e.max === t.max;
}
function vf(e, t) {
	return _f(e.x, t.x) && _f(e.y, t.y);
}
function yf(e, t) {
	return Math.round(e.min) === Math.round(t.min) && Math.round(e.max) === Math.round(t.max);
}
function bf(e, t) {
	return yf(e.x, t.x) && yf(e.y, t.y);
}
function xf(e) {
	return tf(e.x) / tf(e.y);
}
function Sf(e, t) {
	return e.translate === t.translate && e.scale === t.scale && e.originPoint === t.originPoint;
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/utils/each-axis.mjs
function Cf(e) {
	return [e("x"), e("y")];
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/styles/transform.mjs
function wf(e, t, n) {
	let r = "", i = e.x.translate / t.x, a = e.y.translate / t.y, o = n?.z || 0;
	if ((i || a || o) && (r = `translate3d(${i}px, ${a}px, ${o}px) `), (t.x !== 1 || t.y !== 1) && (r += `scale(${1 / t.x}, ${1 / t.y}) `), n) {
		let { transformPerspective: e, rotate: t, pathRotation: i, rotateX: a, rotateY: o, skewX: s, skewY: c } = n;
		e && (r = `perspective(${e}px) ${r}`), t && (r += `rotate(${t}deg) `), i && (r += `rotate(${i}deg) `), a && (r += `rotateX(${a}deg) `), o && (r += `rotateY(${o}deg) `), s && (r += `skewX(${s}deg) `), c && (r += `skewY(${c}deg) `);
	}
	let s = e.x.scale * t.x, c = e.y.scale * t.y;
	return (s !== 1 || c !== 1) && (r += `scale(${s}, ${c})`), r || "none";
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/animation/mix-values.mjs
var Tf = Ul.length, Ef = (e) => typeof e == "string" ? parseFloat(e) : e, Df = (e) => typeof e == "number" || R.test(e);
function Of(e, t, n, r, i, a) {
	i ? (e.opacity = B(0, n.opacity ?? 1, Af(r)), e.opacityExit = B(t.opacity ?? 1, 0, jf(r))) : a && (e.opacity = B(t.opacity ?? 1, n.opacity ?? 1, r));
	for (let i = 0; i < Tf; i++) {
		let a = Ul[i], o = kf(t, a), s = kf(n, a);
		(o !== void 0 || s !== void 0) && (o ||= 0, s ||= 0, o === 0 || s === 0 || Df(o) === Df(s) ? (e[a] = Math.max(B(Ef(o), Ef(s), r), 0), (co.test(s) || co.test(o)) && (e[a] += "%")) : e[a] = s);
	}
	(t.rotate || n.rotate) && (e.rotate = B(t.rotate || 0, n.rotate || 0, r));
}
function kf(e, t) {
	return e[t] === void 0 ? e.borderRadius : e[t];
}
var Af = /*@__PURE__*/ Mf(0, .5, xa), jf = /*@__PURE__*/ Mf(.5, .95, aa);
function Mf(e, t, n) {
	return (r) => r < e ? 0 : r > t ? 1 : n(/* @__PURE__ */ sa(e, t, r));
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/animate/single-value.mjs
function Nf(e, t, n) {
	let r = Cl(e) ? e : nl(e);
	return r.start(fl("", r, t, n)), r.animation;
}
//#endregion
//#region node_modules/motion-dom/dist/es/events/add-dom-event.mjs
function Pf(e, t, n, r = { passive: !0 }) {
	return e.addEventListener(t, n, r), () => e.removeEventListener(t, n, r);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/utils/compare-by-depth.mjs
var Ff = (e, t) => e.depth - t.depth, If = class {
	constructor() {
		this.children = [], this.isDirty = !1;
	}
	add(e) {
		Zi(this.children, e), this.isDirty = !0;
	}
	remove(e) {
		Qi(this.children, e), this.isDirty = !0;
	}
	forEach(e) {
		this.isDirty && this.children.sort(Ff), this.isDirty = !1, this.children.forEach(e);
	}
};
//#endregion
//#region node_modules/motion-dom/dist/es/utils/delay.mjs
function Lf(e, t) {
	let n = za.now(), r = ({ timestamp: i }) => {
		let a = i - n;
		a >= t && (L(r), e(a - t));
	};
	return I.setup(r, !0), () => L(r);
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/utils/resolve-motion-value.mjs
function Rf(e) {
	return Cl(e) ? e.get() : e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/shared/stack.mjs
var zf = class {
	constructor() {
		this.members = [];
	}
	add(e) {
		Zi(this.members, e);
		for (let t = this.members.length - 1; t >= 0; t--) {
			let n = this.members[t];
			if (n === e || n === this.lead || n === this.prevLead) continue;
			let r = n.instance;
			(!r || r.isConnected === !1) && !n.snapshot && (Qi(this.members, n), n.unmount());
		}
		e.scheduleRender();
	}
	remove(e) {
		if (Qi(this.members, e), e === this.prevLead && (this.prevLead = void 0), e === this.lead) {
			let e = this.members[this.members.length - 1];
			e && this.promote(e);
		}
	}
	relegate(e) {
		for (let t = this.members.indexOf(e) - 1; t >= 0; t--) {
			let e = this.members[t];
			if (e.isPresent !== !1 && e.instance?.isConnected !== !1) return this.promote(e), !0;
		}
		return !1;
	}
	promote(e, t) {
		let n = this.lead;
		if (e !== n && (this.prevLead = n, this.lead = e, e.show(), n)) {
			n.updateSnapshot(), e.scheduleRender();
			let { layoutDependency: r } = n.options, { layoutDependency: i } = e.options;
			(r === void 0 || r !== i) && (e.resumeFrom = n, t && (n.preserveOpacity = !0), n.snapshot && (e.snapshot = n.snapshot, e.snapshot.latestValues = n.animationValues || n.latestValues), e.root?.isUpdating && (e.isLayoutDirty = !0)), e.options.crossfade === !1 && n.hide();
		}
	}
	exitAnimationComplete() {
		this.members.forEach((e) => {
			e.options.onExitComplete?.(), e.resumingFrom?.options.onExitComplete?.();
		});
	}
	scheduleRender() {
		this.members.forEach((e) => e.instance && e.scheduleRender(!1));
	}
	removeLeadSnapshot() {
		this.lead?.snapshot && (this.lead.snapshot = void 0);
	}
}, Bf = {
	hasAnimatedSinceResize: !0,
	hasEverUpdated: !1
}, Vf = {
	nodes: 0,
	calculatedTargetDeltas: 0,
	calculatedProjections: 0
}, Hf = [
	"",
	"X",
	"Y",
	"Z"
], Z = 1e3, Uf = 0;
function Wf(e, t, n, r) {
	let { latestValues: i } = t;
	i[e] && (n[e] = i[e], t.setStaticValue(e, 0), r && (r[e] = 0));
}
function Gf(e) {
	if (e.hasCheckedOptimisedAppear = !0, e.root === e) return;
	let { visualElement: t } = e.options;
	if (!t) return;
	let n = Ol(t);
	if (window.MotionHasOptimisedAnimation(n, "transform")) {
		let { layout: t, layoutId: r } = e.options;
		window.MotionCancelOptimisedAnimation(n, "transform", I, !(t || r));
	}
	let { parent: r } = e;
	r && !r.hasCheckedOptimisedAppear && Gf(r);
}
function Kf({ attachResizeListener: e, defaultParent: t, measureScroll: n, checkIsScrollRoot: r, resetTransform: i }) {
	return class {
		constructor(e = {}, n = t?.()) {
			this.id = Uf++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = !1, this.isAnimationBlocked = !1, this.isLayoutDirty = !1, this.isProjectionDirty = !1, this.isSharedProjectionDirty = !1, this.isTransformDirty = !1, this.updateManuallyBlocked = !1, this.updateBlockedByResize = !1, this.isUpdating = !1, this.isSVG = !1, this.needsReset = !1, this.shouldResetTransform = !1, this.hasCheckedOptimisedAppear = !1, this.treeScale = {
				x: 1,
				y: 1
			}, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = !1, this.layoutVersion = 0, this.updateScheduled = !1, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = !1, this.checkUpdateFailed = () => {
				this.isUpdating && (this.isUpdating = !1, this.clearAllSnapshots());
			}, this.updateProjection = () => {
				this.projectionUpdateScheduled = !1, J.value && (Vf.nodes = Vf.calculatedTargetDeltas = Vf.calculatedProjections = 0), this.nodes.forEach(Yf), this.nodes.forEach(rp), this.nodes.forEach(ip), this.nodes.forEach(Xf), J.addProjectionMetrics && J.addProjectionMetrics(Vf);
			}, this.resolvedRelativeTargetAt = 0, this.linkedParentVersion = 0, this.hasProjected = !1, this.isVisible = !0, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = e, this.root = n ? n.root || n : this, this.path = n ? [...n.path, n] : [], this.parent = n, this.depth = n ? n.depth + 1 : 0;
			for (let e = 0; e < this.path.length; e++) this.path[e].shouldResetTransform = !0;
			this.root === this && (this.nodes = new If());
		}
		addEventListener(e, t) {
			return this.eventHandlers.has(e) || this.eventHandlers.set(e, new ca()), this.eventHandlers.get(e).add(t);
		}
		notifyListeners(e, ...t) {
			let n = this.eventHandlers.get(e);
			n && n.notify(...t);
		}
		hasListeners(e) {
			return this.eventHandlers.has(e);
		}
		mount(t) {
			if (this.instance) return;
			this.isSVG = Gl(t) && !Y(t), this.instance = t;
			let { layoutId: n, layout: r, visualElement: i } = this.options;
			if (i && !i.current && i.mount(t), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (r || n) && (this.isLayoutDirty = !0), e) {
				let n, r = 0, i = () => this.root.updateBlockedByResize = !1;
				I.read(() => {
					r = window.innerWidth;
				}), e(t, () => {
					let e = window.innerWidth;
					e !== r && (r = e, this.root.updateBlockedByResize = !0, n && n(), n = Lf(i, 250), Bf.hasAnimatedSinceResize && (Bf.hasAnimatedSinceResize = !1, this.nodes.forEach(np)));
				});
			}
			n && this.root.registerSharedNode(n, this), this.options.animate !== !1 && i && (n || r) && this.addEventListener("didUpdate", ({ delta: e, hasLayoutChanged: t, hasRelativeLayoutChanged: n, layout: r }) => {
				if (this.isTreeAnimationBlocked()) {
					this.target = void 0, this.relativeTarget = void 0;
					return;
				}
				let a = this.options.transition || i.getDefaultTransition() || dp, { onLayoutAnimationStart: o, onLayoutAnimationComplete: s } = i.getProps(), c = !this.targetLayout || !bf(this.targetLayout, r), l = !t && n;
				if (this.options.layoutRoot || this.resumeFrom || l || t && (c || !this.currentAnimation)) {
					this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
					let t = {
						...il(a, "layout"),
						onPlay: o,
						onComplete: s
					};
					(i.shouldReduceMotion || this.options.layoutRoot) && (t.delay = 0, t.type = !1), this.startAnimation(t), this.setAnimationOrigin(e, l, t.path);
				} else t || np(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
				this.targetLayout = r;
			});
		}
		unmount() {
			this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
			let e = this.getStack();
			e && e.remove(this), this.parent && this.parent.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), L(this.updateProjection);
		}
		blockUpdate() {
			this.updateManuallyBlocked = !0;
		}
		unblockUpdate() {
			this.updateManuallyBlocked = !1;
		}
		isUpdateBlocked() {
			return this.updateManuallyBlocked || this.updateBlockedByResize;
		}
		isTreeAnimationBlocked() {
			return this.isAnimationBlocked || this.parent && this.parent.isTreeAnimationBlocked() || !1;
		}
		startUpdate() {
			this.isUpdateBlocked() || (this.isUpdating = !0, this.nodes && this.nodes.forEach(ap), this.animationId++);
		}
		getTransformTemplate() {
			let { visualElement: e } = this.options;
			return e && e.getProps().transformTemplate;
		}
		willUpdate(e = !0) {
			if (this.root.hasTreeAnimated = !0, this.root.isUpdateBlocked()) {
				this.options.onExitComplete && this.options.onExitComplete();
				return;
			}
			if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && Gf(this), !this.root.isUpdating && this.root.startUpdate(), this.isLayoutDirty) return;
			this.isLayoutDirty = !0;
			for (let e = 0; e < this.path.length; e++) {
				let t = this.path[e];
				t.shouldResetTransform = !0, (typeof t.latestValues.x == "string" || typeof t.latestValues.y == "string") && (t.isLayoutDirty = !0), t.updateScroll("snapshot"), t.options.layoutRoot && t.willUpdate(!1);
			}
			let { layoutId: t, layout: n } = this.options;
			if (t === void 0 && !n) return;
			let r = this.getTransformTemplate();
			this.prevTransformTemplateValue = r ? r(this.latestValues, "") : void 0, this.updateSnapshot(), e && this.notifyListeners("willUpdate");
		}
		update() {
			if (this.updateScheduled = !1, this.isUpdateBlocked()) {
				let e = this.updateBlockedByResize;
				this.unblockUpdate(), this.updateBlockedByResize = !1, this.clearAllSnapshots(), e && this.nodes.forEach($f), this.nodes.forEach(Qf);
				return;
			}
			if (this.animationId <= this.animationCommitId) {
				this.nodes.forEach(ep);
				return;
			}
			this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = !1, this.nodes.forEach(tp), this.nodes.forEach(Q), this.nodes.forEach(qf), this.nodes.forEach(Jf)) : this.nodes.forEach(ep), this.clearAllSnapshots();
			let e = za.now();
			Fa.delta = $i(0, 1e3 / 60, e - Fa.timestamp), Fa.timestamp = e, Fa.isProcessing = !0, Ia.update.process(Fa), Ia.preRender.process(Fa), Ia.render.process(Fa), Fa.isProcessing = !1;
		}
		didUpdate() {
			this.updateScheduled || (this.updateScheduled = !0, Cu.read(this.scheduleUpdate));
		}
		clearAllSnapshots() {
			this.nodes.forEach(Zf), this.sharedNodes.forEach(op);
		}
		scheduleUpdateProjection() {
			this.projectionUpdateScheduled || (this.projectionUpdateScheduled = !0, I.preRender(this.updateProjection, !1, !0));
		}
		scheduleCheckAfterUnmount() {
			I.postRender(() => {
				this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
			});
		}
		updateSnapshot() {
			!this.snapshot && this.instance && (this.snapshot = this.measure(), this.snapshot && !tf(this.snapshot.measuredBox.x) && !tf(this.snapshot.measuredBox.y) && (this.snapshot = void 0));
		}
		updateLayout() {
			if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)) return;
			if (this.resumeFrom && !this.resumeFrom.instance) for (let e = 0; e < this.path.length; e++) this.path[e].updateScroll();
			let e = this.layout;
			this.layout = this.measure(!1), this.layoutVersion++, this.layoutCorrected ||= id(), this.isLayoutDirty = !1, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
			let { visualElement: t } = this.options;
			t && t.notify("LayoutMeasure", this.layout.layoutBox, e ? e.layoutBox : void 0);
		}
		updateScroll(e = "measure") {
			let t = !!(this.options.layoutScroll && this.instance);
			if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === e && (t = !1), t && this.instance) {
				let t = r(this.instance);
				this.scroll = {
					animationId: this.root.animationId,
					phase: e,
					isRoot: t,
					offset: n(this.instance),
					wasRoot: this.scroll ? this.scroll.isRoot : t
				};
			}
		}
		resetTransform() {
			if (!i) return;
			let e = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout, t = this.projectionDelta && !gf(this.projectionDelta), n = this.getTransformTemplate(), r = n ? n(this.latestValues, "") : void 0, a = r !== this.prevTransformTemplateValue;
			e && this.instance && (t || su(this.latestValues) || a) && (i(this.instance, r), this.shouldResetTransform = !1, this.scheduleRender());
		}
		measure(e = !0) {
			let t = this.measurePageBox(), n = this.removeElementScroll(t);
			return e && (n = this.removeTransform(n)), hp(n), {
				animationId: this.root.animationId,
				measuredBox: t,
				layoutBox: n,
				latestValues: {},
				source: this.id
			};
		}
		measurePageBox() {
			let { visualElement: e } = this.options;
			if (!e) return id();
			let t = e.measureViewportBox();
			if (!(this.scroll?.wasRoot || this.path.some(_p))) {
				let { scroll: e } = this.root;
				e && (_u(t.x, e.offset.x), _u(t.y, e.offset.y));
			}
			return t;
		}
		removeElementScroll(e) {
			let t = id();
			if (Yd(t, e), this.scroll?.wasRoot) return t;
			for (let n = 0; n < this.path.length; n++) {
				let r = this.path[n], { scroll: i, options: a } = r;
				r !== this.root && i && a.layoutScroll && (i.wasRoot && Yd(t, e), _u(t.x, i.offset.x), _u(t.y, i.offset.y));
			}
			return t;
		}
		applyTransform(e, t = !1, n) {
			let r = n || id();
			Yd(r, e);
			for (let e = 0; e < this.path.length; e++) {
				let n = this.path[e];
				!t && n.options.layoutScroll && n.scroll && n !== n.root && (_u(r.x, -n.scroll.offset.x), _u(r.y, -n.scroll.offset.y)), su(n.latestValues) && bu(r, n.latestValues, n.layout?.layoutBox);
			}
			return su(this.latestValues) && bu(r, this.latestValues, this.layout?.layoutBox), r;
		}
		removeTransform(e) {
			let t = id();
			Yd(t, e);
			for (let e = 0; e < this.path.length; e++) {
				let n = this.path[e];
				if (!su(n.latestValues)) continue;
				let r;
				n.instance && (ou(n.latestValues) && n.updateSnapshot(), r = id(), Yd(r, n.measurePageBox())), X(t, n.latestValues, n.snapshot?.layoutBox, r);
			}
			return su(this.latestValues) && X(t, this.latestValues), t;
		}
		setTargetDelta(e) {
			this.targetDelta = e, this.root.scheduleUpdateProjection(), this.isProjectionDirty = !0;
		}
		setOptions(e) {
			this.options = {
				...this.options,
				...e,
				crossfade: e.crossfade === void 0 || e.crossfade
			};
		}
		clearMeasurements() {
			this.scroll = void 0, this.layout = void 0, this.snapshot = void 0, this.prevTransformTemplateValue = void 0, this.targetDelta = void 0, this.target = void 0, this.isLayoutDirty = !1;
		}
		forceRelativeParentToResolveTarget() {
			this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== Fa.timestamp && this.relativeParent.resolveTargetDelta(!0);
		}
		resolveTargetDelta(e = !1) {
			let t = this.getLead();
			this.isProjectionDirty ||= t.isProjectionDirty, this.isTransformDirty ||= t.isTransformDirty, this.isSharedProjectionDirty ||= t.isSharedProjectionDirty;
			let n = !!this.resumingFrom || this !== t;
			if (!(e || n && this.isSharedProjectionDirty || this.isProjectionDirty || this.parent?.isProjectionDirty || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize)) return;
			let { layout: r, layoutId: i } = this.options;
			if (!this.layout || !(r || i)) return;
			this.resolvedRelativeTargetAt = Fa.timestamp;
			let a = this.getClosestProjectingParent();
			a && this.linkedParentVersion !== a.layoutVersion && !a.options.layoutRoot && this.removeRelativeTarget(), !this.targetDelta && !this.relativeTarget && (this.options.layoutAnchor !== !1 && a && a.layout ? this.createRelativeTarget(a, this.layout.layoutBox, a.layout.layoutBox) : this.removeRelativeTarget()), (this.relativeTarget || this.targetDelta) && (this.target || (this.target = id(), this.targetWithTransforms = id()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target ? (this.forceRelativeParentToResolveTarget(), sf(this.target, this.relativeTarget, this.relativeParent.target, this.options.layoutAnchor || void 0)) : this.targetDelta ? (this.resumingFrom ? this.applyTransform(this.layout.layoutBox, !1, this.target) : Yd(this.target, this.layout.layoutBox), pu(this.target, this.targetDelta)) : Yd(this.target, this.layout.layoutBox), this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = !1, this.options.layoutAnchor !== !1 && a && !!a.resumingFrom == !!this.resumingFrom && !a.options.layoutScroll && a.target && this.animationProgress !== 1 ? this.createRelativeTarget(a, this.target, a.target) : this.relativeParent = this.relativeTarget = void 0), J.value && Vf.calculatedTargetDeltas++);
		}
		getClosestProjectingParent() {
			if (!(!this.parent || ou(this.parent.latestValues) || cu(this.parent.latestValues))) return this.parent.isProjecting() ? this.parent : this.parent.getClosestProjectingParent();
		}
		isProjecting() {
			return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
		}
		createRelativeTarget(e, t, n) {
			this.relativeParent = e, this.linkedParentVersion = e.layoutVersion, this.forceRelativeParentToResolveTarget(), this.relativeTarget = id(), this.relativeTargetOrigin = id(), lf(this.relativeTargetOrigin, t, n, this.options.layoutAnchor || void 0), Yd(this.relativeTarget, this.relativeTargetOrigin);
		}
		removeRelativeTarget() {
			this.relativeParent = this.relativeTarget = void 0;
		}
		calcProjection() {
			let e = this.getLead(), t = !!this.resumingFrom || this !== e, n = !0;
			if ((this.isProjectionDirty || this.parent?.isProjectionDirty) && (n = !1), t && (this.isSharedProjectionDirty || this.isTransformDirty) && (n = !1), this.resolvedRelativeTargetAt === Fa.timestamp && (n = !1), n) return;
			let { layout: r, layoutId: i } = this.options;
			if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(r || i)) return;
			Yd(this.layoutCorrected, this.layout.layoutBox);
			let a = this.treeScale.x, o = this.treeScale.y;
			gu(this.layoutCorrected, this.treeScale, this.path, t), e.layout && !e.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1) && (e.target = e.layout.layoutBox, e.targetWithTransforms = id());
			let { target: s } = e;
			if (!s) {
				this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
				return;
			}
			!this.projectionDelta || !this.prevProjectionDelta ? this.createProjectionDeltas() : (Xd(this.prevProjectionDelta.x, this.projectionDelta.x), Xd(this.prevProjectionDelta.y, this.projectionDelta.y)), af(this.projectionDelta, this.layoutCorrected, s, this.latestValues), (this.treeScale.x !== a || this.treeScale.y !== o || !Sf(this.projectionDelta.x, this.prevProjectionDelta.x) || !Sf(this.projectionDelta.y, this.prevProjectionDelta.y)) && (this.hasProjected = !0, this.scheduleRender(), this.notifyListeners("projectionUpdate", s)), J.value && Vf.calculatedProjections++;
		}
		hide() {
			this.isVisible = !1;
		}
		show() {
			this.isVisible = !0;
		}
		scheduleRender(e = !0) {
			if (this.options.visualElement?.scheduleRender(), e) {
				let e = this.getStack();
				e && e.scheduleRender();
			}
			this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
		}
		createProjectionDeltas() {
			this.prevProjectionDelta = nd(), this.projectionDelta = nd(), this.projectionDeltaWithTransform = nd();
		}
		setAnimationOrigin(e, t = !1, n) {
			let r = this.snapshot, i = r ? r.latestValues : {}, a = { ...this.latestValues }, o = nd();
			(!this.relativeParent || !this.relativeParent.options.layoutRoot) && (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !t;
			let s = id(), c = (r ? r.source : void 0) !== (this.layout ? this.layout.source : void 0), l = this.getStack(), u = !l || l.members.length <= 1, d = !(!c || u || this.options.crossfade !== !0 || this.path.some(up));
			this.animationProgress = 0;
			let f, p = n?.interpolateProjection(e);
			this.mixTargetDelta = (t) => {
				let n = t / 1e3, r = p?.(n);
				r ? (o.x.translate = r.x, o.x.scale = B(e.x.scale, 1, n), o.x.origin = e.x.origin, o.x.originPoint = e.x.originPoint, o.y.translate = r.y, o.y.scale = B(e.y.scale, 1, n), o.y.origin = e.y.origin, o.y.originPoint = e.y.originPoint) : (sp(o.x, e.x, n), sp(o.y, e.y, n)), this.setTargetDelta(o), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout && (lf(s, this.layout.layoutBox, this.relativeParent.layout.layoutBox, this.options.layoutAnchor || void 0), lp(this.relativeTarget, this.relativeTargetOrigin, s, n), f && vf(this.relativeTarget, f) && (this.isProjectionDirty = !1), f ||= id(), Yd(f, this.relativeTarget)), c && (this.animationValues = a, Of(a, i, this.latestValues, n, d, u)), r && r.rotate !== void 0 && (this.animationValues ||= a, this.animationValues.pathRotation = r.rotate), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = n;
			}, this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
		}
		startAnimation(e) {
			this.notifyListeners("animationStart"), this.currentAnimation?.stop(), this.resumingFrom?.currentAnimation?.stop(), this.pendingAnimation &&= (L(this.pendingAnimation), void 0), this.pendingAnimation = I.update(() => {
				Bf.hasAnimatedSinceResize = !0, this.motionValue ||= nl(0), this.motionValue.jump(0, !1), this.currentAnimation = Nf(this.motionValue, [0, 1e3], {
					...e,
					velocity: 0,
					isSync: !0,
					onUpdate: (t) => {
						this.mixTargetDelta(t), e.onUpdate && e.onUpdate(t);
					},
					onComplete: () => {
						e.onComplete && e.onComplete(), this.completeAnimation();
					}
				}), ks(this.currentAnimation, this), this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation), this.pendingAnimation = void 0;
			});
		}
		completeAnimation() {
			this.resumingFrom && (this.resumingFrom.currentAnimation = void 0, this.resumingFrom.preserveOpacity = void 0);
			let e = this.getStack();
			e && e.exitAnimationComplete(), this.resumingFrom = this.currentAnimation = this.animationValues = void 0, this.notifyListeners("animationComplete");
		}
		finishAnimation() {
			this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(Z), this.currentAnimation.stop()), this.completeAnimation();
		}
		applyTransformsToTarget() {
			let e = this.getLead(), { targetWithTransforms: t, layout: n, latestValues: r } = e, { target: i } = e;
			if (t && i && n) {
				if (this !== e && this.layout && n && gp(this.options.animationType, this.layout.layoutBox, n.layoutBox)) {
					i = this.target || id();
					let t = tf(this.layout.layoutBox.x);
					i.x.min = e.target.x.min, i.x.max = i.x.min + t;
					let n = tf(this.layout.layoutBox.y);
					i.y.min = e.target.y.min, i.y.max = i.y.min + n;
				}
				Yd(t, i), bu(t, r), af(this.projectionDeltaWithTransform, this.layoutCorrected, t, r);
			}
		}
		registerSharedNode(e, t) {
			this.sharedNodes.has(e) || this.sharedNodes.set(e, new zf()), this.sharedNodes.get(e).add(t);
			let n = t.options.initialPromotionConfig;
			t.promote({
				transition: n ? n.transition : void 0,
				preserveFollowOpacity: n && n.shouldPreserveFollowOpacity ? n.shouldPreserveFollowOpacity(t) : void 0
			});
		}
		isLead() {
			let e = this.getStack();
			return !e || e.lead === this;
		}
		getLead() {
			let { layoutId: e } = this.options;
			return e && this.getStack()?.lead || this;
		}
		getPrevLead() {
			let { layoutId: e } = this.options;
			return e ? this.getStack()?.prevLead : void 0;
		}
		getStack() {
			let { layoutId: e } = this.options;
			if (e) return this.root.sharedNodes.get(e);
		}
		promote({ needsReset: e, transition: t, preserveFollowOpacity: n } = {}) {
			let r = this.getStack();
			r && r.promote(this, n), e && (this.projectionDelta = void 0, this.needsReset = !0), t && this.setOptions({ transition: t });
		}
		relegate() {
			let e = this.getStack();
			return e ? e.relegate(this) : !1;
		}
		resetSkewAndRotation() {
			let { visualElement: e } = this.options;
			if (!e) return;
			let t = !1, { latestValues: n } = e;
			if ((n.z || n.rotate || n.rotateX || n.rotateY || n.rotateZ || n.skewX || n.skewY) && (t = !0), !t) return;
			let r = {};
			n.z && Wf("z", e, r, this.animationValues);
			for (let t = 0; t < Hf.length; t++) Wf(`rotate${Hf[t]}`, e, r, this.animationValues), Wf(`skew${Hf[t]}`, e, r, this.animationValues);
			e.render();
			for (let t in r) e.setStaticValue(t, r[t]), this.animationValues && (this.animationValues[t] = r[t]);
			e.scheduleRender();
		}
		applyProjectionStyles(e, t) {
			if (!this.instance || this.isSVG) return;
			if (!this.isVisible) {
				e.visibility = "hidden";
				return;
			}
			let n = this.getTransformTemplate();
			if (this.needsReset) {
				this.needsReset = !1, e.visibility = "", e.opacity = "", e.pointerEvents = Rf(t?.pointerEvents) || "", e.transform = n ? n(this.latestValues, "") : "none";
				return;
			}
			let r = this.getLead();
			if (!this.projectionDelta || !this.layout || !r.target) {
				this.options.layoutId && (e.opacity = this.latestValues.opacity === void 0 ? 1 : this.latestValues.opacity, e.pointerEvents = Rf(t?.pointerEvents) || ""), this.hasProjected && !su(this.latestValues) && (e.transform = n ? n({}, "") : "none", this.hasProjected = !1);
				return;
			}
			e.visibility = "";
			let i = r.animationValues || r.latestValues;
			this.applyTransformsToTarget();
			let a = wf(this.projectionDeltaWithTransform, this.treeScale, i);
			n && (a = n(i, a)), e.transform = a;
			let { x: o, y: s } = this.projectionDelta;
			e.transformOrigin = `${o.origin * 100}% ${s.origin * 100}% 0`, e.opacity = r.animationValues ? r === this ? i.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : i.opacityExit : r === this ? i.opacity === void 0 ? "" : i.opacity : i.opacityExit === void 0 ? 0 : i.opacityExit;
			for (let t in Od) {
				if (i[t] === void 0) continue;
				let { correct: n, applyTo: o, isCSSVariable: s } = Od[t], c = a === "none" ? i[t] : n(i[t], r);
				if (o) {
					let t = o.length;
					for (let n = 0; n < t; n++) e[o[n]] = c;
				} else s ? this.options.visualElement.renderState.vars[t] = c : e[t] = c;
			}
			this.options.layoutId && (e.pointerEvents = r === this ? Rf(t?.pointerEvents) || "" : "none");
		}
		clearSnapshot() {
			this.resumeFrom = this.snapshot = void 0;
		}
		resetTree() {
			this.root.nodes.forEach((e) => e.currentAnimation?.stop()), this.root.nodes.forEach(Qf), this.root.sharedNodes.clear();
		}
	};
}
function qf(e) {
	e.updateLayout();
}
function Jf(e) {
	let t = e.resumeFrom?.snapshot || e.snapshot;
	if (e.isLead() && e.layout && t && e.hasListeners("didUpdate")) {
		let { layoutBox: n, measuredBox: r } = e.layout, { animationType: i } = e.options, a = t.source !== e.layout.source;
		if (i === "size") Cf((e) => {
			let r = a ? t.measuredBox[e] : t.layoutBox[e], i = tf(r);
			r.min = n[e].min, r.max = r.min + i;
		});
		else if (i === "x" || i === "y") {
			let e = i === "x" ? "y" : "x";
			Jd(a ? t.measuredBox[e] : t.layoutBox[e], n[e]);
		} else gp(i, t.layoutBox, n) && Cf((r) => {
			let i = a ? t.measuredBox[r] : t.layoutBox[r], o = tf(n[r]);
			i.max = i.min + o, e.relativeTarget && !e.currentAnimation && (e.isProjectionDirty = !0, e.relativeTarget[r].max = e.relativeTarget[r].min + o);
		});
		let o = nd();
		af(o, n, t.layoutBox);
		let s = nd();
		a ? af(s, e.applyTransform(r, !0), t.measuredBox) : af(s, n, t.layoutBox);
		let c = !gf(o), l = !1;
		if (!e.resumeFrom) {
			let r = e.getClosestProjectingParent();
			if (r && !r.resumeFrom) {
				let { snapshot: i, layout: a } = r;
				if (i && a) {
					let o = e.options.layoutAnchor || void 0, s = id();
					lf(s, t.layoutBox, i.layoutBox, o);
					let c = id();
					lf(c, n, a.layoutBox, o), bf(s, c) || (l = !0), r.options.layoutRoot && (e.relativeTarget = c, e.relativeTargetOrigin = s, e.relativeParent = r);
				}
			}
		}
		e.notifyListeners("didUpdate", {
			layout: n,
			snapshot: t,
			delta: s,
			layoutDelta: o,
			hasLayoutChanged: c,
			hasRelativeLayoutChanged: l
		});
	} else if (e.isLead()) {
		let { onExitComplete: t } = e.options;
		t && t();
	}
	e.options.transition = void 0;
}
function Yf(e) {
	J.value && Vf.nodes++, e.parent && (e.isProjecting() || (e.isProjectionDirty = e.parent.isProjectionDirty), e.isSharedProjectionDirty ||= !!(e.isProjectionDirty || e.parent.isProjectionDirty || e.parent.isSharedProjectionDirty), e.isTransformDirty ||= e.parent.isTransformDirty);
}
function Xf(e) {
	e.isProjectionDirty = e.isSharedProjectionDirty = e.isTransformDirty = !1;
}
function Zf(e) {
	e.clearSnapshot();
}
function Qf(e) {
	e.clearMeasurements();
}
function $f(e) {
	e.isLayoutDirty = !0, e.updateLayout();
}
function ep(e) {
	e.isLayoutDirty = !1;
}
function tp(e) {
	e.isAnimationBlocked && e.layout && !e.isLayoutDirty && (e.snapshot = e.layout, e.isLayoutDirty = !0);
}
function Q(e) {
	let { visualElement: t } = e.options;
	t && t.getProps().onBeforeLayoutMeasure && t.notify("BeforeLayoutMeasure"), e.resetTransform();
}
function np(e) {
	e.finishAnimation(), e.targetDelta = e.relativeTarget = e.target = void 0, e.isProjectionDirty = !0;
}
function rp(e) {
	e.resolveTargetDelta();
}
function ip(e) {
	e.calcProjection();
}
function ap(e) {
	e.resetSkewAndRotation();
}
function op(e) {
	e.removeLeadSnapshot();
}
function sp(e, t, n) {
	e.translate = B(t.translate, 0, n), e.scale = B(t.scale, 1, n), e.origin = t.origin, e.originPoint = t.originPoint;
}
function cp(e, t, n, r) {
	e.min = B(t.min, n.min, r), e.max = B(t.max, n.max, r);
}
function lp(e, t, n, r) {
	cp(e.x, t.x, n.x, r), cp(e.y, t.y, n.y, r);
}
function up(e) {
	return e.animationValues && e.animationValues.opacityExit !== void 0;
}
var dp = {
	duration: .45,
	ease: [
		.4,
		0,
		.1,
		1
	]
}, fp = (e) => typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(e), pp = fp("applewebkit/") && !fp("chrome/") ? Math.round : aa;
function mp(e) {
	e.min = pp(e.min), e.max = pp(e.max);
}
function hp(e) {
	mp(e.x), mp(e.y);
}
function gp(e, t, n) {
	return e === "position" || e === "preserve-aspect" && !nf(xf(t), xf(n), .2);
}
function _p(e) {
	return e !== e.root && e.scroll?.wasRoot;
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/node/DocumentProjectionNode.mjs
var vp = Kf({
	attachResizeListener: (e, t) => Pf(e, "resize", t),
	measureScroll: () => ({
		x: document.documentElement.scrollLeft || document.body?.scrollLeft || 0,
		y: document.documentElement.scrollTop || document.body?.scrollTop || 0
	}),
	checkIsScrollRoot: () => !0
}), yp = { current: void 0 }, bp = Kf({
	measureScroll: (e) => ({
		x: e.scrollLeft,
		y: e.scrollTop
	}),
	defaultParent: () => {
		if (!yp.current) {
			let e = new vp({});
			e.mount(window), e.setOptions({ layoutScroll: !0 }), yp.current = e;
		}
		return yp.current;
	},
	resetTransform: (e, t) => {
		e.style.transform = t === void 0 ? "none" : t;
	},
	checkIsScrollRoot: (e) => window.getComputedStyle(e).position === "fixed"
}), xp = (0, _.createContext)({
	transformPagePoint: (e) => e,
	isStatic: !1,
	reducedMotion: "never"
});
//#endregion
//#region node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs
function Sp(e = !0) {
	let t = (0, _.useContext)(Xi);
	if (t === null) return [!0, null];
	let { isPresent: n, onExitComplete: r, register: i } = t, a = (0, _.useId)();
	(0, _.useEffect)(() => {
		if (e) return i(a);
	}, [e]);
	let o = (0, _.useCallback)(() => e && r && r(a), [
		a,
		r,
		e
	]);
	return !n && r ? [!1, o] : [!0];
}
//#endregion
//#region node_modules/framer-motion/dist/es/context/LazyContext.mjs
var Cp = (0, _.createContext)({ strict: !1 }), wp = {
	animation: [
		"animate",
		"variants",
		"whileHover",
		"whileTap",
		"exit",
		"whileInView",
		"whileFocus",
		"whileDrag"
	],
	exit: ["exit"],
	drag: ["drag", "dragControls"],
	focus: ["whileFocus"],
	hover: [
		"whileHover",
		"onHoverStart",
		"onHoverEnd"
	],
	tap: [
		"whileTap",
		"onTap",
		"onTapStart",
		"onTapCancel"
	],
	pan: [
		"onPan",
		"onPanStart",
		"onPanSessionStart",
		"onPanEnd"
	],
	inView: [
		"whileInView",
		"onViewportEnter",
		"onViewportLeave"
	],
	layout: ["layout", "layoutId"]
}, Tp = !1;
function Ep() {
	if (Tp) return;
	let e = {};
	for (let t in wp) e[t] = { isEnabled: (e) => wp[t].some((t) => !!e[t]) };
	yd(e), Tp = !0;
}
function Dp() {
	return Ep(), bd();
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/features/load-features.mjs
function Op(e) {
	let t = Dp();
	for (let n in e) t[n] = {
		...t[n],
		...e[n]
	};
	yd(t);
}
//#endregion
//#region node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs
var $ = Ki();
function kp({ children: e, ...t }) {
	let n = (0, _.useContext)(xp);
	t = {
		...n,
		...t
	}, t.transition = rl(t.transition, n.transition), t.isStatic = Ji(() => t.isStatic);
	let r = (0, _.useMemo)(() => t, [
		JSON.stringify(t.transition),
		t.transformPagePoint,
		t.reducedMotion,
		t.skipAnimations,
		t.isValidProp
	]);
	return (0, $.jsx)(xp.Provider, {
		value: r,
		children: e
	});
}
//#endregion
//#region node_modules/framer-motion/dist/es/context/MotionContext/index.mjs
var Ap = /* @__PURE__ */ (0, _.createContext)({});
//#endregion
//#region node_modules/framer-motion/dist/es/context/MotionContext/utils.mjs
function jp(e, t) {
	if (ud(e)) {
		let { initial: t, animate: n } = e;
		return {
			initial: t === !1 || sd(t) ? t : void 0,
			animate: sd(n) ? n : void 0
		};
	}
	return e.inherit === !1 ? {} : t;
}
//#endregion
//#region node_modules/framer-motion/dist/es/context/MotionContext/create.mjs
function Mp(e) {
	let { initial: t, animate: n } = jp(e, (0, _.useContext)(Ap));
	return (0, _.useMemo)(() => ({
		initial: t,
		animate: n
	}), [Np(t), Np(n)]);
}
function Np(e) {
	return Array.isArray(e) ? e.join(" ") : e;
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/html/utils/create-render-state.mjs
var Pp = () => ({
	style: {},
	transform: {},
	transformOrigin: {},
	vars: {}
});
//#endregion
//#region node_modules/framer-motion/dist/es/render/html/use-props.mjs
function Fp(e, t, n) {
	for (let r in t) !Cl(t[r]) && !kd(r, n) && (e[r] = t[r]);
}
function Ip({ transformTemplate: e }, t) {
	return (0, _.useMemo)(() => {
		let n = Pp();
		return Zl(n, t, e), Object.assign({}, n.vars, n.style);
	}, [t]);
}
function Lp(e, t) {
	let n = e.style || {}, r = {};
	return Fp(r, n, e), Object.assign(r, Ip(e, t)), r;
}
function Rp(e, t) {
	let n = {}, r = Lp(e, t);
	return e.drag && e.dragListener !== !1 && (n.draggable = !1, r.userSelect = r.WebkitUserSelect = r.WebkitTouchCallout = "none", r.touchAction = e.drag === !0 ? "none" : `pan-${e.drag === "x" ? "y" : "x"}`), e.tabIndex === void 0 && (e.onTap || e.onTapStart || e.whileTap) && (n.tabIndex = 0), n.style = r, n;
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/svg/utils/create-render-state.mjs
var zp = () => ({
	...Pp(),
	attrs: {}
});
//#endregion
//#region node_modules/framer-motion/dist/es/render/svg/use-props.mjs
function Bp(e, t, n, r) {
	let i = (0, _.useMemo)(() => {
		let n = zp();
		return nu(n, t, Pd(r), e.transformTemplate, e.style), {
			...n.attrs,
			style: { ...n.style }
		};
	}, [t]);
	if (e.style) {
		let t = {};
		Fp(t, e.style, e), i.style = {
			...t,
			...i.style
		};
	}
	return i;
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/utils/valid-prop.mjs
var Vp = /* @__PURE__ */ new Set(/* @__PURE__ */ "animate.exit.variants.initial.style.values.variants.transition.transformTemplate.custom.inherit.onBeforeLayoutMeasure.onAnimationStart.onAnimationComplete.onUpdate.onDragStart.onDrag.onDragEnd.onMeasureDragConstraints.onDirectionLock.onDragTransitionEnd._dragX._dragY.onHoverStart.onHoverEnd.onViewportEnter.onViewportLeave.globalTapTarget.propagate.ignoreStrict.viewport".split("."));
function Hp(e) {
	return e.startsWith("while") || e.startsWith("drag") && e !== "draggable" || e.startsWith("layout") || e.startsWith("onTap") || e.startsWith("onPan") || e.startsWith("onLayout") || Vp.has(e);
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/dom/utils/filter-props.mjs
function Up(e, t) {
	return e.startsWith("on") ? !Hp(e) : t?.(e) ?? !Hp(e);
}
function Wp(e, t, n, r) {
	let i = {};
	for (let a in e) (a !== "values" || typeof e.values != "object") && (Cl(e[a]) || (Up(a, r) || n === !0 && Hp(a) || !t && !Hp(a) || e.draggable && a.startsWith("onDrag")) && (i[a] = e[a]));
	return i;
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/svg/lowercase-elements.mjs
var Gp = [
	"animate",
	"circle",
	"defs",
	"desc",
	"ellipse",
	"g",
	"image",
	"line",
	"filter",
	"marker",
	"mask",
	"metadata",
	"path",
	"pattern",
	"polygon",
	"polyline",
	"rect",
	"stop",
	"switch",
	"symbol",
	"svg",
	"text",
	"tspan",
	"use",
	"view"
];
//#endregion
//#region node_modules/framer-motion/dist/es/render/dom/utils/is-svg-component.mjs
function Kp(e) {
	return typeof e != "string" || e.includes("-") ? !1 : !!(Gp.indexOf(e) > -1 || /[A-Z]/u.test(e));
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/dom/use-render.mjs
function qp(e, t, n, { latestValues: r }, i, a = !1, o, s) {
	let c = (o ?? Kp(e) ? Bp : Rp)(t, r, i, e), l = Wp(t, typeof e == "string", a, s), u = e === _.Fragment ? {} : {
		...l,
		...c,
		ref: n
	}, { children: d } = t, f = (0, _.useMemo)(() => Cl(d) ? d.get() : d, [d]);
	return (0, _.createElement)(e, {
		...u,
		children: f
	});
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs
function Jp({ scrapeMotionValuesFromProps: e, createRenderState: t }, n, r, i) {
	return {
		latestValues: Yp(n, r, i, e),
		renderState: t()
	};
}
function Yp(e, t, n, r) {
	let i = {}, a = r(e, {});
	for (let e in a) i[e] = Rf(a[e]);
	let { initial: o, animate: s } = e, c = ud(e), l = dd(e);
	t && l && !c && e.inherit !== !1 && (o === void 0 && (o = t.initial), s === void 0 && (s = t.animate));
	let u = n ? n.initial === !1 : !1;
	u ||= o === !1;
	let d = u ? s : o;
	if (d && typeof d != "boolean" && !od(d)) {
		let t = Array.isArray(d) ? d : [d];
		for (let n = 0; n < t.length; n++) {
			let r = _l(e, t[n]);
			if (r) {
				let { transitionEnd: e, transition: t, ...n } = r;
				for (let e in n) {
					let t = n[e];
					if (Array.isArray(t)) {
						let e = u ? t.length - 1 : 0;
						t = t[e];
					}
					t !== null && (i[e] = t);
				}
				for (let t in e) i[t] = e[t];
			}
		}
	}
	return i;
}
var Xp = (e) => (t, n) => {
	let r = (0, _.useContext)(Ap), i = (0, _.useContext)(Xi), a = () => Jp(e, t, r, i);
	return n ? a() : Ji(a);
}, Zp = /*@__PURE__*/ Xp({
	scrapeMotionValuesFromProps: Ad,
	createRenderState: Pp
}), Qp = /*@__PURE__*/ Xp({
	scrapeMotionValuesFromProps: Id,
	createRenderState: zp
}), $p = Symbol.for("motionComponentSymbol");
//#endregion
//#region node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs
function em(e, t, n) {
	let r = (0, _.useRef)(n);
	(0, _.useInsertionEffect)(() => {
		r.current = n;
	});
	let i = (0, _.useRef)(null);
	return (0, _.useCallback)((n) => {
		n && e.onMount?.(n), t && (n ? t.mount(n) : t.unmount());
		let a = r.current;
		if (typeof a == "function") {
			if (n) {
				let e = a(n);
				typeof e == "function" && (i.current = e);
			} else i.current ? (i.current(), i.current = null) : a(n);
		} else a && (a.current = n);
	}, [t]);
}
//#endregion
//#region node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs
var tm = (0, _.createContext)({});
//#endregion
//#region node_modules/framer-motion/dist/es/utils/is-ref-object.mjs
function nm(e) {
	return e && typeof e == "object" && Object.prototype.hasOwnProperty.call(e, "current");
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs
function rm(e, t, n, r, i, a) {
	let { visualElement: o } = (0, _.useContext)(Ap), s = (0, _.useContext)(Cp), c = (0, _.useContext)(Xi), l = (0, _.useContext)(xp), u = l.reducedMotion, d = l.skipAnimations, f = (0, _.useRef)(null), p = (0, _.useRef)(!1);
	r ||= s.renderer, !f.current && r && (f.current = r(e, {
		visualState: t,
		parent: o,
		props: n,
		presenceContext: c,
		blockInitialAnimation: c ? c.initial === !1 : !1,
		reducedMotionConfig: u,
		skipAnimations: d,
		isSVG: a
	}), p.current && f.current && (f.current.manuallyAnimateOnMount = !0));
	let m = f.current, h = (0, _.useContext)(tm);
	m && !m.projection && i && (m.type === "html" || m.type === "svg") && im(f.current, n, i, h);
	let g = (0, _.useRef)(!1);
	(0, _.useInsertionEffect)(() => {
		m && g.current && m.update(n, c);
	});
	let v = n[Dl], y = (0, _.useRef)(!!v && typeof window < "u" && !window.MotionHandoffIsComplete?.(v) && window.MotionHasOptimisedAnimation?.(v));
	return Yi(() => {
		p.current = !0, m && (g.current = !0, window.MotionIsMounted = !0, m.updateFeatures(), m.scheduleRenderMicrotask(), y.current && m.animationState && m.animationState.animateChanges());
	}), (0, _.useEffect)(() => {
		m && (!y.current && m.animationState && m.animationState.animateChanges(), y.current &&= (queueMicrotask(() => {
			window.MotionHandoffMarkAsComplete?.(v);
		}), !1), m.enteringChildren = void 0);
	}), m;
}
function im(e, t, n, r) {
	let { layoutId: i, layout: a, drag: o, dragConstraints: s, layoutScroll: c, layoutRoot: l, layoutAnchor: u, layoutCrossfade: d } = t;
	e.projection = new n(e.latestValues, t["data-framer-portal-id"] ? void 0 : am(e.parent)), e.projection.setOptions({
		layoutId: i,
		layout: a,
		alwaysMeasureLayout: !!o || s && nm(s),
		visualElement: e,
		animationType: typeof a == "string" ? a : "both",
		initialPromotionConfig: r,
		crossfade: d,
		layoutScroll: c,
		layoutRoot: l,
		layoutAnchor: u
	});
}
function am(e) {
	if (e) return e.options.allowProjection === !1 ? am(e.parent) : e.projection;
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/index.mjs
function om(e, { forwardMotionProps: t = !1, type: n } = {}, r, i) {
	r && Op(r);
	let a = n ? n === "svg" : Kp(e), o = a ? Qp : Zp;
	function s(n, s) {
		let c, l = {
			...(0, _.useContext)(xp),
			...n,
			layoutId: sm(n)
		}, { isStatic: u, isValidProp: d } = l, f = Mp(n), p = o(n, u);
		if (!u && typeof window < "u") {
			cm(l, r);
			let t = lm(l);
			c = t.MeasureLayout, f.visualElement = rm(e, p, l, i, t.ProjectionNode, a);
		}
		return (0, $.jsxs)(Ap.Provider, {
			value: f,
			children: [c && f.visualElement ? (0, $.jsx)(c, {
				visualElement: f.visualElement,
				...l
			}) : null, qp(e, n, em(p, f.visualElement, s), p, u, t, a, d)]
		});
	}
	s.displayName = `motion.${typeof e == "string" ? e : `create(${e.displayName ?? e.name ?? ""})`}`;
	let c = (0, _.forwardRef)(s);
	return c[$p] = e, c;
}
function sm({ layoutId: e }) {
	let t = (0, _.useContext)(qi).id;
	return t && e !== void 0 ? t + "-" + e : e;
}
function cm(e, t) {
	(0, _.useContext)(Cp).strict;
}
function lm(e) {
	let { drag: t, layout: n } = Dp();
	if (!t && !n) return {};
	let r = {
		...t,
		...n
	};
	return {
		MeasureLayout: t?.isEnabled(e) || n?.isEnabled(e) ? r.MeasureLayout : void 0,
		ProjectionNode: r.ProjectionNode
	};
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/components/create-proxy.mjs
function um(e, t) {
	if (typeof Proxy > "u") return om;
	let n = /* @__PURE__ */ new Map(), r = (n, r) => om(n, r, e, t);
	return new Proxy((e, t) => r(e, t), { get: (i, a) => a === "create" ? r : (n.has(a) || n.set(a, om(a, void 0, e, t)), n.get(a)) });
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/dom/create-visual-element.mjs
var dm = (e, t) => t.isSVG ?? Kp(e) ? new Ld(t) : new Md(t, { allowProjection: e !== _.Fragment }), fm = class extends Cd {
	constructor(e) {
		super(e), e.animationState ||= Wd(e);
	}
	updateAnimationControlsSubscription() {
		let { animate: e } = this.node.getProps();
		od(e) && (this.unmountControls = e.subscribe(this.node));
	}
	mount() {
		this.updateAnimationControlsSubscription();
	}
	update() {
		let { animate: e } = this.node.getProps(), { animate: t } = this.node.prevProps || {};
		e !== t && this.updateAnimationControlsSubscription();
	}
	unmount() {
		this.node.animationState.reset(), this.unmountControls?.();
	}
}, pm = 0, mm = {
	animation: { Feature: fm },
	exit: { Feature: class extends Cd {
		constructor() {
			super(...arguments), this.id = pm++, this.isExitComplete = !1;
		}
		update() {
			if (!this.node.presenceContext) return;
			let { isPresent: e, onExitComplete: t } = this.node.presenceContext, { isPresent: n } = this.node.prevPresenceContext || {};
			if (!this.node.animationState || e === n) return;
			if (e && n === !1) {
				if (this.isExitComplete) {
					let { initial: e, custom: t } = this.node.getProps();
					if (typeof e == "string" || typeof e == "object" && e && !Array.isArray(e)) {
						let n = vl(this.node, e, t);
						if (n) {
							let { transition: e, transitionEnd: t, ...r } = n;
							for (let e in r) this.node.getValue(e)?.jump(r[e]);
						}
					}
					this.node.animationState.reset(), this.node.animationState.animateChanges();
				} else this.node.animationState.setActive("exit", !1);
				this.isExitComplete = !1;
				return;
			}
			let r = this.node.animationState.setActive("exit", !e);
			t && !e && r.then(() => {
				this.isExitComplete = !0, t(this.id);
			});
		}
		mount() {
			let { register: e, onExitComplete: t } = this.node.presenceContext || {};
			t && t(this.id), e && (this.unmount = e(this.id));
		}
		unmount() {}
	} }
};
//#endregion
//#region node_modules/framer-motion/dist/es/events/event-info.mjs
function hm(e) {
	return { point: {
		x: e.pageX,
		y: e.pageY
	} };
}
var gm = (e) => (t) => Mu(t) && e(t, hm(t));
//#endregion
//#region node_modules/framer-motion/dist/es/events/add-pointer-event.mjs
function _m(e, t, n, r) {
	return Pf(e, t, gm(n), r);
}
//#endregion
//#region node_modules/framer-motion/dist/es/utils/get-context-window.mjs
var vm = ({ current: e }) => e ? e.ownerDocument.defaultView : null, ym = (e, t) => Math.abs(e - t);
function bm(e, t) {
	let n = ym(e.x, t.x), r = ym(e.y, t.y);
	return Math.sqrt(n ** 2 + r ** 2);
}
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/pan/PanSession.mjs
var xm = /*#__PURE__*/ new Set(["auto", "scroll"]), Sm = class {
	constructor(e, t, { transformPagePoint: n, contextWindow: r = window, dragSnapToOrigin: i = !1, distanceThreshold: a = 3, element: o } = {}) {
		if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = /* @__PURE__ */ new Map(), this.removeScrollListeners = null, this.onElementScroll = (e) => {
			this.handleScroll(e.target);
		}, this.onWindowScroll = () => {
			this.handleScroll(window);
		}, this.updatePoint = () => {
			if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
			this.lastRawMoveEventInfo && (this.lastMoveEventInfo = Cm(this.lastRawMoveEventInfo, this.transformPagePoint));
			let e = Tm(this.lastMoveEventInfo, this.history), t = this.startEvent !== null, n = bm(e.offset, {
				x: 0,
				y: 0
			}) >= this.distanceThreshold;
			if (!t && !n) return;
			let { point: r } = e, { timestamp: i } = Fa;
			this.history.push({
				...r,
				timestamp: i
			});
			let { onStart: a, onMove: o } = this.handlers;
			t || (a && a(this.lastMoveEvent, e), this.startEvent = this.lastMoveEvent), o && o(this.lastMoveEvent, e);
		}, this.handlePointerMove = (e, t) => {
			this.lastMoveEvent = e, this.lastRawMoveEventInfo = t, this.lastMoveEventInfo = Cm(t, this.transformPagePoint), I.update(this.updatePoint, !0);
		}, this.handlePointerUp = (e, t) => {
			this.end();
			let { onEnd: n, onSessionEnd: r, resumeAnimation: i } = this.handlers;
			if ((this.dragSnapToOrigin || !this.startEvent) && i && i(), !(this.lastMoveEvent && this.lastMoveEventInfo)) return;
			let a = Tm(e.type === "pointercancel" ? this.lastMoveEventInfo : Cm(t, this.transformPagePoint), this.history);
			this.startEvent && n && n(e, a), r && r(e, a);
		}, !Mu(e)) return;
		this.dragSnapToOrigin = i, this.handlers = t, this.transformPagePoint = n, this.distanceThreshold = a, this.contextWindow = r || window;
		let s = Cm(hm(e), this.transformPagePoint), { point: c } = s, { timestamp: l } = Fa;
		this.history = [{
			...c,
			timestamp: l
		}];
		let { onSessionStart: u } = t;
		u && u(e, Tm(s, this.history));
		let d = {
			passive: !0,
			capture: !0
		};
		this.removeListeners = oa(_m(this.contextWindow, "pointermove", this.handlePointerMove, d), _m(this.contextWindow, "pointerup", this.handlePointerUp, d), _m(this.contextWindow, "pointercancel", this.handlePointerUp, d)), o && this.startScrollTracking(o);
	}
	startScrollTracking(e) {
		let t = e.parentElement;
		for (; t;) {
			let e = getComputedStyle(t);
			(xm.has(e.overflowX) || xm.has(e.overflowY)) && this.scrollPositions.set(t, {
				x: t.scrollLeft,
				y: t.scrollTop
			}), t = t.parentElement;
		}
		this.scrollPositions.set(window, {
			x: window.scrollX,
			y: window.scrollY
		}), window.addEventListener("scroll", this.onElementScroll, { capture: !0 }), window.addEventListener("scroll", this.onWindowScroll), this.removeScrollListeners = () => {
			window.removeEventListener("scroll", this.onElementScroll, { capture: !0 }), window.removeEventListener("scroll", this.onWindowScroll);
		};
	}
	handleScroll(e) {
		let t = this.scrollPositions.get(e);
		if (!t) return;
		let n = e === window, r = n ? {
			x: window.scrollX,
			y: window.scrollY
		} : {
			x: e.scrollLeft,
			y: e.scrollTop
		}, i = {
			x: r.x - t.x,
			y: r.y - t.y
		};
		(i.x !== 0 || i.y !== 0) && (n ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += i.x, this.lastMoveEventInfo.point.y += i.y) : this.history.length > 0 && (this.history[0].x -= i.x, this.history[0].y -= i.y), this.scrollPositions.set(e, r), I.update(this.updatePoint, !0));
	}
	updateHandlers(e) {
		this.handlers = e;
	}
	end() {
		this.removeListeners && this.removeListeners(), this.removeScrollListeners && this.removeScrollListeners(), this.scrollPositions.clear(), L(this.updatePoint);
	}
};
function Cm(e, t) {
	return t ? { point: t(e.point) } : e;
}
function wm(e, t) {
	return {
		x: e.x - t.x,
		y: e.y - t.y
	};
}
function Tm({ point: e }, t) {
	return {
		point: e,
		delta: wm(e, Dm(t)),
		offset: wm(e, Em(t)),
		velocity: Om(t, .1)
	};
}
function Em(e) {
	return e[0];
}
function Dm(e) {
	return e[e.length - 1];
}
function Om(e, t) {
	if (e.length < 2) return {
		x: 0,
		y: 0
	};
	let n = e.length - 1, r = null, i = Dm(e);
	for (; n >= 0 && (r = e[n], !(i.timestamp - r.timestamp > /* @__PURE__ */ la(t)));) n--;
	if (!r) return {
		x: 0,
		y: 0
	};
	r === e[0] && e.length > 2 && i.timestamp - r.timestamp > /* @__PURE__ */ la(t) * 2 && (r = e[1]);
	let a = /* @__PURE__ */ N(i.timestamp - r.timestamp);
	if (a === 0) return {
		x: 0,
		y: 0
	};
	let o = {
		x: (i.x - r.x) / a,
		y: (i.y - r.y) / a
	};
	return o.x === Infinity && (o.x = 0), o.y === Infinity && (o.y = 0), o;
}
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/drag/utils/constraints.mjs
function km(e, { min: t, max: n }, r) {
	return t !== void 0 && e < t ? e = r ? B(t, e, r.min) : Math.max(e, t) : n !== void 0 && e > n && (e = r ? B(n, e, r.max) : Math.min(e, n)), e;
}
function Am(e, t, n) {
	return {
		min: t === void 0 ? void 0 : e.min + t,
		max: n === void 0 ? void 0 : e.max + n - (e.max - e.min)
	};
}
function jm(e, { top: t, left: n, bottom: r, right: i }) {
	return {
		x: Am(e.x, n, i),
		y: Am(e.y, t, r)
	};
}
function Mm(e, t) {
	let n = t.min - e.min, r = t.max - e.max;
	return t.max - t.min < e.max - e.min && ([n, r] = [r, n]), {
		min: n,
		max: r
	};
}
function Nm(e, t) {
	return {
		x: Mm(e.x, t.x),
		y: Mm(e.y, t.y)
	};
}
function Pm(e, t) {
	let n = .5, r = tf(e), i = tf(t);
	return i > r ? n = /* @__PURE__ */ sa(t.min, t.max - r, e.min) : r > i && (n = /* @__PURE__ */ sa(e.min, e.max - i, t.min)), $i(0, 1, n);
}
function Fm(e, t) {
	let n = {};
	return t.min !== void 0 && (n.min = t.min - e.min), t.max !== void 0 && (n.max = t.max - e.min), n;
}
var Im = .35;
function Lm(e = Im) {
	return e === !1 ? e = 0 : e === !0 && (e = Im), {
		x: Rm(e, "left", "right"),
		y: Rm(e, "top", "bottom")
	};
}
function Rm(e, t, n) {
	return {
		min: zm(e, t),
		max: zm(e, n)
	};
}
function zm(e, t) {
	return typeof e == "number" ? e : e[t] || 0;
}
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/drag/VisualElementDragControls.mjs
var Bm = /* @__PURE__ */ new WeakMap(), Vm = class {
	constructor(e) {
		this.openDragLock = null, this.isDragging = !1, this.currentDirection = null, this.originPoint = {
			x: 0,
			y: 0
		}, this.constraints = !1, this.hasMutatedConstraints = !1, this.elastic = id(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = e;
	}
	start(e, { snapToCursor: t = !1, distanceThreshold: n } = {}) {
		let { presenceContext: r } = this.visualElement;
		if (r && r.isPresent === !1) return;
		let i = (e) => {
			t && this.snapToCursor(hm(e).point), this.stopAnimation();
		}, a = (e, t) => {
			let { drag: n, dragPropagation: r, onDragStart: i } = this.getProps();
			if (n && !r && (this.openDragLock && this.openDragLock(), this.openDragLock = Du(n), !this.openDragLock)) return;
			this.latestPointerEvent = e, this.latestPanInfo = t, this.isDragging = !0, this.currentDirection = null, this.resolveConstraints(), this.visualElement.projection && (this.visualElement.projection.isAnimationBlocked = !0, this.visualElement.projection.target = void 0), Cf((e) => {
				let t = this.getAxisMotionValue(e).get() || 0;
				if (co.test(t)) {
					let { projection: n } = this.visualElement;
					if (n && n.layout) {
						let r = n.layout.layoutBox[e];
						r && (t = tf(r) * (parseFloat(t) / 100));
					}
				}
				this.originPoint[e] = t;
			}), i && I.update(() => i(e, t), !1, !0), Tl(this.visualElement, "transform");
			let { animationState: a } = this.visualElement;
			a && a.setActive("whileDrag", !0);
		}, o = (e, t) => {
			this.latestPointerEvent = e, this.latestPanInfo = t;
			let { dragPropagation: n, dragDirectionLock: r, onDirectionLock: i, onDrag: a } = this.getProps();
			if (!n && !this.openDragLock) return;
			let { offset: o } = t;
			if (r && this.currentDirection === null) {
				this.currentDirection = Gm(o), this.currentDirection !== null && i && i(this.currentDirection);
				return;
			}
			this.updateAxis("x", t.point, o), this.updateAxis("y", t.point, o), this.visualElement.render(), a && I.update(() => a(e, t), !1, !0);
		}, s = (e, t) => {
			this.latestPointerEvent = e, this.latestPanInfo = t, this.stop(e, t), this.latestPointerEvent = null, this.latestPanInfo = null;
		}, c = () => {
			let { dragSnapToOrigin: e } = this.getProps();
			(e || this.constraints) && this.startAnimation({
				x: 0,
				y: 0
			});
		}, { dragSnapToOrigin: l } = this.getProps();
		this.panSession = new Sm(e, {
			onSessionStart: i,
			onStart: a,
			onMove: o,
			onSessionEnd: s,
			resumeAnimation: c
		}, {
			transformPagePoint: this.visualElement.getTransformPagePoint(),
			dragSnapToOrigin: l,
			distanceThreshold: n,
			contextWindow: vm(this.visualElement),
			element: this.visualElement.current
		});
	}
	stop(e, t) {
		let n = e || this.latestPointerEvent, r = t || this.latestPanInfo, i = this.isDragging;
		if (this.cancel(), !i || !r || !n) return;
		let { velocity: a } = r;
		this.startAnimation(a);
		let { onDragEnd: o } = this.getProps();
		o && I.postRender(() => o(n, r));
	}
	cancel() {
		this.isDragging = !1;
		let { projection: e, animationState: t } = this.visualElement;
		e && (e.isAnimationBlocked = !1), this.endPanSession();
		let { dragPropagation: n } = this.getProps();
		!n && this.openDragLock && (this.openDragLock(), this.openDragLock = null), t && t.setActive("whileDrag", !1);
	}
	endPanSession() {
		this.panSession && this.panSession.end(), this.panSession = void 0;
	}
	updateAxis(e, t, n) {
		let { drag: r } = this.getProps();
		if (!n || !Wm(e, r, this.currentDirection)) return;
		let i = this.getAxisMotionValue(e), a = this.originPoint[e] + n[e];
		this.constraints && this.constraints[e] && (a = km(a, this.constraints[e], this.elastic[e])), i.set(a);
	}
	resolveConstraints() {
		let { dragConstraints: e, dragElastic: t } = this.getProps(), n = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(!1) : this.visualElement.projection?.layout, r = this.constraints;
		e && nm(e) ? this.constraints ||= this.resolveRefConstraints() : this.constraints = e && n ? jm(n.layoutBox, e) : !1, this.elastic = Lm(t), r !== this.constraints && !nm(e) && n && this.constraints && !this.hasMutatedConstraints && Cf((e) => {
			this.constraints !== !1 && this.getAxisMotionValue(e) && (this.constraints[e] = Fm(n.layoutBox[e], this.constraints[e]));
		});
	}
	resolveRefConstraints() {
		let { dragConstraints: e, onMeasureDragConstraints: t } = this.getProps();
		if (!e || !nm(e)) return !1;
		let n = e.current, { projection: r } = this.visualElement;
		if (!r || !r.layout) return !1;
		r.root && (r.root.scroll = void 0, r.root.updateScroll());
		let i = Su(n, r.root, this.visualElement.getTransformPagePoint()), a = Nm(r.layout.layoutBox, i);
		if (t) {
			let e = t(iu(a));
			this.hasMutatedConstraints = !!e, e && (a = ru(e));
		}
		return a;
	}
	startAnimation(e) {
		let { drag: t, dragMomentum: n, dragElastic: r, dragTransition: i, dragSnapToOrigin: a, onDragTransitionEnd: o } = this.getProps(), s = this.constraints || {}, c = Cf((o) => {
			if (!Wm(o, t, this.currentDirection)) return;
			let c = s && s[o] || {};
			(a === !0 || a === o) && (c = {
				min: 0,
				max: 0
			});
			let l = r ? 200 : 1e6, u = r ? 40 : 1e7, d = {
				type: "inertia",
				velocity: n ? e[o] : 0,
				bounceStiffness: l,
				bounceDamping: u,
				timeConstant: 750,
				restDelta: 1,
				restSpeed: 10,
				...i,
				...c
			};
			return this.startAxisValueAnimation(o, d);
		});
		return Promise.all(c).then(o);
	}
	startAxisValueAnimation(e, t) {
		let n = this.getAxisMotionValue(e);
		return Tl(this.visualElement, e), n.start(fl(e, n, 0, t, this.visualElement, !1));
	}
	stopAnimation() {
		Cf((e) => this.getAxisMotionValue(e).stop());
	}
	getAxisMotionValue(e) {
		let t = `_drag${e.toUpperCase()}`;
		return this.visualElement.getProps()[t] || this.visualElement.getValue(e, this.visualElement.latestValues[e] ?? 0);
	}
	snapToCursor(e) {
		Cf((t) => {
			let { drag: n } = this.getProps();
			if (!Wm(t, n, this.currentDirection)) return;
			let { projection: r } = this.visualElement, i = this.getAxisMotionValue(t);
			if (r && r.layout) {
				let { min: n, max: a } = r.layout.layoutBox[t], o = i.get() || 0;
				i.set(e[t] - B(n, a, .5) + o);
			}
		});
	}
	scalePositionWithinConstraints() {
		if (!this.visualElement.current) return;
		let { drag: e, dragConstraints: t } = this.getProps(), { projection: n } = this.visualElement;
		if (!nm(t) || !n || !this.constraints) return;
		this.stopAnimation();
		let r = {
			x: 0,
			y: 0
		};
		Cf((e) => {
			let t = this.getAxisMotionValue(e);
			if (t && this.constraints !== !1) {
				let n = t.get();
				r[e] = Pm({
					min: n,
					max: n
				}, this.constraints[e]);
			}
		});
		let { transformTemplate: i } = this.visualElement.getProps();
		this.visualElement.current.style.transform = i ? i({}, "") : "none", n.root && n.root.updateScroll(), n.updateLayout(), this.constraints = !1, this.resolveConstraints(), Cf((t) => {
			if (!Wm(t, e, null)) return;
			let n = this.getAxisMotionValue(t), { min: i, max: a } = this.constraints[t];
			n.set(B(i, a, r[t]));
		}), this.visualElement.render();
	}
	addListeners() {
		if (!this.visualElement.current) return;
		Bm.set(this.visualElement, this);
		let e = this.visualElement.current, t = _m(e, "pointerdown", (t) => {
			let { drag: n, dragListener: r = !0 } = this.getProps(), i = t.target, a = i !== e && Iu(i);
			n && r && !a && this.start(t);
		}), n, r = () => {
			let { dragConstraints: t } = this.getProps();
			nm(t) && t.current && (this.constraints = this.resolveRefConstraints(), n ||= Um(e, t.current, () => this.scalePositionWithinConstraints()));
		}, { projection: i } = this.visualElement, a = i.addEventListener("measure", r);
		i && !i.layout && (i.root && i.root.updateScroll(), i.updateLayout()), I.read(r);
		let o = Pf(window, "resize", () => this.scalePositionWithinConstraints()), s = i.addEventListener("didUpdate", (({ delta: e, hasLayoutChanged: t }) => {
			this.isDragging && t && (Cf((t) => {
				let n = this.getAxisMotionValue(t);
				n && (this.originPoint[t] += e[t].translate, n.set(n.get() + e[t].translate));
			}), this.visualElement.render());
		}));
		return () => {
			o(), t(), a(), s && s(), n && n();
		};
	}
	getProps() {
		let e = this.visualElement.getProps(), { drag: t = !1, dragDirectionLock: n = !1, dragPropagation: r = !1, dragConstraints: i = !1, dragElastic: a = Im, dragMomentum: o = !0 } = e;
		return {
			...e,
			drag: t,
			dragDirectionLock: n,
			dragPropagation: r,
			dragConstraints: i,
			dragElastic: a,
			dragMomentum: o
		};
	}
};
function Hm(e) {
	let t = !0;
	return () => {
		if (t) {
			t = !1;
			return;
		}
		e();
	};
}
function Um(e, t, n) {
	let r = q(e, Hm(n)), i = q(t, Hm(n));
	return () => {
		r(), i();
	};
}
function Wm(e, t, n) {
	return (t === !0 || t === e) && (n === null || n === e);
}
function Gm(e, t = 10) {
	let n = null;
	return Math.abs(e.y) > t ? n = "y" : Math.abs(e.x) > t && (n = "x"), n;
}
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/drag/index.mjs
var Km = class extends Cd {
	constructor(e) {
		super(e), this.removeGroupControls = aa, this.removeListeners = aa, this.controls = new Vm(e);
	}
	mount() {
		let { dragControls: e } = this.node.getProps();
		e && (this.removeGroupControls = e.subscribe(this.controls)), this.removeListeners = this.controls.addListeners() || aa;
	}
	update() {
		let { dragControls: e } = this.node.getProps(), { dragControls: t } = this.node.prevProps || {};
		e !== t && (this.removeGroupControls(), e && (this.removeGroupControls = e.subscribe(this.controls)));
	}
	unmount() {
		this.removeGroupControls(), this.removeListeners(), this.controls.isDragging || this.controls.endPanSession();
	}
}, qm = (e) => (t, n) => {
	e && I.update(() => e(t, n), !1, !0);
}, Jm = class extends Cd {
	constructor() {
		super(...arguments), this.removePointerDownListener = aa;
	}
	onPointerDown(e) {
		this.session = new Sm(e, this.createPanHandlers(), {
			transformPagePoint: this.node.getTransformPagePoint(),
			contextWindow: vm(this.node)
		});
	}
	createPanHandlers() {
		let { onPanSessionStart: e, onPanStart: t, onPan: n, onPanEnd: r } = this.node.getProps();
		return {
			onSessionStart: qm(e),
			onStart: qm(t),
			onMove: qm(n),
			onEnd: (e, t) => {
				delete this.session, r && I.postRender(() => r(e, t));
			}
		};
	}
	mount() {
		this.removePointerDownListener = _m(this.node.current, "pointerdown", (e) => this.onPointerDown(e));
	}
	update() {
		this.session && this.session.updateHandlers(this.createPanHandlers());
	}
	unmount() {
		this.removePointerDownListener(), this.session && this.session.end();
	}
}, Ym = !1, Xm = class extends _.Component {
	componentDidMount() {
		let { visualElement: e, layoutGroup: t, switchLayoutGroup: n, layoutId: r } = this.props, { projection: i } = e;
		i && (t.group && t.group.add(i), n && n.register && r && n.register(i), Ym && i.root.didUpdate(), i.addEventListener("animationComplete", () => {
			this.safeToRemove();
		}), i.setOptions({
			...i.options,
			layoutDependency: this.props.layoutDependency,
			onExitComplete: () => this.safeToRemove()
		})), Bf.hasEverUpdated = !0;
	}
	getSnapshotBeforeUpdate(e) {
		let { layoutDependency: t, visualElement: n, drag: r, isPresent: i } = this.props, { projection: a } = n;
		return a ? (a.isPresent = i, e.layoutDependency !== t && a.setOptions({
			...a.options,
			layoutDependency: t
		}), Ym = !0, r || e.layoutDependency !== t || t === void 0 || e.isPresent !== i ? a.willUpdate() : this.safeToRemove(), e.isPresent !== i && (i ? a.promote() : a.relegate() || I.postRender(() => {
			let e = a.getStack();
			(!e || !e.members.length) && this.safeToRemove();
		})), null) : null;
	}
	componentDidUpdate() {
		let { visualElement: e, layoutAnchor: t } = this.props, { projection: n } = e;
		n && (n.options.layoutAnchor = t, n.root.didUpdate(), Cu.postRender(() => {
			!n.currentAnimation && n.isLead() && this.safeToRemove();
		}));
	}
	componentWillUnmount() {
		let { visualElement: e, layoutGroup: t, switchLayoutGroup: n } = this.props, { projection: r } = e;
		Ym = !0, r && (r.scheduleCheckAfterUnmount(), t && t.group && t.group.remove(r), n && n.deregister && n.deregister(r));
	}
	safeToRemove() {
		let { safeToRemove: e } = this.props;
		e && e();
	}
	render() {
		return null;
	}
};
function Zm(e) {
	let [t, n] = Sp(), r = (0, _.useContext)(qi);
	return (0, $.jsx)(Xm, {
		...e,
		layoutGroup: r,
		switchLayoutGroup: (0, _.useContext)(tm),
		isPresent: t,
		safeToRemove: n
	});
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/features/drag.mjs
var Qm = {
	pan: { Feature: Jm },
	drag: {
		Feature: Km,
		ProjectionNode: bp,
		MeasureLayout: Zm
	}
};
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/hover.mjs
function $m(e, t, n) {
	let { props: r } = e;
	e.animationState && r.whileHover && e.animationState.setActive("whileHover", n === "Start");
	let i = r["onHover" + n];
	i && I.postRender(() => i(t, hm(t)));
}
var eh = class extends Cd {
	mount() {
		let { current: e } = this.node;
		e && (this.unmount = Au(e, (e, t) => ($m(this.node, t, "Start"), (e) => $m(this.node, e, "End"))));
	}
	unmount() {}
}, th = class extends Cd {
	constructor() {
		super(...arguments), this.isActive = !1;
	}
	onFocus() {
		let e = !1;
		try {
			e = this.node.current.matches(":focus-visible");
		} catch {
			e = !0;
		}
		e && this.node.animationState && (this.node.animationState.setActive("whileFocus", !0), this.isActive = !0);
	}
	onBlur() {
		this.isActive && this.node.animationState && (this.node.animationState.setActive("whileFocus", !1), this.isActive = !1);
	}
	mount() {
		this.unmount = oa(Pf(this.node.current, "focus", () => this.onFocus()), Pf(this.node.current, "blur", () => this.onBlur()));
	}
	unmount() {}
};
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/press.mjs
function nh(e, t, n) {
	let { props: r } = e;
	if (e.current instanceof HTMLButtonElement && e.current.disabled) return;
	e.animationState && r.whileTap && e.animationState.setActive("whileTap", n === "Start");
	let i = r["onTap" + (n === "End" ? "" : n)];
	i && I.postRender(() => i(t, hm(t)));
}
var rh = class extends Cd {
	mount() {
		let { current: e } = this.node;
		if (!e) return;
		let { globalTapTarget: t, propagate: n } = this.node.props;
		this.unmount = Uu(e, (e, t) => (nh(this.node, t, "Start"), (e, { success: t }) => nh(this.node, e, t ? "End" : "Cancel")), {
			useGlobalTarget: t,
			stopPropagation: n?.tap === !1
		});
	}
	unmount() {}
}, ih = /* @__PURE__ */ new WeakMap(), ah = /* @__PURE__ */ new WeakMap(), oh = (e) => {
	let t = ih.get(e.target);
	t && t(e);
}, sh = (e) => {
	e.forEach(oh);
};
function ch({ root: e, ...t }) {
	let n = e || document;
	ah.has(n) || ah.set(n, {});
	let r = ah.get(n), i = JSON.stringify(t);
	return r[i] || (r[i] = new IntersectionObserver(sh, {
		root: e,
		...t
	})), r[i];
}
function lh(e, t, n) {
	let r = ch(t);
	return ih.set(e, n), r.observe(e), () => {
		ih.delete(e), r.unobserve(e);
	};
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/features/viewport/index.mjs
var uh = {
	some: 0,
	all: 1
}, dh = class extends Cd {
	constructor() {
		super(...arguments), this.hasEnteredView = !1, this.isInView = !1;
	}
	startObserver() {
		this.stopObserver?.();
		let { viewport: e = {} } = this.node.getProps(), { root: t, margin: n, amount: r = "some", once: i } = e, a = {
			root: t ? t.current : void 0,
			rootMargin: n,
			threshold: typeof r == "number" ? r : uh[r]
		}, o = (e) => {
			let { isIntersecting: t } = e;
			if (this.isInView === t || (this.isInView = t, i && !t && this.hasEnteredView)) return;
			t && (this.hasEnteredView = !0), this.node.animationState && this.node.animationState.setActive("whileInView", t);
			let { onViewportEnter: n, onViewportLeave: r } = this.node.getProps(), a = t ? n : r;
			a && a(e);
		};
		this.stopObserver = lh(this.node.current, a, o);
	}
	mount() {
		this.startObserver();
	}
	update() {
		if (typeof IntersectionObserver > "u") return;
		let { props: e, prevProps: t } = this.node;
		[
			"amount",
			"margin",
			"root"
		].some(fh(e, t)) && this.startObserver();
	}
	unmount() {
		this.stopObserver?.(), this.hasEnteredView = !1, this.isInView = !1;
	}
};
function fh({ viewport: e = {} }, { viewport: t = {} } = {}) {
	return (n) => e[n] !== t[n];
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/features/gestures.mjs
var ph = {
	inView: { Feature: dh },
	tap: { Feature: rh },
	focus: { Feature: th },
	hover: { Feature: eh }
}, mh = { layout: {
	ProjectionNode: bp,
	MeasureLayout: Zm
} }, hh = /*@__PURE__*/ um({
	...mm,
	...ph,
	...Qm,
	...mh
}, dm), gh = class {
	constructor() {
		this.componentControls = /* @__PURE__ */ new Set();
	}
	subscribe(e) {
		return this.componentControls.add(e), () => this.componentControls.delete(e);
	}
	start(e, t) {
		this.componentControls.forEach((n) => {
			n.start(e.nativeEvent || e, t);
		});
	}
	cancel() {
		this.componentControls.forEach((e) => {
			e.cancel();
		});
	}
	stop() {
		this.componentControls.forEach((e) => {
			e.stop();
		});
	}
}, _h = () => new gh();
function vh() {
	return Ji(_h);
}
//#endregion
//#region node_modules/motion/dist/es/react.mjs
var yh = hh, bh = {
	sm: {
		col: 1,
		row: 1
	},
	wide: {
		col: 2,
		row: 1
	},
	tall: {
		col: 1,
		row: 2
	},
	lg: {
		col: 2,
		row: 2
	}
}, xh = {
	sm: "Small",
	wide: "Wide",
	tall: "Tall",
	lg: "Large"
}, Sh = [
	{
		id: "widget-1",
		size: "wide"
	},
	{
		id: "widget-2",
		size: "sm"
	},
	{
		id: "widget-3",
		size: "sm"
	},
	{
		id: "widget-4",
		size: "sm"
	},
	{
		id: "widget-5",
		size: "wide"
	},
	{
		id: "widget-6",
		size: "sm"
	},
	{
		id: "widget-7",
		size: "sm"
	},
	{
		id: "widget-8",
		size: "wide"
	},
	{
		id: "widget-9",
		size: "sm"
	}
], Ch = typeof window > "u" ? _.useEffect : _.useLayoutEffect;
function wh(e, t) {
	return e >= 2 && t >= 2 ? "lg" : e >= 2 ? "wide" : t >= 2 ? "tall" : "sm";
}
var Th = (e, t) => e.col < t.col + t.w && t.col < e.col + e.w && e.row < t.row + t.h && t.row < e.row + e.h, Eh = (e, t) => t.col >= e.col && t.row >= e.row && t.col + t.w <= e.col + e.w && t.row + t.h <= e.row + e.h;
function Dh(e, t) {
	return {
		w: Math.min(bh[e.size].col, t),
		h: bh[e.size].row
	};
}
function Oh(e, t) {
	return t < 1 || e.length === 0 ? [] : Ah(e, t) ?? jh(e, t);
}
var kh = 2e4;
function Ah(e, t) {
	let n = e.map((e) => Dh(e, t)), r = n.reduce((e, t) => e + t.w * t.h, 0), i = Math.ceil(r / t), a = Array(i * t).fill(!1), o = Array(e.length).fill(!1), s = [], c = kh, l = (e, n, r, o) => {
		if (o + e > t || r + n > i) return !1;
		for (let i = r; i < r + n; i++) for (let n = o; n < o + e; n++) if (a[i * t + n]) return !1;
		return !0;
	}, u = (e, n, r, i, o) => {
		for (let s = r; s < r + n; s++) for (let n = i; n < i + e; n++) a[s * t + n] = o;
	}, d = (r) => {
		if (r === e.length) return !0;
		if (--c < 0) return !1;
		let i = a.indexOf(!1);
		if (i < 0) return !1;
		let f = Math.floor(i / t), p = i % t, m = /* @__PURE__ */ new Set();
		for (let t = 0; t < e.length; t++) {
			if (o[t]) continue;
			let { w: i, h: a } = n[t], c = `${i}x${a}`;
			if (!m.has(c) && l(i, a, f, p)) {
				if (m.add(c), o[t] = !0, u(i, a, f, p, !0), s.push({
					id: e[t].id,
					col: p,
					row: f,
					w: i,
					h: a
				}), d(r + 1)) return !0;
				s.pop(), u(i, a, f, p, !1), o[t] = !1;
			}
		}
		return !1;
	};
	return d(0) ? s : null;
}
function jh(e, t) {
	let n = [], r = 0, i = e.map((e) => ({
		id: e.id,
		...Dh(e, t)
	}));
	for (; i.length > 0;) {
		let e = Math.max(...i.slice(0, t).map((e) => e.h)), a = Array(e * t).fill(!1), o = [], s = [];
		for (let n of i) {
			let r = -1;
			for (let i = 0; i < a.length && r < 0; i++) {
				let o = Math.floor(i / t), s = i % t;
				if (s + n.w > t || o + n.h > e) continue;
				let c = !0;
				for (let e = o; e < o + n.h && c; e++) for (let r = s; r < s + n.w && c; r++) a[e * t + r] && (c = !1);
				c && (r = i);
			}
			if (r < 0 || s.length > 0) {
				s.push(n);
				continue;
			}
			let i = Math.floor(r / t), c = r % t;
			for (let e = i; e < i + n.h; e++) for (let r = c; r < c + n.w; r++) a[e * t + r] = !0;
			o.push({
				id: n.id,
				col: c,
				row: i,
				w: n.w,
				h: n.h
			});
		}
		for (let e = 0; e < a.length; e++) {
			if (a[e]) continue;
			let n = Math.floor(e / t), r = e % t, i = o.find((e) => e.col + e.w === r && e.row <= n && e.row + e.h > n && e.h === 1), s = o.find((e) => e.row + e.h === n && e.col === r && e.w === 1), c = i ?? s;
			c && (c === i ? c.w += 1 : c.h += 1, a[e] = !0);
		}
		n.push(...o.map((e) => ({
			...e,
			row: e.row + r
		}))), r += e, i = s;
	}
	return n;
}
function Mh(e, t) {
	let n = Oh(e, t);
	if (n.length !== e.length) return e;
	let r = new Map(e.map((e) => [e.id, e])), i = [...n].sort((e, t) => e.row - t.row || e.col - t.col).map((e) => r.get(e.id));
	if (i.every((t, n) => t === e[n])) return e;
	let a = new Map(n.map((e) => [e.id, e]));
	return Oh(i, t).every((e) => {
		let t = a.get(e.id);
		return t && t.col === e.col && t.row === e.row && t.w === e.w && t.h === e.h;
	}) ? i : e;
}
function Nh(e, t, n) {
	let r = e.findIndex((e) => e.id === t);
	if (r < 0 || r === n || n < 0 || n >= e.length) return e;
	let i = [...e], [a] = i.splice(r, 1);
	return i.splice(n, 0, a), i;
}
var Ph = (e, t) => e.length === t.length && e.every((e, n) => e.id === t[n].id), Fh = .18;
function Ih(e, t, n, r) {
	let i = (e, t) => {
		let i = (e.right - e.left) * t, a = (e.bottom - e.top) * t, o = Math.max(e.left + i - n, 0, n - (e.right - i)), s = Math.max(e.top + a - r, 0, r - (e.bottom - a));
		return Math.hypot(o, s);
	}, a = (e) => Math.hypot((e.left + e.right) / 2 - n, (e.top + e.bottom) / 2 - r), o = i(e, 0);
	if (o === 0) return null;
	let s = null, c = Infinity;
	for (let { order: e, slot: n } of t) {
		let t = i(n, Fh), r = a(n);
		(t < o || t === o && s && r < c) && (o = t, c = r, s = e);
	}
	return s;
}
function Lh(e, t, n, r) {
	let i = Oh(e, n), a = i.find((e) => e.id === t);
	if (!a) return [];
	let o = new Map(e.map((e) => [e.id, e])), s = Math.max(...i.map((e) => e.row + e.h)), c = [];
	for (let e = 0; e + a.h <= s; e++) for (let s = 0; s + a.w <= n; s++) {
		let n = {
			col: s,
			row: e,
			w: a.w,
			h: a.h
		};
		if (Th(n, a)) continue;
		let l = i.filter((e) => Th(e, n));
		if (l.length < 2 || !l.every((e) => Eh(n, e))) continue;
		let u = i.map((n) => n.id === t ? {
			...n,
			col: s,
			row: e
		} : l.includes(n) ? {
			...n,
			col: n.col - s + a.col,
			row: n.row - e + a.row
		} : n);
		u.sort((e, t) => e.row - t.row || e.col - t.col), c.push({
			order: u.map((e) => o.get(e.id)),
			slot: r(n)
		});
	}
	let l = e.findIndex((e) => e.id === t);
	for (let i = 0; i < e.length; i++) {
		if (i === l) continue;
		let a = Nh(e, t, i), o = Oh(a, n).find((e) => e.id === t);
		o && c.push({
			order: a,
			slot: r(o)
		});
	}
	return c;
}
var Rh = {
	type: "spring",
	visualDuration: .38,
	bounce: .16
}, zh = {
	type: "spring",
	visualDuration: .26,
	bounce: .32
}, Bh = 1.06, Vh = 40, Hh = 620, Uh = 350, Wh = 8, Gh = "0px 1px 2px 0px rgba(0,0,0,0.12), 0px 0px 0px 0px rgba(0,0,0,0)", Kh = "0px 28px 60px -16px rgba(0,0,0,0.45), 0px 10px 24px -8px rgba(0,0,0,0.3)", qh = (0, _.memo)(function({ item: e, col: t, row: n, w: r, h: i, columns: a, rows: o, editable: s, held: c, raised: l, landed: u, handlers: d, hintId: f, position: p, count: m, renderItem: h, plainShell: g, shellClassName: v, jiggle: y, nudge: b }) {
	let x = vh(), S = (0, _.useRef)(null), C = (0, _.useRef)(null), w = (0, _.useRef)(!1), T = (0, _.useRef)(null), [E, D] = (0, _.useState)("idle"), ee = (0, _.useCallback)(() => {
		C.current && window.clearTimeout(C.current.timer), C.current = null, w.current = !1, T.current?.(), T.current = null, D("idle");
	}, []);
	(0, _.useEffect)(() => {
		let e = S.current;
		if (!e) return;
		let t = (e) => {
			w.current && e.preventDefault();
		};
		return e.addEventListener("touchmove", t, { passive: !1 }), () => {
			e.removeEventListener("touchmove", t), C.current && window.clearTimeout(C.current.timer), T.current?.();
		};
	}, []);
	let te = (e) => {
		if (!s || e.button !== 0 || !e.isPrimary) return;
		let t = e.target;
		if (!t.closest("[data-drag-handle]") || t.closest("button, a, input, textarea, select")) return;
		if (e.pointerType !== "touch") {
			x.start(e);
			return;
		}
		if (C.current || w.current) return;
		let n = e.nativeEvent, r = e.pointerId;
		D("holding"), C.current = {
			pointerId: r,
			x: e.clientX,
			y: e.clientY,
			timer: window.setTimeout(() => {
				C.current = null, w.current = !0, D("lifted"), navigator.vibrate?.(10), x.start(n);
				let e = (e) => {
					e.pointerId === r && (d.suppressClick(), ee());
				};
				window.addEventListener("pointerup", e), window.addEventListener("pointercancel", e), T.current = () => {
					window.removeEventListener("pointerup", e), window.removeEventListener("pointercancel", e);
				};
			}, Uh)
		};
	}, ne = (e) => {
		let t = C.current;
		t && e.pointerId === t.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) > Wh && ee();
	}, re = (e) => {
		C.current?.pointerId === e.pointerId && ee();
	}, ie = (t / Math.max(a, 1) + n / Math.max(o, 1)) * .26;
	return /* @__PURE__ */ (0, $.jsx)(yh.div, {
		ref: S,
		role: "listitem",
		"data-slot": "widget",
		"data-widget-id": e.id,
		tabIndex: s ? 0 : void 0,
		"aria-label": e.label ?? `${xh[e.size]} widget`,
		"aria-describedby": s ? f : void 0,
		"aria-posinset": p,
		"aria-setsize": m,
		layout: "position",
		drag: s,
		dragListener: !1,
		dragControls: x,
		dragSnapToOrigin: !0,
		dragMomentum: !1,
		onDragStart: () => d.start(e.id),
		onDrag: d.drag,
		onDragEnd: () => d.end(e.id),
		onPointerDown: te,
		onPointerMove: ne,
		onPointerUp: re,
		onPointerCancel: re,
		onContextMenu: (e) => {
			E !== "idle" && e.preventDefault();
		},
		onKeyDown: (t) => d.key(t, e.id),
		onClickCapture: (e) => {
			(d.swallow() || s && e.target.closest("a")) && (e.preventDefault(), e.stopPropagation());
		},
		animate: {
			scale: E === "holding" ? .97 : E === "lifted" ? Bh : 1,
			boxShadow: E === "lifted" ? Kh : Gh
		},
		whileDrag: {
			scale: Bh,
			boxShadow: Kh,
			transition: zh
		},
		transition: Rh,
		className: `relative min-w-0 rounded-[var(--widget-radius)] outline-none focus-visible:ring-2 focus-visible:ring-ring [&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none] ${s ? "touch-pan-y touch-pinch-zoom select-none [-webkit-touch-callout:none]" : ""}`,
		style: {
			gridColumn: `${t + 1} / span ${r}`,
			gridRow: `${n + 1} / span ${i}`,
			zIndex: c ? 20 : l ? 10 : 0
		},
		"data-held": c ? "1" : void 0,
		children: /* @__PURE__ */ (0, $.jsx)("div", {
			className: `h-full w-full ${y && !c && E === "idle" ? "apex-widget-jiggle" : ""} ${b && !c && E === "idle" ? "apex-widget-nudge" : ""}`,
			style: { "--jiggle-n": p },
			children: /* @__PURE__ */ (0, $.jsxs)(yh.div, {
				initial: {
					opacity: 0,
					y: 18,
					scale: .97
				},
				animate: {
					opacity: 1,
					y: 0,
					scale: 1
				},
				transition: {
					type: "spring",
					visualDuration: .6,
					bounce: .12,
					delay: ie
				},
				className: `relative isolate flex h-full w-full flex-col overflow-hidden rounded-[var(--widget-radius)] ring-inset transition-shadow duration-300 [clip-path:inset(0_round_var(--widget-radius))] ${g ? u ? "ring-2 ring-[#7CE3A2]/80" : "ring-0 shadow-none" : u ? "bg-card text-card-foreground ring-2 ring-emerald-400/80" : "bg-card text-card-foreground ring-2 ring-white/85 dark:ring-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"} ${v ?? ""}`,
				children: [s ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-drag-handle": "",
					className: "absolute inset-x-0 top-0 z-20 flex h-8 cursor-grab items-center justify-center rounded-t-[var(--widget-radius)] bg-[#121314]/6 hover:bg-[#121314]/12 active:cursor-grabbing dark:bg-white/8 dark:hover:bg-white/14",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, $.jsxs)("span", {
						className: "flex items-center gap-[3px]",
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, $.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, $.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, $.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, $.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, $.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, $.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" })
						]
					})
				}) : null, /* @__PURE__ */ (0, $.jsx)("div", {
					className: `flex h-full min-h-0 w-full flex-col ${s ? "pt-7" : ""}`,
					children: h?.(e, wh(r, i))
				})]
			})
		})
	});
});
function Jh({ items: e, onChange: t, renderItem: n, getShellClassName: r, plainShell: i = !1, fixedColumns: a, jiggle: o = !1, nudgeItemId: s = null, editable: c = !0, maxColumns: l = 4, cellSize: u = 215, gap: d = 12, radius: f = 24, className: p = "" }) {
	let [m, h] = (0, _.useState)(() => e ?? Sh), g = (0, _.useRef)(null), v = (0, _.useId)(), y = Math.min(2, Math.max(1, l)), b = typeof a == "number" && a > 0 ? Math.max(1, Math.floor(a)) : null, [x, S] = (0, _.useState)({
		unit: 0,
		columns: 0
	});
	Ch(() => {
		let e = g.current;
		if (!e) return;
		let t = () => {
			let t = e.getBoundingClientRect().width;
			if (t < 1) return;
			let n = b ?? Math.max(y, Math.min(l, Math.round(t / u))), r = (t - d * (n - 1)) / n;
			S((e) => e.columns === n && Math.abs(e.unit - r) < .5 ? e : {
				unit: r,
				columns: n
			});
		};
		t();
		let n = new ResizeObserver(t);
		return n.observe(e), () => n.disconnect();
	}, [
		l,
		y,
		u,
		d,
		b
	]);
	let C = x.columns || b || Math.max(y, l), w = (0, _.useMemo)(() => Oh(m, C), [m, C]), T = w.reduce((e, t) => Math.max(e, t.row + t.h), 0), E = (0, _.useRef)({
		items: m,
		metrics: x,
		onChange: t
	});
	E.current.metrics = x, E.current.onChange = t, Ch(() => {
		E.current.items = m;
	}, [m]);
	let D = (0, _.useCallback)((e) => {
		E.current.items = e, h(e);
	}, []), ee = (0, _.useCallback)((e) => {
		let t = g.current, { unit: n } = E.current.metrics, r = t?.getBoundingClientRect(), i = n + d, a = Math.round(n) + d, o = (r?.left ?? 0) + e.col * i, s = (r?.top ?? 0) + e.row * a;
		return {
			left: o,
			top: s,
			right: o + e.w * i - d,
			bottom: s + e.h * a - d
		};
	}, [d]), [te, ne] = (0, _.useState)(null), [re, ie] = (0, _.useState)(null), [ae, oe] = (0, _.useState)(null), se = (0, _.useRef)(null), ce = (0, _.useRef)(null), le = (0, _.useRef)(0), ue = (0, _.useRef)(0), de = (0, _.useRef)(0), fe = (0, _.useRef)(0), pe = (0, _.useRef)(null), me = (0, _.useCallback)((e = !1) => {
		le.current = 0;
		let t = se.current, { items: n, metrics: r } = E.current, i = t ? g.current?.querySelector(`[data-widget-id="${CSS.escape(t)}"]`) : null;
		if (!t || !i || !r.columns) return;
		let a = performance.now();
		if (!e && a - ue.current < Vh) {
			le.current = requestAnimationFrame(() => me());
			return;
		}
		let o = Oh(n, r.columns).find((e) => e.id === t);
		if (!o) return;
		let s = i.getBoundingClientRect(), c = Ih(ee(o), Lh(n, t, r.columns, ee), s.left + s.width / 2, s.top + s.height / 2);
		c && (ue.current = a, D(Mh(c, r.columns)));
	}, [ee, D]);
	(0, _.useEffect)(() => () => {
		cancelAnimationFrame(le.current), window.clearTimeout(fe.current);
	}, []), Ch(() => {
		let e = pe.current;
		e && (pe.current = null, (g.current?.querySelector(`[data-widget-id="${CSS.escape(e)}"]`))?.focus());
	}, [m]);
	let he = (0, _.useMemo)(() => ({
		start: (e) => {
			se.current = e, ce.current = E.current.items, ue.current = 0, ne(e), ie(e), window.addEventListener("pointerup", () => {
				de.current = performance.now() + 300;
			}, {
				once: !0,
				capture: !0
			});
		},
		drag: () => {
			le.current ||= requestAnimationFrame(() => me());
		},
		end: (e) => {
			cancelAnimationFrame(le.current), me(!0), le.current = 0, se.current = null, ne(null), oe(e), window.clearTimeout(fe.current), fe.current = window.setTimeout(() => {
				oe(null), ie(null);
			}, Hh);
			let t = ce.current;
			ce.current = null;
			let n = E.current.items;
			t && !Ph(t, n) && E.current.onChange?.(n);
		},
		key: (e, t) => {
			if (!c || !e.altKey || e.target.closest("input, textarea, select")) return;
			let n = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
			if (!n) return;
			e.preventDefault();
			let { items: r, metrics: i } = E.current, a = i.columns || l, o = r.findIndex((e) => e.id === t);
			for (let e = o + n; e >= 0 && e < r.length; e += n) {
				let n = Mh(Nh(r, t, e), a);
				if (!Ph(n, r)) {
					pe.current = t, D(n), E.current.onChange?.(n);
					return;
				}
			}
		},
		swallow: () => performance.now() < de.current,
		suppressClick: () => {
			de.current = performance.now() + 300;
		}
	}), [
		me,
		D,
		c,
		l
	]), ge = (0, _.useMemo)(() => new Map(m.map((e) => [e.id, e])), [m]), _e = (0, _.useRef)(m.map((e) => e.id));
	for (let e of m) _e.current.includes(e.id) || _e.current.push(e.id);
	let ve = new Map(w.map((e) => [e.id, e])), ye = new Map([...w].sort((e, t) => e.row - t.row || e.col - t.col).map((e, t) => [e.id, t]));
	return /* @__PURE__ */ (0, $.jsx)(kp, {
		reducedMotion: "user",
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			className: `relative w-full ${p}`,
			style: { "--widget-radius": `${f}px` },
			children: [c && /* @__PURE__ */ (0, $.jsx)("p", {
				id: v,
				className: "sr-only",
				children: "Drag from the dotted handle at the top of a tile to rearrange. On touch screens, press and hold the handle first. With a keyboard, hold Alt and press the arrow keys. Use Arrange for jiggle mode."
			}), /* @__PURE__ */ (0, $.jsx)("div", {
				ref: g,
				role: "list",
				"data-slot": "widget-grid",
				"data-arranging": c ? "1" : "0",
				className: "grid w-full",
				style: {
					gap: d,
					gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))`,
					gridAutoRows: x.unit ? `${Math.round(x.unit)}px` : `minmax(${u * .75}px, auto)`
				},
				children: _e.current.map((e) => {
					let t = ge.get(e), a = ve.get(e);
					return !t || !a ? null : /* @__PURE__ */ (0, $.jsx)(qh, {
						position: (ye.get(e) ?? 0) + 1,
						count: w.length,
						item: t,
						col: a.col,
						row: a.row,
						w: a.w,
						h: a.h,
						columns: C,
						rows: T,
						editable: c,
						held: te === a.id,
						raised: re === a.id,
						landed: ae === a.id,
						handlers: he,
						hintId: v,
						renderItem: n,
						plainShell: i,
						shellClassName: r?.(t),
						jiggle: o,
						nudge: s === e
					}, e);
				})
			})]
		})
	});
}
//#endregion
//#region app/apex/demo-widgets.tsx
function Yh(e, t, n, r, i, a, o = "sm") {
	return {
		id: e,
		kind: "module-switch",
		size: o,
		label: t,
		rack: n,
		enabled: r,
		icon: i,
		detail: a
	};
}
var Xh = Yh("attendance", "Clock-in", "core", !0, "mdi:clock-check-outline", "Clock-in and regularizations."), Zh = Yh("leaves", "Leaves", "core", !0, "mdi:calendar-remove-outline", "Policies and balances."), Qh = Yh("rollcall", "Roll call", "campus", !0, "mdi:account-check-outline", "Section presence, live."), $h = Yh("timetable", "Timetable", "campus", !0, "mdi:calendar-clock", "Slots, cover, instances."), eg = Yh("overtime", "Overtime", "add-on", !1, "mdi:timer-plus-outline", "Bolt on when needed."), tg = Yh("face", "Face capture", "add-on", !1, "mdi:face-recognition", "Biometrics when ready."), ng = Yh("library", "Library", "campus", !1, "mdi:bookshelf", "Catalog and loans."), rg = Yh("transport", "Transport", "campus", !1, "mdi:bus-school", "Routes for guardians."), ig = Yh("iris", "Iris scan", "add-on", !0, "mdi:eye-outline", "High-assurance capture."), ag = Yh("exams", "Examinations", "campus", !0, "mdi:file-document-edit-outline", "Papers, marks, cards."), og = Yh("payroll", "Payroll", "core", !1, "mdi:cash-multiple", "Pay runs when you switch on."), sg = Yh("parent", "Parent portal", "campus", !0, "mdi:account-child-outline", "Guardians actually sign in."), cg = Yh("reports", "Report cards", "campus", !0, "mdi:card-account-details-outline", "Publish when marks lock; parents see only what you release.", "wide"), lg = {
	id: "features-header",
	kind: "features-header",
	size: "wide",
	label: "Admin Features",
	shell: Wi
}, ug = {
	id: "marketing-cta",
	kind: "marketing-cta",
	size: "wide",
	label: "Need it later?",
	detail: "Just turn it on.",
	icon: "mdi:toggle-switch",
	shell: Wi
}, dg = {
	bg: "#D8D8DC",
	tone: "light"
};
function fg(e) {
	switch (e) {
		case "core": return {
			bg: M.blueSoft,
			tone: "light"
		};
		case "campus": return {
			bg: M.gold,
			tone: "light"
		};
		case "add-on": return {
			bg: M.coral,
			tone: "light"
		};
		default: return e;
	}
}
var pg = [
	lg,
	{
		...Xh,
		shell: fg("core")
	},
	{
		...Qh,
		shell: fg("campus")
	},
	{
		...Zh,
		shell: fg("core")
	},
	{
		...eg,
		shell: dg
	},
	{
		...tg,
		shell: dg
	},
	ug
], mg = [
	lg,
	{
		...Xh,
		shell: fg("core")
	},
	{
		...Zh,
		shell: fg("core")
	},
	{
		...Qh,
		shell: fg("campus")
	},
	{
		...$h,
		shell: fg("campus")
	},
	{
		...eg,
		shell: dg
	},
	{
		...tg,
		shell: dg
	},
	{
		...ng,
		shell: dg
	},
	{
		...rg,
		shell: dg
	},
	ug
], hg = [
	{
		id: "campus-header",
		kind: "features-header",
		size: "wide",
		label: "Campus rack",
		detail: "BlokSchool modules on the same spine.",
		shell: Wi
	},
	{
		...Qh,
		shell: fg("campus")
	},
	{
		...$h,
		shell: fg("campus")
	},
	{
		...ag,
		shell: fg("campus")
	},
	{
		...sg,
		shell: fg("campus")
	},
	{
		...ig,
		shell: fg("add-on")
	},
	{
		...ng,
		shell: dg
	},
	{
		...rg,
		shell: dg
	},
	{
		...cg,
		size: "sm",
		detail: "Publish when marks lock.",
		shell: fg("campus")
	},
	ug
], gg = [
	{
		id: "workforce-header",
		kind: "features-header",
		size: "wide",
		label: "Workforce rack",
		detail: "BlokHR modules you grow into.",
		shell: Wi
	},
	{
		...Xh,
		shell: fg("core")
	},
	{
		...Zh,
		shell: fg("core")
	},
	{
		...ig,
		shell: fg("add-on")
	},
	{
		...eg,
		shell: dg
	},
	{
		...tg,
		shell: dg
	},
	{
		...og,
		shell: dg
	},
	ug
], _g = [
	{
		id: "setup-header",
		kind: "features-header",
		size: "wide",
		label: "Setup",
		detail: "Four steps, then you are inside.",
		shell: Wi
	},
	...Li.map((e, t) => ({
		id: `setup-${e.n}`,
		kind: "setup-step",
		size: "sm",
		label: e.title,
		stepN: e.n,
		detail: e.body,
		icon: t === 0 ? "mdi:shape-outline" : t === 1 ? "mdi:palette-outline" : t === 2 ? "mdi:shield-key-outline" : "mdi:ticket-confirmation-outline",
		shell: [
			{
				bg: M.gold,
				tone: "light"
			},
			{
				bg: M.blueSoft,
				tone: "light"
			},
			{
				bg: M.coral,
				tone: "light"
			},
			{
				bg: M.charcoal,
				tone: "dark"
			}
		][t]
	})),
	{
		id: "setup-meta",
		kind: "overview-stat",
		size: "sm",
		label: "Locked",
		detail: "Permanent where it must be",
		icon: "mdi:lock-outline",
		shell: {
			bg: M.midGray,
			tone: "dark"
		}
	},
	ug
], vg = [
	{
		id: "access-header",
		kind: "features-header",
		size: "wide",
		label: Ri.title,
		detail: Ri.lead,
		shell: Wi
	},
	...Ri.layers.map((e, t) => ({
		id: `layer-${e.n}`,
		kind: "access-layer",
		size: "sm",
		label: e.title,
		stepN: e.n,
		detail: e.body,
		icon: "mdi:shield-check-outline",
		shell: [
			{
				bg: M.gold,
				tone: "light"
			},
			{
				bg: M.blueSoft,
				tone: "light"
			},
			{
				bg: M.coral,
				tone: "light"
			},
			{
				bg: M.charcoal,
				tone: "dark"
			},
			{
				bg: M.midGray,
				tone: "dark"
			},
			{
				bg: M.darkFace,
				tone: "dark"
			}
		][t]
	})),
	{
		id: "role-teacher",
		kind: "access-role",
		size: "sm",
		label: "teacher",
		detail: "Sees her sections only",
		icon: "mdi:account-badge-outline",
		shell: {
			bg: M.gold,
			tone: "light"
		}
	},
	{
		id: "role-admin",
		kind: "access-role",
		size: "sm",
		label: "admin",
		detail: "Tenant-wide with audit",
		icon: "mdi:account-badge-outline",
		shell: {
			bg: M.blueSoft,
			tone: "light"
		}
	},
	ug
], yg = [
	{
		id: "pricing-header",
		kind: "features-header",
		size: "wide",
		label: "Commercial",
		detail: "Trial first. Licence when your team is ready.",
		shell: Wi
	},
	{
		id: "pricing-trial",
		kind: "pricing-card",
		size: "sm",
		label: "Start a trial",
		detail: "No card required from setup step four.",
		icon: "mdi:rocket-launch-outline",
		shell: Wi
	},
	{
		id: "pricing-licence",
		kind: "pricing-card",
		size: "sm",
		label: "Paste a licence",
		detail: "Token issued per tenant by your commercial team.",
		icon: "mdi:key-variant",
		shell: {
			bg: M.blueSoft,
			tone: "light"
		}
	},
	{
		id: "pricing-plan-step",
		kind: "setup-step",
		size: "sm",
		label: "Plan",
		stepN: "04",
		detail: "Trial or licence, your choice in setup.",
		icon: "mdi:ticket-confirmation-outline",
		shell: {
			bg: M.gold,
			tone: "light"
		}
	},
	{
		id: "pricing-tenant",
		kind: "overview-stat",
		size: "sm",
		label: "1",
		detail: "tenant boundary per workspace",
		icon: "mdi:office-building-outline",
		shell: {
			bg: M.coral,
			tone: "light"
		}
	},
	{
		id: "pricing-entitlements",
		kind: "overview-stat",
		size: "sm",
		label: "Scoped",
		detail: "Entitlements stay per tenant",
		icon: "mdi:shield-check-outline",
		shell: {
			bg: M.charcoal,
			tone: "dark"
		}
	},
	ug
];
function bg(e, t) {
	if (e.kind === "module-switch") {
		if (!(t ?? !!e.enabled)) return dg;
		if (e.rack) return fg(e.rack);
	}
	return e.shell ?? Ui(e.id);
}
function xg(e) {
	return e === "dark" ? {
		muted: "text-white/90",
		label: "text-white",
		title: "text-white",
		titleOff: "text-white/70",
		accent: M.mint,
		chipOn: "bg-white/15 text-white",
		chipOff: "bg-white/10 text-white/75",
		border: "border border-white/25"
	} : {
		muted: "text-[#121314]/90",
		label: "text-[#121314]",
		title: "text-[#121314]",
		titleOff: "text-[#121314]/75",
		accent: "#121314",
		chipOn: "bg-[#121314]/18 text-[#121314]",
		chipOff: "bg-[#121314]/10 text-[#121314]/80",
		border: "border border-[#121314]/12"
	};
}
function Sg({ on: e }) {
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"aria-hidden": "true",
		className: "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
		style: { background: e ? M.mint : M.charcoal },
		children: /* @__PURE__ */ (0, $.jsx)("span", { className: `absolute size-3.5 rounded-full bg-[#121314] shadow transition-transform ${e ? "translate-x-[18px]" : "translate-x-[3px]"}` })
	});
}
function Cg({ title: e, detail: t, shell: n, onCount: r }) {
	let i = xg(n.tone);
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		className: `flex h-full flex-col gap-3 p-4 sm:p-5 ${i.border}`,
		style: { background: n.bg },
		children: [
			/* @__PURE__ */ (0, $.jsxs)("header", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, $.jsxs)("h3", {
					className: `flex items-center gap-2 text-[12px] font-bold tracking-[0.1em] uppercase ${i.label}`,
					children: [/* @__PURE__ */ (0, $.jsx)(Ai, {
						icon: "mdi:toggle-switch",
						className: "size-3.5",
						style: { color: M.mint }
					}), e]
				}), typeof r == "number" ? /* @__PURE__ */ (0, $.jsxs)("span", {
					className: "flex items-center gap-1.5 text-[13px] font-bold tabular-nums",
					style: { color: M.mint },
					children: [
						/* @__PURE__ */ (0, $.jsxs)("span", {
							className: "relative inline-flex size-2",
							children: [/* @__PURE__ */ (0, $.jsx)("span", {
								className: "absolute inset-0 animate-ping rounded-full motion-reduce:hidden",
								style: { background: `${M.mint}80` }
							}), /* @__PURE__ */ (0, $.jsx)("span", {
								className: "relative size-2 rounded-full",
								style: { background: M.mint }
							})]
						}),
						r,
						" on"
					]
				}) : null]
			}),
			/* @__PURE__ */ (0, $.jsx)("p", {
				className: `text-[13px] leading-relaxed ${i.muted}`,
				children: t ?? "Off means gone from the sidebar and 404 from its own API. On means back on the next load."
			}),
			/* @__PURE__ */ (0, $.jsxs)("p", {
				className: `mt-auto text-[12px] ${i.muted}`,
				children: [50, " modules in the rack · drag any tile"]
			})
		]
	});
}
function wg({ rack: e, label: t, detail: n, icon: r, enabled: i, shell: a, onToggle: o }) {
	let s = xg(a.tone);
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		className: `flex h-full flex-col gap-2 p-3.5 sm:p-4 ${s.border} ${i ? "" : "grayscale-[0.35]"}`,
		style: { background: a.bg },
		children: [/* @__PURE__ */ (0, $.jsxs)("header", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, $.jsx)("span", {
				className: `text-[11px] font-bold tracking-[0.1em] uppercase ${s.label}`,
				children: e
			}), o ? /* @__PURE__ */ (0, $.jsx)("button", {
				type: "button",
				onClick: (e) => {
					e.stopPropagation(), o();
				},
				className: "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg",
				"aria-pressed": i,
				"aria-label": `${t} ${i ? "on" : "off"}`,
				children: /* @__PURE__ */ (0, $.jsx)(Sg, { on: i })
			}) : /* @__PURE__ */ (0, $.jsx)(Sg, { on: i })]
		}), /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "mt-auto flex items-end justify-between gap-2",
			children: [/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, $.jsx)("p", {
					className: `truncate text-[18px] font-bold tracking-tight ${i ? s.title : s.titleOff}`,
					children: t
				}), i ? /* @__PURE__ */ (0, $.jsx)("p", {
					className: `mt-1 line-clamp-2 text-[12px] leading-snug ${s.muted}`,
					children: n
				}) : /* @__PURE__ */ (0, $.jsxs)("div", {
					className: "mt-1 flex flex-col gap-1.5",
					children: [/* @__PURE__ */ (0, $.jsx)("p", {
						className: `text-[12px] font-bold uppercase tracking-wide ${s.muted}`,
						children: "off"
					}), o ? /* @__PURE__ */ (0, $.jsx)("button", {
						type: "button",
						onClick: (e) => {
							e.stopPropagation(), o();
						},
						className: "inline-flex min-h-11 w-fit items-center rounded-lg text-[12px] font-bold",
						style: { color: "#0A7A3E" },
						children: "Turn on"
					}) : null]
				})]
			}), /* @__PURE__ */ (0, $.jsx)("span", {
				className: `inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${i ? s.chipOn : s.chipOff}`,
				children: /* @__PURE__ */ (0, $.jsx)(Ai, {
					icon: r,
					className: "size-4"
				})
			})]
		})]
	});
}
function Tg({ shell: e, eyebrow: t, title: n, detail: r, icon: i }) {
	let a = xg(e.tone);
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		className: `flex h-full flex-col gap-2 p-3.5 sm:p-4 ${a.border}`,
		style: { background: e.bg },
		children: [t ? /* @__PURE__ */ (0, $.jsx)("p", {
			className: `text-[11px] font-bold tracking-[0.1em] uppercase ${a.label}`,
			children: t
		}) : null, /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "mt-auto flex items-end justify-between gap-2",
			children: [/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, $.jsx)("p", {
					className: `truncate text-[18px] font-bold tracking-tight ${a.title}`,
					children: n
				}), r ? /* @__PURE__ */ (0, $.jsx)("p", {
					className: `mt-1 line-clamp-3 text-[12px] leading-snug ${a.muted}`,
					children: r
				}) : null]
			}), i ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: `inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${a.chipOn}`,
				children: /* @__PURE__ */ (0, $.jsx)(Ai, {
					icon: i,
					className: "size-4"
				})
			}) : null]
		})]
	});
}
function Eg({ title: e, detail: t, icon: n, shell: r }) {
	let i = xg(r.tone);
	return /* @__PURE__ */ (0, $.jsx)("section", {
		className: `flex h-full flex-col gap-2 p-3.5 sm:p-4 ${i.border}`,
		style: { background: r.bg },
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "mt-auto flex items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, $.jsx)("p", {
					className: `text-[20px] font-extrabold leading-tight tracking-tight sm:text-[22px] ${i.title}`,
					children: e
				}), t ? /* @__PURE__ */ (0, $.jsx)("p", {
					className: `mt-1 text-[17px] font-bold leading-snug sm:text-[18px] ${i.title}`,
					children: t
				}) : null]
			}), n ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: `inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${i.chipOn}`,
				children: /* @__PURE__ */ (0, $.jsx)(Ai, {
					icon: n,
					className: "size-5"
				})
			}) : null]
		})
	});
}
function Dg(e, t, n, r) {
	let i = e.kind === "module-switch" ? n[e.id] ?? !!e.enabled : !!e.enabled, a = bg(e, i);
	switch (e.kind) {
		case "features-header": return /* @__PURE__ */ (0, $.jsx)(Cg, {
			title: e.label ?? "Admin › Features",
			detail: e.detail,
			shell: a,
			onCount: e.id === "features-header" ? t : void 0
		});
		case "module-switch": return /* @__PURE__ */ (0, $.jsx)(wg, {
			rack: e.rack ?? "core",
			label: e.label ?? e.id,
			detail: e.detail ?? "",
			icon: e.icon ?? "mdi:puzzle-outline",
			enabled: i,
			shell: a,
			onToggle: () => r(e.id)
		});
		case "setup-step": return /* @__PURE__ */ (0, $.jsx)(Tg, {
			shell: a,
			eyebrow: e.stepN,
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "access-layer": return /* @__PURE__ */ (0, $.jsx)(Tg, {
			shell: a,
			eyebrow: `Layer ${e.stepN}`,
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "access-role": return /* @__PURE__ */ (0, $.jsx)(Tg, {
			shell: a,
			eyebrow: "Role",
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "pricing-card": return /* @__PURE__ */ (0, $.jsx)(Tg, {
			shell: a,
			eyebrow: "Commercial",
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "overview-stat": return /* @__PURE__ */ (0, $.jsx)(Tg, {
			shell: a,
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "marketing-cta": return /* @__PURE__ */ (0, $.jsx)(Eg, {
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon,
			shell: a
		});
		default: return e.kind;
	}
}
var Og = "blokhr_apex_board_nudge_v1", kg = "blokhr_apex_board_demo_flip_v1";
function Ag({ items: e, maxColumns: t = 4, fixedColumns: n, cellSize: r = 180, gap: i = 12, radius: a = M.radiusPx, className: o = "", title: s = "13blok module board", stripLabel: c = "Adding a feature takes one click, not a project" }) {
	let [l, u] = (0, _.useState)(!0), [d, f] = (0, _.useState)(!1), [p, m] = (0, _.useState)(null), [h, g] = (0, _.useState)(() => {
		let t = {};
		for (let n of e) n.kind === "module-switch" && (t[n.id] = !!n.enabled);
		return t;
	}), v = (0, _.useMemo)(() => e.filter((e) => e.kind === "module-switch"), [e]), y = (0, _.useMemo)(() => v.filter((e) => e.enabled).length, [v]), b = 13 + ((0, _.useMemo)(() => v.filter((e) => h[e.id]).length, [v, h]) - y), x = (0, _.useMemo)(() => new Map(e.map((e) => [e.id, e])), [e]), S = (e) => {
		g((t) => ({
			...t,
			[e]: !t[e]
		}));
	};
	return (0, _.useEffect)(() => {
		window.matchMedia("(prefers-reduced-motion: reduce)").matches && u(!1);
	}, []), (0, _.useEffect)(() => {
		if (!l || d) return;
		try {
			if (sessionStorage.getItem(Og)) return;
		} catch {
			return;
		}
		let t = e.find((e) => e.size === "sm")?.id ?? e[1]?.id ?? e[0]?.id ?? null;
		if (!t) return;
		let n = window.setTimeout(() => {
			m(t);
			try {
				sessionStorage.setItem(Og, "1");
			} catch {}
		}, 700), r = window.setTimeout(() => m(null), 1800);
		return () => {
			window.clearTimeout(n), window.clearTimeout(r);
		};
	}, [
		e,
		l,
		d
	]), (0, _.useEffect)(() => {
		d && m(null);
	}, [d]), (0, _.useEffect)(() => {
		if (!l) return;
		try {
			if (sessionStorage.getItem(kg)) return;
		} catch {
			return;
		}
		let e = v.find((e) => !(h[e.id] ?? e.enabled))?.id;
		if (!e) return;
		let t = window.setTimeout(() => {
			g((t) => t[e] ? t : {
				...t,
				[e]: !0
			});
			try {
				sessionStorage.setItem(kg, "1");
			} catch {}
		}, 2200);
		return () => window.clearTimeout(t);
	}, [l, v]), /* @__PURE__ */ (0, $.jsxs)("section", {
		"aria-labelledby": "blok-module-board-title",
		className: o,
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "mb-3 flex min-h-11 items-center gap-2 rounded-[14px] border border-[#121314]/12 px-3 py-1.5",
			style: { borderRadius: M.radiusPx },
			children: [
				/* @__PURE__ */ (0, $.jsx)("h2", {
					id: "blok-module-board-title",
					className: "sr-only",
					children: s
				}),
				/* @__PURE__ */ (0, $.jsx)("p", {
					className: "min-w-0 flex-1 text-[13px] font-bold leading-snug tracking-[-0.01em] text-foreground sm:text-[14px]",
					style: { fontFamily: "var(--font-display), \"Space Grotesk\", system-ui, sans-serif" },
					children: c
				}),
				/* @__PURE__ */ (0, $.jsxs)("button", {
					type: "button",
					onClick: () => f((e) => !e),
					"aria-pressed": d,
					className: `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[14px] border px-3 text-[12px] font-bold tracking-wide transition-colors ${d ? "border-[#121314] bg-[#121314] text-white dark:border-white dark:bg-white dark:text-[#121314]" : "border-[#121314]/12 text-[#121314] hover:bg-[#121314]/5 dark:border-white/25 dark:text-white"}`,
					children: [/* @__PURE__ */ (0, $.jsx)(Ai, {
						icon: d ? "mdi:check" : "mdi:cursor-move",
						className: "size-3.5",
						"aria-hidden": !0
					}), d ? "Done" : "Arrange"]
				})
			]
		}), /* @__PURE__ */ (0, $.jsx)("div", {
			"data-live": l ? "1" : "0",
			children: /* @__PURE__ */ (0, $.jsx)(Jh, {
				items: e,
				plainShell: !0,
				editable: !0,
				jiggle: d && l,
				nudgeItemId: p,
				renderItem: (e) => {
					let t = x.get(e.id);
					return t ? Dg(t, b, h, S) : null;
				},
				maxColumns: t,
				fixedColumns: n,
				cellSize: r,
				gap: i,
				radius: a
			}, e.map((e) => e.id).join("|"))
		})]
	});
}
//#endregion
//#region lib/tenants-api.ts
async function jg(e, t) {
	let n = String(t || "").trim().toLowerCase();
	if (!n) return {
		state: "idle",
		slug: ""
	};
	if (n.length < 3) return {
		state: "invalid",
		slug: n,
		message: "Use at least 3 characters"
	};
	let r = await e.get("/api/tenants/check/" + encodeURIComponent(n));
	return !r || r._error ? r && (r.status === 400 || r.error === "invalid_slug" || r.message === "invalid_slug") ? {
		state: "invalid",
		slug: n,
		message: "Invalid workspace name"
	} : {
		state: "error",
		slug: n,
		message: typeof r?.message == "string" && r.message || typeof r?.error == "string" && r.error || "Could not check availability"
	} : r.status === "available" ? {
		state: "available",
		slug: String(r.slug || n)
	} : r.status === "incomplete" ? {
		state: "incomplete",
		slug: String(r.slug || n)
	} : r.status === "taken" ? {
		state: "taken",
		slug: String(r.slug || n)
	} : {
		state: "invalid",
		slug: n,
		message: "Invalid workspace name"
	};
}
function Mg(e, t, n) {
	let r = String(t || "").trim();
	if (!r) return {
		url: null,
		message: "Workspace routing is not configured"
	};
	let i = String(e || "").trim().toLowerCase();
	return i ? n === "available" ? {
		url: null,
		message: "No workspace with that name"
	} : n === "taken" || n === "incomplete" ? {
		url: "https://" + i + "." + r + "/",
		message: null
	} : n === "invalid" ? {
		url: null,
		message: "Invalid workspace name"
	} : {
		url: null,
		message: "Could not find that workspace"
	} : {
		url: null,
		message: "Enter your workspace name"
	};
}
async function Ng(e, t) {
	let n = String(t || "").trim().toLowerCase();
	if (!n) return {
		ok: !1,
		error: "invalid_slug",
		message: "Enter a workspace name"
	};
	let r = await e.post("/api/tenants", { slug: n });
	return r && !r._error && r.workspaceUrl ? {
		ok: !0,
		workspaceUrl: String(r.workspaceUrl)
	} : r && (r.error === "slug_taken" || r.status === 409 || r.message === "slug_taken") ? {
		ok: !1,
		error: "slug_taken",
		message: "That workspace URL is already taken"
	} : {
		ok: !1,
		error: typeof r?.error == "string" && r.error || "claim_failed",
		message: typeof r?.message == "string" && r.message || typeof r?.error == "string" && r.error || "Could not create workspace"
	};
}
function Pg() {
	return {
		async get(e) {
			try {
				let t = await fetch(e, { credentials: "include" }), n = await t.json().catch(() => ({}));
				return t.ok ? n : {
					...n,
					_error: !0,
					status: t.status
				};
			} catch (e) {
				return {
					_error: !0,
					message: e instanceof Error ? e.message : "Network error"
				};
			}
		},
		async post(e, t) {
			try {
				let n = await fetch(e, {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(t)
				}), r = await n.json().catch(() => ({}));
				return n.ok ? r : {
					...r,
					_error: !0,
					status: n.status
				};
			} catch (e) {
				return {
					_error: !0,
					message: e instanceof Error ? e.message : "Network error"
				};
			}
		}
	};
}
//#endregion
//#region app/apex/signup-panel.tsx
var Fg = 350;
function Ig({ status: e, mode: t, open: n, onClose: r, api: i, navigate: a }) {
	let o = (0, _.useMemo)(() => i ?? Pg(), [i]), s = a ?? ((e) => {
		window.location.href = e;
	}), c = e.subdomainBase ? String(e.subdomainBase).trim() : "", [l, u] = (0, _.useState)(""), [d, f] = (0, _.useState)("idle"), [p, m] = (0, _.useState)(""), [h, g] = (0, _.useState)(""), [v, y] = (0, _.useState)(!1), [b, x] = (0, _.useState)(!0), [S, C] = (0, _.useState)(!1), w = (0, _.useCallback)(async () => {
		let e = l.trim().toLowerCase();
		if (!e) {
			f("idle"), m(""), g(""), y(!1), x(!0);
			return;
		}
		f("checking"), g("Checking…"), y(!1), m(""), x(!0);
		let n = await jg(o, e);
		if (f(n.state), t === "create") {
			if (n.state === "available") {
				g(c ? `Available — ${n.slug}.${c}` : "Available"), y(!0), x(!1);
				return;
			}
			if (n.state === "incomplete") {
				g("Workspace exists but setup is unfinished — continue there"), y(!1), x(!1);
				return;
			}
			if (n.state === "taken") {
				m("That workspace URL is already taken"), g("");
				return;
			}
			if (n.state === "invalid" || n.state === "error") {
				m(n.message || "Invalid workspace name"), g("");
				return;
			}
			return;
		}
		if (n.state === "available") {
			m("No workspace with that name"), g("");
			return;
		}
		if (n.state === "taken" || n.state === "incomplete") {
			g(n.state === "incomplete" ? "Workspace found — continue setup" : "Workspace found"), y(!0), x(!1);
			return;
		}
		(n.state === "invalid" || n.state === "error") && (m(n.message || "Invalid workspace name"), g(""));
	}, [
		o,
		t,
		l,
		c
	]);
	(0, _.useEffect)(() => {
		if (!n) return;
		let e = window.setTimeout(w, Fg);
		return () => window.clearTimeout(e);
	}, [
		n,
		l,
		t,
		w
	]), (0, _.useEffect)(() => {
		n && (m(""), g(""), x(!0));
	}, [n, t]);
	async function T() {
		let e = l.trim().toLowerCase();
		if (!e || b || S) return;
		if (t === "login") {
			let t = Mg(e, c, d);
			if (t.url) {
				s(t.url);
				return;
			}
			m(t.message || "Could not find that workspace");
			return;
		}
		C(!0), x(!0);
		let n = await Ng(o, e);
		if (n.ok && n.workspaceUrl) {
			s(n.workspaceUrl);
			return;
		}
		if (n.error === "slug_taken") {
			m(n.message || "That workspace URL is already taken"), g(""), f("taken"), C(!1), x(!1);
			return;
		}
		m(n.message || "Could not create workspace"), C(!1), x(!1);
	}
	return n ? /* @__PURE__ */ (0, $.jsx)("div", {
		className: "fixed inset-0 z-40 flex items-end justify-center bg-background/70 p-5 md:items-center",
		onClick: (e) => {
			e.target === e.currentTarget && r();
		},
		role: "presentation",
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "apex-panel-title",
			className: "relative w-full max-w-[420px] rounded-xl border border-border bg-card p-7 text-card-foreground shadow-2xl",
			children: [
				/* @__PURE__ */ (0, $.jsx)("button", {
					type: "button",
					className: "absolute top-3 right-3 rounded-md px-2 text-2xl leading-none text-muted-foreground hover:text-foreground",
					"aria-label": "Close",
					onClick: r,
					children: "×"
				}),
				/* @__PURE__ */ (0, $.jsx)("h2", {
					id: "apex-panel-title",
					className: "mb-2 text-[22px] font-extrabold tracking-tight",
					children: t === "login" ? "Log in to your workspace" : "Create workspace"
				}),
				/* @__PURE__ */ (0, $.jsx)("p", {
					className: "mb-5 text-sm leading-relaxed text-muted-foreground",
					children: t === "login" ? "Enter your workspace name. We will send you to its sign-in page." : "Pick a unique subdomain. Your team will use it for setup and sign-in."
				}),
				/* @__PURE__ */ (0, $.jsxs)("label", {
					className: "mb-2 block",
					children: [/* @__PURE__ */ (0, $.jsx)("span", {
						className: "mb-2 block text-xs font-semibold text-muted-foreground",
						children: "Workspace name"
					}), /* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, $.jsx)("input", {
							className: "min-w-[140px] flex-1 rounded-md border border-input bg-background px-3.5 py-3 text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
							value: l,
							onChange: (e) => u(e.target.value),
							onKeyDown: (e) => {
								e.key === "Enter" && T();
							},
							autoComplete: "off",
							spellCheck: !1,
							placeholder: "acme",
							autoFocus: !0
						}), /* @__PURE__ */ (0, $.jsx)("span", {
							className: "font-mono text-[13px] text-muted-foreground",
							children: c ? `.${c}` : ""
						})]
					})]
				}),
				p ? /* @__PURE__ */ (0, $.jsx)("div", {
					className: "mt-2 text-[13px] text-rose-600 dark:text-rose-400",
					children: p
				}) : null,
				h ? /* @__PURE__ */ (0, $.jsx)("div", {
					className: `mt-2 min-h-[1.2em] font-mono text-xs ${v ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`,
					children: h
				}) : null,
				/* @__PURE__ */ (0, $.jsx)("button", {
					type: "button",
					disabled: b || S,
					onClick: () => void T(),
					className: "mt-5 block w-full rounded-xl bg-primary px-5 py-4 text-center text-[15px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45",
					children: t === "login" ? "Continue to sign-in" : "Continue"
				})
			]
		})
	}) : null;
}
//#endregion
//#region app/apex/theme-provider.tsx
var Lg = (0, _.createContext)(null), Rg = "blokhr_apex_theme";
function zg() {
	try {
		let e = localStorage.getItem(Rg);
		if (e === "light" || e === "dark") return e;
	} catch {}
	return null;
}
function Bg() {
	return typeof document > "u" ? !1 : !!document.getElementById("root") && !document.getElementById("screenLanding");
}
function Vg(e) {
	if (!Bg()) return;
	let t = document.documentElement;
	t.classList.toggle("dark", e === "dark"), t.dataset.theme = e, t.style.backgroundColor = e === "dark" ? "#0a0b0d" : "#fbfaff", t.style.colorScheme = e;
}
function Hg({ children: e }) {
	let [t, n] = (0, _.useState)(() => zg() ?? "light");
	(0, _.useEffect)(() => {
		Vg(t);
		try {
			localStorage.setItem(Rg, t);
		} catch {}
	}, [t]);
	let r = (0, _.useCallback)((e) => {
		n(e);
	}, []), i = (0, _.useCallback)(() => {
		n((e) => e === "dark" ? "light" : "dark");
	}, []), a = (0, _.useMemo)(() => ({
		theme: t,
		setTheme: r,
		toggleTheme: i
	}), [
		t,
		r,
		i
	]);
	return /* @__PURE__ */ (0, $.jsx)(Lg.Provider, {
		value: a,
		children: /* @__PURE__ */ (0, $.jsx)("div", {
			className: `apex-root min-h-screen${t === "dark" ? " dark" : ""}`,
			"data-theme": t,
			children: e
		})
	});
}
function Ug() {
	let e = (0, _.useContext)(Lg);
	if (!e) throw Error("useTheme must be used within ThemeProvider");
	return e;
}
//#endregion
//#region app/apex/shell.tsx
var Wg = (0, _.createContext)(null);
function Gg() {
	let e = (0, _.useContext)(Wg);
	if (!e) throw Error("useApex must be used within ApexShell");
	return e;
}
function Kg({ status: e, api: t, navigate: n, children: r }) {
	let { theme: i, toggleTheme: a } = Ug(), [o, s] = (0, _.useState)(!1), [c, l] = (0, _.useState)("create"), u = (0, _.useCallback)((e) => {
		l(e), s(!0);
	}, []), d = (0, _.useMemo)(() => ({
		openSignup: u,
		status: e,
		api: t,
		navigate: n
	}), [
		u,
		e,
		t,
		n
	]);
	return /* @__PURE__ */ (0, $.jsx)(Wg.Provider, {
		value: d,
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "relative min-h-screen bg-background text-foreground",
			children: [
				/* @__PURE__ */ (0, $.jsx)("div", {
					"aria-hidden": "true",
					className: "pointer-events-none absolute inset-0"
				}),
				/* @__PURE__ */ (0, $.jsxs)("header", {
					className: "relative z-10 mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 pt-5 pb-3 md:gap-6 md:px-8 md:pt-8 md:pb-4",
					children: [
						/* @__PURE__ */ (0, $.jsx)(jn, {
							to: "/",
							className: "text-[28px] font-extrabold tracking-[-1.2px] leading-none md:text-[40px] md:tracking-[-1.4px]",
							"aria-label": ji,
							children: ji
						}),
						/* @__PURE__ */ (0, $.jsx)("nav", {
							className: "hidden items-center gap-5 md:flex",
							"aria-label": "Primary",
							children: Mi.map((e) => /* @__PURE__ */ (0, $.jsx)(jn, {
								to: e.path,
								className: ({ isActive: e }) => `font-mono text-[12px] tracking-[1px] uppercase ${e ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`,
								children: e.label
							}, e.id))
						}),
						/* @__PURE__ */ (0, $.jsxs)("div", {
							className: "flex items-center gap-2 md:gap-3",
							children: [
								/* @__PURE__ */ (0, $.jsx)("button", {
									type: "button",
									onClick: a,
									className: "inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground",
									"aria-label": i === "dark" ? "Switch to light theme" : "Switch to dark theme",
									children: /* @__PURE__ */ (0, $.jsx)(Ai, {
										icon: i === "dark" ? "mdi:white-balance-sunny" : "mdi:moon-waning-crescent",
										className: "size-4"
									})
								}),
								/* @__PURE__ */ (0, $.jsxs)("button", {
									type: "button",
									onClick: () => u("login"),
									className: "inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 font-mono text-[12px] tracking-[1px] text-muted-foreground uppercase hover:text-foreground",
									children: [/* @__PURE__ */ (0, $.jsx)(Ai, {
										icon: "mdi:login",
										className: "size-3.5"
									}), "Log in"]
								}),
								/* @__PURE__ */ (0, $.jsxs)("button", {
									type: "button",
									onClick: () => u("create"),
									className: "hidden min-h-11 items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 font-mono text-[12px] tracking-[1px] text-primary-foreground uppercase sm:inline-flex",
									children: [/* @__PURE__ */ (0, $.jsx)(Ai, {
										icon: "mdi:plus-box-outline",
										className: "size-3.5"
									}), "Create workspace"]
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, $.jsx)("nav", {
					className: "relative z-10 flex gap-4 overflow-x-auto px-5 pb-3 md:hidden",
					"aria-label": "Primary mobile",
					children: Mi.map((e) => /* @__PURE__ */ (0, $.jsx)(jn, {
						to: e.path,
						className: ({ isActive: e }) => `shrink-0 font-mono text-[11px] tracking-[1px] uppercase ${e ? "text-foreground" : "text-muted-foreground"}`,
						children: e.label
					}, e.id))
				}),
				r ?? /* @__PURE__ */ (0, $.jsx)(Ht, {}),
				/* @__PURE__ */ (0, $.jsx)(Ig, {
					status: e,
					mode: c,
					open: o,
					onClose: () => s(!1),
					api: t,
					navigate: n
				})
			]
		})
	});
}
//#endregion
//#region app/apex/use-viewport.ts
var qg = 768;
function Jg() {
	let [e, t] = (0, _.useState)(() => typeof window > "u" || window.innerWidth >= qg);
	return (0, _.useEffect)(() => {
		let e = window.matchMedia(`(min-width: ${qg}px)`), n = () => t(e.matches);
		return n(), e.addEventListener("change", n), () => e.removeEventListener("change", n);
	}, []), e;
}
//#endregion
//#region app/apex/marketing-page.tsx
function Yg({ eyebrow: e, title: t, lede: n, bullets: r, stripLabel: i, meta: a, aside: o, widgets: s, boardTitle: c }) {
	let l = Jg(), { openSignup: u } = Gg(), d = /* @__PURE__ */ (0, $.jsxs)("section", {
		className: "flex flex-col justify-start",
		"aria-labelledby": "page-headline",
		children: [
			/* @__PURE__ */ (0, $.jsx)("p", {
				className: "mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase",
				children: e
			}),
			/* @__PURE__ */ (0, $.jsx)("h1", {
				id: "page-headline",
				className: "mb-3 text-[32px] font-extrabold leading-[1.05] tracking-[-1.4px] md:text-[40px] md:tracking-[-1.6px]",
				children: t
			}),
			/* @__PURE__ */ (0, $.jsx)("p", {
				className: "mb-5 max-w-[34em] text-[15px] leading-[1.65] text-muted-foreground",
				children: n
			}),
			/* @__PURE__ */ (0, $.jsx)("ul", {
				className: "mb-6 flex flex-col gap-2.5",
				children: r.map((e) => /* @__PURE__ */ (0, $.jsxs)("li", {
					className: "flex gap-2 text-[14px] leading-snug text-foreground",
					children: [/* @__PURE__ */ (0, $.jsx)("span", {
						className: "mt-1.5 size-1.5 shrink-0 rounded-full",
						style: { background: M.mint },
						"aria-hidden": !0
					}), /* @__PURE__ */ (0, $.jsx)("span", { children: e })]
				}, e))
			}),
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-wrap items-center gap-3",
				children: [
					/* @__PURE__ */ (0, $.jsx)("button", {
						type: "button",
						onClick: () => u("create"),
						className: "min-h-11 min-w-[200px] rounded-xl bg-primary px-5 py-4 text-[15px] font-bold text-primary-foreground",
						children: Ni.primaryCta
					}),
					/* @__PURE__ */ (0, $.jsx)("button", {
						type: "button",
						onClick: () => u("login"),
						className: "min-h-11 min-w-[180px] rounded-xl border border-border px-5 py-4 text-[15px] font-semibold",
						children: Ni.secondaryCta
					}),
					a ? /* @__PURE__ */ (0, $.jsx)("div", {
						className: "w-full font-mono text-[11px] text-muted-foreground",
						children: a
					}) : null
				]
			}),
			o ? /* @__PURE__ */ (0, $.jsx)("p", {
				className: "mt-8 max-w-[34em] border-t border-border pt-6 text-[14px] leading-[1.65] text-muted-foreground",
				children: o
			}) : null
		]
	}), f = /* @__PURE__ */ (0, $.jsx)(Ag, {
		items: s,
		title: c ?? t,
		stripLabel: i,
		maxColumns: l ? 3 : 2,
		fixedColumns: l ? 3 : void 0,
		cellSize: l ? 180 : 150,
		gap: l ? 12 : 10,
		radius: M.radiusPx
	}), p = /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "mt-14 flex flex-col items-start gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between",
		children: [/* @__PURE__ */ (0, $.jsx)("p", {
			className: "font-mono text-[12px] text-muted-foreground",
			children: "Ready when you are. Create a workspace or sign in."
		}), /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex flex-wrap gap-3",
			children: [/* @__PURE__ */ (0, $.jsx)("button", {
				type: "button",
				onClick: () => u("create"),
				className: "inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-[14px] font-bold text-primary-foreground",
				children: Ni.primaryCta
			}), /* @__PURE__ */ (0, $.jsx)("button", {
				type: "button",
				onClick: () => u("login"),
				className: "inline-flex min-h-11 items-center rounded-xl border border-border px-5 text-[14px] font-semibold",
				children: Ni.secondaryCta
			})]
		})]
	});
	return l ? /* @__PURE__ */ (0, $.jsxs)("main", {
		className: "relative z-10 mx-auto w-full max-w-[1180px] px-8 pb-20",
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start gap-10 pt-2",
			children: [d, f]
		}), p]
	}) : /* @__PURE__ */ (0, $.jsxs)("main", {
		className: "relative z-10 px-5 pb-16",
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex flex-col gap-8 pt-1",
			children: [d, f]
		}), p]
	});
}
//#endregion
//#region app/apex/pages/access-page.tsx
function Xg() {
	let e = zi.access;
	return /* @__PURE__ */ (0, $.jsx)(Yg, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: vg,
		boardTitle: "Access board"
	});
}
//#endregion
//#region app/apex/pages/campus-page.tsx
function Zg() {
	let e = zi.campus;
	return /* @__PURE__ */ (0, $.jsx)(Yg, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: hg,
		boardTitle: "Campus rack"
	});
}
//#endregion
//#region app/apex/drawn-switch.tsx
function Qg({ on: e, className: t = "", size: n = 48 }) {
	let r = Math.round(n * .58), i = r / 2, a = r - 6, o = e ? n - i : i;
	return /* @__PURE__ */ (0, $.jsxs)("svg", {
		width: n,
		height: r,
		viewBox: `0 0 ${n} ${r}`,
		className: `shrink-0 ${t}`,
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, $.jsx)("rect", {
			x: 0,
			y: 0,
			width: n,
			height: r,
			rx: i,
			fill: e ? M.mint : M.charcoal
		}), /* @__PURE__ */ (0, $.jsx)("circle", {
			cx: o,
			cy: i,
			r: a / 2,
			fill: e ? "#121314" : "#F4F4F5"
		})]
	});
}
//#endregion
//#region app/apex/hero-mosaic.tsx
var $g = 13, e_ = "opacity-45";
function t_({ compact: e = !1 }) {
	let t = e ? "grid-rows-[36px_36px_36px]" : "grid-rows-[clamp(36px,5vw,48px)_clamp(36px,5vw,48px)_clamp(36px,5vw,48px)]", [n, r] = (0, _.useState)(0);
	return (0, _.useEffect)(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			r($g);
			return;
		}
		let e = performance.now(), t = 0, n = (i) => {
			let a = Math.min(1, (i - e) / 700), o = 1 - (1 - a) ** 3;
			r(Math.round($g * o)), a < 1 && (t = requestAnimationFrame(n));
		};
		return t = requestAnimationFrame(n), () => cancelAnimationFrame(t);
	}, []), /* @__PURE__ */ (0, $.jsxs)("div", {
		className: `mb-4 grid w-full grid-cols-4 gap-1.5 ${t}`,
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, $.jsx)("span", {
				className: `col-span-2 rounded-[10px] ${e_}`,
				style: { background: M.mint }
			}),
			/* @__PURE__ */ (0, $.jsx)("span", {
				className: `col-span-2 rounded-[10px] ${e_}`,
				style: { background: M.charcoal }
			}),
			/* @__PURE__ */ (0, $.jsx)("span", {
				className: `rounded-[10px] ${e_}`,
				style: { background: M.coral }
			}),
			/* @__PURE__ */ (0, $.jsxs)("span", {
				className: "col-span-2 row-span-2 flex items-center justify-between gap-2 rounded-[10px] border border-white/20 p-2.5 text-white",
				style: { background: M.darkFace },
				children: [/* @__PURE__ */ (0, $.jsxs)("span", {
					className: "flex min-w-0 flex-col justify-center gap-0.5",
					children: [
						/* @__PURE__ */ (0, $.jsx)("span", {
							className: "font-mono text-[9px] tracking-[1.2px] uppercase",
							style: { color: M.mint },
							children: "On today"
						}),
						/* @__PURE__ */ (0, $.jsx)("span", {
							className: "font-mono text-[34px] font-extrabold leading-none tracking-tight md:text-[40px]",
							children: n
						}),
						/* @__PURE__ */ (0, $.jsxs)("span", {
							className: "text-[10px] text-white/55",
							children: [
								"of ",
								50,
								" modules"
							]
						})
					]
				}), /* @__PURE__ */ (0, $.jsx)(Qg, {
					on: !0,
					size: e ? 36 : 44
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)("span", {
				className: `rounded-[10px] ${e_}`,
				style: { background: M.blue }
			}),
			/* @__PURE__ */ (0, $.jsx)("span", {
				className: `rounded-[10px] ${e_}`,
				style: { background: M.gold }
			}),
			/* @__PURE__ */ (0, $.jsx)("span", {
				className: `rounded-[10px] ${e_}`,
				style: { background: M.midGray }
			})
		]
	});
}
//#endregion
//#region app/apex/pages/home-page.tsx
function n_() {
	return /* @__PURE__ */ (0, $.jsx)("section", {
		"aria-label": "Customer proof",
		className: "mt-16 border-t border-border pt-10 md:mt-20",
		children: /* @__PURE__ */ (0, $.jsx)("ul", {
			className: "grid gap-4 sm:grid-cols-3",
			children: Fi.map((e) => /* @__PURE__ */ (0, $.jsx)("li", {
				className: "rounded-[14px] border border-[#121314]/12 px-4 py-5 font-mono text-[13px] leading-relaxed text-muted-foreground",
				children: e
			}, e))
		})
	});
}
function r_() {
	let e = Jg(), { openSignup: t } = Gg();
	return e ? /* @__PURE__ */ (0, $.jsxs)("main", {
		className: "relative z-10 mx-auto w-full max-w-[1180px] px-8 pb-20",
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start gap-10 pt-2",
			children: [/* @__PURE__ */ (0, $.jsxs)("section", {
				className: "flex flex-col justify-start pt-0",
				"aria-labelledby": "landingHeadlineDesktop",
				children: [
					/* @__PURE__ */ (0, $.jsx)(t_, {}),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase",
						children: Ni.eyebrow
					}),
					/* @__PURE__ */ (0, $.jsx)("h1", {
						id: "landingHeadlineDesktop",
						className: "mb-3 text-[44px] font-extrabold leading-[1.02] tracking-[-1.8px] xl:text-[52px]",
						children: Ni.headline
					}),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "mb-6 max-w-[34em] text-[15px] leading-[1.65] text-muted-foreground",
						children: Ni.lede
					}),
					/* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3",
						children: [
							/* @__PURE__ */ (0, $.jsx)("button", {
								type: "button",
								onClick: () => t("create"),
								className: "min-h-11 min-w-[200px] rounded-xl bg-primary px-5 py-4 text-[15px] font-bold text-primary-foreground",
								children: Ni.primaryCta
							}),
							/* @__PURE__ */ (0, $.jsx)("button", {
								type: "button",
								onClick: () => t("login"),
								className: "min-h-11 min-w-[180px] rounded-xl border border-border px-5 py-4 text-[15px] font-semibold",
								children: Ni.secondaryCta
							}),
							/* @__PURE__ */ (0, $.jsx)("div", {
								className: "w-full font-mono text-[11px] text-muted-foreground",
								children: Ni.meta
							})
						]
					}),
					/* @__PURE__ */ (0, $.jsxs)("p", {
						className: "mt-5 font-mono text-[11px] text-muted-foreground",
						children: [
							"Admin › Features · ",
							50,
							" modules in the rack"
						]
					})
				]
			}), /* @__PURE__ */ (0, $.jsx)(Ag, {
				items: pg,
				stripLabel: Bi,
				maxColumns: 3,
				fixedColumns: 3,
				cellSize: 180,
				gap: 12,
				radius: M.radiusPx
			})]
		}), /* @__PURE__ */ (0, $.jsx)(n_, {})]
	}) : /* @__PURE__ */ (0, $.jsxs)("main", {
		className: "relative z-10 px-5 pb-16",
		children: [
			/* @__PURE__ */ (0, $.jsxs)("section", {
				className: "mb-6",
				"aria-labelledby": "landingHeadlineMobile",
				children: [
					/* @__PURE__ */ (0, $.jsx)(t_, { compact: !0 }),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "mb-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase",
						children: Ni.eyebrow
					}),
					/* @__PURE__ */ (0, $.jsx)("h1", {
						id: "landingHeadlineMobile",
						className: "mb-3 text-[32px] font-extrabold leading-[1.05] tracking-[-1.4px]",
						children: Ni.headline
					}),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "mb-5 text-[15px] leading-[1.65] text-muted-foreground",
						children: Ni.lede
					}),
					/* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex max-w-[360px] flex-col gap-3",
						children: [
							/* @__PURE__ */ (0, $.jsx)("button", {
								type: "button",
								onClick: () => t("create"),
								className: "min-h-11 w-full rounded-xl bg-primary px-5 py-4 text-[15px] font-bold text-primary-foreground",
								children: Ni.primaryCta
							}),
							/* @__PURE__ */ (0, $.jsx)("button", {
								type: "button",
								onClick: () => t("login"),
								className: "min-h-11 w-full rounded-xl border border-border px-5 py-4 text-[15px] font-semibold",
								children: Ni.secondaryCta
							}),
							/* @__PURE__ */ (0, $.jsx)("div", {
								className: "text-center font-mono text-[11px] text-muted-foreground",
								children: Ni.meta
							})
						]
					}),
					/* @__PURE__ */ (0, $.jsxs)("p", {
						className: "mt-3 text-center font-mono text-[11px] text-muted-foreground",
						children: [
							"Admin › Features · ",
							50,
							" modules"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, $.jsx)(Ag, {
				items: pg,
				stripLabel: Bi,
				maxColumns: 2,
				cellSize: 150,
				gap: 10,
				radius: M.radiusPx
			}),
			/* @__PURE__ */ (0, $.jsx)(n_, {})
		]
	});
}
//#endregion
//#region app/apex/pages/modules-page.tsx
function i_() {
	let e = zi.modules;
	return /* @__PURE__ */ (0, $.jsx)(Yg, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: mg,
		boardTitle: "Modules rack"
	});
}
//#endregion
//#region app/apex/pages/pricing-page.tsx
function a_() {
	let e = zi.pricing;
	return /* @__PURE__ */ (0, $.jsx)(Yg, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: yg,
		boardTitle: "Pricing board"
	});
}
//#endregion
//#region app/apex/pages/setup-page.tsx
function o_() {
	let e = zi.setup;
	return /* @__PURE__ */ (0, $.jsx)(Yg, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: _g,
		boardTitle: "Setup board"
	});
}
//#endregion
//#region app/apex/pages/workforce-page.tsx
function s_() {
	let e = zi.workforce;
	return /* @__PURE__ */ (0, $.jsx)(Yg, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: gg,
		boardTitle: "Workforce rack"
	});
}
//#endregion
//#region app/apex/router.tsx
function c_({ status: e, api: t, navigate: n }) {
	return /* @__PURE__ */ (0, $.jsx)(kn, { children: /* @__PURE__ */ (0, $.jsx)(Gt, { children: /* @__PURE__ */ (0, $.jsxs)(Ut, {
		element: /* @__PURE__ */ (0, $.jsx)(Kg, {
			status: e,
			api: t,
			navigate: n
		}),
		children: [
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				index: !0,
				element: /* @__PURE__ */ (0, $.jsx)(r_, {})
			}),
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				path: "modules",
				element: /* @__PURE__ */ (0, $.jsx)(i_, {})
			}),
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				path: "setup",
				element: /* @__PURE__ */ (0, $.jsx)(o_, {})
			}),
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				path: "access",
				element: /* @__PURE__ */ (0, $.jsx)(Xg, {})
			}),
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				path: "campus",
				element: /* @__PURE__ */ (0, $.jsx)(Zg, {})
			}),
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				path: "workforce",
				element: /* @__PURE__ */ (0, $.jsx)(s_, {})
			}),
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				path: "pricing",
				element: /* @__PURE__ */ (0, $.jsx)(a_, {})
			}),
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				path: "*",
				element: /* @__PURE__ */ (0, $.jsx)(Vt, {
					to: "/",
					replace: !0
				})
			})
		]
	}) }) });
}
//#endregion
//#region app/apex/page.tsx
function l_(e) {
	return /* @__PURE__ */ (0, $.jsx)(Hg, { children: /* @__PURE__ */ (0, $.jsx)(c_, { ...e }) });
}
//#endregion
//#region src/apex-mount.tsx
var u_ = null;
function d_(e, t, n) {
	e && (u_ &&= (u_.unmount(), null), u_ = (0, Vn.createRoot)(e), u_.render(/* @__PURE__ */ (0, $.jsx)(l_, {
		status: t || {},
		api: n?.api,
		navigate: n?.navigate
	})));
}
function f_() {
	u_ &&= (u_.unmount(), null);
}
//#endregion
export { l_ as ApexPage, d_ as mountApexLanding, f_ as unmountApexLanding };
