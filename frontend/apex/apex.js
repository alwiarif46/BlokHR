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
	function O(e) {
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
	var ce = typeof reportError == "function" ? reportError : function(e) {
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
	function le(e) {
		var t = T.T, n = {};
		n.types = t === null ? null : t.types, T.T = n;
		try {
			var r = e(), i = T.S;
			i !== null && i(n, r), typeof r == "object" && r && typeof r.then == "function" && r.then(w, ce);
		} catch (e) {
			ce(e);
		} finally {
			t !== null && n.types !== null && (t.types = n.types), T.T = t;
		}
	}
	function ue(e) {
		var t = T.T;
		if (t !== null) {
			var n = t.types;
			n === null ? t.types = [e] : n.indexOf(e) === -1 && n.push(e);
		} else le(ue.bind(null, e));
	}
	var de = {
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
	e.Activity = f, e.Children = de, e.Component = y, e.Fragment = r, e.Profiler = a, e.PureComponent = x, e.StrictMode = i, e.Suspense = l, e.ViewTransition = p, e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = T, e.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(e) {
			return T.H.useMemoCache(e);
		}
	}, e.addTransitionType = ue, e.cache = function(e) {
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
			_init: O
		};
	}, e.memo = function(e, t) {
		return {
			$$typeof: u,
			type: e,
			compare: t === void 0 ? null : t
		};
	}, e.startTransition = le, e.unstable_useCacheRefresh = function() {
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
	var D = Object.assign, ee = Symbol.for("react.element"), te = Symbol.for("react.transitional.element"), ne = Symbol.for("react.portal"), re = Symbol.for("react.fragment"), ie = Symbol.for("react.strict_mode"), ae = Symbol.for("react.profiler"), oe = Symbol.for("react.consumer"), se = Symbol.for("react.context"), O = Symbol.for("react.forward_ref"), ce = Symbol.for("react.suspense"), le = Symbol.for("react.suspense_list"), ue = Symbol.for("react.memo"), de = Symbol.for("react.lazy"), fe = Symbol.for("react.activity"), pe = Symbol.for("react.legacy_hidden"), me = Symbol.for("react.memo_cache_sentinel"), he = Symbol.for("react.view_transition"), k = Symbol.for("react.recoverable"), ge = Symbol.iterator;
	function _e(e) {
		return typeof e != "object" || !e ? null : (e = ge && e[ge] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var ve = Symbol.for("react.client.reference");
	function ye(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === ve ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case re: return "Fragment";
			case ae: return "Profiler";
			case ie: return "StrictMode";
			case ce: return "Suspense";
			case le: return "SuspenseList";
			case fe: return "Activity";
			case he: return "ViewTransition";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case ne: return "Portal";
			case se: return e.displayName || "Context";
			case oe: return (e._context.displayName || "Context") + ".Consumer";
			case O:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case ue: return t = e.displayName || null, t === null ? ye(e.type) || "Memo" : t;
			case de:
				t = e._payload, e = e._init;
				try {
					return ye(e(t));
				} catch {}
		}
		return null;
	}
	var be = Array.isArray, A = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, j = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, xe = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, Se = [], Ce = -1;
	function we(e) {
		return { current: e };
	}
	function Te(e) {
		0 > Ce || (e.current = Se[Ce], Se[Ce] = null, Ce--);
	}
	function Ee(e, t) {
		Ce++, Se[Ce] = e.current, e.current = t;
	}
	var De = we(null), Oe = we(null), ke = we(null), Ae = we(null);
	function je(e, t) {
		switch (Ee(ke, t), Ee(Oe, e), Ee(De, null), t.nodeType) {
			case 9:
			case 11:
				e = (e = t.documentElement) && (e = e.namespaceURI) ? mp(e) : 0;
				break;
			default: if (e = t.tagName, t = t.namespaceURI) t = mp(t), e = hp(t, e);
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
		Te(De), Ee(De, e);
	}
	function Me() {
		Te(De), Te(Oe), Te(ke);
	}
	function Ne(e) {
		var t = e.memoizedState;
		t !== null && (uh._currentValue = t.memoizedState, Ee(Ae, e)), t = De.current;
		var n = hp(t, e.type);
		t !== n && (Ee(Oe, e), Ee(De, n));
	}
	function Pe(e) {
		Oe.current === e && (Te(De), Te(Oe)), Ae.current === e && (Te(Ae), uh._currentValue = xe);
	}
	var Fe, Ie;
	function Le(e) {
		if (Fe === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			Fe = t && t[1] || "", Ie = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + Fe + e + Ie;
	}
	var Re = !1;
	function ze(e, t) {
		if (!e || Re) return "";
		Re = !0;
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
			Re = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? Le(n) : "";
	}
	function Be(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return Le(e.type);
			case 16: return Le("Lazy");
			case 13: return e.child !== t && t !== null ? Le("Suspense Fallback") : Le("Suspense");
			case 19: return Le("SuspenseList");
			case 0:
			case 15: return ze(e.type, !1);
			case 11: return ze(e.type.render, !1);
			case 1: return ze(e.type, !0);
			case 31: return Le("Activity");
			case 30: return Le("ViewTransition");
			default: return "";
		}
	}
	function Ve(e) {
		try {
			var t = "", n = null;
			do
				t += Be(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var He = Object.prototype.hasOwnProperty, Ue = t.unstable_scheduleCallback, We = t.unstable_cancelCallback, Ge = t.unstable_shouldYield, Ke = t.unstable_requestPaint, qe = t.unstable_now, Je = t.unstable_getCurrentPriorityLevel, Ye = t.unstable_ImmediatePriority, Xe = t.unstable_UserBlockingPriority, Ze = t.unstable_NormalPriority, Qe = t.unstable_LowPriority, $e = t.unstable_IdlePriority, et = t.log, tt = t.unstable_setDisableYieldValue, nt = null, rt = null;
	function it(e) {
		if (typeof et == "function" && tt(e), rt && typeof rt.setStrictMode == "function") try {
			rt.setStrictMode(nt, e);
		} catch {}
	}
	var at = Math.clz32 ? Math.clz32 : ct, ot = Math.log, st = Math.LN2;
	function ct(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (ot(e) / st | 0) | 0;
	}
	var lt = 256, ut = 262144, dt = 4194304;
	function ft(e) {
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
	function pt(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = ft(n))) : i = ft(o) : i = ft(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = ft(n))) : i = ft(o)) : i = ft(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function mt(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function ht(e, t) {
		t & 8 && (t |= t & 32);
		var n = e.entangledLanes;
		if (n !== 0) for (e = e.entanglements, n &= t; 0 < n;) {
			var r = 31 - at(n), i = 1 << r;
			t |= e[r], n &= ~i;
		}
		return t;
	}
	function gt(e, t) {
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
	function _t() {
		var e = dt;
		return dt <<= 1, !(dt & 62914560) && (dt = 4194304), e;
	}
	function vt(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function yt(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function bt(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - at(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && xt(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function xt(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - at(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function St(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - at(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function Ct(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : wt(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function wt(e) {
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
	function Tt(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function Et() {
		var e = j.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : Eh(e.type)) : e;
	}
	function Dt(e, t) {
		var n = j.p;
		try {
			return j.p = e, t();
		} finally {
			j.p = n;
		}
	}
	var Ot = Math.random().toString(36).slice(2), kt = "__reactFiber$" + Ot, At = "__reactProps$" + Ot, jt = "__reactContainer$" + Ot, Mt = "__reactEvents$" + Ot, Nt = "__reactListeners$" + Ot, Pt = "__reactHandles$" + Ot, Ft = "__reactResources$" + Ot, It = "__reactMarker$" + Ot, Lt = "__reactLoad$" + Ot;
	function Rt(e) {
		delete e[kt], delete e[At], delete e[Nt], delete e[Pt];
	}
	function zt(e) {
		var t;
		if (t = e[kt]) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[jt] || n[kt]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = hm(e); e !== null;) {
					if (n = e[kt]) return n;
					e = hm(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function Bt(e) {
		if (e = e[kt] || e[jt]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function Vt(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(i(33));
	}
	function Ht(e) {
		var t = e[Ft];
		return t ||= e[Ft] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function Ut(e) {
		e[It] = !0;
	}
	function Wt(e) {
		e[Lt] = void 0;
	}
	var Gt = /* @__PURE__ */ new Set(), Kt = {};
	function qt(e, t) {
		Jt(e, t), Jt(e + "Capture", t);
	}
	function Jt(e, t) {
		for (Kt[e] = t, e = 0; e < t.length; e++) Gt.add(t[e]);
	}
	var Yt = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), Xt = {}, Zt = {};
	function Qt(e) {
		return He.call(Zt, e) ? !0 : He.call(Xt, e) ? !1 : Yt.test(e) ? Zt[e] = !0 : (Xt[e] = !0, !1);
	}
	var M = !1;
	function $t() {
		var e = M;
		return M = !1, e;
	}
	function en(e, t, n) {
		if (Qt(t)) {
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
	function tn(e, t, n) {
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
	function nn(e, t, n, r) {
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
	function rn(e) {
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
	function an(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function on(e, t, n) {
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
	function sn(e) {
		if (!e._valueTracker) {
			var t = an(e) ? "checked" : "value";
			e._valueTracker = on(e, t, "" + e[t]);
		}
	}
	function cn(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = an(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n && (t.setValue(e), !0);
	}
	var ln = /[\n"\\]/g;
	function un(e) {
		return e.replace(ln, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function dn(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + rn(t)) : e.value !== "" + rn(t) && (e.value = "" + rn(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : pn(e, rn(n)) : o === "number" && e.value == t ? pn(e, rn(e.value)) : pn(e, rn(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + rn(s) : e.removeAttribute("name");
	}
	function fn(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				sn(e);
				return;
			}
			n = n == null ? "" : "" + rn(n), t = t == null ? n : "" + rn(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), sn(e);
	}
	function pn(e, t) {
		e.defaultValue !== "" + t && (e.defaultValue = "" + t);
	}
	function mn(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + rn(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function hn(e, t, n) {
		if (t != null && (t = "" + rn(t), t !== e.value && (e.value = t), n == null)) {
			e.defaultValue !== t && (e.defaultValue = t);
			return;
		}
		e.defaultValue = n == null ? "" : "" + rn(n);
	}
	function gn(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(i(92));
				if (be(r)) {
					if (1 < r.length) throw Error(i(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = rn(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), sn(e);
	}
	function _n(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var vn = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function yn(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || vn.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function bn(e, t, n) {
		if (t != null && typeof t != "object") throw Error(i(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "", M = !0);
			for (var a in t) r = t[a], t.hasOwnProperty(a) && n[a] !== r && (yn(e, a, r), M = !0);
		} else for (var o in t) t.hasOwnProperty(o) && yn(e, o, t[o]);
	}
	function xn(e) {
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
	var Sn = /* @__PURE__ */ new Map([
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
	]), Cn = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function wn(e) {
		return Cn.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function Tn() {}
	var En = null;
	function Dn(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var On = null, kn = null;
	function An(e) {
		var t = Bt(e);
		if (t && (e = t.stateNode)) {
			var n = e[At] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (dn(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + un("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var a = r[At] || null;
								if (!a) throw Error(i(90));
								dn(r, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && cn(r);
					}
					break a;
				case "textarea":
					hn(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && mn(e, !!n.multiple, t, !1);
			}
		}
	}
	var jn = !1;
	function Mn(e, t, n) {
		if (jn) return e(t, n);
		jn = !0;
		try {
			return e(t);
		} finally {
			if (jn = !1, (On !== null || kn !== null) && (Ud(), On && (t = On, e = kn, kn = On = null, An(t), e))) for (t = 0; t < e.length; t++) An(e[t]);
		}
	}
	function Nn(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[At] || null;
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
	var Pn = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, Fn = !1;
	if (Pn) try {
		var In = {};
		Object.defineProperty(In, "passive", { get: function() {
			Fn = !0;
		} }), window.addEventListener("test", In, In), window.removeEventListener("test", In, In);
	} catch {
		Fn = !1;
	}
	var Ln = null, Rn = null, zn = null;
	function Bn() {
		if (zn) return zn;
		var e, t = Rn, n = t.length, r, i = "value" in Ln ? Ln.value : Ln.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return zn = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function Vn(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function Hn() {
		return !0;
	}
	function Un() {
		return !1;
	}
	function Wn(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? Hn : Un, this.isPropagationStopped = Un, this;
		}
		return D(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = Hn);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = Hn);
			},
			persist: function() {},
			isPersistent: Hn
		}), t;
	}
	var Gn = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, Kn = Wn(Gn), qn = D({}, Gn, {
		view: 0,
		detail: 0
	}), Jn = Wn(qn), Yn, Xn, Zn, Qn = D({}, qn, {
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
		getModifierState: lr,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== Zn && (Zn && e.type === "mousemove" ? (Yn = e.screenX - Zn.screenX, Xn = e.screenY - Zn.screenY) : Xn = Yn = 0, Zn = e), Yn);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : Xn;
		}
	}), $n = Wn(Qn), er = Wn(D({}, Qn, { dataTransfer: 0 })), tr = Wn(D({}, qn, { relatedTarget: 0 })), nr = Wn(D({}, Gn, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), rr = Wn(D({}, Gn, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), ir = Wn(D({}, Gn, { data: 0 })), ar = {
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
	}, or = {
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
	}, sr = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function cr(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = sr[e]) ? !!t[e] : !1;
	}
	function lr() {
		return cr;
	}
	var ur = Wn(D({}, qn, {
		key: function(e) {
			if (e.key) {
				var t = ar[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = Vn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? or[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: lr,
		charCode: function(e) {
			return e.type === "keypress" ? Vn(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? Vn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), dr = Wn(D({}, Qn, {
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
	})), fr = Wn(D({}, Gn, { submitter: 0 })), pr = Wn(D({}, qn, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: lr
	})), mr = Wn(D({}, Gn, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), hr = Wn(D({}, Qn, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), gr = Wn(D({}, Gn, {
		newState: 0,
		oldState: 0,
		source: 0
	})), _r = [
		9,
		13,
		27,
		32
	], vr = Pn && "CompositionEvent" in window, yr = null;
	Pn && "documentMode" in document && (yr = document.documentMode);
	var br = Pn && "TextEvent" in window && !yr, xr = Pn && (!vr || yr && 8 < yr && 11 >= yr), Sr = " ", Cr = !1;
	function wr(e, t) {
		switch (e) {
			case "keyup": return _r.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function Tr(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var Er = !1;
	function Dr(e, t) {
		switch (e) {
			case "compositionend": return Tr(t);
			case "keypress": return t.which === 32 ? (Cr = !0, Sr) : null;
			case "textInput": return e = t.data, e === Sr && Cr ? null : e;
			default: return null;
		}
	}
	function Or(e, t) {
		if (Er) return e === "compositionend" || !vr && wr(e, t) ? (e = Bn(), zn = Rn = Ln = null, Er = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return xr && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var kr = {
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
	function Ar(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!kr[e.type] : t === "textarea";
	}
	function jr(e, t, n, r) {
		On ? kn ? kn.push(r) : kn = [r] : On = r, t = Qf(t, "onChange"), 0 < t.length && (n = new Kn("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var Mr = null, Nr = null;
	function Pr(e) {
		Gf(e, 0);
	}
	function Fr(e) {
		if (cn(Vt(e))) return e;
	}
	function Ir(e, t) {
		if (e === "change") return t;
	}
	var Lr = !1;
	if (Pn) {
		var Rr;
		if (Pn) {
			var zr = "oninput" in document;
			if (!zr) {
				var Br = document.createElement("div");
				Br.setAttribute("oninput", "return;"), zr = typeof Br.oninput == "function";
			}
			Rr = zr;
		} else Rr = !1;
		Lr = Rr && (!document.documentMode || 9 < document.documentMode);
	}
	function Vr() {
		Mr && (Mr.detachEvent("onpropertychange", Hr), Nr = Mr = null);
	}
	function Hr(e) {
		if (e.propertyName === "value" && Fr(Nr)) {
			var t = [];
			jr(t, Nr, e, Dn(e)), Mn(Pr, t);
		}
	}
	function Ur(e, t, n) {
		e === "focusin" ? (Vr(), Mr = t, Nr = n, Mr.attachEvent("onpropertychange", Hr)) : e === "focusout" && Vr();
	}
	function Wr(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return Fr(Nr);
	}
	function Gr(e, t) {
		if (e === "click") return Fr(t);
	}
	function Kr(e, t) {
		if (e === "input" || e === "change") return Fr(t);
	}
	function qr(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var Jr = typeof Object.is == "function" ? Object.is : qr;
	function Yr(e, t) {
		if (Jr(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!He.call(t, i) || !Jr(e[i], t[i])) return !1;
		}
		return !0;
	}
	function Xr(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	function Zr(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function Qr(e, t) {
		var n = Zr(e);
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
			n = Zr(n);
		}
	}
	function $r(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? $r(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function ei(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = Xr(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = Xr(e.document);
		}
		return t;
	}
	function ti(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var ni = Pn && "documentMode" in document && 11 >= document.documentMode, ri = null, ii = null, ai = null, oi = !1;
	function si(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		oi || ri == null || ri !== Xr(r) || (r = ri, "selectionStart" in r && ti(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), ai && Yr(ai, r) || (ai = r, r = Qf(ii, "onSelect"), 0 < r.length && (t = new Kn("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = ri)));
	}
	function ci(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var li = {
		animationend: ci("Animation", "AnimationEnd"),
		animationiteration: ci("Animation", "AnimationIteration"),
		animationstart: ci("Animation", "AnimationStart"),
		transitionrun: ci("Transition", "TransitionRun"),
		transitionstart: ci("Transition", "TransitionStart"),
		transitioncancel: ci("Transition", "TransitionCancel"),
		transitionend: ci("Transition", "TransitionEnd")
	}, ui = {}, di = {};
	Pn && (di = document.createElement("div").style, "AnimationEvent" in window || (delete li.animationend.animation, delete li.animationiteration.animation, delete li.animationstart.animation), "TransitionEvent" in window || delete li.transitionend.transition);
	function fi(e) {
		if (ui[e]) return ui[e];
		if (!li[e]) return e;
		var t = li[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in di) return ui[e] = t[n];
		return e;
	}
	var pi = fi("animationend"), mi = fi("animationiteration"), hi = fi("animationstart"), gi = fi("transitionrun"), _i = fi("transitionstart"), vi = fi("transitioncancel"), yi = fi("transitionend"), bi = /* @__PURE__ */ new Map(), xi = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	xi.push("scrollEnd");
	function Si(e, t) {
		bi.set(e, t), qt(t, [e]);
	}
	var Ci = 0;
	function wi(e, t) {
		if (e.name != null && e.name !== "auto") return e.name;
		if (t.autoName !== null) return t.autoName;
		e = wd.identifierPrefix;
		var n = Ci++;
		return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
	}
	function Ti(e) {
		if (e == null || typeof e == "string") return e;
		var t = null, n = Md;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = e[n[r]];
			if (i != null) {
				if (i === "none") return "none";
				t = t == null ? i : t + (" " + i);
			}
		}
		return t ?? e.default;
	}
	function Ei(e, t) {
		return e = Ti(e), t = Ti(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
	}
	var Di = typeof reportError == "function" ? reportError : function(e) {
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
	}, Oi = [], ki = 0, Ai = 0;
	function ji() {
		for (var e = ki, t = Ai = ki = 0; t < e;) {
			var n = Oi[t];
			Oi[t++] = null;
			var r = Oi[t];
			Oi[t++] = null;
			var i = Oi[t];
			Oi[t++] = null;
			var a = Oi[t];
			if (Oi[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && Fi(n, i, a);
		}
	}
	function Mi(e, t, n, r) {
		Oi[ki++] = e, Oi[ki++] = t, Oi[ki++] = n, Oi[ki++] = r, Ai |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function Ni(e, t, n, r) {
		return Mi(e, t, n, r), Ii(e);
	}
	function Pi(e, t) {
		return Mi(e, null, null, t), Ii(e);
	}
	function Fi(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - at(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function Ii(e) {
		if (50 < Nd) throw Nd = 0, Pd = null, Error(i(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var Li = {};
	function Ri(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function zi(e, t, n, r) {
		return new Ri(e, t, n, r);
	}
	function Bi(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function N(e, t) {
		var n = e.alternate;
		return n === null ? (n = zi(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function Vi(e, t) {
		e.flags &= 1206910978;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function Hi(e, t, n, r, a, o) {
		var s = 0;
		if (r = e, typeof r == "function") Bi(r) && (s = 1);
		else if (typeof r == "string") s = Xm(e, n, De.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (r) {
			case fe: return e = zi(31, n, t, a), e.elementType = fe, e.lanes = o, e;
			case re: return Ui(n.children, a, o, t);
			case ie:
				s = 8, a |= 24;
				break;
			case ae: return e = zi(12, n, t, a | 2), e.elementType = ae, e.lanes = o, e;
			case ce: return e = zi(13, n, t, a), e.elementType = ce, e.lanes = o, e;
			case le: return e = zi(19, n, t, a), e.elementType = le, e.lanes = o, e;
			case pe:
			case he: return e = a | 32, e = zi(30, n, t, e), e.elementType = he, e.lanes = o, e.stateNode = {
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
					case O:
						s = 11;
						break a;
					case ue:
						s = 14;
						break a;
					case de:
						s = 16, r = null;
						break a;
				}
				s = 29, n = Error(i(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = zi(s, n, t, a), t.elementType = e, t.type = r, t.lanes = o, t;
	}
	function Ui(e, t, n, r) {
		return e = zi(7, e, r, t), e.lanes = n, e;
	}
	function Wi(e, t, n) {
		return e = zi(6, e, null, t), e.lanes = n, e;
	}
	function Gi(e) {
		var t = zi(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function Ki(e, t, n) {
		return t = zi(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var qi = /* @__PURE__ */ new WeakMap();
	function Ji(e, t) {
		if (typeof e == "object" && e) {
			var n = qi.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: Ve(t)
			}, qi.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: Ve(t)
		};
	}
	var Yi = [], Xi = 0, Zi = null, Qi = 0, $i = [], ea = 0, ta = null, na = 1, ra = "";
	function ia(e, t) {
		Yi[Xi++] = Qi, Yi[Xi++] = Zi, Zi = e, Qi = t;
	}
	function aa(e, t, n) {
		$i[ea++] = na, $i[ea++] = ra, $i[ea++] = ta, ta = e;
		var r = na;
		e = ra;
		var i = 32 - at(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - at(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, na = 1 << 32 - at(t) + i | n << i | r, ra = a + e;
		} else na = 1 << a | n << i | r, ra = e;
	}
	function oa(e) {
		e.return !== null && (ia(e, 1), aa(e, 1, 0));
	}
	function sa(e) {
		for (; e === Zi;) Zi = Yi[--Xi], Yi[Xi] = null, Qi = Yi[--Xi], Yi[Xi] = null;
		for (; e === ta;) ta = $i[--ea], $i[ea] = null, ra = $i[--ea], $i[ea] = null, na = $i[--ea], $i[ea] = null;
	}
	function ca(e, t) {
		$i[ea++] = na, $i[ea++] = ra, $i[ea++] = ta, na = t.id, ra = t.overflow, ta = e;
	}
	var P = null, F = null, I = !1, la = null, ua = !1, da = Error(i(519));
	function fa(e) {
		throw va(Ji(Error(i(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), da;
	}
	function pa(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[kt] = e, t[At] = r, n) {
			case "dialog":
				J("cancel", t), J("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				J("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < Uf.length; n++) J(Uf[n], t);
				break;
			case "source":
				J("error", t);
				break;
			case "img":
			case "image":
			case "link":
				J("error", t), J("load", t);
				break;
			case "details":
				J("toggle", t);
				break;
			case "input":
				J("invalid", t), fn(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				J("invalid", t);
				break;
			case "textarea": J("invalid", t), gn(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || ip(t.textContent, n) ? (r.popover != null && (J("beforetoggle", t), J("toggle", t)), r.onScroll != null && J("scroll", t), r.onScrollEnd != null && J("scrollend", t), r.onClick != null && (t.onclick = Tn), t = !0) : t = !1, t || fa(e, !0);
	}
	function ma(e) {
		for (P = e.return; P;) switch (P.tag) {
			case 5:
			case 31:
			case 13:
				ua = !1;
				return;
			case 27:
			case 3:
				ua = !0;
				return;
			default: P = P.return;
		}
	}
	function ha(e) {
		if (e !== P) return !1;
		if (!I) return ma(e), I = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = n === "form" || n === "button" || _p(e.type, e.memoizedProps)), n = !n), n && F && fa(e), ma(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			F = mm(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			F = mm(e);
		} else t === 27 ? (t = F, Ep(e.type) ? (e = pm, pm = null, F = e) : F = t) : F = P ? fm(e.stateNode.nextSibling) : null;
		return !0;
	}
	function ga() {
		F = P = null, I = !1;
	}
	function _a() {
		var e = la;
		return e !== null && (gd === null ? gd = e : gd.push.apply(gd, e), la = null), e;
	}
	function va(e) {
		la === null ? la = [e] : la.push(e);
	}
	var ya = we(null), ba = null, xa = null;
	function Sa(e, t, n) {
		Ee(ya, t._currentValue), t._currentValue = n;
	}
	function Ca(e) {
		e._currentValue = ya.current, Te(ya);
	}
	function wa(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function Ta(e, t, n, r) {
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
						o.lanes |= n, c = o.alternate, c !== null && (c.lanes |= n), wa(o.return, n, e), r || (s = null);
						break a;
					}
					o = c.next;
				}
			} else if (a.tag === 18) {
				if (s = a.return, s === null) throw Error(i(341));
				s.lanes |= n, o = s.alternate, o !== null && (o.lanes |= n), wa(s, n, e), s = null;
			} else a.tag === 13 && a.memoizedState !== null && a.memoizedState.dehydrated === null ? (a.lanes |= n, s = a.alternate, s !== null && (s.lanes |= n), wa(a.return, n, e), s = a.child, s = s === null ? null : s.sibling) : s = a.child;
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
	function Ea(e, t, n, r) {
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
					Jr(a.pendingProps.value, s.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (a === Ae.current) {
				if (s = a.alternate, s === null) throw Error(i(387));
				s.memoizedState.memoizedState !== a.memoizedState.memoizedState && (e === null ? e = [uh] : e.push(uh));
			}
			a = a.return;
		}
		return e !== null && Ta(t, e, n, r), t.flags |= 262144, e !== null;
	}
	function Da(e) {
		for (e = e.firstContext; e !== null;) {
			if (!Jr(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function Oa(e) {
		ba = e, xa = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function ka(e) {
		return ja(ba, e);
	}
	function Aa(e, t) {
		return ba === null && Oa(e), ja(e, t);
	}
	function ja(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, xa === null) {
			if (e === null) throw Error(i(308));
			xa = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else xa = xa.next = t;
		return n;
	}
	var Ma = typeof AbortController < "u" ? AbortController : function() {
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
	}, Na = t.unstable_scheduleCallback, Pa = t.unstable_NormalPriority, L = {
		$$typeof: se,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function Fa() {
		return {
			controller: new Ma(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function Ia(e) {
		e.refCount--, e.refCount === 0 && Na(Pa, function() {
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
			Va = 0, Ha = Rf(), Ua = {
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
	var qa = A.S;
	A.S = function(e, t) {
		if (yd = qe(), typeof t == "object" && t && typeof t.then == "function" && Wa(e, t), Ra !== null) for (var n = wf; n !== null;) La(n, Ra), n = n.next;
		if (n = e.types, n !== null) {
			for (var r = wf; r !== null;) La(r, n), r = r.next;
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
	var Ja = we(null);
	function Ya() {
		var e = Ja.current;
		return e === null ? rd.pooledCache : e;
	}
	function Xa(e, t) {
		t === null ? Ee(Ja, Ja.current) : Ee(Ja, t.pool);
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
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(Tn, Tn), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, so(e), e === void 0 && !("reason" in t) ? Error(i(600)) : e;
			default:
				if (typeof t.status == "string") t.then(Tn, Tn);
				else {
					if (e = rd, e !== null && 100 < e.shellSuspendCounter) throw Error(i(482));
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
	var co = null, lo = 0;
	function R(e) {
		var t = lo;
		return lo += 1, co === null && (co = []), ro(co, e, t);
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
			return e = N(e, t), e.index = 0, e.sibling = null, e;
		}
		function o(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 134217730, n) : (r = r.index, r < n ? (t.flags |= 2, n) : r)) : (t.flags |= 1048576, n);
		}
		function s(t) {
			return e && t.alternate === null && (t.flags |= 134217730), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = Wi(n, e.mode, r), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var i = n.type;
			return i === re ? (e = d(e, t, n.props.children, r, n.key), uo(e, n), e) : t !== null && (t.elementType === i || typeof i == "object" && i && i.$$typeof === de && io(i) === t.type) ? (t = a(t, n.props), uo(t, n), t.return = e, t) : (t = Hi(n.type, n.key, n.props, null, e.mode, r), uo(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = Ki(n, e.mode, r), t.return = e, t) : (t = a(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, i) {
			return t === null || t.tag !== 7 ? (t = Ui(n, e.mode, r, i), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = Wi("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case te: return n = Hi(t.type, t.key, t.props, null, e.mode, n), uo(n, t), n.return = e, n;
					case ne: return t = Ki(t, e.mode, n), t.return = e, t;
					case de: return t = io(t), f(e, t, n);
				}
				if (be(t) || _e(t)) return t = Ui(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, R(t), n);
				if (t.$$typeof === se) return f(e, Aa(e, t), n);
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
					case de: return n = io(n), p(e, t, n, r);
				}
				if (be(n) || _e(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, R(n), r);
				if (n.$$typeof === se) return p(e, t, Aa(e, n), r);
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
					case de: return r = io(r), m(e, t, n, r, i);
				}
				if (be(r) || _e(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, R(r), i);
				if (r.$$typeof === se) return m(e, t, n, Aa(t, r), i);
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
			if (h === s.length) return n(i, d), I && ia(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (a = o(d, a, h), u === null ? l = d : u.sibling = d, u = d);
				return I && ia(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && (_ = g.alternate, _ !== null && d.delete(_.key === null ? h : _.key)), a = o(g, a, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), I && ia(i, h), l;
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
			if (v.done) return n(a, h), I && ia(a, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(a, v.value, l), v !== null && (s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
				return I && ia(a, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, a, g, v.value, l), v !== null && (e && (_ = v.alternate, _ !== null && h.delete(_.key === null ? g : _.key)), s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(a, e);
			}), I && ia(a, g), u;
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
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === de && io(l) === r.type) {
										n(e, r.sibling), c = a(r, o.props), uo(c, o), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							o.type === re ? (c = Ui(o.props.children, e.mode, c, o.key), uo(c, o), c.return = e, e = c) : (c = Hi(o.type, o.key, o.props, null, e.mode, c), uo(c, o), c.return = e, e = c);
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
							c = Ki(o, e.mode, c), c.return = e, e = c;
						}
						return s(e);
					case de: return o = io(o), _(e, r, o, c);
				}
				if (be(o)) return h(e, r, o, c);
				if (_e(o)) {
					if (l = _e(o), typeof l != "function") throw Error(i(150));
					return o = l.call(o), g(e, r, o, c);
				}
				if (typeof o.then == "function") return _(e, r, R(o), c);
				if (o.$$typeof === se) return _(e, r, Aa(e, o), c);
				fo(e, o);
			}
			return typeof o == "string" && o !== "" || typeof o == "number" || typeof o == "bigint" ? (o = "" + o, r !== null && r.tag === 6 ? (n(e, r.sibling), c = a(r, o), c.return = e, e = c) : (n(e, r), c = Wi(o, e.mode, c), c.return = e, e = c), s(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				lo = 0;
				var i = _(e, t, n, r);
				return co = null, i;
			} catch (t) {
				if (t === Qa || t === eo) throw t;
				var a = zi(29, t, null, e.mode);
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
		if (r = r.shared, U & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Ii(e), Fi(e, null, n), t;
		}
		return Mi(e, r, t, n), Ii(e);
	}
	function xo(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, St(e, n);
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
				if (p ? (G & f) === f : (r & f) === f) {
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
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), ud |= o, e.lanes = o, e.memoizedState = d;
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
	var Oo = we(null), ko = we(0);
	function Ao(e, t) {
		e = cd, Ee(ko, e), Ee(Oo, t), cd = e | t.baseLanes;
	}
	function jo() {
		Ee(ko, cd), Ee(Oo, Oo.current);
	}
	function Mo() {
		cd = ko.current, Te(Oo), Te(ko);
	}
	var No = we(null), Po = null;
	function Fo(e) {
		var t = e.alternate;
		Ee(zo, zo.current & 1), Ee(No, e), Po === null && (t === null || Oo.current !== null || t.memoizedState !== null) && (Po = e);
	}
	function Io(e) {
		Ee(zo, zo.current), Ee(No, e), Po === null && (Po = e);
	}
	function Lo(e) {
		e.tag === 22 ? (Ee(zo, zo.current), Ee(No, e), Po === null && (Po = e)) : z();
	}
	function z() {
		Ee(zo, zo.current), Ee(No, No.current);
	}
	function Ro(e) {
		Te(No), Po === e && (Po = null), Te(zo);
	}
	var zo = we(0);
	function Bo(e, t) {
		Ee(No, No.current), Ee(zo, t);
	}
	function Vo(e) {
		Te(zo), Te(No), Po === e && (Po = null);
	}
	function Ho(e) {
		for (var t = e; t !== null;) {
			if (t.tag === 13) {
				var n = t.memoizedState;
				if (n !== null && (n = n.dehydrated, n === null || lm(n) || um(n))) return t;
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
	var Uo = 0, B = null, Wo = null, Go = null, Ko = !1, qo = !1, Jo = !1, Yo = 0, Xo = 0, Zo = null, Qo = 0;
	function $o() {
		throw Error(i(321));
	}
	function es(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!Jr(e[n], t[n])) return !1;
		return !0;
	}
	function ts(e, t, n, r, i, a) {
		return Uo = a, B = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, A.H = e === null || e.memoizedState === null ? vc : yc, Jo = !1, a = n(r, i), Jo = !1, qo && (a = rs(t, n, r, i)), ns(e), a;
	}
	function ns(e) {
		A.H = _c;
		var t = Wo !== null && Wo.next !== null;
		if (Uo = 0, Go = Wo = B = null, Ko = !1, Xo = 0, Zo = null, t) throw Error(i(300));
		e === null || Ic || (e = e.dependencies, e !== null && Da(e) && (Ic = !0));
	}
	function rs(e, t, n, r) {
		B = e;
		var a = 0;
		do {
			if (qo && (Zo = null), Xo = 0, qo = !1, 25 <= a) throw Error(i(301));
			if (a += 1, Go = Wo = null, e.updateQueue != null) {
				var o = e.updateQueue;
				o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
			}
			A.H = bc, o = t(n, r);
		} while (qo);
		return o;
	}
	function is() {
		var e = A.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? ds(t) : t, e = e.useState()[0], (Wo === null ? null : Wo.memoizedState) !== e && (B.flags |= 1024), t;
	}
	function as() {
		var e = Yo !== 0;
		return Yo = 0, e;
	}
	function os(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function ss(e) {
		if (Ko) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			Ko = !1;
		}
		Uo = 0, Go = Wo = B = null, qo = !1, Xo = Yo = 0, Zo = null;
	}
	function cs() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return Go === null ? B.memoizedState = Go = e : Go = Go.next = e, Go;
	}
	function ls() {
		if (Wo === null) {
			var e = B.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = Wo.next;
		var t = Go === null ? B.memoizedState : Go.next;
		if (t !== null) Go = t, Wo = e;
		else {
			if (e === null) throw B.alternate === null ? Error(i(467)) : Error(i(310));
			Wo = e, e = {
				memoizedState: Wo.memoizedState,
				baseState: Wo.baseState,
				baseQueue: Wo.baseQueue,
				queue: Wo.queue,
				next: null
			}, Go === null ? B.memoizedState = Go = e : Go = Go.next = e;
		}
		return Go;
	}
	function us() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function ds(e) {
		var t = Xo;
		return Xo += 1, Zo === null && (Zo = []), e = ro(Zo, e, t), t = B, (Go === null ? t.memoizedState : Go.next) === null && (t = t.alternate, A.H = t === null || t.memoizedState === null ? vc : yc), e;
	}
	function fs(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return ds(e);
			if (e.$$typeof === k) return;
			if (e.$$typeof === se) return ka(e);
		}
		throw Error(i(438, String(e)));
	}
	function ps(e) {
		var t = null, n = B.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = B.alternate;
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
		}, n === null && (n = us(), B.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = me;
		return t.index++, n;
	}
	function ms(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function hs(e) {
		return gs(ls(), Wo, e);
	}
	function gs(e, t, n) {
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
				if (f === u.lane ? (Uo & f) === f : (G & f) === f) {
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
					else if ((Uo & p) === p) {
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
					}, l === null ? (c = l = f, s = o) : l = l.next = f, B.lanes |= p, ud |= p;
					f = u.action, Jo && n(o, f), o = u.hasEagerState ? u.eagerState : n(o, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, s = o) : l = l.next = p, B.lanes |= f, ud |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? s = o : l.next = c, !Jr(o, e.memoizedState) && (Ic = !0, d && (n = Ua, n !== null))) throw n;
			e.memoizedState = o, e.baseState = s, e.baseQueue = l, r.lastRenderedState = o;
		}
		return a === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function _s(e) {
		var t = ls(), n = t.queue;
		if (n === null) throw Error(i(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, a = n.pending, o = t.memoizedState;
		if (a !== null) {
			n.pending = null;
			var s = a = a.next;
			do
				o = e(o, s.action), s = s.next;
			while (s !== a);
			Jr(o, t.memoizedState) || (Ic = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
		}
		return [o, r];
	}
	function vs(e, t, n) {
		var r = B, a = ls(), o = I;
		if (o) {
			if (n === void 0) throw Error(i(407));
			n = n();
		} else n = t();
		var s = !Jr((Wo || a).memoizedState, n);
		if (s && (a.memoizedState = n, Ic = !0), a = a.queue, Us(xs.bind(null, r, a, e), [e]), e = a.getSnapshot !== t || s || Go !== null && !!(Go.memoizedState.tag & 1), Rs(e ? 9 : 8, { destroy: void 0 }, bs.bind(null, r, a, n, t), null), e) {
			if (r.flags |= 2048, rd === null) throw Error(i(349));
			o || Uo & 127 || ys(r, t, n);
		}
		return n;
	}
	function ys(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = B.updateQueue, t === null ? (t = us(), B.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function bs(e, t, n, r) {
		t.value = n, t.getSnapshot = r, Ss(t) && Cs(e);
	}
	function xs(e, t, n) {
		return n(function() {
			Ss(t) && Cs(e);
		});
	}
	function Ss(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !Jr(e, n);
		} catch {
			return !0;
		}
	}
	function Cs(e) {
		var t = Pi(e, 2);
		t !== null && Rd(t, e, 2);
	}
	function ws(e) {
		var t = cs();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), Jo) {
				it(!0);
				try {
					n();
				} finally {
					it(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: ms,
			lastRenderedState: e
		}, t;
	}
	function Ts(e, t, n, r) {
		return e.baseState = n, gs(e, Wo, typeof r == "function" ? r : ms);
	}
	function Es(e, t, n, r, a) {
		if (mc(e)) throw Error(i(485));
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
			A.T === null ? o.isTransition = !1 : n(!0), r(o), n = t.pending, n === null ? (o.next = t.pending = o, Ds(t, o)) : (o.next = n.next, t.pending = n.next = o);
		}
	}
	function Ds(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = A.T, o = {};
			o.types = a === null ? null : a.types, A.T = o;
			try {
				var s = n(i, r), c = A.S;
				c !== null && c(o, s), Os(e, t, s);
			} catch (n) {
				As(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), A.T = a;
			}
		} else try {
			a = n(i, r), Os(e, t, a);
		} catch (n) {
			As(e, t, n);
		}
	}
	function Os(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			ks(e, t, n);
		}, function(n) {
			return As(e, t, n);
		}) : ks(e, t, n);
	}
	function ks(e, t, n) {
		t.status = "fulfilled", t.value = n, js(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, Ds(e, n)));
	}
	function As(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, js(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function js(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function Ms(e, t) {
		return t;
	}
	function Ns(e, t) {
		if (I) {
			var n = rd.formState;
			if (n !== null) {
				a: {
					var r = B;
					if (I) {
						if (F) {
							b: {
								for (var i = F, a = ua; i.nodeType !== 8;) {
									if (!a) {
										i = null;
										break b;
									}
									if (i = fm(i.nextSibling), i === null) {
										i = null;
										break b;
									}
								}
								a = i.data, i = a === "F!" || a === "F" ? i : null;
							}
							if (i) {
								F = fm(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						fa(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = cs(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: Ms,
			lastRenderedState: t
		}, n.queue = r, n = dc.bind(null, B, r), r.dispatch = n, r = ws(!1), a = pc.bind(null, B, !1, r.queue), r = cs(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = Es.bind(null, B, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function Ps(e) {
		return Fs(ls(), Wo, e);
	}
	function Fs(e, t, n) {
		if (t = gs(e, t, Ms)[0], e = hs(ms)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = ds(t);
		} catch (e) {
			throw e === Qa ? eo : e;
		}
		else r = t;
		t = ls();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (B.flags |= 2048, Rs(9, { destroy: void 0 }, Is.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function Is(e, t) {
		e.action = t;
	}
	function Ls(e) {
		var t = ls(), n = Wo;
		if (n !== null) return Fs(t, n, e);
		ls(), t = t.memoizedState, n = ls();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function Rs(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = B.updateQueue, t === null && (t = us(), B.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function zs() {
		return ls().memoizedState;
	}
	function Bs(e, t, n, r) {
		var i = cs();
		B.flags |= e, i.memoizedState = Rs(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function Vs(e, t, n, r) {
		var i = ls();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		Wo !== null && r !== null && es(r, Wo.memoizedState.deps) ? i.memoizedState = Rs(t, a, n, r) : (B.flags |= e, i.memoizedState = Rs(1 | t, a, n, r));
	}
	function Hs(e, t) {
		Bs(8390656, 8, e, t);
	}
	function Us(e, t) {
		Vs(2048, 8, e, t);
	}
	function Ws(e) {
		B.flags |= 4;
		var t = B.updateQueue;
		if (t === null) t = us(), B.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function Gs(e) {
		var t = ls().memoizedState;
		return Ws({
			ref: t,
			nextImpl: e
		}), function() {
			if (U & 2) throw Error(i(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function Ks(e, t) {
		return Vs(4, 2, e, t);
	}
	function qs(e, t) {
		return Vs(4, 4, e, t);
	}
	function Js(e, t) {
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
	function Ys(e, t, n) {
		n = n == null ? null : n.concat([e]), Vs(4, 4, Js.bind(null, t, e), n);
	}
	function Xs() {}
	function Zs(e, t) {
		var n = ls();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && es(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function Qs(e, t) {
		var n = ls();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && es(t, r[1])) return r[0];
		if (r = e(), Jo) {
			it(!0);
			try {
				e();
			} finally {
				it(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function $s(e, t, n) {
		return n === void 0 || Uo & 1073741824 && !(G & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = Id(), B.lanes |= e, ud |= e, n);
	}
	function ec(e, t, n, r) {
		return Jr(n, t) ? n : Oo.current === null ? !(Uo & 106) || Uo & 1073741824 && !(G & 261930) ? (Ic = !0, e.memoizedState = n) : (e = Id(), B.lanes |= e, ud |= e, t) : (e = $s(e, n, r), Jr(e, t) || (Ic = !0), e);
	}
	function tc(e, t, n, r, i) {
		var a = j.p;
		j.p = a !== 0 && 8 > a ? a : 8;
		var o = A.T, s = {};
		s.types = o === null ? null : o.types, A.T = s, pc(e, !1, t, n);
		try {
			var c = i(), l = A.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? fc(e, t, Ka(c, r), Fd(e)) : fc(e, t, r, Fd(e));
		} catch (n) {
			fc(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, Fd());
		} finally {
			j.p = a, o !== null && s.types !== null && (o.types = s.types), A.T = o;
		}
	}
	function nc() {}
	function rc(e, t, n, r) {
		if (e.tag !== 5) throw Error(i(476));
		var a = ic(e).queue;
		tc(e, a, t, xe, n === null ? nc : function() {
			return ac(e), n(r);
		});
	}
	function ic(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: xe,
			baseState: xe,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: ms,
				lastRenderedState: xe
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
				lastRenderedReducer: ms,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function ac(e) {
		var t = ic(e);
		t.next === null && (t = e.alternate.memoizedState), fc(e, t.next.queue, {}, Fd());
	}
	function oc() {
		return ka(uh);
	}
	function sc() {
		return ls().memoizedState;
	}
	function cc() {
		return ls().memoizedState;
	}
	function lc(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = Fd();
					e = yo(n);
					var r = bo(t, e, n);
					r !== null && (Rd(r, t, n), xo(r, t, n)), t = { cache: Fa() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function uc(e, t, n) {
		var r = Fd();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, mc(e) ? hc(t, n) : (n = Ni(e, t, n, r), n !== null && (Rd(n, e, r), gc(n, t, r)));
	}
	function dc(e, t, n) {
		fc(e, t, n, Fd());
	}
	function fc(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (mc(e)) hc(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, Jr(s, o)) return Mi(e, t, i, 0), rd === null && ji(), !1;
			} catch {}
			if (n = Ni(e, t, i, r), n !== null) return Rd(n, e, r), gc(n, t, r), !0;
		}
		return !1;
	}
	function pc(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: Rf(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, mc(e)) {
			if (t) throw Error(i(479));
		} else t = Ni(e, n, r, 2), t !== null && Rd(t, e, 2);
	}
	function mc(e) {
		var t = e.alternate;
		return e === B || t !== null && t === B;
	}
	function hc(e, t) {
		qo = Ko = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function gc(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, St(e, n);
		}
	}
	var _c = {
		readContext: ka,
		use: fs,
		useCallback: $o,
		useContext: $o,
		useEffect: $o,
		useImperativeHandle: $o,
		useLayoutEffect: $o,
		useInsertionEffect: $o,
		useMemo: $o,
		useReducer: $o,
		useRef: $o,
		useState: $o,
		useDebugValue: $o,
		useDeferredValue: $o,
		useTransition: $o,
		useSyncExternalStore: $o,
		useId: $o,
		useHostTransitionStatus: $o,
		useFormState: $o,
		useActionState: $o,
		useOptimistic: $o,
		useMemoCache: $o,
		useCacheRefresh: $o,
		useEffectEvent: $o
	}, vc = {
		readContext: ka,
		use: fs,
		useCallback: function(e, t) {
			return cs().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: ka,
		useEffect: Hs,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), Bs(4194308, 4, Js.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return Bs(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			Bs(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = cs();
			t = t === void 0 ? null : t;
			var r = e();
			if (Jo) {
				it(!0);
				try {
					e();
				} finally {
					it(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = cs();
			if (n !== void 0) {
				var i = n(t);
				if (Jo) {
					it(!0);
					try {
						n(t);
					} finally {
						it(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = uc.bind(null, B, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = cs();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = ws(e);
			var t = e.queue, n = dc.bind(null, B, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: Xs,
		useDeferredValue: function(e, t) {
			return $s(cs(), e, t);
		},
		useTransition: function() {
			var e = ws(!1);
			return e = tc.bind(null, B, e.queue, !0, !1), cs().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = B, a = cs();
			if (I) {
				if (n === void 0) throw Error(i(407));
				n = n();
			} else {
				if (n = t(), rd === null) throw Error(i(349));
				G & 127 || ys(r, t, n);
			}
			a.memoizedState = n;
			var o = {
				value: n,
				getSnapshot: t
			};
			return a.queue = o, Hs(xs.bind(null, r, o, e), [e]), r.flags |= 2048, Rs(9, { destroy: void 0 }, bs.bind(null, r, o, n, t), null), n;
		},
		useId: function() {
			var e = cs(), t = rd.identifierPrefix;
			if (I) {
				var n = ra, r = na;
				n = (r & ~(1 << 32 - at(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = Yo++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = Qo++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: oc,
		useFormState: Ns,
		useActionState: Ns,
		useOptimistic: function(e) {
			var t = cs();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = pc.bind(null, B, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: ps,
		useCacheRefresh: function() {
			return cs().memoizedState = lc.bind(null, B);
		},
		useEffectEvent: function(e) {
			var t = cs(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (U & 2) throw Error(i(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, yc = {
		readContext: ka,
		use: fs,
		useCallback: Zs,
		useContext: ka,
		useEffect: Us,
		useImperativeHandle: Ys,
		useInsertionEffect: Ks,
		useLayoutEffect: qs,
		useMemo: Qs,
		useReducer: hs,
		useRef: zs,
		useState: function() {
			return hs(ms);
		},
		useDebugValue: Xs,
		useDeferredValue: function(e, t) {
			return ec(ls(), Wo.memoizedState, e, t);
		},
		useTransition: function() {
			var e = hs(ms)[0], t = ls().memoizedState;
			return [typeof e == "boolean" ? e : ds(e), t];
		},
		useSyncExternalStore: vs,
		useId: sc,
		useHostTransitionStatus: oc,
		useFormState: Ps,
		useActionState: Ps,
		useOptimistic: function(e, t) {
			return Ts(ls(), Wo, e, t);
		},
		useMemoCache: ps,
		useCacheRefresh: cc,
		useEffectEvent: Gs
	}, bc = {
		readContext: ka,
		use: fs,
		useCallback: Zs,
		useContext: ka,
		useEffect: Us,
		useImperativeHandle: Ys,
		useInsertionEffect: Ks,
		useLayoutEffect: qs,
		useMemo: Qs,
		useReducer: _s,
		useRef: zs,
		useState: function() {
			return _s(ms);
		},
		useDebugValue: Xs,
		useDeferredValue: function(e, t) {
			var n = ls();
			return Wo === null ? $s(n, e, t) : ec(n, Wo.memoizedState, e, t);
		},
		useTransition: function() {
			var e = _s(ms)[0], t = ls().memoizedState;
			return [typeof e == "boolean" ? e : ds(e), t];
		},
		useSyncExternalStore: vs,
		useId: sc,
		useHostTransitionStatus: oc,
		useFormState: Ls,
		useActionState: Ls,
		useOptimistic: function(e, t) {
			var n = ls();
			return Wo === null ? (n.baseState = e, [e, n.queue.dispatch]) : Ts(n, Wo, e, t);
		},
		useMemoCache: ps,
		useCacheRefresh: cc,
		useEffectEvent: Gs
	};
	function xc(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : D({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var Sc = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = Fd(), i = yo(r);
			i.payload = t, n != null && (i.callback = n), t = bo(e, i, r), t !== null && (Rd(t, e, r), xo(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = Fd(), i = yo(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = bo(e, i, r), t !== null && (Rd(t, e, r), xo(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = Fd(), r = yo(n);
			r.tag = 2, t != null && (r.callback = t), t = bo(e, r, n), t !== null && (Rd(t, e, n), xo(t, e, n));
		}
	};
	function Cc(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !Yr(n, r) || !Yr(i, a) : !0;
	}
	function wc(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && Sc.enqueueReplaceState(t, t.state, null);
	}
	function Tc(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = D({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function Ec(e) {
		Di(e);
	}
	function Dc(e) {
		console.error(e);
	}
	function Oc(e) {
		Di(e);
	}
	function kc(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Ac(e, t, n) {
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
	function jc(e, t, n) {
		return n = yo(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			kc(e, t);
		}, n;
	}
	function Mc(e) {
		return e = yo(e), e.tag = 3, e;
	}
	function Nc(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				Ac(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			Ac(t, n, r), typeof i != "function" && (Sd === null ? Sd = /* @__PURE__ */ new Set([this]) : Sd.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function Pc(e, t, n, r, a) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && Ea(t, n, a, !0), n = No.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13:
					case 19: return Po === null ? Xd() : n.alternate === null && ld === 0 && (ld = 3), n.flags &= -257, n.flags |= 65536, n.lanes = a, r === to ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), vf(e, r, a)), !1;
					case 22: return n.flags |= 65536, r === to ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), vf(e, r, a)), !1;
				}
				throw Error(i(435, n.tag));
			}
			return vf(e, r, a), Xd(), !1;
		}
		if (I) return t = No.current, t === null ? (r !== da && (t = Error(i(423), { cause: r }), va(Ji(t, n))), e = e.current.alternate, e.flags |= 65536, a &= -a, e.lanes |= a, r = Ji(r, n), a = jc(e.stateNode, r, a), So(e, a), ld !== 4 && (ld = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = a, r !== da && (e = Error(i(422), { cause: r }), va(Ji(e, n)))), !1;
		var o = Error(i(520), { cause: r });
		if (o = Ji(o, n), hd === null ? hd = [o] : hd.push(o), ld !== 4 && (ld = 2), t === null) return !0;
		r = Ji(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = a & -a, n.lanes |= e, e = jc(n.stateNode, r, e), So(n, e), !1;
				case 1:
					if (t = n.type, o = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (Sd === null || !Sd.has(o)))) return n.flags |= 65536, a &= -a, n.lanes |= a, a = Mc(a), Nc(a, e, n, r), So(n, a), !1;
					break;
				case 22: if (n.memoizedState !== null) return n.flags |= 65536, !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var Fc = Error(i(461)), Ic = !1;
	function Lc(e, t, n, r) {
		t.child = e === null ? ho(t, null, n, r) : mo(t, e.child, n, r);
	}
	function Rc(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return Oa(t), r = ts(e, t, n, o, a, i), s = as(), e !== null && !Ic ? (os(e, t, i), fl(e, t, i)) : (I && s && oa(t), t.flags |= 1, Lc(e, t, r, i), t.child);
	}
	function zc(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !Bi(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, Bc(e, t, a, r, i)) : (e = Hi(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !pl(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? Yr : n, n(o, r) && e.ref === t.ref) return fl(e, t, i);
		}
		return t.flags |= 1, e = N(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function Bc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (Yr(a, r) && e.ref === t.ref) {
				if (Ic = !1, t.pendingProps = r = a, pl(e, i)) e.flags & 131072 && (Ic = !0);
				else return t.lanes = e.lanes, fl(e, t, i);
			}
		}
		return Jc(e, t, n, r, i);
	}
	function Vc(e, t, n, r) {
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
				return Uc(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && Xa(t, a === null ? null : a.cachePool), a === null ? jo() : Ao(t, a), Lo(t);
			else return r = t.lanes = 536870912, Uc(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && Xa(t, null), jo(), z()) : (Xa(t, a.cachePool), Ao(t, a), z(), t.memoizedState = null);
		return Lc(e, t, i, n), t.child;
	}
	function Hc(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function Uc(e, t, n, r, i) {
		var a = Ya();
		return a = a === null ? null : {
			parent: L._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && Xa(t, null), jo(), Lo(t), e !== null && Ea(e, t, r, !0), t.childLanes = i, null;
	}
	function Wc(e, t) {
		return t = rl({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function Gc(e, t, n) {
		return mo(t, e.child, null, n), e = Wc(t, t.pendingProps), e.flags |= 2, Ro(t), t.memoizedState = null, e;
	}
	function Kc(e, t, n) {
		var r = t.pendingProps, a = !!(t.flags & 128);
		if (t.flags &= -129, e === null) {
			if (I) {
				if (r.mode === "hidden") return e = Wc(t, r), t.lanes = 536870912, e.memoizedState = {
					baseLanes: 0,
					cachePool: null
				}, Hc(null, e);
				if (Io(t), (e = F) ? (e = cm(e, ua), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: ta === null ? null : {
						id: na,
						overflow: ra
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Gi(e), n.return = t, t.child = n, P = t, F = null)) : e = null, e === null) throw fa(t);
				return t.lanes = 536870912, null;
			}
			return Wc(t, r);
		}
		var o = e.memoizedState;
		if (o !== null) {
			var s = o.dehydrated;
			if (Io(t), a) {
				if (t.flags & 256) t.flags &= -257, t = Gc(e, t, n);
				else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
				else throw Error(i(558));
			} else if (Ic || Ea(e, t, n, !1), a = (n & e.childLanes) !== 0, Ic || a) {
				if (Oo.current === null) {
					if (r = rd, r !== null && (s = Ct(r, n), s !== 0 && s !== o.retryLane)) throw o.retryLane = s, Pi(e, s), Rd(r, e, s), Fc;
					Xd();
				}
				t = Gc(e, t, n);
			} else e = o.treeContext, F = fm(s.nextSibling), P = t, I = !0, la = null, ua = !1, e !== null && ca(t, e), t = Wc(t, r), t.flags |= 134221824;
			return t;
		}
		return e = N(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function qc(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(i(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function Jc(e, t, n, r, i) {
		return Oa(t), n = ts(e, t, n, r, void 0, i), r = as(), e !== null && !Ic ? (os(e, t, i), fl(e, t, i)) : (I && r && oa(t), t.flags |= 1, Lc(e, t, n, i), t.child);
	}
	function Yc(e, t, n, r, i, a) {
		return Oa(t), t.updateQueue = null, n = rs(t, r, n, i), ns(e), r = as(), e !== null && !Ic ? (os(e, t, a), fl(e, t, a)) : (I && r && oa(t), t.flags |= 1, Lc(e, t, n, a), t.child);
	}
	function Xc(e, t, n, r, i) {
		if (Oa(t), t.stateNode === null) {
			var a = Li, o = n.contextType;
			typeof o == "object" && o && (a = ka(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = Sc, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, _o(t), o = n.contextType, a.context = typeof o == "object" && o ? ka(o) : Li, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (xc(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && Sc.enqueueReplaceState(a, a.state, null), To(t, r, a, i), wo(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = Tc(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = Li, typeof u == "object" && u && (o = ka(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && wc(t, a, r, o), go = !1;
			var f = t.memoizedState;
			a.state = f, To(t, r, a, i), wo(), l = t.memoizedState, s || f !== l || go ? (typeof d == "function" && (xc(t, n, d, r), l = t.memoizedState), (c = go || Cc(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, vo(e, t), o = t.memoizedProps, u = Tc(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = Li, typeof l == "object" && l && (c = ka(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && wc(t, a, r, c), go = !1, f = t.memoizedState, a.state = f, To(t, r, a, i), wo();
			var p = t.memoizedState;
			o !== d || f !== p || go || e !== null && e.dependencies !== null && Da(e.dependencies) ? (typeof s == "function" && (xc(t, n, s, r), p = t.memoizedState), (u = go || Cc(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && Da(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, qc(e, t), r = !!(t.flags & 128), a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = mo(t, e.child, null, i), t.child = mo(t, null, n, i)) : Lc(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = fl(e, t, i), e;
	}
	function Zc(e, t, n, r) {
		return ga(), t.flags |= 256, Lc(e, t, n, r), t.child;
	}
	var Qc = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function $c(e) {
		return {
			baseLanes: e,
			cachePool: Za()
		};
	}
	function el(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= pd), e;
	}
	function tl(e, t, n) {
		var r = t.pendingProps, i = !1, a = !!(t.flags & 128), o;
		if ((o = a) || (o = e !== null && e.memoizedState === null ? !1 : !!(zo.current & 2)), o && (i = !0, t.flags &= -129), o = !!(t.flags & 32), t.flags &= -33, e === null) {
			if (I) {
				if (i ? Fo(t) : z(), (e = F) ? (e = cm(e, ua), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: ta === null ? null : {
						id: na,
						overflow: ra
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Gi(e), n.return = t, t.child = n, P = t, F = null)) : e = null, e === null) throw fa(t);
				return t.lanes = um(e) ? 32 : 536870912, null;
			}
			return a = r.children, r = r.fallback, i ? (z(), i = t.mode, a = rl({
				mode: "hidden",
				children: a
			}, i), r = Ui(r, i, n, null), a.return = t, r.return = t, a.sibling = r, t.child = a, r = t.child, r.memoizedState = $c(n), r.childLanes = el(e, o, n), t.memoizedState = Qc, Hc(null, r)) : (Fo(t), nl(t, a));
		}
		var s = e.memoizedState;
		if (s !== null) {
			var c = s.dehydrated;
			if (c !== null) return al(e, t, a, o, r, c, s, n);
		}
		return i ? (z(), i = r.fallback, a = t.mode, s = e.child, c = s.sibling, r = N(s, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = s.subtreeFlags & 1206910976, c === null ? (i = Ui(i, a, n, null), i.flags |= 2) : i = N(c, i), i.return = t, r.return = t, r.sibling = i, t.child = r, Hc(null, r), r = t.child, i = e.child.memoizedState, i === null ? i = $c(n) : (a = i.cachePool, a === null ? a = Za() : (s = L._currentValue, a = a.parent === s ? a : {
			parent: s,
			pool: s
		}), i = {
			baseLanes: i.baseLanes | n,
			cachePool: a
		}), r.memoizedState = i, r.childLanes = el(e, o, n), t.memoizedState = Qc, Hc(e.child, r)) : (Fo(t), n = e.child, e = n.sibling, n = N(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (o = t.deletions, o === null ? (t.deletions = [e], t.flags |= 16) : o.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function nl(e, t) {
		return t = rl({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function rl(e, t) {
		return e = zi(22, e, null, t), e.lanes = 0, e;
	}
	function il(e, t, n) {
		return mo(t, e.child, null, n), e = nl(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function al(e, t, n, r, a, o, s, c) {
		if (n) return t.flags & 256 ? (Fo(t), t.flags &= -257, il(e, t, c)) : t.memoizedState === null ? (z(), o = a.fallback, s = t.mode, a = rl({
			mode: "visible",
			children: a.children
		}, s), o = Ui(o, s, c, null), o.flags |= 2, a.return = t, o.return = t, a.sibling = o, t.child = a, mo(t, e.child, null, c), a = t.child, a.memoizedState = $c(c), a.childLanes = el(e, r, c), t.memoizedState = Qc, Hc(null, a)) : (z(), t.child = e.child, t.flags |= 128, null);
		if (Fo(t), um(o)) {
			if (r = o.nextSibling && o.nextSibling.dataset, r) var l = r.dgst;
			return r = l, r !== "" && (a = Error(i(419)), a.stack = "", a.digest = r, va({
				value: a,
				source: null,
				stack: null
			})), il(e, t, c);
		}
		if (Ic || Ea(e, t, c, !1), r = (c & e.childLanes) !== 0, Ic || r) {
			if (Oo.current !== null) return il(e, t, c);
			if (r = rd, r !== null && (a = Ct(r, c), a !== 0 && a !== s.retryLane)) throw s.retryLane = a, Pi(e, a), Rd(r, e, a), Fc;
			return lm(o) || Xd(), il(e, t, c);
		}
		return lm(o) ? (t.flags |= 192, t.child = e.child, null) : (e = s.treeContext, F = fm(o.nextSibling), P = t, I = !0, la = null, ua = !1, e !== null && ca(t, e), t = nl(t, a.children), t.flags |= 134221824, t);
	}
	function ol(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), wa(e.return, t, n);
	}
	function sl(e) {
		for (var t = null; e !== null;) {
			var n = e.alternate;
			n !== null && Ho(n) === null && (t = e), e = e.sibling;
		}
		return t;
	}
	function cl(e, t, n, r, i, a) {
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
	function ll(e) {
		var t = e.child;
		for (e.child = null; t !== null;) {
			var n = t.sibling;
			t.sibling = e.child, e.child = t, t = n;
		}
	}
	function ul(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = zo.current;
		if (t.flags & 128) return Bo(t, o), null;
		var s = !!(o & 2);
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, Bo(t, o), i === "backwards" && e !== null ? (ll(e), Lc(e, t, r, n), ll(e)) : Lc(e, t, r, n), r = I ? Qi : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && ol(e, n, t);
			else if (e.tag === 19) ol(e, n, t);
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
				n = sl(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null, ll(t)), cl(t, !0, i, null, a, r);
				break;
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && Ho(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				cl(t, !0, n, null, a, r);
				break;
			case "together":
				cl(t, !1, null, null, void 0, r);
				break;
			case "independent":
				t.memoizedState = null;
				break;
			default: n = sl(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), cl(t, !1, i, n, a, r);
		}
		return t.child;
	}
	function dl(e, t, n) {
		var r = t.pendingProps;
		return Sa(t, t.type, r.value), Lc(e, t, r.children, n), t.child;
	}
	function fl(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), ud |= t.lanes, (n & t.childLanes) === 0) {
			if (e !== null) {
				if (Ea(e, t, n, !1), (n & t.childLanes) === 0) return null;
			} else return null;
		}
		if (e !== null && t.child !== e.child) throw Error(i(153));
		if (t.child !== null) {
			for (e = t.child, n = N(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = N(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function pl(e, t) {
		return (e.lanes & t) !== 0 || (e = e.dependencies, !!(e !== null && Da(e)));
	}
	function ml(e, t, n) {
		switch (t.tag) {
			case 3:
				je(t, t.stateNode.containerInfo), Sa(t, L, e.memoizedState.cache), ga();
				break;
			case 27:
			case 5:
				Ne(t);
				break;
			case 4:
				je(t, t.stateNode.containerInfo);
				break;
			case 10:
				Sa(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, Io(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) {
					if (r.dehydrated !== null) return Fo(t), t.flags |= 128, null;
					r = Ea(e, t, n, !1);
					var i = t.child.childLanes;
					return r || (n & i) !== 0 ? tl(e, t, n) : (Fo(t), e = fl(e, t, n), e === null ? null : e.sibling);
				}
				Fo(t);
				break;
			case 19:
				if (t.flags & 128) return ul(e, t, n);
				if (i = !!(e.flags & 128), r = (n & t.childLanes) !== 0, r ||= (Ea(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return ul(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), Bo(t, zo.current), r) break;
				return null;
			case 22: return t.lanes = 0, Vc(e, t, n, t.pendingProps);
			case 24: Sa(t, L, e.memoizedState.cache);
		}
		return fl(e, t, n);
	}
	function hl(e, t, n) {
		if (e !== null) {
			if (e.memoizedProps !== t.pendingProps) Ic = !0;
			else {
				if (!pl(e, n) && !(t.flags & 128)) return Ic = !1, ml(e, t, n);
				Ic = !!(e.flags & 131072);
			}
		} else Ic = !1, I && t.flags & 1048576 && aa(t, Qi, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = io(t.elementType), t.type = e, typeof e == "function") Bi(e) ? (r = Tc(e, r), t.tag = 1, t = Xc(null, t, e, r, n)) : (t.tag = 0, t = Jc(null, t, e, r, n));
					else {
						if (e != null) {
							var a = e.$$typeof;
							if (a === O) {
								t.tag = 11, t = Rc(null, t, e, r, n);
								break a;
							}
							if (a === ue) {
								t.tag = 14, t = zc(null, t, e, r, n);
								break a;
							}
							if (a === se) {
								t.tag = 10, t.type = e, t = dl(null, t, n);
								break a;
							}
						}
						throw t = ye(e) || e, Error(i(306, t, ""));
					}
				}
				return t;
			case 0: return Jc(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, a = Tc(r, t.pendingProps), Xc(e, t, r, a, n);
			case 3:
				a: {
					if (je(t, t.stateNode.containerInfo), e === null) throw Error(i(387));
					r = t.pendingProps;
					var o = t.memoizedState;
					a = o.element, vo(e, t), To(t, r, null, n);
					var s = t.memoizedState;
					if (r = s.cache, Sa(t, L, r), r !== o.cache && Ta(t, [L], n, !0), wo(), r = s.element, o.isDehydrated) {
						if (o = {
							element: r,
							isDehydrated: !1,
							cache: s.cache
						}, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
							t = Zc(e, t, r, n);
							break a;
						}
						if (r !== a) {
							a = Ji(Error(i(424)), t), va(a), t = Zc(e, t, r, n);
							break a;
						}
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (F = fm(e.firstChild), P = t, I = !0, la = null, ua = !0, n = ho(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 134221824, n = n.sibling;
					} else {
						if (ga(), r === a) {
							t = fl(e, t, n);
							break a;
						}
						Lc(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return qc(e, t), e === null ? (n = Im(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : I || (t.stateNode = gp(t.type, t.pendingProps, ke.current, t)) : t.memoizedState = Im(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return Ne(t), e === null && I && (r = t.stateNode = vm(t.type, t.pendingProps, ke.current), P = t, ua = !0, a = F, Ep(t.type) ? (pm = a, F = fm(r.firstChild)) : F = a), Lc(e, t, t.pendingProps.children, n), qc(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && I && ((a = r = F) && (r = om(r, t.type, t.pendingProps, ua), r === null ? a = !1 : (t.stateNode = r, P = t, F = fm(r.firstChild), ua = !1, a = !0)), a || fa(t)), Ne(t), a = t.type, o = t.pendingProps, s = e === null ? null : e.memoizedProps, r = o.children, _p(a, o) ? r = null : s !== null && _p(a, s) && (t.flags |= 32), t.memoizedState !== null && (a = ts(e, t, is, null, null, n), uh._currentValue = a), qc(e, t), Lc(e, t, r, n), t.child;
			case 6: return e === null && I && ((e = n = F) && (n = sm(n, t.pendingProps, ua), n === null ? e = !1 : (t.stateNode = n, P = t, F = null, e = !0)), e || fa(t)), null;
			case 13: return tl(e, t, n);
			case 4: return je(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = mo(t, null, r, n) : Lc(e, t, r, n), t.child;
			case 11: return Rc(e, t, t.type, t.pendingProps, n);
			case 7: return r = t.pendingProps, qc(e, t), Lc(e, t, r, n), t.child;
			case 8: return Lc(e, t, t.pendingProps.children, n), t.child;
			case 12: return Lc(e, t, t.pendingProps.children, n), t.child;
			case 10: return dl(e, t, n);
			case 9: return a = t.type._context, r = t.pendingProps.children, Oa(t), a = ka(a), r = r(a), t.flags |= 1, Lc(e, t, r, n), t.child;
			case 14: return zc(e, t, t.type, t.pendingProps, n);
			case 15: return Bc(e, t, t.type, t.pendingProps, n);
			case 19: return ul(e, t, n);
			case 31: return Kc(e, t, n);
			case 22: return Vc(e, t, n, t.pendingProps);
			case 24: return Oa(t), r = ka(L), e === null ? (a = Ya(), a === null && (a = rd, o = Fa(), a.pooledCache = o, o.refCount++, o !== null && (a.pooledCacheLanes |= n), a = o), t.memoizedState = {
				parent: r,
				cache: a
			}, _o(t), Sa(t, L, a)) : ((e.lanes & n) !== 0 && (vo(e, t), To(t, null, null, n), wo()), a = e.memoizedState, o = t.memoizedState, a.parent === r ? (r = o.cache, Sa(t, L, r), r !== a.cache && Ta(t, [L], n, !0)) : (a = {
				parent: r,
				cache: r
			}, t.memoizedState = a, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = a), Sa(t, L, r))), Lc(e, t, t.pendingProps.children, n), t.child;
			case 30: return t.stateNode === null && (t.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}), r = t.pendingProps, r.name != null && r.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : I && oa(t), e !== null && e.memoizedProps.name !== r.name ? t.flags |= 4194816 : qc(e, t), Lc(e, t, r.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(i(156, t.tag));
	}
	function gl(e) {
		e.flags |= 4;
	}
	function _l(e, t, n, r, i) {
		var a;
		if ((a = !!(e.mode & 32)) && (a = n === null ? Zm(t, r) : Zm(t, r) && (r.src !== n.src || r.srcSet !== n.srcSet)), a) {
			if (e.flags |= 16777216, (i & 335544128) === i) {
				if (e.stateNode.complete) e.flags |= 8192;
				else if (qd()) e.flags |= 8192;
				else throw ao = to, $a;
			}
		} else e.flags &= -16777217;
	}
	function vl(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !Qm(t)) {
			if (qd()) e.flags |= 8192;
			else throw ao = to, $a;
		}
	}
	function yl(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : _t(), e.lanes |= t, md |= t);
	}
	function bl(e, t) {
		if (!I) switch (e.tailMode) {
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
	function V(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 1206910976, r |= i.flags & 1206910976, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function xl(e, t, n) {
		var r = t.pendingProps;
		switch (sa(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return V(t), null;
			case 1: return V(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), Ca(L), Me(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (ha(t) ? gl(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, _a())), V(t), null;
			case 26:
				var a = t.type, o = t.memoizedState;
				return e === null ? (gl(t), o === null ? (V(t), _l(t, a, null, r, n)) : (V(t), vl(t, o))) : o ? o === e.memoizedState ? (V(t), t.flags &= -16777217) : (gl(t), V(t), vl(t, o)) : (e = e.memoizedProps, e !== r && gl(t), V(t), _l(t, a, e, r, n)), null;
			case 27:
				if (Pe(t), n = ke.current, a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && gl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return V(t), t.subtreeFlags &= -33554433, null;
					}
					e = De.current, ha(t) ? pa(t, e) : (e = vm(a, r, n), t.stateNode = e, gl(t));
				}
				return V(t), t.subtreeFlags &= -33554433, null;
			case 5:
				if (Pe(t), a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && gl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return V(t), t.subtreeFlags &= -33554433, null;
					}
					if (o = De.current, ha(t)) pa(t, o);
					else {
						var s = pp(ke.current);
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
						o[kt] = t, o[At] = r;
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
						a: switch (op(o, a, r), a) {
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
						r && gl(t);
					}
				}
				return V(t), t.subtreeFlags &= -33554433, _l(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && gl(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(i(166));
					if (e = ke.current, ha(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, a = P, a !== null) switch (a.tag) {
							case 27:
							case 5: r = a.memoizedProps;
						}
						e[kt] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || ip(e.nodeValue, n)), e || fa(t, !0);
					} else e = pp(e).createTextNode(r), e[kt] = t, t.stateNode = e;
				}
				return V(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = ha(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(i(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(557));
							e[kt] = t;
						} else ga(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						V(t), e = !1;
					} else n = _a(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (Ro(t), t) : (Ro(t), null);
					if (t.flags & 128) throw Error(i(558));
				}
				return V(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (a = ha(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!a) throw Error(i(318));
							if (a = t.memoizedState, a = a === null ? null : a.dehydrated, !a) throw Error(i(317));
							a[kt] = t;
						} else ga(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						V(t), a = !1;
					} else a = _a(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), a = !0;
					if (!a) return t.flags & 256 ? (Ro(t), t) : (Ro(t), null);
				}
				return Ro(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, a = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (a = r.alternate.memoizedState.cachePool.pool), o = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (o = r.memoizedState.cachePool.pool), o !== a && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), yl(t, t.updateQueue), V(t), null);
			case 4: return Me(), e === null && Jf(t.stateNode.containerInfo), t.flags |= 67108864, V(t), null;
			case 10: return Ca(t.type), V(t), null;
			case 19:
				if (Vo(t), r = t.memoizedState, r === null) return V(t), null;
				if (a = !!(t.flags & 128), o = r.rendering, o === null) {
					if (a) bl(r, !1);
					else {
						if (ld !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
							if (o = Ho(e), o !== null) {
								for (t.flags |= 128, bl(r, !1), e = o.updateQueue, t.updateQueue = e, yl(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) Vi(n, e), n = n.sibling;
								return Bo(t, zo.current & 1 | 2), I && ia(t, r.treeForkCount), t.child;
							}
							e = e.sibling;
						}
						r.tail !== null && qe() > bd && (t.flags |= 128, a = !0, bl(r, !1), t.lanes = 4194304);
					}
				} else {
					if (!a) {
						if (e = Ho(o), e !== null) {
							if (t.flags |= 128, a = !0, e = e.updateQueue, t.updateQueue = e, yl(t, e), bl(r, !0), r.tail === null && r.tailMode !== "collapsed" && r.tailMode !== "visible" && !o.alternate && !I) return V(t), null;
						} else 2 * qe() - r.renderingStartTime > bd && n !== 536870912 && (t.flags |= 128, a = !0, bl(r, !1), t.lanes = 4194304);
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
					return r.rendering = e, r.tail = e.sibling, r.renderingStartTime = qe(), e.sibling = null, o = zo.current, o = a ? o & 1 | 2 : o & 1, r.tailMode === "visible" || r.tailMode === "collapsed" || !n || I ? Bo(t, o) : (n = o, Ee(No, t), Ee(zo, n), Po === null && (Po = t)), I && ia(t, r.treeForkCount), e;
				}
				return V(t), null;
			case 22:
			case 23: return Ro(t), Mo(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (V(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : V(t), n = t.updateQueue, n !== null && yl(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && Te(Ja), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), Ca(L), V(t), null;
			case 25: return null;
			case 30: return t.flags |= 33554432, V(t), null;
		}
		throw Error(i(156, t.tag));
	}
	function Sl(e, t) {
		switch (sa(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return Ca(L), Me(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return Pe(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (Ro(t), t.alternate === null) throw Error(i(340));
					ga();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (Ro(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(i(340));
					ga();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return Vo(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
			case 4: return Me(), null;
			case 10: return Ca(t.type), null;
			case 22:
			case 23: return Ro(t), Mo(), e !== null && Te(Ja), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return Ca(L), null;
			case 25: return null;
			default: return null;
		}
	}
	function Cl(e, t) {
		switch (sa(t), t.tag) {
			case 3:
				Ca(L), Me();
				break;
			case 26:
			case 27:
			case 5:
				Pe(t);
				break;
			case 4:
				Me();
				break;
			case 31:
				t.memoizedState !== null && Ro(t);
				break;
			case 13:
				Ro(t);
				break;
			case 19:
				Vo(t);
				break;
			case 10:
				Ca(t.type);
				break;
			case 22:
			case 23:
				Ro(t), Mo(), e !== null && Te(Ja);
				break;
			case 24: Ca(L);
		}
	}
	function wl(e, t) {
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
			q(t, t.return, e);
		}
	}
	function Tl(e, t, n) {
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
								q(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			q(t, t.return, e);
		}
	}
	function El(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				Do(t, n);
			} catch (t) {
				q(e, e.return, t);
			}
		}
	}
	function Dl(e, t, n) {
		n.props = Tc(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			q(e, t, n);
		}
	}
	function Ol(e, t) {
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
						var i = e.stateNode, a = wi(e.memoizedProps, i);
						(i.ref === null || i.ref.name !== a) && (i.ref = Lp(a)), r = i.ref;
						break;
					case 7:
						if (e.stateNode === null) {
							var o = new Rp(e);
							h(e.child, !1, tm, o, void 0, void 0), e.stateNode = o;
						}
						r = e.stateNode;
						break;
					default: r = e.stateNode;
				}
				typeof n == "function" ? e.refCleanup = n(r) : n.current = r;
			}
		} catch (n) {
			q(e, t, n);
		}
	}
	function kl(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) {
			if (typeof r == "function") try {
				r();
			} catch (n) {
				q(e, t, n);
			} finally {
				e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
			}
			else if (typeof n == "function") try {
				n(null);
			} catch (n) {
				q(e, t, n);
			}
			else n.current = null;
		}
	}
	function Al(e, t) {
		if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null) for (var n = 0; n < t.length; n++) rm(e.stateNode, t[n]);
	}
	function jl(e) {
		for (var t = e.return; t !== null && (Pl(t) && rm(e.stateNode, t.stateNode), !Nl(t));) t = t.return;
	}
	function Ml(e) {
		for (var t = e.return; t !== null && (Pl(t) && im(e.stateNode, t.stateNode), !Nl(t));) t = t.return;
	}
	function Nl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 27;
	}
	function Pl(e) {
		return e && e.tag === 7 && e.stateNode !== null;
	}
	function Fl(e) {
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
			q(e, e.return, t);
		}
	}
	function Il(e, t, n) {
		try {
			var r = e.stateNode;
			cp(r, e.type, n, t), r[At] = t;
		} catch (t) {
			q(e, e.return, t);
		}
	}
	function Ll(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Ep(e.type) || e.tag === 4;
	}
	function Rl(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Ll(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Ep(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function zl(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(i, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(i), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = Tn)), Al(e, r), M = !0;
		else if (i !== 4 && (i === 27 && (Al(e, r), r = null, Ep(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null)) for (zl(e, t, n, r), e = e.sibling; e !== null;) zl(e, t, n, r), e = e.sibling;
	}
	function Bl(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? n.insertBefore(i, t) : n.appendChild(i), Al(e, r), M = !0;
		else if (i !== 4 && (i === 27 && (Al(e, r), r = null, Ep(e.type) && (n = e.stateNode)), e = e.child, e !== null)) for (Bl(e, t, n, r), e = e.sibling; e !== null;) Bl(e, t, n, r), e = e.sibling;
	}
	function Vl(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			op(t, r, n), t[kt] = e, t[At] = n;
		} catch (t) {
			q(e, e.return, t);
		}
	}
	var Hl = !1, Ul = null;
	function Wl(e) {
		(e.tag === 30 || e.subtreeFlags & 33554432) && (Hl = !0);
	}
	var Gl = null;
	function Kl() {
		var e = Gl;
		return Gl = null, e;
	}
	var ql = 0;
	function Jl(e, t, n, r, i) {
		return ql = 0, Yl(e.child, t, n, r, i);
	}
	function Yl(e, t, n, r, i) {
		for (var a = !1; e !== null;) {
			if (e.tag === 5) {
				var o = e.stateNode;
				if (r !== null) {
					var s = Mp(o);
					r.push(s), s.view && (a = !0);
				} else a || Mp(o).view && (a = !0);
				Hl = !0, kp(o, ql === 0 ? t : t + "_" + ql, n), ql++;
			} else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && i || Yl(e.child, t, n, r, i) && (a = !0));
			e = e.sibling;
		}
		return a;
	}
	function Xl(e, t) {
		for (; e !== null;) e.tag === 5 ? Ap(e.stateNode, e.memoizedProps) : (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && t || Xl(e.child, t)), e = e.sibling;
	}
	function Zl(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if ((e.tag !== 22 || e.memoizedState === null) && (Zl(e), e.tag === 30 && e.flags & 18874368 && e.stateNode.paired)) {
				var t = e.memoizedProps;
				if (t.name == null || t.name === "auto") throw Error(i(544));
				var n = t.name;
				t = Ei(t.default, t.share), t !== "none" && (Jl(e, n, t, null, !1) || Xl(e.child, !1));
			}
			e = e.sibling;
		}
	}
	function Ql(e, t) {
		if (e.tag === 30) {
			var n = e.stateNode, r = e.memoizedProps, i = wi(r, n), a = Ei(r.default, n.paired ? r.share : r.enter);
			a === "none" ? Zl(e) : Jl(e, i, a, null, !1) ? (Zl(e), n.paired || t || Ld(e, r.onEnter)) : Xl(e.child, !1);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Ql(e, t), e = e.sibling;
		else Zl(e);
	}
	function $l(e) {
		if (Ul !== null && Ul.size !== 0) {
			var t = Ul;
			if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
				if (e.tag !== 22 || e.memoizedState === null) {
					if (e.tag === 30 && e.flags & 18874368) {
						var n = e.memoizedProps, r = n.name;
						if (r != null && r !== "auto") {
							var i = t.get(r);
							if (i !== void 0) {
								var a = Ei(n.default, n.share);
								if (a !== "none" && (Jl(e, r, a, null, !1) ? (a = e.stateNode, i.paired = a, a.paired = i, Ld(e, n.onShare)) : Xl(e.child, !1)), t.delete(r), t.size === 0) break;
							}
						}
					}
					$l(e);
				}
				e = e.sibling;
			}
		}
	}
	function eu(e) {
		if (e.tag === 30) {
			var t = e.memoizedProps, n = wi(t, e.stateNode), r = Ul === null ? void 0 : Ul.get(n), i = Ei(t.default, r === void 0 ? t.exit : t.share);
			i !== "none" && (Jl(e, n, i, null, !1) ? r === void 0 ? Ld(e, t.onExit) : (i = e.stateNode, r.paired = i, i.paired = r, Ul.delete(n), Ld(e, t.onShare)) : Xl(e.child, !1)), Ul !== null && $l(e);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) eu(e), e = e.sibling;
		else Ul !== null && $l(e);
	}
	function tu(e) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var t = e.memoizedProps, n = wi(t, e.stateNode);
				t = Ei(t.default, t.update), e.flags &= -5, t !== "none" && Jl(e, n, t, e.memoizedState = [], !1);
			} else e.subtreeFlags & 33554432 && tu(e);
			e = e.sibling;
		}
	}
	function nu(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if (e.tag !== 22 || e.memoizedState === null) {
				if (e.tag === 30 && e.flags & 18874368) {
					var t = e.stateNode;
					t.paired !== null && (t.paired = null, Xl(e.child, !1));
				}
				nu(e);
			}
			e = e.sibling;
		}
	}
	function ru(e) {
		if (e.tag === 30) e.stateNode.paired = null, Xl(e.child, !1), nu(e);
		else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) ru(e), e = e.sibling;
		else nu(e);
	}
	function iu(e) {
		for (e = e.child; e !== null;) e.tag === 30 ? Xl(e.child, !1) : e.subtreeFlags & 33554432 && iu(e), e = e.sibling;
	}
	function au(e, t, n, r, i, a, o) {
		for (var s = !1; t !== null;) {
			if (t.tag === 5) {
				var c = t.stateNode;
				if (a !== null && ql < a.length) {
					var l = a[ql], u = Mp(c);
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
				e.flags & 4 && kp(c, ql === 0 ? n : n + "_" + ql, i), s && e.flags & 4 || (Gl === null && (Gl = []), Gl.push(c, ql === 0 ? r : r + "_" + ql, t.memoizedProps)), ql++;
			} else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && o ? e.flags |= t.flags & 32 : au(e, t.child, n, r, i, a, o) && (s = !0));
			t = t.sibling;
		}
		return s;
	}
	function ou(e, t) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var n = e.memoizedProps, r = e.stateNode, i = wi(n, r), a = Ei(n.default, n.update);
				if (t) {
					r = r.clones;
					var o = r === null ? null : r.map(X);
				} else o = e.memoizedState, e.memoizedState = null;
				r = e;
				var s = e.child;
				ql = 0, i = au(r, s, i, i, a, o, !1), e.flags & 4 && i && (t || Ld(e, n.onUpdate));
			} else e.subtreeFlags & 33554432 && ou(e, t);
			e = e.sibling;
		}
	}
	var su = !1, H = !1, cu = !1, lu = !1, uu = typeof WeakSet == "function" ? WeakSet : Set, du = null, fu = !1, pu = !1, mu = !1, hu = !1;
	function gu(e, t, n) {
		if (e = e.containerInfo, dp = yh, e = ei(e), ti(e)) {
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
		for (fp = {
			focusedElem: e,
			selectionRange: r
		}, yh = !1, n = (n & 335544064) === n, du = t, t = n ? 9270 : 1024; du !== null;) {
			if (e = du, n && (r = e.deletions, r !== null)) for (a = 0; a < r.length; a++) n && eu(r[a]);
			if (e.alternate === null && e.flags & 2) n && Wl(e), _u(n);
			else {
				if (e.tag === 22) {
					if (r = e.alternate, e.memoizedState !== null) {
						r !== null && r.memoizedState === null && n && eu(r), _u(n);
						continue;
					}
					if (r !== null && r.memoizedState !== null) {
						n && Wl(e), _u(n);
						continue;
					}
				}
				r = e.child, (e.subtreeFlags & t) !== 0 && r !== null ? (r.return = e, du = r) : (n && tu(e), _u(n));
			}
		}
		Ul = null;
	}
	function _u(e) {
		for (; du !== null;) {
			var t = du, n = e, r = t.alternate, a = t.flags;
			switch (t.tag) {
				case 0:
				case 11:
				case 15: break;
				case 1:
					if (a & 1024 && r !== null) {
						n = void 0, a = r.memoizedProps, r = r.memoizedState;
						var o = t.stateNode;
						try {
							var s = Tc(t.type, a);
							n = o.getSnapshotBeforeUpdate(s, r), o.__reactInternalSnapshotBeforeUpdate = n;
						} catch (e) {
							q(t, t.return, e);
						}
					}
					break;
				case 3:
					if (a & 1024) {
						if (r = t.stateNode.containerInfo, n = r.nodeType, n === 9) am(r);
						else if (n === 1) switch (r.nodeName) {
							case "HEAD":
							case "HTML":
							case "BODY":
								am(r);
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
					n && r !== null && (n = wi(r.memoizedProps, r.stateNode), a = t.memoizedProps, a = Ei(a.default, a.update), a !== "none" && Jl(r, n, a, r.memoizedState = [], !0));
					break;
				default: if (a & 1024) throw Error(i(163));
			}
			if (r = t.sibling, r !== null) {
				r.return = t.return, du = r;
				break;
			}
			du = t.return;
		}
	}
	function vu(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				Ru(e, n), r & 4 && wl(5, n);
				break;
			case 1:
				if (Ru(e, n), r & 4) {
					if (e = n.stateNode, t === null) try {
						e.componentDidMount();
					} catch (e) {
						q(n, n.return, e);
					}
					else {
						var i = Tc(n.type, t.memoizedProps);
						t = t.memoizedState;
						try {
							e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
						} catch (e) {
							q(n, n.return, e);
						}
					}
				}
				r & 64 && El(n), r & 512 && Ol(n, n.return);
				break;
			case 3:
				if (Ru(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
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
						q(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && Vl(n);
			case 26:
			case 5:
				Ru(e, n), t === null && r & 4 && Fl(n), r & 512 && Ol(n, n.return);
				break;
			case 12:
				Ru(e, n);
				break;
			case 31:
				Ru(e, n), r & 4 && Du(e, n);
				break;
			case 13:
				Ru(e, n), r & 4 && Ou(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = xf.bind(null, n), dm(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || su, !r) {
					var a = t !== null && t.memoizedState !== null || H;
					t = su, i = H, su = r, (H = a) && !i ? (r = 2, n.subtreeFlags & 8772 && (r |= 1), Bu(e, n, r)) : Ru(e, n), su = t, H = i;
				}
				break;
			case 30:
				Ru(e, n), r & 512 && Ol(n, n.return);
				break;
			case 7: r & 512 && Ol(n, n.return);
			default: Ru(e, n);
		}
	}
	function yu(e, t) {
		for (e = e.child; e !== null;) bu(e, t), e = e.sibling;
	}
	function bu(e, t) {
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
					q(e, e.return, t);
				}
				xu(e, t);
				break;
			case 6:
				try {
					e.stateNode.nodeValue = t ? "" : e.memoizedProps, M = !0;
				} catch (t) {
					q(e, e.return, t);
				}
				break;
			case 18:
				try {
					var s = e.stateNode;
					t ? Op(s, !0) : Op(e.stateNode, !1);
				} catch (t) {
					q(e, e.return, t);
				}
				break;
			case 22:
			case 23:
				e.memoizedState === null && yu(e, t);
				break;
			default: yu(e, t);
		}
	}
	function xu(e, t) {
		if (e.subtreeFlags & 67108864) for (e = e.child; e !== null;) {
			a: {
				var n = e, r = t;
				switch (n.tag) {
					case 4:
						bu(n, r);
						break a;
					case 22:
						n.memoizedState === null && xu(n, r);
						break a;
					default: xu(n, r);
				}
			}
			e = e.sibling;
		}
	}
	function Su(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, Su(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && Rt(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var Cu = null, wu = !1;
	function Tu(e, t, n) {
		for (n = n.child; n !== null;) Eu(e, t, n), n = n.sibling;
	}
	function Eu(e, t, n) {
		if (rt && typeof rt.onCommitFiberUnmount == "function") try {
			rt.onCommitFiberUnmount(nt, n);
		} catch {}
		switch (n.tag) {
			case 26:
				H || kl(n, t), Tu(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !H && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				H || kl(n, t), Ml(n);
				var r = Cu, i = wu;
				Ep(n.type) && (Cu = n.stateNode, wu = !1), Tu(e, t, n), ym(n.stateNode, n.type, n.memoizedProps), Cu = r, wu = i;
				break;
			case 5: H || kl(n, t), Ml(n);
			case 6:
				if (n.tag === 6 && Ml(n), r = Cu, i = wu, Cu = null, Tu(e, t, n), Cu = r, wu = i, Cu !== null) {
					if (wu) try {
						(Cu.nodeType === 9 ? Cu.body : Cu.nodeName === "HTML" ? Cu.ownerDocument.body : Cu).removeChild(n.stateNode), M = !0;
					} catch (e) {
						q(n, t, e);
					}
					else try {
						Cu.removeChild(n.stateNode), M = !0;
					} catch (e) {
						q(n, t, e);
					}
				}
				break;
			case 18:
				Cu !== null && (wu ? (e = Cu, Dp(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), Gh(e)) : Dp(Cu, n.stateNode));
				break;
			case 4:
				r = Cu, i = wu, Cu = n.stateNode.containerInfo, wu = !0, Tu(e, t, n), Cu = r, wu = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				Tl(2, n, t), H || Tl(4, n, t), Tu(e, t, n);
				break;
			case 1:
				H || (kl(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && Dl(n, t, r)), Tu(e, t, n);
				break;
			case 21:
				Tu(e, t, n);
				break;
			case 22:
				H = (r = H) || n.memoizedState !== null, Tu(e, t, n), H = r;
				break;
			case 30:
				kl(n, t), Tu(e, t, n);
				break;
			case 7:
				H || kl(n, t), Tu(e, t, n);
				break;
			default: Tu(e, t, n);
		}
	}
	function Du(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				Gh(e);
			} catch (e) {
				q(t, t.return, e);
			}
		}
	}
	function Ou(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			Gh(e);
		} catch (e) {
			q(t, t.return, e);
		}
	}
	function ku(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new uu()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new uu()), t;
			default: throw Error(i(435, e.tag));
		}
	}
	function Au(e, t) {
		var n = ku(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = Sf.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function ju(e, t, n) {
		var r = t.deletions;
		if (r !== null) for (var a = 0; a < r.length; a++) {
			var o = r[a], s = e, c = t, l = c;
			a: for (; l !== null;) {
				switch (l.tag) {
					case 27:
						if (Ep(l.type)) {
							Cu = l.stateNode, wu = !1;
							break a;
						}
						break;
					case 5:
						Cu = l.stateNode, wu = !1;
						break a;
					case 3:
					case 4:
						Cu = l.stateNode.containerInfo, wu = !0;
						break a;
				}
				l = l.return;
			}
			if (Cu === null) throw Error(i(160));
			Eu(s, c, o), Cu = null, wu = !1, s = o.alternate, s !== null && (s.return = null), o.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) Nu(t, e, n), t = t.sibling;
	}
	var Mu = null;
	function Nu(e, t, n) {
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
				ju(t, e, n), Pu(e), a & 4 && (Tl(3, e, e.return), wl(3, e), Tl(5, e, e.return));
				break;
			case 1:
				ju(t, e, n), Pu(e), a & 512 && (H || r === null || kl(r, r.return)), a & 64 && su && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? t : n.concat(t))));
				break;
			case 26:
				if (o = Mu, ju(t, e, n), Pu(e), a & 512 && (H || r === null || kl(r, r.return)), a & 4) {
					if (a = r === null ? null : r.memoizedState, n = e.memoizedState, r === null) {
						if (n === null) {
							if (e.stateNode === null) {
								if (su) e.stateNode = gp(e.type, e.memoizedProps, t.containerInfo, e);
								else {
									a: {
										t = e.type, n = e.memoizedProps, a = o.ownerDocument || o;
										b: switch (t) {
											case "title":
												r = a.getElementsByTagName("title")[0], (!r || r[It] || r[kt] || r.namespaceURI === "http://www.w3.org/2000/svg" || r.hasAttribute("itemprop")) && (r = a.createElement(t), a.head.insertBefore(r, a.querySelector("head > title"))), op(r, t, n), r[kt] = e, Ut(r), t = r;
												break a;
											case "link":
												if (o = Jm("link", "href", a).get(t + (n.href || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && r.getAttribute("rel") === (n.rel == null ? null : n.rel) && r.getAttribute("title") === (n.title == null ? null : n.title) && r.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = a.createElement(t), op(r, t, n), a.head.appendChild(r);
												break;
											case "meta":
												if (o = Jm("meta", "content", a).get(t + (n.content || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("content") === (n.content == null ? null : "" + n.content) && r.getAttribute("name") === (n.name == null ? null : n.name) && r.getAttribute("property") === (n.property == null ? null : n.property) && r.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && r.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = a.createElement(t), op(r, t, n), a.head.appendChild(r);
												break;
											default: throw Error(i(468, t));
										}
										r[kt] = e, Ut(r), t = r;
									}
									e.stateNode = t;
								}
							} else su || Ym(o, e.type, e.stateNode);
						} else e.stateNode = Um(o, n, e.memoizedProps);
					} else a === n ? n === null && e.stateNode !== null && Il(e, e.memoizedProps, r.memoizedProps) : (a === null ? (t = r.stateNode, t === null || H || t.parentNode.removeChild(t)) : a.count--, n === null ? su || Ym(o, e.type, e.stateNode) : Um(o, n, e.memoizedProps));
				}
				break;
			case 27:
				ju(t, e, n), Pu(e), a & 512 && (H || r === null || kl(r, r.return)), r !== null && a & 4 && Il(e, e.memoizedProps, r.memoizedProps);
				break;
			case 5:
				if (o = cu, cu = !1, ju(t, e, n), cu = o, Pu(e), a & 512 && (H || r === null || kl(r, r.return)), e.flags & 32) {
					t = e.stateNode;
					try {
						_n(t, ""), M = !0;
					} catch (t) {
						q(e, e.return, t);
					}
				}
				a & 4 && e.stateNode != null && (t = e.memoizedProps, Il(e, t, r === null ? t : r.memoizedProps)), a & 1024 && (lu = !0);
				break;
			case 6:
				if (ju(t, e, n), Pu(e), a & 4) {
					if (e.stateNode === null) throw Error(i(162));
					t = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = t, M = !0;
					} catch (t) {
						q(e, e.return, t);
					}
				}
				break;
			case 3:
				if (M = !1, qm = null, o = Mu, Mu = Cm(t.containerInfo), ju(t, e, n), Mu = o, Pu(e), a & 4 && r !== null && r.memoizedState.isDehydrated) try {
					Gh(t.containerInfo);
				} catch (t) {
					q(e, e.return, t);
				}
				lu && (lu = !1, Fu(e)), M = !1;
				break;
			case 4:
				a = cu, cu = su, r = $t(), o = Mu, Mu = Cm(e.stateNode.containerInfo), ju(t, e, n), Pu(e), Mu = o, M && pu && (mu = !0), M = r, cu = a;
				break;
			case 12:
				ju(t, e, n), Pu(e);
				break;
			case 31:
				ju(t, e, n), Pu(e), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Au(e, t)));
				break;
			case 13:
				ju(t, e, n), Pu(e), e.child.flags & 8192 && e.memoizedState !== null != (r !== null && r.memoizedState !== null) && (vd = qe()), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Au(e, t)));
				break;
			case 22:
				o = e.memoizedState !== null, s = r !== null && r.memoizedState !== null;
				var c = su, l = H, u = cu;
				su = c || o, cu = u || o, H = l || s, ju(t, e, n), H = l, cu = u, su = c, Pu(e), a & 8192 && (t = e.stateNode, t._visibility = o ? t._visibility & -2 : t._visibility | 1, !o || r === null || s || su || H || (t = s || H, n = su, r = H, su = o || su, H = t, zu(e, 2), su = n, H = r), !o && cu || yu(e, o)), a & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, Au(e, n))));
				break;
			case 19:
				ju(t, e, n), Pu(e), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Au(e, t)));
				break;
			case 30:
				a & 512 && (H || r === null || kl(r, r.return)), a = $t(), o = pu, s = (n & 335544064) === n, c = e.memoizedProps, pu = s && Ei(c.default, c.update) !== "none", ju(t, e, n), Pu(e), s && r !== null && M && (e.flags |= 4), pu = o, M = a;
				break;
			case 21: break;
			case 7: a & 512 && (H || r === null || kl(r, r.return)), r && r.stateNode !== null && (r.stateNode._fragmentFiber = e);
			default: ju(t, e, n), Pu(e);
		}
	}
	function Pu(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Ll(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				r = null;
				for (var a = e.return; a !== null;) {
					if (Pl(a)) {
						var o = a.stateNode;
						r === null ? r = [o] : r.push(o);
					}
					if (Nl(a)) break;
					a = a.return;
				}
				var s = r;
				if (n == null) throw Error(i(160));
				switch (n.tag) {
					case 27:
						var c = n.stateNode;
						Bl(e, Rl(e), c, s);
						break;
					case 5:
						var l = n.stateNode;
						n.flags & 32 && (_n(l, ""), n.flags &= -33), Bl(e, Rl(e), l, s);
						break;
					case 3:
					case 4:
						var u = n.stateNode.containerInfo;
						zl(e, Rl(e), u, s);
						break;
					default: throw Error(i(161));
				}
			} catch (t) {
				q(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function Fu(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			Fu(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, yh = !0, t.reset(), yh = !1), e = e.sibling;
		}
	}
	function Iu(e, t) {
		if (t.subtreeFlags & 9270) for (t = t.child; t !== null;) Lu(t, e), t = t.sibling;
		else ou(t, !1);
	}
	function Lu(e, t) {
		var n = e.alternate;
		if (n === null) Ql(e, !1);
		else switch (e.tag) {
			case 3:
				if (hu = fu = !1, Kl(), Iu(t, e), !fu && !mu) {
					if (e = Gl, e !== null) for (var r = 0; r < e.length; r += 3) {
						n = e[r];
						var i = e[r + 1];
						Ap(n, e[r + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate({
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
					})), hu = !0;
				}
				Gl = null;
				break;
			case 5:
				Iu(t, e);
				break;
			case 4:
				r = fu, fu = !1, Iu(t, e), fu && (mu = !0), fu = r;
				break;
			case 22:
				e.memoizedState === null && (n.memoizedState === null ? Iu(t, e) : Ql(e, !1));
				break;
			case 30:
				r = fu, i = Kl(), fu = !1, Iu(t, e), fu && (e.flags |= 4);
				var a = e.memoizedProps, o = e.stateNode;
				t = wi(a, o), o = wi(n.memoizedProps, o);
				var s = Ei(a.default, a.update);
				s === "none" ? t = !1 : (a = n.memoizedState, n.memoizedState = null, n = e.child, ql = 0, t = au(e, n, t, o, s, a, !0), ql !== (a === null ? 0 : a.length) && (e.flags |= 32)), e.flags & 4 && t ? (Ld(e, e.memoizedProps.onUpdate), Gl = i) : i !== null && (i.push.apply(i, Gl), Gl = i), fu = e.flags & 32 ? !0 : r;
				break;
			default: Iu(t, e);
		}
	}
	function Ru(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) vu(e, t.alternate, t), t = t.sibling;
	}
	function zu(e, t) {
		for (e = e.child; e !== null;) {
			var n = e, r = t;
			switch (n.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					Tl(4, n, n.return), zu(n, r);
					break;
				case 1:
					kl(n, n.return);
					var i = n.stateNode;
					typeof i.componentWillUnmount == "function" && Dl(n, n.return, i), zu(n, r);
					break;
				case 27: r & 2 && ym(n.stateNode, n.type, n.memoizedProps);
				case 5:
					kl(n, n.return), n.tag !== 5 && n.tag !== 27 || Ml(n), zu(n, r);
					break;
				case 6:
					Ml(n);
					break;
				case 26:
					kl(n, n.return), i = n.stateNode, n.memoizedState !== null || i === null || H || i.parentNode.removeChild(i), zu(n, r);
					break;
				case 22:
					n.memoizedState === null && zu(n, r);
					break;
				case 30:
					kl(n, n.return), zu(n, r);
					break;
				case 7: kl(n, n.return);
				default: zu(n, r);
			}
			e = e.sibling;
		}
	}
	function Bu(e, t, n) {
		for (n = t.subtreeFlags & 8772 ? n : n & -2, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags, s = !!(n & 1);
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					Bu(i, a, n), wl(4, a);
					break;
				case 1:
					if (Bu(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						q(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var c = r.stateNode;
						try {
							var l = i.shared.hiddenCallbacks;
							if (l !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < l.length; i++) Eo(l[i], c);
						} catch (e) {
							q(r, r.return, e);
						}
					}
					s && o & 64 && El(a), Ol(a, a.return);
					break;
				case 27: n & 2 && Vl(a);
				case 5:
					a.tag !== 5 && a.tag !== 27 || jl(a), Bu(i, a, n), s && r === null && o & 4 && Fl(a), Ol(a, a.return);
					break;
				case 6:
					jl(a);
					break;
				case 26:
					c = a.stateNode, a.memoizedState !== null || c === null || su || Ym(Cm(c.ownerDocument), a.type, c), Bu(i, a, n), s && r === null && o & 4 && Fl(a), Ol(a, a.return);
					break;
				case 12:
					Bu(i, a, n);
					break;
				case 31:
					Bu(i, a, n), s && o & 4 && Du(i, a);
					break;
				case 13:
					Bu(i, a, n), s && o & 4 && Ou(i, a);
					break;
				case 22:
					a.memoizedState === null && Bu(i, a, n), Ol(a, a.return);
					break;
				case 30:
					Bu(i, a, n), Ol(a, a.return);
					break;
				case 7: Ol(a, a.return);
				default: Bu(i, a, n);
			}
			t = t.sibling;
		}
	}
	function Vu(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && Ia(n));
	}
	function Hu(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && Ia(e));
	}
	function Uu(e, t, n, r) {
		var i = (n & 335544064) === n;
		if (t.subtreeFlags & (i ? 10262 : 10256)) for (t = t.child; t !== null;) Wu(e, t, n, r), t = t.sibling;
		else i && iu(t);
	}
	function Wu(e, t, n, r) {
		var i = (n & 335544064) === n;
		i && t.alternate === null && t.return !== null && t.return.alternate !== null && ru(t);
		var a = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				Uu(e, t, n, r), a & 2048 && wl(9, t);
				break;
			case 1:
				Uu(e, t, n, r);
				break;
			case 3:
				Uu(e, t, n, r), i && hu && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), a & 2048 && (a = null, t.alternate !== null && (a = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== a && (t.refCount++, a != null && Ia(a)));
				break;
			case 12:
				if (a & 2048) {
					Uu(e, t, n, r), a = t.stateNode;
					try {
						var o = t.memoizedProps, s = o.id, c = o.onPostCommit;
						typeof c == "function" && c(s, t.alternate === null ? "mount" : "update", a.passiveEffectDuration, -0);
					} catch (e) {
						q(t, t.return, e);
					}
				} else Uu(e, t, n, r);
				break;
			case 31:
				Uu(e, t, n, r);
				break;
			case 13:
				Uu(e, t, n, r);
				break;
			case 23: break;
			case 22:
				o = t.stateNode, s = t.alternate, t.memoizedState === null ? (i && s !== null && s.memoizedState !== null && ru(t), o._visibility & 2 ? Uu(e, t, n, r) : (o._visibility |= 2, Gu(e, t, n, r, !!(t.subtreeFlags & 10256) || !1))) : (i && s !== null && s.memoizedState === null && ru(s), o._visibility & 2 ? Uu(e, t, n, r) : Ku(e, t)), a & 2048 && Vu(s, t);
				break;
			case 24:
				Uu(e, t, n, r), a & 2048 && Hu(t.alternate, t);
				break;
			case 30:
				i && (a = t.alternate, a !== null && (Xl(a.child, !0), Xl(t.child, !0))), Uu(e, t, n, r);
				break;
			default: Uu(e, t, n, r);
		}
	}
	function Gu(e, t, n, r, i) {
		for (i &&= !!(t.subtreeFlags & 10256) || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					Gu(a, o, s, c, i), wl(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, Gu(a, o, s, c, i)) : u._visibility & 2 ? Gu(a, o, s, c, i) : Ku(a, o), i && l & 2048 && Vu(o.alternate, o);
					break;
				case 24:
					Gu(a, o, s, c, i), i && l & 2048 && Hu(o.alternate, o);
					break;
				default: Gu(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function Ku(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					Ku(n, r), i & 2048 && Vu(r.alternate, r);
					break;
				case 24:
					Ku(n, r), i & 2048 && Hu(r.alternate, r);
					break;
				default: Ku(n, r);
			}
			t = t.sibling;
		}
	}
	var qu = 8192;
	function Ju(e, t, n) {
		if (e.subtreeFlags & qu) for (e = e.child; e !== null;) Yu(e, t, n), e = e.sibling;
	}
	function Yu(e, t, n) {
		switch (e.tag) {
			case 26:
				Ju(e, t, n), e.flags & qu && (e.memoizedState === null ? (e = e.stateNode, (t & 335544128) === t && eh(n, e)) : th(n, Mu, e.memoizedState, e.memoizedProps));
				break;
			case 5:
				Ju(e, t, n), e.flags & qu && (e = e.stateNode, (t & 335544128) === t && eh(n, e));
				break;
			case 3:
			case 4:
				var r = Mu;
				Mu = Cm(e.stateNode.containerInfo), Ju(e, t, n), Mu = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = qu, qu = 16777216, Ju(e, t, n), qu = r) : Ju(e, t, n));
				break;
			case 30:
				if ((e.flags & qu) !== 0 && (r = e.memoizedProps.name, r != null && r !== "auto")) {
					var i = e.stateNode;
					i.paired = null, Ul === null && (Ul = /* @__PURE__ */ new Map()), Ul.set(r, i);
				}
				Ju(e, t, n);
				break;
			default: Ju(e, t, n);
		}
	}
	function Xu(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function Zu(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				du = r, ed(r, e);
			}
			Xu(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) Qu(e), e = e.sibling;
	}
	function Qu(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				Zu(e), e.flags & 2048 && Tl(9, e, e.return);
				break;
			case 3:
				Zu(e);
				break;
			case 12:
				Zu(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, $u(e)) : Zu(e);
				break;
			default: Zu(e);
		}
	}
	function $u(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				du = r, ed(r, e);
			}
			Xu(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					Tl(8, t, t.return), $u(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, $u(t));
					break;
				default: $u(t);
			}
			e = e.sibling;
		}
	}
	function ed(e, t) {
		for (; du !== null;) {
			var n = du;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					Tl(8, n, t);
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
			if (r = n.child, r !== null) r.return = n, du = r;
			else a: for (n = e; du !== null;) {
				r = du;
				var i = r.sibling, a = r.return;
				if (Su(r), r === n) {
					du = null;
					break a;
				}
				if (i !== null) {
					i.return = a, du = i;
					break a;
				}
				du = a;
			}
		}
	}
	var td = {
		getCacheForType: function(e) {
			var t = ka(L), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return ka(L).controller.signal;
		}
	}, nd = typeof WeakMap == "function" ? WeakMap : Map, U = 0, rd = null, W = null, G = 0, K = 0, id = null, ad = !1, od = !1, sd = !1, cd = 0, ld = 0, ud = 0, dd = 0, fd = 0, pd = 0, md = 0, hd = null, gd = null, _d = !1, vd = 0, yd = 0, bd = Infinity, xd = null, Sd = null, Cd = 0, wd = null, Td = null, Ed = 0, Dd = 0, Od = null, kd = null, Ad = null, jd = null, Md = null, Nd = 0, Pd = null;
	function Fd() {
		return U & 2 && G !== 0 ? G & -G : A.T === null ? Et() : Rf();
	}
	function Id() {
		if (pd === 0) {
			if (!(G & 536870912) || I) {
				var e = ut;
				ut <<= 1, !(ut & 3932160) && (ut = 262144), pd = e;
			} else pd = 536870912;
		}
		return e = No.current, e !== null && (e.flags |= 32), pd;
	}
	function Ld(e, t) {
		if (t != null) {
			var n = e.stateNode, r = n.ref;
			r === null && (r = n.ref = Lp(wi(e.memoizedProps, n))), jd === null && (jd = []), jd.push(t.bind(null, r));
		}
	}
	function Rd(e, t, n) {
		(e === rd && (K === 2 || K === 9) || e.cancelPendingCommit !== null) && (Gd(e, 0), Hd(e, G, pd, !1)), yt(e, n), (!(U & 2) || e !== rd) && (e === rd && (!(U & 2) && (dd |= n), ld === 4 && Hd(e, G, pd, !1)), Af(e));
	}
	function zd(e, t, n) {
		if (U & 6) throw Error(i(327));
		var r = !n && !(t & 127) && (t & e.expiredLanes) === 0 || mt(e, t), a = r ? $d(e, t) : Zd(e, t, !0), o = r;
		do {
			if (a === 0) {
				od && !r && Hd(e, t, 0, !1);
				break;
			}
			if (n = e.current.alternate, o && !Vd(n)) {
				a = Zd(e, t, !1), o = !1;
				continue;
			}
			if (a === 2) {
				if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
				else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
				if (s !== 0) {
					t = s;
					a: {
						var c = e;
						a = hd;
						var l = c.current.memoizedState.isDehydrated;
						if (l && (Gd(c, s).flags |= 256), s = Zd(c, s, !1), s !== 2 && s !== 6) {
							if (sd && !l) {
								c.errorRecoveryDisabledLanes |= o, dd |= o, a = 4;
								break a;
							}
							o = gd, gd = a, o !== null && (gd === null ? gd = o : gd.push.apply(gd, o));
						}
						a = s;
					}
					if (o = !1, a !== 2) continue;
				}
			}
			if (a === 1) {
				Gd(e, 0), Hd(e, t, 0, !0);
				break;
			}
			a: {
				switch (r = e, o = a, o) {
					case 0:
					case 1: throw Error(i(345));
					case 4: if ((t & 4194048) !== t && (t & 62914560) !== t) break;
					case 6:
						Hd(r, t, pd, !ad);
						break a;
					case 2:
						gd = null;
						break;
					case 3:
					case 5: break;
					default: throw Error(i(329));
				}
				if ((t & 62914560) === t && (a = vd + 300 - qe(), 10 < a)) {
					if (Hd(r, t, pd, !ad), pt(r, 0, !0) !== 0) break a;
					Ed = t, r.timeoutHandle = bp(Bd.bind(null, r, n, gd, xd, _d, t, pd, dd, md, ad, o, "Throttled", -0, 0), a);
					break a;
				}
				Bd(r, n, gd, xd, _d, t, pd, dd, md, ad, o, null, -0, 0);
			}
			break;
		} while (1);
		Af(e);
	}
	function Bd(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
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
			unsuspend: Tn
		}, Ul = null, Yu(t, a, d), h && (m = d, h = e.containerInfo, h = (h.nodeType === 9 ? h : h.ownerDocument).__reactViewTransition, h != null && (m.count++, m.waitingForViewTransition = !0, m = ah.bind(m), h.finished.then(m, m))), m = (a & 62914560) === a ? vd - qe() : (a & 4194048) === a ? yd - qe() : 0, m = rh(d, m), m !== null)) {
			Ed = a, e.cancelPendingCommit = m(sf.bind(null, e, t, a, n, r, i, o, s, c, l, u, d, null, f, p)), Hd(e, a, o, !l);
			return;
		}
		sf(e, t, a, n, r, i, o, s, c, l, u, d);
	}
	function Vd(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!Jr(a(), i)) return !1;
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
	function Hd(e, t, n, r) {
		t = ht(e, t), t &= ~fd, t &= ~dd, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - at(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && xt(e, n, t);
	}
	function Ud() {
		return U & 6 ? !0 : (jf(0, !1), !1);
	}
	function Wd() {
		if (W !== null) {
			if (K === 0) var e = W.return;
			else e = W, xa = ba = null, ss(e), co = null, lo = 0, e = W;
			for (; e !== null;) Cl(e.alternate, e), e = e.return;
			W = null;
		}
	}
	function Gd(e, t) {
		var n = e.timeoutHandle;
		return n !== -1 && (e.timeoutHandle = -1, xp(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), Ed = 0, Wd(), rd = e, W = n = N(e.current, null), G = t, K = 0, id = null, ad = !1, od = mt(e, t), sd = !1, md = pd = fd = dd = ud = ld = 0, gd = hd = null, _d = !1, cd = ht(e, t), ji(), n;
	}
	function Kd(e, t) {
		B = null, A.H = _c, t === Qa || t === eo ? (t = oo(), K = 3) : t === $a ? (t = oo(), K = 4) : K = t === Fc ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, id = t, W === null && (ld = 1, kc(e, Ji(t, e.current)));
	}
	function qd() {
		var e = No.current;
		return e === null ? !0 : (G & 4194048) === G ? Po === null : (G & 62914560) === G || G & 536870912 ? e === Po : !1;
	}
	function Jd() {
		var e = A.H;
		return A.H = _c, e === null ? _c : e;
	}
	function Yd() {
		var e = A.A;
		return A.A = td, e;
	}
	function Xd() {
		ld = 4, ad || (G & 4194048) !== G && No.current !== null || (od = !0), !(ud & 134217727) && !(dd & 134217727) || rd === null || Hd(rd, G, pd, !1);
	}
	function Zd(e, t, n) {
		var r = U;
		U |= 2;
		var i = Jd(), a = Yd();
		(rd !== e || G !== t) && (xd = null, Gd(e, t)), t = !1;
		var o = ld;
		a: do
			try {
				if (K !== 0 && W !== null) {
					var s = W, c = id;
					switch (K) {
						case 8:
							Wd(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							No.current === null && (t = !0);
							var l = K;
							if (K = 0, id = null, rf(e, s, c, l), n && od) {
								o = 0;
								break a;
							}
							break;
						default: l = K, K = 0, id = null, rf(e, s, c, l);
					}
				}
				Qd(), o = ld;
				break;
			} catch (t) {
				Kd(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, xa = ba = null, U = r, A.H = i, A.A = a, W === null && (rd = null, G = 0, ji()), o;
	}
	function Qd() {
		for (; W !== null;) tf(W);
	}
	function $d(e, t) {
		var n = U;
		U |= 2;
		var r = Jd(), a = Yd();
		rd !== e || G !== t ? (xd = null, bd = qe() + 500, Gd(e, t)) : od = mt(e, t);
		a: do
			try {
				if (K !== 0 && W !== null) {
					t = W;
					var o = id;
					b: switch (K) {
						case 1:
							K = 0, id = null, rf(e, t, o, 1);
							break;
						case 2:
						case 9:
							if (no(o)) {
								K = 0, id = null, nf(t);
								break;
							}
							t = function() {
								K !== 2 && K !== 9 || rd !== e || (K = 7), Af(e);
							}, o.then(t, t);
							break a;
						case 3:
							K = 7;
							break a;
						case 4:
							K = 5;
							break a;
						case 7:
							no(o) ? (K = 0, id = null, nf(t)) : (K = 0, id = null, rf(e, t, o, 7));
							break;
						case 5:
							var s = null;
							switch (W.tag) {
								case 26: s = W.memoizedState;
								case 5:
								case 27:
									var c = W;
									if (s ? Qm(s) : c.stateNode.complete) {
										K = 0, id = null;
										var l = c.sibling;
										if (l !== null) W = l;
										else {
											var u = c.return;
											u === null ? W = null : (W = u, af(u));
										}
										break b;
									}
							}
							K = 0, id = null, rf(e, t, o, 5);
							break;
						case 6:
							K = 0, id = null, rf(e, t, o, 6);
							break;
						case 8:
							Wd(), ld = 6;
							break a;
						default: throw Error(i(462));
					}
				}
				ef();
				break;
			} catch (t) {
				Kd(e, t);
			}
		while (1);
		return xa = ba = null, A.H = r, A.A = a, U = n, W === null ? (rd = null, G = 0, ji(), ld) : 0;
	}
	function ef() {
		for (; W !== null && !Ge();) tf(W);
	}
	function tf(e) {
		var t = hl(e.alternate, e, cd);
		e.memoizedProps = e.pendingProps, t === null ? af(e) : W = t;
	}
	function nf(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = Yc(n, t, t.pendingProps, t.type, void 0, G);
				break;
			case 11:
				t = Yc(n, t, t.pendingProps, t.type.render, t.ref, G);
				break;
			case 5:
				ss(t);
				var r = t;
				r === P && (I ? (ma(r), r.tag === 5 && r.stateNode != null && (F = r.stateNode)) : (ma(r), I = !0));
			default: Cl(n, t), t = W = Vi(t, cd), t = hl(n, t, cd);
		}
		e.memoizedProps = e.pendingProps, t === null ? af(e) : W = t;
	}
	function rf(e, t, n, r) {
		xa = ba = null, ss(t), co = null, lo = 0;
		var i = t.return;
		try {
			if (Pc(e, i, t, n, G)) {
				ld = 1, kc(e, Ji(n, e.current)), W = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw W = i, t;
			ld = 1, kc(e, Ji(n, e.current)), W = null;
			return;
		}
		t.flags & 32768 ? (I || r === 1 ? e = !0 : od || G & 536870912 ? e = !1 : (ad = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = No.current, r !== null && r.tag === 13 && (r.flags |= 16384))), of(t, e)) : af(t);
	}
	function af(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				of(t, ad);
				return;
			}
			e = t.return;
			var n = xl(t.alternate, t, cd);
			if (n !== null) {
				W = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				W = t;
				return;
			}
			W = t = e;
		} while (t !== null);
		ld === 0 && (ld = 5);
	}
	function of(e, t) {
		do {
			var n = Sl(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, W = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				W = e;
				return;
			}
			W = e = n;
		} while (e !== null);
		ld = 6, W = null;
	}
	function sf(e, t, n, r, a, o, s, c, l, u, d, f) {
		e.cancelPendingCommit = null;
		do
			hf();
		while (Cd !== 0);
		if (U & 6) throw Error(i(327));
		if (t !== null) {
			if (t === e.current) throw Error(i(177));
			e === rd && (W = rd = null, G = 0), Td = t, wd = e, Ed = n, Od = a, kd = r, cf(e, t, n, s, c, l, f);
		}
	}
	function cf(e, t, n, r, i, a, o) {
		var s = t.lanes | t.childLanes;
		if (Dd = s, s |= Ai, bt(e, n, s, r, i, a), jd = null, (n & 335544064) === n ? (Md = za(e), r = 10262) : (Md = null, r = 10256), (t.subtreeFlags & r) !== 0 || (t.flags & r) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, Cf(Ze, function() {
			return gf(), null;
		})) : (e.callbackNode = null, e.callbackPriority = 0), Hl = !1, r = !!(t.flags & 13878), t.subtreeFlags & 13878 || r) {
			r = A.T, A.T = null, i = j.p, j.p = 2, a = U, U |= 4;
			try {
				gu(e, t, n);
			} finally {
				U = a, j.p = i, A.T = r;
			}
		}
		Cd = 1, Hl ? Ad = Fp(o, e.containerInfo, Md, df, ff, uf, pf, gf, lf, null, null) : (df(), ff(), pf());
	}
	function lf(e) {
		if (Cd !== 0) {
			var t = wd.onRecoverableError;
			t(e, { componentStack: null });
		}
	}
	function uf() {
		Cd === 3 && (Cd = 0, Lu(Td, wd), Cd = 4);
	}
	function df() {
		if (Cd === 1) {
			Cd = 0;
			var e = wd, t = Td, n = Ed, r = !!(t.flags & 13878);
			if (t.subtreeFlags & 13878 || r) {
				r = A.T, A.T = null;
				var i = j.p;
				j.p = 2;
				var a = U;
				U |= 4;
				try {
					pu = mu = !1, Nu(t, e, n), n = fp;
					var o = ei(e.containerInfo), s = n.focusedElem, c = n.selectionRange;
					if (o !== s && s && s.ownerDocument && $r(s.ownerDocument.documentElement, s)) {
						if (c !== null && ti(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = Qr(s, h), v = Qr(s, g);
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
					yh = !!dp, fp = dp = null;
				} finally {
					U = a, j.p = i, A.T = r;
				}
			}
			e.current = t, Cd = 2;
		}
	}
	function ff() {
		if (Cd === 2) {
			Cd = 0;
			var e = wd, t = Td, n = !!(t.flags & 8772);
			if (t.subtreeFlags & 8772 || n) {
				n = A.T, A.T = null;
				var r = j.p;
				j.p = 2;
				var i = U;
				U |= 4;
				try {
					vu(e, t.alternate, t);
				} finally {
					U = i, j.p = r, A.T = n;
				}
			}
			Cd = 3;
		}
	}
	function pf() {
		if (Cd === 4 || Cd === 3) {
			Cd = 0;
			var e = Ad;
			Ad = null, Ke();
			var t = wd, n = Td, r = Ed, i = kd, a = (r & 335544064) === r ? 10262 : 10256;
			if ((n.subtreeFlags & a) !== 0 || (n.flags & a) !== 0 ? Cd = 5 : (Cd = 0, Td = wd = null, mf(t, t.pendingLanes)), a = t.pendingLanes, a === 0 && (Sd = null), Tt(r), n = n.stateNode, rt && typeof rt.onCommitFiberRoot == "function") try {
				rt.onCommitFiberRoot(nt, n, void 0, (n.current.flags & 128) == 128);
			} catch {}
			if (i !== null) {
				n = A.T, a = j.p, j.p = 2, A.T = null;
				try {
					for (var o = t.onRecoverableError, s = 0; s < i.length; s++) {
						var c = i[s];
						o(c.value, { componentStack: c.stack });
					}
				} finally {
					A.T = n, j.p = a;
				}
			}
			if (i = jd, o = Md, Md = null, i !== null && (jd = null, o === null && (o = []), e !== null)) for (c = 0; c < i.length; c++) n = (0, i[c])(o), n !== void 0 && e.finished.finally(n);
			Ed & 3 && hf(), Af(t), a = t.pendingLanes, r & 261930 && a & 42 ? t === Pd ? Nd++ : (Nd = 0, Pd = t) : (Nd = 0, Pd = null), jf(0, !1);
		}
	}
	function mf(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Ia(t)));
	}
	function hf() {
		return Ad !== null && (Ad.skipTransition(), Ad = null), df(), ff(), pf(), gf();
	}
	function gf() {
		if (Cd !== 5) return !1;
		var e = wd, t = Dd;
		Dd = 0;
		var n = Tt(Ed), r = A.T, a = j.p;
		try {
			j.p = 32 > n ? 32 : n, A.T = null, n = Od, Od = null;
			var o = wd, s = Ed;
			if (Cd = 0, Td = wd = null, Ed = 0, U & 6) throw Error(i(331));
			var c = U;
			if (U |= 4, Qu(o.current), Wu(o, o.current, s, n), U = c, jf(0, !1), rt && typeof rt.onPostCommitFiberRoot == "function") try {
				rt.onPostCommitFiberRoot(nt, o);
			} catch {}
			return !0;
		} finally {
			j.p = a, A.T = r, mf(e, t);
		}
	}
	function _f(e, t, n) {
		t = Ji(n, t), t = jc(e.stateNode, t, 2), e = bo(e, t, 2), e !== null && (yt(e, 2), Af(e));
	}
	function q(e, t, n) {
		if (e.tag === 3) _f(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				_f(t, e, n);
				break;
			}
			if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Sd === null || !Sd.has(r))) {
					e = Ji(n, e), n = Mc(2), r = bo(t, n, 2), r !== null && (Nc(n, r, t, e), yt(r, 2), Af(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function vf(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new nd();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (sd = !0, i.add(n), e = yf.bind(null, e, t, n), t.then(e, e));
	}
	function yf(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, rd === e && (G & n) === n && (ld === 4 || ld === 3 && (G & 62914560) === G && 300 > qe() - vd ? U & 2 ? fd |= n : Gd(e, 0) : fd |= n, md === G && (md = 0)), Af(e);
	}
	function bf(e, t) {
		t === 0 && (t = _t()), e = Pi(e, t), e !== null && (yt(e, t), Af(e));
	}
	function xf(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), bf(e, n);
	}
	function Sf(e, t) {
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
		r !== null && r.delete(t), bf(e, n);
	}
	function Cf(e, t) {
		return Ue(e, t);
	}
	var wf = null, Tf = null, Ef = !1, Df = !1, Of = !1, kf = 0;
	function Af(e) {
		e !== Tf && e.next === null && (Tf === null ? wf = Tf = e : Tf = Tf.next = e), Df = !0, Ef || (Ef = !0, Lf());
	}
	function jf(e, t) {
		if (!Of && Df) {
			Of = !0;
			do
				for (var n = !1, r = wf; r !== null;) {
					if (!t) {
						if (e !== 0) {
							var i = r.pendingLanes;
							if (i === 0) var a = 0;
							else {
								var o = r.suspendedLanes, s = r.pingedLanes;
								a = (1 << 31 - at(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
							}
							a !== 0 && (n = !0, If(r, a));
						} else a = G, a = pt(r, r === rd ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || mt(r, a) || (n = !0, If(r, a));
					}
					r = r.next;
				}
			while (n);
			Of = !1;
		}
	}
	function Mf() {
		Nf();
	}
	function Nf() {
		Df = Ef = !1;
		var e = 0;
		kf !== 0 && yp() && (e = kf);
		for (var t = qe(), n = null, r = wf; r !== null;) {
			var i = r.next, a = Pf(r, t);
			a === 0 ? (r.next = null, n === null ? wf = i : n.next = i, i === null && (Tf = n)) : (n = r, (e !== 0 || a & 3) && (Df = !0)), r = i;
		}
		Cd !== 0 && Cd !== 5 || jf(e, !1), kf !== 0 && (kf = 0);
	}
	function Pf(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - at(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = gt(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = rd, n = G, n = pt(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (K === 2 || K === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && We(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || mt(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && We(r), Tt(n)) {
				case 2:
				case 8:
					n = Xe;
					break;
				case 32:
					n = Ze;
					break;
				case 268435456:
					n = $e;
					break;
				default: n = Ze;
			}
			return r = Ff.bind(null, e), n = Ue(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && We(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function Ff(e, t) {
		if (Cd !== 0 && Cd !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (hf() && e.callbackNode !== n) return null;
		var r = G;
		return r = pt(e, e === rd ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (zd(e, r, t), Pf(e, qe()), e.callbackNode != null && e.callbackNode === n ? Ff.bind(null, e) : null);
	}
	function If(e, t) {
		if (hf()) return null;
		zd(e, t, !0);
	}
	function Lf() {
		wp(function() {
			U & 6 ? Ue(Ye, Mf) : Nf();
		});
	}
	function Rf() {
		if (kf === 0) {
			var e = Ha;
			e === 0 && (e = lt, lt <<= 1, !(lt & 261888) && (lt = 256)), kf = e;
		}
		return kf;
	}
	function zf(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : wn(e);
	}
	function Bf(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = zf((i[At] || null).action), o = r.submitter;
			o && (t = (t = o[At] || null) ? zf(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new Kn("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (kf !== 0) {
								var e = new FormData(i, o);
								rc(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = new FormData(i, o), rc(n, {
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
	for (var Vf = 0; Vf < xi.length; Vf++) {
		var Hf = xi[Vf];
		Si(Hf.toLowerCase(), "on" + (Hf[0].toUpperCase() + Hf.slice(1)));
	}
	Si(pi, "onAnimationEnd"), Si(mi, "onAnimationIteration"), Si(hi, "onAnimationStart"), Si("dblclick", "onDoubleClick"), Si("focusin", "onFocus"), Si("focusout", "onBlur"), Si(gi, "onTransitionRun"), Si(_i, "onTransitionStart"), Si(vi, "onTransitionCancel"), Si(yi, "onTransitionEnd"), Jt("onMouseEnter", ["mouseout", "mouseover"]), Jt("onMouseLeave", ["mouseout", "mouseover"]), Jt("onPointerEnter", ["pointerout", "pointerover"]), Jt("onPointerLeave", ["pointerout", "pointerover"]), qt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), qt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), qt("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), qt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), qt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), qt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var Uf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), Wf = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Uf));
	function Gf(e, t) {
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
						Di(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Di(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function J(e, t) {
		var n = t[Mt];
		n === void 0 && (n = t[Mt] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (Yf(t, e, 2, !1), n.add(r));
	}
	function Kf(e, t, n) {
		var r = 0;
		t && (r |= 4), Yf(n, e, r, t);
	}
	var qf = "_reactListening" + Math.random().toString(36).slice(2);
	function Jf(e) {
		if (!e[qf]) {
			e[qf] = !0, Gt.forEach(function(t) {
				t !== "selectionchange" && (Wf.has(t) || Kf(t, !1, e), Kf(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[qf] || (t[qf] = !0, Kf("selectionchange", !1, t));
		}
	}
	function Yf(e, t, n, r) {
		switch (Eh(t)) {
			case 2:
				var i = bh;
				break;
			case 8:
				i = xh;
				break;
			default: i = Sh;
		}
		n = i.bind(null, t, n, e), i = void 0, !Fn || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function Xf(e, t, n, r, i) {
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
					if (s = zt(c), s === null) return;
					if (l = s.tag, l === 5 || l === 6 || l === 26 || l === 27) {
						r = a = s;
						continue a;
					}
					c = c.parentNode;
				}
			}
			r = r.return;
		}
		Mn(function() {
			var r = a, i = Dn(n), s = [];
			a: {
				var c = bi.get(e);
				if (c !== void 0) {
					var l = Kn, u = e;
					switch (e) {
						case "keypress": if (Vn(n) === 0) break a;
						case "keydown":
						case "keyup":
							l = ur;
							break;
						case "focusin":
							u = "focus", l = tr;
							break;
						case "focusout":
							u = "blur", l = tr;
							break;
						case "beforeblur":
						case "afterblur":
							l = tr;
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
							l = $n;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							l = er;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							l = pr;
							break;
						case pi:
						case mi:
						case hi:
							l = nr;
							break;
						case yi:
							l = mr;
							break;
						case "scroll":
						case "scrollend":
							l = Jn;
							break;
						case "wheel":
							l = hr;
							break;
						case "copy":
						case "cut":
						case "paste":
							l = rr;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							l = dr;
							break;
						case "submit":
							l = fr;
							break;
						case "toggle":
						case "beforetoggle": l = gr;
					}
					var d = !!(t & 4), f = !d && (e === "scroll" || e === "scrollend"), p = d ? c === null ? null : c + "Capture" : c;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = Nn(m, p), g != null && d.push(Zf(m, g, h))), f) break;
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
					if (l = e === "mouseover" || e === "pointerover", c = e === "mouseout" || e === "pointerout", l && n !== En && (u = n.relatedTarget || n.fromElement) && (zt(u) || u[jt])) break a;
					(c || l) && (u = i.window === i ? i : (l = i.ownerDocument) ? l.defaultView || l.parentWindow : window, c ? (l = n.relatedTarget || n.toElement, c = r, l = l ? zt(l) : null, l !== null && (f = o(l), d = l.tag, l !== f || d !== 5 && d !== 27 && d !== 6) && (l = null)) : (c = null, l = r), c !== l && (d = $n, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = dr, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = c == null ? u : Vt(c), h = l == null ? u : Vt(l), u = new d(g, m + "leave", c, n, i), u.target = f, u.relatedTarget = h, g = null, zt(i) === r && (d = new d(p, m + "enter", l, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, d = c && l ? E(c, l, $f) : null, c !== null && ep(s, u, c, d, !1), l !== null && f !== null && ep(s, f, l, d, !0)));
				}
				a: {
					if (c = r ? Vt(r) : window, l = c.nodeName && c.nodeName.toLowerCase(), l === "select" || l === "input" && c.type === "file") var _ = Ir;
					else if (Ar(c)) {
						if (Lr) _ = Kr;
						else {
							_ = Wr;
							var v = Ur;
						}
					} else l = c.nodeName, !l || l.toLowerCase() !== "input" || c.type !== "checkbox" && c.type !== "radio" ? r && xn(r.elementType) && (_ = Ir) : _ = Gr;
					if (_ &&= _(e, r)) {
						jr(s, _, n, i);
						break a;
					}
					v && v(e, c, r);
				}
				switch (v = r ? Vt(r) : window, e) {
					case "focusin":
						(Ar(v) || v.contentEditable === "true") && (ri = v, ii = r, ai = null);
						break;
					case "focusout":
						ai = ii = ri = null;
						break;
					case "mousedown":
						oi = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						oi = !1, si(s, n, i);
						break;
					case "selectionchange": if (ni) break;
					case "keydown":
					case "keyup": si(s, n, i);
				}
				var y;
				if (vr) b: {
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
				else Er ? wr(e, n) && (b = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (b = "onCompositionStart");
				b && (xr && n.locale !== "ko" && (Er || b !== "onCompositionStart" ? b === "onCompositionEnd" && Er && (y = Bn()) : (Ln = i, Rn = "value" in Ln ? Ln.value : Ln.textContent, Er = !0)), v = Qf(r, b), 0 < v.length && (b = new ir(b, e, null, n, i), s.push({
					event: b,
					listeners: v
				}), y ? b.data = y : (y = Tr(n), y !== null && (b.data = y)))), (y = br ? Dr(e, n) : Or(e, n)) && (b = Qf(r, "onBeforeInput"), 0 < b.length && (v = new ir("onBeforeInput", "beforeinput", null, n, i), s.push({
					event: v,
					listeners: b
				}), v.data = y)), Bf(s, e, r, n, i);
			}
			Gf(s, t);
		});
	}
	function Zf(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function Qf(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = Nn(e, n), i != null && r.unshift(Zf(e, i, a)), i = Nn(e, t), i != null && r.push(Zf(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function $f(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function ep(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = Nn(n, a), l != null && o.unshift(Zf(n, l, c))) : i || (l = Nn(n, a), l != null && o.push(Zf(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var tp = /\r\n?/g, np = /\u0000|\uFFFD/g;
	function rp(e) {
		return (typeof e == "string" ? e : "" + e).replace(tp, "\n").replace(np, "");
	}
	function ip(e, t) {
		return t = rp(t), rp(e) === t;
	}
	function Y(e, t, n, r, a, o) {
		switch (n) {
			case "children":
				if (typeof r == "string") t === "body" || t === "textarea" && r === "" || _n(e, r);
				else if (typeof r == "number" || typeof r == "bigint") t !== "body" && _n(e, "" + r);
				else return;
				break;
			case "className":
				tn(e, "class", r);
				break;
			case "tabIndex":
				tn(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				tn(e, n, r);
				break;
			case "style":
				bn(e, r, o);
				return;
			case "data": if (t !== "object") {
				tn(e, "data", r);
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
				r = wn(r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				}
				if (typeof o == "function" && (n === "formAction" ? (t !== "input" && Y(e, t, "name", a.name, a, null), Y(e, t, "formEncType", a.formEncType, a, null), Y(e, t, "formMethod", a.formMethod, a, null), Y(e, t, "formTarget", a.formTarget, a, null)) : (Y(e, t, "encType", a.encType, a, null), Y(e, t, "method", a.method, a, null), Y(e, t, "target", a.target, a, null))), r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = wn(r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = Tn);
				return;
			case "onScroll":
				r != null && J("scroll", e);
				return;
			case "onScrollEnd":
				r != null && J("scrollend", e);
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
				n = wn(r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
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
				J("beforetoggle", e), J("toggle", e), en(e, "popover", r);
				break;
			case "xlinkActuate":
				nn(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				nn(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				nn(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				nn(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				nn(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				nn(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				nn(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				nn(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				nn(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				en(e, "is", r);
				break;
			case "innerText":
			case "textContent": return;
			default: if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") n = Sn.get(n) || n, en(e, n, r);
			else return;
		}
		M = !0;
	}
	function ap(e, t, n, r, a, o) {
		switch (n) {
			case "style":
				bn(e, r, o);
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
				if (typeof r == "string") _n(e, r);
				else if (typeof r == "number" || typeof r == "bigint") _n(e, "" + r);
				else return;
				break;
			case "onScroll":
				r != null && J("scroll", e);
				return;
			case "onScrollEnd":
				r != null && J("scrollend", e);
				return;
			case "onClick":
				r != null && (e.onclick = Tn);
				return;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": return;
			case "innerText":
			case "textContent": return;
			default:
				if (!Kt.hasOwnProperty(n)) a: {
					if (n[0] === "o" && n[1] === "n" && (a = n.endsWith("Capture"), o = n.slice(2, a ? n.length - 7 : void 0), t = e[At] || null, t = t == null ? null : t[n], typeof t == "function" && e.removeEventListener(o, t, a), typeof r == "function")) {
						typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(o, r, a);
						break a;
					}
					M = !0, n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : en(e, n, r);
				}
				return;
		}
		M = !0;
	}
	function op(e, t, n) {
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
				J("error", e), J("load", e);
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
						default: Y(e, t, o, s, n, null);
					}
				}
				a && Y(e, t, "srcSet", n.srcSet, n, null), r && Y(e, t, "src", n.src, n, null);
				return;
			case "input":
				J("invalid", e);
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
						default: Y(e, t, r, d, n, null);
					}
				}
				fn(e, o, c, l, u, s, a, !1);
				return;
			case "select":
				for (a in J("invalid", e), r = s = o = null, n) if (n.hasOwnProperty(a) && (c = n[a], c != null)) switch (a) {
					case "value":
						o = c;
						break;
					case "defaultValue":
						s = c;
						break;
					case "multiple": r = c;
					default: Y(e, t, a, c, n, null);
				}
				t = o, n = s, e.multiple = !!r, t == null ? n != null && mn(e, !!r, n, !0) : mn(e, !!r, t, !1);
				return;
			case "textarea":
				for (s in J("invalid", e), o = a = r = null, n) if (n.hasOwnProperty(s) && (c = n[s], c != null)) switch (s) {
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
					default: Y(e, t, s, c, n, null);
				}
				gn(e, r, a, o);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: Y(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				J("beforetoggle", e), J("toggle", e), J("cancel", e), J("close", e);
				break;
			case "iframe":
			case "object":
				J("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < Uf.length; r++) J(Uf[r], e);
				break;
			case "image":
				J("error", e), J("load", e);
				break;
			case "details":
				J("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": J("error", e), J("load", e);
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
					default: Y(e, t, u, r, n, null);
				}
				return;
			default: if (xn(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && ap(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && Y(e, t, c, r, n, null));
	}
	var sp = {};
	function cp(e, t, n, r) {
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
						default: r.hasOwnProperty(m) || Y(e, t, m, null, r, f);
					}
				}
				for (var p in r) {
					var m = r[p];
					if (f = n[p], r.hasOwnProperty(p) && (m != null || f != null)) switch (p) {
						case "type":
							m !== f && (M = !0), o = m;
							break;
						case "name":
							m !== f && (M = !0), a = m;
							break;
						case "checked":
							m !== f && (M = !0), u = m;
							break;
						case "defaultChecked":
							m !== f && (M = !0), d = m;
							break;
						case "value":
							m !== f && (M = !0), s = m;
							break;
						case "defaultValue":
							m !== f && (M = !0), c = m;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (m != null) throw Error(i(137, t));
							break;
						default: m !== f && Y(e, t, p, m, r, f);
					}
				}
				dn(e, s, c, l, u, d, o, a);
				return;
			case "select":
				for (o in m = s = c = p = null, n) if (l = n[o], n.hasOwnProperty(o) && l != null) switch (o) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(o) || Y(e, t, o, null, r, l);
				}
				for (a in r) if (o = r[a], l = n[a], r.hasOwnProperty(a) && (o != null || l != null)) switch (a) {
					case "value":
						o !== l && (M = !0), p = o;
						break;
					case "defaultValue":
						o !== l && (M = !0), c = o;
						break;
					case "multiple": o !== l && (M = !0), s = o;
					default: o !== l && Y(e, t, a, o, r, l);
				}
				t = c, n = s, r = m, p == null ? !!r != !!n && (t == null ? mn(e, !!n, n ? [] : "", !1) : mn(e, !!n, t, !0)) : mn(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (a = n[c], n.hasOwnProperty(c) && a != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: Y(e, t, c, null, r, a);
				}
				for (s in r) if (a = r[s], o = n[s], r.hasOwnProperty(s) && (a != null || o != null)) switch (s) {
					case "value":
						a !== o && (M = !0), p = a;
						break;
					case "defaultValue":
						a !== o && (M = !0), m = a;
						break;
					case "children": break;
					case "dangerouslySetInnerHTML":
						if (a != null) throw Error(i(91));
						break;
					default: a !== o && Y(e, t, s, a, r, o);
				}
				hn(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: Y(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						p !== m && (M = !0), e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: Y(e, t, l, p, r, m);
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
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && Y(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(i(137, t));
						break;
					default: Y(e, t, u, p, r, m);
				}
				return;
			default: if (xn(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && ap(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || ap(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && Y(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || Y(e, t, f, p, r, m);
	}
	function lp(e) {
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
	function up() {
		if (typeof performance.getEntriesByType == "function") {
			for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
				var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
				if (a && s && lp(o)) {
					for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
						var c = n[r], l = c.startTime;
						if (l > s) break;
						var u = c.transferSize, d = c.initiatorType;
						u && lp(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
					}
					if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
				}
			}
			if (0 < e) return t / e / 1e6;
		}
		return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
	}
	var dp = null, fp = null;
	function pp(e) {
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	function mp(e) {
		switch (e) {
			case "http://www.w3.org/2000/svg": return 1;
			case "http://www.w3.org/1998/Math/MathML": return 2;
			default: return 0;
		}
	}
	function hp(e, t) {
		if (e === 0) switch (t) {
			case "svg": return 1;
			case "math": return 2;
			default: return 0;
		}
		return e === 1 && t === "foreignObject" ? 0 : e;
	}
	function gp(e, t, n, r) {
		return n = pp(n).createElement(e), n[kt] = r, n[At] = t, op(n, e, t), Ut(n), n;
	}
	function _p(e, t) {
		return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
	}
	var vp = null;
	function yp() {
		var e = window.event;
		return e && e.type === "popstate" ? e !== vp && (vp = e, !0) : (vp = null, !1);
	}
	var bp = typeof setTimeout == "function" ? setTimeout : void 0, xp = typeof clearTimeout == "function" ? clearTimeout : void 0, Sp = typeof Promise == "function" ? Promise : void 0, Cp = typeof requestAnimationFrame == "function" ? requestAnimationFrame : bp, wp = typeof queueMicrotask == "function" ? queueMicrotask : Sp === void 0 ? bp : function(e) {
		return Sp.resolve(null).then(e).catch(Tp);
	};
	function Tp(e) {
		setTimeout(function() {
			throw e;
		});
	}
	function Ep(e) {
		return e === "head";
	}
	function Dp(e, t) {
		var n = t, r = 0;
		do {
			var i = n.nextSibling;
			if (e.removeChild(n), i && i.nodeType === 8) {
				if (n = i.data, n === "/$" || n === "/&") {
					if (r === 0) {
						e.removeChild(i), Gh(t);
						return;
					}
					r--;
				} else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") r++;
				else if (n === "html") bm(e.ownerDocument.documentElement);
				else if (n === "head") {
					n = e.ownerDocument.head, bm(n);
					for (var a = n.firstChild; a;) {
						var o = a.nextSibling, s = a.nodeName;
						a[It] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
					}
				} else n === "body" && bm(e.ownerDocument.body);
			}
			n = i;
		} while (n);
		Gh(t);
	}
	function Op(e, t) {
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
	function kp(e, t, n) {
		if (t = CSS.escape(t) === t ? t : "r-" + btoa(t).replace(/=/g, ""), e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
			if (t = e.getClientRects(), t.length === 1) var r = 1;
			else for (var i = r = 0; i < t.length; i++) {
				var a = t[i];
				0 < a.width && 0 < a.height && r++;
			}
			r === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom);
		}
	}
	function Ap(e, t) {
		e = e.style, t = t.style;
		var n = t == null ? null : t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null;
		e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t == null ? null : t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n == null ? (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t) : e.margin = n));
	}
	function jp(e, t, n) {
		return n = n.ownerDocument.defaultView, {
			rect: e,
			abs: t.position === "absolute" || t.position === "fixed",
			clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
			view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
		};
	}
	function Mp(e) {
		return jp(e.getBoundingClientRect(), getComputedStyle(e), e);
	}
	function X(e) {
		var t = e.getBoundingClientRect();
		t = new DOMRect(t.x + 2e4, t.y + 2e4, t.width, t.height);
		var n = getComputedStyle(e);
		return jp(t, n, e);
	}
	function Np(e) {
		return e.documentElement.clientHeight;
	}
	function Pp(e) {
		this.addEventListener("load", e), this.addEventListener("error", e);
	}
	function Fp(e, t, n, r, i, a, o, s, c) {
		var l = t.nodeType === 9 ? t : t.ownerDocument;
		try {
			var u = l.startViewTransition({
				update: function() {
					var t = l.defaultView, n = t.navigation && t.navigation.transition, o = l.fonts.status;
					r();
					var s = [];
					if (o === "loaded" && (Np(l), l.fonts.status === "loading" && s.push(l.fonts.ready)), o = s.length, e !== null) for (var c = e.suspenseyImages, u = 0, d = 0; d < c.length; d++) {
						var f = c[d];
						if (!f.complete) {
							var p = f.getBoundingClientRect();
							if (0 < p.bottom && 0 < p.right && p.top < t.innerHeight && p.left < t.innerWidth) {
								if (u += $m(f), u > nh) {
									s.length = o;
									break;
								}
								f = new Promise(Pp.bind(f)), s.push(f);
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
	function Ip(e, t) {
		this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
	}
	Ip.prototype.animate = function(e, t) {
		return t = typeof t == "number" ? { duration: t } : D({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
	}, Ip.prototype.getAnimations = function() {
		for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), r = [], i = 0; i < n.length; i++) {
			var a = n[i].effect;
			a !== null && a.target === e && a.pseudoElement === t && r.push(n[i]);
		}
		return r;
	}, Ip.prototype.getComputedStyle = function() {
		return getComputedStyle(this._scope, this._selector);
	};
	function Lp(e) {
		return {
			name: e,
			group: new Ip("group", e),
			imagePair: new Ip("image-pair", e),
			old: new Ip("old", e),
			new: new Ip("new", e)
		};
	}
	function Rp(e) {
		this._fragmentFiber = e, this._observers = this._eventListeners = null;
	}
	Rp.prototype.addEventListener = function(e, t, n) {
		var r = null, i = null;
		if (!(n != null && typeof n != "boolean" && (r = n.signal || null, r !== null && r.aborted))) {
			this._eventListeners === null && (this._eventListeners = []);
			var a = this._eventListeners;
			if (Up(a, e, t, n) === -1) {
				var o = this, s = t;
				n != null && typeof n != "boolean" && !0 === n.once && (s = function(r) {
					o.removeEventListener(e, t, n), typeof t == "function" ? t.call(this, r) : t.handleEvent(r);
				}), r !== null && (i = o.removeEventListener.bind(o, e, t, n), r.addEventListener("abort", i, { once: !0 }), i = r.removeEventListener.bind(r, "abort", i)), r = Vp(n), a.push({
					type: e,
					listener: t,
					optionsOrUseCapture: n,
					attachedListener: s,
					cleanup: i
				}), h(this._fragmentFiber.child, !1, zp, e, s, r);
			}
			this._eventListeners = a;
		}
	};
	function zp(e, t, n, r) {
		return b(e).addEventListener(t, n, r), !1;
	}
	Rp.prototype.removeEventListener = function(e, t, n) {
		var r = this._eventListeners;
		if (r !== null && (t = Up(r, e, t, n), t !== -1)) {
			var i = r[t];
			n = i.attachedListener;
			var a = i.cleanup;
			i = Vp(i.optionsOrUseCapture), h(this._fragmentFiber.child, !1, Bp, e, n, i), r.splice(t, 1), a !== null && a();
		}
	};
	function Bp(e, t, n, r) {
		return b(e).removeEventListener(t, n, r), !1;
	}
	function Vp(e) {
		return e != null && typeof e != "boolean" && (!0 === e.once || e.signal instanceof AbortSignal) ? {
			capture: e.capture,
			passive: e.passive
		} : e;
	}
	function Hp(e) {
		return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
	}
	function Up(e, t, n, r) {
		if (e.length === 0) return -1;
		r = Hp(r);
		for (var i = 0; i < e.length; i++) {
			var a = e[i];
			if (a.type === t && a.listener === n && Hp(a.optionsOrUseCapture) === r) return i;
		}
		return -1;
	}
	Rp.prototype.dispatchEvent = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return !0;
		t = b(t);
		var n = this._eventListeners;
		if (n !== null && 0 < n.length || !e.bubbles) {
			var r = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
			if (n) for (var i = 0; i < n.length; i++) {
				var a = n[i];
				r.addEventListener(a.type, a.attachedListener, Vp(a.optionsOrUseCapture));
			}
			if (t.appendChild(r), e = r.dispatchEvent(e), n) for (i = 0; i < n.length; i++) a = n[i], r.removeEventListener(a.type, a.attachedListener, Vp(a.optionsOrUseCapture));
			return t.removeChild(r), e;
		}
		return t.dispatchEvent(e);
	}, Rp.prototype.focus = function(e) {
		h(this._fragmentFiber.child, !0, Wp, e, void 0, void 0);
	};
	function Wp(e, t) {
		return e.tag !== 6 && (e = b(e), gm(e, t));
	}
	Rp.prototype.focusLast = function(e) {
		var t = [];
		h(this._fragmentFiber.child, !0, Gp, t, void 0, void 0);
		for (var n = t.length - 1; 0 <= n && !Wp(t[n], e); n--);
	};
	function Gp(e, t) {
		return t.push(e), !1;
	}
	Rp.prototype.blur = function() {
		var e = g(this._fragmentFiber);
		e !== null && (e = b(e), e = pp(e).activeElement, e !== null && h(this._fragmentFiber.child, !1, Kp, e, void 0, void 0));
	};
	function Kp(e, t) {
		return e.tag !== 6 && (e = b(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
	}
	Rp.prototype.observeUsing = function(e) {
		this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), h(this._fragmentFiber.child, !1, qp, e, void 0, void 0);
	};
	function qp(e, t) {
		return e.tag !== 6 && (e = b(e), t.observe(e), !1);
	}
	Rp.prototype.unobserveUsing = function(e) {
		var t = this._observers;
		if (t !== null && t.has(e)) {
			t.delete(e), h(this._fragmentFiber.child, !1, Jp, e, void 0, void 0);
			for (var n = t = 0; n < Yp.length; n++) {
				var r = Yp[n];
				r.fragmentInstance === this && r.observer === e ? e.unobserve(r.instance) : Yp[t++] = r;
			}
			Yp.length = t;
		}
	};
	function Jp(e, t) {
		return e.tag !== 6 && (e = b(e), t.unobserve(e), !1);
	}
	var Yp = [], Xp = !1;
	function Zp(e, t, n) {
		Yp.push({
			fragmentInstance: e,
			observer: t,
			instance: n
		}), Xp || (Xp = !0, _m(function() {
			Xp = !1;
			var e = Yp;
			Yp = [];
			for (var t = 0; t < e.length; t++) {
				var n = e[t];
				n.observer.unobserve(n.instance);
			}
		}));
	}
	Rp.prototype.getClientRects = function() {
		var e = [];
		return h(this._fragmentFiber.child, !1, Qp, e, void 0, void 0), e;
	};
	function Qp(e, t) {
		if (e.tag === 6) {
			e = e.stateNode;
			var n = e.ownerDocument.createRange();
			n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
		} else e = b(e), t.push.apply(t, e.getClientRects());
		return !1;
	}
	Rp.prototype.getRootNode = function(e) {
		var t = g(this._fragmentFiber);
		return t === null ? this : b(t).getRootNode(e);
	}, Rp.prototype.compareDocumentPosition = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		var n = [];
		h(this._fragmentFiber.child, !1, Gp, n, void 0, void 0);
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
		return s = r && a && o & Node.DOCUMENT_POSITION_FOLLOWING && s & Node.DOCUMENT_POSITION_PRECEDING, t = r && t === e || a && i === e || c || s ? Node.DOCUMENT_POSITION_CONTAINED_BY : !r && t === e || !a && i === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : o, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || $p(t, this._fragmentFiber, n[0], n[n.length - 1], e) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
	};
	function $p(e, t, n, r, i) {
		var a = zt(i);
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
	function em(e, t) {
		var n = e.ownerDocument.createRange();
		n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(window.scrollX + e.left, t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight);
	}
	Rp.prototype.scrollIntoView = function(e) {
		if (typeof e == "object") throw Error(i(566));
		var t = [];
		h(this._fragmentFiber.child, !1, Gp, t, void 0, void 0);
		var n = !1 !== e;
		if (t.length === 0) {
			var r = v(this._fragmentFiber);
			if (r = n ? r[1] || r[0] || g(this._fragmentFiber) : r[0] || r[1], r === null) return;
			if (r.tag === 6) {
				e = b(r), em(e, n);
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
			a.tag === 6 ? (a = b(a), em(a, n)) : b(a).scrollIntoView(e), r += n ? -1 : 1;
		}
	};
	function tm(e, t) {
		return e = b(e), nm(e, t), !1;
	}
	function nm(e, t) {
		e.reactFragments ??= /* @__PURE__ */ new Set(), e.reactFragments.add(t);
	}
	function rm(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.addEventListener(i.type, i.attachedListener, Vp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			for (var r = 0, i = 0; i < Yp.length; i++) {
				var a = Yp[i];
				(a.fragmentInstance !== t || a.observer !== n || a.instance !== e) && (Yp[r++] = a);
			}
			Yp.length = r, n.observe(e);
		}), nm(e, t));
	}
	function im(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.removeEventListener(i.type, i.attachedListener, Vp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			typeof n.rootMargin == "string" ? Zp(t, n, e) : n.unobserve(e);
		}), e.reactFragments != null && e.reactFragments.delete(t));
	}
	function am(e) {
		var t = e.firstChild;
		for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
			var n = t;
			switch (t = t.nextSibling, n.nodeName) {
				case "HTML":
				case "HEAD":
				case "BODY":
					am(n), Rt(n);
					continue;
				case "SCRIPT":
				case "STYLE": continue;
				case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
			}
			e.removeChild(n);
		}
	}
	function om(e, t, n, r) {
		for (; e.nodeType === 1;) {
			var i = n;
			if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
				if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
			} else if (!r) {
				if (t === "input" && e.type === "hidden") {
					var a = i.name == null ? null : "" + i.name;
					if (i.type === "hidden" && e.getAttribute("name") === a) return e;
				} else return e;
			} else if (!e[It]) switch (t) {
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
			if (e = fm(e.nextSibling), e === null) break;
		}
		return null;
	}
	function sm(e, t, n) {
		if (t === "") return null;
		for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = fm(e.nextSibling), e === null)) return null;
		return e;
	}
	function cm(e, t) {
		for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = fm(e.nextSibling), e === null)) return null;
		return e;
	}
	function lm(e) {
		return e.data === "$?" || e.data === "$~";
	}
	function um(e) {
		return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
	}
	function dm(e, t) {
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
	function fm(e) {
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
	var pm = null;
	function mm(e) {
		e = e.nextSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "/$" || n === "/&") {
					if (t === 0) return fm(e.nextSibling);
					t--;
				} else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
			}
			e = e.nextSibling;
		}
		return null;
	}
	function hm(e) {
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
	function gm(e, t) {
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
	function _m(e) {
		Cp(function() {
			Cp(function(t) {
				return e(t);
			});
		});
	}
	function vm(e, t, n) {
		switch (t = pp(n), e) {
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
	function ym(e, t, n) {
		for (var r in n) {
			var i = n[r];
			n.hasOwnProperty(r) && i != null && Y(e, t, r, null, sp, i);
		}
		n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === Tn && (e.onclick = null), Rt(e);
	}
	function bm(e) {
		for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
		Rt(e);
	}
	var xm = /* @__PURE__ */ new Map(), Sm = /* @__PURE__ */ new Set();
	function Cm(e) {
		if (typeof e.getRootNode == "function") {
			var t = e.getRootNode();
			if (t.nodeType === 9 || t.nodeType === 11) return t;
		}
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	var wm = j.d;
	j.d = {
		f: Tm,
		r: Em,
		D: km,
		C: Am,
		L: jm,
		m: Mm,
		X: Pm,
		S: Nm,
		M: Fm
	};
	function Tm() {
		var e = wm.f(), t = Ud();
		return e || t;
	}
	function Em(e) {
		var t = Bt(e);
		t !== null && t.tag === 5 && t.type === "form" ? ac(t) : wm.r(e);
	}
	var Dm = typeof document > "u" ? null : document;
	function Om(e, t, n) {
		var r = Dm;
		if (r && typeof t == "string" && t) {
			var i = un(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), Sm.has(i) || (Sm.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), op(t, "link", e), Ut(t), r.head.appendChild(t)));
		}
	}
	function km(e) {
		wm.D(e), Om("dns-prefetch", e, null);
	}
	function Am(e, t) {
		wm.C(e, t), Om("preconnect", e, t);
	}
	function jm(e, t, n) {
		wm.L(e, t, n);
		var r = Dm;
		if (r && e && t) {
			var i = "link[rel=\"preload\"][as=\"" + un(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + un(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + un(n.imageSizes) + "\"]")) : i += "[href=\"" + un(e) + "\"]";
			var a = i;
			switch (t) {
				case "style":
					a = Lm(e);
					break;
				case "script": a = Vm(e);
			}
			if (!(xm.has(a) || (e = D({
				rel: "preload",
				href: t === "image" && n && n.imageSrcSet ? void 0 : e,
				as: t
			}, n), xm.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(Rm(a)) || t === "script" && r.querySelector(Hm(a))))) {
				var o = r.createElement("link");
				op(o, "link", e), t === "style" && (o[Lt] = !0, o.onload = o.onerror = function() {
					Wt(o);
				}), Ut(o), r.head.appendChild(o);
			}
		}
	}
	function Mm(e, t) {
		wm.m(e, t);
		var n = Dm;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + un(r) + "\"][href=\"" + un(e) + "\"]", a = i;
			switch (r) {
				case "audioworklet":
				case "paintworklet":
				case "serviceworker":
				case "sharedworker":
				case "worker":
				case "script": a = Vm(e);
			}
			if (!xm.has(a) && (e = D({
				rel: "modulepreload",
				href: e
			}, t), xm.set(a, e), n.querySelector(i) === null)) {
				switch (r) {
					case "audioworklet":
					case "paintworklet":
					case "serviceworker":
					case "sharedworker":
					case "worker":
					case "script": if (n.querySelector(Hm(a))) return;
				}
				r = n.createElement("link"), op(r, "link", e), Ut(r), n.head.appendChild(r);
			}
		}
	}
	function Nm(e, t, n) {
		wm.S(e, t, n);
		var r = Dm;
		if (r && e) {
			var i = Ht(r).hoistableStyles, a = Lm(e);
			t ||= "default";
			var o = i.get(a);
			if (!o) {
				var s = {
					loading: 0,
					preload: null
				};
				if (o = r.querySelector(Rm(a))) s.loading = 5;
				else {
					e = D({
						rel: "stylesheet",
						href: e,
						"data-precedence": t
					}, n), (n = xm.get(a)) && Gm(e, n);
					var c = o = r.createElement("link");
					Ut(c), op(c, "link", e), c._p = new Promise(function(e, t) {
						c.onload = e, c.onerror = t;
					}), c.addEventListener("load", function() {
						s.loading |= 1;
					}), c.addEventListener("error", function() {
						s.loading |= 2;
					}), s.loading |= 4, Wm(o, t, r);
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
	function Pm(e, t) {
		wm.X(e, t);
		var n = Dm;
		if (n && e) {
			var r = Ht(n).hoistableScripts, i = Vm(e), a = r.get(i);
			a || (a = n.querySelector(Hm(i)), a || (e = D({
				src: e,
				async: !0
			}, t), (t = xm.get(i)) && Km(e, t), a = n.createElement("script"), Ut(a), op(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Fm(e, t) {
		wm.M(e, t);
		var n = Dm;
		if (n && e) {
			var r = Ht(n).hoistableScripts, i = Vm(e), a = r.get(i);
			a || (a = n.querySelector(Hm(i)), a || (e = D({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = xm.get(i)) && Km(e, t), a = n.createElement("script"), Ut(a), op(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Im(e, t, n, r) {
		var a = (a = ke.current) ? Cm(a) : null;
		if (!a) throw Error(i(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (n = Lm(n.href), t = Ht(a).hoistableStyles, r = t.get(n), r || (r = {
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
					e = Lm(n.href);
					var o = Ht(a).hoistableStyles, s = o.get(e);
					if (s || (a = a.ownerDocument || a, s = {
						type: "stylesheet",
						instance: null,
						count: 0,
						state: {
							loading: 0,
							preload: null
						}
					}, o.set(e, s), (o = a.querySelector(Rm(e))) ? o._p || (s.instance = o, s.state.loading = 5) : (o = xm.get(e), o || (o = {
						rel: "preload",
						as: "style",
						href: n.href,
						crossOrigin: n.crossOrigin,
						integrity: n.integrity,
						media: n.media,
						hrefLang: n.hrefLang,
						referrerPolicy: n.referrerPolicy
					}, xm.set(e, o)), Bm(a, e, o, s.state))), t && r === null) throw Error(i(528, ""));
					return s;
				}
				if (t && r !== null) throw Error(i(529, ""));
				return null;
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = Vm(n), t = Ht(a).hoistableScripts, r = t.get(n), r || (r = {
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
	function Lm(e) {
		return "href=\"" + un(e) + "\"";
	}
	function Rm(e) {
		return "link[rel=\"stylesheet\"][" + e + "]";
	}
	function zm(e) {
		return D({}, e, {
			"data-precedence": e.precedence,
			precedence: null
		});
	}
	function Bm(e, t, n, r) {
		if (t = e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]")) {
			if (!0 !== t[Lt]) {
				r.loading = 1;
				return;
			}
		} else t = e.createElement("link"), t[Lt] = !0, t.onload = t.onerror = Wt.bind(null, t), op(t, "link", n), Ut(t), e.head.appendChild(t);
		r.preload = t, t.addEventListener("load", function() {
			return r.loading |= 1;
		}), t.addEventListener("error", function() {
			return r.loading |= 2;
		});
	}
	function Vm(e) {
		return "[src=\"" + un(e) + "\"]";
	}
	function Hm(e) {
		return "script[async]" + e;
	}
	function Um(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + un(n.href) + "\"]");
				if (r) return t.instance = r, Ut(r), r;
				var a = D({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), Ut(r), op(r, "style", a), Wm(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				a = Lm(n.href);
				var o = e.querySelector(Rm(a));
				if (o) return t.state.loading |= 4, t.instance = o, Ut(o), o;
				r = zm(n), (a = xm.get(a)) && Gm(r, a), o = (e.ownerDocument || e).createElement("link"), Ut(o);
				var s = o;
				return s._p = new Promise(function(e, t) {
					s.onload = e, s.onerror = t;
				}), op(o, "link", r), t.state.loading |= 4, Wm(o, n.precedence, e), t.instance = o;
			case "script": return o = Vm(n.src), (a = e.querySelector(Hm(o))) ? (t.instance = a, Ut(a), a) : (r = n, (a = xm.get(o)) && (r = D({}, n), Km(r, a)), e = e.ownerDocument || e, a = e.createElement("script"), Ut(a), op(a, "link", r), e.head.appendChild(a), t.instance = a);
			case "void": return null;
			default: throw Error(i(443, t.type));
		}
		else t.type === "stylesheet" && !(t.state.loading & 4) && (r = t.instance, t.state.loading |= 4, Wm(r, n.precedence, e));
		return t.instance;
	}
	function Wm(e, t, n) {
		for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
			var s = r[o];
			if (s.dataset.precedence === t) a = s;
			else if (a !== i) break;
		}
		a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
	}
	function Gm(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
	}
	function Km(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
	}
	var qm = null;
	function Jm(e, t, n) {
		if (qm === null) {
			var r = /* @__PURE__ */ new Map(), i = qm = /* @__PURE__ */ new Map();
			i.set(n, r);
		} else i = qm, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
		if (r.has(e)) return r;
		for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
			var a = n[i];
			if (!(a[It] || a[kt] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
				var o = a.getAttribute(t) || "";
				o = e + o;
				var s = r.get(o);
				s ? s.push(a) : r.set(o, [a]);
			}
		}
		return r;
	}
	function Ym(e, t, n) {
		e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
	}
	function Xm(e, t, n) {
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
	function Zm(e, t) {
		return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
	}
	function Qm(e) {
		return !(e.type === "stylesheet" && !(e.state.loading & 3));
	}
	function $m(e) {
		return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * .25;
	}
	function eh(e, t) {
		typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += $m(t), e.suspenseyImages.push(t)), e = oh.bind(e), t.decode().then(e, e));
	}
	function th(e, t, n, r) {
		if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && !(n.state.loading & 4)) {
			if (n.instance === null) {
				var i = Lm(r.href), a = t.querySelector(Rm(i));
				if (a) {
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = ah.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, Ut(a);
					return;
				}
				a = t.ownerDocument || t, r = zm(r), (i = xm.get(i)) && Gm(r, i), a = a.createElement("link"), Ut(a);
				var o = a;
				o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), op(a, "link", r), n.instance = a;
			}
			e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && !(n.state.loading & 3) && (e.count++, n = ah.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
		}
	}
	var nh = 0;
	function rh(e, t) {
		return e.stylesheets && e.count === 0 && ch(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
			var r = setTimeout(function() {
				if (e.stylesheets && ch(e, e.stylesheets), e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, 6e4 + t);
			0 < e.imgBytes && nh === 0 && (nh = 62500 * up());
			var i = setTimeout(function() {
				if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && ch(e, e.stylesheets), e.unsuspend)) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, (e.imgBytes > nh ? 50 : 800) + t);
			return e.unsuspend = n, function() {
				e.unsuspend = null, clearTimeout(r), clearTimeout(i);
			};
		} : null;
	}
	function ih(e) {
		if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
			if (e.stylesheets) ch(e, e.stylesheets);
			else if (e.unsuspend) {
				var t = e.unsuspend;
				e.unsuspend = null, t();
			}
		}
	}
	function ah() {
		this.count--, ih(this);
	}
	function oh() {
		this.imgCount--, ih(this);
	}
	var sh = null;
	function ch(e, t) {
		e.stylesheets = null, e.unsuspend !== null && (e.count++, sh = /* @__PURE__ */ new Map(), t.forEach(lh, e), sh = null, ah.call(e));
	}
	function lh(e, t) {
		if (!(t.state.loading & 4)) {
			var n = sh.get(e);
			if (n) var r = n.get(null);
			else {
				n = /* @__PURE__ */ new Map(), sh.set(e, n);
				for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
					var o = i[a];
					(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
				}
				r && n.set(null, r);
			}
			i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(null, i), n.set(o, i), this.count++, r = ah.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= 4;
		}
	}
	var uh = {
		$$typeof: se,
		Provider: null,
		Consumer: null,
		_currentValue: xe,
		_currentValue2: xe,
		_threadCount: 0
	};
	function dh(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = vt(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = vt(0), this.hiddenUpdates = vt(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function fh(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new dh(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = zi(3, null, null, t), e.current = a, a.stateNode = e, t = Fa(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, _o(a), e;
	}
	function ph(e) {
		return e ? (e = Li, e) : Li;
	}
	function mh(e, t, n, r, i, a) {
		i = ph(i), r.context === null ? r.context = i : r.pendingContext = i, r = yo(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = bo(e, r, t), n !== null && (Rd(n, e, t), xo(n, e, t));
	}
	function hh(e, t) {
		if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
			var n = e.retryLane;
			e.retryLane = n !== 0 && n < t ? n : t;
		}
	}
	function gh(e, t) {
		hh(e, t), (e = e.alternate) && hh(e, t);
	}
	function _h(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Pi(e, 67108864);
			t !== null && Rd(t, e, 67108864), gh(e, 67108864);
		}
	}
	function vh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Fd();
			t = wt(t);
			var n = Pi(e, t);
			n !== null && Rd(n, e, t), gh(e, t);
		}
	}
	var yh = !0;
	function bh(e, t, n, r) {
		var i = A.T;
		A.T = null;
		var a = j.p;
		try {
			j.p = 2, Sh(e, t, n, r);
		} finally {
			j.p = a, A.T = i;
		}
	}
	function xh(e, t, n, r) {
		var i = A.T;
		A.T = null;
		var a = j.p;
		try {
			j.p = 8, Sh(e, t, n, r);
		} finally {
			j.p = a, A.T = i;
		}
	}
	function Sh(e, t, n, r) {
		if (yh) {
			var i = Ch(r);
			if (i === null) Xf(e, t, r, wh, n), Fh(e, r);
			else if (Lh(i, e, t, n, r)) r.stopPropagation();
			else if (Fh(e, r), t & 4 && -1 < Ph.indexOf(e)) {
				for (; i !== null;) {
					var a = Bt(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = ft(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - at(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									Af(a), !(U & 6) && (bd = qe() + 500, jf(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = Pi(a, 2), s !== null && Rd(s, a, 2), Ud(), gh(a, 2);
					}
					if (a = Ch(r), a === null && Xf(e, t, r, wh, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else Xf(e, t, r, null, n);
		}
	}
	function Ch(e) {
		return e = Dn(e), Th(e);
	}
	var wh = null;
	function Th(e) {
		if (wh = null, e = zt(e), e !== null) {
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
		return wh = e, null;
	}
	function Eh(e) {
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
			case "message": switch (Je()) {
				case Ye: return 2;
				case Xe: return 8;
				case Ze:
				case Qe: return 32;
				case $e: return 268435456;
				default: return 32;
			}
			default: return 32;
		}
	}
	var Dh = !1, Oh = null, kh = null, Ah = null, jh = /* @__PURE__ */ new Map(), Mh = /* @__PURE__ */ new Map(), Nh = [], Ph = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
	function Fh(e, t) {
		switch (e) {
			case "focusin":
			case "focusout":
				Oh = null;
				break;
			case "dragenter":
			case "dragleave":
				kh = null;
				break;
			case "mouseover":
			case "mouseout":
				Ah = null;
				break;
			case "pointerover":
			case "pointerout":
				jh.delete(t.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": Mh.delete(t.pointerId);
		}
	}
	function Ih(e, t, n, r, i, a) {
		return e === null || e.nativeEvent !== a ? (e = {
			blockedOn: t,
			domEventName: n,
			eventSystemFlags: r,
			nativeEvent: a,
			targetContainers: [i]
		}, t !== null && (t = Bt(t), t !== null && _h(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
	}
	function Lh(e, t, n, r, i) {
		switch (t) {
			case "focusin": return Oh = Ih(Oh, e, t, n, r, i), !0;
			case "dragenter": return kh = Ih(kh, e, t, n, r, i), !0;
			case "mouseover": return Ah = Ih(Ah, e, t, n, r, i), !0;
			case "pointerover":
				var a = i.pointerId;
				return jh.set(a, Ih(jh.get(a) || null, e, t, n, r, i)), !0;
			case "gotpointercapture": return a = i.pointerId, Mh.set(a, Ih(Mh.get(a) || null, e, t, n, r, i)), !0;
		}
		return !1;
	}
	function Rh(e) {
		var t = zt(e.target);
		if (t !== null) {
			var n = o(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = s(n), t !== null) {
						e.blockedOn = t, Dt(e.priority, function() {
							vh(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = c(n), t !== null) {
						e.blockedOn = t, Dt(e.priority, function() {
							vh(n);
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
	function zh(e) {
		if (e.blockedOn !== null) return !1;
		for (var t = e.targetContainers; 0 < t.length;) {
			var n = Ch(e.nativeEvent);
			if (n === null) {
				n = e.nativeEvent;
				var r = new n.constructor(n.type, n);
				En = r, n.target.dispatchEvent(r), En = null;
			} else return t = Bt(n), t !== null && _h(t), e.blockedOn = n, !1;
			t.shift();
		}
		return !0;
	}
	function Bh(e, t, n) {
		zh(e) && n.delete(t);
	}
	function Vh() {
		Dh = !1, Oh !== null && zh(Oh) && (Oh = null), kh !== null && zh(kh) && (kh = null), Ah !== null && zh(Ah) && (Ah = null), jh.forEach(Bh), Mh.forEach(Bh);
	}
	function Hh(e, n) {
		e.blockedOn === n && (e.blockedOn = null, Dh || (Dh = !0, t.unstable_scheduleCallback(t.unstable_NormalPriority, Vh)));
	}
	var Uh = null;
	function Wh(e) {
		Uh !== e && (Uh = e, t.unstable_scheduleCallback(t.unstable_NormalPriority, function() {
			Uh === e && (Uh = null);
			for (var t = 0; t < e.length; t += 3) {
				var n = e[t], r = e[t + 1], i = e[t + 2];
				if (typeof r != "function") {
					if (Th(r || n) === null) continue;
					break;
				}
				var a = Bt(n);
				a !== null && (e.splice(t, 3), t -= 3, rc(a, {
					pending: !0,
					data: i,
					method: n.method,
					action: r
				}, r, i));
			}
		}));
	}
	function Gh(e) {
		function t(t) {
			return Hh(t, e);
		}
		Oh !== null && Hh(Oh, e), kh !== null && Hh(kh, e), Ah !== null && Hh(Ah, e), jh.forEach(t), Mh.forEach(t);
		for (var n = 0; n < Nh.length; n++) {
			var r = Nh[n];
			r.blockedOn === e && (r.blockedOn = null);
		}
		for (; 0 < Nh.length && (n = Nh[0], n.blockedOn === null);) Rh(n), n.blockedOn === null && Nh.shift();
		if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
			var i = n[r], a = n[r + 1], o = i[At] || null;
			if (typeof a == "function") o || Wh(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[At] || null) s = o.formAction;
					else if (Th(i) !== null) continue;
				} else s = o.action;
				typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), Wh(n);
			}
		}
	}
	function Kh() {
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
	function qh(e) {
		this._internalRoot = e;
	}
	Jh.prototype.render = qh.prototype.render = function(e) {
		var t = this._internalRoot;
		if (t === null) throw Error(i(409));
		var n = t.current;
		mh(n, Fd(), e, t, null, null);
	}, Jh.prototype.unmount = qh.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			mh(e.current, 2, null, e, null, null), Ud(), t[jt] = null;
		}
	};
	function Jh(e) {
		this._internalRoot = e;
	}
	Jh.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = Et();
			e = {
				blockedOn: null,
				target: e,
				priority: t
			};
			for (var n = 0; n < Nh.length && t !== 0 && t < Nh[n].priority; n++);
			Nh.splice(n, 0, e), n === 0 && Rh(e);
		}
	};
	var Yh = n.version;
	if (Yh !== "19.3.0") throw Error(i(527, Yh, "19.3.0"));
	j.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(i(188)) : (e = Object.keys(e).join(","), Error(i(268, e)));
		return e = d(t), e = e === null ? null : p(e), e = e === null ? null : e.stateNode, e;
	};
	var Xh = {
		bundleType: 0,
		version: "19.3.0",
		rendererPackageName: "react-dom",
		currentDispatcherRef: A,
		reconcilerVersion: "19.3.0"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var Zh = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!Zh.isDisabled && Zh.supportsFiber) try {
			nt = Zh.inject(Xh), rt = Zh;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!a(e)) throw Error(i(299));
		var n = !1, r = "", o = Ec, s = Dc, c = Oc;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (s = t.onCaughtError), t.onRecoverableError !== void 0 && (c = t.onRecoverableError)), t = fh(e, 1, !1, null, null, n, r, null, o, s, c, Kh), e[jt] = t.current, Jf(e), new qh(t);
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
	let a = xe((typeof t == "string" ? ne(t) : t).pathname || "/", n);
	if (a == null) return null;
	let o = i ?? se(e), s = null, c = j(a);
	for (let e = 0; s == null && e < o.length; ++e) s = ve(o[e], c, r);
	return s;
}
function se(e) {
	let t = O(e);
	return le(t), t;
}
function O(e, t = [], n = [], r = "", i = !1) {
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
		let l = ke([r, c.relativePath]), u = n.concat(c);
		e.children && e.children.length > 0 && (w(e.index !== !0, `Index routes must not have child routes. Please remove all child routes from route path "${l}".`), O(e.children, t, u, l, o)), (e.path != null || e.index) && t.push({
			path: l,
			score: ge(l, e.index),
			routesMeta: u.map((e, t) => {
				let [n, r] = A(e.relativePath, e.caseSensitive, t === u.length - 1);
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
		else for (let n of ce(e.path)) a(e, t, !0, n);
	}), t;
}
function ce(e) {
	let t = e.split("/");
	if (t.length === 0) return [];
	let [n, ...r] = t, i = n.endsWith("?"), a = n.replace(/\?$/, "");
	if (r.length === 0) return i ? [a, ""] : [a];
	let o = ce(r.join("/")), s = [];
	return s.push(...o.map((e) => e === "" ? a : [a, e].join("/"))), i && s.push(...o), s.map((t) => e.startsWith("/") && t === "" ? "/" : t);
}
function le(e) {
	e.sort((e, t) => e.score === t.score ? _e(e.routesMeta.map((e) => e.childrenIndex), t.routesMeta.map((e) => e.childrenIndex)) : t.score - e.score);
}
var ue = /^:[\w-]+$/, de = 3, fe = 2, pe = 1, me = 10, he = -2, k = (e) => e === "*";
function ge(e, t) {
	let n = e.split("/"), r = n.length;
	return n.some(k) && (r += he), t && (r += fe), n.filter((e) => !k(e)).reduce((e, t) => e + (ue.test(t) ? de : t === "" ? pe : me), r);
}
function _e(e, t) {
	return e.length === t.length && e.slice(0, -1).every((e, n) => e === t[n]) ? e[e.length - 1] - t[t.length - 1] : 0;
}
function ve(e, t, n = !1) {
	let { routesMeta: r } = e, i = {}, a = "/", o = [];
	for (let e = 0; e < r.length; ++e) {
		let s = r[e], c = e === r.length - 1, l = a === "/" ? t : t.slice(a.length) || "/", u = {
			path: s.relativePath,
			caseSensitive: s.caseSensitive,
			end: c
		}, d = s.matcher && s.compiledParams ? be(u, l, s.matcher, s.compiledParams) : ye(u, l), f = s.route;
		if (!d && c && n && !r[r.length - 1].route.index && (d = ye({
			path: s.relativePath,
			caseSensitive: s.caseSensitive,
			end: !1
		}, l)), !d) return null;
		Object.assign(i, d.params), o.push({
			params: i,
			pathname: ke([a, d.pathname]),
			pathnameBase: je(ke([a, d.pathnameBase])),
			route: f
		}), d.pathnameBase !== "/" && (a = ke([a, d.pathnameBase]));
	}
	return o;
}
function ye(e, t) {
	typeof e == "string" && (e = {
		path: e,
		caseSensitive: !1,
		end: !0
	});
	let [n, r] = A(e.path, e.caseSensitive, e.end);
	return be(e, t, n, r);
}
function be(e, t, n, r) {
	let i = t.match(n);
	if (!i) return null;
	let a = i[0], o = Ae(a, 1), s = i.slice(1);
	return {
		params: r.reduce((e, { paramName: t, isOptional: n }, r) => {
			if (t === "*") {
				let e = s[r] || "";
				o = Ae(a.slice(0, a.length - e.length), 1);
			}
			let i = s[r];
			return e[t] = n && !i ? void 0 : (i || "").replace(/%2F/g, "/"), e;
		}, {}),
		pathname: a,
		pathnameBase: o,
		pattern: e
	};
}
function A(e, t = !1, n = !0) {
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
function j(e) {
	try {
		return e.split("/").map((e) => decodeURIComponent(e).replace(/\//g, "%2F")).join("/");
	} catch (t) {
		return T(!1, `The URL path "${e}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${t}).`), e;
	}
}
function xe(e, t) {
	if (t === "/") return e;
	if (!e.toLowerCase().startsWith(t.toLowerCase())) return null;
	let n = t.endsWith("/") ? t.length - 1 : t.length, r = e.charAt(n);
	return r && r !== "/" ? null : e.slice(n) || "/";
}
function Se(e, t = "/") {
	let { pathname: n, search: r = "", hash: i = "" } = typeof e == "string" ? ne(e) : e, a;
	return n ? (n = Oe(n), a = n.startsWith("/") || n.startsWith("\\") ? Ce(n.substring(1), "/") : Ce(n, t)) : a = t, {
		pathname: a,
		search: Me(r),
		hash: Ne(i)
	};
}
function Ce(e, t) {
	let n = Ae(t).split("/");
	return e.split("/").forEach((e) => {
		e === ".." ? n.length > 1 && n.pop() : e !== "." && n.push(e);
	}), n.length > 1 ? n.join("/") : "/";
}
function we(e, t, n, r) {
	return `Cannot include a '${e}' character in a manually specified \`to.${t}\` field [${JSON.stringify(r)}].  Please separate it out to the \`to.${n}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`;
}
function Te(e) {
	return e.filter((e, t) => t === 0 || e.route.path && e.route.path.length > 0);
}
function Ee(e) {
	let t = Te(e);
	return t.map((e, n) => n === t.length - 1 ? e.pathname : e.pathnameBase);
}
function De(e, t, n, r = !1) {
	let i;
	typeof e == "string" ? i = ne(e) : (i = { ...e }, w(!i.pathname || !i.pathname.includes("?"), we("?", "pathname", "search", i)), w(!i.pathname || !i.pathname.includes("#"), we("#", "pathname", "hash", i)), w(!i.search || !i.search.includes("#"), we("#", "search", "hash", i)));
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
	let c = Se(i, s), l = o && o !== "/" && o.endsWith("/"), u = (a || o === ".") && n.endsWith("/");
	return !c.pathname.endsWith("/") && (l || u) && (c.pathname += "/"), c;
}
var Oe = (e) => e.replace(/[\\/]{2,}/g, "/"), ke = (e) => Oe(e.join("/"));
function Ae(e, t = 0) {
	let n = e.length;
	for (; n > t && e.charCodeAt(n - 1) === 47;) n--;
	return n === e.length ? e : e.slice(0, n);
}
var je = (e) => Ae(e).replace(/^\/*/, "/"), Me = (e) => !e || e === "?" ? "" : e.startsWith("?") ? e : "?" + e, Ne = (e) => !e || e === "#" ? "" : e.startsWith("#") ? e : "#" + e, Pe = class {
	constructor(e, t, n, r = !1) {
		this.status = e, this.statusText = t || "", this.internal = r, n instanceof Error ? (this.data = n.toString(), this.error = n) : this.data = n;
	}
};
function Fe(e) {
	return e != null && typeof e.status == "number" && typeof e.statusText == "string" && typeof e.internal == "boolean" && "data" in e;
}
function Ie(e) {
	return ke(e.map((e) => e.route.path).filter(Boolean)) || "/";
}
var Le = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0;
function Re(e, t) {
	let n = e;
	if (typeof n != "string" || !v.test(n)) return {
		absoluteURL: void 0,
		isExternal: !1,
		to: n
	};
	let r = n, i = !1;
	if (Le) try {
		let e = new URL(window.location.href), r = y.test(n) ? new URL(b(n, e.protocol)) : new URL(n), a = xe(r.pathname, t);
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
var ze = new URL("http://localhost");
function Be(e) {
	if (e.createURL) return e.createURL("/");
	try {
		return new URL(e.createHref("/"), ze);
	} catch {
		return ze;
	}
}
function Ve(e, t) {
	return e.origin === t.origin && (e.origin !== "null" || e.protocol === t.protocol && e.host === t.host);
}
function He(e, t) {
	if (e.startsWith("//")) return !0;
	let n = t.protocol.toLowerCase();
	return e.toLowerCase().startsWith(n) ? t.host === "" || e.slice(n.length).startsWith("//") : !1;
}
function Ue(e, t, n, r) {
	let i = null;
	try {
		i = e == null ? null : new URL(e, n);
	} catch {}
	let a = new URL(t, n), o = i != null && !Ve(i, n), s = !Ve(a, n);
	if (r === "reject") {
		if (o || s) throw Error("External navigation is not allowed");
	} else if (s && (i == null || !He(e, i) || !Ve(i, a))) throw Error("External navigation is not allowed");
}
var We = [
	"POST",
	"PUT",
	"PATCH",
	"DELETE"
];
new Set(We);
var Ge = ["GET", ...We];
new Set(Ge);
var Ke = [
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
function qe(e) {
	try {
		return Ke.includes(new URL(e).protocol);
	} catch {
		return !1;
	}
}
var Je = _.createContext(null);
Je.displayName = "DataRouter";
var Ye = _.createContext(null);
Ye.displayName = "DataRouterState";
var Xe = _.createContext(!1);
function Ze() {
	return _.useContext(Xe);
}
var Qe = _.createContext({ isTransitioning: !1 });
Qe.displayName = "ViewTransition";
var $e = _.createContext(/* @__PURE__ */ new Map());
$e.displayName = "Fetchers";
var et = _.createContext(null);
et.displayName = "Await";
var tt = _.createContext(null);
tt.displayName = "Navigation";
var nt = _.createContext(null);
nt.displayName = "Location";
var rt = _.createContext({
	outlet: null,
	matches: [],
	isDataRoute: !1
});
rt.displayName = "Route";
var it = _.createContext(null);
it.displayName = "RouteError";
var at = "REACT_ROUTER_ERROR", ot = "REDIRECT", st = "ROUTE_ERROR_RESPONSE";
function ct(e) {
	if (e.startsWith(`${at}:${ot}:{`)) try {
		let t = JSON.parse(e.slice(28));
		if (typeof t == "object" && t && typeof t.status == "number" && typeof t.statusText == "string" && typeof t.location == "string" && typeof t.reloadDocument == "boolean" && typeof t.replace == "boolean") return t;
	} catch {}
}
function lt(e) {
	if (e.startsWith(`${at}:${st}:{`)) try {
		let t = JSON.parse(e.slice(40));
		if (typeof t == "object" && t && typeof t.status == "number" && typeof t.statusText == "string") return new Pe(t.status, t.statusText, t.data);
	} catch {}
}
function ut(e, { relative: t } = {}) {
	w(dt(), "useHref() may be used only in the context of a <Router> component.");
	let { basename: n, navigator: r } = _.useContext(tt), { hash: i, pathname: a, search: o } = yt(e, { relative: t }), s = a;
	return n !== "/" && (s = a === "/" ? n : ke([n, a])), r.createHref({
		pathname: s,
		search: o,
		hash: i
	});
}
function dt() {
	return _.useContext(nt) != null;
}
function ft() {
	return w(dt(), "useLocation() may be used only in the context of a <Router> component."), _.useContext(nt).location;
}
var pt = "You should call navigate() in a React.useEffect(), not when your component is first rendered.";
function mt(e) {
	_.useContext(tt).static || _.useLayoutEffect(e);
}
function ht() {
	let { isDataRoute: e } = _.useContext(rt);
	return e ? It() : gt();
}
function gt() {
	w(dt(), "useNavigate() may be used only in the context of a <Router> component.");
	let e = _.useContext(Je), { basename: t, navigator: n } = _.useContext(tt), { matches: r } = _.useContext(rt), { pathname: i } = ft(), a = JSON.stringify(Ee(r)), o = _.useRef(!1);
	return mt(() => {
		o.current = !0;
	}), _.useCallback((r, s = {}) => {
		if (T(o.current, pt), !o.current) return;
		if (typeof r == "number") {
			n.go(r);
			return;
		}
		let c = De(r, JSON.parse(a), i, s.relative === "path");
		e == null && t !== "/" && (c.pathname = c.pathname === "/" ? t : ke([t, c.pathname])), Ue(typeof r == "string" ? r : te(r), n.createHref(c), Be(n), "reject"), (s.replace ? n.replace : n.push)(c, s.state, s);
	}, [
		t,
		n,
		a,
		i,
		e
	]);
}
var _t = _.createContext(null);
function vt(e) {
	let t = _.useContext(rt).outlet;
	return _.useMemo(() => t && /* @__PURE__ */ _.createElement(_t.Provider, { value: e }, t), [t, e]);
}
function yt(e, { relative: t } = {}) {
	let { matches: n } = _.useContext(rt), { pathname: r } = ft(), i = JSON.stringify(Ee(n));
	return _.useMemo(() => De(e, JSON.parse(i), r, t === "path"), [
		e,
		i,
		r,
		t
	]);
}
function bt(e, t) {
	return xt(e, t);
}
function xt(e, t, n) {
	w(dt(), "useRoutes() may be used only in the context of a <Router> component.");
	let { navigator: r } = _.useContext(tt), { matches: i } = _.useContext(rt), a = i[i.length - 1], o = a ? a.params : {}, s = a ? a.pathname : "/", c = a ? a.pathnameBase : "/", l = a && a.route;
	{
		let e = l && l.path || "";
		Rt(s, !l || e.endsWith("*") || e.endsWith("*?"), `You rendered descendant <Routes> (or called \`useRoutes()\`) at "${s}" (under <Route path="${e}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${e}"> to <Route path="${e === "/" ? "*" : `${e}/*`}">.`);
	}
	let u = ft(), d;
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
	let h = Ot(m && m.map((e) => Object.assign({}, e, {
		params: Object.assign({}, o, e.params),
		pathname: ke([c, r.encodeLocation ? r.encodeLocation(e.pathname.replace(/%/g, "%25").replace(/\?/g, "%3F").replace(/#/g, "%23")).pathname : e.pathname]),
		pathnameBase: e.pathnameBase === "/" ? c : ke([c, r.encodeLocation ? r.encodeLocation(e.pathnameBase.replace(/%/g, "%25").replace(/\?/g, "%3F").replace(/#/g, "%23")).pathname : e.pathnameBase])
	})), i, n);
	return t && h ? /* @__PURE__ */ _.createElement(nt.Provider, { value: {
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
function St() {
	let e = Ft(), t = Fe(e) ? `${e.status} ${e.statusText}` : e instanceof Error ? e.message : JSON.stringify(e), n = e instanceof Error ? e.stack : null, r = "rgba(200,200,200, 0.5)", i = {
		padding: "0.5rem",
		backgroundColor: r
	}, a = {
		padding: "2px 4px",
		backgroundColor: r
	}, o = null;
	return console.error("Error handled by React Router default ErrorBoundary:", e), o = /* @__PURE__ */ _.createElement(_.Fragment, null, /* @__PURE__ */ _.createElement("p", null, "💿 Hey developer 👋"), /* @__PURE__ */ _.createElement("p", null, "You can provide a way better UX than this when your app throws errors by providing your own ", /* @__PURE__ */ _.createElement("code", { style: a }, "ErrorBoundary"), " or", " ", /* @__PURE__ */ _.createElement("code", { style: a }, "errorElement"), " prop on your route.")), /* @__PURE__ */ _.createElement(_.Fragment, null, /* @__PURE__ */ _.createElement("h2", null, "Unexpected Application Error!"), /* @__PURE__ */ _.createElement("h3", { style: { fontStyle: "italic" } }, t), n ? /* @__PURE__ */ _.createElement("pre", { style: i }, n) : null, o);
}
var Ct = /* @__PURE__ */ _.createElement(St, null), wt = class extends _.Component {
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
			let t = lt(e.digest);
			t && (e = t);
		}
		let t = e === void 0 ? this.props.children : /* @__PURE__ */ _.createElement(rt.Provider, { value: this.props.routeContext }, /* @__PURE__ */ _.createElement(it.Provider, {
			value: e,
			children: this.props.component
		}));
		return this.context ? /* @__PURE__ */ _.createElement(Et, { error: e }, t) : t;
	}
};
wt.contextType = Xe;
var Tt = /* @__PURE__ */ new WeakMap();
function Et({ children: e, error: t }) {
	let { basename: n, navigator: r } = _.useContext(tt);
	if (typeof t == "object" && t && "digest" in t && typeof t.digest == "string") {
		let e = ct(t.digest);
		if (e) {
			let i = Tt.get(t);
			if (i) throw i;
			let a = Re(e.location, n), o = a.absoluteURL || a.to;
			if (Ue(e.location, o, Be(r), "allow-explicit"), qe(o)) throw Error("Invalid redirect location");
			if (Le && !Tt.get(t)) {
				if (a.isExternal || e.reloadDocument) window.location.href = o;
				else {
					let n = Promise.resolve().then(() => window.__reactRouterDataRouter.navigate(a.to, { replace: e.replace }));
					throw Tt.set(t, n), n;
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
function Dt({ routeContext: e, match: t, children: n }) {
	let r = _.useContext(Je);
	return r && r.static && r.staticContext && (t.route.errorElement || t.route.ErrorBoundary) && (r.staticContext._deepestRenderedBoundaryId = t.route.id), /* @__PURE__ */ _.createElement(rt.Provider, { value: e }, n);
}
function Ot(e, t = [], n) {
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
			pattern: Ie(r.matches),
			errorInfo: t
		});
	} : void 0;
	return i.reduceRight((e, n, c) => {
		let u, d = !1, f = null, p = null;
		r && (u = a && n.route.id ? a[n.route.id] : void 0, f = n.route.errorElement || Ct, o && (s < 0 && c === 0 ? (Rt("route-fallback", !1, "No `HydrateFallback` element provided to render during initial hydration"), d = !0, p = null) : s === c && (d = !0, p = n.route.hydrateFallbackElement || null)));
		let m = t.concat(i.slice(0, c + 1)), h = () => {
			let t;
			return t = u ? f : d ? p : n.route.Component ? /* @__PURE__ */ _.createElement(n.route.Component, null) : n.route.element ? n.route.element : e, /* @__PURE__ */ _.createElement(Dt, {
				match: n,
				routeContext: {
					outlet: e,
					matches: m,
					isDataRoute: r != null
				},
				children: t
			});
		};
		return r && (n.route.ErrorBoundary || n.route.errorElement || c === 0) ? /* @__PURE__ */ _.createElement(wt, {
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
function kt(e) {
	return `${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function At(e) {
	let t = _.useContext(Je);
	return w(t, kt(e)), t;
}
function jt(e) {
	let t = _.useContext(Ye);
	return w(t, kt(e)), t;
}
function Mt(e) {
	let t = _.useContext(rt);
	return w(t, kt(e)), t;
}
function Nt(e) {
	let t = Mt(e), n = t.matches[t.matches.length - 1];
	return w(n.route.id, `${e} can only be used on routes that contain a unique "id"`), n.route.id;
}
function Pt() {
	return Nt("useRouteId");
}
function Ft() {
	let e = _.useContext(it), t = jt("useRouteError"), n = Nt("useRouteError");
	return e === void 0 ? t.errors?.[n] : e;
}
function It() {
	let { router: e } = At("useNavigate"), t = Nt("useNavigate"), n = _.useRef(!1);
	return mt(() => {
		n.current = !0;
	}), _.useCallback(async (r, i = {}) => {
		T(n.current, pt), n.current && (typeof r == "number" ? await e.navigate(r) : await e.navigate(r, {
			fromRouteId: t,
			...i
		}));
	}, [e, t]);
}
var Lt = {};
function Rt(e, t, n) {
	!t && !Lt[e] && (Lt[e] = !0, T(!1, n));
}
_.memo(zt);
function zt({ routes: e, manifest: t, future: n, state: r, isStatic: i, onError: a }) {
	return xt(e, void 0, {
		manifest: t,
		state: r,
		isStatic: i,
		onError: a,
		future: n
	});
}
function Bt({ to: e, replace: t, state: n, relative: r }) {
	w(dt(), "<Navigate> may be used only in the context of a <Router> component.");
	let { static: i, navigator: a } = _.useContext(tt);
	T(!i, "<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.");
	let { matches: o } = _.useContext(rt), { pathname: s } = ft(), c = ht(), l = De(e, Ee(o), s, r === "path");
	Ue(typeof e == "string" ? e : te(e), a.createHref(l), Be(a), "reject");
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
function Vt(e) {
	return vt(e.context);
}
function Ht(e) {
	w(!1, "A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.");
}
function Ut({ basename: e = "/", children: t = null, location: n, navigationType: r = "POP", navigator: i, static: a = !1, useTransitions: o }) {
	w(!dt(), "You cannot render a <Router> inside another <Router>. You should never have more than one in your app.");
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
		let e = xe(l, s);
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
	return T(h != null, `<Router basename="${s}"> is not able to match the URL "${l}${u}${d}" because it does not start with the basename, so the <Router> won't render anything.`), h == null ? null : /* @__PURE__ */ _.createElement(tt.Provider, { value: c }, /* @__PURE__ */ _.createElement(nt.Provider, {
		children: t,
		value: h
	}));
}
function Wt({ children: e, location: t }) {
	return bt(Gt(e), t);
}
_.Component;
function Gt(e, t = []) {
	let n = [];
	return _.Children.forEach(e, (e, r) => {
		if (!_.isValidElement(e)) return;
		let i = [...t, r];
		if (e.type === _.Fragment) {
			n.push.apply(n, Gt(e.props.children, i));
			return;
		}
		w(e.type === Ht, `[${typeof e.type == "string" ? e.type : e.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`), w(!e.props.index || !e.props.children, "An index route cannot have child routes.");
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
		e.props.children && (a.children = Gt(e.props.children, i)), n.push(a);
	}), n;
}
var Kt = "get", qt = "application/x-www-form-urlencoded";
function Jt(e) {
	return typeof HTMLElement < "u" && e instanceof HTMLElement;
}
function Yt(e) {
	return Jt(e) && e.tagName.toLowerCase() === "button";
}
function Xt(e) {
	return Jt(e) && e.tagName.toLowerCase() === "form";
}
function Zt(e) {
	return Jt(e) && e.tagName.toLowerCase() === "input";
}
function Qt(e) {
	return !!(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey);
}
function M(e, t) {
	return e.button === 0 && (!t || t === "_self") && !Qt(e);
}
var $t = null;
function en() {
	if ($t === null) try {
		new FormData(document.createElement("form"), 0), $t = !1;
	} catch {
		$t = !0;
	}
	return $t;
}
var tn = /* @__PURE__ */ new Set([
	"application/x-www-form-urlencoded",
	"multipart/form-data",
	"text/plain"
]);
function nn(e) {
	return e != null && !tn.has(e) ? (T(!1, `"${e}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${qt}"`), null) : e;
}
function rn(e, t) {
	let n, r, i, a, o;
	if (Xt(e)) {
		let o = e.getAttribute("action");
		r = o ? xe(o, t) : null, n = e.getAttribute("method") || Kt, i = nn(e.getAttribute("enctype")) || qt, a = new FormData(e);
	} else if (Yt(e) || Zt(e) && (e.type === "submit" || e.type === "image")) {
		let o = e.form;
		if (o == null) throw Error("Cannot submit a <button> or <input type=\"submit\"> without a <form>");
		let s = e.getAttribute("formaction") || o.getAttribute("action");
		if (r = s ? xe(s, t) : null, n = e.getAttribute("formmethod") || o.getAttribute("method") || Kt, i = nn(e.getAttribute("formenctype")) || nn(o.getAttribute("enctype")) || qt, a = new FormData(o, e), !en()) {
			let { name: t, type: n, value: r } = e;
			if (n === "image") {
				let e = t ? `${t}.` : "";
				a.append(`${e}x`, "0"), a.append(`${e}y`, "0");
			} else t && a.append(t, r);
		}
	} else if (Jt(e)) throw Error("Cannot submit element that is not <form>, <button>, or <input type=\"submit|image\">");
	else n = Kt, r = null, i = qt, o = e;
	return a && i === "text/plain" && (o = a, a = void 0), {
		action: r,
		method: n.toLowerCase(),
		encType: i,
		formData: a,
		body: o
	};
}
Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function an(e, t) {
	if (e === !1 || e == null) throw Error(t);
}
function on(e, t, n, r) {
	let i = typeof e == "string" ? new URL(e, typeof window > "u" ? "server://singlefetch/" : window.location.origin) : e;
	return i.pathname = n ? i.pathname.endsWith("/") ? `${i.pathname}_.${r}` : `${i.pathname}.${r}` : i.pathname === "/" ? `_root.${r}` : t && xe(i.pathname, t) === "/" ? `${Ae(t)}/_root.${r}` : `${Ae(i.pathname)}.${r}`, i;
}
async function sn(e, t) {
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
function cn(e) {
	return e != null && typeof e.page == "string";
}
function ln(e) {
	return e == null ? !1 : e.href == null ? e.rel === "preload" && typeof e.imageSrcSet == "string" && typeof e.imageSizes == "string" : typeof e.rel == "string" && typeof e.href == "string";
}
async function un(e, t, n) {
	return hn((await Promise.all(e.map(async (e) => {
		let r = t.routes[e.route.id];
		if (r) {
			let e = await sn(r, n);
			return e.links ? e.links() : [];
		}
		return [];
	}))).flat(1).filter(ln).filter((e) => e.rel === "stylesheet" || e.rel === "preload").map((e) => e.rel === "stylesheet" ? {
		...e,
		rel: "prefetch",
		as: "style"
	} : {
		...e,
		rel: "prefetch"
	}));
}
function dn(e, t, n, r, i, a) {
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
function fn(e, t, { includeHydrateFallback: n } = {}) {
	return pn(e.map((e) => {
		let r = t.routes[e.route.id];
		if (!r) return [];
		let i = [r.module];
		return r.clientActionModule && (i = i.concat(r.clientActionModule)), r.clientLoaderModule && (i = i.concat(r.clientLoaderModule)), n && r.hydrateFallbackModule && (i = i.concat(r.hydrateFallbackModule)), r.imports && (i = i.concat(r.imports)), i;
	}).flat(1));
}
function pn(e) {
	return [...new Set(e)];
}
function mn(e) {
	let t = {}, n = Object.keys(e).sort();
	for (let r of n) t[r] = e[r];
	return t;
}
function hn(e, t) {
	let n = /* @__PURE__ */ new Set(), r = new Set(t);
	return e.reduce((e, i) => {
		if (t && !cn(i) && i.as === "script" && i.href && r.has(i.href)) return e;
		let a = JSON.stringify(mn(i));
		return n.has(a) || (n.add(a), e.push({
			key: a,
			link: i
		})), e;
	}, []);
}
function gn() {
	let e = _.useContext(Je);
	return an(e, "You must render this element inside a <DataRouterContext.Provider> element"), e;
}
function _n() {
	let e = _.useContext(Ye);
	return an(e, "You must render this element inside a <DataRouterStateContext.Provider> element"), e;
}
var vn = _.createContext(void 0);
vn.displayName = "FrameworkContext";
function yn() {
	let e = _.useContext(vn);
	return an(e, "You must render this element inside a <HydratedRouter> element"), e;
}
function bn(e, t) {
	let n = _.useContext(vn), [r, i] = _.useState(!1), [a, o] = _.useState(!1), { onFocus: s, onBlur: c, onMouseEnter: l, onMouseLeave: u, onTouchStart: d } = t, f = _.useRef(null);
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
			onFocus: xn(s, p),
			onBlur: xn(c, m),
			onMouseEnter: xn(l, p),
			onMouseLeave: xn(u, m),
			onTouchStart: xn(d, p)
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
function xn(e, t) {
	return (n) => {
		e && e(n), n.defaultPrevented || t(n);
	};
}
function Sn({ page: e, ...t }) {
	let n = Ze(), { nonce: r } = yn(), { router: i } = gn(), a = _.useMemo(() => ae(i.routes, e, i.basename), [
		i.routes,
		e,
		i.basename
	]);
	return a ? (t.nonce == null && r && (t = {
		...t,
		nonce: r
	}), n ? /* @__PURE__ */ _.createElement(wn, {
		page: e,
		matches: a,
		...t
	}) : /* @__PURE__ */ _.createElement(Tn, {
		page: e,
		matches: a,
		...t
	})) : null;
}
function Cn(e) {
	let { manifest: t, routeModules: n } = yn(), [r, i] = _.useState([]);
	return _.useEffect(() => {
		let r = !1;
		return un(e, t, n).then((e) => {
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
function wn({ page: e, matches: t, ...n }) {
	let r = ft(), { future: i } = yn(), { basename: a } = gn(), o = _.useMemo(() => {
		if (e === r.pathname + r.search + r.hash) return [];
		let n = on(e, a, i.v8_trailingSlashAwareDataRequests, "rsc"), o = !1, s = [];
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
function Tn({ page: e, matches: t, ...n }) {
	let r = ft(), { future: i, manifest: a, routeModules: o } = yn(), { basename: s } = gn(), { loaderData: c, matches: l } = _n(), u = _.useMemo(() => dn(e, t, l, a, r, "data"), [
		e,
		t,
		l,
		a,
		r
	]), d = _.useMemo(() => dn(e, t, l, a, r, "assets"), [
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
		let d = on(e, s, i.v8_trailingSlashAwareDataRequests, "data");
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
	]), p = _.useMemo(() => fn(d, a), [d, a]), m = Cn(d);
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
function En(...e) {
	return (t) => {
		e.forEach((e) => {
			typeof e == "function" ? e(t) : e != null && (e.current = t);
		});
	};
}
_.Component;
var Dn = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0;
try {
	Dn && (window.__reactRouterVersion = "7.18.4");
} catch {}
function On({ basename: e, children: t, useTransitions: n, window: r }) {
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
	return _.useLayoutEffect(() => a.listen(c), [a, c]), /* @__PURE__ */ _.createElement(Ut, {
		basename: e,
		children: t,
		location: o.location,
		navigationType: o.action,
		navigator: a,
		useTransitions: n
	});
}
var kn = _.forwardRef(function({ onClick: e, discover: t = "render", prefetch: n = "none", relative: r, reloadDocument: i, replace: a, mask: o, state: s, target: c, to: l, preventScrollReset: u, viewTransition: d, defaultShouldRevalidate: f, ...p }, m) {
	let { basename: h, navigator: g, useTransitions: y } = _.useContext(tt), b = typeof l == "string" && v.test(l), x = Re(l, h);
	l = x.to;
	let S = ut(l, { relative: r }), C = ft(), w = null;
	if (o) {
		let e = De(o, [], C.mask ? C.mask.pathname : "/", !0);
		h !== "/" && (e.pathname = e.pathname === "/" ? h : ke([h, e.pathname])), w = g.createHref(e);
	}
	let [T, E, D] = bn(n, p), ee = Pn(l, {
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
		ref: En(m, E),
		target: c,
		"data-discover": !b && t === "render" ? "true" : void 0
	});
	return T && !b ? /* @__PURE__ */ _.createElement(_.Fragment, null, re, /* @__PURE__ */ _.createElement(Sn, { page: S })) : re;
});
kn.displayName = "Link";
var An = _.forwardRef(function({ "aria-current": e = "page", caseSensitive: t = !1, className: n = "", end: r = !1, style: i, to: a, viewTransition: o, children: s, ...c }, l) {
	let u = yt(a, { relative: c.relative }), d = ft(), f = _.useContext(Ye), { navigator: p, basename: m } = _.useContext(tt), h = f != null && zn(u) && o === !0, g = p.encodeLocation ? p.encodeLocation(u).pathname : u.pathname, v = d.pathname, y = f && f.navigation && f.navigation.location ? f.navigation.location.pathname : null;
	t || (v = v.toLowerCase(), y = y ? y.toLowerCase() : null, g = g.toLowerCase()), y && m && (y = xe(y, m) || y);
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
	return /* @__PURE__ */ _.createElement(kn, {
		...c,
		"aria-current": w,
		className: T,
		ref: l,
		style: E,
		to: a,
		viewTransition: o
	}, typeof s == "function" ? s(C) : s);
});
An.displayName = "NavLink";
var jn = _.forwardRef(({ discover: e = "render", fetcherKey: t, navigate: n, reloadDocument: r, replace: i, state: a, method: o = Kt, action: s, onSubmit: c, relative: l, preventScrollReset: u, viewTransition: d, defaultShouldRevalidate: f, ...p }, m) => {
	let { useTransitions: h } = _.useContext(tt), g = Ln(), y = Rn(s, { relative: l }), b = o.toLowerCase() === "get" ? "get" : "post", x = typeof s == "string" && v.test(s);
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
jn.displayName = "Form";
function Mn(e) {
	return `${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function Nn(e) {
	let t = _.useContext(Je);
	return w(t, Mn(e)), t;
}
function Pn(e, { target: t, replace: n, mask: r, state: i, preventScrollReset: a, relative: o, viewTransition: s, defaultShouldRevalidate: c, useTransitions: l } = {}) {
	let u = ht(), d = ft(), f = yt(e, { relative: o });
	return _.useCallback((p) => {
		if (M(p, t)) {
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
var Fn = 0, In = () => `__${String(++Fn)}__`;
function Ln() {
	let { router: e } = Nn("useSubmit"), { basename: t } = _.useContext(tt), n = Pt(), r = e.fetch, i = e.navigate;
	return _.useCallback(async (e, a = {}) => {
		let { action: o, method: s, encType: c, formData: l, body: u } = rn(e, t);
		if (a.navigate === !1) {
			let e = a.fetcherKey || In();
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
function Rn(e, { relative: t } = {}) {
	let { basename: n } = _.useContext(tt), r = _.useContext(rt);
	w(r, "useFormAction must be used inside a RouteContext");
	let [i] = r.matches.slice(-1), a = { ...yt(e || ".", { relative: t }) }, o = ft();
	if (e == null) {
		a.search = o.search;
		let e = new URLSearchParams(a.search), t = e.getAll("index");
		if (t.some((e) => e === "")) {
			e.delete("index"), t.filter((e) => e).forEach((t) => e.append("index", t));
			let n = e.toString();
			a.search = n ? `?${n}` : "";
		}
	}
	return (!e || e === ".") && i.route.index && (a.search = a.search ? a.search.replace(/^\?/, "?index&") : "?index"), n !== "/" && (a.pathname = a.pathname === "/" ? n : ke([n, a.pathname])), te(a);
}
function zn(e, { relative: t } = {}) {
	let n = _.useContext(Qe);
	w(n != null, "`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?");
	let { basename: r } = Nn("useViewTransitionState"), i = yt(e, { relative: t });
	if (!n.isTransitioning) return !1;
	let a = xe(n.currentLocation.pathname, r) || n.currentLocation.pathname, o = xe(n.nextLocation.pathname, r) || n.nextLocation.pathname;
	return ye(i.pathname, o) != null || ye(i.pathname, a) != null;
}
//#endregion
//#region node_modules/@iconify/react/dist/iconify.js
var Bn = g();
function Vn(e, t) {
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
var Hn = Object.freeze({
	left: 0,
	top: 0,
	width: 16,
	height: 16
}), Un = Object.freeze({
	rotate: 0,
	vFlip: !1,
	hFlip: !1
}), Wn = Object.freeze({
	...Hn,
	...Un
}), Gn = Object.freeze({
	...Wn,
	body: "",
	hidden: !1
});
function Kn(e, t) {
	let n = {};
	!e.hFlip != !t.hFlip && (n.hFlip = !0), !e.vFlip != !t.vFlip && (n.vFlip = !0);
	let r = ((e.rotate || 0) + (t.rotate || 0)) % 4;
	return r && (n.rotate = r), n;
}
function qn(e, t) {
	let n = Kn(e, t);
	for (let r in Gn) r in Un ? r in e && !(r in n) && (n[r] = Un[r]) : r in t ? n[r] = t[r] : r in e && (n[r] = e[r]);
	return n;
}
function Jn(e, t, n) {
	let r = e.icons, i = e.aliases || Object.create(null), a = {};
	function o(e) {
		a = qn(r[e] || i[e], a);
	}
	return o(t), n.forEach(o), qn(e, a);
}
function Yn(e, t) {
	let n = [];
	if (typeof e != "object" || typeof e.icons != "object") return n;
	e.not_found instanceof Array && e.not_found.forEach((e) => {
		t(e, null), n.push(e);
	});
	let r = Vn(e);
	for (let i in r) {
		let a = r[i];
		a && (t(i, Jn(e, i, a)), n.push(i));
	}
	return n;
}
var Xn = {
	provider: "",
	aliases: {},
	not_found: {},
	...Hn
};
function Zn(e, t) {
	for (let n in t) if (n in e && typeof e[n] != typeof t[n]) return !1;
	return !0;
}
function Qn(e) {
	if (typeof e != "object" || !e) return null;
	let t = e;
	if (typeof t.prefix != "string" || !e.icons || typeof e.icons != "object" || !Zn(e, Xn)) return null;
	let n = t.icons;
	for (let e in n) {
		let t = n[e];
		if (!e || typeof t.body != "string" || !Zn(t, Gn)) return null;
	}
	let r = t.aliases || Object.create(null);
	for (let e in r) {
		let t = r[e], i = t.parent;
		if (!e || typeof i != "string" || !n[i] && !r[i] || !Zn(t, Gn)) return null;
	}
	return t;
}
var $n = Object.create(null);
function er(e, t) {
	return {
		provider: e,
		prefix: t,
		icons: Object.create(null),
		missing: /* @__PURE__ */ new Set()
	};
}
function tr(e, t) {
	let n = $n[e] || ($n[e] = Object.create(null));
	return n[t] || (n[t] = er(e, t));
}
function nr(e, t) {
	return Qn(t) ? Yn(t, (t, n) => {
		n ? e.icons[t] = n : e.missing.add(t);
	}) : [];
}
function rr(e, t, n) {
	try {
		if (typeof n.body == "string") return e.icons[t] = { ...n }, !0;
	} catch {}
	return !1;
}
var ir = /^[a-z0-9]+(-[a-z0-9]+)*$/, ar = (e, t, n, r = "") => {
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
		return t && !or(a) ? null : a;
	}
	let a = i[0], o = a.split("-");
	if (o.length > 1) {
		let e = {
			provider: r,
			prefix: o.shift(),
			name: o.join("-")
		};
		return t && !or(e) ? null : e;
	}
	if (n && r === "") {
		let e = {
			provider: r,
			prefix: "",
			name: a
		};
		return t && !or(e, n) ? null : e;
	}
	return null;
}, or = (e, t) => e ? !!((t && e.prefix === "" || e.prefix) && e.name) : !1, sr = !1;
function cr(e) {
	return typeof e == "boolean" && (sr = e), sr;
}
function lr(e) {
	let t = typeof e == "string" ? ar(e, !0, sr) : e;
	if (t) {
		let e = tr(t.provider, t.prefix), n = t.name;
		return e.icons[n] || (e.missing.has(n) ? null : void 0);
	}
}
function ur(e, t) {
	let n = ar(e, !0, sr);
	if (!n) return !1;
	let r = tr(n.provider, n.prefix);
	return t ? rr(r, n.name, t) : (r.missing.add(n.name), !0);
}
function dr(e, t) {
	if (typeof e != "object") return !1;
	if (typeof t != "string" && (t = e.provider || ""), sr && !t && !e.prefix) {
		let t = !1;
		return Qn(e) && (e.prefix = "", Yn(e, (e, n) => {
			ur(e, n) && (t = !0);
		})), t;
	}
	let n = e.prefix;
	return or({
		prefix: n,
		name: "a"
	}) ? !!nr(tr(t, n), e) : !1;
}
var fr = Object.freeze({
	width: null,
	height: null
}), pr = Object.freeze({
	...fr,
	...Un
}), mr = /(-?[0-9.]*[0-9]+[0-9.]*)/g, hr = /^-?[0-9.]*[0-9]+[0-9.]*$/g;
function gr(e, t, n) {
	if (t === 1) return e;
	if (n ||= 100, typeof e == "number") return Math.ceil(e * t * n) / n;
	if (typeof e != "string") return e;
	let r = e.split(mr);
	if (r === null || !r.length) return e;
	let i = [], a = r.shift(), o = hr.test(a);
	for (;;) {
		if (o) {
			let e = parseFloat(a);
			isNaN(e) ? i.push(a) : i.push(Math.ceil(e * t * n) / n);
		} else i.push(a);
		if (a = r.shift(), a === void 0) return i.join("");
		o = !o;
	}
}
function _r(e, t = "defs") {
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
function vr(e, t) {
	return e ? "<defs>" + e + "</defs>" + t : t;
}
function yr(e, t, n) {
	let r = _r(e);
	return vr(r.defs, t + r.content + n);
}
var br = (e) => e === "unset" || e === "undefined" || e === "none";
function xr(e, t) {
	let n = {
		...Wn,
		...e
	}, r = {
		...pr,
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
		o % 2 == 1 && (i.left !== i.top && (s = i.left, i.left = i.top, i.top = s), i.width !== i.height && (s = i.width, i.width = i.height, i.height = s)), t.length && (a = yr(a, "<g transform=\"" + t.join(" ") + "\">", "</g>"));
	});
	let o = r.width, s = r.height, c = i.width, l = i.height, u, d;
	o === null ? (d = s === null ? "1em" : s === "auto" ? l : s, u = gr(d, c / l)) : (u = o === "auto" ? c : o, d = s === null ? gr(u, l / c) : s === "auto" ? l : s);
	let f = {}, p = (e, t) => {
		br(t) || (f[e] = t.toString());
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
var Sr = /\sid="(\S+)"/g, Cr = "IconifyId" + Date.now().toString(16) + (Math.random() * 16777216 | 0).toString(16), wr = 0;
function Tr(e, t = Cr) {
	let n = [], r;
	for (; r = Sr.exec(e);) n.push(r[1]);
	if (!n.length) return e;
	let i = "suffix" + (Math.random() * 16777216 | Date.now()).toString(16);
	return n.forEach((n) => {
		let r = typeof t == "function" ? t(n) : t + (wr++).toString(), a = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		e = e.replace(RegExp("([#;\"])(" + a + ")([\")]|\\.[a-z])", "g"), "$1" + r + i + "$3");
	}), e = e.replace(new RegExp(i, "g"), ""), e;
}
var Er = Object.create(null);
function Dr(e, t) {
	Er[e] = t;
}
function Or(e) {
	return Er[e] || Er[""];
}
function kr(e) {
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
for (var Ar = Object.create(null), jr = ["https://api.simplesvg.com", "https://api.unisvg.com"], Mr = []; jr.length > 0;) jr.length === 1 || Math.random() > .5 ? Mr.push(jr.shift()) : Mr.push(jr.pop());
Ar[""] = kr({ resources: ["https://api.iconify.design"].concat(Mr) });
function Nr(e, t) {
	let n = kr(t);
	return n !== null && (Ar[e] = n, !0);
}
function Pr(e) {
	return Ar[e];
}
var Fr = (() => {
	let e;
	try {
		if (e = fetch, typeof e == "function") return e;
	} catch {}
})();
function Ir(e, t) {
	let n = Pr(e);
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
function Lr(e) {
	return e === 404;
}
var Rr = (e, t, n) => {
	let r = [], i = Ir(e, t), a = "icons", o = {
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
function zr(e) {
	if (typeof e == "string") {
		let t = Pr(e);
		if (t) return t.path;
	}
	return "/";
}
var Br = {
	prepare: Rr,
	send: (e, t, n) => {
		if (!Fr) {
			n("abort", 424);
			return;
		}
		let r = zr(t.provider);
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
		Fr(e + r).then((e) => {
			let t = e.status;
			if (t !== 200) {
				setTimeout(() => {
					n(Lr(t) ? "abort" : "next", t);
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
function Vr(e, t) {
	e.forEach((e) => {
		let n = e.loaderCallbacks;
		n && (e.loaderCallbacks = n.filter((e) => e.id !== t));
	});
}
function Hr(e) {
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
			}), a.pending.length !== o && (n || Vr([e], t.id), t.callback(a.loaded.slice(0), a.missing.slice(0), a.pending.slice(0), t.abort));
		});
	}));
}
var Ur = 0;
function Wr(e, t, n) {
	let r = Ur++, i = Vr.bind(null, n, r);
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
function Gr(e) {
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
		let i = e.provider, a = e.prefix, o = e.name, s = n[i] || (n[i] = Object.create(null)), c = s[a] || (s[a] = tr(i, a)), l;
		l = o in c.icons ? t.loaded : a === "" || c.missing.has(o) ? t.missing : t.pending;
		let u = {
			provider: i,
			prefix: a,
			name: o
		};
		l.push(u);
	}), t;
}
function Kr(e, t = !0, n = !1) {
	let r = [];
	return e.forEach((e) => {
		let i = typeof e == "string" ? ar(e, t, n) : e;
		i && r.push(i);
	}), r;
}
var qr = {
	resources: [],
	index: 0,
	timeout: 2e3,
	rotate: 750,
	random: !1,
	dataAfterTimeout: !1
};
function Jr(e, t, n, r) {
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
function Yr(e) {
	let t = {
		...qr,
		...e
	}, n = [];
	function r() {
		n = n.filter((e) => e().status === "pending");
	}
	function i(e, i, a) {
		let o = Jr(t, e, i, (e, t) => {
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
function Xr() {}
var Zr = Object.create(null);
function Qr(e) {
	if (!Zr[e]) {
		let t = Pr(e);
		if (!t) return;
		Zr[e] = {
			config: t,
			redundancy: Yr(t)
		};
	}
	return Zr[e];
}
function $r(e, t, n) {
	let r, i;
	if (typeof e == "string") {
		let t = Or(e);
		if (!t) return n(void 0, 424), Xr;
		i = t.send;
		let a = Qr(e);
		a && (r = a.redundancy);
	} else {
		let t = kr(e);
		if (t) {
			r = Yr(t);
			let n = Or(e.resources ? e.resources[0] : "");
			n && (i = n.send);
		}
	}
	return !r || !i ? (n(void 0, 424), Xr) : r.query(t, i, n)().abort;
}
function ei() {}
function ti(e) {
	e.iconsLoaderFlag || (e.iconsLoaderFlag = !0, setTimeout(() => {
		e.iconsLoaderFlag = !1, Hr(e);
	}));
}
function ni(e) {
	let t = [], n = [];
	return e.forEach((e) => {
		(e.match(ir) ? t : n).push(e);
	}), {
		valid: t,
		invalid: n
	};
}
function ri(e, t, n) {
	function r() {
		let n = e.pendingIcons;
		t.forEach((t) => {
			n && n.delete(t), e.icons[t] || e.missing.add(t);
		});
	}
	if (n && typeof n == "object") try {
		if (!nr(e, n).length) {
			r();
			return;
		}
	} catch (e) {
		console.error(e);
	}
	r(), ti(e);
}
function ii(e, t) {
	e instanceof Promise ? e.then((e) => {
		t(e);
	}).catch(() => {
		t(null);
	}) : t(e);
}
function ai(e, t) {
	e.iconsToLoad = e.iconsToLoad ? e.iconsToLoad.concat(t).sort() : t, e.iconsQueueFlag || (e.iconsQueueFlag = !0, setTimeout(() => {
		e.iconsQueueFlag = !1;
		let { provider: t, prefix: n } = e, r = e.iconsToLoad;
		if (delete e.iconsToLoad, !r || !r.length) return;
		let i = e.loadIcon;
		if (e.loadIcons && (r.length > 1 || !i)) {
			ii(e.loadIcons(r, n, t), (t) => {
				ri(e, r, t);
			});
			return;
		}
		if (i) {
			r.forEach((r) => {
				ii(i(r, n, t), (t) => {
					ri(e, [r], t ? {
						prefix: n,
						icons: { [r]: t }
					} : null);
				});
			});
			return;
		}
		let { valid: a, invalid: o } = ni(r);
		if (o.length && ri(e, o, null), !a.length) return;
		let s = n.match(ir) ? Or(t) : null;
		if (!s) {
			ri(e, a, null);
			return;
		}
		s.prepare(t, n, a).forEach((n) => {
			$r(t, n, (t) => {
				ri(e, n.icons, t);
			});
		});
	}));
}
var oi = (e, t) => {
	let n = Gr(Kr(e, !0, cr()));
	if (!n.pending.length) {
		let e = !0;
		return t && setTimeout(() => {
			e && t(n.loaded, n.missing, n.pending, ei);
		}), () => {
			e = !1;
		};
	}
	let r = Object.create(null), i = [], a, o;
	return n.pending.forEach((e) => {
		let { provider: t, prefix: n } = e;
		if (n === o && t === a) return;
		a = t, o = n, i.push(tr(t, n));
		let s = r[t] || (r[t] = Object.create(null));
		s[n] || (s[n] = []);
	}), n.pending.forEach((e) => {
		let { provider: t, prefix: n, name: i } = e, a = tr(t, n), o = a.pendingIcons ||= /* @__PURE__ */ new Set();
		o.has(i) || (o.add(i), r[t][n].push(i));
	}), i.forEach((e) => {
		let t = r[e.provider][e.prefix];
		t.length && ai(e, t);
	}), t ? Wr(t, n, i) : ei;
};
function si(e, t) {
	let n = { ...e };
	for (let e in t) {
		let r = t[e], i = typeof r;
		e in fr ? (r === null || r && (i === "string" || i === "number")) && (n[e] = r) : i === typeof n[e] && (n[e] = e === "rotate" ? r % 4 : r);
	}
	return n;
}
var ci = /[\s,]+/;
function li(e, t) {
	t.split(ci).forEach((t) => {
		switch (t.trim()) {
			case "horizontal":
				e.hFlip = !0;
				break;
			case "vertical": e.vFlip = !0;
		}
	});
}
function ui(e, t = 0) {
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
function di(e, t) {
	let n = e.indexOf("xlink:") === -1 ? "" : " xmlns:xlink=\"http://www.w3.org/1999/xlink\"";
	for (let e in t) n += " " + e + "=\"" + t[e] + "\"";
	return "<svg xmlns=\"http://www.w3.org/2000/svg\"" + n + ">" + e + "</svg>";
}
function fi(e) {
	return e.replace(/"/g, "'").replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/\s+/g, " ");
}
function pi(e) {
	return "data:image/svg+xml," + fi(e);
}
function mi(e) {
	return "url(\"" + pi(e) + "\")";
}
var hi;
function gi() {
	try {
		hi = window.trustedTypes.createPolicy("iconify", { createHTML: (e) => e });
	} catch {
		hi = null;
	}
}
function _i(e) {
	return hi === void 0 && gi(), hi ? hi.createHTML(e) : e;
}
var vi = {
	...pr,
	inline: !1
}, yi = {
	xmlns: "http://www.w3.org/2000/svg",
	xmlnsXlink: "http://www.w3.org/1999/xlink",
	"aria-hidden": !0,
	role: "img"
}, bi = { display: "inline-block" }, xi = { backgroundColor: "currentColor" }, Si = { backgroundColor: "transparent" }, Ci = {
	Image: "var(--svg)",
	Repeat: "no-repeat",
	Size: "100% 100%"
}, wi = {
	WebkitMask: xi,
	mask: xi,
	background: Si
};
for (let e in wi) {
	let t = wi[e];
	for (let n in Ci) t[e + n] = Ci[n];
}
var Ti = {
	...vi,
	inline: !0
};
function Ei(e) {
	return e + (e.match(/^[-0-9.]+$/) ? "px" : "");
}
var Di = (e, t, n) => {
	let r = t.inline ? Ti : vi, i = si(r, t), a = t.mode || "svg", o = {}, s = t.style || {}, c = { ...a === "svg" ? yi : {} };
	if (n) {
		let e = ar(n, !1, !0);
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
				typeof n == "string" && li(i, n);
				break;
			case "color":
				o.color = n;
				break;
			case "rotate":
				typeof n == "string" ? i[e] = ui(n) : typeof n == "number" && (i[e] = n);
				break;
			case "ariaHidden":
			case "aria-hidden":
				n !== !0 && n !== "true" && delete c["aria-hidden"];
				break;
			default: r[e] === void 0 && (c[e] = n);
		}
	}
	let l = xr(e, i), u = l.attributes;
	if (i.inline && (o.verticalAlign = "-0.125em"), a === "svg") {
		c.style = {
			...o,
			...s
		}, Object.assign(c, u);
		let e = 0, n = t.id;
		return typeof n == "string" && (n = n.replace(/-/g, "_")), c.dangerouslySetInnerHTML = { __html: _i(Tr(l.body, n ? () => n + "ID" + e++ : "iconifyReact")) }, (0, _.createElement)("svg", c);
	}
	let { body: d, width: f, height: p } = e, m = a === "mask" || a !== "bg" && d.indexOf("currentColor") !== -1, h = di(d, {
		...u,
		width: f + "",
		height: p + ""
	});
	return c.style = {
		...o,
		"--svg": mi(h),
		width: Ei(u.width),
		height: Ei(u.height),
		...bi,
		...m ? xi : Si,
		...s
	}, (0, _.createElement)("span", c);
};
if (cr(!0), Dr("", Br), typeof document < "u" && typeof window < "u") {
	let e = window;
	if (e.IconifyPreload !== void 0) {
		let t = e.IconifyPreload, n = "Invalid IconifyPreload syntax.";
		typeof t == "object" && t && (t instanceof Array ? t : [t]).forEach((e) => {
			try {
				(typeof e != "object" || !e || e instanceof Array || typeof e.icons != "object" || typeof e.prefix != "string" || !dr(e)) && console.error(n);
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
				Nr(e, r) || console.error(n);
			} catch {
				console.error(n);
			}
		}
	}
}
function Oi(e) {
	let [t, n] = (0, _.useState)(!!e.ssr), [r, i] = (0, _.useState)({});
	function a(t) {
		if (t) {
			let t = e.icon;
			if (typeof t == "object") return {
				name: "",
				data: t
			};
			let n = lr(t);
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
		let r = lr(n);
		if (l({
			name: n,
			data: r
		})) {
			if (r === void 0) {
				let e = oi([n], u);
				i({ callback: e });
			} else r && ((t = e.onLoad) == null || t.call(e, n));
		}
	}
	(0, _.useEffect)(() => (n(!0), c), []), (0, _.useEffect)(() => {
		t && u();
	}, [e.icon, t]);
	let { name: d, data: f } = o;
	return f ? Di({
		...Wn,
		...f
	}, e, d) : e.children ? e.children : e.fallback ? e.fallback : (0, _.createElement)("span", {});
}
var ki = (0, _.forwardRef)((e, t) => Oi({
	...e,
	_ref: t
}));
(0, _.forwardRef)((e, t) => Oi({
	inline: !0,
	...e,
	_ref: t
}));
//#endregion
//#region app/apex/marketing-copy.ts
var Ai = "13blok", ji = [
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
], Mi = {
	eyebrow: "Modular HRMS & campus ops",
	headline: "Switch on what you actually run.",
	lede: "Motorola sketched a phone you built from blocks. Google called it Project Ara and shelved it. 13blok is that idea, shipped as software: 50 modules on one spine, each with its own switch. Attendance today, payroll next quarter, biometrics when you are ready.",
	primaryCta: "Create your workspace",
	secondaryCta: "I already have one",
	meta: "No card to start · setup takes 4 steps"
}, Ni = "Off means gone from the sidebar and 404 from its own API. On means back on the next load.", Pi = [
	"[X] schools in [REGION]",
	"[N] staff clocking in daily",
	"\"[QUOTE]\" [NAME], [ROLE], [SCHOOL]"
], Fi = [
	{
		value: "50",
		label: "modules in the rack"
	},
	{
		value: "6",
		label: "access layers per request"
	},
	{
		value: "15",
		label: "services behind one gateway"
	},
	{
		value: "4",
		label: "themes, switchable per person"
	}
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
		lede: Ni,
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
}, Bi = "Adding a feature takes one click, not a project", N = {
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
		bg: N.mint,
		tone: "light"
	},
	{
		bg: N.gold,
		tone: "light"
	},
	{
		bg: N.coral,
		tone: "light"
	},
	{
		bg: N.blueSoft,
		tone: "light"
	},
	{
		bg: N.charcoal,
		tone: "dark"
	},
	{
		bg: N.midGray,
		tone: "dark"
	},
	{
		bg: N.darkFace,
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
	bg: N.darkFace,
	tone: "dark"
}, Gi = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.fragment");
	function r(e, n, r) {
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
	e.Fragment = n, e.jsx = r, e.jsxs = r;
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
}, P = /* @__NO_SIDE_EFFECTS__ */ (e) => e * 1e3, F = /* @__NO_SIDE_EFFECTS__ */ (e) => e / 1e3, I = /* @__NO_SIDE_EFFECTS__ */ (e, t) => t ? 1e3 / t * e : 0, la = (e, t, n) => (((1 - 3 * n + 3 * t) * e + (3 * n - 6 * t)) * e + 3 * t) * e, ua = 1e-7, da = 12;
function fa(e, t, n, r, i) {
	let a, o, s = 0;
	do
		o = t + (n - t) / 2, a = la(o, r, i) - e, a > 0 ? n = o : t = o;
	while (Math.abs(a) > ua && ++s < da);
	return o;
}
/*#__NO_SIDE_EFFECTS__*/
function pa(e, t, n, r) {
	if (e === t && n === r) return aa;
	let i = (t) => fa(t, 0, 1, e, n);
	return (e) => e === 0 || e === 1 ? e : la(i(e), t, r);
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
var { schedule: L, cancel: Fa, state: Ia, steps: La } = /* @__PURE__ */ Pa(typeof requestAnimationFrame < "u" ? requestAnimationFrame : aa, !0), Ra;
function za() {
	Ra = void 0;
}
var Ba = {
	now: () => (Ra === void 0 && Ba.set(Ia.isProcessing || ea.useManualTiming ? Ia.timestamp : performance.now()), Ra),
	set: (e) => {
		Ra = e, queueMicrotask(za);
	}
}, Va = (e) => Math.round(e * 1e5) / 1e5, Ha = (e) => (t) => typeof t == "string" && t.startsWith(e), Ua = /*@__PURE__*/ Ha("--"), Wa = /*@__PURE__*/ Ha("var(--"), Ga = (e) => Wa(e) ? Ka.test(e.split("/*")[0].trim()) : !1, Ka = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
function qa(e) {
	return typeof e == "string" && e.split("/*")[0].includes("var(--");
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/numbers/index.mjs
var Ja = {
	test: (e) => typeof e == "number",
	parse: parseFloat,
	transform: (e) => e
}, Ya = {
	...Ja,
	transform: (e) => $i(0, 1, e)
}, Xa = {
	...Ja,
	default: 1
}, Za = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/utils/is-nullish.mjs
function Qa(e) {
	return e == null;
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/utils/single-color-regex.mjs
var $a = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu, eo = (e, t) => (n) => !!(typeof n == "string" && $a.test(n) && n.startsWith(e) || t && !Qa(n) && Object.prototype.hasOwnProperty.call(n, t)), to = (e, t, n) => (r) => {
	if (typeof r != "string") return r;
	let [i, a, o, s] = r.match(Za);
	return {
		[e]: parseFloat(i),
		[t]: parseFloat(a),
		[n]: parseFloat(o),
		alpha: s === void 0 ? 1 : parseFloat(s)
	};
}, no = (e) => $i(0, 255, e), ro = {
	...Ja,
	transform: (e) => Math.round(no(e))
}, io = {
	test: /*@__PURE__*/ eo("rgb", "red"),
	parse: /*@__PURE__*/ to("red", "green", "blue"),
	transform: ({ red: e, green: t, blue: n, alpha: r = 1 }) => "rgba(" + ro.transform(e) + ", " + ro.transform(t) + ", " + ro.transform(n) + ", " + Va(Ya.transform(r)) + ")"
};
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/color/hex.mjs
function ao(e) {
	let t = "", n = "", r = "", i = "";
	return e.length > 5 ? (t = e.substring(1, 3), n = e.substring(3, 5), r = e.substring(5, 7), i = e.substring(7, 9)) : (t = e.substring(1, 2), n = e.substring(2, 3), r = e.substring(3, 4), i = e.substring(4, 5), t += t, n += n, r += r, i += i), {
		red: parseInt(t, 16),
		green: parseInt(n, 16),
		blue: parseInt(r, 16),
		alpha: i ? parseInt(i, 16) / 255 : 1
	};
}
var oo = {
	test: /*@__PURE__*/ eo("#"),
	parse: ao,
	transform: io.transform
}, so = /* @__NO_SIDE_EFFECTS__ */ (e) => ({
	test: (t) => typeof t == "string" && t.endsWith(e) && t.split(" ").length === 1,
	parse: parseFloat,
	transform: (t) => `${t}${e}`
}), co = /*@__PURE__*/ so("deg"), lo = /*@__PURE__*/ so("%"), R = /*@__PURE__*/ so("px"), uo = /*@__PURE__*/ so("vh"), fo = /*@__PURE__*/ so("vw"), po = {
	...lo,
	parse: (e) => lo.parse(e) / 100,
	transform: (e) => lo.transform(e * 100)
}, mo = {
	test: /*@__PURE__*/ eo("hsl", "hue"),
	parse: /*@__PURE__*/ to("hue", "saturation", "lightness"),
	transform: ({ hue: e, saturation: t, lightness: n, alpha: r = 1 }) => "hsla(" + Math.round(e) + ", " + lo.transform(Va(t)) + ", " + lo.transform(Va(n)) + ", " + Va(Ya.transform(r)) + ")"
}, ho = {
	test: (e) => io.test(e) || oo.test(e) || mo.test(e),
	parse: (e) => io.test(e) ? io.parse(e) : mo.test(e) ? mo.parse(e) : oo.parse(e),
	transform: (e) => typeof e == "string" ? e : e.hasOwnProperty("red") ? io.transform(e) : mo.transform(e),
	getAnimatableNone: (e) => {
		let t = ho.parse(e);
		return t.alpha = 0, ho.transform(t);
	}
}, go = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu, _o = /*@__PURE__*/ new RegExp(Za.source), vo = /*@__PURE__*/ new RegExp(go.source, "i");
function yo(e) {
	return isNaN(e) && typeof e == "string" && (_o.test(e) || vo.test(e));
}
var bo = "number", xo = "color", So = "var", Co = "var(", wo = "${}", To = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
function Eo(e) {
	let t = e.toString();
	return _o.test(t) || vo.test(t);
}
function Do(e) {
	let t = e.toString(), n = [], r = {
		color: [],
		number: [],
		var: []
	}, i = [], a = 0;
	return {
		values: n,
		split: t.replace(To, (e) => (ho.test(e) ? (r.color.push(a), i.push(xo), n.push(ho.parse(e))) : e.startsWith(Co) ? (r.var.push(a), i.push(So), n.push(e)) : (r.number.push(a), i.push(bo), n.push(parseFloat(e))), ++a, wo)).split(wo),
		indexes: r,
		types: i
	};
}
function Oo(e) {
	return Do(e).values;
}
function ko({ split: e, types: t }) {
	let n = e.length;
	return (r) => {
		let i = "";
		for (let a = 0; a < n; a++) if (i += e[a], r[a] !== void 0) {
			let e = t[a];
			i += e === bo ? Va(r[a]) : e === xo ? ho.transform(r[a]) : r[a];
		}
		return i;
	};
}
function Ao(e) {
	return ko(Do(e));
}
var jo = (e) => typeof e == "number" ? 0 : ho.test(e) ? ho.getAnimatableNone(e) : e, Mo = (e, t) => typeof e == "number" ? t?.trim().endsWith("/") ? e : 0 : jo(e);
function No(e) {
	let t = Do(e);
	return ko(t)(t.values.map((e, n) => Mo(e, t.split[n])));
}
var Po = {
	test: yo,
	parse: Oo,
	createTransformer: Ao,
	getAnimatableNone: No
};
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/color/hsla-to-rgba.mjs
function Fo(e, t, n) {
	return n < 0 && (n += 1), n > 1 && --n, n < 1 / 6 ? e + (t - e) * 6 * n : n < 1 / 2 ? t : n < 2 / 3 ? e + (t - e) * (2 / 3 - n) * 6 : e;
}
function Io({ hue: e, saturation: t, lightness: n, alpha: r }) {
	e /= 360, t /= 100, n /= 100;
	let i = 0, a = 0, o = 0;
	if (!t) i = a = o = n;
	else {
		let r = n < .5 ? n * (1 + t) : n + t - n * t, s = 2 * n - r;
		i = Fo(s, r, e + 1 / 3), a = Fo(s, r, e), o = Fo(s, r, e - 1 / 3);
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
function Lo(e, t) {
	return (n) => n > 0 ? t : e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/mix/number.mjs
var z = (e, t, n) => e + (t - e) * n, Ro = (e, t, n) => {
	let r = e * e, i = n * (t * t - r) + r;
	return i < 0 ? 0 : Math.sqrt(i);
}, zo = [
	oo,
	io,
	mo
], Bo = (e) => zo.find((t) => t.test(e));
function Vo(e) {
	let t = Bo(e);
	if (!t) return `${e}`, !1;
	let n = t.parse(e);
	return t === mo && (n = Io(n)), n;
}
var Ho = (e, t) => {
	let n = Vo(e), r = Vo(t);
	if (!n || !r) return Lo(e, t);
	let i = { ...n };
	return (e) => (i.red = Ro(n.red, r.red, e), i.green = Ro(n.green, r.green, e), i.blue = Ro(n.blue, r.blue, e), i.alpha = z(n.alpha, r.alpha, e), io.transform(i));
}, Uo = /* @__PURE__ */ new Set(["none", "hidden"]);
function B(e, t) {
	return Uo.has(e) ? (n) => n <= 0 ? e : t : (n) => n >= 1 ? t : e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/mix/complex.mjs
function Wo(e, t) {
	return (n) => z(e, t, n);
}
function Go(e) {
	return typeof e == "number" ? Wo : typeof e == "string" ? Ga(e) ? Lo : ho.test(e) ? Ho : Yo : Array.isArray(e) ? Ko : typeof e == "object" ? ho.test(e) ? Ho : qo : Lo;
}
function Ko(e, t) {
	let n = [...e], r = n.length, i = e.map((e, n) => Go(e)(e, t[n]));
	return (e) => {
		for (let t = 0; t < r; t++) n[t] = i[t](e);
		return n;
	};
}
function qo(e, t) {
	let n = {
		...e,
		...t
	}, r = {};
	for (let i in n) e[i] !== void 0 && t[i] !== void 0 && (r[i] = Go(e[i])(e[i], t[i]));
	return (e) => {
		for (let t in r) n[t] = r[t](e);
		return n;
	};
}
function Jo(e, t) {
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
var Yo = (e, t) => {
	let n = Po.createTransformer(t), r = Do(e), i = Do(t);
	return r.indexes.var.length === i.indexes.var.length && r.indexes.color.length === i.indexes.color.length && r.indexes.number.length >= i.indexes.number.length ? Uo.has(e) && !i.values.length || Uo.has(t) && !r.values.length ? B(e, t) : oa(Ko(Jo(r, i), i.values), n) : (`${e}${t}`, Lo(e, t));
}, Xo = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/iu;
function Zo(e, t) {
	let n = Xo.exec(e);
	if (!n) return;
	let r = Xo.exec(t);
	if (!r || n[2] !== r[2]) return;
	let i = n[2], a = parseFloat(n[1]), o = parseFloat(r[1]);
	return (e) => Va(z(a, o, e)) + i;
}
function Qo(e, t, n) {
	if (typeof e == "number" && typeof t == "number" && typeof n == "number") return z(e, t, n);
	if (typeof e == "string" && typeof t == "string") {
		let n = Zo(e, t);
		if (n) return n;
	}
	return Go(e)(e, t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/drivers/frame.mjs
var $o = (e) => {
	let t = ({ timestamp: t }) => e(t);
	return {
		start: (e = !0) => L.update(t, e),
		stop: () => Fa(t),
		now: () => Ia.isProcessing ? Ia.timestamp : Ba.now()
	};
}, es = (e, t, n = 10) => {
	let r = "", i = Math.max(Math.round(t / n), 2);
	for (let t = 0; t < i; t++) r += Math.round(e(t / (i - 1)) * 1e4) / 1e4 + ", ";
	return `linear(${r.substring(0, r.length - 2)})`;
}, ts = 2e4;
function ns(e, t = 50, n = ts, r) {
	let i = 0, a = e.next(i);
	for (r?.push(a.value); !a.done && i < n;) i += t, a = e.next(i), r?.push(a.value);
	return i >= n ? Infinity : i;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/utils/create-generator-easing.mjs
function rs(e, t = 100, n) {
	let r = n({
		...e,
		keyframes: [0, t]
	}), i = Math.min(ns(r), ts);
	return {
		type: "keyframes",
		ease: (e) => r.next(i * e).value / t,
		duration: /* @__PURE__ */ F(i)
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/spring.mjs
var is = {
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
function as(e, t) {
	return e * Math.sqrt(1 - t * t);
}
var os = 12;
function ss(e, t, n) {
	let r = n;
	for (let n = 1; n < os; n++) r -= e(r) / t(r);
	return r;
}
var cs = .001;
function ls({ duration: e = is.duration, bounce: t = is.bounce, velocity: n = is.velocity, mass: r = is.mass }) {
	let i, a;
	is.maxDuration;
	let o = 1 - t;
	o = $i(is.minDamping, is.maxDamping, o), e = $i(is.minDuration, is.maxDuration, /* @__PURE__ */ F(e)), o < 1 ? (i = (t) => {
		let r = t * o, i = r * e, a = r - n, s = as(t, o), c = Math.exp(-i);
		return cs - a / s * c;
	}, a = (t) => {
		let r = t * o * e, a = r * n + n, s = o * o * t * t * e, c = Math.exp(-r), l = as(t * t, o);
		return (-i(t) + cs > 0 ? -1 : 1) * ((a - s) * c) / l;
	}) : (i = (t) => -.001 + Math.exp(-t * e) * ((t - n) * e + 1), a = (t) => Math.exp(-t * e) * ((n - t) * (e * e)));
	let s = 5 / e, c = ss(i, a, s);
	if (e = /* @__PURE__ */ P(e), isNaN(c)) return {
		stiffness: is.stiffness,
		damping: is.damping,
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
var us = ["duration", "bounce"], ds = [
	"stiffness",
	"damping",
	"mass"
];
function fs(e, t) {
	return t.some((t) => e[t] !== void 0);
}
function ps(e) {
	let t = {
		velocity: is.velocity,
		stiffness: is.stiffness,
		damping: is.damping,
		mass: is.mass,
		isResolvedFromDuration: !1,
		...e
	};
	if (!fs(e, ds) && fs(e, us)) {
		if (t.velocity = 0, e.visualDuration) {
			let n = e.visualDuration, r = 2 * Math.PI / (n * 1.2), i = r * r, a = 2 * $i(.05, 1, 1 - (e.bounce || 0)) * Math.sqrt(i);
			t = {
				...t,
				mass: is.mass,
				stiffness: i,
				damping: a
			};
		} else {
			let n = ls({
				...e,
				velocity: 0
			});
			t = {
				...t,
				...n,
				mass: is.mass
			}, t.isResolvedFromDuration = !0;
		}
	}
	return t;
}
function ms(e = is.visualDuration, t = is.bounce) {
	let n = typeof e == "object" ? e : {
		visualDuration: e,
		keyframes: [0, 1],
		bounce: t
	}, r = n.keyframes[0], i = n.keyframes[n.keyframes.length - 1], a = {
		done: !1,
		value: r
	}, { stiffness: o, damping: s, mass: c, duration: l, velocity: u, isResolvedFromDuration: d } = ps({
		...n,
		velocity: -/* @__PURE__ */ F(n.velocity || 0)
	}), f = s / (2 * Math.sqrt(o * c)), p = /* @__PURE__ */ F(Math.sqrt(o / c)), m = f * p, h = {
		target: i,
		delta: i - r,
		velocity: u || 0,
		restSpeed: 0,
		restDelta: 0
	}, g = () => {
		let e = Math.abs(h.delta) < 5;
		h.restSpeed = n.restSpeed || (e ? is.restSpeed.granular : is.restSpeed.default), h.restDelta = n.restDelta || (e ? is.restDelta.granular : is.restDelta.default);
	};
	g();
	let _, v, y;
	if (f < 1) {
		let e = as(p, f), t = {
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
	let b = !fs(n, ds) && fs(n, us), x = d && l || null, S = {
		calculatedDuration: x,
		retarget: (e, t) => {
			h.target = e[e.length - 1], h.delta = h.target - e[0], h.velocity = b ? 0 : -/* @__PURE__ */ F(t), n.restSpeed && n.restDelta || g(), S.calculatedDuration = x, a.done = !1, y();
		},
		velocity: (e) => /* @__PURE__ */ P(v(e)),
		next: (e) => {
			let t = _(e);
			if (d) a.done = e >= l;
			else {
				let n = /* @__PURE__ */ P(v(e));
				a.done = Math.abs(n) <= h.restSpeed && Math.abs(h.target - t) <= h.restDelta;
			}
			return a.value = a.done ? h.target : t, a;
		},
		toString: () => {
			let e = Math.min(ns(S), ts), t = es((t) => S.next(e * t).value, e, 30);
			return e + "ms " + t;
		},
		toTransition: () => {}
	};
	return S;
}
ms.applyToOptions = (e) => {
	let t = rs(e, 100, ms);
	return e.ease = t.ease, e.duration = /* @__PURE__ */ P(t.duration), e.type = "keyframes", e;
};
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/inertia.mjs
function hs({ keyframes: e, velocity: t = 0, power: n = .8, timeConstant: r = 325, bounceDamping: i = 10, bounceStiffness: a = 500, modifyTarget: o, min: s, max: c, restDelta: l = .5, restSpeed: u }) {
	let d = e[0], f = {
		done: !1,
		value: d
	}, p = (e) => e < s || e > c, m = (e) => s === void 0 ? c : c === void 0 || Math.abs(s - e) < Math.abs(c - e) ? s : c, h = n * t, g = d + h, _ = o === void 0 ? g : o(g);
	_ !== g && (h = _ - d);
	let v = (e) => -h * Math.exp(-e / r), y = (e) => {
		let t = v(e);
		f.done = Math.abs(t) <= l, f.value = f.done ? _ : _ + t;
	}, b, x, S = (e) => {
		p(f.value) && (b = e, x = ms({
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
function gs(e, t, n) {
	let r = [], i = n || ea.mix || Qo, a = e.length - 1;
	for (let n = 0; n < a; n++) {
		let a = i(e[n], e[n + 1]);
		t && (a = oa(Array.isArray(t) ? t[n] || aa : t, a)), r.push(a);
	}
	return r;
}
function _s(e, t, { clamp: n = !0, ease: r, mixer: i } = {}) {
	let a = e.length;
	if (t.length, a === 1) return () => t[0];
	if (a === 2 && t[0] === t[1]) return () => t[1];
	let o = e[0] === e[1];
	e[0] > e[a - 1] && (e = [...e].reverse(), t = [...t].reverse());
	let s = gs(t, r, i), c = s.length, l = (n) => {
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
function vs(e, t) {
	let n = e[e.length - 1];
	for (let r = 1; r <= t; r++) {
		let i = /* @__PURE__ */ sa(0, t, r);
		e.push(z(n, 1, i));
	}
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/offsets/default.mjs
function ys(e) {
	let t = [0];
	return vs(t, e.length - 1), t;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/offsets/time.mjs
function bs(e, t) {
	return e.map((e) => e * t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/keyframes.mjs
function xs(e, t) {
	return e.map(() => t || Ta).splice(0, e.length - 1);
}
function Ss({ duration: e = 300, keyframes: t, times: n, ease: r = "easeInOut" }) {
	let i = /* @__PURE__ */ Ea(r) ? r.map(Aa) : Aa(r), a = {
		done: !1,
		value: t[0]
	};
	if (t.length === 2 && !Array.isArray(i) && (!n || n.length !== 2 || n[0] === 0 && n[1] === 1)) {
		let [n, r] = t, o = n === r ? void 0 : (ea.mix || Qo)(n, r);
		return {
			calculatedDuration: e,
			next: (t) => (a.value = o ? o(i(e > 0 ? $i(0, 1, t / e) : 1)) : r, a.done = t >= e, a)
		};
	}
	let o = _s(bs(n && n.length === t.length ? n : ys(t), e), t, { ease: Array.isArray(i) ? i : xs(t, i) });
	return {
		calculatedDuration: e,
		next: (t) => (a.value = o(t), a.done = t >= e, a)
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/generators/utils/velocity.mjs
var Cs = 5;
function ws(e, t, n) {
	let r = Math.max(t - Cs, 0);
	return /* @__PURE__ */ I(n - e(r), t - r);
}
function Ts(e, t, n = 0) {
	return t <= 0 ? n : e.velocity ? e.velocity(t) : ws((t) => e.next(t).value, t, e.next(t).value);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/get-final.mjs
var Es = (e) => e !== null;
function Ds(e, { repeat: t, repeatType: n = "loop" }, r, i = 1) {
	let a = e.filter(Es), o = i < 0 || t && n !== "loop" && t % 2 == 1 ? 0 : a.length - 1;
	return !o || r === void 0 ? a[o] : r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/replace-transition-type.mjs
var Os = {
	decay: hs,
	inertia: hs,
	tween: Ss,
	keyframes: Ss,
	spring: ms
};
function ks(e) {
	typeof e.type == "string" && (e.type = Os[e.type]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/notify-inspector.mjs
function As(e, t) {
	return {
		kind: e,
		animation: t,
		timestamp: Ba.now(),
		frameTimestamp: Ia.timestamp,
		frameIsProcessing: Ia.isProcessing
	};
}
function js(e, t, n) {
	let r = globalThis.__MOTION_INSPECT__;
	if (r) try {
		r({
			...As("animation-start", e),
			options: n ? {
				...t,
				...n
			} : t
		});
	} catch {}
}
function Ms(e, t) {
	let n = globalThis.__MOTION_INSPECT__;
	if (n) try {
		n({
			...As("layout-animation-start", e),
			node: t
		});
	} catch {}
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/WithPromise.mjs
var Ns = class {
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
}, Ps = (e) => e / 100, Fs = class extends Ns {
	constructor(e) {
		super(), this.state = "idle", this.startTime = null, this.isStopped = !1, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.delayState = {
			done: !1,
			value: void 0
		}, this.stop = () => {
			let { motionValue: e } = this.options;
			e && e.updatedAt !== Ba.now() && this.tick(Ba.now()), this.isStopped = !0, this.state !== "idle" && (this.teardown(), this.options.onStop?.());
		}, this.options = e, this.initAnimation(), this.play(), e.autoplay === !1 && this.pause(), js(this, this.options);
	}
	initAnimation() {
		let { options: e } = this;
		ks(e);
		let { type: t = Ss, repeat: n = 0, repeatDelay: r = 0, repeatType: i, velocity: a = 0 } = e, { keyframes: o } = e, s = t || Ss;
		s !== Ss && typeof o[0] != "number" && (this.mixKeyframes = oa(Ps, Qo(o[0], o[1])), o = [0, 100]);
		let c = s(o === e.keyframes ? e : {
			...e,
			keyframes: o
		});
		i === "mirror" && (this.mirroredGenerator = s({
			...e,
			keyframes: [...o].reverse(),
			velocity: -a
		})), c.calculatedDuration === null && (c.calculatedDuration = ns(c));
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
		return S && p !== hs && (b.value = Ds(l, this.options, h, this.speed)), m && m(b.value), S && this.finish(), b;
	}
	then(e, t) {
		return this.finished.then(e, t);
	}
	get duration() {
		return /* @__PURE__ */ F(this.calculatedDuration);
	}
	get iterationDuration() {
		let { delay: e = 0 } = this.options || {};
		return this.duration + /* @__PURE__ */ F(e);
	}
	get time() {
		return /* @__PURE__ */ F(this.currentTime);
	}
	set time(e) {
		e = /* @__PURE__ */ P(e), this.currentTime = e, this.startTime === null || this.holdTime !== null || this.playbackSpeed === 0 ? this.holdTime = e : this.driver && (this.startTime = this.driver.now() - e / this.playbackSpeed), this.driver ? this.driver.start(!1) : (this.startTime = 0, this.state = "paused", this.holdTime = e, this.tick(e));
	}
	getGeneratorVelocity() {
		return Ts(this.generator, this.currentTime, this.options.velocity);
	}
	get speed() {
		return this.playbackSpeed;
	}
	set speed(e) {
		let t = this.playbackSpeed !== e;
		t && this.driver && this.updateTime(Ba.now()), this.playbackSpeed = e, t && this.driver && (this.time = /* @__PURE__ */ F(this.currentTime));
	}
	play() {
		if (this.isStopped) return;
		let { driver: e = $o, startTime: t } = this.options;
		this.driver ||= e((e) => this.tick(e)), this.options.onPlay?.();
		let n = this.driver.now();
		this.state === "finished" ? (this.updateFinished(), this.startTime = n) : this.holdTime === null ? this.startTime ||= t ?? n : this.startTime = n - this.holdTime, this.state === "finished" && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
	}
	pause() {
		this.state = "paused", this.updateTime(Ba.now()), this.holdTime = this.currentTime;
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
}, Is = /* @__PURE__ */ new Set([
	"brightness",
	"contrast",
	"saturate",
	"opacity"
]);
function Ls(e) {
	let [t, n] = e.slice(0, -1).split("(");
	if (t === "drop-shadow") return e;
	let [r] = n.match(Za) || [];
	if (!r) return e;
	let i = n.replace(r, ""), a = +!!Is.has(t);
	return r !== n && (a *= 100), t + "(" + a + i + ")";
}
var Rs = /\b([a-z-]*)\(.*?\)/gu, zs = {
	...Po,
	getAnimatableNone: (e) => {
		let t = e.match(Rs);
		return t ? t.map(Ls).join(" ") : e;
	}
}, Bs = {
	...Po,
	getAnimatableNone: (e) => {
		let t = Po.parse(e);
		return Po.createTransformer(e)(t.map((e) => typeof e == "number" ? 0 : typeof e == "object" ? {
			...e,
			alpha: 1
		} : e));
	}
}, Vs = {
	...Ja,
	transform: Math.round
}, Hs = {
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
	rotate: co,
	pathRotation: co,
	rotateX: co,
	rotateY: co,
	rotateZ: co,
	scale: Xa,
	scaleX: Xa,
	scaleY: Xa,
	scaleZ: Xa,
	skew: co,
	skewX: co,
	skewY: co,
	distance: R,
	translateX: R,
	translateY: R,
	translateZ: R,
	x: R,
	y: R,
	z: R,
	perspective: R,
	transformPerspective: R,
	opacity: Ya,
	originX: po,
	originY: po,
	originZ: R,
	zIndex: Vs,
	fillOpacity: Ya,
	strokeOpacity: Ya,
	numOctaves: Vs
}, Us = {
	...Hs,
	color: ho,
	backgroundColor: ho,
	outlineColor: ho,
	fill: ho,
	stroke: ho,
	borderColor: ho,
	borderTopColor: ho,
	borderRightColor: ho,
	borderBottomColor: ho,
	borderLeftColor: ho,
	filter: zs,
	WebkitFilter: zs,
	mask: Bs,
	WebkitMask: Bs
}, Ws = (e) => Us[e], Gs = /*@__PURE__*/ new Set([zs, Bs]);
function Ks(e, t) {
	let n = Ws(e);
	return Gs.has(n) || (n = Po), n.getAnimatableNone ? n.getAnimatableNone(t) : void 0;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/utils/fill-wildcards.mjs
function qs(e) {
	for (let t = 1; t < e.length; t++) e[t] ?? (e[t] = e[t - 1]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/dom/parse-transform.mjs
var Js = (e) => e * 180 / Math.PI, Ys = (e) => Zs(Js(Math.atan2(e[1], e[0]))), Xs = {
	x: 4,
	y: 5,
	translateX: 4,
	translateY: 5,
	scaleX: 0,
	scaleY: 3,
	scale: (e) => (Math.abs(e[0]) + Math.abs(e[3])) / 2,
	rotate: Ys,
	rotateZ: Ys,
	skewX: (e) => Js(Math.atan(e[1])),
	skewY: (e) => Js(Math.atan(e[2])),
	skew: (e) => (Math.abs(e[1]) + Math.abs(e[2])) / 2
}, Zs = (e) => (e %= 360, e < 0 && (e += 360), e), Qs = Ys, $s = (e) => Math.sqrt(e[0] * e[0] + e[1] * e[1]), ec = (e) => Math.sqrt(e[4] * e[4] + e[5] * e[5]), tc = {
	x: 12,
	y: 13,
	z: 14,
	translateX: 12,
	translateY: 13,
	translateZ: 14,
	scaleX: $s,
	scaleY: ec,
	scale: (e) => ($s(e) + ec(e)) / 2,
	rotateX: (e) => Zs(Js(Math.atan2(e[6], e[5]))),
	rotateY: (e) => Zs(Js(Math.atan2(-e[2], e[0]))),
	rotateZ: Qs,
	rotate: Qs,
	skewX: (e) => Js(Math.atan(e[4])),
	skewY: (e) => Js(Math.atan(e[1])),
	skew: (e) => (Math.abs(e[1]) + Math.abs(e[4])) / 2
};
function nc(e) {
	return +!!e.includes("scale");
}
function rc(e, t) {
	if (!e || e === "none") return nc(t);
	let n = e.match(/^matrix3d\(([-\d.e\s,]+)\)$/u), r, i;
	if (n) r = tc, i = n;
	else {
		let t = e.match(/^matrix\(([-\d.e\s,]+)\)$/u);
		r = Xs, i = t;
	}
	if (!i) return nc(t);
	let a = r[t], o = i[1].split(",").map(ac);
	return typeof a == "function" ? a(o) : o[a];
}
var ic = (e, t) => {
	let { transform: n = "none" } = getComputedStyle(e);
	return rc(n, t);
};
function ac(e) {
	return parseFloat(e.trim());
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/keys-transform.mjs
var oc = [
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
], sc = /* @__PURE__ */ new Set([...oc, "pathRotation"]), cc = (e) => e === Ja || e === R, lc = /* @__PURE__ */ new Set([
	"x",
	"y",
	"z"
]), uc = oc.filter((e) => !lc.has(e));
function dc(e) {
	let t = [];
	return uc.forEach((n) => {
		let r = e.getValue(n);
		if (r !== void 0) {
			let e = r.get(), i = +!!n.startsWith("scale");
			if (e === i) return;
			t.push([n, e]), r.set(i);
		}
	}), t;
}
var fc = /* @__PURE__ */ new Set(["bottom", "right"]);
function pc(e, t, n, r, i, a) {
	let o = parseFloat(e);
	if (!isNaN(o)) return o;
	let { min: s, max: c } = t()[n], l = c - s;
	return a === "border-box" ? l : l - parseFloat(r) - parseFloat(i);
}
var mc = {
	width: ({ width: e, paddingLeft: t = "0", paddingRight: n = "0", boxSizing: r }, i) => pc(e, i, "x", t, n, r),
	height: ({ height: e, paddingTop: t = "0", paddingBottom: n = "0", boxSizing: r }, i) => pc(e, i, "y", t, n, r),
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
	x: ({ transform: e }) => rc(e, "x"),
	y: ({ transform: e }) => rc(e, "y")
};
mc.translateX = mc.x, mc.translateY = mc.y;
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/KeyframesResolver.mjs
var hc = /* @__PURE__ */ new Set(), gc = !1, _c = !1, vc = !1;
function yc() {
	if (_c) {
		let e = [], t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
		hc.forEach((r) => {
			r.needsMeasurement && (e.push(r), t.add(r.element), fc.has(r.name) && n.add(r.element));
		});
		let r = /* @__PURE__ */ new Map();
		n.forEach((e) => {
			let t = dc(e);
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
	_c = !1, gc = !1, hc.forEach((e) => e.complete(vc)), hc.clear();
}
function bc() {
	hc.forEach((e) => {
		e.readKeyframes(), e.needsMeasurement && (_c = !0);
	});
}
function xc() {
	vc = !0, bc(), yc(), vc = !1;
}
function Sc(e, t, n) {
	if (typeof e == "string") {
		if (ta(e) || ra(e)) return parseFloat(e);
		if (!Po.test(e) && Po.test(n)) return Ks(t, n);
	}
	return e ?? void 0;
}
var Cc = class {
	constructor(e, t, n, r, i, a = !1) {
		this.state = "pending", this.isAsync = !1, this.needsMeasurement = !1, this.unresolvedKeyframes = [...e], this.onComplete = t, this.name = n, this.motionValue = r, this.element = i, this.isAsync = a;
	}
	scheduleResolve() {
		this.state = "scheduled", this.isAsync ? (hc.add(this), gc || (gc = !0, L.read(bc), L.resolveKeyframes(yc))) : (this.readKeyframes(), this.complete());
	}
	readKeyframes() {
		let { unresolvedKeyframes: e, name: t, element: n, motionValue: r } = this;
		if (e[0] === null) {
			let i = r?.get(), a = e[e.length - 1];
			if (i !== void 0) e[0] = i;
			else if (n && t) {
				let r = Sc(n.readValue(t, a), t, a);
				r !== void 0 && (e[0] = r);
			}
			e[0] === void 0 && (e[0] = a), r && i === void 0 && r.set(e[0]);
		}
		qs(e);
	}
	setFinalKeyframe() {}
	measureInitialState() {}
	renderEndStyles() {}
	measureEndState() {}
	complete(e = !1) {
		this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, e), hc.delete(this);
	}
	cancel() {
		this.state === "scheduled" && (hc.delete(this), this.state = "pending");
	}
	resume() {
		this.state === "pending" && this.scheduleResolve();
	}
}, wc = (e) => e.startsWith("--");
//#endregion
//#region node_modules/motion-dom/dist/es/render/dom/style-set.mjs
function Tc(e, t, n) {
	wc(t) ? e.style.setProperty(t, n) : e.style[t] = n;
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/supports/flags.mjs
var Ec = {};
//#endregion
//#region node_modules/motion-dom/dist/es/utils/supports/memo.mjs
function Dc(e, t) {
	let n = /* @__PURE__ */ ia(e);
	return () => Ec[t] ?? n();
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/supports/scroll-timeline.mjs
var Oc = /* @__PURE__ */ Dc(() => window.ScrollTimeline !== void 0, "scrollTimeline"), kc = /*@__PURE__*/ Dc(() => {
	try {
		document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
	} catch {
		return !1;
	}
	return !0;
}, "linearEasing"), Ac = ([e, t, n, r]) => `cubic-bezier(${e}, ${t}, ${n}, ${r})`, jc = {
	linear: "linear",
	ease: "ease",
	easeIn: "ease-in",
	easeOut: "ease-out",
	easeInOut: "ease-in-out",
	circIn: /*@__PURE__*/ Ac([
		0,
		.65,
		.55,
		1
	]),
	circOut: /*@__PURE__*/ Ac([
		.55,
		0,
		1,
		.45
	]),
	backIn: /*@__PURE__*/ Ac([
		.31,
		.01,
		.66,
		-.59
	]),
	backOut: /*@__PURE__*/ Ac([
		.33,
		1.53,
		.69,
		.99
	])
};
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/easing/map-easing.mjs
function Mc(e, t) {
	if (e) return typeof e == "function" ? kc() ? es(e, t) : "ease-out" : /* @__PURE__ */ Da(e) ? Ac(e) : Array.isArray(e) ? e.map((e) => Mc(e, t) || jc.easeOut) : jc[e];
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/start-waapi-animation.mjs
function Nc(e, t, n, { delay: r = 0, duration: i = 300, repeat: a = 0, repeatType: o = "loop", ease: s = "easeOut", times: c } = {}, l = void 0) {
	let u = { [t]: n };
	c && (u.offset = c);
	let d = Mc(s, i);
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
function Pc(e) {
	return typeof e == "function" && "applyToOptions" in e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/utils/apply-generator.mjs
function Fc({ type: e, ...t }) {
	return Pc(e) && kc() ? e.applyToOptions(t) : (t.duration ??= 300, t.ease ??= "easeOut", t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/NativeAnimation.mjs
var Ic = class extends Ns {
	constructor(e) {
		if (super(), this.finishedTime = null, this.isStopped = !1, this.manualStartTime = null, !e) return;
		let { element: t, name: n, keyframes: r, pseudoElement: i, allowFlatten: a = !1, finalKeyframe: o, onComplete: s } = e;
		this.isPseudoElement = !!i, this.allowFlatten = a, this.options = e, e.type;
		let c = Fc(e);
		this.animation = Nc(t, n, r, c, i), c.autoplay === !1 && this.animation.pause(), this.animation.onfinish = () => {
			if (this.finishedTime = this.time, !i) {
				let e = Ds(r, this.options, o, this.speed);
				this.updateMotionValue && this.updateMotionValue(e), Tc(t, n, e), this.animation.cancel();
			}
			s?.(), this.notifyFinished();
		}, js(this, e, c);
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
		return /* @__PURE__ */ F(Number(e));
	}
	get iterationDuration() {
		let { delay: e = 0 } = this.options || {};
		return this.duration + /* @__PURE__ */ F(e);
	}
	get time() {
		return /* @__PURE__ */ F(Number(this.animation.currentTime) || 0);
	}
	set time(e) {
		let t = this.finishedTime !== null;
		this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = /* @__PURE__ */ P(e), t && this.animation.pause();
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
		return this.allowFlatten && this.animation.effect?.updateTiming({ easing: "linear" }), this.animation.onfinish = null, e && Oc() ? (this.animation.timeline = e, t && (this.animation.rangeStart = t), n && (this.animation.rangeEnd = n), aa) : r(this);
	}
}, Lc = {
	anticipate: ya,
	backInOut: va,
	circInOut: Sa
};
function Rc(e) {
	return e in Lc;
}
function zc(e) {
	typeof e.ease == "string" && Rc(e.ease) && (e.ease = Lc[e.ease]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/NativeAnimationExtended.mjs
var Bc = 10, Vc = class extends Ic {
	constructor(e) {
		zc(e), ks(e), super(e), e.startTime !== void 0 && e.autoplay !== !1 && (this.startTime = e.startTime), this.options = e;
	}
	updateMotionValue(e) {
		let { motionValue: t, onUpdate: n, onComplete: r, element: i, ...a } = this.options;
		if (!t) return;
		if (e !== void 0) {
			t.set(e);
			return;
		}
		let o = new Fs({
			...a,
			autoplay: !1
		}), s = Math.max(Bc, Ba.now() - this.startTime), c = $i(0, Bc, s - Bc), l = o.sample(s).value, { name: u } = this.options;
		i && u && Tc(i, u, l), t.setWithVelocity(o.sample(Math.max(0, s - c)).value, l, c), o.stop();
	}
}, Hc = (e, t) => t !== "zIndex" && !!(typeof e == "number" || Array.isArray(e) || typeof e == "string" && (Po.test(e) || e === "0") && !e.startsWith("url("));
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/can-animate.mjs
function Uc(e) {
	let t = e[0];
	if (e.length === 1) return !0;
	for (let n = 0; n < e.length; n++) if (e[n] !== t) return !0;
}
function Wc(e, t, n, r) {
	let i = e[0];
	if (i === null) return !1;
	if (t === "display" || t === "visibility") return !0;
	let a = e[e.length - 1], o = Hc(i, t), s = Hc(a, t);
	return !o || !s ? (o !== s && `${t}${i}${a}${o ? a : i}`, !1) : Uc(e) || (n === "spring" || Pc(n)) && r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/make-animation-instant.mjs
function Gc(e) {
	e.duration = 0, e.type = "keyframes";
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/utils/accelerated-values.mjs
var Kc = /* @__PURE__ */ new Set([
	"opacity",
	"clipPath",
	"filter",
	"transform",
	"backgroundColor"
]), qc = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/;
function Jc(e) {
	for (let t = 0; t < e.length; t++) if (typeof e[t] == "string" && qc.test(e[t])) return !0;
	return !1;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/waapi/supports/waapi.mjs
var Yc = /* @__PURE__ */ new Set([
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
]), Xc = /*@__PURE__*/ ia(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
function Zc(e) {
	let { motionValue: t, name: n, repeatDelay: r, repeatType: i, damping: a, type: o, keyframes: s } = e;
	if (!n || !(Kc.has(n) || Yc.has(n))) return !1;
	let c = t?.owner?.current;
	if (!(c instanceof HTMLElement) && !(c instanceof SVGElement)) return !1;
	let { onUpdate: l, transformTemplate: u } = t.owner.getProps();
	return Xc() && (Kc.has(n) || Yc.has(n) && Jc(s)) && (n !== "transform" || !u) && !l && !r && i !== "mirror" && a !== 0 && o !== "inertia";
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/AsyncMotionValueAnimation.mjs
var Qc = 40, $c = class extends Ns {
	constructor(e) {
		super(), this.stop = () => {
			this._animation && (this._animation.stop(), this.stopTimeline?.()), this.keyframeResolver?.cancel();
		}, this.createdAt = Ba.now();
		let { keyframes: t, name: n, motionValue: r, element: i } = e, a = e;
		a.autoplay ??= !0, a.delay ??= 0, a.type ??= "keyframes", a.repeat ??= 0, a.repeatDelay ??= 0, a.repeatType ??= "loop";
		let o = i?.KeyframeResolver || Cc;
		this.keyframeResolver = new o(t, (e, t, n) => this.onKeyframesResolved(e, t, a, !n), n, r, i), this.keyframeResolver?.scheduleResolve();
	}
	onKeyframesResolved(e, t, n, r) {
		this.keyframeResolver = void 0;
		let { name: i, type: a, velocity: o, delay: s, isHandoff: c, onUpdate: l } = n;
		this.resolvedAt = Ba.now();
		let u = !0;
		Wc(e, i, a, o) || (u = !1, (ea.instantAnimations || !s) && l?.(Ds(e, n, t)), e[0] = e[e.length - 1], Gc(n), n.repeat = 0);
		let d = r ? this.resolvedAt && this.resolvedAt - this.createdAt > Qc ? this.resolvedAt : this.createdAt : void 0, { onComplete: f } = n;
		n.startTime ??= d, n.finalKeyframe = t, n.keyframes = e, n.onComplete = () => {
			f?.(), this.notifyFinished();
		};
		let p = u && !c && Zc(n), m;
		if (p) {
			n.element = n.motionValue?.owner?.current;
			try {
				m = new Vc(n);
			} catch {
				m = new Fs(n);
			}
		} else m = new Fs(n);
		this.pendingTimeline &&= (this.stopTimeline = m.attachTimeline(this.pendingTimeline), void 0), this._animation = m;
	}
	get finished() {
		return this._animation ? this._animation.finished : super.finished;
	}
	then(e, t) {
		return this.finished.finally(e).then(() => {});
	}
	get animation() {
		return this._animation || (this.keyframeResolver?.resume(), xc()), this._animation;
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
function el(e, t, n, r = 0, i = 1) {
	let a = Array.from(e).sort((e, t) => e.sortNodePosition(t)).indexOf(t), o = e.size, s = (o - 1) * r;
	return typeof n == "function" ? n(a, o) : i === 1 ? a * r : s - a * r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/index.mjs
var tl = 30, nl = (e) => !isNaN(parseFloat(e)), rl = { current: void 0 }, il = class {
	constructor(e, t = {}) {
		this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (e) => {
			let t = Ba.now();
			if (this.updatedAt !== t && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(e), this.current !== this.prev && (this.notifyChange(), this.dependents)) for (let e of this.dependents) e.dirty();
		}, this.hasAnimated = !1, this.setCurrent(e), this.owner = t.owner;
	}
	setCurrent(e) {
		this.current = e, this.updatedAt = Ba.now(), this.canTrackVelocity === null && e !== void 0 && (this.canTrackVelocity = nl(this.current));
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
		L.read(() => {
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
		return rl.current && rl.current.push(this), this.current;
	}
	getPrevious() {
		return this.prev;
	}
	getVelocity() {
		let e = Ba.now();
		if (!this.canTrackVelocity || this.prevFrameValue === void 0 || e - this.updatedAt > tl) return 0;
		let t = Math.min(this.updatedAt - this.prevUpdatedAt, tl);
		return /* @__PURE__ */ I(parseFloat(this.current) - parseFloat(this.prevFrameValue), t);
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
function al(e, t) {
	return new il(e, t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/resolve-transition.mjs
function ol(e, t) {
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
function sl(e, t) {
	let n = e?.[t] ?? e?.default ?? e;
	return n === e ? n : ol(n, e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/utils/default-transitions.mjs
var cl = {
	type: "spring",
	stiffness: 500,
	damping: 25,
	restSpeed: 10
}, ll = (e) => ({
	type: "spring",
	stiffness: 550,
	damping: e === 0 ? 2 * Math.sqrt(550) : 30,
	restSpeed: 10
}), ul = {
	type: "keyframes",
	duration: .8
}, dl = {
	type: "keyframes",
	ease: [
		.25,
		.1,
		.35,
		1
	],
	duration: .3
}, fl = (e, { keyframes: t }) => t.length > 2 ? ul : sc.has(e) ? e.startsWith("scale") ? ll(t[1]) : cl : dl, pl = /* @__PURE__ */ new Set([
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
function ml(e) {
	for (let t in e) if (!pl.has(t)) return !0;
	return !1;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/interfaces/motion-value.mjs
var hl = (e, t, n, r = {}, i, a) => (o) => {
	let s = sl(r, e) || {}, c = s.delay || r.delay || 0, { elapsed: l = 0 } = r;
	l -= /* @__PURE__ */ P(c);
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
	ml(s) || Object.assign(u, fl(e, u)), u.duration &&= /* @__PURE__ */ P(u.duration), u.repeatDelay &&= /* @__PURE__ */ P(u.repeatDelay), u.from !== void 0 && (u.keyframes[0] = u.from);
	let d = !1;
	if ((u.type === !1 || u.duration === 0 && !u.repeatDelay) && (Gc(u), u.delay === 0 && (d = !0)), (ea.instantAnimations || ea.skipAnimations || i?.shouldSkipAnimations || s.skipAnimations) && (d = !0, Gc(u), u.delay = 0), u.allowFlatten = !s.type && !s.ease, d && !a && t.get() !== void 0) {
		let e = Ds(u.keyframes, s);
		if (e !== void 0) {
			L.update(() => {
				u.onUpdate(e), u.onComplete();
			});
			return;
		}
	}
	return s.isSync ? new Fs(u) : new $c(u);
}, gl = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
function _l(e) {
	let t = gl.exec(e);
	if (!t) return [,];
	let [, n, r, i] = t;
	return [`--${n ?? r}`, i];
}
function vl(e, t, n = 1) {
	`${e}`;
	let [r, i] = _l(e);
	if (!r) return;
	let a = window.getComputedStyle(t).getPropertyValue(r);
	if (a) {
		let e = a.trim();
		return ta(e) ? parseFloat(e) : e;
	}
	return Ga(i) ? vl(i, t, n + 1) : i;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/resolve-variants.mjs
function yl(e) {
	let t = [{}, {}];
	return e?.values.forEach((e, n) => {
		t[0][n] = e.get(), t[1][n] = e.getVelocity();
	}), t;
}
function bl(e, t, n, r) {
	if (typeof t == "function") {
		let [i, a] = yl(r);
		t = t(n === void 0 ? e.custom : n, i, a);
	}
	if (typeof t == "string" && (t = e.variants && e.variants[t]), typeof t == "function") {
		let [i, a] = yl(r);
		t = t(n === void 0 ? e.custom : n, i, a);
	}
	return t;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/resolve-dynamic-variants.mjs
function V(e, t, n) {
	let r = e.getProps();
	return bl(r, t, n === void 0 ? r.custom : n, e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/keys-position.mjs
var xl = /* @__PURE__ */ new Set([
	"width",
	"height",
	"top",
	"left",
	"right",
	"bottom",
	...oc
]), Sl = (e) => Array.isArray(e);
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/setters.mjs
function Cl(e, t, n) {
	e.hasValue(t) ? e.getValue(t).set(n) : e.addValue(t, al(n));
}
function wl(e) {
	return Sl(e) ? e[e.length - 1] || 0 : e;
}
function Tl(e, t) {
	let { transitionEnd: n = {}, transition: r = {}, ...i } = V(e, t) || {};
	i = {
		...i,
		...n
	};
	for (let t in i) Cl(e, t, wl(i[t]));
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/utils/is-motion-value.mjs
var El = (e) => !!(e && e.getVelocity);
//#endregion
//#region node_modules/motion-dom/dist/es/value/will-change/is.mjs
function Dl(e) {
	return !!(El(e) && e.add);
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/will-change/add-will-change.mjs
function Ol(e, t) {
	let n = e.getValue("willChange");
	if (Dl(n)) return n.add(t);
	if (!n && ea.WillChange) {
		let n = new ea.WillChange("auto");
		e.addValue("willChange", n), n.add(t);
	}
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/dom/utils/camel-to-dash.mjs
function kl(e) {
	return e.replace(/([A-Z])/g, (e) => `-${e.toLowerCase()}`);
}
var Al = "data-" + kl("framerAppearId");
//#endregion
//#region node_modules/motion-dom/dist/es/animation/optimized-appear/get-appear-id.mjs
function jl(e) {
	return e.props[Al];
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/interfaces/visual-element-target.mjs
var Ml = typeof window < "u";
function Nl({ protectedKeys: e, needsAnimating: t }, n) {
	let r = e.hasOwnProperty(n) && t[n] !== !0;
	return t[n] = !1, r;
}
function Pl(e, t, { delay: n = 0, transitionOverride: r, type: i } = {}) {
	let { transition: a, transitionEnd: o, ...s } = t, c = e.getDefaultTransition();
	a = a ? ol(a, c) : c;
	let l = a?.reduceMotion, u = a?.skipAnimations;
	r && (a = r);
	let d = [], f = i && e.animationState && e.animationState.getState()[i], p = a?.path;
	p && p.animateVisualElement(e, s, a, n, d);
	for (let t in s) {
		let r = e.getValue(t, e.latestValues[t] ?? null), i = s[t];
		if (i === void 0 || f && Nl(f, t)) continue;
		let o = {
			delay: n,
			...sl(a || {}, t)
		};
		u && (o.skipAnimations = !0);
		let c = r.get();
		if (c !== void 0 && !r.isAnimating() && !Array.isArray(i) && i === c && !o.velocity) {
			L.update(() => r.set(i));
			continue;
		}
		let p = !1;
		if (Ml && window.MotionHandoffAnimation) {
			let n = jl(e);
			if (n) {
				let e = window.MotionHandoffAnimation(n, t, L);
				e !== null && (o.startTime = e, p = !0);
			}
		}
		Ol(e, t);
		let m = l ?? e.shouldReduceMotion;
		r.start(hl(t, r, i, m && xl.has(t) ? { type: !1 } : o, e, p));
		let h = r.animation;
		h && d.push(h);
	}
	if (o) {
		let t = () => L.update(() => {
			o && Tl(e, o);
		});
		d.length ? Promise.all(d).then(t) : t();
	}
	return d;
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/interfaces/visual-element-variant.mjs
function Fl(e, t, n = {}) {
	let r = V(e, t, n.type === "exit" ? e.presenceContext?.custom : void 0), { transition: i = e.getDefaultTransition() || {} } = r || {};
	n.transitionOverride && (i = n.transitionOverride);
	let a = r ? () => Promise.all(Pl(e, r, n)) : () => Promise.resolve(), o = e.variantChildren && e.variantChildren.size ? (r = 0) => {
		let { delayChildren: a = 0, staggerChildren: o, staggerDirection: s } = i;
		return Il(e, t, r, a, o, s, n);
	} : () => Promise.resolve(), { when: s } = i;
	if (s) {
		let [e, t] = s === "beforeChildren" ? [a, o] : [o, a];
		return e().then(() => t());
	}
	return Promise.all([a(), o(n.delay)]);
}
function Il(e, t, n = 0, r = 0, i = 0, a = 1, o) {
	let s = [];
	for (let c of e.variantChildren) c.notify("AnimationStart", t), s.push(Fl(c, t, {
		...o,
		delay: n + (typeof r == "function" ? 0 : r) + el(e.variantChildren, c, r, i, a)
	}).then(() => c.notify("AnimationComplete", t)));
	return Promise.all(s);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/interfaces/visual-element.mjs
function Ll(e, t, n = {}) {
	e.notify("AnimationStart", t);
	let r;
	if (Array.isArray(t)) {
		let i = t.map((t) => Fl(e, t, n));
		r = Promise.all(i);
	} else if (typeof t == "string") r = Fl(e, t, n);
	else {
		let i = typeof t == "function" ? V(e, t, n.custom) : t;
		r = Promise.all(Pl(e, i, n));
	}
	return r.then(() => {
		e.notify("AnimationComplete", t);
	});
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/auto.mjs
var Rl = {
	test: (e) => e === "auto",
	parse: (e) => e
}, zl = (e) => (t) => t.test(e), Bl = [
	Ja,
	R,
	lo,
	co,
	fo,
	uo,
	Rl
], Vl = (e) => Bl.find(zl(e));
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/utils/is-none.mjs
function Hl(e) {
	return typeof e == "number" ? e === 0 : e === null || e === "none" || e === "0" || ra(e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/utils/make-none-animatable.mjs
var Ul = /* @__PURE__ */ new Set([
	"auto",
	"none",
	"0"
]);
function Wl(e, t, n) {
	let r = 0, i;
	for (; r < e.length && !i;) {
		let t = e[r];
		typeof t == "string" && !Ul.has(t) && Eo(t) && (i = e[r]), r++;
	}
	if (i && n) for (let r of t) e[r] !== i && (e[r] = Ks(n, i));
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/keyframes/DOMKeyframesResolver.mjs
var Gl = class extends Cc {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i, !0);
	}
	readKeyframes() {
		let { unresolvedKeyframes: e, element: t, name: n } = this;
		if (!t || !t.current) return;
		super.readKeyframes();
		for (let n = 0; n < e.length; n++) {
			let r = e[n];
			if (typeof r == "string" && (r = r.trim(), Ga(r))) {
				let i = vl(r, t.current);
				i !== void 0 && (e[n] = i), n === e.length - 1 && (this.finalKeyframe = r);
			}
		}
		if (this.resolveNoneKeyframes(), !xl.has(n) || e.length !== 2) return;
		let [r, i] = e;
		if (typeof r == "number" && typeof i == "number") return;
		let a = Vl(r), o = Vl(i);
		if (qa(r) !== qa(i) && mc[n]) {
			this.needsMeasurement = !0;
			return;
		}
		if (a !== o) {
			if (cc(a) && cc(o)) for (let t = 0; t < e.length; t++) {
				let n = e[t];
				typeof n == "string" && (e[t] = parseFloat(n));
			}
			else mc[n] && (this.needsMeasurement = !0);
		}
	}
	resolveNoneKeyframes() {
		let { unresolvedKeyframes: e, name: t } = this, n = [];
		for (let t = 0; t < e.length; t++) (e[t] === null || Hl(e[t])) && n.push(t);
		n.length && Wl(e, n, t);
	}
	measure() {
		let { element: e, name: t } = this;
		return mc[t](window.getComputedStyle(e.current), () => e.measureViewportBox());
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
}, Kl = [
	"borderTopLeftRadius",
	"borderTopRightRadius",
	"borderBottomRightRadius",
	"borderBottomLeftRadius"
];
//#endregion
//#region node_modules/motion-dom/dist/es/utils/is-html-element.mjs
function ql(e) {
	return na(e) && "offsetHeight" in e && !("ownerSVGElement" in e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/utils/is-svg-element.mjs
function Jl(e) {
	return na(e) && "ownerSVGElement" in e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/types/utils/get-as-type.mjs
var Yl = (e, t) => t && typeof e == "number" ? t.transform(e) : e;
//#endregion
//#region node_modules/motion-dom/dist/es/utils/resolve-elements.mjs
function Xl(e, t, n) {
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
var Zl = {
	x: "translateX",
	y: "translateY",
	z: "translateZ",
	transformPerspective: "perspective"
}, Ql = oc.length;
function $l(e, t, n) {
	let r = "", i = !0;
	for (let a = 0; a < Ql; a++) {
		let o = oc[a], s = e[o];
		if (s === void 0) continue;
		let c = !0;
		if (typeof s == "number") c = s === +!!o.startsWith("scale");
		else {
			let e = parseFloat(s);
			c = o.startsWith("scale") ? e === 1 : e === 0;
		}
		if (!c || n) {
			let e = Yl(s, Hs[o]);
			if (!c) {
				i = !1;
				let t = Zl[o] || o;
				r += `${t}(${e}) `;
			}
			n && (t[o] = e);
		}
	}
	let a = e.pathRotation;
	return a && (i = !1, r += `rotate(${Yl(a, Hs.pathRotation)}) `), r = r.trim(), n ? r = n(t, i ? "" : r) : i && (r = "none"), r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/utils/build-styles.mjs
function eu(e, t, n) {
	let { style: r, vars: i, transformOrigin: a } = e, o = !1, s = !1;
	for (let e in t) {
		let n = t[e];
		if (sc.has(e)) {
			o = !0;
			continue;
		}
		if (Ua(e)) {
			i[e] = n;
			continue;
		}
		{
			let t = Yl(n, Hs[e]);
			e.startsWith("origin") ? (s = !0, a[e] = t) : r[e] = t;
		}
	}
	if (t.transform || (o || n ? r.transform = $l(t, e.transform, n) : r.transform &&= "none"), s) {
		let { originX: e = "50%", originY: t = "50%", originZ: n = 0 } = a;
		r.transformOrigin = `${e} ${t} ${n}`;
	}
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/utils/path.mjs
var tu = {
	offset: "stroke-dashoffset",
	array: "stroke-dasharray"
}, nu = {
	offset: "strokeDashoffset",
	array: "strokeDasharray"
};
function ru(e, t, n = 1, r = 0, i = !0) {
	e.pathLength = 1;
	let a = i ? tu : nu;
	e[a.offset] = `${-r}`, e[a.array] = `${t} ${n}`;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/utils/build-attrs.mjs
var iu = [
	"transform",
	"opacity",
	"offsetDistance",
	"offsetPath",
	"offsetRotate",
	"offsetAnchor"
];
function au(e, { attrX: t, attrY: n, attrScale: r, pathLength: i, pathSpacing: a = 1, pathOffset: o = 0, ...s }, c, l, u) {
	if (eu(e, s, l), c) {
		e.style.viewBox && (e.attrs.viewBox = e.style.viewBox);
		return;
	}
	e.attrs = e.style, e.style = {};
	let { attrs: d, style: f } = e;
	for (let e of iu) d[e] !== void 0 && (f[e] = d[e], delete d[e]);
	(f.transform || d.transformOrigin) && (f.transformOrigin = d.transformOrigin ?? "50% 50%", delete d.transformOrigin), f.transform && (f.transformBox = u?.transformBox ?? "fill-box", delete d.transformBox), t !== void 0 && (d.x = t), n !== void 0 && (d.y = n), r !== void 0 && (d.scale = r), i !== void 0 && ru(d, i, a, o, !1);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/conversion.mjs
function ou({ top: e, left: t, right: n, bottom: r }) {
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
function su({ x: e, y: t }) {
	return {
		top: t.min,
		right: e.max,
		bottom: t.max,
		left: e.min
	};
}
function H(e, t) {
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
function cu(e) {
	return e === void 0 || e === 1;
}
function lu({ scale: e, scaleX: t, scaleY: n }) {
	return !cu(e) || !cu(t) || !cu(n);
}
function uu(e) {
	return lu(e) || du(e) || e.z || e.rotate || e.rotateX || e.rotateY || e.skewX || e.skewY;
}
function du(e) {
	return fu(e.x) || fu(e.y);
}
function fu(e) {
	return e && e !== "0%";
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/delta-apply.mjs
function pu(e, t, n) {
	return n + t * (e - n);
}
function mu(e, t, n, r, i) {
	return i !== void 0 && (e = pu(e, i, r)), pu(e, n, r) + t;
}
function hu(e, t = 0, n = 1, r, i) {
	e.min = mu(e.min, t, n, r, i), e.max = mu(e.max, t, n, r, i);
}
function gu(e, { x: t, y: n }) {
	hu(e.x, t.translate, t.scale, t.originPoint), hu(e.y, n.translate, n.scale, n.originPoint);
}
var _u = .999999999999, vu = 1.0000000000001;
function yu(e, t, n, r = !1) {
	let i = n.length;
	if (!i) return;
	t.x = t.y = 1;
	let a, o;
	for (let s = 0; s < i; s++) {
		a = n[s], o = a.projectionDelta;
		let { visualElement: i } = a.options;
		i && i.props.style && i.props.style.display === "contents" || (r && a.options.layoutScroll && a.scroll && a !== a.root && (bu(e.x, -a.scroll.offset.x), bu(e.y, -a.scroll.offset.y)), o && (t.x *= o.x.scale, t.y *= o.y.scale, gu(e, o)), r && uu(a.latestValues) && Cu(e, a.latestValues, a.layout?.layoutBox));
	}
	t.x < vu && t.x > _u && (t.x = 1), t.y < vu && t.y > _u && (t.y = 1);
}
function bu(e, t) {
	e.min += t, e.max += t;
}
function xu(e, t, n, r, i = .5) {
	hu(e, t, n, z(e.min, e.max, i), r);
}
function Su(e, t) {
	return typeof e == "string" ? parseFloat(e) / 100 * (t.max - t.min) : e;
}
function Cu(e, t, n) {
	let r = n ?? e;
	xu(e.x, Su(t.x, r.x), t.scaleX, t.scale, t.originX), xu(e.y, Su(t.y, r.y), t.scaleY, t.scale, t.originY);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/utils/measure.mjs
function wu(e, t) {
	return ou(H(e.getBoundingClientRect(), t));
}
function Tu(e, t, n) {
	let r = wu(e, n), { scroll: i } = t;
	return i && (bu(r.x, i.offset.x), bu(r.y, i.offset.y)), r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/frameloop/microtask.mjs
var { schedule: Eu, cancel: Du } = /* @__PURE__ */ Pa(queueMicrotask, !1), Ou = {
	x: !1,
	y: !1
};
function ku() {
	return Ou.x || Ou.y;
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/drag/state/set-active.mjs
function Au(e) {
	return e === "x" || e === "y" ? Ou[e] ? null : (Ou[e] = !0, () => {
		Ou[e] = !1;
	}) : Ou.x || Ou.y ? null : (Ou.x = Ou.y = !0, () => {
		Ou.x = Ou.y = !1;
	});
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/utils/setup.mjs
function ju(e, t) {
	let n = Xl(e), r = new AbortController();
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
function Mu(e) {
	return !(e.pointerType === "touch" || ku());
}
function Nu(e, t, n = {}) {
	let [r, i, a] = ju(e, n);
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
			if (!Mu(n)) return;
			r = !1;
			let o = t(e, n);
			typeof o == "function" && (a = o, e.addEventListener("pointerleave", u, i));
		}, i), e.addEventListener("pointerdown", l, i);
	}), a;
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/utils/is-node-or-child.mjs
var Pu = (e, t) => t ? e === t || Pu(e, t.parentElement) : !1, Fu = (e) => e.pointerType === "mouse" ? typeof e.button != "number" || e.button <= 0 : e.isPrimary !== !1, Iu = /* @__PURE__ */ new Set([
	"BUTTON",
	"INPUT",
	"SELECT",
	"TEXTAREA",
	"A"
]);
function Lu(e) {
	return Iu.has(e.tagName) || e.isContentEditable === !0;
}
var Ru = /* @__PURE__ */ new Set([
	"INPUT",
	"SELECT",
	"TEXTAREA"
]);
function zu(e) {
	return Ru.has(e.tagName) || e.isContentEditable === !0;
}
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/press/utils/state.mjs
var Bu = /* @__PURE__ */ new WeakSet();
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/press/utils/keyboard.mjs
function Vu(e) {
	return (t) => {
		t.key === "Enter" && e(t);
	};
}
function Hu(e, t) {
	e.dispatchEvent(new PointerEvent("pointer" + t, {
		isPrimary: !0,
		bubbles: !0
	}));
}
var Uu = (e, t) => {
	let n = e.currentTarget;
	if (!n) return;
	let r = Vu(() => {
		if (Bu.has(n)) return;
		Hu(n, "down");
		let e = Vu(() => {
			Hu(n, "up");
		});
		n.addEventListener("keyup", e, t), n.addEventListener("blur", () => Hu(n, "cancel"), t);
	});
	n.addEventListener("keydown", r, t), n.addEventListener("blur", () => n.removeEventListener("keydown", r), t);
};
//#endregion
//#region node_modules/motion-dom/dist/es/gestures/press/index.mjs
function Wu(e) {
	return Fu(e) && !ku();
}
var Gu = /* @__PURE__ */ new WeakSet();
function Ku(e, t, n = {}) {
	let [r, i, a] = ju(e, n), o = (e) => {
		let r = e.currentTarget;
		if (!Wu(e) || Gu.has(e)) return;
		Bu.add(r), n.stopPropagation && Gu.add(e);
		let a = t(r, e), o = {
			...i,
			capture: !0
		}, s = (e, t) => {
			window.removeEventListener("pointerup", c, o), window.removeEventListener("pointercancel", l, o), Bu.has(r) && Bu.delete(r), Wu(e) && typeof a == "function" && a(e, { success: t });
		}, c = (e) => {
			s(e, r === window || r === document || n.useGlobalTarget || Pu(r, e.target));
		}, l = (e) => {
			s(e, !1);
		};
		window.addEventListener("pointerup", c, o), window.addEventListener("pointercancel", l, o);
	};
	return r.forEach((e) => {
		(n.useGlobalTarget ? window : e).addEventListener("pointerdown", o, i), ql(e) && (e.addEventListener("focus", (e) => Uu(e, i)), !Lu(e) && !e.hasAttribute("tabindex") && (e.tabIndex = 0));
	}), a;
}
//#endregion
//#region node_modules/motion-dom/dist/es/resize/handle-element.mjs
var qu = /* @__PURE__ */ new WeakMap(), Ju, Yu = (e, t, n) => (r, i) => i && i[0] ? i[0][e + "Size"] : Jl(r) && "getBBox" in r ? r.getBBox()[t] : r[n], Xu = /*@__PURE__*/ Yu("inline", "width", "offsetWidth"), Zu = /*@__PURE__*/ Yu("block", "height", "offsetHeight");
function Qu({ target: e, borderBoxSize: t }) {
	qu.get(e)?.forEach((n) => {
		n(e, {
			get width() {
				return Xu(e, t);
			},
			get height() {
				return Zu(e, t);
			}
		});
	});
}
function $u(e) {
	e.forEach(Qu);
}
function ed() {
	typeof ResizeObserver < "u" && (Ju = new ResizeObserver($u));
}
function td(e, t) {
	Ju || ed();
	let n = Xl(e);
	return n.forEach((e) => {
		let n = qu.get(e);
		n || (n = /* @__PURE__ */ new Set(), qu.set(e, n)), n.add(t), Ju?.observe(e);
	}), () => {
		n.forEach((e) => {
			let n = qu.get(e);
			n?.delete(t), n?.size || Ju?.unobserve(e);
		});
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/resize/handle-window.mjs
var nd = /* @__PURE__ */ new Set(), U;
function rd() {
	U = () => {
		let e = {
			get width() {
				return window.innerWidth;
			},
			get height() {
				return window.innerHeight;
			}
		};
		nd.forEach((t) => t(e));
	}, window.addEventListener("resize", U);
}
function W(e) {
	return nd.add(e), U || rd(), () => {
		nd.delete(e), !nd.size && typeof U == "function" && (window.removeEventListener("resize", U), U = void 0);
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/resize/index.mjs
function G(e, t) {
	return typeof e == "function" ? W(e) : td(e, t);
}
//#endregion
//#region node_modules/motion-dom/dist/es/stats/buffer.mjs
var K = {
	value: null,
	addProjectionMetrics: null
};
//#endregion
//#region node_modules/motion-dom/dist/es/utils/is-svg-svg-element.mjs
function id(e) {
	return Jl(e) && e.tagName === "svg";
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/models.mjs
var ad = () => ({
	translate: 0,
	scale: 1,
	origin: 0,
	originPoint: 0
}), od = () => ({
	x: ad(),
	y: ad()
}), sd = () => ({
	min: 0,
	max: 0
}), cd = () => ({
	x: sd(),
	y: sd()
}), ld = /* @__PURE__ */ new WeakMap();
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/is-animation-controls.mjs
function ud(e) {
	return typeof e == "object" && !!e && typeof e.start == "function";
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/is-variant-label.mjs
function dd(e) {
	return typeof e == "string" || Array.isArray(e);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/variant-props.mjs
var fd = [
	"animate",
	"whileInView",
	"whileFocus",
	"whileHover",
	"whileTap",
	"whileDrag",
	"exit"
], pd = ["initial", ...fd];
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/is-controlling-variants.mjs
function md(e) {
	if (ud(e.animate)) return !0;
	for (let t = 0; t < pd.length; t++) if (dd(e[pd[t]])) return !0;
	return !1;
}
function hd(e) {
	return !!(md(e) || e.variants);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/motion-values.mjs
function gd(e, t, n) {
	for (let r in t) {
		let i = t[r], a = n[r];
		if (El(i)) e.addValue(r, i);
		else if (El(a)) e.addValue(r, al(i, { owner: e }));
		else if (a !== i) {
			if (e.hasValue(r)) {
				let t = e.getValue(r);
				t.liveStyle === !0 ? t.jump(i) : t.hasAnimated || t.set(i);
			} else {
				let t = e.getStaticValue(r);
				e.addValue(r, al(t === void 0 ? i : t, { owner: e }));
			}
		}
	}
	for (let r in n) t[r] === void 0 && e.removeValue(r);
	return t;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/reduced-motion/state.mjs
var _d = { current: null }, vd = { current: !1 }, yd = typeof window < "u";
function bd() {
	if (vd.current = !0, yd) {
		if (window.matchMedia) {
			let e = window.matchMedia("(prefers-reduced-motion)"), t = () => _d.current = e.matches;
			e.addEventListener("change", t), t();
		} else _d.current = !1;
	}
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/VisualElement.mjs
var xd = [
	"AnimationStart",
	"AnimationComplete",
	"Update",
	"BeforeLayoutMeasure",
	"LayoutMeasure",
	"LayoutAnimationStart",
	"LayoutAnimationComplete"
], Sd = {};
function Cd(e) {
	Sd = e;
}
function wd() {
	return Sd;
}
var Td = class {
	scrapeMotionValuesFromProps(e, t, n) {
		return {};
	}
	constructor({ parent: e, props: t, presenceContext: n, reducedMotionConfig: r, skipAnimations: i, blockInitialAnimation: a, visualState: o }, s = {}) {
		this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = !1, this.isControllingVariants = !1, this.shouldReduceMotion = null, this.shouldSkipAnimations = !1, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = Cc, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = !1, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
			this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
		}, this.renderScheduledAt = 0, this.scheduleRender = () => {
			let e = Ba.now();
			this.renderScheduledAt < e && (this.renderScheduledAt = e, L.render(this.render, !1, !0));
		};
		let { latestValues: c, renderState: l } = o;
		this.latestValues = c, this.baseTarget = { ...c }, this.initialValues = t.initial ? { ...c } : {}, this.renderState = l, this.parent = e, this.props = t, this.presenceContext = n, this.depth = e ? e.depth + 1 : 0, this.reducedMotionConfig = r, this.skipAnimationsConfig = i, this.options = s, this.blockInitialAnimation = !!a, this.isControllingVariants = md(t), this.isVariantNode = hd(t), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(e && e.current);
		let { willChange: u, ...d } = this.scrapeMotionValuesFromProps(t, {}, this);
		for (let e in d) {
			let t = d[e];
			c[e] !== void 0 && El(t) && t.set(c[e]);
		}
	}
	mount(e) {
		if (this.hasBeenMounted) for (let e in this.initialValues) this.values.get(e)?.jump(this.initialValues[e]), this.latestValues[e] = this.initialValues[e];
		this.current = e, ld.set(e, this), this.projection && !this.projection.instance && this.projection.mount(e), this.parent && this.isVariantNode && !this.isControllingVariants && (this.removeFromVariantTree = this.parent.addVariantChild(this)), this.values.forEach((e, t) => this.bindToMotionValue(t, e)), this.reducedMotionConfig === "never" ? this.shouldReduceMotion = !1 : this.reducedMotionConfig === "always" ? this.shouldReduceMotion = !0 : (vd.current || bd(), this.shouldReduceMotion = _d.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? !1, this.parent?.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = !0;
	}
	unmount() {
		this.projection && this.projection.unmount(), Fa(this.notifyUpdate), Fa(this.render), this.valueSubscriptions.forEach((e) => e()), this.valueSubscriptions.clear(), this.removeFromVariantTree && this.removeFromVariantTree(), this.parent?.removeChild(this);
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
		if (this.valueSubscriptions.has(e) && this.valueSubscriptions.get(e)(), t.accelerate && Kc.has(e) && this.current instanceof HTMLElement) {
			let { factory: n, keyframes: r, times: i, ease: a, duration: o } = t.accelerate, s = new Ic({
				element: this.current,
				name: e,
				keyframes: r,
				times: i,
				ease: a,
				duration: /* @__PURE__ */ P(o)
			}), c = n(s);
			this.valueSubscriptions.set(e, () => {
				c(), s.cancel();
			});
			return;
		}
		let n = sc.has(e);
		n && this.onBindTransform && this.onBindTransform();
		let r = t.on("change", (t) => {
			this.latestValues[e] = t, this.props.onUpdate && L.preRender(this.notifyUpdate), n && this.projection && (this.projection.isTransformDirty = !0), this.scheduleRender();
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
		for (e in Sd) {
			let t = Sd[e];
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
		return this.current ? this.measureInstanceViewportBox(this.current, this.props) : cd();
	}
	getStaticValue(e) {
		return this.latestValues[e];
	}
	setStaticValue(e, t) {
		this.latestValues[e] = t;
	}
	update(e, t) {
		(e.transformTemplate || this.props.transformTemplate) && this.scheduleRender(), this.prevProps = this.props, this.props = e, this.prevPresenceContext = this.presenceContext, this.presenceContext = t;
		for (let t = 0; t < xd.length; t++) {
			let n = xd[t];
			this.propEventSubscriptions[n] && (this.propEventSubscriptions[n](), delete this.propEventSubscriptions[n]);
			let r = e["on" + n];
			r && (this.propEventSubscriptions[n] = this.on(n, r));
		}
		this.prevMotionValues = gd(this, this.scrapeMotionValuesFromProps(e, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
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
		return n === void 0 && t !== void 0 && (n = al(t === null ? void 0 : t, { owner: this }), this.addValue(e, n)), n;
	}
	readValue(e, t) {
		let n = this.latestValues[e] !== void 0 || !this.current ? this.latestValues[e] : this.getBaseTargetFromProps(this.props, e) ?? this.readValueFromInstance(this.current, e, this.options);
		return n != null && (typeof n == "string" && (ta(n) || ra(n)) ? n = parseFloat(n) : typeof n != "number" && !Po.test(n) && Po.test(t) && (n = Ks(e, t)), this.setBaseTarget(e, El(n) ? n.get() : n)), El(n) ? n.get() : n;
	}
	setBaseTarget(e, t) {
		this.baseTarget[e] = t;
	}
	getBaseTarget(e) {
		let { initial: t } = this.props, n;
		if (typeof t == "string" || typeof t == "object") {
			let r = bl(this.props, t, this.presenceContext?.custom);
			r && (n = r[e]);
		}
		if (t && n !== void 0) return n;
		let r = this.getBaseTargetFromProps(this.props, e);
		return r !== void 0 && !El(r) ? r : this.initialValues[e] !== void 0 && n === void 0 ? void 0 : this.baseTarget[e];
	}
	on(e, t) {
		return this.events[e] || (this.events[e] = new ca()), this.events[e].add(t);
	}
	notify(e, ...t) {
		this.events[e] && this.events[e].notify(...t);
	}
	scheduleRenderMicrotask() {
		Eu.render(this.render);
	}
}, Ed = class extends Td {
	constructor() {
		super(...arguments), this.KeyframeResolver = Gl;
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
		El(e) && (this.childSubscription = e.on("change", (e) => {
			this.current && (this.current.textContent = `${e}`);
		}));
	}
}, Dd = class {
	constructor(e) {
		this.isMounted = !1, this.node = e;
	}
	update() {}
};
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/utils/render.mjs
function Od(e, { style: t, vars: n }, r, i) {
	let a = e.style, o;
	for (o in t) a[o] = t[o];
	for (o in i?.applyProjectionStyles(a, r), n) a.setProperty(o, n[o]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/styles/scale-border-radius.mjs
function kd(e, t) {
	return t.max === t.min ? 0 : e / (t.max - t.min) * 100;
}
var Ad = { correct: (e, t) => {
	if (!t.target) return e;
	if (typeof e == "string") {
		if (R.test(e)) e = parseFloat(e);
		else return e;
	}
	return `${kd(e, t.target.x)}% ${kd(e, t.target.y)}%`;
} }, jd = { correct: (e, { treeScale: t, projectionDelta: n }) => {
	let r = e, i = Po.parse(e);
	if (i.length > 5) return r;
	let a = Po.createTransformer(e), o = typeof i[0] == "number" ? 0 : 1, s = n.x.scale * t.x, c = n.y.scale * t.y;
	i[0 + o] /= s, i[1 + o] /= c;
	let l = z(s, c, .5);
	return typeof i[2 + o] == "number" && (i[2 + o] /= l), typeof i[3 + o] == "number" && (i[3 + o] /= l), a(i);
} }, Md = {
	borderRadius: {
		...Ad,
		applyTo: [...Kl]
	},
	borderTopLeftRadius: Ad,
	borderTopRightRadius: Ad,
	borderBottomLeftRadius: Ad,
	borderBottomRightRadius: Ad,
	boxShadow: jd
};
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/is-forced-motion-value.mjs
function Nd(e, { layout: t, layoutId: n }) {
	return sc.has(e) || e.startsWith("origin") || (t || n !== void 0) && (!!Md[e] || e === "opacity");
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/utils/scrape-motion-values.mjs
function Pd(e, t, n) {
	let r = e.style, i = t?.style, a = {};
	if (!r) return a;
	for (let t in r) (El(r[t]) || i && El(i[t]) || Nd(t, e) || n?.getValue(t)?.liveStyle !== void 0) && (a[t] = r[t]);
	return a;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/html/HTMLVisualElement.mjs
function Fd(e) {
	return window.getComputedStyle(e);
}
var Id = class extends Ed {
	constructor() {
		super(...arguments), this.type = "html", this.renderInstance = Od;
	}
	mount(e) {
		e.style, super.mount(e);
	}
	readValueFromInstance(e, t) {
		if (sc.has(t)) return this.projection?.isProjecting ? nc(t) : ic(e, t);
		{
			let n = Fd(e), r = (Ua(t) ? n.getPropertyValue(t) : n[t]) || 0;
			return typeof r == "string" ? r.trim() : r;
		}
	}
	measureInstanceViewportBox(e, { transformPagePoint: t }) {
		return wu(e, t);
	}
	build(e, t, n) {
		eu(e, t, n.transformTemplate);
	}
	scrapeMotionValuesFromProps(e, t, n) {
		return Pd(e, t, n);
	}
}, Ld = /* @__PURE__ */ new Set([
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
]), Rd = (e) => typeof e == "string" && e.toLowerCase() === "svg";
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/utils/render.mjs
function zd(e, t, n, r) {
	Od(e, t, void 0, r);
	for (let n in t.attrs) e.setAttribute(Ld.has(n) ? n : kl(n), t.attrs[n]);
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/utils/scrape-motion-values.mjs
function Bd(e, t, n) {
	let r = Pd(e, t, n);
	for (let n in e) if (El(e[n]) || El(t[n])) {
		let t = oc.indexOf(n) === -1 ? n : "attr" + n.charAt(0).toUpperCase() + n.substring(1);
		r[t] = e[n];
	}
	return r;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/svg/SVGVisualElement.mjs
var Vd = class extends Ed {
	constructor() {
		super(...arguments), this.type = "svg", this.isSVGTag = !1, this.measureInstanceViewportBox = cd;
	}
	getBaseTargetFromProps(e, t) {
		return e[t];
	}
	readValueFromInstance(e, t) {
		if (sc.has(t)) {
			let e = Ws(t);
			return e && e.default || 0;
		}
		if (iu.includes(t)) {
			let n = getComputedStyle(e)[t];
			if (typeof n == "string" && n) return n.trim();
		}
		return t = Ld.has(t) ? t : kl(t), e.getAttribute(t);
	}
	scrapeMotionValuesFromProps(e, t, n) {
		return Bd(e, t, n);
	}
	build(e, t, n) {
		au(e, t, this.isSVGTag, n.transformTemplate, n.style);
	}
	renderInstance(e, t, n, r) {
		zd(e, t, n, r);
	}
	mount(e) {
		this.isSVGTag = Rd(e.tagName), super.mount(e);
	}
}, Hd = pd.length;
function Ud(e) {
	if (!e) return;
	if (!e.isControllingVariants) {
		let t = e.parent && Ud(e.parent) || {};
		return e.props.initial !== void 0 && (t.initial = e.props.initial), t;
	}
	let t = {};
	for (let n = 0; n < Hd; n++) {
		let r = pd[n], i = e.props[r];
		(dd(i) || i === !1) && (t[r] = i);
	}
	return t;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/shallow-compare.mjs
function Wd(e, t) {
	if (!Array.isArray(t)) return !1;
	let n = t.length;
	if (n !== e.length) return !1;
	for (let r = 0; r < n; r++) if (t[r] !== e[r]) return !1;
	return !0;
}
//#endregion
//#region node_modules/motion-dom/dist/es/render/utils/animation-state.mjs
var Gd = [...fd].reverse(), Kd = fd.length;
function qd(e) {
	return (t) => Promise.all(t.map(({ animation: t, options: n }) => Ll(e, t, n)));
}
function Jd(e) {
	let t = qd(e), n = Zd(), r = !0, i = !1, a = (t) => (n, r) => {
		let i = V(e, r, t === "exit" ? e.presenceContext?.custom : void 0);
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
		let { props: s } = e, c = Ud(e.parent) || {}, l = [], u = /* @__PURE__ */ new Set(), d = {}, f = Infinity;
		for (let t = 0; t < Kd; t++) {
			let p = Gd[t], m = n[p], h = s[p] === void 0 ? c[p] : s[p], g = dd(h), _ = p === o ? m.isActive : null;
			_ === !1 && (f = t);
			let v = h === c[p] && h !== s[p] && g;
			if (v && (r || i) && e.manuallyAnimateOnMount && (v = !1), m.protectedKeys = { ...d }, !m.isActive && _ === null || !h && !m.prevProp || ud(h) || typeof h == "boolean") continue;
			if (p === "exit" && m.isActive && _ !== !0) {
				m.prevResolvedValues && (d = {
					...d,
					...m.prevResolvedValues
				});
				continue;
			}
			let y = Yd(m.prevProp, h), b = y || p === o && m.isActive && !v && g || t > f && g, x = !1, S = Array.isArray(h) ? h : [h], C = S.reduce(a(p), {});
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
				r = Sl(t) && Sl(n) ? !Wd(t, n) || y : t !== n, r ? t == null ? u.add(e) : E(e) : t !== void 0 && u.has(e) ? E(e) : m.protectedKeys[e] = !0;
			}
			m.prevProp = h, m.prevResolvedValues = C, m.isActive && (d = {
				...d,
				...C
			}), (r || i) && e.blockInitialAnimation && (b = !1);
			let D = v && y;
			b && (!D || x) && l.push(...S.map((t) => {
				let n = { type: p };
				if (typeof t == "string" && (r || i) && !D && e.manuallyAnimateOnMount && e.parent) {
					let { parent: r } = e, i = V(r, t);
					if (r.enteringChildren && i) {
						let { delayChildren: t } = i.transition || {};
						n.delay = el(r.enteringChildren, e, t);
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
				let n = V(e, Array.isArray(s.initial) ? s.initial[0] : s.initial);
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
			n = Zd(), i = !0;
		}
	};
}
function Yd(e, t) {
	return typeof t == "string" ? t !== e : Array.isArray(t) ? !Wd(t, e) : !1;
}
function Xd(e = !1) {
	return {
		isActive: e,
		protectedKeys: {},
		needsAnimating: {},
		prevResolvedValues: {}
	};
}
function Zd() {
	return {
		animate: Xd(!0),
		whileInView: Xd(),
		whileHover: Xd(),
		whileTap: Xd(),
		whileDrag: Xd(),
		whileFocus: Xd(),
		exit: Xd()
	};
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/copy.mjs
function Qd(e, t) {
	e.min = t.min, e.max = t.max;
}
function $d(e, t) {
	Qd(e.x, t.x), Qd(e.y, t.y);
}
function ef(e, t) {
	e.translate = t.translate, e.scale = t.scale, e.originPoint = t.originPoint, e.origin = t.origin;
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/delta-calc.mjs
var tf = .9999, nf = 1.0001, rf = -.01, af = .01;
function of(e) {
	return e.max - e.min;
}
function sf(e, t, n) {
	return Math.abs(e - t) <= n;
}
function cf(e, t, n, r = .5) {
	e.origin = r, e.originPoint = z(t.min, t.max, e.origin), e.scale = of(n) / of(t), e.translate = z(n.min, n.max, e.origin) - e.originPoint, (e.scale >= tf && e.scale <= nf || isNaN(e.scale)) && (e.scale = 1), (e.translate >= rf && e.translate <= af || isNaN(e.translate)) && (e.translate = 0);
}
function lf(e, t, n, r) {
	cf(e.x, t.x, n.x, r ? r.originX : void 0), cf(e.y, t.y, n.y, r ? r.originY : void 0);
}
function uf(e, t, n, r = 0) {
	e.min = (r ? z(n.min, n.max, r) : n.min) + t.min, e.max = e.min + of(t);
}
function df(e, t, n, r) {
	uf(e.x, t.x, n.x, r?.x), uf(e.y, t.y, n.y, r?.y);
}
function ff(e, t, n, r = 0) {
	let i = r ? z(n.min, n.max, r) : n.min;
	e.min = t.min - i, e.max = e.min + of(t);
}
function pf(e, t, n, r) {
	ff(e.x, t.x, n.x, r?.x), ff(e.y, t.y, n.y, r?.y);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/delta-remove.mjs
function mf(e, t, n, r, i) {
	return e -= t, e = pu(e, 1 / n, r), i !== void 0 && (e = pu(e, 1 / i, r)), e;
}
function hf(e, t = 0, n = 1, r = .5, i, a = e, o = e) {
	if (lo.test(t) && (t = parseFloat(t), t = z(o.min, o.max, t / 100) - o.min), typeof t != "number") return;
	let s = z(a.min, a.max, r);
	e === a && (s -= t), e.min = mf(e.min, t, n, s, i), e.max = mf(e.max, t, n, s, i);
}
function gf(e, t, [n, r, i], a, o) {
	hf(e, t[n], t[r], t[i], t.scale, a, o);
}
var _f = [
	"x",
	"scaleX",
	"originX"
], q = [
	"y",
	"scaleY",
	"originY"
];
function vf(e, t, n, r) {
	gf(e.x, t, _f, n ? n.x : void 0, r ? r.x : void 0), gf(e.y, t, q, n ? n.y : void 0, r ? r.y : void 0);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/geometry/utils.mjs
function yf(e) {
	return e.translate === 0 && e.scale === 1;
}
function bf(e) {
	return yf(e.x) && yf(e.y);
}
function xf(e, t) {
	return e.min === t.min && e.max === t.max;
}
function Sf(e, t) {
	return xf(e.x, t.x) && xf(e.y, t.y);
}
function Cf(e, t) {
	return Math.round(e.min) === Math.round(t.min) && Math.round(e.max) === Math.round(t.max);
}
function wf(e, t) {
	return Cf(e.x, t.x) && Cf(e.y, t.y);
}
function Tf(e) {
	return of(e.x) / of(e.y);
}
function Ef(e, t) {
	return e.translate === t.translate && e.scale === t.scale && e.originPoint === t.originPoint;
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/utils/each-axis.mjs
function Df(e) {
	return [e("x"), e("y")];
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/styles/transform.mjs
function Of(e, t, n) {
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
var kf = Kl.length, Af = (e) => typeof e == "string" ? parseFloat(e) : e, jf = (e) => typeof e == "number" || R.test(e);
function Mf(e, t, n, r, i, a) {
	i ? (e.opacity = z(0, n.opacity ?? 1, Pf(r)), e.opacityExit = z(t.opacity ?? 1, 0, Ff(r))) : a && (e.opacity = z(t.opacity ?? 1, n.opacity ?? 1, r));
	for (let i = 0; i < kf; i++) {
		let a = Kl[i], o = Nf(t, a), s = Nf(n, a);
		(o !== void 0 || s !== void 0) && (o ||= 0, s ||= 0, o === 0 || s === 0 || jf(o) === jf(s) ? (e[a] = Math.max(z(Af(o), Af(s), r), 0), (lo.test(s) || lo.test(o)) && (e[a] += "%")) : e[a] = s);
	}
	(t.rotate || n.rotate) && (e.rotate = z(t.rotate || 0, n.rotate || 0, r));
}
function Nf(e, t) {
	return e[t] === void 0 ? e.borderRadius : e[t];
}
var Pf = /*@__PURE__*/ If(0, .5, xa), Ff = /*@__PURE__*/ If(.5, .95, aa);
function If(e, t, n) {
	return (r) => r < e ? 0 : r > t ? 1 : n(/* @__PURE__ */ sa(e, t, r));
}
//#endregion
//#region node_modules/motion-dom/dist/es/animation/animate/single-value.mjs
function Lf(e, t, n) {
	let r = El(e) ? e : al(e);
	return r.start(hl("", r, t, n)), r.animation;
}
//#endregion
//#region node_modules/motion-dom/dist/es/events/add-dom-event.mjs
function Rf(e, t, n, r = { passive: !0 }) {
	return e.addEventListener(t, n, r), () => e.removeEventListener(t, n, r);
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/utils/compare-by-depth.mjs
var zf = (e, t) => e.depth - t.depth, Bf = class {
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
		this.isDirty && this.children.sort(zf), this.isDirty = !1, this.children.forEach(e);
	}
};
//#endregion
//#region node_modules/motion-dom/dist/es/utils/delay.mjs
function Vf(e, t) {
	let n = Ba.now(), r = ({ timestamp: i }) => {
		let a = i - n;
		a >= t && (Fa(r), e(a - t));
	};
	return L.setup(r, !0), () => Fa(r);
}
//#endregion
//#region node_modules/motion-dom/dist/es/value/utils/resolve-motion-value.mjs
function Hf(e) {
	return El(e) ? e.get() : e;
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/shared/stack.mjs
var Uf = class {
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
}, Wf = {
	hasAnimatedSinceResize: !0,
	hasEverUpdated: !1
}, Gf = {
	nodes: 0,
	calculatedTargetDeltas: 0,
	calculatedProjections: 0
}, J = [
	"",
	"X",
	"Y",
	"Z"
], Kf = 1e3, qf = 0;
function Jf(e, t, n, r) {
	let { latestValues: i } = t;
	i[e] && (n[e] = i[e], t.setStaticValue(e, 0), r && (r[e] = 0));
}
function Yf(e) {
	if (e.hasCheckedOptimisedAppear = !0, e.root === e) return;
	let { visualElement: t } = e.options;
	if (!t) return;
	let n = jl(t);
	if (window.MotionHasOptimisedAnimation(n, "transform")) {
		let { layout: t, layoutId: r } = e.options;
		window.MotionCancelOptimisedAnimation(n, "transform", L, !(t || r));
	}
	let { parent: r } = e;
	r && !r.hasCheckedOptimisedAppear && Yf(r);
}
function Xf({ attachResizeListener: e, defaultParent: t, measureScroll: n, checkIsScrollRoot: r, resetTransform: i }) {
	return class {
		constructor(e = {}, n = t?.()) {
			this.id = qf++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = !1, this.isAnimationBlocked = !1, this.isLayoutDirty = !1, this.isProjectionDirty = !1, this.isSharedProjectionDirty = !1, this.isTransformDirty = !1, this.updateManuallyBlocked = !1, this.updateBlockedByResize = !1, this.isUpdating = !1, this.isSVG = !1, this.needsReset = !1, this.shouldResetTransform = !1, this.hasCheckedOptimisedAppear = !1, this.treeScale = {
				x: 1,
				y: 1
			}, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = !1, this.layoutVersion = 0, this.updateScheduled = !1, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = !1, this.checkUpdateFailed = () => {
				this.isUpdating && (this.isUpdating = !1, this.clearAllSnapshots());
			}, this.updateProjection = () => {
				this.projectionUpdateScheduled = !1, K.value && (Gf.nodes = Gf.calculatedTargetDeltas = Gf.calculatedProjections = 0), this.nodes.forEach($f), this.nodes.forEach(sp), this.nodes.forEach(cp), this.nodes.forEach(ep), K.addProjectionMetrics && K.addProjectionMetrics(Gf);
			}, this.resolvedRelativeTargetAt = 0, this.linkedParentVersion = 0, this.hasProjected = !1, this.isVisible = !0, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = e, this.root = n ? n.root || n : this, this.path = n ? [...n.path, n] : [], this.parent = n, this.depth = n ? n.depth + 1 : 0;
			for (let e = 0; e < this.path.length; e++) this.path[e].shouldResetTransform = !0;
			this.root === this && (this.nodes = new Bf());
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
			this.isSVG = Jl(t) && !id(t), this.instance = t;
			let { layoutId: n, layout: r, visualElement: i } = this.options;
			if (i && !i.current && i.mount(t), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (r || n) && (this.isLayoutDirty = !0), e) {
				let n, r = 0, i = () => this.root.updateBlockedByResize = !1;
				L.read(() => {
					r = window.innerWidth;
				}), e(t, () => {
					let e = window.innerWidth;
					e !== r && (r = e, this.root.updateBlockedByResize = !0, n && n(), n = Vf(i, 250), Wf.hasAnimatedSinceResize && (Wf.hasAnimatedSinceResize = !1, this.nodes.forEach(op)));
				});
			}
			n && this.root.registerSharedNode(n, this), this.options.animate !== !1 && i && (n || r) && this.addEventListener("didUpdate", ({ delta: e, hasLayoutChanged: t, hasRelativeLayoutChanged: n, layout: r }) => {
				if (this.isTreeAnimationBlocked()) {
					this.target = void 0, this.relativeTarget = void 0;
					return;
				}
				let a = this.options.transition || i.getDefaultTransition() || hp, { onLayoutAnimationStart: o, onLayoutAnimationComplete: s } = i.getProps(), c = !this.targetLayout || !wf(this.targetLayout, r), l = !t && n;
				if (this.options.layoutRoot || this.resumeFrom || l || t && (c || !this.currentAnimation)) {
					this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
					let t = {
						...sl(a, "layout"),
						onPlay: o,
						onComplete: s
					};
					(i.shouldReduceMotion || this.options.layoutRoot) && (t.delay = 0, t.type = !1), this.startAnimation(t), this.setAnimationOrigin(e, l, t.path);
				} else t || op(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
				this.targetLayout = r;
			});
		}
		unmount() {
			this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
			let e = this.getStack();
			e && e.remove(this), this.parent && this.parent.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), Fa(this.updateProjection);
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
			this.isUpdateBlocked() || (this.isUpdating = !0, this.nodes && this.nodes.forEach(lp), this.animationId++);
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
			if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && Yf(this), !this.root.isUpdating && this.root.startUpdate(), this.isLayoutDirty) return;
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
				this.unblockUpdate(), this.updateBlockedByResize = !1, this.clearAllSnapshots(), e && this.nodes.forEach(rp), this.nodes.forEach(np);
				return;
			}
			if (this.animationId <= this.animationCommitId) {
				this.nodes.forEach(ip);
				return;
			}
			this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = !1, this.nodes.forEach(Y), this.nodes.forEach(ap), this.nodes.forEach(Zf), this.nodes.forEach(Qf)) : this.nodes.forEach(ip), this.clearAllSnapshots();
			let e = Ba.now();
			Ia.delta = $i(0, 1e3 / 60, e - Ia.timestamp), Ia.timestamp = e, Ia.isProcessing = !0, La.update.process(Ia), La.preRender.process(Ia), La.render.process(Ia), Ia.isProcessing = !1;
		}
		didUpdate() {
			this.updateScheduled || (this.updateScheduled = !0, Eu.read(this.scheduleUpdate));
		}
		clearAllSnapshots() {
			this.nodes.forEach(tp), this.sharedNodes.forEach(up);
		}
		scheduleUpdateProjection() {
			this.projectionUpdateScheduled || (this.projectionUpdateScheduled = !0, L.preRender(this.updateProjection, !1, !0));
		}
		scheduleCheckAfterUnmount() {
			L.postRender(() => {
				this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
			});
		}
		updateSnapshot() {
			!this.snapshot && this.instance && (this.snapshot = this.measure(), this.snapshot && !of(this.snapshot.measuredBox.x) && !of(this.snapshot.measuredBox.y) && (this.snapshot = void 0));
		}
		updateLayout() {
			if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)) return;
			if (this.resumeFrom && !this.resumeFrom.instance) for (let e = 0; e < this.path.length; e++) this.path[e].updateScroll();
			let e = this.layout;
			this.layout = this.measure(!1), this.layoutVersion++, this.layoutCorrected ||= cd(), this.isLayoutDirty = !1, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
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
			let e = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout, t = this.projectionDelta && !bf(this.projectionDelta), n = this.getTransformTemplate(), r = n ? n(this.latestValues, "") : void 0, a = r !== this.prevTransformTemplateValue;
			e && this.instance && (t || uu(this.latestValues) || a) && (i(this.instance, r), this.shouldResetTransform = !1, this.scheduleRender());
		}
		measure(e = !0) {
			let t = this.measurePageBox(), n = this.removeElementScroll(t);
			return e && (n = this.removeTransform(n)), yp(n), {
				animationId: this.root.animationId,
				measuredBox: t,
				layoutBox: n,
				latestValues: {},
				source: this.id
			};
		}
		measurePageBox() {
			let { visualElement: e } = this.options;
			if (!e) return cd();
			let t = e.measureViewportBox();
			if (!(this.scroll?.wasRoot || this.path.some(xp))) {
				let { scroll: e } = this.root;
				e && (bu(t.x, e.offset.x), bu(t.y, e.offset.y));
			}
			return t;
		}
		removeElementScroll(e) {
			let t = cd();
			if ($d(t, e), this.scroll?.wasRoot) return t;
			for (let n = 0; n < this.path.length; n++) {
				let r = this.path[n], { scroll: i, options: a } = r;
				r !== this.root && i && a.layoutScroll && (i.wasRoot && $d(t, e), bu(t.x, i.offset.x), bu(t.y, i.offset.y));
			}
			return t;
		}
		applyTransform(e, t = !1, n) {
			let r = n || cd();
			$d(r, e);
			for (let e = 0; e < this.path.length; e++) {
				let n = this.path[e];
				!t && n.options.layoutScroll && n.scroll && n !== n.root && (bu(r.x, -n.scroll.offset.x), bu(r.y, -n.scroll.offset.y)), uu(n.latestValues) && Cu(r, n.latestValues, n.layout?.layoutBox);
			}
			return uu(this.latestValues) && Cu(r, this.latestValues, this.layout?.layoutBox), r;
		}
		removeTransform(e) {
			let t = cd();
			$d(t, e);
			for (let e = 0; e < this.path.length; e++) {
				let n = this.path[e];
				if (!uu(n.latestValues)) continue;
				let r;
				n.instance && (lu(n.latestValues) && n.updateSnapshot(), r = cd(), $d(r, n.measurePageBox())), vf(t, n.latestValues, n.snapshot?.layoutBox, r);
			}
			return uu(this.latestValues) && vf(t, this.latestValues), t;
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
			this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== Ia.timestamp && this.relativeParent.resolveTargetDelta(!0);
		}
		resolveTargetDelta(e = !1) {
			let t = this.getLead();
			this.isProjectionDirty ||= t.isProjectionDirty, this.isTransformDirty ||= t.isTransformDirty, this.isSharedProjectionDirty ||= t.isSharedProjectionDirty;
			let n = !!this.resumingFrom || this !== t;
			if (!(e || n && this.isSharedProjectionDirty || this.isProjectionDirty || this.parent?.isProjectionDirty || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize)) return;
			let { layout: r, layoutId: i } = this.options;
			if (!this.layout || !(r || i)) return;
			this.resolvedRelativeTargetAt = Ia.timestamp;
			let a = this.getClosestProjectingParent();
			a && this.linkedParentVersion !== a.layoutVersion && !a.options.layoutRoot && this.removeRelativeTarget(), !this.targetDelta && !this.relativeTarget && (this.options.layoutAnchor !== !1 && a && a.layout ? this.createRelativeTarget(a, this.layout.layoutBox, a.layout.layoutBox) : this.removeRelativeTarget()), (this.relativeTarget || this.targetDelta) && (this.target || (this.target = cd(), this.targetWithTransforms = cd()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target ? (this.forceRelativeParentToResolveTarget(), df(this.target, this.relativeTarget, this.relativeParent.target, this.options.layoutAnchor || void 0)) : this.targetDelta ? (this.resumingFrom ? this.applyTransform(this.layout.layoutBox, !1, this.target) : $d(this.target, this.layout.layoutBox), gu(this.target, this.targetDelta)) : $d(this.target, this.layout.layoutBox), this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = !1, this.options.layoutAnchor !== !1 && a && !!a.resumingFrom == !!this.resumingFrom && !a.options.layoutScroll && a.target && this.animationProgress !== 1 ? this.createRelativeTarget(a, this.target, a.target) : this.relativeParent = this.relativeTarget = void 0), K.value && Gf.calculatedTargetDeltas++);
		}
		getClosestProjectingParent() {
			if (!(!this.parent || lu(this.parent.latestValues) || du(this.parent.latestValues))) return this.parent.isProjecting() ? this.parent : this.parent.getClosestProjectingParent();
		}
		isProjecting() {
			return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
		}
		createRelativeTarget(e, t, n) {
			this.relativeParent = e, this.linkedParentVersion = e.layoutVersion, this.forceRelativeParentToResolveTarget(), this.relativeTarget = cd(), this.relativeTargetOrigin = cd(), pf(this.relativeTargetOrigin, t, n, this.options.layoutAnchor || void 0), $d(this.relativeTarget, this.relativeTargetOrigin);
		}
		removeRelativeTarget() {
			this.relativeParent = this.relativeTarget = void 0;
		}
		calcProjection() {
			let e = this.getLead(), t = !!this.resumingFrom || this !== e, n = !0;
			if ((this.isProjectionDirty || this.parent?.isProjectionDirty) && (n = !1), t && (this.isSharedProjectionDirty || this.isTransformDirty) && (n = !1), this.resolvedRelativeTargetAt === Ia.timestamp && (n = !1), n) return;
			let { layout: r, layoutId: i } = this.options;
			if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(r || i)) return;
			$d(this.layoutCorrected, this.layout.layoutBox);
			let a = this.treeScale.x, o = this.treeScale.y;
			yu(this.layoutCorrected, this.treeScale, this.path, t), e.layout && !e.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1) && (e.target = e.layout.layoutBox, e.targetWithTransforms = cd());
			let { target: s } = e;
			if (!s) {
				this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
				return;
			}
			!this.projectionDelta || !this.prevProjectionDelta ? this.createProjectionDeltas() : (ef(this.prevProjectionDelta.x, this.projectionDelta.x), ef(this.prevProjectionDelta.y, this.projectionDelta.y)), lf(this.projectionDelta, this.layoutCorrected, s, this.latestValues), (this.treeScale.x !== a || this.treeScale.y !== o || !Ef(this.projectionDelta.x, this.prevProjectionDelta.x) || !Ef(this.projectionDelta.y, this.prevProjectionDelta.y)) && (this.hasProjected = !0, this.scheduleRender(), this.notifyListeners("projectionUpdate", s)), K.value && Gf.calculatedProjections++;
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
			this.prevProjectionDelta = od(), this.projectionDelta = od(), this.projectionDeltaWithTransform = od();
		}
		setAnimationOrigin(e, t = !1, n) {
			let r = this.snapshot, i = r ? r.latestValues : {}, a = { ...this.latestValues }, o = od();
			(!this.relativeParent || !this.relativeParent.options.layoutRoot) && (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !t;
			let s = cd(), c = (r ? r.source : void 0) !== (this.layout ? this.layout.source : void 0), l = this.getStack(), u = !l || l.members.length <= 1, d = !(!c || u || this.options.crossfade !== !0 || this.path.some(mp));
			this.animationProgress = 0;
			let f, p = n?.interpolateProjection(e);
			this.mixTargetDelta = (t) => {
				let n = t / 1e3, r = p?.(n);
				r ? (o.x.translate = r.x, o.x.scale = z(e.x.scale, 1, n), o.x.origin = e.x.origin, o.x.originPoint = e.x.originPoint, o.y.translate = r.y, o.y.scale = z(e.y.scale, 1, n), o.y.origin = e.y.origin, o.y.originPoint = e.y.originPoint) : (dp(o.x, e.x, n), dp(o.y, e.y, n)), this.setTargetDelta(o), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout && (pf(s, this.layout.layoutBox, this.relativeParent.layout.layoutBox, this.options.layoutAnchor || void 0), pp(this.relativeTarget, this.relativeTargetOrigin, s, n), f && Sf(this.relativeTarget, f) && (this.isProjectionDirty = !1), f ||= cd(), $d(f, this.relativeTarget)), c && (this.animationValues = a, Mf(a, i, this.latestValues, n, d, u)), r && r.rotate !== void 0 && (this.animationValues ||= a, this.animationValues.pathRotation = r.rotate), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = n;
			}, this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
		}
		startAnimation(e) {
			this.notifyListeners("animationStart"), this.currentAnimation?.stop(), this.resumingFrom?.currentAnimation?.stop(), this.pendingAnimation &&= (Fa(this.pendingAnimation), void 0), this.pendingAnimation = L.update(() => {
				Wf.hasAnimatedSinceResize = !0, this.motionValue ||= al(0), this.motionValue.jump(0, !1), this.currentAnimation = Lf(this.motionValue, [0, 1e3], {
					...e,
					velocity: 0,
					isSync: !0,
					onUpdate: (t) => {
						this.mixTargetDelta(t), e.onUpdate && e.onUpdate(t);
					},
					onComplete: () => {
						e.onComplete && e.onComplete(), this.completeAnimation();
					}
				}), Ms(this.currentAnimation, this), this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation), this.pendingAnimation = void 0;
			});
		}
		completeAnimation() {
			this.resumingFrom && (this.resumingFrom.currentAnimation = void 0, this.resumingFrom.preserveOpacity = void 0);
			let e = this.getStack();
			e && e.exitAnimationComplete(), this.resumingFrom = this.currentAnimation = this.animationValues = void 0, this.notifyListeners("animationComplete");
		}
		finishAnimation() {
			this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(Kf), this.currentAnimation.stop()), this.completeAnimation();
		}
		applyTransformsToTarget() {
			let e = this.getLead(), { targetWithTransforms: t, layout: n, latestValues: r } = e, { target: i } = e;
			if (t && i && n) {
				if (this !== e && this.layout && n && bp(this.options.animationType, this.layout.layoutBox, n.layoutBox)) {
					i = this.target || cd();
					let t = of(this.layout.layoutBox.x);
					i.x.min = e.target.x.min, i.x.max = i.x.min + t;
					let n = of(this.layout.layoutBox.y);
					i.y.min = e.target.y.min, i.y.max = i.y.min + n;
				}
				$d(t, i), Cu(t, r), lf(this.projectionDeltaWithTransform, this.layoutCorrected, t, r);
			}
		}
		registerSharedNode(e, t) {
			this.sharedNodes.has(e) || this.sharedNodes.set(e, new Uf()), this.sharedNodes.get(e).add(t);
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
			n.z && Jf("z", e, r, this.animationValues);
			for (let t = 0; t < J.length; t++) Jf(`rotate${J[t]}`, e, r, this.animationValues), Jf(`skew${J[t]}`, e, r, this.animationValues);
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
				this.needsReset = !1, e.visibility = "", e.opacity = "", e.pointerEvents = Hf(t?.pointerEvents) || "", e.transform = n ? n(this.latestValues, "") : "none";
				return;
			}
			let r = this.getLead();
			if (!this.projectionDelta || !this.layout || !r.target) {
				this.options.layoutId && (e.opacity = this.latestValues.opacity === void 0 ? 1 : this.latestValues.opacity, e.pointerEvents = Hf(t?.pointerEvents) || ""), this.hasProjected && !uu(this.latestValues) && (e.transform = n ? n({}, "") : "none", this.hasProjected = !1);
				return;
			}
			e.visibility = "";
			let i = r.animationValues || r.latestValues;
			this.applyTransformsToTarget();
			let a = Of(this.projectionDeltaWithTransform, this.treeScale, i);
			n && (a = n(i, a)), e.transform = a;
			let { x: o, y: s } = this.projectionDelta;
			e.transformOrigin = `${o.origin * 100}% ${s.origin * 100}% 0`, e.opacity = r.animationValues ? r === this ? i.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : i.opacityExit : r === this ? i.opacity === void 0 ? "" : i.opacity : i.opacityExit === void 0 ? 0 : i.opacityExit;
			for (let t in Md) {
				if (i[t] === void 0) continue;
				let { correct: n, applyTo: o, isCSSVariable: s } = Md[t], c = a === "none" ? i[t] : n(i[t], r);
				if (o) {
					let t = o.length;
					for (let n = 0; n < t; n++) e[o[n]] = c;
				} else s ? this.options.visualElement.renderState.vars[t] = c : e[t] = c;
			}
			this.options.layoutId && (e.pointerEvents = r === this ? Hf(t?.pointerEvents) || "" : "none");
		}
		clearSnapshot() {
			this.resumeFrom = this.snapshot = void 0;
		}
		resetTree() {
			this.root.nodes.forEach((e) => e.currentAnimation?.stop()), this.root.nodes.forEach(np), this.root.sharedNodes.clear();
		}
	};
}
function Zf(e) {
	e.updateLayout();
}
function Qf(e) {
	let t = e.resumeFrom?.snapshot || e.snapshot;
	if (e.isLead() && e.layout && t && e.hasListeners("didUpdate")) {
		let { layoutBox: n, measuredBox: r } = e.layout, { animationType: i } = e.options, a = t.source !== e.layout.source;
		if (i === "size") Df((e) => {
			let r = a ? t.measuredBox[e] : t.layoutBox[e], i = of(r);
			r.min = n[e].min, r.max = r.min + i;
		});
		else if (i === "x" || i === "y") {
			let e = i === "x" ? "y" : "x";
			Qd(a ? t.measuredBox[e] : t.layoutBox[e], n[e]);
		} else bp(i, t.layoutBox, n) && Df((r) => {
			let i = a ? t.measuredBox[r] : t.layoutBox[r], o = of(n[r]);
			i.max = i.min + o, e.relativeTarget && !e.currentAnimation && (e.isProjectionDirty = !0, e.relativeTarget[r].max = e.relativeTarget[r].min + o);
		});
		let o = od();
		lf(o, n, t.layoutBox);
		let s = od();
		a ? lf(s, e.applyTransform(r, !0), t.measuredBox) : lf(s, n, t.layoutBox);
		let c = !bf(o), l = !1;
		if (!e.resumeFrom) {
			let r = e.getClosestProjectingParent();
			if (r && !r.resumeFrom) {
				let { snapshot: i, layout: a } = r;
				if (i && a) {
					let o = e.options.layoutAnchor || void 0, s = cd();
					pf(s, t.layoutBox, i.layoutBox, o);
					let c = cd();
					pf(c, n, a.layoutBox, o), wf(s, c) || (l = !0), r.options.layoutRoot && (e.relativeTarget = c, e.relativeTargetOrigin = s, e.relativeParent = r);
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
function $f(e) {
	K.value && Gf.nodes++, e.parent && (e.isProjecting() || (e.isProjectionDirty = e.parent.isProjectionDirty), e.isSharedProjectionDirty ||= !!(e.isProjectionDirty || e.parent.isProjectionDirty || e.parent.isSharedProjectionDirty), e.isTransformDirty ||= e.parent.isTransformDirty);
}
function ep(e) {
	e.isProjectionDirty = e.isSharedProjectionDirty = e.isTransformDirty = !1;
}
function tp(e) {
	e.clearSnapshot();
}
function np(e) {
	e.clearMeasurements();
}
function rp(e) {
	e.isLayoutDirty = !0, e.updateLayout();
}
function ip(e) {
	e.isLayoutDirty = !1;
}
function Y(e) {
	e.isAnimationBlocked && e.layout && !e.isLayoutDirty && (e.snapshot = e.layout, e.isLayoutDirty = !0);
}
function ap(e) {
	let { visualElement: t } = e.options;
	t && t.getProps().onBeforeLayoutMeasure && t.notify("BeforeLayoutMeasure"), e.resetTransform();
}
function op(e) {
	e.finishAnimation(), e.targetDelta = e.relativeTarget = e.target = void 0, e.isProjectionDirty = !0;
}
function sp(e) {
	e.resolveTargetDelta();
}
function cp(e) {
	e.calcProjection();
}
function lp(e) {
	e.resetSkewAndRotation();
}
function up(e) {
	e.removeLeadSnapshot();
}
function dp(e, t, n) {
	e.translate = z(t.translate, 0, n), e.scale = z(t.scale, 1, n), e.origin = t.origin, e.originPoint = t.originPoint;
}
function fp(e, t, n, r) {
	e.min = z(t.min, n.min, r), e.max = z(t.max, n.max, r);
}
function pp(e, t, n, r) {
	fp(e.x, t.x, n.x, r), fp(e.y, t.y, n.y, r);
}
function mp(e) {
	return e.animationValues && e.animationValues.opacityExit !== void 0;
}
var hp = {
	duration: .45,
	ease: [
		.4,
		0,
		.1,
		1
	]
}, gp = (e) => typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(e), _p = gp("applewebkit/") && !gp("chrome/") ? Math.round : aa;
function vp(e) {
	e.min = _p(e.min), e.max = _p(e.max);
}
function yp(e) {
	vp(e.x), vp(e.y);
}
function bp(e, t, n) {
	return e === "position" || e === "preserve-aspect" && !sf(Tf(t), Tf(n), .2);
}
function xp(e) {
	return e !== e.root && e.scroll?.wasRoot;
}
//#endregion
//#region node_modules/motion-dom/dist/es/projection/node/DocumentProjectionNode.mjs
var Sp = Xf({
	attachResizeListener: (e, t) => Rf(e, "resize", t),
	measureScroll: () => ({
		x: document.documentElement.scrollLeft || document.body?.scrollLeft || 0,
		y: document.documentElement.scrollTop || document.body?.scrollTop || 0
	}),
	checkIsScrollRoot: () => !0
}), Cp = { current: void 0 }, wp = Xf({
	measureScroll: (e) => ({
		x: e.scrollLeft,
		y: e.scrollTop
	}),
	defaultParent: () => {
		if (!Cp.current) {
			let e = new Sp({});
			e.mount(window), e.setOptions({ layoutScroll: !0 }), Cp.current = e;
		}
		return Cp.current;
	},
	resetTransform: (e, t) => {
		e.style.transform = t === void 0 ? "none" : t;
	},
	checkIsScrollRoot: (e) => window.getComputedStyle(e).position === "fixed"
}), Tp = (0, _.createContext)({
	transformPagePoint: (e) => e,
	isStatic: !1,
	reducedMotion: "never"
});
//#endregion
//#region node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs
function Ep(e = !0) {
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
var Dp = (0, _.createContext)({ strict: !1 }), Op = {
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
}, kp = !1;
function Ap() {
	if (kp) return;
	let e = {};
	for (let t in Op) e[t] = { isEnabled: (e) => Op[t].some((t) => !!e[t]) };
	Cd(e), kp = !0;
}
function jp() {
	return Ap(), wd();
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/features/load-features.mjs
function Mp(e) {
	let t = jp();
	for (let n in e) t[n] = {
		...t[n],
		...e[n]
	};
	Cd(t);
}
//#endregion
//#region node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs
var X = Ki();
function Np({ children: e, ...t }) {
	let n = (0, _.useContext)(Tp);
	t = {
		...n,
		...t
	}, t.transition = ol(t.transition, n.transition), t.isStatic = Ji(() => t.isStatic);
	let r = (0, _.useMemo)(() => t, [
		JSON.stringify(t.transition),
		t.transformPagePoint,
		t.reducedMotion,
		t.skipAnimations,
		t.isValidProp
	]);
	return (0, X.jsx)(Tp.Provider, {
		value: r,
		children: e
	});
}
//#endregion
//#region node_modules/framer-motion/dist/es/context/MotionContext/index.mjs
var Pp = /* @__PURE__ */ (0, _.createContext)({});
//#endregion
//#region node_modules/framer-motion/dist/es/context/MotionContext/utils.mjs
function Fp(e, t) {
	if (md(e)) {
		let { initial: t, animate: n } = e;
		return {
			initial: t === !1 || dd(t) ? t : void 0,
			animate: dd(n) ? n : void 0
		};
	}
	return e.inherit === !1 ? {} : t;
}
//#endregion
//#region node_modules/framer-motion/dist/es/context/MotionContext/create.mjs
function Ip(e) {
	let { initial: t, animate: n } = Fp(e, (0, _.useContext)(Pp));
	return (0, _.useMemo)(() => ({
		initial: t,
		animate: n
	}), [Lp(t), Lp(n)]);
}
function Lp(e) {
	return Array.isArray(e) ? e.join(" ") : e;
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/html/utils/create-render-state.mjs
var Rp = () => ({
	style: {},
	transform: {},
	transformOrigin: {},
	vars: {}
});
//#endregion
//#region node_modules/framer-motion/dist/es/render/html/use-props.mjs
function zp(e, t, n) {
	for (let r in t) !El(t[r]) && !Nd(r, n) && (e[r] = t[r]);
}
function Bp({ transformTemplate: e }, t) {
	return (0, _.useMemo)(() => {
		let n = Rp();
		return eu(n, t, e), Object.assign({}, n.vars, n.style);
	}, [t]);
}
function Vp(e, t) {
	let n = e.style || {}, r = {};
	return zp(r, n, e), Object.assign(r, Bp(e, t)), r;
}
function Hp(e, t) {
	let n = {}, r = Vp(e, t);
	return e.drag && e.dragListener !== !1 && (n.draggable = !1, r.userSelect = r.WebkitUserSelect = r.WebkitTouchCallout = "none", r.touchAction = e.drag === !0 ? "none" : `pan-${e.drag === "x" ? "y" : "x"}`), e.tabIndex === void 0 && (e.onTap || e.onTapStart || e.whileTap) && (n.tabIndex = 0), n.style = r, n;
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/svg/utils/create-render-state.mjs
var Up = () => ({
	...Rp(),
	attrs: {}
});
//#endregion
//#region node_modules/framer-motion/dist/es/render/svg/use-props.mjs
function Wp(e, t, n, r) {
	let i = (0, _.useMemo)(() => {
		let n = Up();
		return au(n, t, Rd(r), e.transformTemplate, e.style), {
			...n.attrs,
			style: { ...n.style }
		};
	}, [t]);
	if (e.style) {
		let t = {};
		zp(t, e.style, e), i.style = {
			...t,
			...i.style
		};
	}
	return i;
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/utils/valid-prop.mjs
var Gp = /* @__PURE__ */ new Set(/* @__PURE__ */ "animate.exit.variants.initial.style.values.variants.transition.transformTemplate.custom.inherit.onBeforeLayoutMeasure.onAnimationStart.onAnimationComplete.onUpdate.onDragStart.onDrag.onDragEnd.onMeasureDragConstraints.onDirectionLock.onDragTransitionEnd._dragX._dragY.onHoverStart.onHoverEnd.onViewportEnter.onViewportLeave.globalTapTarget.propagate.ignoreStrict.viewport".split("."));
function Kp(e) {
	return e.startsWith("while") || e.startsWith("drag") && e !== "draggable" || e.startsWith("layout") || e.startsWith("onTap") || e.startsWith("onPan") || e.startsWith("onLayout") || Gp.has(e);
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/dom/utils/filter-props.mjs
function qp(e, t) {
	return e.startsWith("on") ? !Kp(e) : t?.(e) ?? !Kp(e);
}
function Jp(e, t, n, r) {
	let i = {};
	for (let a in e) (a !== "values" || typeof e.values != "object") && (El(e[a]) || (qp(a, r) || n === !0 && Kp(a) || !t && !Kp(a) || e.draggable && a.startsWith("onDrag")) && (i[a] = e[a]));
	return i;
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/svg/lowercase-elements.mjs
var Yp = [
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
function Xp(e) {
	return typeof e != "string" || e.includes("-") ? !1 : !!(Yp.indexOf(e) > -1 || /[A-Z]/u.test(e));
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/dom/use-render.mjs
function Zp(e, t, n, { latestValues: r }, i, a = !1, o, s) {
	let c = (o ?? Xp(e) ? Wp : Hp)(t, r, i, e), l = Jp(t, typeof e == "string", a, s), u = e === _.Fragment ? {} : {
		...l,
		...c,
		ref: n
	}, { children: d } = t, f = (0, _.useMemo)(() => El(d) ? d.get() : d, [d]);
	return (0, _.createElement)(e, {
		...u,
		children: f
	});
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs
function Qp({ scrapeMotionValuesFromProps: e, createRenderState: t }, n, r, i) {
	return {
		latestValues: $p(n, r, i, e),
		renderState: t()
	};
}
function $p(e, t, n, r) {
	let i = {}, a = r(e, {});
	for (let e in a) i[e] = Hf(a[e]);
	let { initial: o, animate: s } = e, c = md(e), l = hd(e);
	t && l && !c && e.inherit !== !1 && (o === void 0 && (o = t.initial), s === void 0 && (s = t.animate));
	let u = n ? n.initial === !1 : !1;
	u ||= o === !1;
	let d = u ? s : o;
	if (d && typeof d != "boolean" && !ud(d)) {
		let t = Array.isArray(d) ? d : [d];
		for (let n = 0; n < t.length; n++) {
			let r = bl(e, t[n]);
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
var em = (e) => (t, n) => {
	let r = (0, _.useContext)(Pp), i = (0, _.useContext)(Xi), a = () => Qp(e, t, r, i);
	return n ? a() : Ji(a);
}, tm = /*@__PURE__*/ em({
	scrapeMotionValuesFromProps: Pd,
	createRenderState: Rp
}), nm = /*@__PURE__*/ em({
	scrapeMotionValuesFromProps: Bd,
	createRenderState: Up
}), rm = Symbol.for("motionComponentSymbol");
//#endregion
//#region node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs
function im(e, t, n) {
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
var am = (0, _.createContext)({});
//#endregion
//#region node_modules/framer-motion/dist/es/utils/is-ref-object.mjs
function om(e) {
	return e && typeof e == "object" && Object.prototype.hasOwnProperty.call(e, "current");
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs
function sm(e, t, n, r, i, a) {
	let { visualElement: o } = (0, _.useContext)(Pp), s = (0, _.useContext)(Dp), c = (0, _.useContext)(Xi), l = (0, _.useContext)(Tp), u = l.reducedMotion, d = l.skipAnimations, f = (0, _.useRef)(null), p = (0, _.useRef)(!1);
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
	let m = f.current, h = (0, _.useContext)(am);
	m && !m.projection && i && (m.type === "html" || m.type === "svg") && cm(f.current, n, i, h);
	let g = (0, _.useRef)(!1);
	(0, _.useInsertionEffect)(() => {
		m && g.current && m.update(n, c);
	});
	let v = n[Al], y = (0, _.useRef)(!!v && typeof window < "u" && !window.MotionHandoffIsComplete?.(v) && window.MotionHasOptimisedAnimation?.(v));
	return Yi(() => {
		p.current = !0, m && (g.current = !0, window.MotionIsMounted = !0, m.updateFeatures(), m.scheduleRenderMicrotask(), y.current && m.animationState && m.animationState.animateChanges());
	}), (0, _.useEffect)(() => {
		m && (!y.current && m.animationState && m.animationState.animateChanges(), y.current &&= (queueMicrotask(() => {
			window.MotionHandoffMarkAsComplete?.(v);
		}), !1), m.enteringChildren = void 0);
	}), m;
}
function cm(e, t, n, r) {
	let { layoutId: i, layout: a, drag: o, dragConstraints: s, layoutScroll: c, layoutRoot: l, layoutAnchor: u, layoutCrossfade: d } = t;
	e.projection = new n(e.latestValues, t["data-framer-portal-id"] ? void 0 : lm(e.parent)), e.projection.setOptions({
		layoutId: i,
		layout: a,
		alwaysMeasureLayout: !!o || s && om(s),
		visualElement: e,
		animationType: typeof a == "string" ? a : "both",
		initialPromotionConfig: r,
		crossfade: d,
		layoutScroll: c,
		layoutRoot: l,
		layoutAnchor: u
	});
}
function lm(e) {
	if (e) return e.options.allowProjection === !1 ? lm(e.parent) : e.projection;
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/index.mjs
function um(e, { forwardMotionProps: t = !1, type: n } = {}, r, i) {
	r && Mp(r);
	let a = n ? n === "svg" : Xp(e), o = a ? nm : tm;
	function s(n, s) {
		let c, l = {
			...(0, _.useContext)(Tp),
			...n,
			layoutId: dm(n)
		}, { isStatic: u, isValidProp: d } = l, f = Ip(n), p = o(n, u);
		if (!u && typeof window < "u") {
			fm(l, r);
			let t = pm(l);
			c = t.MeasureLayout, f.visualElement = sm(e, p, l, i, t.ProjectionNode, a);
		}
		return (0, X.jsxs)(Pp.Provider, {
			value: f,
			children: [c && f.visualElement ? (0, X.jsx)(c, {
				visualElement: f.visualElement,
				...l
			}) : null, Zp(e, n, im(p, f.visualElement, s), p, u, t, a, d)]
		});
	}
	s.displayName = `motion.${typeof e == "string" ? e : `create(${e.displayName ?? e.name ?? ""})`}`;
	let c = (0, _.forwardRef)(s);
	return c[rm] = e, c;
}
function dm({ layoutId: e }) {
	let t = (0, _.useContext)(qi).id;
	return t && e !== void 0 ? t + "-" + e : e;
}
function fm(e, t) {
	(0, _.useContext)(Dp).strict;
}
function pm(e) {
	let { drag: t, layout: n } = jp();
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
function mm(e, t) {
	if (typeof Proxy > "u") return um;
	let n = /* @__PURE__ */ new Map(), r = (n, r) => um(n, r, e, t);
	return new Proxy((e, t) => r(e, t), { get: (i, a) => a === "create" ? r : (n.has(a) || n.set(a, um(a, void 0, e, t)), n.get(a)) });
}
//#endregion
//#region node_modules/framer-motion/dist/es/render/dom/create-visual-element.mjs
var hm = (e, t) => t.isSVG ?? Xp(e) ? new Vd(t) : new Id(t, { allowProjection: e !== _.Fragment }), gm = class extends Dd {
	constructor(e) {
		super(e), e.animationState ||= Jd(e);
	}
	updateAnimationControlsSubscription() {
		let { animate: e } = this.node.getProps();
		ud(e) && (this.unmountControls = e.subscribe(this.node));
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
}, _m = 0, vm = {
	animation: { Feature: gm },
	exit: { Feature: class extends Dd {
		constructor() {
			super(...arguments), this.id = _m++, this.isExitComplete = !1;
		}
		update() {
			if (!this.node.presenceContext) return;
			let { isPresent: e, onExitComplete: t } = this.node.presenceContext, { isPresent: n } = this.node.prevPresenceContext || {};
			if (!this.node.animationState || e === n) return;
			if (e && n === !1) {
				if (this.isExitComplete) {
					let { initial: e, custom: t } = this.node.getProps();
					if (typeof e == "string" || typeof e == "object" && e && !Array.isArray(e)) {
						let n = V(this.node, e, t);
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
function ym(e) {
	return { point: {
		x: e.pageX,
		y: e.pageY
	} };
}
var bm = (e) => (t) => Fu(t) && e(t, ym(t));
//#endregion
//#region node_modules/framer-motion/dist/es/events/add-pointer-event.mjs
function xm(e, t, n, r) {
	return Rf(e, t, bm(n), r);
}
//#endregion
//#region node_modules/framer-motion/dist/es/utils/get-context-window.mjs
var Sm = ({ current: e }) => e ? e.ownerDocument.defaultView : null, Cm = (e, t) => Math.abs(e - t);
function wm(e, t) {
	let n = Cm(e.x, t.x), r = Cm(e.y, t.y);
	return Math.sqrt(n ** 2 + r ** 2);
}
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/pan/PanSession.mjs
var Tm = /*#__PURE__*/ new Set(["auto", "scroll"]), Em = class {
	constructor(e, t, { transformPagePoint: n, contextWindow: r = window, dragSnapToOrigin: i = !1, distanceThreshold: a = 3, element: o } = {}) {
		if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = /* @__PURE__ */ new Map(), this.removeScrollListeners = null, this.onElementScroll = (e) => {
			this.handleScroll(e.target);
		}, this.onWindowScroll = () => {
			this.handleScroll(window);
		}, this.updatePoint = () => {
			if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
			this.lastRawMoveEventInfo && (this.lastMoveEventInfo = Dm(this.lastRawMoveEventInfo, this.transformPagePoint));
			let e = km(this.lastMoveEventInfo, this.history), t = this.startEvent !== null, n = wm(e.offset, {
				x: 0,
				y: 0
			}) >= this.distanceThreshold;
			if (!t && !n) return;
			let { point: r } = e, { timestamp: i } = Ia;
			this.history.push({
				...r,
				timestamp: i
			});
			let { onStart: a, onMove: o } = this.handlers;
			t || (a && a(this.lastMoveEvent, e), this.startEvent = this.lastMoveEvent), o && o(this.lastMoveEvent, e);
		}, this.handlePointerMove = (e, t) => {
			this.lastMoveEvent = e, this.lastRawMoveEventInfo = t, this.lastMoveEventInfo = Dm(t, this.transformPagePoint), L.update(this.updatePoint, !0);
		}, this.handlePointerUp = (e, t) => {
			this.end();
			let { onEnd: n, onSessionEnd: r, resumeAnimation: i } = this.handlers;
			if ((this.dragSnapToOrigin || !this.startEvent) && i && i(), !(this.lastMoveEvent && this.lastMoveEventInfo)) return;
			let a = km(e.type === "pointercancel" ? this.lastMoveEventInfo : Dm(t, this.transformPagePoint), this.history);
			this.startEvent && n && n(e, a), r && r(e, a);
		}, !Fu(e)) return;
		this.dragSnapToOrigin = i, this.handlers = t, this.transformPagePoint = n, this.distanceThreshold = a, this.contextWindow = r || window;
		let s = Dm(ym(e), this.transformPagePoint), { point: c } = s, { timestamp: l } = Ia;
		this.history = [{
			...c,
			timestamp: l
		}];
		let { onSessionStart: u } = t;
		u && u(e, km(s, this.history));
		let d = {
			passive: !0,
			capture: !0
		};
		this.removeListeners = oa(xm(this.contextWindow, "pointermove", this.handlePointerMove, d), xm(this.contextWindow, "pointerup", this.handlePointerUp, d), xm(this.contextWindow, "pointercancel", this.handlePointerUp, d)), o && this.startScrollTracking(o);
	}
	startScrollTracking(e) {
		let t = e.parentElement;
		for (; t;) {
			let e = getComputedStyle(t);
			(Tm.has(e.overflowX) || Tm.has(e.overflowY)) && this.scrollPositions.set(t, {
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
		(i.x !== 0 || i.y !== 0) && (n ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += i.x, this.lastMoveEventInfo.point.y += i.y) : this.history.length > 0 && (this.history[0].x -= i.x, this.history[0].y -= i.y), this.scrollPositions.set(e, r), L.update(this.updatePoint, !0));
	}
	updateHandlers(e) {
		this.handlers = e;
	}
	end() {
		this.removeListeners && this.removeListeners(), this.removeScrollListeners && this.removeScrollListeners(), this.scrollPositions.clear(), Fa(this.updatePoint);
	}
};
function Dm(e, t) {
	return t ? { point: t(e.point) } : e;
}
function Om(e, t) {
	return {
		x: e.x - t.x,
		y: e.y - t.y
	};
}
function km({ point: e }, t) {
	return {
		point: e,
		delta: Om(e, jm(t)),
		offset: Om(e, Am(t)),
		velocity: Mm(t, .1)
	};
}
function Am(e) {
	return e[0];
}
function jm(e) {
	return e[e.length - 1];
}
function Mm(e, t) {
	if (e.length < 2) return {
		x: 0,
		y: 0
	};
	let n = e.length - 1, r = null, i = jm(e);
	for (; n >= 0 && (r = e[n], !(i.timestamp - r.timestamp > /* @__PURE__ */ P(t)));) n--;
	if (!r) return {
		x: 0,
		y: 0
	};
	r === e[0] && e.length > 2 && i.timestamp - r.timestamp > /* @__PURE__ */ P(t) * 2 && (r = e[1]);
	let a = /* @__PURE__ */ F(i.timestamp - r.timestamp);
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
function Nm(e, { min: t, max: n }, r) {
	return t !== void 0 && e < t ? e = r ? z(t, e, r.min) : Math.max(e, t) : n !== void 0 && e > n && (e = r ? z(n, e, r.max) : Math.min(e, n)), e;
}
function Pm(e, t, n) {
	return {
		min: t === void 0 ? void 0 : e.min + t,
		max: n === void 0 ? void 0 : e.max + n - (e.max - e.min)
	};
}
function Fm(e, { top: t, left: n, bottom: r, right: i }) {
	return {
		x: Pm(e.x, n, i),
		y: Pm(e.y, t, r)
	};
}
function Im(e, t) {
	let n = t.min - e.min, r = t.max - e.max;
	return t.max - t.min < e.max - e.min && ([n, r] = [r, n]), {
		min: n,
		max: r
	};
}
function Lm(e, t) {
	return {
		x: Im(e.x, t.x),
		y: Im(e.y, t.y)
	};
}
function Rm(e, t) {
	let n = .5, r = of(e), i = of(t);
	return i > r ? n = /* @__PURE__ */ sa(t.min, t.max - r, e.min) : r > i && (n = /* @__PURE__ */ sa(e.min, e.max - i, t.min)), $i(0, 1, n);
}
function zm(e, t) {
	let n = {};
	return t.min !== void 0 && (n.min = t.min - e.min), t.max !== void 0 && (n.max = t.max - e.min), n;
}
var Bm = .35;
function Vm(e = Bm) {
	return e === !1 ? e = 0 : e === !0 && (e = Bm), {
		x: Hm(e, "left", "right"),
		y: Hm(e, "top", "bottom")
	};
}
function Hm(e, t, n) {
	return {
		min: Um(e, t),
		max: Um(e, n)
	};
}
function Um(e, t) {
	return typeof e == "number" ? e : e[t] || 0;
}
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/drag/VisualElementDragControls.mjs
var Wm = /* @__PURE__ */ new WeakMap(), Gm = class {
	constructor(e) {
		this.openDragLock = null, this.isDragging = !1, this.currentDirection = null, this.originPoint = {
			x: 0,
			y: 0
		}, this.constraints = !1, this.hasMutatedConstraints = !1, this.elastic = cd(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = e;
	}
	start(e, { snapToCursor: t = !1, distanceThreshold: n } = {}) {
		let { presenceContext: r } = this.visualElement;
		if (r && r.isPresent === !1) return;
		let i = (e) => {
			t && this.snapToCursor(ym(e).point), this.stopAnimation();
		}, a = (e, t) => {
			let { drag: n, dragPropagation: r, onDragStart: i } = this.getProps();
			if (n && !r && (this.openDragLock && this.openDragLock(), this.openDragLock = Au(n), !this.openDragLock)) return;
			this.latestPointerEvent = e, this.latestPanInfo = t, this.isDragging = !0, this.currentDirection = null, this.resolveConstraints(), this.visualElement.projection && (this.visualElement.projection.isAnimationBlocked = !0, this.visualElement.projection.target = void 0), Df((e) => {
				let t = this.getAxisMotionValue(e).get() || 0;
				if (lo.test(t)) {
					let { projection: n } = this.visualElement;
					if (n && n.layout) {
						let r = n.layout.layoutBox[e];
						r && (t = of(r) * (parseFloat(t) / 100));
					}
				}
				this.originPoint[e] = t;
			}), i && L.update(() => i(e, t), !1, !0), Ol(this.visualElement, "transform");
			let { animationState: a } = this.visualElement;
			a && a.setActive("whileDrag", !0);
		}, o = (e, t) => {
			this.latestPointerEvent = e, this.latestPanInfo = t;
			let { dragPropagation: n, dragDirectionLock: r, onDirectionLock: i, onDrag: a } = this.getProps();
			if (!n && !this.openDragLock) return;
			let { offset: o } = t;
			if (r && this.currentDirection === null) {
				this.currentDirection = Ym(o), this.currentDirection !== null && i && i(this.currentDirection);
				return;
			}
			this.updateAxis("x", t.point, o), this.updateAxis("y", t.point, o), this.visualElement.render(), a && L.update(() => a(e, t), !1, !0);
		}, s = (e, t) => {
			this.latestPointerEvent = e, this.latestPanInfo = t, this.stop(e, t), this.latestPointerEvent = null, this.latestPanInfo = null;
		}, c = () => {
			let { dragSnapToOrigin: e } = this.getProps();
			(e || this.constraints) && this.startAnimation({
				x: 0,
				y: 0
			});
		}, { dragSnapToOrigin: l } = this.getProps();
		this.panSession = new Em(e, {
			onSessionStart: i,
			onStart: a,
			onMove: o,
			onSessionEnd: s,
			resumeAnimation: c
		}, {
			transformPagePoint: this.visualElement.getTransformPagePoint(),
			dragSnapToOrigin: l,
			distanceThreshold: n,
			contextWindow: Sm(this.visualElement),
			element: this.visualElement.current
		});
	}
	stop(e, t) {
		let n = e || this.latestPointerEvent, r = t || this.latestPanInfo, i = this.isDragging;
		if (this.cancel(), !i || !r || !n) return;
		let { velocity: a } = r;
		this.startAnimation(a);
		let { onDragEnd: o } = this.getProps();
		o && L.postRender(() => o(n, r));
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
		if (!n || !Jm(e, r, this.currentDirection)) return;
		let i = this.getAxisMotionValue(e), a = this.originPoint[e] + n[e];
		this.constraints && this.constraints[e] && (a = Nm(a, this.constraints[e], this.elastic[e])), i.set(a);
	}
	resolveConstraints() {
		let { dragConstraints: e, dragElastic: t } = this.getProps(), n = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(!1) : this.visualElement.projection?.layout, r = this.constraints;
		e && om(e) ? this.constraints ||= this.resolveRefConstraints() : this.constraints = e && n ? Fm(n.layoutBox, e) : !1, this.elastic = Vm(t), r !== this.constraints && !om(e) && n && this.constraints && !this.hasMutatedConstraints && Df((e) => {
			this.constraints !== !1 && this.getAxisMotionValue(e) && (this.constraints[e] = zm(n.layoutBox[e], this.constraints[e]));
		});
	}
	resolveRefConstraints() {
		let { dragConstraints: e, onMeasureDragConstraints: t } = this.getProps();
		if (!e || !om(e)) return !1;
		let n = e.current, { projection: r } = this.visualElement;
		if (!r || !r.layout) return !1;
		r.root && (r.root.scroll = void 0, r.root.updateScroll());
		let i = Tu(n, r.root, this.visualElement.getTransformPagePoint()), a = Lm(r.layout.layoutBox, i);
		if (t) {
			let e = t(su(a));
			this.hasMutatedConstraints = !!e, e && (a = ou(e));
		}
		return a;
	}
	startAnimation(e) {
		let { drag: t, dragMomentum: n, dragElastic: r, dragTransition: i, dragSnapToOrigin: a, onDragTransitionEnd: o } = this.getProps(), s = this.constraints || {}, c = Df((o) => {
			if (!Jm(o, t, this.currentDirection)) return;
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
		return Ol(this.visualElement, e), n.start(hl(e, n, 0, t, this.visualElement, !1));
	}
	stopAnimation() {
		Df((e) => this.getAxisMotionValue(e).stop());
	}
	getAxisMotionValue(e) {
		let t = `_drag${e.toUpperCase()}`;
		return this.visualElement.getProps()[t] || this.visualElement.getValue(e, this.visualElement.latestValues[e] ?? 0);
	}
	snapToCursor(e) {
		Df((t) => {
			let { drag: n } = this.getProps();
			if (!Jm(t, n, this.currentDirection)) return;
			let { projection: r } = this.visualElement, i = this.getAxisMotionValue(t);
			if (r && r.layout) {
				let { min: n, max: a } = r.layout.layoutBox[t], o = i.get() || 0;
				i.set(e[t] - z(n, a, .5) + o);
			}
		});
	}
	scalePositionWithinConstraints() {
		if (!this.visualElement.current) return;
		let { drag: e, dragConstraints: t } = this.getProps(), { projection: n } = this.visualElement;
		if (!om(t) || !n || !this.constraints) return;
		this.stopAnimation();
		let r = {
			x: 0,
			y: 0
		};
		Df((e) => {
			let t = this.getAxisMotionValue(e);
			if (t && this.constraints !== !1) {
				let n = t.get();
				r[e] = Rm({
					min: n,
					max: n
				}, this.constraints[e]);
			}
		});
		let { transformTemplate: i } = this.visualElement.getProps();
		this.visualElement.current.style.transform = i ? i({}, "") : "none", n.root && n.root.updateScroll(), n.updateLayout(), this.constraints = !1, this.resolveConstraints(), Df((t) => {
			if (!Jm(t, e, null)) return;
			let n = this.getAxisMotionValue(t), { min: i, max: a } = this.constraints[t];
			n.set(z(i, a, r[t]));
		}), this.visualElement.render();
	}
	addListeners() {
		if (!this.visualElement.current) return;
		Wm.set(this.visualElement, this);
		let e = this.visualElement.current, t = xm(e, "pointerdown", (t) => {
			let { drag: n, dragListener: r = !0 } = this.getProps(), i = t.target, a = i !== e && zu(i);
			n && r && !a && this.start(t);
		}), n, r = () => {
			let { dragConstraints: t } = this.getProps();
			om(t) && t.current && (this.constraints = this.resolveRefConstraints(), n ||= qm(e, t.current, () => this.scalePositionWithinConstraints()));
		}, { projection: i } = this.visualElement, a = i.addEventListener("measure", r);
		i && !i.layout && (i.root && i.root.updateScroll(), i.updateLayout()), L.read(r);
		let o = Rf(window, "resize", () => this.scalePositionWithinConstraints()), s = i.addEventListener("didUpdate", (({ delta: e, hasLayoutChanged: t }) => {
			this.isDragging && t && (Df((t) => {
				let n = this.getAxisMotionValue(t);
				n && (this.originPoint[t] += e[t].translate, n.set(n.get() + e[t].translate));
			}), this.visualElement.render());
		}));
		return () => {
			o(), t(), a(), s && s(), n && n();
		};
	}
	getProps() {
		let e = this.visualElement.getProps(), { drag: t = !1, dragDirectionLock: n = !1, dragPropagation: r = !1, dragConstraints: i = !1, dragElastic: a = Bm, dragMomentum: o = !0 } = e;
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
function Km(e) {
	let t = !0;
	return () => {
		if (t) {
			t = !1;
			return;
		}
		e();
	};
}
function qm(e, t, n) {
	let r = G(e, Km(n)), i = G(t, Km(n));
	return () => {
		r(), i();
	};
}
function Jm(e, t, n) {
	return (t === !0 || t === e) && (n === null || n === e);
}
function Ym(e, t = 10) {
	let n = null;
	return Math.abs(e.y) > t ? n = "y" : Math.abs(e.x) > t && (n = "x"), n;
}
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/drag/index.mjs
var Xm = class extends Dd {
	constructor(e) {
		super(e), this.removeGroupControls = aa, this.removeListeners = aa, this.controls = new Gm(e);
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
}, Zm = (e) => (t, n) => {
	e && L.update(() => e(t, n), !1, !0);
}, Qm = class extends Dd {
	constructor() {
		super(...arguments), this.removePointerDownListener = aa;
	}
	onPointerDown(e) {
		this.session = new Em(e, this.createPanHandlers(), {
			transformPagePoint: this.node.getTransformPagePoint(),
			contextWindow: Sm(this.node)
		});
	}
	createPanHandlers() {
		let { onPanSessionStart: e, onPanStart: t, onPan: n, onPanEnd: r } = this.node.getProps();
		return {
			onSessionStart: Zm(e),
			onStart: Zm(t),
			onMove: Zm(n),
			onEnd: (e, t) => {
				delete this.session, r && L.postRender(() => r(e, t));
			}
		};
	}
	mount() {
		this.removePointerDownListener = xm(this.node.current, "pointerdown", (e) => this.onPointerDown(e));
	}
	update() {
		this.session && this.session.updateHandlers(this.createPanHandlers());
	}
	unmount() {
		this.removePointerDownListener(), this.session && this.session.end();
	}
}, $m = !1, eh = class extends _.Component {
	componentDidMount() {
		let { visualElement: e, layoutGroup: t, switchLayoutGroup: n, layoutId: r } = this.props, { projection: i } = e;
		i && (t.group && t.group.add(i), n && n.register && r && n.register(i), $m && i.root.didUpdate(), i.addEventListener("animationComplete", () => {
			this.safeToRemove();
		}), i.setOptions({
			...i.options,
			layoutDependency: this.props.layoutDependency,
			onExitComplete: () => this.safeToRemove()
		})), Wf.hasEverUpdated = !0;
	}
	getSnapshotBeforeUpdate(e) {
		let { layoutDependency: t, visualElement: n, drag: r, isPresent: i } = this.props, { projection: a } = n;
		return a ? (a.isPresent = i, e.layoutDependency !== t && a.setOptions({
			...a.options,
			layoutDependency: t
		}), $m = !0, r || e.layoutDependency !== t || t === void 0 || e.isPresent !== i ? a.willUpdate() : this.safeToRemove(), e.isPresent !== i && (i ? a.promote() : a.relegate() || L.postRender(() => {
			let e = a.getStack();
			(!e || !e.members.length) && this.safeToRemove();
		})), null) : null;
	}
	componentDidUpdate() {
		let { visualElement: e, layoutAnchor: t } = this.props, { projection: n } = e;
		n && (n.options.layoutAnchor = t, n.root.didUpdate(), Eu.postRender(() => {
			!n.currentAnimation && n.isLead() && this.safeToRemove();
		}));
	}
	componentWillUnmount() {
		let { visualElement: e, layoutGroup: t, switchLayoutGroup: n } = this.props, { projection: r } = e;
		$m = !0, r && (r.scheduleCheckAfterUnmount(), t && t.group && t.group.remove(r), n && n.deregister && n.deregister(r));
	}
	safeToRemove() {
		let { safeToRemove: e } = this.props;
		e && e();
	}
	render() {
		return null;
	}
};
function th(e) {
	let [t, n] = Ep(), r = (0, _.useContext)(qi);
	return (0, X.jsx)(eh, {
		...e,
		layoutGroup: r,
		switchLayoutGroup: (0, _.useContext)(am),
		isPresent: t,
		safeToRemove: n
	});
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/features/drag.mjs
var nh = {
	pan: { Feature: Qm },
	drag: {
		Feature: Xm,
		ProjectionNode: wp,
		MeasureLayout: th
	}
};
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/hover.mjs
function rh(e, t, n) {
	let { props: r } = e;
	e.animationState && r.whileHover && e.animationState.setActive("whileHover", n === "Start");
	let i = r["onHover" + n];
	i && L.postRender(() => i(t, ym(t)));
}
var ih = class extends Dd {
	mount() {
		let { current: e } = this.node;
		e && (this.unmount = Nu(e, (e, t) => (rh(this.node, t, "Start"), (e) => rh(this.node, e, "End"))));
	}
	unmount() {}
}, ah = class extends Dd {
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
		this.unmount = oa(Rf(this.node.current, "focus", () => this.onFocus()), Rf(this.node.current, "blur", () => this.onBlur()));
	}
	unmount() {}
};
//#endregion
//#region node_modules/framer-motion/dist/es/gestures/press.mjs
function oh(e, t, n) {
	let { props: r } = e;
	if (e.current instanceof HTMLButtonElement && e.current.disabled) return;
	e.animationState && r.whileTap && e.animationState.setActive("whileTap", n === "Start");
	let i = r["onTap" + (n === "End" ? "" : n)];
	i && L.postRender(() => i(t, ym(t)));
}
var sh = class extends Dd {
	mount() {
		let { current: e } = this.node;
		if (!e) return;
		let { globalTapTarget: t, propagate: n } = this.node.props;
		this.unmount = Ku(e, (e, t) => (oh(this.node, t, "Start"), (e, { success: t }) => oh(this.node, e, t ? "End" : "Cancel")), {
			useGlobalTarget: t,
			stopPropagation: n?.tap === !1
		});
	}
	unmount() {}
}, ch = /* @__PURE__ */ new WeakMap(), lh = /* @__PURE__ */ new WeakMap(), uh = (e) => {
	let t = ch.get(e.target);
	t && t(e);
}, dh = (e) => {
	e.forEach(uh);
};
function fh({ root: e, ...t }) {
	let n = e || document;
	lh.has(n) || lh.set(n, {});
	let r = lh.get(n), i = JSON.stringify(t);
	return r[i] || (r[i] = new IntersectionObserver(dh, {
		root: e,
		...t
	})), r[i];
}
function ph(e, t, n) {
	let r = fh(t);
	return ch.set(e, n), r.observe(e), () => {
		ch.delete(e), r.unobserve(e);
	};
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/features/viewport/index.mjs
var mh = {
	some: 0,
	all: 1
}, hh = class extends Dd {
	constructor() {
		super(...arguments), this.hasEnteredView = !1, this.isInView = !1;
	}
	startObserver() {
		this.stopObserver?.();
		let { viewport: e = {} } = this.node.getProps(), { root: t, margin: n, amount: r = "some", once: i } = e, a = {
			root: t ? t.current : void 0,
			rootMargin: n,
			threshold: typeof r == "number" ? r : mh[r]
		}, o = (e) => {
			let { isIntersecting: t } = e;
			if (this.isInView === t || (this.isInView = t, i && !t && this.hasEnteredView)) return;
			t && (this.hasEnteredView = !0), this.node.animationState && this.node.animationState.setActive("whileInView", t);
			let { onViewportEnter: n, onViewportLeave: r } = this.node.getProps(), a = t ? n : r;
			a && a(e);
		};
		this.stopObserver = ph(this.node.current, a, o);
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
		].some(gh(e, t)) && this.startObserver();
	}
	unmount() {
		this.stopObserver?.(), this.hasEnteredView = !1, this.isInView = !1;
	}
};
function gh({ viewport: e = {} }, { viewport: t = {} } = {}) {
	return (n) => e[n] !== t[n];
}
//#endregion
//#region node_modules/framer-motion/dist/es/motion/features/gestures.mjs
var _h = {
	inView: { Feature: hh },
	tap: { Feature: sh },
	focus: { Feature: ah },
	hover: { Feature: ih }
}, vh = { layout: {
	ProjectionNode: wp,
	MeasureLayout: th
} }, yh = /*@__PURE__*/ mm({
	...vm,
	..._h,
	...nh,
	...vh
}, hm), bh = class {
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
}, xh = () => new bh();
function Sh() {
	return Ji(xh);
}
//#endregion
//#region node_modules/motion/dist/es/react.mjs
var Ch = yh, wh = {
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
}, Th = {
	sm: "Small",
	wide: "Wide",
	tall: "Tall",
	lg: "Large"
}, Eh = [
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
], Dh = typeof window > "u" ? _.useEffect : _.useLayoutEffect;
function Oh(e, t) {
	return e >= 2 && t >= 2 ? "lg" : e >= 2 ? "wide" : t >= 2 ? "tall" : "sm";
}
var kh = (e, t) => e.col < t.col + t.w && t.col < e.col + e.w && e.row < t.row + t.h && t.row < e.row + e.h, Ah = (e, t) => t.col >= e.col && t.row >= e.row && t.col + t.w <= e.col + e.w && t.row + t.h <= e.row + e.h;
function jh(e, t) {
	return {
		w: Math.min(wh[e.size].col, t),
		h: wh[e.size].row
	};
}
function Mh(e, t) {
	return t < 1 || e.length === 0 ? [] : Ph(e, t) ?? Fh(e, t);
}
var Nh = 2e4;
function Ph(e, t) {
	let n = e.map((e) => jh(e, t)), r = n.reduce((e, t) => e + t.w * t.h, 0), i = Math.ceil(r / t), a = Array(i * t).fill(!1), o = Array(e.length).fill(!1), s = [], c = Nh, l = (e, n, r, o) => {
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
function Fh(e, t) {
	let n = [], r = 0, i = e.map((e) => ({
		id: e.id,
		...jh(e, t)
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
function Ih(e, t) {
	let n = Mh(e, t);
	if (n.length !== e.length) return e;
	let r = new Map(e.map((e) => [e.id, e])), i = [...n].sort((e, t) => e.row - t.row || e.col - t.col).map((e) => r.get(e.id));
	if (i.every((t, n) => t === e[n])) return e;
	let a = new Map(n.map((e) => [e.id, e]));
	return Mh(i, t).every((e) => {
		let t = a.get(e.id);
		return t && t.col === e.col && t.row === e.row && t.w === e.w && t.h === e.h;
	}) ? i : e;
}
function Lh(e, t, n) {
	let r = e.findIndex((e) => e.id === t);
	if (r < 0 || r === n || n < 0 || n >= e.length) return e;
	let i = [...e], [a] = i.splice(r, 1);
	return i.splice(n, 0, a), i;
}
var Rh = (e, t) => e.length === t.length && e.every((e, n) => e.id === t[n].id), zh = .18;
function Bh(e, t, n, r) {
	let i = (e, t) => {
		let i = (e.right - e.left) * t, a = (e.bottom - e.top) * t, o = Math.max(e.left + i - n, 0, n - (e.right - i)), s = Math.max(e.top + a - r, 0, r - (e.bottom - a));
		return Math.hypot(o, s);
	}, a = (e) => Math.hypot((e.left + e.right) / 2 - n, (e.top + e.bottom) / 2 - r), o = i(e, 0);
	if (o === 0) return null;
	let s = null, c = Infinity;
	for (let { order: e, slot: n } of t) {
		let t = i(n, zh), r = a(n);
		(t < o || t === o && s && r < c) && (o = t, c = r, s = e);
	}
	return s;
}
function Vh(e, t, n, r) {
	let i = Mh(e, n), a = i.find((e) => e.id === t);
	if (!a) return [];
	let o = new Map(e.map((e) => [e.id, e])), s = Math.max(...i.map((e) => e.row + e.h)), c = [];
	for (let e = 0; e + a.h <= s; e++) for (let s = 0; s + a.w <= n; s++) {
		let n = {
			col: s,
			row: e,
			w: a.w,
			h: a.h
		};
		if (kh(n, a)) continue;
		let l = i.filter((e) => kh(e, n));
		if (l.length < 2 || !l.every((e) => Ah(n, e))) continue;
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
		let a = Lh(e, t, i), o = Mh(a, n).find((e) => e.id === t);
		o && c.push({
			order: a,
			slot: r(o)
		});
	}
	return c;
}
var Hh = {
	type: "spring",
	visualDuration: .38,
	bounce: .16
}, Uh = {
	type: "spring",
	visualDuration: .26,
	bounce: .32
}, Wh = 1.06, Gh = 40, Kh = 620, qh = 350, Jh = 8, Yh = "0px 1px 2px 0px rgba(0,0,0,0.12), 0px 0px 0px 0px rgba(0,0,0,0)", Xh = "0px 28px 60px -16px rgba(0,0,0,0.45), 0px 10px 24px -8px rgba(0,0,0,0.3)", Zh = (0, _.memo)(function({ item: e, col: t, row: n, w: r, h: i, columns: a, rows: o, editable: s, held: c, raised: l, landed: u, handlers: d, hintId: f, position: p, count: m, renderItem: h, plainShell: g, shellClassName: v, jiggle: y, nudge: b }) {
	let x = Sh(), S = (0, _.useRef)(null), C = (0, _.useRef)(null), w = (0, _.useRef)(!1), T = (0, _.useRef)(null), [E, D] = (0, _.useState)("idle"), ee = (0, _.useCallback)(() => {
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
			}, qh)
		};
	}, ne = (e) => {
		let t = C.current;
		t && e.pointerId === t.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) > Jh && ee();
	}, re = (e) => {
		C.current?.pointerId === e.pointerId && ee();
	}, ie = (t / Math.max(a, 1) + n / Math.max(o, 1)) * .26;
	return /* @__PURE__ */ (0, X.jsx)(Ch.div, {
		ref: S,
		role: "listitem",
		"data-slot": "widget",
		"data-widget-id": e.id,
		tabIndex: s ? 0 : void 0,
		"aria-label": e.label ?? `${Th[e.size]} widget`,
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
			scale: E === "holding" ? .97 : E === "lifted" ? Wh : 1,
			boxShadow: E === "lifted" ? Xh : Yh
		},
		whileDrag: {
			scale: Wh,
			boxShadow: Xh,
			transition: Uh
		},
		transition: Hh,
		className: `relative min-w-0 rounded-[var(--widget-radius)] outline-none focus-visible:ring-2 focus-visible:ring-ring [&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none] ${s ? "touch-pan-y touch-pinch-zoom select-none [-webkit-touch-callout:none]" : ""}`,
		style: {
			gridColumn: `${t + 1} / span ${r}`,
			gridRow: `${n + 1} / span ${i}`,
			zIndex: c ? 20 : l ? 10 : 0
		},
		"data-held": c ? "1" : void 0,
		children: /* @__PURE__ */ (0, X.jsx)("div", {
			className: `h-full w-full ${y && !c && E === "idle" ? "apex-widget-jiggle" : ""} ${b && !c && E === "idle" ? "apex-widget-nudge" : ""}`,
			style: { "--jiggle-n": p },
			children: /* @__PURE__ */ (0, X.jsxs)(Ch.div, {
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
				children: [s ? /* @__PURE__ */ (0, X.jsx)("div", {
					"data-drag-handle": "",
					className: "absolute inset-x-0 top-0 z-20 flex h-8 cursor-grab items-center justify-center rounded-t-[var(--widget-radius)] bg-[#121314]/6 hover:bg-[#121314]/12 active:cursor-grabbing dark:bg-white/8 dark:hover:bg-white/14",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, X.jsxs)("span", {
						className: "flex items-center gap-[3px]",
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, X.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, X.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, X.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, X.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, X.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" }),
							/* @__PURE__ */ (0, X.jsx)("span", { className: "size-[3px] rounded-full bg-current opacity-45" })
						]
					})
				}) : null, /* @__PURE__ */ (0, X.jsx)("div", {
					className: `flex h-full min-h-0 w-full flex-col ${s ? "pt-7" : ""}`,
					children: h?.(e, Oh(r, i))
				})]
			})
		})
	});
});
function Qh({ items: e, onChange: t, renderItem: n, getShellClassName: r, plainShell: i = !1, fixedColumns: a, jiggle: o = !1, nudgeItemId: s = null, editable: c = !0, maxColumns: l = 4, cellSize: u = 215, gap: d = 12, radius: f = 24, className: p = "" }) {
	let [m, h] = (0, _.useState)(() => e ?? Eh), g = (0, _.useRef)(null), v = (0, _.useId)(), y = Math.min(2, Math.max(1, l)), b = typeof a == "number" && a > 0 ? Math.max(1, Math.floor(a)) : null, [x, S] = (0, _.useState)({
		unit: 0,
		columns: 0
	});
	Dh(() => {
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
	let C = x.columns || b || Math.max(y, l), w = (0, _.useMemo)(() => Mh(m, C), [m, C]), T = w.reduce((e, t) => Math.max(e, t.row + t.h), 0), E = (0, _.useRef)({
		items: m,
		metrics: x,
		onChange: t
	});
	E.current.metrics = x, E.current.onChange = t, Dh(() => {
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
	}, [d]), [te, ne] = (0, _.useState)(null), [re, ie] = (0, _.useState)(null), [ae, oe] = (0, _.useState)(null), se = (0, _.useRef)(null), O = (0, _.useRef)(null), ce = (0, _.useRef)(0), le = (0, _.useRef)(0), ue = (0, _.useRef)(0), de = (0, _.useRef)(0), fe = (0, _.useRef)(null), pe = (0, _.useCallback)((e = !1) => {
		ce.current = 0;
		let t = se.current, { items: n, metrics: r } = E.current, i = t ? g.current?.querySelector(`[data-widget-id="${CSS.escape(t)}"]`) : null;
		if (!t || !i || !r.columns) return;
		let a = performance.now();
		if (!e && a - le.current < Gh) {
			ce.current = requestAnimationFrame(() => pe());
			return;
		}
		let o = Mh(n, r.columns).find((e) => e.id === t);
		if (!o) return;
		let s = i.getBoundingClientRect(), c = Bh(ee(o), Vh(n, t, r.columns, ee), s.left + s.width / 2, s.top + s.height / 2);
		c && (le.current = a, D(Ih(c, r.columns)));
	}, [ee, D]);
	(0, _.useEffect)(() => () => {
		cancelAnimationFrame(ce.current), window.clearTimeout(de.current);
	}, []), Dh(() => {
		let e = fe.current;
		e && (fe.current = null, (g.current?.querySelector(`[data-widget-id="${CSS.escape(e)}"]`))?.focus());
	}, [m]);
	let me = (0, _.useMemo)(() => ({
		start: (e) => {
			se.current = e, O.current = E.current.items, le.current = 0, ne(e), ie(e), window.addEventListener("pointerup", () => {
				ue.current = performance.now() + 300;
			}, {
				once: !0,
				capture: !0
			});
		},
		drag: () => {
			ce.current ||= requestAnimationFrame(() => pe());
		},
		end: (e) => {
			cancelAnimationFrame(ce.current), pe(!0), ce.current = 0, se.current = null, ne(null), oe(e), window.clearTimeout(de.current), de.current = window.setTimeout(() => {
				oe(null), ie(null);
			}, Kh);
			let t = O.current;
			O.current = null;
			let n = E.current.items;
			t && !Rh(t, n) && E.current.onChange?.(n);
		},
		key: (e, t) => {
			if (!c || !e.altKey || e.target.closest("input, textarea, select")) return;
			let n = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
			if (!n) return;
			e.preventDefault();
			let { items: r, metrics: i } = E.current, a = i.columns || l, o = r.findIndex((e) => e.id === t);
			for (let e = o + n; e >= 0 && e < r.length; e += n) {
				let n = Ih(Lh(r, t, e), a);
				if (!Rh(n, r)) {
					fe.current = t, D(n), E.current.onChange?.(n);
					return;
				}
			}
		},
		swallow: () => performance.now() < ue.current,
		suppressClick: () => {
			ue.current = performance.now() + 300;
		}
	}), [
		pe,
		D,
		c,
		l
	]), he = (0, _.useMemo)(() => new Map(m.map((e) => [e.id, e])), [m]), k = (0, _.useRef)(m.map((e) => e.id));
	for (let e of m) k.current.includes(e.id) || k.current.push(e.id);
	let ge = new Map(w.map((e) => [e.id, e])), _e = new Map([...w].sort((e, t) => e.row - t.row || e.col - t.col).map((e, t) => [e.id, t]));
	return /* @__PURE__ */ (0, X.jsx)(Np, {
		reducedMotion: "user",
		children: /* @__PURE__ */ (0, X.jsxs)("div", {
			className: `relative w-full ${p}`,
			style: { "--widget-radius": `${f}px` },
			children: [c && /* @__PURE__ */ (0, X.jsx)("p", {
				id: v,
				className: "sr-only",
				children: "Drag from the dotted handle at the top of a tile to rearrange. On touch screens, press and hold the handle first. With a keyboard, hold Alt and press the arrow keys. Use Arrange for jiggle mode."
			}), /* @__PURE__ */ (0, X.jsx)("div", {
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
				children: k.current.map((e) => {
					let t = he.get(e), a = ge.get(e);
					return !t || !a ? null : /* @__PURE__ */ (0, X.jsx)(Zh, {
						position: (_e.get(e) ?? 0) + 1,
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
						handlers: me,
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
function $h(e, t, n, r, i, a, o = "sm") {
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
var eg = $h("attendance", "Clock-in", "core", !0, "mdi:clock-check-outline", "Clock-in and regularizations."), tg = $h("leaves", "Leaves", "core", !0, "mdi:calendar-remove-outline", "Policies and balances."), ng = $h("rollcall", "Roll call", "campus", !0, "mdi:account-check-outline", "Section presence, live."), rg = $h("timetable", "Timetable", "campus", !0, "mdi:calendar-clock", "Slots, cover, instances."), ig = $h("overtime", "Overtime", "add-on", !1, "mdi:timer-plus-outline", "Bolt on when needed."), ag = $h("face", "Face capture", "add-on", !1, "mdi:face-recognition", "Biometrics when ready."), og = $h("library", "Library", "campus", !1, "mdi:bookshelf", "Catalog and loans."), sg = $h("transport", "Transport", "campus", !1, "mdi:bus-school", "Routes for guardians."), cg = $h("iris", "Iris scan", "add-on", !0, "mdi:eye-outline", "High-assurance capture."), lg = $h("exams", "Examinations", "campus", !0, "mdi:file-document-edit-outline", "Papers, marks, cards."), ug = $h("payroll", "Payroll", "core", !1, "mdi:cash-multiple", "Pay runs when you switch on."), dg = $h("parent", "Parent portal", "campus", !0, "mdi:account-child-outline", "Guardians actually sign in."), fg = $h("reports", "Report cards", "campus", !0, "mdi:card-account-details-outline", "Publish when marks lock; parents see only what you release.", "wide"), pg = {
	id: "features-header",
	kind: "features-header",
	size: "wide",
	label: "Admin Features",
	shell: Wi
}, mg = {
	id: "marketing-cta",
	kind: "marketing-cta",
	size: "wide",
	label: "Need it later?",
	detail: "Just turn it on.",
	icon: "mdi:toggle-switch",
	shell: Wi
}, hg = {
	bg: "#D8D8DC",
	tone: "light"
};
function gg(e) {
	switch (e) {
		case "core": return {
			bg: N.blueSoft,
			tone: "light"
		};
		case "campus": return {
			bg: N.gold,
			tone: "light"
		};
		case "add-on": return {
			bg: N.coral,
			tone: "light"
		};
		default: return e;
	}
}
var _g = [
	pg,
	{
		...eg,
		shell: gg("core")
	},
	{
		...ng,
		shell: gg("campus")
	},
	{
		...tg,
		shell: gg("core")
	},
	{
		...ig,
		shell: hg
	},
	{
		...ag,
		shell: hg
	},
	mg
], vg = [
	pg,
	{
		...eg,
		shell: gg("core")
	},
	{
		...tg,
		shell: gg("core")
	},
	{
		...ng,
		shell: gg("campus")
	},
	{
		...rg,
		shell: gg("campus")
	},
	{
		...ig,
		shell: hg
	},
	{
		...ag,
		shell: hg
	},
	{
		...og,
		shell: hg
	},
	{
		...sg,
		shell: hg
	},
	mg
], yg = [
	{
		id: "campus-header",
		kind: "features-header",
		size: "wide",
		label: "Campus rack",
		detail: "BlokSchool modules on the same spine.",
		shell: Wi
	},
	{
		...ng,
		shell: gg("campus")
	},
	{
		...rg,
		shell: gg("campus")
	},
	{
		...lg,
		shell: gg("campus")
	},
	{
		...dg,
		shell: gg("campus")
	},
	{
		...cg,
		shell: gg("add-on")
	},
	{
		...og,
		shell: hg
	},
	{
		...sg,
		shell: hg
	},
	{
		...fg,
		size: "sm",
		detail: "Publish when marks lock.",
		shell: gg("campus")
	},
	mg
], bg = [
	{
		id: "workforce-header",
		kind: "features-header",
		size: "wide",
		label: "Workforce rack",
		detail: "BlokHR modules you grow into.",
		shell: Wi
	},
	{
		...eg,
		shell: gg("core")
	},
	{
		...tg,
		shell: gg("core")
	},
	{
		...cg,
		shell: gg("add-on")
	},
	{
		...ig,
		shell: hg
	},
	{
		...ag,
		shell: hg
	},
	{
		...ug,
		shell: hg
	},
	mg
], xg = [
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
				bg: N.gold,
				tone: "light"
			},
			{
				bg: N.blueSoft,
				tone: "light"
			},
			{
				bg: N.coral,
				tone: "light"
			},
			{
				bg: N.charcoal,
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
			bg: N.midGray,
			tone: "dark"
		}
	},
	mg
], Sg = [
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
				bg: N.gold,
				tone: "light"
			},
			{
				bg: N.blueSoft,
				tone: "light"
			},
			{
				bg: N.coral,
				tone: "light"
			},
			{
				bg: N.charcoal,
				tone: "dark"
			},
			{
				bg: N.midGray,
				tone: "dark"
			},
			{
				bg: N.darkFace,
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
			bg: N.gold,
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
			bg: N.blueSoft,
			tone: "light"
		}
	},
	mg
], Cg = [
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
			bg: N.blueSoft,
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
			bg: N.gold,
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
			bg: N.coral,
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
			bg: N.charcoal,
			tone: "dark"
		}
	},
	mg
];
function wg(e, t) {
	if (e.kind === "module-switch") {
		if (!(t ?? !!e.enabled)) return hg;
		if (e.rack) return gg(e.rack);
	}
	return e.shell ?? Ui(e.id);
}
function Tg(e) {
	return e === "dark" ? {
		muted: "text-white/90",
		label: "text-white",
		title: "text-white",
		titleOff: "text-white/70",
		accent: N.mint,
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
function Eg({ on: e }) {
	return /* @__PURE__ */ (0, X.jsx)("span", {
		"aria-hidden": "true",
		className: "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
		style: { background: e ? N.mint : N.charcoal },
		children: /* @__PURE__ */ (0, X.jsx)("span", { className: `absolute size-3.5 rounded-full bg-[#121314] shadow transition-transform ${e ? "translate-x-[18px]" : "translate-x-[3px]"}` })
	});
}
function Dg({ title: e, detail: t, shell: n, onCount: r }) {
	let i = Tg(n.tone);
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: `flex h-full flex-col gap-3 p-4 sm:p-5 ${i.border}`,
		style: { background: n.bg },
		children: [
			/* @__PURE__ */ (0, X.jsxs)("header", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, X.jsxs)("h3", {
					className: `flex items-center gap-2 text-[12px] font-bold tracking-[0.1em] uppercase ${i.label}`,
					children: [/* @__PURE__ */ (0, X.jsx)(ki, {
						icon: "mdi:toggle-switch",
						className: "size-3.5",
						style: { color: N.mint }
					}), e]
				}), typeof r == "number" ? /* @__PURE__ */ (0, X.jsxs)("span", {
					className: "flex items-center gap-1.5 text-[13px] font-bold tabular-nums",
					style: { color: N.mint },
					children: [
						/* @__PURE__ */ (0, X.jsxs)("span", {
							className: "relative inline-flex size-2",
							children: [/* @__PURE__ */ (0, X.jsx)("span", {
								className: "absolute inset-0 animate-ping rounded-full motion-reduce:hidden",
								style: { background: `${N.mint}80` }
							}), /* @__PURE__ */ (0, X.jsx)("span", {
								className: "relative size-2 rounded-full",
								style: { background: N.mint }
							})]
						}),
						r,
						" on"
					]
				}) : null]
			}),
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: `text-[13px] leading-relaxed ${i.muted}`,
				children: t ?? "Off means gone from the sidebar and 404 from its own API. On means back on the next load."
			}),
			/* @__PURE__ */ (0, X.jsxs)("p", {
				className: `mt-auto text-[12px] ${i.muted}`,
				children: [50, " modules in the rack · drag any tile"]
			})
		]
	});
}
function Og({ rack: e, label: t, detail: n, icon: r, enabled: i, shell: a, onToggle: o }) {
	let s = Tg(a.tone);
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: `flex h-full flex-col gap-2 p-3.5 sm:p-4 ${s.border} ${i ? "" : "grayscale-[0.35]"}`,
		style: { background: a.bg },
		children: [/* @__PURE__ */ (0, X.jsxs)("header", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, X.jsx)("span", {
				className: `text-[11px] font-bold tracking-[0.1em] uppercase ${s.label}`,
				children: e
			}), o ? /* @__PURE__ */ (0, X.jsx)("button", {
				type: "button",
				onClick: (e) => {
					e.stopPropagation(), o();
				},
				className: "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg",
				"aria-pressed": i,
				"aria-label": `${t} ${i ? "on" : "off"}`,
				children: /* @__PURE__ */ (0, X.jsx)(Eg, { on: i })
			}) : /* @__PURE__ */ (0, X.jsx)(Eg, { on: i })]
		}), /* @__PURE__ */ (0, X.jsxs)("div", {
			className: "mt-auto flex items-end justify-between gap-2",
			children: [/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: `truncate text-[18px] font-bold tracking-tight ${i ? s.title : s.titleOff}`,
					children: t
				}), i ? /* @__PURE__ */ (0, X.jsx)("p", {
					className: `mt-1 line-clamp-2 text-[12px] leading-snug ${s.muted}`,
					children: n
				}) : /* @__PURE__ */ (0, X.jsxs)("div", {
					className: "mt-1 flex flex-col gap-1.5",
					children: [/* @__PURE__ */ (0, X.jsx)("p", {
						className: `text-[12px] font-bold uppercase tracking-wide ${s.muted}`,
						children: "off"
					}), o ? /* @__PURE__ */ (0, X.jsx)("button", {
						type: "button",
						onClick: (e) => {
							e.stopPropagation(), o();
						},
						className: "inline-flex min-h-11 w-fit items-center rounded-lg text-[12px] font-bold",
						style: { color: "#0A7A3E" },
						children: "Turn on"
					}) : null]
				})]
			}), /* @__PURE__ */ (0, X.jsx)("span", {
				className: `inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${i ? s.chipOn : s.chipOff}`,
				children: /* @__PURE__ */ (0, X.jsx)(ki, {
					icon: r,
					className: "size-4"
				})
			})]
		})]
	});
}
function kg({ shell: e, eyebrow: t, title: n, detail: r, icon: i }) {
	let a = Tg(e.tone);
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: `flex h-full flex-col gap-2 p-3.5 sm:p-4 ${a.border}`,
		style: { background: e.bg },
		children: [t ? /* @__PURE__ */ (0, X.jsx)("p", {
			className: `text-[11px] font-bold tracking-[0.1em] uppercase ${a.label}`,
			children: t
		}) : null, /* @__PURE__ */ (0, X.jsxs)("div", {
			className: "mt-auto flex items-end justify-between gap-2",
			children: [/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: `truncate text-[18px] font-bold tracking-tight ${a.title}`,
					children: n
				}), r ? /* @__PURE__ */ (0, X.jsx)("p", {
					className: `mt-1 line-clamp-3 text-[12px] leading-snug ${a.muted}`,
					children: r
				}) : null]
			}), i ? /* @__PURE__ */ (0, X.jsx)("span", {
				className: `inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${a.chipOn}`,
				children: /* @__PURE__ */ (0, X.jsx)(ki, {
					icon: i,
					className: "size-4"
				})
			}) : null]
		})]
	});
}
function Ag({ title: e, detail: t, icon: n, shell: r }) {
	let i = Tg(r.tone);
	return /* @__PURE__ */ (0, X.jsx)("section", {
		className: `flex h-full flex-col gap-2 p-3.5 sm:p-4 ${i.border}`,
		style: { background: r.bg },
		children: /* @__PURE__ */ (0, X.jsxs)("div", {
			className: "mt-auto flex items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, X.jsx)("p", {
					className: `text-[20px] font-extrabold leading-tight tracking-tight sm:text-[22px] ${i.title}`,
					children: e
				}), t ? /* @__PURE__ */ (0, X.jsx)("p", {
					className: `mt-1 text-[17px] font-bold leading-snug sm:text-[18px] ${i.title}`,
					children: t
				}) : null]
			}), n ? /* @__PURE__ */ (0, X.jsx)("span", {
				className: `inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${i.chipOn}`,
				children: /* @__PURE__ */ (0, X.jsx)(ki, {
					icon: n,
					className: "size-5"
				})
			}) : null]
		})
	});
}
function jg(e, t, n, r) {
	let i = e.kind === "module-switch" ? n[e.id] ?? !!e.enabled : !!e.enabled, a = wg(e, i);
	switch (e.kind) {
		case "features-header": return /* @__PURE__ */ (0, X.jsx)(Dg, {
			title: e.label ?? "Admin › Features",
			detail: e.detail,
			shell: a,
			onCount: e.id === "features-header" ? t : void 0
		});
		case "module-switch": return /* @__PURE__ */ (0, X.jsx)(Og, {
			rack: e.rack ?? "core",
			label: e.label ?? e.id,
			detail: e.detail ?? "",
			icon: e.icon ?? "mdi:puzzle-outline",
			enabled: i,
			shell: a,
			onToggle: () => r(e.id)
		});
		case "setup-step": return /* @__PURE__ */ (0, X.jsx)(kg, {
			shell: a,
			eyebrow: e.stepN,
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "access-layer": return /* @__PURE__ */ (0, X.jsx)(kg, {
			shell: a,
			eyebrow: `Layer ${e.stepN}`,
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "access-role": return /* @__PURE__ */ (0, X.jsx)(kg, {
			shell: a,
			eyebrow: "Role",
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "pricing-card": return /* @__PURE__ */ (0, X.jsx)(kg, {
			shell: a,
			eyebrow: "Commercial",
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "overview-stat": return /* @__PURE__ */ (0, X.jsx)(kg, {
			shell: a,
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon
		});
		case "marketing-cta": return /* @__PURE__ */ (0, X.jsx)(Ag, {
			title: e.label ?? "",
			detail: e.detail,
			icon: e.icon,
			shell: a
		});
		default: return e.kind;
	}
}
var Mg = "blokhr_apex_board_nudge_v1", Ng = "blokhr_apex_board_demo_flip_v1";
function Pg({ items: e, maxColumns: t = 4, fixedColumns: n, cellSize: r = 180, gap: i = 12, radius: a = N.radiusPx, className: o = "", title: s = "13blok module board", stripLabel: c = "Adding a feature takes one click, not a project" }) {
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
			if (sessionStorage.getItem(Mg)) return;
		} catch {
			return;
		}
		let t = e.find((e) => e.size === "sm")?.id ?? e[1]?.id ?? e[0]?.id ?? null;
		if (!t) return;
		let n = window.setTimeout(() => {
			m(t);
			try {
				sessionStorage.setItem(Mg, "1");
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
			if (sessionStorage.getItem(Ng)) return;
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
				sessionStorage.setItem(Ng, "1");
			} catch {}
		}, 2200);
		return () => window.clearTimeout(t);
	}, [l, v]), /* @__PURE__ */ (0, X.jsxs)("section", {
		"aria-labelledby": "blok-module-board-title",
		className: o,
		children: [/* @__PURE__ */ (0, X.jsxs)("div", {
			className: "mb-3 flex min-h-11 items-center gap-2 rounded-[14px] border border-[#121314]/12 px-3 py-1.5",
			style: { borderRadius: N.radiusPx },
			children: [
				/* @__PURE__ */ (0, X.jsx)("h2", {
					id: "blok-module-board-title",
					className: "sr-only",
					children: s
				}),
				/* @__PURE__ */ (0, X.jsx)("p", {
					className: "min-w-0 flex-1 text-[13px] font-bold leading-snug tracking-[-0.01em] text-foreground sm:text-[14px]",
					style: { fontFamily: "var(--font-display), \"Space Grotesk\", system-ui, sans-serif" },
					children: c
				}),
				/* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					onClick: () => f((e) => !e),
					"aria-pressed": d,
					className: `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[14px] border px-3 text-[12px] font-bold tracking-wide transition-colors ${d ? "border-[#121314] bg-[#121314] text-white dark:border-white dark:bg-white dark:text-[#121314]" : "border-[#121314]/12 text-[#121314] hover:bg-[#121314]/5 dark:border-white/25 dark:text-white"}`,
					children: [/* @__PURE__ */ (0, X.jsx)(ki, {
						icon: d ? "mdi:check" : "mdi:cursor-move",
						className: "size-3.5",
						"aria-hidden": !0
					}), d ? "Done" : "Arrange"]
				})
			]
		}), /* @__PURE__ */ (0, X.jsx)("div", {
			"data-live": l ? "1" : "0",
			children: /* @__PURE__ */ (0, X.jsx)(Qh, {
				items: e,
				plainShell: !0,
				editable: !0,
				jiggle: d && l,
				nudgeItemId: p,
				renderItem: (e) => {
					let t = x.get(e.id);
					return t ? jg(t, b, h, S) : null;
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
async function Fg(e, t) {
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
function Ig(e, t, n) {
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
async function Lg(e, t) {
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
function Rg() {
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
var zg = 350;
function Bg({ status: e, mode: t, open: n, onClose: r, api: i, navigate: a }) {
	let o = (0, _.useMemo)(() => i ?? Rg(), [i]), s = a ?? ((e) => {
		window.location.href = e;
	}), c = e.subdomainBase ? String(e.subdomainBase).trim() : "", [l, u] = (0, _.useState)(""), [d, f] = (0, _.useState)("idle"), [p, m] = (0, _.useState)(""), [h, g] = (0, _.useState)(""), [v, y] = (0, _.useState)(!1), [b, x] = (0, _.useState)(!0), [S, C] = (0, _.useState)(!1), w = (0, _.useCallback)(async () => {
		let e = l.trim().toLowerCase();
		if (!e) {
			f("idle"), m(""), g(""), y(!1), x(!0);
			return;
		}
		f("checking"), g("Checking…"), y(!1), m(""), x(!0);
		let n = await Fg(o, e);
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
		let e = window.setTimeout(w, zg);
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
			let t = Ig(e, c, d);
			if (t.url) {
				s(t.url);
				return;
			}
			m(t.message || "Could not find that workspace");
			return;
		}
		C(!0), x(!0);
		let n = await Lg(o, e);
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
	return n ? /* @__PURE__ */ (0, X.jsx)("div", {
		className: "fixed inset-0 z-40 flex items-end justify-center bg-background/70 p-5 md:items-center",
		onClick: (e) => {
			e.target === e.currentTarget && r();
		},
		role: "presentation",
		children: /* @__PURE__ */ (0, X.jsxs)("div", {
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "apex-panel-title",
			className: "relative w-full max-w-[420px] rounded-xl border border-border bg-card p-7 text-card-foreground shadow-2xl",
			children: [
				/* @__PURE__ */ (0, X.jsx)("button", {
					type: "button",
					className: "absolute top-3 right-3 rounded-md px-2 text-2xl leading-none text-muted-foreground hover:text-foreground",
					"aria-label": "Close",
					onClick: r,
					children: "×"
				}),
				/* @__PURE__ */ (0, X.jsx)("h2", {
					id: "apex-panel-title",
					className: "mb-2 text-[22px] font-extrabold tracking-tight",
					children: t === "login" ? "Log in to your workspace" : "Create workspace"
				}),
				/* @__PURE__ */ (0, X.jsx)("p", {
					className: "mb-5 text-sm leading-relaxed text-muted-foreground",
					children: t === "login" ? "Enter your workspace name. We will send you to its sign-in page." : "Pick a unique subdomain. Your team will use it for setup and sign-in."
				}),
				/* @__PURE__ */ (0, X.jsxs)("label", {
					className: "mb-2 block",
					children: [/* @__PURE__ */ (0, X.jsx)("span", {
						className: "mb-2 block text-xs font-semibold text-muted-foreground",
						children: "Workspace name"
					}), /* @__PURE__ */ (0, X.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, X.jsx)("input", {
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
						}), /* @__PURE__ */ (0, X.jsx)("span", {
							className: "font-mono text-[13px] text-muted-foreground",
							children: c ? `.${c}` : ""
						})]
					})]
				}),
				p ? /* @__PURE__ */ (0, X.jsx)("div", {
					className: "mt-2 text-[13px] text-rose-600 dark:text-rose-400",
					children: p
				}) : null,
				h ? /* @__PURE__ */ (0, X.jsx)("div", {
					className: `mt-2 min-h-[1.2em] font-mono text-xs ${v ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`,
					children: h
				}) : null,
				/* @__PURE__ */ (0, X.jsx)("button", {
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
var Vg = (0, _.createContext)(null), Hg = "blokhr_apex_theme";
function Ug() {
	try {
		let e = localStorage.getItem(Hg);
		if (e === "light" || e === "dark") return e;
	} catch {}
	return null;
}
function Wg() {
	return typeof document > "u" ? !1 : !!document.getElementById("root") && !document.getElementById("screenLanding");
}
function Gg(e) {
	if (!Wg()) return;
	let t = document.documentElement;
	t.classList.toggle("dark", e === "dark"), t.dataset.theme = e, t.style.backgroundColor = e === "dark" ? "#2a1412" : "#fbf4e1", t.style.colorScheme = e;
}
function Kg({ children: e }) {
	let [t, n] = (0, _.useState)(() => Ug() ?? "light");
	(0, _.useEffect)(() => {
		Gg(t);
		try {
			localStorage.setItem(Hg, t);
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
	return /* @__PURE__ */ (0, X.jsx)(Vg.Provider, {
		value: a,
		children: /* @__PURE__ */ (0, X.jsx)("div", {
			className: `apex-root min-h-screen${t === "dark" ? " dark" : ""}`,
			"data-theme": t,
			children: e
		})
	});
}
function qg() {
	let e = (0, _.useContext)(Vg);
	if (!e) throw Error("useTheme must be used within ThemeProvider");
	return e;
}
//#endregion
//#region app/apex/shell.tsx
var Jg = (0, _.createContext)(null);
function Yg() {
	let e = (0, _.useContext)(Jg);
	if (!e) throw Error("useApex must be used within ApexShell");
	return e;
}
function Xg({ status: e, api: t, navigate: n, children: r }) {
	let { theme: i, toggleTheme: a } = qg(), [o, s] = (0, _.useState)(!1), [c, l] = (0, _.useState)("create"), u = (0, _.useCallback)((e) => {
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
	return /* @__PURE__ */ (0, X.jsx)(Jg.Provider, {
		value: d,
		children: /* @__PURE__ */ (0, X.jsxs)("div", {
			className: "relative min-h-screen bg-background text-foreground",
			children: [
				/* @__PURE__ */ (0, X.jsx)("div", {
					"aria-hidden": "true",
					className: "pointer-events-none absolute inset-0"
				}),
				/* @__PURE__ */ (0, X.jsx)("header", {
					className: "relative z-10 w-full bg-white dark:bg-black",
					children: /* @__PURE__ */ (0, X.jsxs)("div", {
						className: "mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 pt-5 pb-3 md:gap-6 md:px-8 md:pt-8 md:pb-4",
						children: [
							/* @__PURE__ */ (0, X.jsx)(An, {
								to: "/",
								className: "text-[28px] font-extrabold tracking-[-1.2px] leading-none md:text-[40px] md:tracking-[-1.4px]",
								"aria-label": Ai,
								children: Ai
							}),
							/* @__PURE__ */ (0, X.jsx)("nav", {
								className: "apex-nav-desktop font-mono text-[12px] tracking-[1px]",
								"aria-label": "Primary",
								children: ji.map((e) => /* @__PURE__ */ (0, X.jsx)(An, {
									to: e.path,
									className: ({ isActive: e }) => `uppercase ${e ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`,
									children: e.label
								}, e.id))
							}),
							/* @__PURE__ */ (0, X.jsxs)("div", {
								className: "flex items-center gap-2 md:gap-3",
								children: [
									/* @__PURE__ */ (0, X.jsx)("button", {
										type: "button",
										onClick: a,
										className: "inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground",
										"aria-label": i === "dark" ? "Switch to light theme" : "Switch to dark theme",
										children: /* @__PURE__ */ (0, X.jsx)(ki, {
											icon: i === "dark" ? "mdi:white-balance-sunny" : "mdi:moon-waning-crescent",
											className: "size-4"
										})
									}),
									/* @__PURE__ */ (0, X.jsxs)("button", {
										type: "button",
										onClick: () => u("login"),
										className: "inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 font-mono text-[12px] tracking-[1px] text-muted-foreground uppercase hover:text-foreground",
										children: [/* @__PURE__ */ (0, X.jsx)(ki, {
											icon: "mdi:login",
											className: "size-3.5"
										}), "Log in"]
									}),
									/* @__PURE__ */ (0, X.jsxs)("button", {
										type: "button",
										onClick: () => u("create"),
										className: "apex-header-create min-h-11 gap-1.5 rounded-[10px] bg-primary px-4 py-2 font-mono text-[12px] tracking-[1px] text-primary-foreground uppercase",
										children: [/* @__PURE__ */ (0, X.jsx)(ki, {
											icon: "mdi:plus-box-outline",
											className: "size-3.5"
										}), "Create workspace"]
									})
								]
							})
						]
					})
				}),
				/* @__PURE__ */ (0, X.jsx)("nav", {
					className: "apex-nav-mobile relative z-10 px-5 pb-3 font-mono text-[11px] tracking-[1px]",
					"aria-label": "Primary mobile",
					children: ji.map((e) => /* @__PURE__ */ (0, X.jsx)(An, {
						to: e.path,
						className: ({ isActive: e }) => `shrink-0 font-mono text-[11px] tracking-[1px] uppercase ${e ? "text-foreground" : "text-muted-foreground"}`,
						children: e.label
					}, e.id))
				}),
				r ?? /* @__PURE__ */ (0, X.jsx)(Vt, {}),
				/* @__PURE__ */ (0, X.jsx)(Bg, {
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
var Zg = 768;
function Qg() {
	let [e, t] = (0, _.useState)(() => typeof window > "u" || window.innerWidth >= Zg);
	return (0, _.useEffect)(() => {
		let e = window.matchMedia(`(min-width: ${Zg}px)`), n = () => t(e.matches);
		return n(), e.addEventListener("change", n), () => e.removeEventListener("change", n);
	}, []), e;
}
//#endregion
//#region app/apex/marketing-page.tsx
function $g({ eyebrow: e, title: t, lede: n, bullets: r, stripLabel: i, meta: a, aside: o, widgets: s, boardTitle: c }) {
	let l = Qg(), { openSignup: u } = Yg(), d = /* @__PURE__ */ (0, X.jsxs)("section", {
		className: "flex flex-col justify-start",
		"aria-labelledby": "page-headline",
		children: [
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase",
				children: e
			}),
			/* @__PURE__ */ (0, X.jsx)("h1", {
				id: "page-headline",
				className: "mb-3 text-[32px] font-extrabold leading-[1.05] tracking-[-1.4px] md:text-[40px] md:tracking-[-1.6px]",
				children: t
			}),
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "mb-5 max-w-[34em] text-[15px] leading-[1.65] text-muted-foreground",
				children: n
			}),
			/* @__PURE__ */ (0, X.jsx)("ul", {
				className: "mb-6 flex flex-col gap-2.5",
				children: r.map((e) => /* @__PURE__ */ (0, X.jsxs)("li", {
					className: "flex gap-2 text-[14px] leading-snug text-foreground",
					children: [/* @__PURE__ */ (0, X.jsx)("span", {
						className: "mt-1.5 size-1.5 shrink-0 rounded-full",
						style: { background: N.mint },
						"aria-hidden": !0
					}), /* @__PURE__ */ (0, X.jsx)("span", { children: e })]
				}, e))
			}),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "flex flex-wrap items-center gap-3",
				children: [
					/* @__PURE__ */ (0, X.jsx)("button", {
						type: "button",
						onClick: () => u("create"),
						className: "min-h-11 min-w-[200px] rounded-xl bg-primary px-5 py-4 text-[15px] font-bold text-primary-foreground",
						children: Mi.primaryCta
					}),
					/* @__PURE__ */ (0, X.jsx)("button", {
						type: "button",
						onClick: () => u("login"),
						className: "min-h-11 min-w-[180px] rounded-xl border border-border px-5 py-4 text-[15px] font-semibold",
						children: Mi.secondaryCta
					}),
					a ? /* @__PURE__ */ (0, X.jsx)("div", {
						className: "w-full font-mono text-[11px] text-muted-foreground",
						children: a
					}) : null
				]
			}),
			o ? /* @__PURE__ */ (0, X.jsx)("p", {
				className: "mt-8 max-w-[34em] border-t border-border pt-6 text-[14px] leading-[1.65] text-muted-foreground",
				children: o
			}) : null
		]
	}), f = /* @__PURE__ */ (0, X.jsx)(Pg, {
		items: s,
		title: c ?? t,
		stripLabel: i,
		maxColumns: l ? 3 : 2,
		fixedColumns: l ? 3 : void 0,
		cellSize: l ? 180 : 150,
		gap: l ? 12 : 10,
		radius: N.radiusPx
	}), p = /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "mt-14 flex flex-col items-start gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between",
		children: [/* @__PURE__ */ (0, X.jsx)("p", {
			className: "font-mono text-[12px] text-muted-foreground",
			children: "Ready when you are. Create a workspace or sign in."
		}), /* @__PURE__ */ (0, X.jsxs)("div", {
			className: "flex flex-wrap gap-3",
			children: [/* @__PURE__ */ (0, X.jsx)("button", {
				type: "button",
				onClick: () => u("create"),
				className: "inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-[14px] font-bold text-primary-foreground",
				children: Mi.primaryCta
			}), /* @__PURE__ */ (0, X.jsx)("button", {
				type: "button",
				onClick: () => u("login"),
				className: "inline-flex min-h-11 items-center rounded-xl border border-border px-5 text-[14px] font-semibold",
				children: Mi.secondaryCta
			})]
		})]
	});
	return l ? /* @__PURE__ */ (0, X.jsxs)("main", {
		className: "relative z-10 mx-auto w-full max-w-[1180px] px-8 pb-20",
		children: [/* @__PURE__ */ (0, X.jsxs)("div", {
			className: "grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start gap-10 pt-2",
			children: [d, f]
		}), p]
	}) : /* @__PURE__ */ (0, X.jsxs)("main", {
		className: "relative z-10 px-5 pb-16",
		children: [/* @__PURE__ */ (0, X.jsxs)("div", {
			className: "flex flex-col gap-8 pt-1",
			children: [d, f]
		}), p]
	});
}
//#endregion
//#region app/apex/pages/access-page.tsx
function e_() {
	let e = zi.access;
	return /* @__PURE__ */ (0, X.jsx)($g, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: Sg,
		boardTitle: "Access board"
	});
}
//#endregion
//#region app/apex/pages/campus-page.tsx
function t_() {
	let e = zi.campus;
	return /* @__PURE__ */ (0, X.jsx)($g, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: yg,
		boardTitle: "Campus rack"
	});
}
//#endregion
//#region app/apex/drawn-switch.tsx
function n_({ on: e, className: t = "", size: n = 48 }) {
	let r = Math.round(n * .58), i = r / 2, a = r - 6, o = e ? n - i : i;
	return /* @__PURE__ */ (0, X.jsxs)("svg", {
		width: n,
		height: r,
		viewBox: `0 0 ${n} ${r}`,
		className: `shrink-0 ${t}`,
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, X.jsx)("rect", {
			x: 0,
			y: 0,
			width: n,
			height: r,
			rx: i,
			fill: e ? N.mint : N.charcoal
		}), /* @__PURE__ */ (0, X.jsx)("circle", {
			cx: o,
			cy: i,
			r: a / 2,
			fill: e ? "#121314" : "#F4F4F5"
		})]
	});
}
//#endregion
//#region app/apex/hero-mosaic.tsx
var r_ = 13, i_ = "opacity-45";
function a_({ compact: e = !1 }) {
	let t = e ? "grid-rows-[36px_36px_36px]" : "grid-rows-[clamp(36px,5vw,48px)_clamp(36px,5vw,48px)_clamp(36px,5vw,48px)]", [n, r] = (0, _.useState)(0);
	return (0, _.useEffect)(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			r(r_);
			return;
		}
		let e = performance.now(), t = 0, n = (i) => {
			let a = Math.min(1, (i - e) / 700), o = 1 - (1 - a) ** 3;
			r(Math.round(r_ * o)), a < 1 && (t = requestAnimationFrame(n));
		};
		return t = requestAnimationFrame(n), () => cancelAnimationFrame(t);
	}, []), /* @__PURE__ */ (0, X.jsxs)("div", {
		className: `mb-4 grid w-full grid-cols-4 gap-1.5 ${t}`,
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, X.jsx)("span", {
				className: `col-span-2 rounded-[10px] ${i_}`,
				style: { background: N.mint }
			}),
			/* @__PURE__ */ (0, X.jsx)("span", {
				className: `col-span-2 rounded-[10px] ${i_}`,
				style: { background: N.charcoal }
			}),
			/* @__PURE__ */ (0, X.jsx)("span", {
				className: `rounded-[10px] ${i_}`,
				style: { background: N.coral }
			}),
			/* @__PURE__ */ (0, X.jsxs)("span", {
				className: "col-span-2 row-span-2 flex items-center justify-between gap-2 rounded-[10px] border border-white/20 p-2.5 text-white",
				style: { background: N.darkFace },
				children: [/* @__PURE__ */ (0, X.jsxs)("span", {
					className: "flex min-w-0 flex-col justify-center gap-0.5",
					children: [
						/* @__PURE__ */ (0, X.jsx)("span", {
							className: "font-mono text-[9px] tracking-[1.2px] uppercase",
							style: { color: N.mint },
							children: "On today"
						}),
						/* @__PURE__ */ (0, X.jsx)("span", {
							className: "font-mono text-[34px] font-extrabold leading-none tracking-tight md:text-[40px]",
							children: n
						}),
						/* @__PURE__ */ (0, X.jsxs)("span", {
							className: "text-[10px] text-white/55",
							children: [
								"of ",
								50,
								" modules"
							]
						})
					]
				}), /* @__PURE__ */ (0, X.jsx)(n_, {
					on: !0,
					size: e ? 36 : 44
				})]
			}),
			/* @__PURE__ */ (0, X.jsx)("span", {
				className: `rounded-[10px] ${i_}`,
				style: { background: N.blue }
			}),
			/* @__PURE__ */ (0, X.jsx)("span", {
				className: `rounded-[10px] ${i_}`,
				style: { background: N.gold }
			}),
			/* @__PURE__ */ (0, X.jsx)("span", {
				className: `rounded-[10px] ${i_}`,
				style: { background: N.midGray }
			})
		]
	});
}
//#endregion
//#region app/apex/sections/access-layers.tsx
var o_ = [
	N.gold,
	N.blueSoft,
	N.coral,
	N.charcoal,
	N.midGray,
	N.darkFace
];
function s_() {
	let e = zi.access;
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		"aria-labelledby": "access-layers-title",
		className: "mt-16 -mx-5 px-5 py-12 md:mt-20 md:-mx-8 md:rounded-[14px] md:px-8 md:py-14",
		style: { background: N.darkFace },
		children: [
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "mb-2 font-mono text-[12px] tracking-[0.14em] text-white/55 uppercase",
				children: e.eyebrow
			}),
			/* @__PURE__ */ (0, X.jsx)("h2", {
				id: "access-layers-title",
				className: "mb-3 text-[28px] font-extrabold tracking-[-1px] text-white md:text-[32px]",
				children: Ri.title
			}),
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "mb-2 max-w-[40em] text-[15px] font-semibold text-white",
				children: Ri.lead
			}),
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "mb-8 max-w-[46em] text-[14px] leading-[1.65] text-white/75",
				children: Ri.body
			}),
			/* @__PURE__ */ (0, X.jsx)("ul", {
				className: "mb-8 grid grid-cols-2 gap-3 md:grid-cols-3",
				children: Ri.layers.map((e, t) => {
					let n = o_[t] ?? N.midGray, r = n === N.charcoal || n === N.midGray || n === N.darkFace;
					return /* @__PURE__ */ (0, X.jsxs)("li", {
						className: `flex min-h-[110px] flex-col gap-2 border border-white/10 p-4 ${r ? "text-white" : "text-[#121314]"}`,
						style: {
							background: n,
							borderRadius: N.radiusPx
						},
						children: [
							/* @__PURE__ */ (0, X.jsx)("span", {
								className: `font-mono text-[11px] tracking-[0.12em] uppercase ${r ? "text-white/65" : "text-[#121314]/70"}`,
								children: e.n
							}),
							/* @__PURE__ */ (0, X.jsx)("h3", {
								className: "text-[15px] font-bold",
								children: e.title
							}),
							/* @__PURE__ */ (0, X.jsx)("p", {
								className: `text-[13px] leading-snug ${r ? "text-white/80" : "text-[#121314]/85"}`,
								children: e.body
							})
						]
					}, e.n);
				})
			}),
			/* @__PURE__ */ (0, X.jsx)("ul", {
				className: "flex flex-wrap gap-2",
				"aria-label": "Named roles",
				children: Ri.roles.map((e) => {
					let t = e === "guardian";
					return /* @__PURE__ */ (0, X.jsx)("li", { children: /* @__PURE__ */ (0, X.jsx)("span", {
						className: `inline-flex min-h-11 items-center rounded-full px-4 font-mono text-[12px] tracking-wide ${t ? "font-bold text-[#121314]" : "border border-white/25 bg-white/10 text-white"}`,
						style: t ? { background: N.mint } : void 0,
						children: e
					}) }, e);
				})
			})
		]
	});
}
//#endregion
//#region app/apex/sections/footer.tsx
var c_ = [
	{
		label: "Modules",
		href: "#/modules"
	},
	{
		label: "Security",
		href: "#/access"
	},
	{
		label: "Status",
		href: "#status"
	},
	{
		label: "Terms",
		href: "#terms"
	},
	{
		label: "Privacy",
		href: "#privacy"
	},
	{
		label: "Contact",
		href: "#contact"
	}
];
function l_() {
	let e = (/* @__PURE__ */ new Date()).getFullYear();
	return /* @__PURE__ */ (0, X.jsxs)("footer", {
		className: "mt-16 border-t border-border pt-10 pb-6 md:mt-20",
		children: [/* @__PURE__ */ (0, X.jsxs)("div", {
			className: "flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between",
			children: [/* @__PURE__ */ (0, X.jsx)("a", {
				href: "#/",
				className: "inline-flex min-h-11 items-center text-[22px] font-extrabold tracking-[-0.8px] text-foreground",
				"aria-label": Ai,
				children: Ai
			}), /* @__PURE__ */ (0, X.jsx)("nav", {
				"aria-label": "Footer",
				className: "flex flex-wrap gap-x-5 gap-y-1",
				children: c_.map((e) => /* @__PURE__ */ (0, X.jsx)("a", {
					href: e.href,
					className: "inline-flex min-h-11 items-center font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground",
					children: e.label
				}, e.label))
			})]
		}), /* @__PURE__ */ (0, X.jsxs)("p", {
			className: "mt-8 font-mono text-[11px] text-muted-foreground",
			children: [
				"© ",
				e,
				" [YOUR COMPANY]"
			]
		})]
	});
}
//#endregion
//#region node_modules/clsx/dist/clsx.mjs
function u_(e) {
	var t, n, r = "";
	if (typeof e == "string" || typeof e == "number") r += e;
	else if (typeof e == "object") {
		if (Array.isArray(e)) {
			var i = e.length;
			for (t = 0; t < i; t++) e[t] && (n = u_(e[t])) && (r && (r += " "), r += n);
		} else for (n in e) e[n] && (r && (r += " "), r += n);
	}
	return r;
}
function d_() {
	for (var e, t, n = 0, r = "", i = arguments.length; n < i; n++) (e = arguments[n]) && (t = u_(e)) && (r && (r += " "), r += t);
	return r;
}
//#endregion
//#region node_modules/tailwind-merge/dist/bundle-mjs.mjs
var f_ = (e, t) => {
	let n = Array(e.length + t.length);
	for (let t = 0; t < e.length; t++) n[t] = e[t];
	for (let r = 0; r < t.length; r++) n[e.length + r] = t[r];
	return n;
}, p_ = (e, t) => ({
	classGroupId: e,
	validator: t
}), m_ = (e = /* @__PURE__ */ new Map(), t = null, n) => ({
	nextPart: e,
	validators: t,
	classGroupId: n
}), h_ = "-", g_ = [], __ = "arbitrary..", v_ = (e) => {
	let t = x_(e), { conflictingClassGroups: n, conflictingClassGroupModifiers: r } = e;
	return {
		getClassGroupId: (e) => {
			if (e.startsWith("[") && e.endsWith("]")) return b_(e);
			let n = e.split(h_);
			return y_(n, +(n[0] === "" && n.length > 1), t);
		},
		getConflictingClassGroupIds: (e, t) => {
			if (t) {
				let t = r[e], i = n[e];
				return t ? i ? f_(i, t) : t : i || g_;
			}
			return n[e] || g_;
		}
	};
}, y_ = (e, t, n) => {
	if (e.length - t === 0) return n.classGroupId;
	let r = e[t], i = n.nextPart.get(r);
	if (i) {
		let n = y_(e, t + 1, i);
		if (n) return n;
	}
	let a = n.validators;
	if (a === null) return;
	let o = t === 0 ? e.join(h_) : e.slice(t).join(h_), s = a.length;
	for (let e = 0; e < s; e++) {
		let t = a[e];
		if (t.validator(o)) return t.classGroupId;
	}
}, b_ = (e) => e.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
	let t = e.slice(1, -1), n = t.indexOf(":"), r = t.slice(0, n);
	return r ? __ + r : void 0;
})(), x_ = (e) => {
	let { theme: t, classGroups: n } = e;
	return S_(n, t);
}, S_ = (e, t) => {
	let n = m_();
	for (let r in e) {
		let i = e[r];
		C_(i, n, r, t);
	}
	return n;
}, C_ = (e, t, n, r) => {
	let i = e.length;
	for (let a = 0; a < i; a++) {
		let i = e[a];
		w_(i, t, n, r);
	}
}, w_ = (e, t, n, r) => {
	if (typeof e == "string") {
		T_(e, t, n);
		return;
	}
	if (typeof e == "function") {
		E_(e, t, n, r);
		return;
	}
	D_(e, t, n, r);
}, T_ = (e, t, n) => {
	let r = e === "" ? t : O_(t, e);
	r.classGroupId = n;
}, E_ = (e, t, n, r) => {
	if (k_(e)) {
		C_(e(r), t, n, r);
		return;
	}
	t.validators === null && (t.validators = []), t.validators.push(p_(n, e));
}, D_ = (e, t, n, r) => {
	let i = Object.entries(e), a = i.length;
	for (let e = 0; e < a; e++) {
		let [a, o] = i[e];
		C_(o, O_(t, a), n, r);
	}
}, O_ = (e, t) => {
	let n = e, r = t.split(h_), i = r.length;
	for (let e = 0; e < i; e++) {
		let t = r[e], i = n.nextPart.get(t);
		i || (i = m_(), n.nextPart.set(t, i)), n = i;
	}
	return n;
}, k_ = (e) => "isThemeGetter" in e && e.isThemeGetter === !0, A_ = (e) => {
	if (e < 1) return {
		get: () => void 0,
		set: () => {}
	};
	let t = 0, n = Object.create(null), r = Object.create(null), i = (i, a) => {
		n[i] = a, t++, t > e && (t = 0, r = n, n = Object.create(null));
	};
	return {
		get(e) {
			let t = n[e];
			if (t !== void 0) return t;
			if ((t = r[e]) !== void 0) return i(e, t), t;
		},
		set(e, t) {
			e in n ? n[e] = t : i(e, t);
		}
	};
}, j_ = "!", M_ = ":", N_ = [], P_ = (e, t, n, r, i) => ({
	modifiers: e,
	hasImportantModifier: t,
	baseClassName: n,
	maybePostfixModifierPosition: r,
	isExternal: i
}), F_ = (e) => {
	let { prefix: t, experimentalParseClassName: n } = e, r = (e) => {
		let t = [], n = 0, r = 0, i = 0, a, o = e.length;
		for (let s = 0; s < o; s++) {
			let o = e[s];
			if (n === 0 && r === 0) {
				if (o === M_) {
					t.push(e.slice(i, s)), i = s + 1;
					continue;
				}
				if (o === "/") {
					a = s;
					continue;
				}
			}
			o === "[" ? n++ : o === "]" ? n-- : o === "(" ? r++ : o === ")" && r--;
		}
		let s = t.length === 0 ? e : e.slice(i), c = s, l = !1;
		s.endsWith(j_) ? (c = s.slice(0, -1), l = !0) : s.startsWith(j_) && (c = s.slice(1), l = !0);
		let u = a && a > i ? a - i : void 0;
		return P_(t, l, c, u);
	};
	if (t) {
		let e = t + M_, n = r;
		r = (t) => t.startsWith(e) ? n(t.slice(e.length)) : P_(N_, !1, t, void 0, !0);
	}
	if (n) {
		let e = r;
		r = (t) => n({
			className: t,
			parseClassName: e
		});
	}
	return r;
}, I_ = (e) => {
	let t = /* @__PURE__ */ new Map();
	return e.orderSensitiveModifiers.forEach((e, n) => {
		t.set(e, 1e6 + n);
	}), (e) => {
		let n = [], r = [];
		for (let i = 0; i < e.length; i++) {
			let a = e[i], o = a[0] === "[", s = t.has(a);
			o || s ? (r.length > 0 && (r.sort(), n.push(...r), r = []), n.push(a)) : r.push(a);
		}
		return r.length > 0 && (r.sort(), n.push(...r)), n;
	};
}, L_ = (e) => ({
	cache: A_(e.cacheSize),
	parseClassName: F_(e),
	sortModifiers: I_(e),
	postfixLookupClassGroupIds: R_(e),
	...v_(e)
}), R_ = (e) => {
	let t = Object.create(null), n = e.postfixLookupClassGroups;
	if (n) for (let e = 0; e < n.length; e++) t[n[e]] = !0;
	return t;
}, z_ = /\s+/, B_ = (e, t) => {
	let { parseClassName: n, getClassGroupId: r, getConflictingClassGroupIds: i, sortModifiers: a, postfixLookupClassGroupIds: o } = t, s = [], c = e.trim().split(z_), l = "";
	for (let e = c.length - 1; e >= 0; --e) {
		let t = c[e], { isExternal: u, modifiers: d, hasImportantModifier: f, baseClassName: p, maybePostfixModifierPosition: m } = n(t);
		if (u) {
			l = t + (l.length > 0 ? " " + l : l);
			continue;
		}
		let h = !!m, g;
		if (h) {
			g = r(p.substring(0, m));
			let e = g && o[g] ? r(p) : void 0;
			e && e !== g && (g = e, h = !1);
		} else g = r(p);
		if (!g) {
			if (!h) {
				l = t + (l.length > 0 ? " " + l : l);
				continue;
			}
			if (g = r(p), !g) {
				l = t + (l.length > 0 ? " " + l : l);
				continue;
			}
			h = !1;
		}
		let _ = d.length === 0 ? "" : d.length === 1 ? d[0] : a(d).join(":"), v = f ? _ + j_ : _, y = v + g;
		if (s.indexOf(y) > -1) continue;
		s.push(y);
		let b = i(g, h);
		for (let e = 0; e < b.length; ++e) {
			let t = b[e];
			s.push(v + t);
		}
		l = t + (l.length > 0 ? " " + l : l);
	}
	return l;
}, V_ = (...e) => {
	let t = 0, n, r, i = "";
	for (; t < e.length;) (n = e[t++]) && (r = H_(n)) && (i && (i += " "), i += r);
	return i;
}, H_ = (e) => {
	if (typeof e == "string") return e;
	let t, n = "";
	for (let r = 0; r < e.length; r++) e[r] && (t = H_(e[r])) && (n && (n += " "), n += t);
	return n;
}, U_ = (e, ...t) => {
	let n, r, i, a, o = (o) => (n = L_(t.reduce((e, t) => t(e), e())), r = n.cache.get, i = n.cache.set, a = s, s(o)), s = (e) => {
		let t = r(e);
		if (t) return t;
		let a = B_(e, n);
		return i(e, a), a;
	};
	return a = o, (...e) => a(V_(...e));
}, W_ = [], G_ = (e) => {
	let t = (t) => t[e] || W_;
	return t.isThemeGetter = !0, t.themeKey = e, t;
}, K_ = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, q_ = /^\((?:(\w[\w-]*):)?(.+)\)$/i, J_ = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Y_ = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, X_ = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, Z_ = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Q_ = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, $_ = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, ev = (e) => J_.test(e), Z = (e) => !!e && !Number.isNaN(Number(e)), tv = (e) => !!e && Number.isInteger(Number(e)), nv = (e) => e.endsWith("%") && Z(e.slice(0, -1)), rv = (e) => Y_.test(e), iv = () => !0, av = (e) => X_.test(e) && !Z_.test(e), ov = () => !1, sv = (e) => Q_.test(e), cv = (e) => $_.test(e), lv = (e) => !Q(e) && !$(e), uv = (e) => e.startsWith("@container") && (e[10] === "/" && e[11] !== void 0 || e[11] === "s" && e[16] !== void 0 && e.startsWith("-size/", 10) || e[11] === "n" && e[18] !== void 0 && e.startsWith("-normal/", 10)), dv = (e) => Ev(e, Av, ov), Q = (e) => K_.test(e), fv = (e) => Ev(e, jv, av), pv = (e) => Ev(e, Mv, Z), mv = (e) => Ev(e, Pv, iv), hv = (e) => Ev(e, Nv, ov), gv = (e) => Ev(e, Ov, ov), _v = (e) => Ev(e, kv, cv), vv = (e) => Ev(e, Fv, sv), $ = (e) => q_.test(e), yv = (e) => Dv(e, jv), bv = (e) => Dv(e, Nv), xv = (e) => Dv(e, Ov), Sv = (e) => Dv(e, Av), Cv = (e) => Dv(e, kv), wv = (e) => Dv(e, Fv, !0), Tv = (e) => Dv(e, Pv, !0), Ev = (e, t, n) => {
	let r = K_.exec(e);
	return r ? r[1] ? t(r[1]) : n(r[2]) : !1;
}, Dv = (e, t, n = !1) => {
	let r = q_.exec(e);
	return r ? r[1] ? t(r[1]) : n : !1;
}, Ov = (e) => e === "position" || e === "percentage", kv = (e) => e === "image" || e === "url", Av = (e) => e === "length" || e === "size" || e === "bg-size", jv = (e) => e === "length", Mv = (e) => e === "number", Nv = (e) => e === "family-name", Pv = (e) => e === "number" || e === "weight", Fv = (e) => e === "shadow", Iv = /*#__PURE__*/ U_(() => {
	let e = G_("color"), t = G_("font"), n = G_("text"), r = G_("font-weight"), i = G_("tracking"), a = G_("leading"), o = G_("breakpoint"), s = G_("container"), c = G_("spacing"), l = G_("radius"), u = G_("shadow"), d = G_("inset-shadow"), f = G_("text-shadow"), p = G_("drop-shadow"), m = G_("blur"), h = G_("perspective"), g = G_("aspect"), _ = G_("ease"), v = G_("animate"), y = () => [
		"auto",
		"avoid",
		"all",
		"avoid-page",
		"page",
		"left",
		"right",
		"column"
	], b = () => [
		"center",
		"top",
		"bottom",
		"left",
		"right",
		"top-left",
		"left-top",
		"top-right",
		"right-top",
		"bottom-right",
		"right-bottom",
		"bottom-left",
		"left-bottom"
	], x = () => [
		...b(),
		$,
		Q
	], S = () => [
		"auto",
		"hidden",
		"clip",
		"visible",
		"scroll"
	], C = () => [
		"auto",
		"contain",
		"none"
	], w = () => [
		$,
		Q,
		c
	], T = () => [
		ev,
		"full",
		"auto",
		...w()
	], E = () => [
		tv,
		"none",
		"subgrid",
		$,
		Q
	], D = () => [
		"auto",
		{ span: [
			"full",
			tv,
			$,
			Q
		] },
		tv,
		$,
		Q
	], ee = () => [
		tv,
		"auto",
		$,
		Q
	], te = () => [
		"auto",
		"min",
		"max",
		"fr",
		$,
		Q
	], ne = () => [
		"start",
		"end",
		"center",
		"between",
		"around",
		"evenly",
		"stretch",
		"baseline",
		"center-safe",
		"end-safe"
	], re = () => [
		"start",
		"end",
		"center",
		"stretch",
		"center-safe",
		"end-safe"
	], ie = () => ["auto", ...w()], ae = () => [
		ev,
		"auto",
		"full",
		"dvw",
		"dvh",
		"lvw",
		"lvh",
		"svw",
		"svh",
		"min",
		"max",
		"fit",
		...w()
	], oe = () => [
		s,
		ev,
		"screen",
		"full",
		"dvw",
		"lvw",
		"svw",
		"min",
		"max",
		"fit",
		...w()
	], se = () => [
		ev,
		"screen",
		"full",
		"lh",
		"dvh",
		"lvh",
		"svh",
		"min",
		"max",
		"fit",
		...w()
	], O = () => [
		e,
		$,
		Q
	], ce = () => [
		...b(),
		xv,
		gv,
		{ position: [$, Q] }
	], le = () => ["no-repeat", { repeat: [
		"",
		"x",
		"y",
		"space",
		"round"
	] }], ue = () => [
		"auto",
		"cover",
		"contain",
		Sv,
		dv,
		{ size: [$, Q] }
	], de = () => [
		nv,
		yv,
		fv
	], fe = () => [
		"",
		"none",
		"full",
		l,
		$,
		Q
	], pe = () => [
		"",
		Z,
		yv,
		fv
	], me = () => [
		"solid",
		"dashed",
		"dotted",
		"double"
	], he = () => [
		"normal",
		"multiply",
		"screen",
		"overlay",
		"darken",
		"lighten",
		"color-dodge",
		"color-burn",
		"hard-light",
		"soft-light",
		"difference",
		"exclusion",
		"hue",
		"saturation",
		"color",
		"luminosity"
	], k = () => [
		Z,
		nv,
		xv,
		gv
	], ge = () => [
		"",
		"none",
		m,
		$,
		Q
	], _e = () => [
		"none",
		Z,
		$,
		Q
	], ve = () => [
		"none",
		Z,
		$,
		Q
	], ye = () => [
		Z,
		$,
		Q
	], be = () => [
		ev,
		"full",
		...w()
	];
	return {
		cacheSize: 500,
		theme: {
			animate: [
				"spin",
				"ping",
				"pulse",
				"bounce"
			],
			aspect: ["video"],
			blur: [rv],
			breakpoint: [rv],
			color: [iv],
			container: [rv],
			"drop-shadow": [rv],
			ease: [
				"in",
				"out",
				"in-out"
			],
			font: [lv],
			"font-weight": [
				"thin",
				"extralight",
				"light",
				"normal",
				"medium",
				"semibold",
				"bold",
				"extrabold",
				"black"
			],
			"inset-shadow": [rv],
			leading: [
				"none",
				"tight",
				"snug",
				"normal",
				"relaxed",
				"loose"
			],
			perspective: [
				"dramatic",
				"near",
				"normal",
				"midrange",
				"distant",
				"none"
			],
			radius: [rv],
			shadow: [rv],
			spacing: ["px", Z],
			text: [rv],
			"text-shadow": [rv],
			tracking: [
				"tighter",
				"tight",
				"normal",
				"wide",
				"wider",
				"widest"
			]
		},
		classGroups: {
			aspect: [{ aspect: [
				"auto",
				"square",
				ev,
				Q,
				$,
				g
			] }],
			container: ["container"],
			"container-type": [{ "@container": [
				"",
				"normal",
				"size",
				$,
				Q
			] }],
			"container-named": [uv],
			columns: [{ columns: [
				Z,
				"auto",
				Q,
				$,
				s
			] }],
			"break-after": [{ "break-after": y() }],
			"break-before": [{ "break-before": y() }],
			"break-inside": [{ "break-inside": [
				"auto",
				"avoid",
				"avoid-page",
				"avoid-column"
			] }],
			"box-decoration": [{ "box-decoration": ["slice", "clone"] }],
			box: [{ box: ["border", "content"] }],
			display: [
				"block",
				"inline-block",
				"inline",
				"flex",
				"inline-flex",
				"table",
				"inline-table",
				"table-caption",
				"table-cell",
				"table-column",
				"table-column-group",
				"table-footer-group",
				"table-header-group",
				"table-row-group",
				"table-row",
				"flow-root",
				"grid",
				"inline-grid",
				"contents",
				"list-item",
				"hidden"
			],
			sr: ["sr-only", "not-sr-only"],
			float: [{ float: [
				"right",
				"left",
				"none",
				"start",
				"end"
			] }],
			clear: [{ clear: [
				"left",
				"right",
				"both",
				"none",
				"start",
				"end"
			] }],
			isolation: ["isolate", "isolation-auto"],
			"object-fit": [{ object: [
				"contain",
				"cover",
				"fill",
				"none",
				"scale-down"
			] }],
			"object-position": [{ object: x() }],
			overflow: [{ overflow: S() }],
			"overflow-x": [{ "overflow-x": S() }],
			"overflow-y": [{ "overflow-y": S() }],
			overscroll: [{ overscroll: C() }],
			"overscroll-x": [{ "overscroll-x": C() }],
			"overscroll-y": [{ "overscroll-y": C() }],
			position: [
				"static",
				"fixed",
				"absolute",
				"relative",
				"sticky"
			],
			inset: [{ inset: T() }],
			"inset-x": [{ "inset-x": T() }],
			"inset-y": [{ "inset-y": T() }],
			start: [{
				"inset-s": T(),
				start: T()
			}],
			end: [{
				"inset-e": T(),
				end: T()
			}],
			"inset-bs": [{ "inset-bs": T() }],
			"inset-be": [{ "inset-be": T() }],
			top: [{ top: T() }],
			right: [{ right: T() }],
			bottom: [{ bottom: T() }],
			left: [{ left: T() }],
			visibility: [
				"visible",
				"invisible",
				"collapse"
			],
			z: [{ z: [
				tv,
				"auto",
				$,
				Q
			] }],
			basis: [{ basis: [
				ev,
				"full",
				"auto",
				s,
				...w()
			] }],
			"flex-direction": [{ flex: [
				"row",
				"row-reverse",
				"col",
				"col-reverse"
			] }],
			"flex-wrap": [{ flex: [
				"nowrap",
				"wrap",
				"wrap-reverse"
			] }],
			flex: [{ flex: [
				Z,
				ev,
				"auto",
				"initial",
				"none",
				Q
			] }],
			grow: [{ grow: [
				"",
				Z,
				$,
				Q
			] }],
			shrink: [{ shrink: [
				"",
				Z,
				$,
				Q
			] }],
			order: [{ order: [
				tv,
				"first",
				"last",
				"none",
				$,
				Q
			] }],
			"grid-cols": [{ "grid-cols": E() }],
			"col-start-end": [{ col: D() }],
			"col-start": [{ "col-start": ee() }],
			"col-end": [{ "col-end": ee() }],
			"grid-rows": [{ "grid-rows": E() }],
			"row-start-end": [{ row: D() }],
			"row-start": [{ "row-start": ee() }],
			"row-end": [{ "row-end": ee() }],
			"grid-flow": [{ "grid-flow": [
				"row",
				"col",
				"dense",
				"row-dense",
				"col-dense"
			] }],
			"auto-cols": [{ "auto-cols": te() }],
			"auto-rows": [{ "auto-rows": te() }],
			gap: [{ gap: w() }],
			"gap-x": [{ "gap-x": w() }],
			"gap-y": [{ "gap-y": w() }],
			"justify-content": [{ justify: [...ne(), "normal"] }],
			"justify-items": [{ "justify-items": [...re(), "normal"] }],
			"justify-self": [{ "justify-self": ["auto", ...re()] }],
			"align-content": [{ content: ["normal", ...ne()] }],
			"align-items": [{ items: [...re(), { baseline: ["", "last"] }] }],
			"align-self": [{ self: [
				"auto",
				...re(),
				{ baseline: ["", "last"] }
			] }],
			"place-content": [{ "place-content": ne() }],
			"place-items": [{ "place-items": [...re(), "baseline"] }],
			"place-self": [{ "place-self": ["auto", ...re()] }],
			p: [{ p: w() }],
			px: [{ px: w() }],
			py: [{ py: w() }],
			ps: [{ ps: w() }],
			pe: [{ pe: w() }],
			pbs: [{ pbs: w() }],
			pbe: [{ pbe: w() }],
			pt: [{ pt: w() }],
			pr: [{ pr: w() }],
			pb: [{ pb: w() }],
			pl: [{ pl: w() }],
			m: [{ m: ie() }],
			mx: [{ mx: ie() }],
			my: [{ my: ie() }],
			ms: [{ ms: ie() }],
			me: [{ me: ie() }],
			mbs: [{ mbs: ie() }],
			mbe: [{ mbe: ie() }],
			mt: [{ mt: ie() }],
			mr: [{ mr: ie() }],
			mb: [{ mb: ie() }],
			ml: [{ ml: ie() }],
			"space-x": [{ "space-x": w() }],
			"space-x-reverse": ["space-x-reverse"],
			"space-y": [{ "space-y": w() }],
			"space-y-reverse": ["space-y-reverse"],
			size: [{ size: ae() }],
			"inline-size": [{ inline: ["auto", ...oe()] }],
			"min-inline-size": [{ "min-inline": ["auto", ...oe()] }],
			"max-inline-size": [{ "max-inline": ["none", ...oe()] }],
			"block-size": [{ block: ["auto", ...se()] }],
			"min-block-size": [{ "min-block": ["auto", ...se()] }],
			"max-block-size": [{ "max-block": ["none", ...se()] }],
			w: [{ w: [
				s,
				"screen",
				...ae()
			] }],
			"min-w": [{ "min-w": [
				s,
				"screen",
				"none",
				...ae()
			] }],
			"max-w": [{ "max-w": [
				s,
				"screen",
				"none",
				"prose",
				{ screen: [o] },
				...ae()
			] }],
			h: [{ h: [
				"screen",
				"lh",
				...ae()
			] }],
			"min-h": [{ "min-h": [
				"screen",
				"lh",
				"none",
				...ae()
			] }],
			"max-h": [{ "max-h": [
				"screen",
				"lh",
				"none",
				...ae()
			] }],
			"font-size": [{ text: [
				"base",
				n,
				yv,
				fv
			] }],
			"font-smoothing": ["antialiased", "subpixel-antialiased"],
			"font-style": ["italic", "not-italic"],
			"font-weight": [{ font: [
				r,
				Tv,
				mv
			] }],
			"font-stretch": [{ "font-stretch": [
				"ultra-condensed",
				"extra-condensed",
				"condensed",
				"semi-condensed",
				"normal",
				"semi-expanded",
				"expanded",
				"extra-expanded",
				"ultra-expanded",
				nv,
				Q
			] }],
			"font-family": [{ font: [
				bv,
				hv,
				t
			] }],
			"font-features": [{ "font-features": [Q] }],
			"fvn-normal": ["normal-nums"],
			"fvn-ordinal": ["ordinal"],
			"fvn-slashed-zero": ["slashed-zero"],
			"fvn-figure": ["lining-nums", "oldstyle-nums"],
			"fvn-spacing": ["proportional-nums", "tabular-nums"],
			"fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
			tracking: [{ tracking: [
				i,
				$,
				Q
			] }],
			"line-clamp": [{ "line-clamp": [
				Z,
				"none",
				$,
				pv
			] }],
			leading: [{ leading: [
				"none",
				a,
				...w()
			] }],
			"list-image": [{ "list-image": [
				"none",
				$,
				Q
			] }],
			"list-style-position": [{ list: ["inside", "outside"] }],
			"list-style-type": [{ list: [
				"disc",
				"decimal",
				"none",
				$,
				Q
			] }],
			"text-alignment": [{ text: [
				"left",
				"center",
				"right",
				"justify",
				"start",
				"end"
			] }],
			"placeholder-color": [{ placeholder: O() }],
			"text-color": [{ text: O() }],
			"text-decoration": [
				"underline",
				"overline",
				"line-through",
				"no-underline"
			],
			"text-decoration-style": [{ decoration: [...me(), "wavy"] }],
			"text-decoration-thickness": [{ decoration: [
				Z,
				"from-font",
				"auto",
				$,
				fv
			] }],
			"text-decoration-color": [{ decoration: O() }],
			"underline-offset": [{ "underline-offset": [
				Z,
				"auto",
				$,
				Q
			] }],
			"text-transform": [
				"uppercase",
				"lowercase",
				"capitalize",
				"normal-case"
			],
			"text-overflow": [
				"truncate",
				"text-ellipsis",
				"text-clip"
			],
			"text-wrap": [{ text: [
				"wrap",
				"nowrap",
				"balance",
				"pretty"
			] }],
			indent: [{ indent: w() }],
			"tab-size": [{ tab: [
				tv,
				$,
				Q
			] }],
			"vertical-align": [{ align: [
				"baseline",
				"top",
				"middle",
				"bottom",
				"text-top",
				"text-bottom",
				"sub",
				"super",
				$,
				Q
			] }],
			whitespace: [{ whitespace: [
				"normal",
				"nowrap",
				"pre",
				"pre-line",
				"pre-wrap",
				"break-spaces"
			] }],
			break: [{ break: [
				"normal",
				"words",
				"all",
				"keep"
			] }],
			wrap: [{ wrap: [
				"break-word",
				"anywhere",
				"normal"
			] }],
			hyphens: [{ hyphens: [
				"none",
				"manual",
				"auto"
			] }],
			content: [{ content: [
				"none",
				$,
				Q
			] }],
			"bg-attachment": [{ bg: [
				"fixed",
				"local",
				"scroll"
			] }],
			"bg-clip": [{ "bg-clip": [
				"border",
				"padding",
				"content",
				"text"
			] }],
			"bg-origin": [{ "bg-origin": [
				"border",
				"padding",
				"content"
			] }],
			"bg-position": [{ bg: ce() }],
			"bg-repeat": [{ bg: le() }],
			"bg-size": [{ bg: ue() }],
			"bg-image": [{ bg: [
				"none",
				{
					linear: [
						{ to: [
							"t",
							"tr",
							"r",
							"br",
							"b",
							"bl",
							"l",
							"tl"
						] },
						tv,
						$,
						Q
					],
					radial: [
						"",
						$,
						Q
					],
					conic: [
						"",
						tv,
						$,
						Q
					]
				},
				Cv,
				_v
			] }],
			"bg-color": [{ bg: O() }],
			"gradient-from-pos": [{ from: de() }],
			"gradient-via-pos": [{ via: de() }],
			"gradient-to-pos": [{ to: de() }],
			"gradient-from": [{ from: O() }],
			"gradient-via": [{ via: O() }],
			"gradient-to": [{ to: O() }],
			rounded: [{ rounded: fe() }],
			"rounded-s": [{ "rounded-s": fe() }],
			"rounded-e": [{ "rounded-e": fe() }],
			"rounded-t": [{ "rounded-t": fe() }],
			"rounded-r": [{ "rounded-r": fe() }],
			"rounded-b": [{ "rounded-b": fe() }],
			"rounded-l": [{ "rounded-l": fe() }],
			"rounded-ss": [{ "rounded-ss": fe() }],
			"rounded-se": [{ "rounded-se": fe() }],
			"rounded-ee": [{ "rounded-ee": fe() }],
			"rounded-es": [{ "rounded-es": fe() }],
			"rounded-tl": [{ "rounded-tl": fe() }],
			"rounded-tr": [{ "rounded-tr": fe() }],
			"rounded-br": [{ "rounded-br": fe() }],
			"rounded-bl": [{ "rounded-bl": fe() }],
			"border-w": [{ border: pe() }],
			"border-w-x": [{ "border-x": pe() }],
			"border-w-y": [{ "border-y": pe() }],
			"border-w-s": [{ "border-s": pe() }],
			"border-w-e": [{ "border-e": pe() }],
			"border-w-bs": [{ "border-bs": pe() }],
			"border-w-be": [{ "border-be": pe() }],
			"border-w-t": [{ "border-t": pe() }],
			"border-w-r": [{ "border-r": pe() }],
			"border-w-b": [{ "border-b": pe() }],
			"border-w-l": [{ "border-l": pe() }],
			"divide-x": [{ "divide-x": pe() }],
			"divide-x-reverse": ["divide-x-reverse"],
			"divide-y": [{ "divide-y": pe() }],
			"divide-y-reverse": ["divide-y-reverse"],
			"border-style": [{ border: [
				...me(),
				"hidden",
				"none"
			] }],
			"divide-style": [{ divide: [
				...me(),
				"hidden",
				"none"
			] }],
			"border-color": [{ border: O() }],
			"border-color-x": [{ "border-x": O() }],
			"border-color-y": [{ "border-y": O() }],
			"border-color-s": [{ "border-s": O() }],
			"border-color-e": [{ "border-e": O() }],
			"border-color-bs": [{ "border-bs": O() }],
			"border-color-be": [{ "border-be": O() }],
			"border-color-t": [{ "border-t": O() }],
			"border-color-r": [{ "border-r": O() }],
			"border-color-b": [{ "border-b": O() }],
			"border-color-l": [{ "border-l": O() }],
			"divide-color": [{ divide: O() }],
			"outline-style": [{ outline: [
				...me(),
				"none",
				"hidden"
			] }],
			"outline-offset": [{ "outline-offset": [
				Z,
				$,
				Q
			] }],
			"outline-w": [{ outline: [
				"",
				Z,
				yv,
				fv
			] }],
			"outline-color": [{ outline: O() }],
			shadow: [{ shadow: [
				"",
				"inner",
				"none",
				u,
				wv,
				vv
			] }],
			"shadow-color": [{ shadow: O() }],
			"inset-shadow": [{ "inset-shadow": [
				"none",
				d,
				wv,
				vv
			] }],
			"inset-shadow-color": [{ "inset-shadow": O() }],
			"ring-w": [{ ring: pe() }],
			"ring-w-inset": ["ring-inset"],
			"ring-color": [{ ring: O() }],
			"ring-offset-w": [{ "ring-offset": [Z, fv] }],
			"ring-offset-color": [{ "ring-offset": O() }],
			"inset-ring-w": [{ "inset-ring": pe() }],
			"inset-ring-color": [{ "inset-ring": O() }],
			"text-shadow": [{ "text-shadow": [
				"none",
				f,
				wv,
				vv
			] }],
			"text-shadow-color": [{ "text-shadow": O() }],
			opacity: [{ opacity: [
				Z,
				$,
				Q
			] }],
			"mix-blend": [{ "mix-blend": [
				...he(),
				"plus-darker",
				"plus-lighter"
			] }],
			"bg-blend": [{ "bg-blend": he() }],
			"mask-clip": [{ "mask-clip": [
				"border",
				"padding",
				"content",
				"fill",
				"stroke",
				"view"
			] }, "mask-no-clip"],
			"mask-composite": [{ mask: [
				"add",
				"subtract",
				"intersect",
				"exclude"
			] }],
			"mask-image-linear-pos": [{ "mask-linear": [Z] }],
			"mask-image-linear-from-pos": [{ "mask-linear-from": k() }],
			"mask-image-linear-to-pos": [{ "mask-linear-to": k() }],
			"mask-image-linear-from-color": [{ "mask-linear-from": O() }],
			"mask-image-linear-to-color": [{ "mask-linear-to": O() }],
			"mask-image-t-from-pos": [{ "mask-t-from": k() }],
			"mask-image-t-to-pos": [{ "mask-t-to": k() }],
			"mask-image-t-from-color": [{ "mask-t-from": O() }],
			"mask-image-t-to-color": [{ "mask-t-to": O() }],
			"mask-image-r-from-pos": [{ "mask-r-from": k() }],
			"mask-image-r-to-pos": [{ "mask-r-to": k() }],
			"mask-image-r-from-color": [{ "mask-r-from": O() }],
			"mask-image-r-to-color": [{ "mask-r-to": O() }],
			"mask-image-b-from-pos": [{ "mask-b-from": k() }],
			"mask-image-b-to-pos": [{ "mask-b-to": k() }],
			"mask-image-b-from-color": [{ "mask-b-from": O() }],
			"mask-image-b-to-color": [{ "mask-b-to": O() }],
			"mask-image-l-from-pos": [{ "mask-l-from": k() }],
			"mask-image-l-to-pos": [{ "mask-l-to": k() }],
			"mask-image-l-from-color": [{ "mask-l-from": O() }],
			"mask-image-l-to-color": [{ "mask-l-to": O() }],
			"mask-image-x-from-pos": [{ "mask-x-from": k() }],
			"mask-image-x-to-pos": [{ "mask-x-to": k() }],
			"mask-image-x-from-color": [{ "mask-x-from": O() }],
			"mask-image-x-to-color": [{ "mask-x-to": O() }],
			"mask-image-y-from-pos": [{ "mask-y-from": k() }],
			"mask-image-y-to-pos": [{ "mask-y-to": k() }],
			"mask-image-y-from-color": [{ "mask-y-from": O() }],
			"mask-image-y-to-color": [{ "mask-y-to": O() }],
			"mask-image-radial": [{ "mask-radial": [$, Q] }],
			"mask-image-radial-from-pos": [{ "mask-radial-from": k() }],
			"mask-image-radial-to-pos": [{ "mask-radial-to": k() }],
			"mask-image-radial-from-color": [{ "mask-radial-from": O() }],
			"mask-image-radial-to-color": [{ "mask-radial-to": O() }],
			"mask-image-radial-shape": [{ "mask-radial": ["circle", "ellipse"] }],
			"mask-image-radial-size": [{ "mask-radial": [{
				closest: ["side", "corner"],
				farthest: ["side", "corner"]
			}] }],
			"mask-image-radial-pos": [{ "mask-radial-at": b() }],
			"mask-image-conic-pos": [{ "mask-conic": [Z] }],
			"mask-image-conic-from-pos": [{ "mask-conic-from": k() }],
			"mask-image-conic-to-pos": [{ "mask-conic-to": k() }],
			"mask-image-conic-from-color": [{ "mask-conic-from": O() }],
			"mask-image-conic-to-color": [{ "mask-conic-to": O() }],
			"mask-mode": [{ mask: [
				"alpha",
				"luminance",
				"match"
			] }],
			"mask-origin": [{ "mask-origin": [
				"border",
				"padding",
				"content",
				"fill",
				"stroke",
				"view"
			] }],
			"mask-position": [{ mask: ce() }],
			"mask-repeat": [{ mask: le() }],
			"mask-size": [{ mask: ue() }],
			"mask-type": [{ "mask-type": ["alpha", "luminance"] }],
			"mask-image": [{ mask: [
				"none",
				$,
				Q
			] }],
			filter: [{ filter: [
				"",
				"none",
				$,
				Q
			] }],
			blur: [{ blur: ge() }],
			brightness: [{ brightness: [
				Z,
				$,
				Q
			] }],
			contrast: [{ contrast: [
				Z,
				$,
				Q
			] }],
			"drop-shadow": [{ "drop-shadow": [
				"",
				"none",
				p,
				wv,
				vv
			] }],
			"drop-shadow-color": [{ "drop-shadow": O() }],
			grayscale: [{ grayscale: [
				"",
				Z,
				$,
				Q
			] }],
			"hue-rotate": [{ "hue-rotate": [
				Z,
				$,
				Q
			] }],
			invert: [{ invert: [
				"",
				Z,
				$,
				Q
			] }],
			saturate: [{ saturate: [
				Z,
				$,
				Q
			] }],
			sepia: [{ sepia: [
				"",
				Z,
				$,
				Q
			] }],
			"backdrop-filter": [{ "backdrop-filter": [
				"",
				"none",
				$,
				Q
			] }],
			"backdrop-blur": [{ "backdrop-blur": ge() }],
			"backdrop-brightness": [{ "backdrop-brightness": [
				Z,
				$,
				Q
			] }],
			"backdrop-contrast": [{ "backdrop-contrast": [
				Z,
				$,
				Q
			] }],
			"backdrop-grayscale": [{ "backdrop-grayscale": [
				"",
				Z,
				$,
				Q
			] }],
			"backdrop-hue-rotate": [{ "backdrop-hue-rotate": [
				Z,
				$,
				Q
			] }],
			"backdrop-invert": [{ "backdrop-invert": [
				"",
				Z,
				$,
				Q
			] }],
			"backdrop-opacity": [{ "backdrop-opacity": [
				Z,
				$,
				Q
			] }],
			"backdrop-saturate": [{ "backdrop-saturate": [
				Z,
				$,
				Q
			] }],
			"backdrop-sepia": [{ "backdrop-sepia": [
				"",
				Z,
				$,
				Q
			] }],
			"border-collapse": [{ border: ["collapse", "separate"] }],
			"border-spacing": [{ "border-spacing": w() }],
			"border-spacing-x": [{ "border-spacing-x": w() }],
			"border-spacing-y": [{ "border-spacing-y": w() }],
			"table-layout": [{ table: ["auto", "fixed"] }],
			caption: [{ caption: ["top", "bottom"] }],
			transition: [{ transition: [
				"",
				"all",
				"colors",
				"opacity",
				"shadow",
				"transform",
				"none",
				$,
				Q
			] }],
			"transition-behavior": [{ transition: ["normal", "discrete"] }],
			duration: [{ duration: [
				Z,
				"initial",
				$,
				Q
			] }],
			ease: [{ ease: [
				"linear",
				"initial",
				_,
				$,
				Q
			] }],
			delay: [{ delay: [
				Z,
				$,
				Q
			] }],
			animate: [{ animate: [
				"none",
				v,
				$,
				Q
			] }],
			backface: [{ backface: ["hidden", "visible"] }],
			perspective: [{ perspective: [
				h,
				$,
				Q
			] }],
			"perspective-origin": [{ "perspective-origin": x() }],
			rotate: [{ rotate: _e() }],
			"rotate-x": [{ "rotate-x": _e() }],
			"rotate-y": [{ "rotate-y": _e() }],
			"rotate-z": [{ "rotate-z": _e() }],
			scale: [{ scale: ve() }],
			"scale-x": [{ "scale-x": ve() }],
			"scale-y": [{ "scale-y": ve() }],
			"scale-z": [{ "scale-z": ve() }],
			"scale-3d": ["scale-3d"],
			skew: [{ skew: ye() }],
			"skew-x": [{ "skew-x": ye() }],
			"skew-y": [{ "skew-y": ye() }],
			transform: [{ transform: [
				$,
				Q,
				"",
				"none",
				"gpu",
				"cpu"
			] }],
			"transform-origin": [{ origin: x() }],
			"transform-style": [{ transform: ["3d", "flat"] }],
			translate: [{ translate: be() }],
			"translate-x": [{ "translate-x": be() }],
			"translate-y": [{ "translate-y": be() }],
			"translate-z": [{ "translate-z": be() }],
			"translate-none": ["translate-none"],
			zoom: [{ zoom: [
				tv,
				$,
				Q
			] }],
			accent: [{ accent: O() }],
			appearance: [{ appearance: ["none", "auto"] }],
			"caret-color": [{ caret: O() }],
			"color-scheme": [{ scheme: [
				"normal",
				"dark",
				"light",
				"light-dark",
				"only-dark",
				"only-light"
			] }],
			cursor: [{ cursor: [
				"auto",
				"default",
				"pointer",
				"wait",
				"text",
				"move",
				"help",
				"not-allowed",
				"none",
				"context-menu",
				"progress",
				"cell",
				"crosshair",
				"vertical-text",
				"alias",
				"copy",
				"no-drop",
				"grab",
				"grabbing",
				"all-scroll",
				"col-resize",
				"row-resize",
				"n-resize",
				"e-resize",
				"s-resize",
				"w-resize",
				"ne-resize",
				"nw-resize",
				"se-resize",
				"sw-resize",
				"ew-resize",
				"ns-resize",
				"nesw-resize",
				"nwse-resize",
				"zoom-in",
				"zoom-out",
				$,
				Q
			] }],
			"field-sizing": [{ "field-sizing": ["fixed", "content"] }],
			"pointer-events": [{ "pointer-events": ["auto", "none"] }],
			resize: [{ resize: [
				"none",
				"",
				"y",
				"x"
			] }],
			"scroll-behavior": [{ scroll: ["auto", "smooth"] }],
			"scrollbar-thumb-color": [{ "scrollbar-thumb": O() }],
			"scrollbar-track-color": [{ "scrollbar-track": O() }],
			"scrollbar-gutter": [{ "scrollbar-gutter": [
				"auto",
				"stable",
				"both"
			] }],
			"scrollbar-w": [{ scrollbar: [
				"auto",
				"thin",
				"none"
			] }],
			"scroll-m": [{ "scroll-m": w() }],
			"scroll-mx": [{ "scroll-mx": w() }],
			"scroll-my": [{ "scroll-my": w() }],
			"scroll-ms": [{ "scroll-ms": w() }],
			"scroll-me": [{ "scroll-me": w() }],
			"scroll-mbs": [{ "scroll-mbs": w() }],
			"scroll-mbe": [{ "scroll-mbe": w() }],
			"scroll-mt": [{ "scroll-mt": w() }],
			"scroll-mr": [{ "scroll-mr": w() }],
			"scroll-mb": [{ "scroll-mb": w() }],
			"scroll-ml": [{ "scroll-ml": w() }],
			"scroll-p": [{ "scroll-p": w() }],
			"scroll-px": [{ "scroll-px": w() }],
			"scroll-py": [{ "scroll-py": w() }],
			"scroll-ps": [{ "scroll-ps": w() }],
			"scroll-pe": [{ "scroll-pe": w() }],
			"scroll-pbs": [{ "scroll-pbs": w() }],
			"scroll-pbe": [{ "scroll-pbe": w() }],
			"scroll-pt": [{ "scroll-pt": w() }],
			"scroll-pr": [{ "scroll-pr": w() }],
			"scroll-pb": [{ "scroll-pb": w() }],
			"scroll-pl": [{ "scroll-pl": w() }],
			"snap-align": [{ snap: [
				"start",
				"end",
				"center",
				"align-none"
			] }],
			"snap-stop": [{ snap: ["normal", "always"] }],
			"snap-type": [{ snap: [
				"none",
				"x",
				"y",
				"both"
			] }],
			"snap-strictness": [{ snap: ["mandatory", "proximity"] }],
			touch: [{ touch: [
				"auto",
				"none",
				"manipulation"
			] }],
			"touch-x": [{ "touch-pan": [
				"x",
				"left",
				"right"
			] }],
			"touch-y": [{ "touch-pan": [
				"y",
				"up",
				"down"
			] }],
			"touch-pz": ["touch-pinch-zoom"],
			select: [{ select: [
				"none",
				"text",
				"all",
				"auto"
			] }],
			"will-change": [{ "will-change": [
				"auto",
				"scroll",
				"contents",
				"transform",
				$,
				Q
			] }],
			fill: [{ fill: ["none", ...O()] }],
			"stroke-w": [{ stroke: [
				Z,
				yv,
				fv,
				pv
			] }],
			stroke: [{ stroke: ["none", ...O()] }],
			"forced-color-adjust": [{ "forced-color-adjust": ["auto", "none"] }]
		},
		conflictingClassGroups: {
			"container-named": ["container-type"],
			overflow: ["overflow-x", "overflow-y"],
			overscroll: ["overscroll-x", "overscroll-y"],
			inset: [
				"inset-x",
				"inset-y",
				"inset-bs",
				"inset-be",
				"start",
				"end",
				"top",
				"right",
				"bottom",
				"left"
			],
			"inset-x": [
				"start",
				"end",
				"right",
				"left"
			],
			"inset-y": [
				"inset-bs",
				"inset-be",
				"top",
				"bottom"
			],
			flex: [
				"basis",
				"grow",
				"shrink"
			],
			gap: ["gap-x", "gap-y"],
			p: [
				"px",
				"py",
				"ps",
				"pe",
				"pbs",
				"pbe",
				"pt",
				"pr",
				"pb",
				"pl"
			],
			px: [
				"ps",
				"pe",
				"pr",
				"pl"
			],
			py: [
				"pbs",
				"pbe",
				"pt",
				"pb"
			],
			m: [
				"mx",
				"my",
				"ms",
				"me",
				"mbs",
				"mbe",
				"mt",
				"mr",
				"mb",
				"ml"
			],
			mx: [
				"ms",
				"me",
				"mr",
				"ml"
			],
			my: [
				"mbs",
				"mbe",
				"mt",
				"mb"
			],
			size: ["w", "h"],
			"font-size": ["leading"],
			"fvn-normal": [
				"fvn-ordinal",
				"fvn-slashed-zero",
				"fvn-figure",
				"fvn-spacing",
				"fvn-fraction"
			],
			"fvn-ordinal": ["fvn-normal"],
			"fvn-slashed-zero": ["fvn-normal"],
			"fvn-figure": ["fvn-normal"],
			"fvn-spacing": ["fvn-normal"],
			"fvn-fraction": ["fvn-normal"],
			"line-clamp": ["display", "overflow"],
			rounded: [
				"rounded-s",
				"rounded-e",
				"rounded-t",
				"rounded-r",
				"rounded-b",
				"rounded-l",
				"rounded-ss",
				"rounded-se",
				"rounded-ee",
				"rounded-es",
				"rounded-tl",
				"rounded-tr",
				"rounded-br",
				"rounded-bl"
			],
			"rounded-s": ["rounded-ss", "rounded-es"],
			"rounded-e": ["rounded-se", "rounded-ee"],
			"rounded-t": ["rounded-tl", "rounded-tr"],
			"rounded-r": ["rounded-tr", "rounded-br"],
			"rounded-b": ["rounded-br", "rounded-bl"],
			"rounded-l": ["rounded-tl", "rounded-bl"],
			"border-spacing": ["border-spacing-x", "border-spacing-y"],
			"border-w": [
				"border-w-x",
				"border-w-y",
				"border-w-s",
				"border-w-e",
				"border-w-bs",
				"border-w-be",
				"border-w-t",
				"border-w-r",
				"border-w-b",
				"border-w-l"
			],
			"border-w-x": [
				"border-w-s",
				"border-w-e",
				"border-w-r",
				"border-w-l"
			],
			"border-w-y": [
				"border-w-bs",
				"border-w-be",
				"border-w-t",
				"border-w-b"
			],
			"border-color": [
				"border-color-x",
				"border-color-y",
				"border-color-s",
				"border-color-e",
				"border-color-bs",
				"border-color-be",
				"border-color-t",
				"border-color-r",
				"border-color-b",
				"border-color-l"
			],
			"border-color-x": [
				"border-color-s",
				"border-color-e",
				"border-color-r",
				"border-color-l"
			],
			"border-color-y": [
				"border-color-bs",
				"border-color-be",
				"border-color-t",
				"border-color-b"
			],
			translate: [
				"translate-x",
				"translate-y",
				"translate-none"
			],
			"translate-none": [
				"translate",
				"translate-x",
				"translate-y",
				"translate-z"
			],
			"scroll-m": [
				"scroll-mx",
				"scroll-my",
				"scroll-ms",
				"scroll-me",
				"scroll-mbs",
				"scroll-mbe",
				"scroll-mt",
				"scroll-mr",
				"scroll-mb",
				"scroll-ml"
			],
			"scroll-mx": [
				"scroll-ms",
				"scroll-me",
				"scroll-mr",
				"scroll-ml"
			],
			"scroll-my": [
				"scroll-mbs",
				"scroll-mbe",
				"scroll-mt",
				"scroll-mb"
			],
			"scroll-p": [
				"scroll-px",
				"scroll-py",
				"scroll-ps",
				"scroll-pe",
				"scroll-pbs",
				"scroll-pbe",
				"scroll-pt",
				"scroll-pr",
				"scroll-pb",
				"scroll-pl"
			],
			"scroll-px": [
				"scroll-ps",
				"scroll-pe",
				"scroll-pr",
				"scroll-pl"
			],
			"scroll-py": [
				"scroll-pbs",
				"scroll-pbe",
				"scroll-pt",
				"scroll-pb"
			],
			touch: [
				"touch-x",
				"touch-y",
				"touch-pz"
			],
			"touch-x": ["touch"],
			"touch-y": ["touch"],
			"touch-pz": ["touch"]
		},
		conflictingClassGroupModifiers: { "font-size": ["leading"] },
		postfixLookupClassGroups: ["container-type"],
		orderSensitiveModifiers: [
			"*",
			"**",
			"after",
			"backdrop",
			"before",
			"details-content",
			"file",
			"first-letter",
			"first-line",
			"marker",
			"placeholder",
			"selection"
		]
	};
});
//#endregion
//#region lib/utils.ts
function Lv(...e) {
	return Iv(d_(e));
}
//#endregion
//#region components/ui/carousel-squeeze.tsx
var Rv = (e) => typeof e == "number" ? `${e}px` : e, zv = (e, t, n) => Math.max(t, Math.min(n, e)), Bv = [
	-.06,
	.61,
	.3,
	.15
], Vv = [
	0,
	.71,
	.4,
	.25
], Hv = [
	-.12,
	.59,
	.28,
	.13
];
function Uv() {
	let [e, t] = (0, _.useState)(!1);
	return (0, _.useEffect)(() => {
		let e = window.matchMedia("(prefers-reduced-motion: reduce)"), n = () => t(e.matches);
		return n(), e.addEventListener("change", n), () => e.removeEventListener("change", n);
	}, []), e;
}
function Wv({ slides: e, defaultIndex: t = 0, onIndexChange: n, height: r = "clamp(180px, 32cqi, 340px)", slatWidth: i = 8, slatGap: a = 8, gap: o = 16, radius: s = 6, duration: c = 1e3, hoverGrow: l = !0, autoplay: u = !1, interval: d = 6e3, controls: f = !0, accent: p = "var(--sq-accent, var(--primary, currentColor))", accentForeground: m = "var(--sq-accent-foreground, var(--primary-foreground, white))", label: h = "Featured", panelClassName: g, className: v, style: y, ...b }) {
	let x = e.length, S = (e) => (e % x + x) % x, C = zv(x - 4, 1, 3), w = 4 + C, T = Uv(), E = T ? 0 : c, D = (0, _.useId)(), ee = (0, _.useRef)(0), te = (0, _.useRef)(null), [ne, re] = (0, _.useState)(() => Array.from({ length: w }, (e, n) => ({
		key: ee.current++,
		slide: S(t + n)
	}))), [ie, ae] = (0, _.useState)(0), oe = (0, _.useRef)(0), se = (0, _.useRef)(!0), [O, ce] = (0, _.useState)(0), [le, ue] = (0, _.useState)(!1), [de, fe] = (0, _.useState)(-1), pe = ne[-ie]?.slide ?? t, me = (0, _.useRef)([]);
	(0, _.useEffect)(() => () => me.current.forEach(clearTimeout), []);
	let he = (0, _.useCallback)(() => {
		re((e) => se.current ? e.slice(-w) : e.slice(0, w)), oe.current = 0, ae(0), ce(0), ue(!0);
	}, [w]);
	(0, _.useLayoutEffect)(() => {
		if (!le) return;
		let e = requestAnimationFrame(() => ue(!1));
		return () => cancelAnimationFrame(e);
	}, [le]);
	let k = (0, _.useCallback)((e) => {
		x < 2 || e === 0 || (me.current.forEach(clearTimeout), me.current = [], se.current = e > 0, e > 0 ? (re((t) => [...t, ...Array.from({ length: e }, (e, n) => ({
			key: ee.current++,
			slide: S(t[t.length - 1].slide + 1 + n)
		}))]), oe.current -= e, ae(oe.current), ce((t) => t - e)) : (re((t) => [...Array.from({ length: -e }, (n, r) => ({
			key: ee.current++,
			slide: S(t[0].slide - (-e - r))
		})), ...t]), ce((t) => t + e), ue(!0), me.current.push(window.setTimeout(() => ce(0), 0))), me.current.push(window.setTimeout(he, E + 20)));
	}, [
		x,
		E,
		he
	]);
	(0, _.useEffect)(() => {
		n?.(pe);
	}, [pe]);
	let [ge, _e] = (0, _.useState)(!1);
	(0, _.useEffect)(() => {
		if (!u || ge || T || x < 2) return;
		let e = window.setTimeout(() => k(1), d);
		return () => clearTimeout(e);
	}, [
		u,
		ge,
		T,
		x,
		pe,
		d,
		k
	]);
	let ve = (e) => {
		let t = {
			ArrowRight: 1,
			ArrowLeft: -1
		}[e.key];
		t !== void 0 && (e.preventDefault(), k(t));
	};
	if (!x) return null;
	let ye = Rv(i), be = l && de >= 0 && de <= 3 && !T ? null : Bv, A = (e) => be ? Bv[e] : de === e ? Vv[e] : Hv[e], j = (e) => e < 0 || e > 3 ? ye : e === 0 ? `calc(var(--sq-hero) + var(--sq-room) * ${A(0)})` : `calc(var(--sq-room) * ${A(e)})`, xe = {
		"--sq-h": Rv(r),
		"--sq-gap": Rv(o),
		"--sq-slat-gap": Rv(a),
		"--sq-radius": Rv(s),
		"--sq-ms": `${E}ms`,
		"--sq-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
		"--sq-fill": p,
		"--sq-on-fill": m,
		"--sq-hero": "calc(var(--sq-h) * 16 / 9)",
		"--sq-room": `calc(100cqi - var(--sq-hero) - ${C} * var(--sq-slat-gap) - 3 * var(--sq-gap) - ${C} * ${ye})`
	}, Se = `translateX(calc(${O} * (${ye} + var(--sq-gap))))`;
	return /* @__PURE__ */ (0, X.jsxs)("div", {
		className: Lv("flex w-full flex-col", v),
		style: {
			containerType: "inline-size",
			...xe,
			...y
		},
		onMouseEnter: () => _e(!0),
		onMouseLeave: () => {
			_e(!1), fe(-1);
		},
		onFocusCapture: () => _e(!0),
		onBlurCapture: () => _e(!1),
		...b,
		children: [
			f && x > 1 && /* @__PURE__ */ (0, X.jsxs)("div", {
				className: "mb-4 flex justify-end gap-2",
				children: [/* @__PURE__ */ (0, X.jsx)(Kv, {
					back: !0,
					label: "Previous",
					onClick: () => k(-1)
				}), /* @__PURE__ */ (0, X.jsx)(Kv, {
					label: "Next",
					onClick: () => k(1)
				})]
			}),
			/* @__PURE__ */ (0, X.jsx)("div", {
				className: "w-full overflow-hidden",
				style: { height: "var(--sq-h)" },
				children: /* @__PURE__ */ (0, X.jsx)("div", {
					ref: te,
					role: "tablist",
					"aria-label": h,
					"aria-orientation": "horizontal",
					onKeyDown: ve,
					className: "flex h-full w-max",
					style: {
						transform: Se,
						transition: le ? "none" : "transform var(--sq-ms) var(--sq-ease)"
					},
					children: ne.map((t, n) => {
						let r = n + ie, i = e[t.slide], a = r === 0;
						return /* @__PURE__ */ (0, X.jsxs)("button", {
							type: "button",
							role: "tab",
							id: `${D}-tab-${t.key}`,
							"aria-selected": a,
							"aria-controls": `${D}-panel`,
							"aria-label": i.title,
							tabIndex: a ? 0 : -1,
							onMouseMove: () => l && fe(r),
							onClick: () => r > 0 && k(r),
							className: Lv("relative isolate h-full shrink-0 cursor-pointer overflow-hidden bg-muted p-0", "outline-none focus-visible:ring-2 focus-visible:ring-offset-2", "focus-visible:ring-[var(--sq-fill)] focus-visible:ring-offset-background", g),
							style: {
								width: j(r),
								marginLeft: n === 0 ? 0 : r < 4 ? "var(--sq-gap)" : "var(--sq-slat-gap)",
								borderRadius: `min(var(--sq-radius), calc(${j(r)} / 2))`,
								transitionProperty: "width, margin-left",
								transitionDuration: le ? "0s" : "var(--sq-ms)",
								transitionTimingFunction: "var(--sq-ease)"
							},
							children: [/* @__PURE__ */ (0, X.jsx)(Gv, { slide: i }), i.overlay && /* @__PURE__ */ (0, X.jsx)("span", {
								"aria-hidden": "true",
								className: "pointer-events-none absolute inset-x-0 bottom-0 flex items-end p-4 pt-16 @lg:p-6 @lg:pt-20",
								style: {
									opacity: +!!a,
									transition: "opacity var(--sq-ms) var(--sq-ease)",
									backgroundImage: "linear-gradient(to top, rgb(0 0 0 / 0.55), transparent)"
								},
								children: i.overlay
							})]
						}, t.key);
					})
				})
			}),
			/* @__PURE__ */ (0, X.jsx)("div", {
				id: `${D}-panel`,
				role: "tabpanel",
				"aria-live": "polite",
				className: "mt-6 grid @xl:mt-7",
				children: e.map((e, t) => {
					let n = t === pe;
					return /* @__PURE__ */ (0, X.jsxs)("div", {
						"aria-hidden": !n,
						className: Lv("col-start-1 row-start-1 flex flex-col gap-4", "@xl:flex-row @xl:items-start @xl:justify-between @xl:gap-10"),
						style: {
							opacity: +!!n,
							visibility: n ? "visible" : "hidden",
							pointerEvents: n ? "auto" : "none",
							transition: "opacity var(--sq-ms) var(--sq-ease), visibility var(--sq-ms)"
						},
						children: [/* @__PURE__ */ (0, X.jsxs)("p", {
							className: "max-w-[46rem] text-[15px] leading-[1.6] text-balance @lg:text-[17px]",
							children: [
								/* @__PURE__ */ (0, X.jsx)("span", {
									className: "text-foreground",
									children: e.title
								}),
								" ",
								e.description && /* @__PURE__ */ (0, X.jsx)("span", {
									className: "text-muted-foreground",
									children: e.description
								})
							]
						}), e.action && /* @__PURE__ */ (0, X.jsx)(qv, {
							slide: e,
							shown: n
						})]
					}, e.id ?? t);
				})
			})
		]
	});
}
function Gv({ slide: e }) {
	let t = {
		width: "var(--sq-hero)",
		minWidth: "100%"
	};
	return e.image ? /* @__PURE__ */ (0, X.jsx)("img", {
		src: e.image,
		alt: e.imageAlt ?? "",
		draggable: !1,
		className: "absolute inset-y-0 left-1/2 h-full max-w-none -translate-x-1/2 object-cover",
		style: t
	}) : /* @__PURE__ */ (0, X.jsx)("span", {
		"aria-hidden": "true",
		className: "absolute inset-y-0 left-1/2 -translate-x-1/2",
		style: {
			background: e.background,
			...t
		}
	});
}
function Kv({ back: e = !1, label: t, onClick: n }) {
	return /* @__PURE__ */ (0, X.jsx)("button", {
		type: "button",
		"aria-label": t,
		onClick: n,
		className: Lv("grid size-11 min-h-11 min-w-11 cursor-pointer place-items-center rounded-md", "bg-[var(--sq-fill)] text-[var(--sq-on-fill)]", "transition-opacity hover:opacity-85 outline-none", "focus-visible:ring-2 focus-visible:ring-[var(--sq-fill)]", "focus-visible:ring-offset-2 focus-visible:ring-offset-background"),
		children: /* @__PURE__ */ (0, X.jsx)("svg", {
			width: "16",
			height: "16",
			viewBox: "0 0 16 16",
			fill: "currentColor",
			"aria-hidden": "true",
			children: /* @__PURE__ */ (0, X.jsx)("path", { d: e ? "M9.6 2.6 5.1 7.1h9.1v1.8H5.1l4.5 4.5-1.2 1.2-6-6L1.8 8l.6-.6 6-6 1.2 1.2Z" : "M6.4 2.6l4.5 4.5H1.8v1.8h9.1l-4.5 4.5 1.2 1.2 6-6 .6-.6-.6-.6-6-6-1.2 1.2Z" })
		})
	});
}
function qv({ slide: e, shown: t }) {
	let n = /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [e.action, /* @__PURE__ */ (0, X.jsx)("svg", {
		width: "6",
		height: "9",
		viewBox: "0 0 6 9",
		fill: "none",
		"aria-hidden": "true",
		className: "transition-transform duration-200 group-hover/sq-action:translate-x-0.5",
		children: /* @__PURE__ */ (0, X.jsx)("path", {
			d: "M1.2 1 4.7 4.5 1.2 8",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	})] }), r = Lv("group/sq-action inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md", "bg-[var(--sq-fill)] px-4 py-2.5 text-sm font-medium text-[var(--sq-on-fill)]", "transition-opacity hover:opacity-85 outline-none", "focus-visible:ring-2 focus-visible:ring-[var(--sq-fill)]", "focus-visible:ring-offset-2 focus-visible:ring-offset-background");
	return e.href ? /* @__PURE__ */ (0, X.jsx)("a", {
		href: e.href,
		target: e.target,
		rel: e.target === "_blank" ? "noreferrer" : void 0,
		tabIndex: t ? 0 : -1,
		onClick: e.onAction,
		className: r,
		children: n
	}) : /* @__PURE__ */ (0, X.jsx)("button", {
		type: "button",
		tabIndex: t ? 0 : -1,
		onClick: e.onAction,
		className: r,
		children: n
	});
}
//#endregion
//#region app/apex/sections/module-carousel.tsx
var Jv = (e) => /* @__PURE__ */ (0, X.jsx)("span", {
	className: "text-sm font-medium tracking-tight text-white",
	style: { fontFamily: "var(--font-display)" },
	children: e
}), Yv = [
	{
		id: "roll-call",
		title: "Roll call",
		description: "Section presence, live for teachers.",
		background: N.gold,
		overlay: Jv("Roll call")
	},
	{
		id: "clock-in",
		title: "Clock-in",
		description: "Clock-in and regularizations on the core rack.",
		background: N.blueSoft,
		overlay: Jv("Clock-in")
	},
	{
		id: "leaves",
		title: "Leaves",
		description: "Policies and balances when you switch them on.",
		background: N.mint,
		overlay: Jv("Leaves")
	},
	{
		id: "timetable",
		title: "Timetable",
		description: "Slots, cover, and instances on the campus rack.",
		background: N.coral,
		overlay: Jv("Timetable")
	},
	{
		id: "report-cards",
		title: "Report cards",
		description: "Publish when marks lock; parents see only what you release.",
		background: N.charcoal,
		overlay: Jv("Report cards")
	},
	{
		id: "face-capture",
		title: "Face capture",
		description: "Biometrics when you are ready, as an add-on.",
		background: N.midGray,
		overlay: Jv("Face capture")
	}
];
function Xv() {
	return /* @__PURE__ */ (0, X.jsx)("section", {
		"aria-label": "Modules",
		className: "mt-16 overflow-x-clip md:mt-20",
		children: /* @__PURE__ */ (0, X.jsx)(Wv, {
			slides: Yv,
			label: "Modules",
			radius: N.radiusPx,
			accent: N.darkFace,
			accentForeground: "#ffffff",
			height: "clamp(180px, 32cqi, 320px)"
		})
	});
}
//#endregion
//#region app/apex/sections/racks.tsx
function Zv() {
	let e = [{
		key: "workforce",
		...Ii.workforce,
		shell: N.blueSoft
	}, {
		key: "campus",
		...Ii.campus,
		shell: N.gold
	}];
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		"aria-labelledby": "racks-title",
		className: "mt-16 md:mt-20",
		children: [
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase",
				children: Ii.subtitle
			}),
			/* @__PURE__ */ (0, X.jsx)("h2", {
				id: "racks-title",
				className: "mb-6 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]",
				children: Ii.title
			}),
			/* @__PURE__ */ (0, X.jsx)("ul", {
				className: "grid gap-4 md:grid-cols-2",
				children: e.map((e) => /* @__PURE__ */ (0, X.jsxs)("li", {
					className: "flex flex-col gap-3 border border-[#121314]/12 p-5 text-[#121314] md:p-6",
					style: {
						background: e.shell,
						borderRadius: N.radiusPx
					},
					children: [/* @__PURE__ */ (0, X.jsx)("h3", {
						className: "text-[18px] font-bold tracking-tight",
						children: e.name
					}), /* @__PURE__ */ (0, X.jsx)("p", {
						className: "text-[14px] leading-[1.65] text-[#121314]/85",
						children: e.body
					})]
				}, e.key))
			})
		]
	});
}
//#endregion
//#region app/apex/sections/setup-steps.tsx
var Qv = [
	N.gold,
	N.blueSoft,
	N.coral,
	N.charcoal
];
function $v() {
	let e = zi.setup;
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		"aria-labelledby": "setup-steps-title",
		className: "mt-16 grid gap-8 md:mt-20 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:items-start md:gap-10",
		children: [/* @__PURE__ */ (0, X.jsxs)("div", { children: [
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase",
				children: e.eyebrow
			}),
			/* @__PURE__ */ (0, X.jsx)("h2", {
				id: "setup-steps-title",
				className: "mb-3 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]",
				children: e.title
			}),
			/* @__PURE__ */ (0, X.jsx)("p", {
				className: "max-w-[28em] text-[14px] leading-[1.65] text-muted-foreground",
				children: e.lede
			})
		] }), /* @__PURE__ */ (0, X.jsx)("ul", {
			className: "grid grid-cols-2 gap-3",
			children: Li.map((e, t) => {
				let n = Qv[t] ?? N.gold, r = n === N.charcoal;
				return /* @__PURE__ */ (0, X.jsxs)("li", {
					className: `flex min-h-[120px] flex-col gap-2 p-4 ${r ? "text-white" : "text-[#121314]"}`,
					style: {
						background: n,
						borderRadius: N.radiusPx
					},
					children: [
						/* @__PURE__ */ (0, X.jsx)("span", {
							className: `font-mono text-[11px] tracking-[0.12em] uppercase ${r ? "text-white/70" : "text-[#121314]/70"}`,
							children: e.n
						}),
						/* @__PURE__ */ (0, X.jsx)("h3", {
							className: "text-[16px] font-bold",
							children: e.title
						}),
						/* @__PURE__ */ (0, X.jsx)("p", {
							className: `text-[13px] leading-snug ${r ? "text-white/85" : "text-[#121314]/85"}`,
							children: e.body
						})
					]
				}, e.n);
			})
		})]
	});
}
//#endregion
//#region app/apex/sections/stats-band.tsx
var ey = [
	N.mint,
	N.gold,
	N.blueSoft,
	N.coral
];
function ty() {
	return /* @__PURE__ */ (0, X.jsx)("section", {
		"aria-label": "Product stats",
		className: "mt-16 md:mt-20",
		children: /* @__PURE__ */ (0, X.jsx)("ul", {
			className: "grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4",
			children: Fi.map((e, t) => /* @__PURE__ */ (0, X.jsxs)("li", {
				className: "flex min-h-11 flex-col justify-between p-4 text-[#121314]",
				style: {
					background: ey[t] ?? N.mint,
					borderRadius: N.radiusPx
				},
				children: [/* @__PURE__ */ (0, X.jsx)("span", {
					className: "font-mono text-[28px] font-extrabold leading-none tracking-tight md:text-[32px]",
					children: e.value
				}), /* @__PURE__ */ (0, X.jsx)("span", {
					className: "mt-3 text-[13px] leading-snug font-medium",
					children: e.label
				})]
			}, e.label))
		})
	});
}
//#endregion
//#region app/apex/pages/home-page.tsx
function ny() {
	return /* @__PURE__ */ (0, X.jsx)("section", {
		"aria-label": "Customer proof",
		className: "mt-16 border-t border-border pt-10 md:mt-20",
		children: /* @__PURE__ */ (0, X.jsx)("ul", {
			className: "grid gap-4 sm:grid-cols-3",
			children: Pi.map((e) => /* @__PURE__ */ (0, X.jsx)("li", {
				className: "rounded-[14px] border border-[#121314]/12 px-4 py-5 font-mono text-[13px] leading-relaxed text-muted-foreground",
				children: e
			}, e))
		})
	});
}
function ry() {
	let e = Qg(), { openSignup: t } = Yg();
	return /* @__PURE__ */ (0, X.jsxs)("main", {
		className: "relative z-10 mx-auto w-full max-w-[1180px] px-5 pb-16 md:px-8 md:pb-20",
		children: [
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "md:grid md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] md:items-start md:gap-10 md:pt-2",
				children: [/* @__PURE__ */ (0, X.jsxs)("section", {
					className: "mb-6 flex flex-col justify-start bg-white pt-0 md:mb-0 dark:bg-black",
					"aria-labelledby": "landingHeadline",
					children: [
						/* @__PURE__ */ (0, X.jsx)(a_, { compact: !e }),
						/* @__PURE__ */ (0, X.jsx)("p", {
							className: "mb-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase md:text-[12px]",
							children: Mi.eyebrow
						}),
						/* @__PURE__ */ (0, X.jsx)("h1", {
							id: "landingHeadline",
							className: "mb-3 text-[32px] font-extrabold leading-[1.05] tracking-[-1.4px] md:text-[44px] md:leading-[1.02] md:tracking-[-1.8px] xl:text-[52px]",
							children: Mi.headline
						}),
						/* @__PURE__ */ (0, X.jsx)("p", {
							className: "mb-5 max-w-[34em] text-[15px] leading-[1.65] text-muted-foreground md:mb-6",
							children: Mi.lede
						}),
						/* @__PURE__ */ (0, X.jsxs)("div", {
							className: "flex max-w-[360px] flex-col gap-3 md:max-w-none md:flex-row md:flex-wrap md:items-center",
							children: [
								/* @__PURE__ */ (0, X.jsx)("button", {
									type: "button",
									onClick: () => t("create"),
									className: "min-h-11 w-full rounded-xl bg-primary px-5 py-4 text-[15px] font-bold text-primary-foreground md:min-w-[200px] md:w-auto",
									children: Mi.primaryCta
								}),
								/* @__PURE__ */ (0, X.jsx)("button", {
									type: "button",
									onClick: () => t("login"),
									className: "min-h-11 w-full rounded-xl border border-border px-5 py-4 text-[15px] font-semibold md:min-w-[180px] md:w-auto",
									children: Mi.secondaryCta
								}),
								/* @__PURE__ */ (0, X.jsx)("div", {
									className: "w-full text-center font-mono text-[11px] text-muted-foreground md:text-left",
									children: Mi.meta
								})
							]
						}),
						/* @__PURE__ */ (0, X.jsxs)("p", {
							className: "mt-3 text-center font-mono text-[11px] text-muted-foreground md:mt-5 md:text-left",
							children: [
								"Admin › Features · ",
								50,
								" modules",
								/* @__PURE__ */ (0, X.jsx)("span", {
									className: "hidden md:inline",
									children: " in the rack"
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, X.jsx)(Pg, {
					items: _g,
					stripLabel: Bi,
					maxColumns: e ? 3 : 2,
					fixedColumns: e ? 3 : void 0,
					cellSize: e ? 180 : 150,
					gap: e ? 12 : 10,
					radius: N.radiusPx
				})]
			}),
			/* @__PURE__ */ (0, X.jsx)(ty, {}),
			/* @__PURE__ */ (0, X.jsx)(Xv, {}),
			/* @__PURE__ */ (0, X.jsx)(Zv, {}),
			/* @__PURE__ */ (0, X.jsx)($v, {}),
			/* @__PURE__ */ (0, X.jsx)(s_, {}),
			/* @__PURE__ */ (0, X.jsx)(ny, {}),
			/* @__PURE__ */ (0, X.jsx)(l_, {})
		]
	});
}
//#endregion
//#region app/apex/pages/modules-page.tsx
function iy() {
	let e = zi.modules;
	return /* @__PURE__ */ (0, X.jsx)($g, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: vg,
		boardTitle: "Modules rack"
	});
}
//#endregion
//#region app/apex/pages/pricing-page.tsx
function ay() {
	let e = zi.pricing;
	return /* @__PURE__ */ (0, X.jsx)($g, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: Cg,
		boardTitle: "Pricing board"
	});
}
//#endregion
//#region app/apex/pages/setup-page.tsx
function oy() {
	let e = zi.setup;
	return /* @__PURE__ */ (0, X.jsx)($g, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: xg,
		boardTitle: "Setup board"
	});
}
//#endregion
//#region app/apex/pages/workforce-page.tsx
function sy() {
	let e = zi.workforce;
	return /* @__PURE__ */ (0, X.jsx)($g, {
		eyebrow: e.eyebrow,
		title: e.title,
		lede: e.lede,
		bullets: e.bullets,
		stripLabel: e.stripLabel,
		meta: e.meta,
		aside: e.aside,
		widgets: bg,
		boardTitle: "Workforce rack"
	});
}
//#endregion
//#region app/apex/router.tsx
function cy({ status: e, api: t, navigate: n }) {
	return /* @__PURE__ */ (0, X.jsx)(On, { children: /* @__PURE__ */ (0, X.jsx)(Wt, { children: /* @__PURE__ */ (0, X.jsxs)(Ht, {
		element: /* @__PURE__ */ (0, X.jsx)(Xg, {
			status: e,
			api: t,
			navigate: n
		}),
		children: [
			/* @__PURE__ */ (0, X.jsx)(Ht, {
				index: !0,
				element: /* @__PURE__ */ (0, X.jsx)(ry, {})
			}),
			/* @__PURE__ */ (0, X.jsx)(Ht, {
				path: "modules",
				element: /* @__PURE__ */ (0, X.jsx)(iy, {})
			}),
			/* @__PURE__ */ (0, X.jsx)(Ht, {
				path: "setup",
				element: /* @__PURE__ */ (0, X.jsx)(oy, {})
			}),
			/* @__PURE__ */ (0, X.jsx)(Ht, {
				path: "access",
				element: /* @__PURE__ */ (0, X.jsx)(e_, {})
			}),
			/* @__PURE__ */ (0, X.jsx)(Ht, {
				path: "campus",
				element: /* @__PURE__ */ (0, X.jsx)(t_, {})
			}),
			/* @__PURE__ */ (0, X.jsx)(Ht, {
				path: "workforce",
				element: /* @__PURE__ */ (0, X.jsx)(sy, {})
			}),
			/* @__PURE__ */ (0, X.jsx)(Ht, {
				path: "pricing",
				element: /* @__PURE__ */ (0, X.jsx)(ay, {})
			}),
			/* @__PURE__ */ (0, X.jsx)(Ht, {
				path: "*",
				element: /* @__PURE__ */ (0, X.jsx)(Bt, {
					to: "/",
					replace: !0
				})
			})
		]
	}) }) });
}
//#endregion
//#region app/apex/page.tsx
function ly(e) {
	return /* @__PURE__ */ (0, X.jsx)(Kg, { children: /* @__PURE__ */ (0, X.jsx)("div", {
		className: "landing-root min-h-screen",
		children: /* @__PURE__ */ (0, X.jsx)(cy, { ...e })
	}) });
}
//#endregion
//#region src/apex-mount.tsx
var uy = null;
function dy(e, t, n) {
	e && (uy &&= (uy.unmount(), null), uy = (0, Bn.createRoot)(e), uy.render(/* @__PURE__ */ (0, X.jsx)(ly, {
		status: t || {},
		api: n?.api,
		navigate: n?.navigate
	})));
}
function fy() {
	uy &&= (uy.unmount(), null);
}
//#endregion
export { ly as ApexPage, dy as mountApexLanding, fy as unmountApexLanding };
