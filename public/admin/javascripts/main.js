(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
/**
 * Service for sending network requests.
 */

var xhr = require('./lib/xhr');
var jsonp = require('./lib/jsonp');
var Promise = require('./lib/promise');

module.exports = function (_) {

    var originUrl = _.url.parse(location.href);
    var jsonType = {'Content-Type': 'application/json;charset=utf-8'};

    function Http(url, options) {

        var promise;

        if (_.isPlainObject(url)) {
            options = url;
            url = '';
        }

        options = _.extend({url: url}, options);
        options = _.extend(true, {},
            Http.options, this.options, options
        );

        if (options.crossOrigin === null) {
            options.crossOrigin = crossOrigin(options.url);
        }

        options.method = options.method.toUpperCase();
        options.headers = _.extend({}, Http.headers.common,
            !options.crossOrigin ? Http.headers.custom : {},
            Http.headers[options.method.toLowerCase()],
            options.headers
        );

        if (_.isPlainObject(options.data) && /^(GET|JSONP)$/i.test(options.method)) {
            _.extend(options.params, options.data);
            delete options.data;
        }

        if (options.emulateHTTP && !options.crossOrigin && /^(PUT|PATCH|DELETE)$/i.test(options.method)) {
            options.headers['X-HTTP-Method-Override'] = options.method;
            options.method = 'POST';
        }

        if (options.emulateJSON && _.isPlainObject(options.data)) {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.data = _.url.params(options.data);
        }

        if (_.isObject(options.data) && /FormData/i.test(options.data.toString())) {
            delete options.headers['Content-Type'];
        }

        if (_.isPlainObject(options.data)) {
            options.data = JSON.stringify(options.data);
        }

        promise = (options.method == 'JSONP' ? jsonp : xhr).call(this.vm, _, options);
        promise = extendPromise(promise.then(transformResponse, transformResponse), this.vm);

        if (options.success) {
            promise = promise.success(options.success);
        }

        if (options.error) {
            promise = promise.error(options.error);
        }

        return promise;
    }

    function extendPromise(promise, vm) {

        promise.success = function (fn) {

            return extendPromise(promise.then(function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            }), vm);

        };

        promise.error = function (fn) {

            return extendPromise(promise.then(undefined, function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            }), vm);

        };

        promise.always = function (fn) {

            var cb = function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            };

            return extendPromise(promise.then(cb, cb), vm);
        };

        return promise;
    }

    function transformResponse(response) {

        try {
            response.data = JSON.parse(response.responseText);
        } catch (e) {
            response.data = response.responseText;
        }

        return response.ok ? response : Promise.reject(response);
    }

    function crossOrigin(url) {

        var requestUrl = _.url.parse(url);

        return (requestUrl.protocol !== originUrl.protocol || requestUrl.host !== originUrl.host);
    }

    Http.options = {
        method: 'get',
        params: {},
        data: '',
        xhr: null,
        jsonp: 'callback',
        beforeSend: null,
        crossOrigin: null,
        emulateHTTP: false,
        emulateJSON: false
    };

    Http.headers = {
        put: jsonType,
        post: jsonType,
        patch: jsonType,
        delete: jsonType,
        common: {'Accept': 'application/json, text/plain, */*'},
        custom: {'X-Requested-With': 'XMLHttpRequest'}
    };

    ['get', 'put', 'post', 'patch', 'delete', 'jsonp'].forEach(function (method) {

        Http[method] = function (url, data, success, options) {

            if (_.isFunction(data)) {
                options = success;
                success = data;
                data = undefined;
            }

            return this(url, _.extend({method: method, data: data, success: success}, options));
        };
    });

    return _.http = Http;
};

},{"./lib/jsonp":4,"./lib/promise":5,"./lib/xhr":7}],3:[function(require,module,exports){
/**
 * Install plugin.
 */

function install(Vue) {

    var _ = require('./lib/util')(Vue);

    Vue.url = require('./url')(_);
    Vue.http = require('./http')(_);
    Vue.resource = require('./resource')(_);

    Object.defineProperties(Vue.prototype, {

        $url: {
            get: function () {
                return this._url || (this._url = _.options(Vue.url, this, this.$options.url));
            }
        },

        $http: {
            get: function () {
                return this._http || (this._http = _.options(Vue.http, this, this.$options.http));
            }
        },

        $resource: {
            get: function () {
                return Vue.resource.bind(this);
            }
        }

    });
}

if (window.Vue) {
    Vue.use(install);
}

module.exports = install;
},{"./http":2,"./lib/util":6,"./resource":8,"./url":9}],4:[function(require,module,exports){
/**
 * JSONP request.
 */

var Promise = require('./promise');

module.exports = function (_, options) {

    var callback = '_jsonp' + Math.random().toString(36).substr(2), response = {}, script, body;

    options.params[options.jsonp] = callback;

    if (_.isFunction(options.beforeSend)) {
        options.beforeSend.call(this, {}, options);
    }

    return new Promise(function (resolve, reject) {

        script = document.createElement('script');
        script.src = _.url(options);
        script.type = 'text/javascript';
        script.async = true;

        window[callback] = function (data) {
            body = data;
        };

        var handler = function (event) {

            delete window[callback];
            document.body.removeChild(script);

            if (event.type === 'load' && !body) {
                event.type = 'error';
            }

            response.ok = event.type !== 'error';
            response.status = response.ok ? 200 : 404;
            response.responseText = body ? body : event.type;

            (response.ok ? resolve : reject)(response);
        };

        script.onload = handler;
        script.onerror = handler;

        document.body.appendChild(script);
    });

};

},{"./promise":5}],5:[function(require,module,exports){
/**
 * Promises/A+ polyfill v1.1.0 (https://github.com/bramstein/promis)
 */

var RESOLVED = 0;
var REJECTED = 1;
var PENDING  = 2;

function Promise(executor) {

    this.state = PENDING;
    this.value = undefined;
    this.deferred = [];

    var promise = this;

    try {
        executor(function (x) {
            promise.resolve(x);
        }, function (r) {
            promise.reject(r);
        });
    } catch (e) {
        promise.reject(e);
    }
}

Promise.reject = function (r) {
    return new Promise(function (resolve, reject) {
        reject(r);
    });
};

Promise.resolve = function (x) {
    return new Promise(function (resolve, reject) {
        resolve(x);
    });
};

Promise.all = function all(iterable) {
    return new Promise(function (resolve, reject) {
        var count = 0,
            result = [];

        if (iterable.length === 0) {
            resolve(result);
        }

        function resolver(i) {
            return function (x) {
                result[i] = x;
                count += 1;

                if (count === iterable.length) {
                    resolve(result);
                }
            };
        }

        for (var i = 0; i < iterable.length; i += 1) {
            iterable[i].then(resolver(i), reject);
        }
    });
};

Promise.race = function race(iterable) {
    return new Promise(function (resolve, reject) {
        for (var i = 0; i < iterable.length; i += 1) {
            iterable[i].then(resolve, reject);
        }
    });
};

var p = Promise.prototype;

p.resolve = function resolve(x) {
    var promise = this;

    if (promise.state === PENDING) {
        if (x === promise) {
            throw new TypeError('Promise settled with itself.');
        }

        var called = false;

        try {
            var then = x && x['then'];

            if (x !== null && typeof x === 'object' && typeof then === 'function') {
                then.call(x, function (x) {
                    if (!called) {
                        promise.resolve(x);
                    }
                    called = true;

                }, function (r) {
                    if (!called) {
                        promise.reject(r);
                    }
                    called = true;
                });
                return;
            }
        } catch (e) {
            if (!called) {
                promise.reject(e);
            }
            return;
        }
        promise.state = RESOLVED;
        promise.value = x;
        promise.notify();
    }
};

p.reject = function reject(reason) {
    var promise = this;

    if (promise.state === PENDING) {
        if (reason === promise) {
            throw new TypeError('Promise settled with itself.');
        }

        promise.state = REJECTED;
        promise.value = reason;
        promise.notify();
    }
};

p.notify = function notify() {
    var promise = this;

    async(function () {
        if (promise.state !== PENDING) {
            while (promise.deferred.length) {
                var deferred = promise.deferred.shift(),
                    onResolved = deferred[0],
                    onRejected = deferred[1],
                    resolve = deferred[2],
                    reject = deferred[3];

                try {
                    if (promise.state === RESOLVED) {
                        if (typeof onResolved === 'function') {
                            resolve(onResolved.call(undefined, promise.value));
                        } else {
                            resolve(promise.value);
                        }
                    } else if (promise.state === REJECTED) {
                        if (typeof onRejected === 'function') {
                            resolve(onRejected.call(undefined, promise.value));
                        } else {
                            reject(promise.value);
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            }
        }
    });
};

p.catch = function (onRejected) {
    return this.then(undefined, onRejected);
};

p.then = function then(onResolved, onRejected) {
    var promise = this;

    return new Promise(function (resolve, reject) {
        promise.deferred.push([onResolved, onRejected, resolve, reject]);
        promise.notify();
    });
};

var queue = [];
var async = function (callback) {
    queue.push(callback);

    if (queue.length === 1) {
        async.async();
    }
};

async.run = function () {
    while (queue.length) {
        queue[0]();
        queue.shift();
    }
};

if (window.MutationObserver) {
    var el = document.createElement('div');
    var mo = new MutationObserver(async.run);

    mo.observe(el, {
        attributes: true
    });

    async.async = function () {
        el.setAttribute("x", 0);
    };
} else {
    async.async = function () {
        setTimeout(async.run);
    };
}

module.exports = window.Promise || Promise;

},{}],6:[function(require,module,exports){
/**
 * Utility functions.
 */

module.exports = function (Vue) {

    var _ = Vue.util.extend({}, Vue.util);

    _.isString = function (value) {
        return typeof value === 'string';
    };

    _.isFunction = function (value) {
        return typeof value === 'function';
    };

    _.options = function (fn, obj, options) {

        options = options || {};

        if (_.isFunction(options)) {
            options = options.call(obj);
        }

        return _.extend(fn.bind({vm: obj, options: options}), fn, {options: options});
    };

    _.each = function (obj, iterator) {

        var i, key;

        if (typeof obj.length == 'number') {
            for (i = 0; i < obj.length; i++) {
                iterator.call(obj[i], obj[i], i);
            }
        } else if (_.isObject(obj)) {
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    iterator.call(obj[key], obj[key], key);
                }
            }
        }

        return obj;
    };

    _.extend = function (target) {

        var array = [], args = array.slice.call(arguments, 1), deep;

        if (typeof target == 'boolean') {
            deep = target;
            target = args.shift();
        }

        args.forEach(function (arg) {
            extend(target, arg, deep);
        });

        return target;
    };

    function extend(target, source, deep) {
        for (var key in source) {
            if (deep && (_.isPlainObject(source[key]) || _.isArray(source[key]))) {
                if (_.isPlainObject(source[key]) && !_.isPlainObject(target[key])) {
                    target[key] = {};
                }
                if (_.isArray(source[key]) && !_.isArray(target[key])) {
                    target[key] = [];
                }
                extend(target[key], source[key], deep);
            } else if (source[key] !== undefined) {
                target[key] = source[key];
            }
        }
    }

    return _;
};

},{}],7:[function(require,module,exports){
/**
 * XMLHttp request.
 */

var Promise = require('./promise');
var XDomain = window.XDomainRequest;

module.exports = function (_, options) {

    var request = new XMLHttpRequest(), promise;

    if (XDomain && options.crossOrigin) {
        request = new XDomainRequest(); options.headers = {};
    }

    if (_.isPlainObject(options.xhr)) {
        _.extend(request, options.xhr);
    }

    if (_.isFunction(options.beforeSend)) {
        options.beforeSend.call(this, request, options);
    }

    promise = new Promise(function (resolve, reject) {

        request.open(options.method, _.url(options), true);

        _.each(options.headers, function (value, header) {
            request.setRequestHeader(header, value);
        });

        var handler = function (event) {

            request.ok = event.type === 'load';

            if (request.ok && request.status) {
                request.ok = request.status >= 200 && request.status < 300;
            }

            (request.ok ? resolve : reject)(request);
        };

        request.onload = handler;
        request.onabort = handler;
        request.onerror = handler;

        request.send(options.data);
    });

    return promise;
};

},{"./promise":5}],8:[function(require,module,exports){
/**
 * Service for interacting with RESTful services.
 */

module.exports = function (_) {

    function Resource(url, params, actions) {

        var self = this, resource = {};

        actions = _.extend({},
            Resource.actions,
            actions
        );

        _.each(actions, function (action, name) {

            action = _.extend(true, {url: url, params: params || {}}, action);

            resource[name] = function () {
                return (self.$http || _.http)(opts(action, arguments));
            };
        });

        return resource;
    }

    function opts(action, args) {

        var options = _.extend({}, action), params = {}, data, success, error;

        switch (args.length) {

            case 4:

                error = args[3];
                success = args[2];

            case 3:
            case 2:

                if (_.isFunction(args[1])) {

                    if (_.isFunction(args[0])) {

                        success = args[0];
                        error = args[1];

                        break;
                    }

                    success = args[1];
                    error = args[2];

                } else {

                    params = args[0];
                    data = args[1];
                    success = args[2];

                    break;
                }

            case 1:

                if (_.isFunction(args[0])) {
                    success = args[0];
                } else if (/^(POST|PUT|PATCH)$/i.test(options.method)) {
                    data = args[0];
                } else {
                    params = args[0];
                }

                break;

            case 0:

                break;

            default:

                throw 'Expected up to 4 arguments [params, data, success, error], got ' + args.length + ' arguments';
        }

        options.data = data;
        options.params = _.extend({}, options.params, params);

        if (success) {
            options.success = success;
        }

        if (error) {
            options.error = error;
        }

        return options;
    }

    Resource.actions = {

        get: {method: 'GET'},
        save: {method: 'POST'},
        query: {method: 'GET'},
        update: {method: 'PUT'},
        remove: {method: 'DELETE'},
        delete: {method: 'DELETE'}

    };

    return _.resource = Resource;
};

},{}],9:[function(require,module,exports){
/**
 * Service for URL templating.
 */

var ie = document.documentMode;
var el = document.createElement('a');

module.exports = function (_) {

    function Url(url, params) {

        var urlParams = {}, queryParams = {}, options = url, query;

        if (!_.isPlainObject(options)) {
            options = {url: url, params: params};
        }

        options = _.extend(true, {},
            Url.options, this.options, options
        );

        url = options.url.replace(/(\/?):([a-z]\w*)/gi, function (match, slash, name) {

            if (options.params[name]) {
                urlParams[name] = true;
                return slash + encodeUriSegment(options.params[name]);
            }

            return '';
        });

        if (_.isString(options.root) && !url.match(/^(https?:)?\//)) {
            url = options.root + '/' + url;
        }

        _.each(options.params, function (value, key) {
            if (!urlParams[key]) {
                queryParams[key] = value;
            }
        });

        query = Url.params(queryParams);

        if (query) {
            url += (url.indexOf('?') == -1 ? '?' : '&') + query;
        }

        return url;
    }

    /**
     * Url options.
     */

    Url.options = {
        url: '',
        root: null,
        params: {}
    };

    /**
     * Encodes a Url parameter string.
     *
     * @param {Object} obj
     */

    Url.params = function (obj) {

        var params = [];

        params.add = function (key, value) {

            if (_.isFunction (value)) {
                value = value();
            }

            if (value === null) {
                value = '';
            }

            this.push(encodeUriSegment(key) + '=' + encodeUriSegment(value));
        };

        serialize(params, obj);

        return params.join('&');
    };

    /**
     * Parse a URL and return its components.
     *
     * @param {String} url
     */

    Url.parse = function (url) {

        if (ie) {
            el.href = url;
            url = el.href;
        }

        el.href = url;

        return {
            href: el.href,
            protocol: el.protocol ? el.protocol.replace(/:$/, '') : '',
            port: el.port,
            host: el.host,
            hostname: el.hostname,
            pathname: el.pathname.charAt(0) === '/' ? el.pathname : '/' + el.pathname,
            search: el.search ? el.search.replace(/^\?/, '') : '',
            hash: el.hash ? el.hash.replace(/^#/, '') : ''
        };
    };

    function serialize(params, obj, scope) {

        var array = _.isArray(obj), plain = _.isPlainObject(obj), hash;

        _.each(obj, function (value, key) {

            hash = _.isObject(value) || _.isArray(value);

            if (scope) {
                key = scope + '[' + (plain || hash ? key : '') + ']';
            }

            if (!scope && array) {
                params.add(value.name, value.value);
            } else if (hash) {
                serialize(params, value, key);
            } else {
                params.add(key, value);
            }
        });
    }

    function encodeUriSegment(value) {

        return encodeUriQuery(value, true).
            replace(/%26/gi, '&').
            replace(/%3D/gi, '=').
            replace(/%2B/gi, '+');
    }

    function encodeUriQuery(value, spaces) {

        return encodeURIComponent(value).
            replace(/%40/gi, '@').
            replace(/%3A/gi, ':').
            replace(/%24/g, '$').
            replace(/%2C/gi, ',').
            replace(/%20/g, (spaces ? '%20' : '+'));
    }

    return _.url = Url;
};

},{}],10:[function(require,module,exports){
var _ = require('../util')

/**
 * Create a child instance that prototypally inherits
 * data on parent. To achieve that we create an intermediate
 * constructor with its prototype pointing to parent.
 *
 * @param {Object} opts
 * @param {Function} [BaseCtor]
 * @return {Vue}
 * @public
 */

exports.$addChild = function (opts, BaseCtor) {
  BaseCtor = BaseCtor || _.Vue
  opts = opts || {}
  var ChildVue
  var parent = this
  // transclusion context
  var context = opts._context || parent
  var inherit = opts.inherit !== undefined
    ? opts.inherit
    : BaseCtor.options.inherit
  if (inherit) {
    var ctors = context._childCtors
    ChildVue = ctors[BaseCtor.cid]
    if (!ChildVue) {
      var optionName = BaseCtor.options.name
      var className = optionName
        ? _.classify(optionName)
        : 'VueComponent'
      ChildVue = new Function(
        'return function ' + className + ' (options) {' +
        'this.constructor = ' + className + ';' +
        'this._init(options) }'
      )()
      ChildVue.options = BaseCtor.options
      ChildVue.linker = BaseCtor.linker
      ChildVue.prototype = context
      ctors[BaseCtor.cid] = ChildVue
    }
  } else {
    ChildVue = BaseCtor
  }
  opts._parent = parent
  opts._root = parent.$root
  var child = new ChildVue(opts)
  return child
}

},{"../util":71}],11:[function(require,module,exports){
var Watcher = require('../watcher')
var Path = require('../parsers/path')
var textParser = require('../parsers/text')
var dirParser = require('../parsers/directive')
var expParser = require('../parsers/expression')
var filterRE = /[^|]\|[^|]/

/**
 * Get the value from an expression on this vm.
 *
 * @param {String} exp
 * @return {*}
 */

exports.$get = function (exp) {
  var res = expParser.parse(exp)
  if (res) {
    try {
      return res.get.call(this, this)
    } catch (e) {}
  }
}

/**
 * Set the value from an expression on this vm.
 * The expression must be a valid left-hand
 * expression in an assignment.
 *
 * @param {String} exp
 * @param {*} val
 */

exports.$set = function (exp, val) {
  var res = expParser.parse(exp, true)
  if (res && res.set) {
    res.set.call(this, this, val)
  }
}

/**
 * Add a property on the VM
 *
 * @param {String} key
 * @param {*} val
 */

exports.$add = function (key, val) {
  this._data.$add(key, val)
}

/**
 * Delete a property on the VM
 *
 * @param {String} key
 */

exports.$delete = function (key) {
  this._data.$delete(key)
}

/**
 * Watch an expression, trigger callback when its
 * value changes.
 *
 * @param {String|Function} expOrFn
 * @param {Function} cb
 * @param {Object} [options]
 *                 - {Boolean} deep
 *                 - {Boolean} immediate
 *                 - {Boolean} user
 * @return {Function} - unwatchFn
 */

exports.$watch = function (expOrFn, cb, options) {
  var vm = this
  var parsed
  if (typeof expOrFn === 'string') {
    parsed = dirParser.parse(expOrFn)[0]
    expOrFn = parsed.expression
  }
  var watcher = new Watcher(vm, expOrFn, cb, {
    deep: options && options.deep,
    user: !options || options.user !== false,
    filters: parsed && parsed.filters
  })
  if (options && options.immediate) {
    cb.call(vm, watcher.value)
  }
  return function unwatchFn () {
    watcher.teardown()
  }
}

/**
 * Evaluate a text directive, including filters.
 *
 * @param {String} text
 * @return {String}
 */

exports.$eval = function (text) {
  // check for filters.
  if (filterRE.test(text)) {
    var dir = dirParser.parse(text)[0]
    // the filter regex check might give false positive
    // for pipes inside strings, so it's possible that
    // we don't get any filters here
    var val = this.$get(dir.expression)
    return dir.filters
      ? this._applyFilters(val, null, dir.filters)
      : val
  } else {
    // no filter
    return this.$get(text)
  }
}

/**
 * Interpolate a piece of template text.
 *
 * @param {String} text
 * @return {String}
 */

exports.$interpolate = function (text) {
  var tokens = textParser.parse(text)
  var vm = this
  if (tokens) {
    if (tokens.length === 1) {
      return vm.$eval(tokens[0].value) + ''
    } else {
      return tokens.map(function (token) {
        return token.tag
          ? vm.$eval(token.value)
          : token.value
      }).join('')
    }
  } else {
    return text
  }
}

/**
 * Log instance data as a plain JS object
 * so that it is easier to inspect in console.
 * This method assumes console is available.
 *
 * @param {String} [path]
 */

exports.$log = function (path) {
  var data = path
    ? Path.get(this._data, path)
    : this._data
  if (data) {
    data = JSON.parse(JSON.stringify(data))
  }
  console.log(data)
}

},{"../parsers/directive":59,"../parsers/expression":60,"../parsers/path":61,"../parsers/text":63,"../watcher":75}],12:[function(require,module,exports){
var _ = require('../util')
var transition = require('../transition')

/**
 * Convenience on-instance nextTick. The callback is
 * auto-bound to the instance, and this avoids component
 * modules having to rely on the global Vue.
 *
 * @param {Function} fn
 */

exports.$nextTick = function (fn) {
  _.nextTick(fn, this)
}

/**
 * Append instance to target
 *
 * @param {Node} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$appendTo = function (target, cb, withTransition) {
  return insert(
    this, target, cb, withTransition,
    append, transition.append
  )
}

/**
 * Prepend instance to target
 *
 * @param {Node} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$prependTo = function (target, cb, withTransition) {
  target = query(target)
  if (target.hasChildNodes()) {
    this.$before(target.firstChild, cb, withTransition)
  } else {
    this.$appendTo(target, cb, withTransition)
  }
  return this
}

/**
 * Insert instance before target
 *
 * @param {Node} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$before = function (target, cb, withTransition) {
  return insert(
    this, target, cb, withTransition,
    before, transition.before
  )
}

/**
 * Insert instance after target
 *
 * @param {Node} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$after = function (target, cb, withTransition) {
  target = query(target)
  if (target.nextSibling) {
    this.$before(target.nextSibling, cb, withTransition)
  } else {
    this.$appendTo(target.parentNode, cb, withTransition)
  }
  return this
}

/**
 * Remove instance from DOM
 *
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$remove = function (cb, withTransition) {
  if (!this.$el.parentNode) {
    return cb && cb()
  }
  var inDoc = this._isAttached && _.inDoc(this.$el)
  // if we are not in document, no need to check
  // for transitions
  if (!inDoc) withTransition = false
  var op
  var self = this
  var realCb = function () {
    if (inDoc) self._callHook('detached')
    if (cb) cb()
  }
  if (
    this._isFragment &&
    !this._blockFragment.hasChildNodes()
  ) {
    op = withTransition === false
      ? append
      : transition.removeThenAppend
    blockOp(this, this._blockFragment, op, realCb)
  } else {
    op = withTransition === false
      ? remove
      : transition.remove
    op(this.$el, this, realCb)
  }
  return this
}

/**
 * Shared DOM insertion function.
 *
 * @param {Vue} vm
 * @param {Element} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition]
 * @param {Function} op1 - op for non-transition insert
 * @param {Function} op2 - op for transition insert
 * @return vm
 */

function insert (vm, target, cb, withTransition, op1, op2) {
  target = query(target)
  var targetIsDetached = !_.inDoc(target)
  var op = withTransition === false || targetIsDetached
    ? op1
    : op2
  var shouldCallHook =
    !targetIsDetached &&
    !vm._isAttached &&
    !_.inDoc(vm.$el)
  if (vm._isFragment) {
    blockOp(vm, target, op, cb)
  } else {
    op(vm.$el, target, vm, cb)
  }
  if (shouldCallHook) {
    vm._callHook('attached')
  }
  return vm
}

/**
 * Execute a transition operation on a fragment instance,
 * iterating through all its block nodes.
 *
 * @param {Vue} vm
 * @param {Node} target
 * @param {Function} op
 * @param {Function} cb
 */

function blockOp (vm, target, op, cb) {
  var current = vm._fragmentStart
  var end = vm._fragmentEnd
  var next
  while (next !== end) {
    next = current.nextSibling
    op(current, target, vm)
    current = next
  }
  op(end, target, vm, cb)
}

/**
 * Check for selectors
 *
 * @param {String|Element} el
 */

function query (el) {
  return typeof el === 'string'
    ? document.querySelector(el)
    : el
}

/**
 * Append operation that takes a callback.
 *
 * @param {Node} el
 * @param {Node} target
 * @param {Vue} vm - unused
 * @param {Function} [cb]
 */

function append (el, target, vm, cb) {
  target.appendChild(el)
  if (cb) cb()
}

/**
 * InsertBefore operation that takes a callback.
 *
 * @param {Node} el
 * @param {Node} target
 * @param {Vue} vm - unused
 * @param {Function} [cb]
 */

function before (el, target, vm, cb) {
  _.before(el, target)
  if (cb) cb()
}

/**
 * Remove operation that takes a callback.
 *
 * @param {Node} el
 * @param {Vue} vm - unused
 * @param {Function} [cb]
 */

function remove (el, vm, cb) {
  _.remove(el)
  if (cb) cb()
}

},{"../transition":64,"../util":71}],13:[function(require,module,exports){
var _ = require('../util')

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 */

exports.$on = function (event, fn) {
  (this._events[event] || (this._events[event] = []))
    .push(fn)
  modifyListenerCount(this, event, 1)
  return this
}

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 */

exports.$once = function (event, fn) {
  var self = this
  function on () {
    self.$off(event, on)
    fn.apply(this, arguments)
  }
  on.fn = fn
  this.$on(event, on)
  return this
}

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 */

exports.$off = function (event, fn) {
  var cbs
  // all
  if (!arguments.length) {
    if (this.$parent) {
      for (event in this._events) {
        cbs = this._events[event]
        if (cbs) {
          modifyListenerCount(this, event, -cbs.length)
        }
      }
    }
    this._events = {}
    return this
  }
  // specific event
  cbs = this._events[event]
  if (!cbs) {
    return this
  }
  if (arguments.length === 1) {
    modifyListenerCount(this, event, -cbs.length)
    this._events[event] = null
    return this
  }
  // specific handler
  var cb
  var i = cbs.length
  while (i--) {
    cb = cbs[i]
    if (cb === fn || cb.fn === fn) {
      modifyListenerCount(this, event, -1)
      cbs.splice(i, 1)
      break
    }
  }
  return this
}

/**
 * Trigger an event on self.
 *
 * @param {String} event
 */

exports.$emit = function (event) {
  this._eventCancelled = false
  var cbs = this._events[event]
  if (cbs) {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    var i = arguments.length - 1
    var args = new Array(i)
    while (i--) {
      args[i] = arguments[i + 1]
    }
    i = 0
    cbs = cbs.length > 1
      ? _.toArray(cbs)
      : cbs
    for (var l = cbs.length; i < l; i++) {
      if (cbs[i].apply(this, args) === false) {
        this._eventCancelled = true
      }
    }
  }
  return this
}

/**
 * Recursively broadcast an event to all children instances.
 *
 * @param {String} event
 * @param {...*} additional arguments
 */

exports.$broadcast = function (event) {
  // if no child has registered for this event,
  // then there's no need to broadcast.
  if (!this._eventsCount[event]) return
  var children = this.$children
  for (var i = 0, l = children.length; i < l; i++) {
    var child = children[i]
    child.$emit.apply(child, arguments)
    if (!child._eventCancelled) {
      child.$broadcast.apply(child, arguments)
    }
  }
  return this
}

/**
 * Recursively propagate an event up the parent chain.
 *
 * @param {String} event
 * @param {...*} additional arguments
 */

exports.$dispatch = function () {
  var parent = this.$parent
  while (parent) {
    parent.$emit.apply(parent, arguments)
    parent = parent._eventCancelled
      ? null
      : parent.$parent
  }
  return this
}

/**
 * Modify the listener counts on all parents.
 * This bookkeeping allows $broadcast to return early when
 * no child has listened to a certain event.
 *
 * @param {Vue} vm
 * @param {String} event
 * @param {Number} count
 */

var hookRE = /^hook:/
function modifyListenerCount (vm, event, count) {
  var parent = vm.$parent
  // hooks do not get broadcasted so no need
  // to do bookkeeping for them
  if (!parent || !count || hookRE.test(event)) return
  while (parent) {
    parent._eventsCount[event] =
      (parent._eventsCount[event] || 0) + count
    parent = parent.$parent
  }
}

},{"../util":71}],14:[function(require,module,exports){
var _ = require('../util')
var config = require('../config')

/**
 * Expose useful internals
 */

exports.util = _
exports.config = config
exports.nextTick = _.nextTick
exports.compiler = require('../compiler')

exports.parsers = {
  path: require('../parsers/path'),
  text: require('../parsers/text'),
  template: require('../parsers/template'),
  directive: require('../parsers/directive'),
  expression: require('../parsers/expression')
}

/**
 * Each instance constructor, including Vue, has a unique
 * cid. This enables us to create wrapped "child
 * constructors" for prototypal inheritance and cache them.
 */

exports.cid = 0
var cid = 1

/**
 * Class inheritance
 *
 * @param {Object} extendOptions
 */

exports.extend = function (extendOptions) {
  extendOptions = extendOptions || {}
  var Super = this
  var Sub = createClass(
    extendOptions.name ||
    Super.options.name ||
    'VueComponent'
  )
  Sub.prototype = Object.create(Super.prototype)
  Sub.prototype.constructor = Sub
  Sub.cid = cid++
  Sub.options = _.mergeOptions(
    Super.options,
    extendOptions
  )
  Sub['super'] = Super
  // allow further extension
  Sub.extend = Super.extend
  // create asset registers, so extended classes
  // can have their private assets too.
  config._assetTypes.forEach(function (type) {
    Sub[type] = Super[type]
  })
  return Sub
}

/**
 * A function that returns a sub-class constructor with the
 * given name. This gives us much nicer output when
 * logging instances in the console.
 *
 * @param {String} name
 * @return {Function}
 */

function createClass (name) {
  return new Function(
    'return function ' + _.classify(name) +
    ' (options) { this._init(options) }'
  )()
}

/**
 * Plugin system
 *
 * @param {Object} plugin
 */

exports.use = function (plugin) {
  // additional parameters
  var args = _.toArray(arguments, 1)
  args.unshift(this)
  if (typeof plugin.install === 'function') {
    plugin.install.apply(plugin, args)
  } else {
    plugin.apply(null, args)
  }
  return this
}

/**
 * Apply a global mixin by merging it into the default
 * options.
 */

exports.mixin = function (mixin) {
  var Vue = _.Vue
  Vue.options = _.mergeOptions(Vue.options, mixin)
}

/**
 * Create asset registration methods with the following
 * signature:
 *
 * @param {String} id
 * @param {*} definition
 */

config._assetTypes.forEach(function (type) {
  exports[type] = function (id, definition) {
    if (!definition) {
      return this.options[type + 's'][id]
    } else {
      if (
        type === 'component' &&
        _.isPlainObject(definition)
      ) {
        definition.name = id
        definition = _.Vue.extend(definition)
      }
      this.options[type + 's'][id] = definition
    }
  }
})

},{"../compiler":20,"../config":22,"../parsers/directive":59,"../parsers/expression":60,"../parsers/path":61,"../parsers/template":62,"../parsers/text":63,"../util":71}],15:[function(require,module,exports){
(function (process){
var _ = require('../util')
var compiler = require('../compiler')

/**
 * Set instance target element and kick off the compilation
 * process. The passed in `el` can be a selector string, an
 * existing Element, or a DocumentFragment (for block
 * instances).
 *
 * @param {Element|DocumentFragment|string} el
 * @public
 */

exports.$mount = function (el) {
  if (this._isCompiled) {
    process.env.NODE_ENV !== 'production' && _.warn(
      '$mount() should be called only once.'
    )
    return
  }
  el = _.query(el)
  if (!el) {
    el = document.createElement('div')
  }
  this._compile(el)
  this._isCompiled = true
  this._callHook('compiled')
  this._initDOMHooks()
  if (_.inDoc(this.$el)) {
    this._callHook('attached')
    ready.call(this)
  } else {
    this.$once('hook:attached', ready)
  }
  return this
}

/**
 * Mark an instance as ready.
 */

function ready () {
  this._isAttached = true
  this._isReady = true
  this._callHook('ready')
}

/**
 * Teardown the instance, simply delegate to the internal
 * _destroy.
 */

exports.$destroy = function (remove, deferCleanup) {
  this._destroy(remove, deferCleanup)
}

/**
 * Partially compile a piece of DOM and return a
 * decompile function.
 *
 * @param {Element|DocumentFragment} el
 * @param {Vue} [host]
 * @return {Function}
 */

exports.$compile = function (el, host) {
  return compiler.compile(el, this.$options, true)(this, el, host)
}

}).call(this,require('_process'))
},{"../compiler":20,"../util":71,"_process":1}],16:[function(require,module,exports){
(function (process){
var _ = require('./util')
var config = require('./config')

// we have two separate queues: one for directive updates
// and one for user watcher registered via $watch().
// we want to guarantee directive updates to be called
// before user watchers so that when user watchers are
// triggered, the DOM would have already been in updated
// state.
var queue = []
var userQueue = []
var has = {}
var circular = {}
var waiting = false
var internalQueueDepleted = false

/**
 * Reset the batcher's state.
 */

function resetBatcherState () {
  queue = []
  userQueue = []
  has = {}
  circular = {}
  waiting = internalQueueDepleted = false
}

/**
 * Flush both queues and run the watchers.
 */

function flushBatcherQueue () {
  runBatcherQueue(queue)
  internalQueueDepleted = true
  runBatcherQueue(userQueue)
  resetBatcherState()
}

/**
 * Run the watchers in a single queue.
 *
 * @param {Array} queue
 */

function runBatcherQueue (queue) {
  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (var i = 0; i < queue.length; i++) {
    var watcher = queue[i]
    var id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > config._maxUpdateCount) {
        queue.splice(has[id], 1)
        _.warn(
          'You may have an infinite update loop for watcher ' +
          'with expression: ' + watcher.expression
        )
      }
    }
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 *
 * @param {Watcher} watcher
 *   properties:
 *   - {Number} id
 *   - {Function} run
 */

exports.push = function (watcher) {
  var id = watcher.id
  if (has[id] == null) {
    // if an internal watcher is pushed, but the internal
    // queue is already depleted, we run it immediately.
    if (internalQueueDepleted && !watcher.user) {
      watcher.run()
      return
    }
    // push watcher into appropriate queue
    var q = watcher.user ? userQueue : queue
    has[id] = q.length
    q.push(watcher)
    // queue the flush
    if (!waiting) {
      waiting = true
      _.nextTick(flushBatcherQueue)
    }
  }
}

}).call(this,require('_process'))
},{"./config":22,"./util":71,"_process":1}],17:[function(require,module,exports){
/**
 * A doubly linked list-based Least Recently Used (LRU)
 * cache. Will keep most recently used items while
 * discarding least recently used items when its limit is
 * reached. This is a bare-bone version of
 * Rasmus Andersson's js-lru:
 *
 *   https://github.com/rsms/js-lru
 *
 * @param {Number} limit
 * @constructor
 */

function Cache (limit) {
  this.size = 0
  this.limit = limit
  this.head = this.tail = undefined
  this._keymap = Object.create(null)
}

var p = Cache.prototype

/**
 * Put <value> into the cache associated with <key>.
 * Returns the entry which was removed to make room for
 * the new entry. Otherwise undefined is returned.
 * (i.e. if there was enough room already).
 *
 * @param {String} key
 * @param {*} value
 * @return {Entry|undefined}
 */

p.put = function (key, value) {
  var entry = {
    key: key,
    value: value
  }
  this._keymap[key] = entry
  if (this.tail) {
    this.tail.newer = entry
    entry.older = this.tail
  } else {
    this.head = entry
  }
  this.tail = entry
  if (this.size === this.limit) {
    return this.shift()
  } else {
    this.size++
  }
}

/**
 * Purge the least recently used (oldest) entry from the
 * cache. Returns the removed entry or undefined if the
 * cache was empty.
 */

p.shift = function () {
  var entry = this.head
  if (entry) {
    this.head = this.head.newer
    this.head.older = undefined
    entry.newer = entry.older = undefined
    this._keymap[entry.key] = undefined
  }
  return entry
}

/**
 * Get and register recent use of <key>. Returns the value
 * associated with <key> or undefined if not in cache.
 *
 * @param {String} key
 * @param {Boolean} returnEntry
 * @return {Entry|*}
 */

p.get = function (key, returnEntry) {
  var entry = this._keymap[key]
  if (entry === undefined) return
  if (entry === this.tail) {
    return returnEntry
      ? entry
      : entry.value
  }
  // HEAD--------------TAIL
  //   <.older   .newer>
  //  <--- add direction --
  //   A  B  C  <D>  E
  if (entry.newer) {
    if (entry === this.head) {
      this.head = entry.newer
    }
    entry.newer.older = entry.older // C <-- E.
  }
  if (entry.older) {
    entry.older.newer = entry.newer // C. --> E
  }
  entry.newer = undefined // D --x
  entry.older = this.tail // D. --> E
  if (this.tail) {
    this.tail.newer = entry // E. <-- D
  }
  this.tail = entry
  return returnEntry
    ? entry
    : entry.value
}

module.exports = Cache

},{}],18:[function(require,module,exports){
(function (process){
var _ = require('../util')
var textParser = require('../parsers/text')
var propDef = require('../directives/prop')
var propBindingModes = require('../config')._propBindingModes

// regexes
var identRE = require('../parsers/path').identRE
var dataAttrRE = /^data-/
var settablePathRE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\[[^\[\]]+\])*$/
var literalValueRE = /^(true|false)$|^\d.*/

/**
 * Compile param attributes on a root element and return
 * a props link function.
 *
 * @param {Element|DocumentFragment} el
 * @param {Array} propOptions
 * @return {Function} propsLinkFn
 */

module.exports = function compileProps (el, propOptions) {
  var props = []
  var i = propOptions.length
  var options, name, attr, value, path, prop, literal, single
  while (i--) {
    options = propOptions[i]
    name = options.name
    // props could contain dashes, which will be
    // interpreted as minus calculations by the parser
    // so we need to camelize the path here
    path = _.camelize(name.replace(dataAttrRE, ''))
    if (!identRE.test(path)) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Invalid prop key: "' + name + '". Prop keys ' +
        'must be valid identifiers.'
      )
      continue
    }
    attr = _.hyphenate(name)
    value = el.getAttribute(attr)
    if (value === null) {
      attr = 'data-' + attr
      value = el.getAttribute(attr)
    }
    // create a prop descriptor
    prop = {
      name: name,
      raw: value,
      path: path,
      options: options,
      mode: propBindingModes.ONE_WAY
    }
    if (value !== null) {
      // important so that this doesn't get compiled
      // again as a normal attribute binding
      el.removeAttribute(attr)
      var tokens = textParser.parse(value)
      if (tokens) {
        prop.dynamic = true
        prop.parentPath = textParser.tokensToExp(tokens)
        // check prop binding type.
        single = tokens.length === 1
        literal = literalValueRE.test(prop.parentPath)
        // one time: {{* prop}}
        if (literal || (single && tokens[0].oneTime)) {
          prop.mode = propBindingModes.ONE_TIME
        } else if (
          !literal &&
          (single && tokens[0].twoWay)
        ) {
          if (settablePathRE.test(prop.parentPath)) {
            prop.mode = propBindingModes.TWO_WAY
          } else {
            process.env.NODE_ENV !== 'production' && _.warn(
              'Cannot bind two-way prop with non-settable ' +
              'parent path: ' + prop.parentPath
            )
          }
        }
        if (
          process.env.NODE_ENV !== 'production' &&
          options.twoWay &&
          prop.mode !== propBindingModes.TWO_WAY
        ) {
          _.warn(
            'Prop "' + name + '" expects a two-way binding type.'
          )
        }
      }
    } else if (options && options.required) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Missing required prop: ' + name
      )
    }
    props.push(prop)
  }
  return makePropsLinkFn(props)
}

/**
 * Build a function that applies props to a vm.
 *
 * @param {Array} props
 * @return {Function} propsLinkFn
 */

function makePropsLinkFn (props) {
  return function propsLinkFn (vm, el) {
    // store resolved props info
    vm._props = {}
    var i = props.length
    var prop, path, options, value
    while (i--) {
      prop = props[i]
      path = prop.path
      vm._props[path] = prop
      options = prop.options
      if (prop.raw === null) {
        // initialize absent prop
        _.initProp(vm, prop, getDefault(options))
      } else if (prop.dynamic) {
        // dynamic prop
        if (vm._context) {
          if (prop.mode === propBindingModes.ONE_TIME) {
            // one time binding
            value = vm._context.$get(prop.parentPath)
            _.initProp(vm, prop, value)
          } else {
            // dynamic binding
            vm._bindDir('prop', el, prop, propDef)
          }
        } else {
          process.env.NODE_ENV !== 'production' && _.warn(
            'Cannot bind dynamic prop on a root instance' +
            ' with no parent: ' + prop.name + '="' +
            prop.raw + '"'
          )
        }
      } else {
        // literal, cast it and just set once
        var raw = prop.raw
        value = options.type === Boolean && raw === ''
          ? true
          // do not cast emptry string.
          // _.toNumber casts empty string to 0.
          : raw.trim()
            ? _.toBoolean(_.toNumber(raw))
            : raw
        _.initProp(vm, prop, value)
      }
    }
  }
}

/**
 * Get the default value of a prop.
 *
 * @param {Object} options
 * @return {*}
 */

function getDefault (options) {
  // no default, return undefined
  if (!options.hasOwnProperty('default')) {
    // absent boolean value defaults to false
    return options.type === Boolean
      ? false
      : undefined
  }
  var def = options.default
  // warn against non-factory defaults for Object & Array
  if (_.isObject(def)) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Object/Array as default prop values will be shared ' +
      'across multiple instances. Use a factory function ' +
      'to return the default value instead.'
    )
  }
  // call factory function for non-Function types
  return typeof def === 'function' && options.type !== Function
    ? def()
    : def
}

}).call(this,require('_process'))
},{"../config":22,"../directives/prop":38,"../parsers/path":61,"../parsers/text":63,"../util":71,"_process":1}],19:[function(require,module,exports){
(function (process){
var _ = require('../util')
var compileProps = require('./compile-props')
var config = require('../config')
var textParser = require('../parsers/text')
var dirParser = require('../parsers/directive')
var templateParser = require('../parsers/template')
var resolveAsset = _.resolveAsset
var componentDef = require('../directives/component')

// terminal directives
var terminalDirectives = [
  'repeat',
  'if'
]

/**
 * Compile a template and return a reusable composite link
 * function, which recursively contains more link functions
 * inside. This top level compile function would normally
 * be called on instance root nodes, but can also be used
 * for partial compilation if the partial argument is true.
 *
 * The returned composite link function, when called, will
 * return an unlink function that tearsdown all directives
 * created during the linking phase.
 *
 * @param {Element|DocumentFragment} el
 * @param {Object} options
 * @param {Boolean} partial
 * @return {Function}
 */

exports.compile = function (el, options, partial) {
  // link function for the node itself.
  var nodeLinkFn = partial || !options._asComponent
    ? compileNode(el, options)
    : null
  // link function for the childNodes
  var childLinkFn =
    !(nodeLinkFn && nodeLinkFn.terminal) &&
    el.tagName !== 'SCRIPT' &&
    el.hasChildNodes()
      ? compileNodeList(el.childNodes, options)
      : null

  /**
   * A composite linker function to be called on a already
   * compiled piece of DOM, which instantiates all directive
   * instances.
   *
   * @param {Vue} vm
   * @param {Element|DocumentFragment} el
   * @param {Vue} [host] - host vm of transcluded content
   * @return {Function|undefined}
   */

  return function compositeLinkFn (vm, el, host) {
    // cache childNodes before linking parent, fix #657
    var childNodes = _.toArray(el.childNodes)
    // link
    var dirs = linkAndCapture(function () {
      if (nodeLinkFn) nodeLinkFn(vm, el, host)
      if (childLinkFn) childLinkFn(vm, childNodes, host)
    }, vm)
    return makeUnlinkFn(vm, dirs)
  }
}

/**
 * Apply a linker to a vm/element pair and capture the
 * directives created during the process.
 *
 * @param {Function} linker
 * @param {Vue} vm
 */

function linkAndCapture (linker, vm) {
  var originalDirCount = vm._directives.length
  linker()
  return vm._directives.slice(originalDirCount)
}

/**
 * Linker functions return an unlink function that
 * tearsdown all directives instances generated during
 * the process.
 *
 * We create unlink functions with only the necessary
 * information to avoid retaining additional closures.
 *
 * @param {Vue} vm
 * @param {Array} dirs
 * @param {Vue} [context]
 * @param {Array} [contextDirs]
 * @return {Function}
 */

function makeUnlinkFn (vm, dirs, context, contextDirs) {
  return function unlink (destroying) {
    teardownDirs(vm, dirs, destroying)
    if (context && contextDirs) {
      teardownDirs(context, contextDirs)
    }
  }
}

/**
 * Teardown partial linked directives.
 *
 * @param {Vue} vm
 * @param {Array} dirs
 * @param {Boolean} destroying
 */

function teardownDirs (vm, dirs, destroying) {
  var i = dirs.length
  while (i--) {
    dirs[i]._teardown()
    if (!destroying) {
      vm._directives.$remove(dirs[i])
    }
  }
}

/**
 * Compile link props on an instance.
 *
 * @param {Vue} vm
 * @param {Element} el
 * @param {Object} options
 * @return {Function}
 */

exports.compileAndLinkProps = function (vm, el, props) {
  var propsLinkFn = compileProps(el, props)
  var propDirs = linkAndCapture(function () {
    propsLinkFn(vm, null)
  }, vm)
  return makeUnlinkFn(vm, propDirs)
}

/**
 * Compile the root element of an instance.
 *
 * 1. attrs on context container (context scope)
 * 2. attrs on the component template root node, if
 *    replace:true (child scope)
 *
 * If this is a fragment instance, we only need to compile 1.
 *
 * @param {Vue} vm
 * @param {Element} el
 * @param {Object} options
 * @return {Function}
 */

exports.compileRoot = function (el, options) {
  var containerAttrs = options._containerAttrs
  var replacerAttrs = options._replacerAttrs
  var contextLinkFn, replacerLinkFn

  // only need to compile other attributes for
  // non-fragment instances
  if (el.nodeType !== 11) {
    // for components, container and replacer need to be
    // compiled separately and linked in different scopes.
    if (options._asComponent) {
      // 2. container attributes
      if (containerAttrs) {
        contextLinkFn = compileDirectives(containerAttrs, options)
      }
      if (replacerAttrs) {
        // 3. replacer attributes
        replacerLinkFn = compileDirectives(replacerAttrs, options)
      }
    } else {
      // non-component, just compile as a normal element.
      replacerLinkFn = compileDirectives(el.attributes, options)
    }
  }

  return function rootLinkFn (vm, el) {
    // link context scope dirs
    var context = vm._context
    var contextDirs
    if (context && contextLinkFn) {
      contextDirs = linkAndCapture(function () {
        contextLinkFn(context, el)
      }, context)
    }

    // link self
    var selfDirs = linkAndCapture(function () {
      if (replacerLinkFn) replacerLinkFn(vm, el)
    }, vm)

    // return the unlink function that tearsdown context
    // container directives.
    return makeUnlinkFn(vm, selfDirs, context, contextDirs)
  }
}

/**
 * Compile a node and return a nodeLinkFn based on the
 * node type.
 *
 * @param {Node} node
 * @param {Object} options
 * @return {Function|null}
 */

function compileNode (node, options) {
  var type = node.nodeType
  if (type === 1 && node.tagName !== 'SCRIPT') {
    return compileElement(node, options)
  } else if (type === 3 && config.interpolate && node.data.trim()) {
    return compileTextNode(node, options)
  } else {
    return null
  }
}

/**
 * Compile an element and return a nodeLinkFn.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function|null}
 */

function compileElement (el, options) {
  // preprocess textareas.
  // textarea treats its text content as the initial value.
  // just bind it as a v-attr directive for value.
  if (el.tagName === 'TEXTAREA') {
    if (textParser.parse(el.value)) {
      el.setAttribute('value', el.value)
    }
  }
  var linkFn
  var hasAttrs = el.hasAttributes()
  // check terminal directives (repeat & if)
  if (hasAttrs) {
    linkFn = checkTerminalDirectives(el, options)
  }
  // check element directives
  if (!linkFn) {
    linkFn = checkElementDirectives(el, options)
  }
  // check component
  if (!linkFn) {
    linkFn = checkComponent(el, options)
  }
  // normal directives
  if (!linkFn && hasAttrs) {
    linkFn = compileDirectives(el.attributes, options)
  }
  return linkFn
}

/**
 * Compile a textNode and return a nodeLinkFn.
 *
 * @param {TextNode} node
 * @param {Object} options
 * @return {Function|null} textNodeLinkFn
 */

function compileTextNode (node, options) {
  var tokens = textParser.parse(node.data)
  if (!tokens) {
    return null
  }
  var frag = document.createDocumentFragment()
  var el, token
  for (var i = 0, l = tokens.length; i < l; i++) {
    token = tokens[i]
    el = token.tag
      ? processTextToken(token, options)
      : document.createTextNode(token.value)
    frag.appendChild(el)
  }
  return makeTextNodeLinkFn(tokens, frag, options)
}

/**
 * Process a single text token.
 *
 * @param {Object} token
 * @param {Object} options
 * @return {Node}
 */

function processTextToken (token, options) {
  var el
  if (token.oneTime) {
    el = document.createTextNode(token.value)
  } else {
    if (token.html) {
      el = document.createComment('v-html')
      setTokenType('html')
    } else {
      // IE will clean up empty textNodes during
      // frag.cloneNode(true), so we have to give it
      // something here...
      el = document.createTextNode(' ')
      setTokenType('text')
    }
  }
  function setTokenType (type) {
    token.type = type
    token.def = resolveAsset(options, 'directives', type)
    token.descriptor = dirParser.parse(token.value)[0]
  }
  return el
}

/**
 * Build a function that processes a textNode.
 *
 * @param {Array<Object>} tokens
 * @param {DocumentFragment} frag
 */

function makeTextNodeLinkFn (tokens, frag) {
  return function textNodeLinkFn (vm, el) {
    var fragClone = frag.cloneNode(true)
    var childNodes = _.toArray(fragClone.childNodes)
    var token, value, node
    for (var i = 0, l = tokens.length; i < l; i++) {
      token = tokens[i]
      value = token.value
      if (token.tag) {
        node = childNodes[i]
        if (token.oneTime) {
          value = vm.$eval(value)
          if (token.html) {
            _.replace(node, templateParser.parse(value, true))
          } else {
            node.data = value
          }
        } else {
          vm._bindDir(token.type, node,
                      token.descriptor, token.def)
        }
      }
    }
    _.replace(el, fragClone)
  }
}

/**
 * Compile a node list and return a childLinkFn.
 *
 * @param {NodeList} nodeList
 * @param {Object} options
 * @return {Function|undefined}
 */

function compileNodeList (nodeList, options) {
  var linkFns = []
  var nodeLinkFn, childLinkFn, node
  for (var i = 0, l = nodeList.length; i < l; i++) {
    node = nodeList[i]
    nodeLinkFn = compileNode(node, options)
    childLinkFn =
      !(nodeLinkFn && nodeLinkFn.terminal) &&
      node.tagName !== 'SCRIPT' &&
      node.hasChildNodes()
        ? compileNodeList(node.childNodes, options)
        : null
    linkFns.push(nodeLinkFn, childLinkFn)
  }
  return linkFns.length
    ? makeChildLinkFn(linkFns)
    : null
}

/**
 * Make a child link function for a node's childNodes.
 *
 * @param {Array<Function>} linkFns
 * @return {Function} childLinkFn
 */

function makeChildLinkFn (linkFns) {
  return function childLinkFn (vm, nodes, host) {
    var node, nodeLinkFn, childrenLinkFn
    for (var i = 0, n = 0, l = linkFns.length; i < l; n++) {
      node = nodes[n]
      nodeLinkFn = linkFns[i++]
      childrenLinkFn = linkFns[i++]
      // cache childNodes before linking parent, fix #657
      var childNodes = _.toArray(node.childNodes)
      if (nodeLinkFn) {
        nodeLinkFn(vm, node, host)
      }
      if (childrenLinkFn) {
        childrenLinkFn(vm, childNodes, host)
      }
    }
  }
}

/**
 * Check for element directives (custom elements that should
 * be resovled as terminal directives).
 *
 * @param {Element} el
 * @param {Object} options
 */

function checkElementDirectives (el, options) {
  var tag = el.tagName.toLowerCase()
  if (_.commonTagRE.test(tag)) return
  var def = resolveAsset(options, 'elementDirectives', tag)
  if (def) {
    return makeTerminalNodeLinkFn(el, tag, '', options, def)
  }
}

/**
 * Check if an element is a component. If yes, return
 * a component link function.
 *
 * @param {Element} el
 * @param {Object} options
 * @param {Boolean} hasAttrs
 * @return {Function|undefined}
 */

function checkComponent (el, options, hasAttrs) {
  var componentId = _.checkComponent(el, options, hasAttrs)
  if (componentId) {
    var componentLinkFn = function (vm, el, host) {
      vm._bindDir('component', el, {
        expression: componentId
      }, componentDef, host)
    }
    componentLinkFn.terminal = true
    return componentLinkFn
  }
}

/**
 * Check an element for terminal directives in fixed order.
 * If it finds one, return a terminal link function.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function} terminalLinkFn
 */

function checkTerminalDirectives (el, options) {
  if (_.attr(el, 'pre') !== null) {
    return skip
  }
  var value, dirName
  for (var i = 0, l = terminalDirectives.length; i < l; i++) {
    dirName = terminalDirectives[i]
    if ((value = _.attr(el, dirName)) !== null) {
      return makeTerminalNodeLinkFn(el, dirName, value, options)
    }
  }
}

function skip () {}
skip.terminal = true

/**
 * Build a node link function for a terminal directive.
 * A terminal link function terminates the current
 * compilation recursion and handles compilation of the
 * subtree in the directive.
 *
 * @param {Element} el
 * @param {String} dirName
 * @param {String} value
 * @param {Object} options
 * @param {Object} [def]
 * @return {Function} terminalLinkFn
 */

function makeTerminalNodeLinkFn (el, dirName, value, options, def) {
  var descriptor = dirParser.parse(value)[0]
  // no need to call resolveAsset since terminal directives
  // are always internal
  def = def || options.directives[dirName]
  var fn = function terminalNodeLinkFn (vm, el, host) {
    vm._bindDir(dirName, el, descriptor, def, host)
  }
  fn.terminal = true
  return fn
}

/**
 * Compile the directives on an element and return a linker.
 *
 * @param {Array|NamedNodeMap} attrs
 * @param {Object} options
 * @return {Function}
 */

function compileDirectives (attrs, options) {
  var i = attrs.length
  var dirs = []
  var attr, name, value, dir, dirName, dirDef
  while (i--) {
    attr = attrs[i]
    name = attr.name
    value = attr.value
    if (name.indexOf(config.prefix) === 0) {
      dirName = name.slice(config.prefix.length)
      dirDef = resolveAsset(options, 'directives', dirName)
      if (process.env.NODE_ENV !== 'production') {
        _.assertAsset(dirDef, 'directive', dirName)
      }
      if (dirDef) {
        dirs.push({
          name: dirName,
          descriptors: dirParser.parse(value),
          def: dirDef
        })
      }
    } else if (config.interpolate) {
      dir = collectAttrDirective(name, value, options)
      if (dir) {
        dirs.push(dir)
      }
    }
  }
  // sort by priority, LOW to HIGH
  if (dirs.length) {
    dirs.sort(directiveComparator)
    return makeNodeLinkFn(dirs)
  }
}

/**
 * Build a link function for all directives on a single node.
 *
 * @param {Array} directives
 * @return {Function} directivesLinkFn
 */

function makeNodeLinkFn (directives) {
  return function nodeLinkFn (vm, el, host) {
    // reverse apply because it's sorted low to high
    var i = directives.length
    var dir, j, k
    while (i--) {
      dir = directives[i]
      if (dir._link) {
        // custom link fn
        dir._link(vm, el)
      } else {
        k = dir.descriptors.length
        for (j = 0; j < k; j++) {
          vm._bindDir(dir.name, el,
            dir.descriptors[j], dir.def, host)
        }
      }
    }
  }
}

/**
 * Check an attribute for potential dynamic bindings,
 * and return a directive object.
 *
 * Special case: class interpolations are translated into
 * v-class instead v-attr, so that it can work with user
 * provided v-class bindings.
 *
 * @param {String} name
 * @param {String} value
 * @param {Object} options
 * @return {Object}
 */

function collectAttrDirective (name, value, options) {
  var tokens = textParser.parse(value)
  var isClass = name === 'class'
  if (tokens) {
    var dirName = isClass ? 'class' : 'attr'
    var def = options.directives[dirName]
    var i = tokens.length
    var allOneTime = true
    while (i--) {
      var token = tokens[i]
      if (token.tag && !token.oneTime) {
        allOneTime = false
      }
    }
    var linker
    if (allOneTime) {
      linker = function (vm, el) {
        el.setAttribute(name, vm.$interpolate(value))
      }
    } else {
      linker = function (vm, el) {
        var exp = textParser.tokensToExp(tokens, vm)
        var desc = isClass
          ? dirParser.parse(exp)[0]
          : dirParser.parse(name + ':' + exp)[0]
        if (isClass) {
          desc._rawClass = value
        }
        vm._bindDir(dirName, el, desc, def)
      }
    }
    return {
      def: def,
      _link: linker
    }
  }
}

/**
 * Directive priority sort comparator
 *
 * @param {Object} a
 * @param {Object} b
 */

function directiveComparator (a, b) {
  a = a.def.priority || 0
  b = b.def.priority || 0
  return a > b ? 1 : -1
}

}).call(this,require('_process'))
},{"../config":22,"../directives/component":27,"../parsers/directive":59,"../parsers/template":62,"../parsers/text":63,"../util":71,"./compile-props":18,"_process":1}],20:[function(require,module,exports){
var _ = require('../util')

_.extend(exports, require('./compile'))
_.extend(exports, require('./transclude'))

},{"../util":71,"./compile":19,"./transclude":21}],21:[function(require,module,exports){
(function (process){
var _ = require('../util')
var config = require('../config')
var templateParser = require('../parsers/template')

/**
 * Process an element or a DocumentFragment based on a
 * instance option object. This allows us to transclude
 * a template node/fragment before the instance is created,
 * so the processed fragment can then be cloned and reused
 * in v-repeat.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Element|DocumentFragment}
 */

exports.transclude = function (el, options) {
  // extract container attributes to pass them down
  // to compiler, because they need to be compiled in
  // parent scope. we are mutating the options object here
  // assuming the same object will be used for compile
  // right after this.
  if (options) {
    options._containerAttrs = extractAttrs(el)
  }
  // for template tags, what we want is its content as
  // a documentFragment (for fragment instances)
  if (_.isTemplate(el)) {
    el = templateParser.parse(el)
  }
  if (options) {
    if (options._asComponent && !options.template) {
      options.template = '<content></content>'
    }
    if (options.template) {
      options._content = _.extractContent(el)
      el = transcludeTemplate(el, options)
    }
  }
  if (el instanceof DocumentFragment) {
    // anchors for fragment instance
    // passing in `persist: true` to avoid them being
    // discarded by IE during template cloning
    _.prepend(_.createAnchor('v-start', true), el)
    el.appendChild(_.createAnchor('v-end', true))
  }
  return el
}

/**
 * Process the template option.
 * If the replace option is true this will swap the $el.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Element|DocumentFragment}
 */

function transcludeTemplate (el, options) {
  var template = options.template
  var frag = templateParser.parse(template, true)
  if (frag) {
    var replacer = frag.firstChild
    var tag = replacer.tagName && replacer.tagName.toLowerCase()
    if (options.replace) {
      /* istanbul ignore if */
      if (el === document.body) {
        process.env.NODE_ENV !== 'production' && _.warn(
          'You are mounting an instance with a template to ' +
          '<body>. This will replace <body> entirely. You ' +
          'should probably use `replace: false` here.'
        )
      }
      // there are many cases where the instance must
      // become a fragment instance: basically anything that
      // can create more than 1 root nodes.
      if (
        // multi-children template
        frag.childNodes.length > 1 ||
        // non-element template
        replacer.nodeType !== 1 ||
        // single nested component
        tag === 'component' ||
        _.resolveAsset(options, 'components', tag) ||
        replacer.hasAttribute(config.prefix + 'component') ||
        // element directive
        _.resolveAsset(options, 'elementDirectives', tag) ||
        // repeat block
        replacer.hasAttribute(config.prefix + 'repeat')
      ) {
        return frag
      } else {
        options._replacerAttrs = extractAttrs(replacer)
        mergeAttrs(el, replacer)
        return replacer
      }
    } else {
      el.appendChild(frag)
      return el
    }
  } else {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Invalid template option: ' + template
    )
  }
}

/**
 * Helper to extract a component container's attributes
 * into a plain object array.
 *
 * @param {Element} el
 * @return {Array}
 */

function extractAttrs (el) {
  if (el.nodeType === 1 && el.hasAttributes()) {
    return _.toArray(el.attributes)
  }
}

/**
 * Merge the attributes of two elements, and make sure
 * the class names are merged properly.
 *
 * @param {Element} from
 * @param {Element} to
 */

function mergeAttrs (from, to) {
  var attrs = from.attributes
  var i = attrs.length
  var name, value
  while (i--) {
    name = attrs[i].name
    value = attrs[i].value
    if (!to.hasAttribute(name)) {
      to.setAttribute(name, value)
    } else if (name === 'class') {
      value = to.getAttribute(name) + ' ' + value
      to.setAttribute(name, value)
    }
  }
}

}).call(this,require('_process'))
},{"../config":22,"../parsers/template":62,"../util":71,"_process":1}],22:[function(require,module,exports){
module.exports = {

  /**
   * The prefix to look for when parsing directives.
   *
   * @type {String}
   */

  prefix: 'v-',

  /**
   * Whether to print debug messages.
   * Also enables stack trace for warnings.
   *
   * @type {Boolean}
   */

  debug: false,

  /**
   * Strict mode.
   * Disables asset lookup in the view parent chain.
   */

  strict: false,

  /**
   * Whether to suppress warnings.
   *
   * @type {Boolean}
   */

  silent: false,

  /**
   * Whether allow observer to alter data objects'
   * __proto__.
   *
   * @type {Boolean}
   */

  proto: true,

  /**
   * Whether to parse mustache tags in templates.
   *
   * @type {Boolean}
   */

  interpolate: true,

  /**
   * Whether to use async rendering.
   */

  async: true,

  /**
   * Whether to warn against errors caught when evaluating
   * expressions.
   */

  warnExpressionErrors: true,

  /**
   * Internal flag to indicate the delimiters have been
   * changed.
   *
   * @type {Boolean}
   */

  _delimitersChanged: true,

  /**
   * List of asset types that a component can own.
   *
   * @type {Array}
   */

  _assetTypes: [
    'component',
    'directive',
    'elementDirective',
    'filter',
    'transition',
    'partial'
  ],

  /**
   * prop binding modes
   */

  _propBindingModes: {
    ONE_WAY: 0,
    TWO_WAY: 1,
    ONE_TIME: 2
  },

  /**
   * Max circular updates allowed in a batcher flush cycle.
   */

  _maxUpdateCount: 100

}

/**
 * Interpolation delimiters.
 * We need to mark the changed flag so that the text parser
 * knows it needs to recompile the regex.
 *
 * @type {Array<String>}
 */

var delimiters = ['{{', '}}']
Object.defineProperty(module.exports, 'delimiters', {
  get: function () {
    return delimiters
  },
  set: function (val) {
    delimiters = val
    this._delimitersChanged = true
  }
})

},{}],23:[function(require,module,exports){
(function (process){
var _ = require('./util')
var config = require('./config')
var Watcher = require('./watcher')
var textParser = require('./parsers/text')
var expParser = require('./parsers/expression')
function noop () {}

/**
 * A directive links a DOM element with a piece of data,
 * which is the result of evaluating an expression.
 * It registers a watcher with the expression and calls
 * the DOM update function when a change is triggered.
 *
 * @param {String} name
 * @param {Node} el
 * @param {Vue} vm
 * @param {Object} descriptor
 *                 - {String} expression
 *                 - {String} [arg]
 *                 - {Array<Object>} [filters]
 * @param {Object} def - directive definition object
 * @param {Vue|undefined} host - transclusion host target
 * @constructor
 */

function Directive (name, el, vm, descriptor, def, host) {
  // public
  this.name = name
  this.el = el
  this.vm = vm
  // copy descriptor props
  this.raw = descriptor.raw
  this.expression = descriptor.expression
  this.arg = descriptor.arg
  this.filters = descriptor.filters
  // private
  this._descriptor = descriptor
  this._host = host
  this._locked = false
  this._bound = false
  this._listeners = null
  // init
  this._bind(def)
}

/**
 * Initialize the directive, mixin definition properties,
 * setup the watcher, call definition bind() and update()
 * if present.
 *
 * @param {Object} def
 */

Directive.prototype._bind = function (def) {
  if (
    (this.name !== 'cloak' || this.vm._isCompiled) &&
    this.el && this.el.removeAttribute
  ) {
    this.el.removeAttribute(config.prefix + this.name)
  }
  if (typeof def === 'function') {
    this.update = def
  } else {
    _.extend(this, def)
  }
  this._watcherExp = this.expression
  this._checkDynamicLiteral()
  if (this.bind) {
    this.bind()
  }
  if (this._watcherExp &&
      (this.update || this.twoWay) &&
      (!this.isLiteral || this._isDynamicLiteral) &&
      !this._checkStatement()) {
    // wrapped updater for context
    var dir = this
    if (this.update) {
      this._update = function (val, oldVal) {
        if (!dir._locked) {
          dir.update(val, oldVal)
        }
      }
    } else {
      this._update = noop
    }
    // pre-process hook called before the value is piped
    // through the filters. used in v-repeat.
    var preProcess = this._preProcess
      ? _.bind(this._preProcess, this)
      : null
    var watcher = this._watcher = new Watcher(
      this.vm,
      this._watcherExp,
      this._update, // callback
      {
        filters: this.filters,
        twoWay: this.twoWay,
        deep: this.deep,
        preProcess: preProcess
      }
    )
    if (this._initValue != null) {
      watcher.set(this._initValue)
    } else if (this.update) {
      this.update(watcher.value)
    }
  }
  this._bound = true
}

/**
 * check if this is a dynamic literal binding.
 *
 * e.g. v-component="{{currentView}}"
 */

Directive.prototype._checkDynamicLiteral = function () {
  var expression = this.expression
  if (expression && this.isLiteral) {
    var tokens = textParser.parse(expression)
    if (tokens) {
      var exp = textParser.tokensToExp(tokens)
      this.expression = this.vm.$get(exp)
      this._watcherExp = exp
      this._isDynamicLiteral = true
    }
  }
}

/**
 * Check if the directive is a function caller
 * and if the expression is a callable one. If both true,
 * we wrap up the expression and use it as the event
 * handler.
 *
 * e.g. v-on="click: a++"
 *
 * @return {Boolean}
 */

Directive.prototype._checkStatement = function () {
  var expression = this.expression
  if (
    expression && this.acceptStatement &&
    !expParser.isSimplePath(expression)
  ) {
    var fn = expParser.parse(expression).get
    var vm = this.vm
    var handler = function () {
      fn.call(vm, vm)
    }
    if (this.filters) {
      handler = vm._applyFilters(handler, null, this.filters)
    }
    this.update(handler)
    return true
  }
}

/**
 * Check for an attribute directive param, e.g. lazy
 *
 * @param {String} name
 * @return {String}
 */

Directive.prototype._checkParam = function (name) {
  var param = this.el.getAttribute(name)
  if (param !== null) {
    this.el.removeAttribute(name)
    param = this.vm.$interpolate(param)
  }
  return param
}

/**
 * Set the corresponding value with the setter.
 * This should only be used in two-way directives
 * e.g. v-model.
 *
 * @param {*} value
 * @public
 */

Directive.prototype.set = function (value) {
  /* istanbul ignore else */
  if (this.twoWay) {
    this._withLock(function () {
      this._watcher.set(value)
    })
  } else if (process.env.NODE_ENV !== 'production') {
    _.warn(
      'Directive.set() can only be used inside twoWay' +
      'directives.'
    )
  }
}

/**
 * Execute a function while preventing that function from
 * triggering updates on this directive instance.
 *
 * @param {Function} fn
 */

Directive.prototype._withLock = function (fn) {
  var self = this
  self._locked = true
  fn.call(self)
  _.nextTick(function () {
    self._locked = false
  })
}

/**
 * Convenience method that attaches a DOM event listener
 * to the directive element and autometically tears it down
 * during unbind.
 *
 * @param {String} event
 * @param {Function} handler
 */

Directive.prototype.on = function (event, handler) {
  _.on(this.el, event, handler)
  ;(this._listeners || (this._listeners = []))
    .push([event, handler])
}

/**
 * Teardown the watcher and call unbind.
 */

Directive.prototype._teardown = function () {
  if (this._bound) {
    this._bound = false
    if (this.unbind) {
      this.unbind()
    }
    if (this._watcher) {
      this._watcher.teardown()
    }
    var listeners = this._listeners
    if (listeners) {
      for (var i = 0; i < listeners.length; i++) {
        _.off(this.el, listeners[i][0], listeners[i][1])
      }
    }
    this.vm = this.el =
    this._watcher = this._listeners = null
  }
}

module.exports = Directive

}).call(this,require('_process'))
},{"./config":22,"./parsers/expression":60,"./parsers/text":63,"./util":71,"./watcher":75,"_process":1}],24:[function(require,module,exports){
// xlink
var xlinkNS = 'http://www.w3.org/1999/xlink'
var xlinkRE = /^xlink:/
var inputProps = {
  value: 1,
  checked: 1,
  selected: 1
}

module.exports = {

  priority: 850,

  update: function (value) {
    if (this.arg) {
      this.setAttr(this.arg, value)
    } else if (typeof value === 'object') {
      this.objectHandler(value)
    }
  },

  objectHandler: function (value) {
    // cache object attrs so that only changed attrs
    // are actually updated.
    var cache = this.cache || (this.cache = {})
    var attr, val
    for (attr in cache) {
      if (!(attr in value)) {
        this.setAttr(attr, null)
        delete cache[attr]
      }
    }
    for (attr in value) {
      val = value[attr]
      if (val !== cache[attr]) {
        cache[attr] = val
        this.setAttr(attr, val)
      }
    }
  },

  setAttr: function (attr, value) {
    if (inputProps[attr] && attr in this.el) {
      if (!this.valueRemoved) {
        this.el.removeAttribute(attr)
        this.valueRemoved = true
      }
      this.el[attr] = value
    } else if (value != null && value !== false) {
      if (xlinkRE.test(attr)) {
        this.el.setAttributeNS(xlinkNS, attr, value)
      } else {
        this.el.setAttribute(attr, value)
      }
    } else {
      this.el.removeAttribute(attr)
    }
  }
}

},{}],25:[function(require,module,exports){
var _ = require('../util')
var addClass = _.addClass
var removeClass = _.removeClass

module.exports = {

  bind: function () {
    // interpolations like class="{{abc}}" are converted
    // to v-class, and we need to remove the raw,
    // uninterpolated className at binding time.
    var raw = this._descriptor._rawClass
    if (raw) {
      this.prevKeys = raw.trim().split(/\s+/)
    }
  },

  update: function (value) {
    if (this.arg) {
      // single toggle
      if (value) {
        addClass(this.el, this.arg)
      } else {
        removeClass(this.el, this.arg)
      }
    } else {
      if (value && typeof value === 'string') {
        this.handleObject(stringToObject(value))
      } else if (_.isPlainObject(value)) {
        this.handleObject(value)
      } else {
        this.cleanup()
      }
    }
  },

  handleObject: function (value) {
    this.cleanup(value)
    var keys = this.prevKeys = Object.keys(value)
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i]
      if (value[key]) {
        addClass(this.el, key)
      } else {
        removeClass(this.el, key)
      }
    }
  },

  cleanup: function (value) {
    if (this.prevKeys) {
      var i = this.prevKeys.length
      while (i--) {
        var key = this.prevKeys[i]
        if (!value || !value.hasOwnProperty(key)) {
          removeClass(this.el, key)
        }
      }
    }
  }
}

function stringToObject (value) {
  var res = {}
  var keys = value.trim().split(/\s+/)
  var i = keys.length
  while (i--) {
    res[keys[i]] = true
  }
  return res
}

},{"../util":71}],26:[function(require,module,exports){
var config = require('../config')

module.exports = {
  bind: function () {
    var el = this.el
    this.vm.$once('hook:compiled', function () {
      el.removeAttribute(config.prefix + 'cloak')
    })
  }
}

},{"../config":22}],27:[function(require,module,exports){
(function (process){
var _ = require('../util')
var config = require('../config')
var templateParser = require('../parsers/template')

module.exports = {

  isLiteral: true,

  /**
   * Setup. Two possible usages:
   *
   * - static:
   *   v-component="comp"
   *
   * - dynamic:
   *   v-component="{{currentView}}"
   */

  bind: function () {
    if (!this.el.__vue__) {
      // create a ref anchor
      this.anchor = _.createAnchor('v-component')
      _.replace(this.el, this.anchor)
      // check keep-alive options.
      // If yes, instead of destroying the active vm when
      // hiding (v-if) or switching (dynamic literal) it,
      // we simply remove it from the DOM and save it in a
      // cache object, with its constructor id as the key.
      this.keepAlive = this._checkParam('keep-alive') != null
      // wait for event before insertion
      this.waitForEvent = this._checkParam('wait-for')
      // check ref
      this.refID = this._checkParam(config.prefix + 'ref')
      if (this.keepAlive) {
        this.cache = {}
      }
      // check inline-template
      if (this._checkParam('inline-template') !== null) {
        // extract inline template as a DocumentFragment
        this.template = _.extractContent(this.el, true)
      }
      // component resolution related state
      this.pendingComponentCb =
      this.Component = null
      // transition related state
      this.pendingRemovals = 0
      this.pendingRemovalCb = null
      // if static, build right now.
      if (!this._isDynamicLiteral) {
        this.resolveComponent(this.expression, _.bind(this.initStatic, this))
      } else {
        // check dynamic component params
        this.transMode = this._checkParam('transition-mode')
      }
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'cannot mount component "' + this.expression + '" ' +
        'on already mounted element: ' + this.el
      )
    }
  },

  /**
   * Initialize a static component.
   */

  initStatic: function () {
    // wait-for
    var anchor = this.anchor
    var options
    var waitFor = this.waitForEvent
    if (waitFor) {
      options = {
        created: function () {
          this.$once(waitFor, function () {
            this.$before(anchor)
          })
        }
      }
    }
    var child = this.build(options)
    this.setCurrent(child)
    if (!this.waitForEvent) {
      child.$before(anchor)
    }
  },

  /**
   * Public update, called by the watcher in the dynamic
   * literal scenario, e.g. v-component="{{view}}"
   */

  update: function (value) {
    this.setComponent(value)
  },

  /**
   * Switch dynamic components. May resolve the component
   * asynchronously, and perform transition based on
   * specified transition mode. Accepts a few additional
   * arguments specifically for vue-router.
   *
   * The callback is called when the full transition is
   * finished.
   *
   * @param {String} value
   * @param {Function} [cb]
   */

  setComponent: function (value, cb) {
    this.invalidatePending()
    if (!value) {
      // just remove current
      this.unbuild(true)
      this.remove(this.childVM, cb)
      this.unsetCurrent()
    } else {
      this.resolveComponent(value, _.bind(function () {
        this.unbuild(true)
        var options
        var self = this
        var waitFor = this.waitForEvent
        if (waitFor) {
          options = {
            created: function () {
              this.$once(waitFor, function () {
                self.waitingFor = null
                self.transition(this, cb)
              })
            }
          }
        }
        var cached = this.getCached()
        var newComponent = this.build(options)
        if (!waitFor || cached) {
          this.transition(newComponent, cb)
        } else {
          this.waitingFor = newComponent
        }
      }, this))
    }
  },

  /**
   * Resolve the component constructor to use when creating
   * the child vm.
   */

  resolveComponent: function (id, cb) {
    var self = this
    this.pendingComponentCb = _.cancellable(function (Component) {
      self.Component = Component
      cb()
    })
    this.vm._resolveComponent(id, this.pendingComponentCb)
  },

  /**
   * When the component changes or unbinds before an async
   * constructor is resolved, we need to invalidate its
   * pending callback.
   */

  invalidatePending: function () {
    if (this.pendingComponentCb) {
      this.pendingComponentCb.cancel()
      this.pendingComponentCb = null
    }
  },

  /**
   * Instantiate/insert a new child vm.
   * If keep alive and has cached instance, insert that
   * instance; otherwise build a new one and cache it.
   *
   * @param {Object} [extraOptions]
   * @return {Vue} - the created instance
   */

  build: function (extraOptions) {
    var cached = this.getCached()
    if (cached) {
      return cached
    }
    if (this.Component) {
      // default options
      var options = {
        el: templateParser.clone(this.el),
        template: this.template,
        // if no inline-template, then the compiled
        // linker can be cached for better performance.
        _linkerCachable: !this.template,
        _asComponent: true,
        _isRouterView: this._isRouterView,
        _context: this.vm
      }
      // extra options
      if (extraOptions) {
        _.extend(options, extraOptions)
      }
      var parent = this._host || this.vm
      var child = parent.$addChild(options, this.Component)
      if (this.keepAlive) {
        this.cache[this.Component.cid] = child
      }
      return child
    }
  },

  /**
   * Try to get a cached instance of the current component.
   *
   * @return {Vue|undefined}
   */

  getCached: function () {
    return this.keepAlive && this.cache[this.Component.cid]
  },

  /**
   * Teardown the current child, but defers cleanup so
   * that we can separate the destroy and removal steps.
   *
   * @param {Boolean} defer
   */

  unbuild: function (defer) {
    if (this.waitingFor) {
      this.waitingFor.$destroy()
      this.waitingFor = null
    }
    var child = this.childVM
    if (!child || this.keepAlive) {
      return
    }
    // the sole purpose of `deferCleanup` is so that we can
    // "deactivate" the vm right now and perform DOM removal
    // later.
    child.$destroy(false, defer)
  },

  /**
   * Remove current destroyed child and manually do
   * the cleanup after removal.
   *
   * @param {Function} cb
   */

  remove: function (child, cb) {
    var keepAlive = this.keepAlive
    if (child) {
      // we may have a component switch when a previous
      // component is still being transitioned out.
      // we want to trigger only one lastest insertion cb
      // when the existing transition finishes. (#1119)
      this.pendingRemovals++
      this.pendingRemovalCb = cb
      var self = this
      child.$remove(function () {
        self.pendingRemovals--
        if (!keepAlive) child._cleanup()
        if (!self.pendingRemovals && self.pendingRemovalCb) {
          self.pendingRemovalCb()
          self.pendingRemovalCb = null
        }
      })
    } else if (cb) {
      cb()
    }
  },

  /**
   * Actually swap the components, depending on the
   * transition mode. Defaults to simultaneous.
   *
   * @param {Vue} target
   * @param {Function} [cb]
   */

  transition: function (target, cb) {
    var self = this
    var current = this.childVM
    this.setCurrent(target)
    switch (self.transMode) {
      case 'in-out':
        target.$before(self.anchor, function () {
          self.remove(current, cb)
        })
        break
      case 'out-in':
        self.remove(current, function () {
          target.$before(self.anchor, cb)
        })
        break
      default:
        self.remove(current)
        target.$before(self.anchor, cb)
    }
  },

  /**
   * Set childVM and parent ref
   */

  setCurrent: function (child) {
    this.unsetCurrent()
    this.childVM = child
    var refID = child._refID || this.refID
    if (refID) {
      this.vm.$[refID] = child
    }
  },

  /**
   * Unset childVM and parent ref
   */

  unsetCurrent: function () {
    var child = this.childVM
    this.childVM = null
    var refID = (child && child._refID) || this.refID
    if (refID) {
      this.vm.$[refID] = null
    }
  },

  /**
   * Unbind.
   */

  unbind: function () {
    this.invalidatePending()
    // Do not defer cleanup when unbinding
    this.unbuild()
    this.unsetCurrent()
    // destroy all keep-alive cached instances
    if (this.cache) {
      for (var key in this.cache) {
        this.cache[key].$destroy()
      }
      this.cache = null
    }
  }
}

}).call(this,require('_process'))
},{"../config":22,"../parsers/template":62,"../util":71,"_process":1}],28:[function(require,module,exports){
module.exports = {

  isLiteral: true,

  bind: function () {
    this.vm.$$[this.expression] = this.el
  },

  unbind: function () {
    delete this.vm.$$[this.expression]
  }
}

},{}],29:[function(require,module,exports){
var _ = require('../util')
var templateParser = require('../parsers/template')

module.exports = {

  bind: function () {
    // a comment node means this is a binding for
    // {{{ inline unescaped html }}}
    if (this.el.nodeType === 8) {
      // hold nodes
      this.nodes = []
      // replace the placeholder with proper anchor
      this.anchor = _.createAnchor('v-html')
      _.replace(this.el, this.anchor)
    }
  },

  update: function (value) {
    value = _.toString(value)
    if (this.nodes) {
      this.swap(value)
    } else {
      this.el.innerHTML = value
    }
  },

  swap: function (value) {
    // remove old nodes
    var i = this.nodes.length
    while (i--) {
      _.remove(this.nodes[i])
    }
    // convert new value to a fragment
    // do not attempt to retrieve from id selector
    var frag = templateParser.parse(value, true, true)
    // save a reference to these nodes so we can remove later
    this.nodes = _.toArray(frag.childNodes)
    _.before(frag, this.anchor)
  }
}

},{"../parsers/template":62,"../util":71}],30:[function(require,module,exports){
(function (process){
var _ = require('../util')
var compiler = require('../compiler')
var templateParser = require('../parsers/template')
var transition = require('../transition')
var Cache = require('../cache')
var cache = new Cache(1000)

module.exports = {

  bind: function () {
    var el = this.el
    if (!el.__vue__) {
      this.start = _.createAnchor('v-if-start')
      this.end = _.createAnchor('v-if-end')
      _.replace(el, this.end)
      _.before(this.start, this.end)
      if (_.isTemplate(el)) {
        this.template = templateParser.parse(el, true)
      } else {
        this.template = document.createDocumentFragment()
        this.template.appendChild(templateParser.clone(el))
      }
      // compile the nested partial
      var cacheId = (this.vm.constructor.cid || '') + el.outerHTML
      this.linker = cache.get(cacheId)
      if (!this.linker) {
        this.linker = compiler.compile(
          this.template,
          this.vm.$options,
          true // partial
        )
        cache.put(cacheId, this.linker)
      }
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'v-if="' + this.expression + '" cannot be ' +
        'used on an instance root element.'
      )
      this.invalid = true
    }
  },

  update: function (value) {
    if (this.invalid) return
    if (value) {
      // avoid duplicate compiles, since update() can be
      // called with different truthy values
      if (!this.unlink) {
        this.link(
          templateParser.clone(this.template),
          this.linker
        )
      }
    } else {
      this.teardown()
    }
  },

  link: function (frag, linker) {
    var vm = this.vm
    this.unlink = linker(vm, frag, this._host /* important */)
    transition.blockAppend(frag, this.end, vm)
    // call attached for all the child components created
    // during the compilation
    if (_.inDoc(vm.$el)) {
      var children = this.getContainedComponents()
      if (children) children.forEach(callAttach)
    }
  },

  teardown: function () {
    if (!this.unlink) return
    // collect children beforehand
    var children
    if (_.inDoc(this.vm.$el)) {
      children = this.getContainedComponents()
    }
    transition.blockRemove(this.start, this.end, this.vm)
    if (children) children.forEach(callDetach)
    this.unlink()
    this.unlink = null
  },

  getContainedComponents: function () {
    var vm = this._host || this.vm
    var start = this.start.nextSibling
    var end = this.end

    function contains (c) {
      var cur = start
      var next
      while (next !== end) {
        next = cur.nextSibling
        if (
          cur === c.$el ||
          cur.contains && cur.contains(c.$el)
        ) {
          return true
        }
        cur = next
      }
      return false
    }

    return vm.$children.length &&
      vm.$children.filter(contains)
  },

  unbind: function () {
    if (this.unlink) this.unlink()
  }

}

function callAttach (child) {
  if (!child._isAttached) {
    child._callHook('attached')
  }
}

function callDetach (child) {
  if (child._isAttached) {
    child._callHook('detached')
  }
}

}).call(this,require('_process'))
},{"../cache":17,"../compiler":20,"../parsers/template":62,"../transition":64,"../util":71,"_process":1}],31:[function(require,module,exports){
// manipulation directives
exports.text = require('./text')
exports.html = require('./html')
exports.attr = require('./attr')
exports.show = require('./show')
exports['class'] = require('./class')
exports.el = require('./el')
exports.ref = require('./ref')
exports.cloak = require('./cloak')
exports.style = require('./style')
exports.transition = require('./transition')

// event listener directives
exports.on = require('./on')
exports.model = require('./model')

// logic control directives
exports.repeat = require('./repeat')
exports['if'] = require('./if')

// internal directives that should not be used directly
// but we still want to expose them for advanced usage.
exports._component = require('./component')
exports._prop = require('./prop')

},{"./attr":24,"./class":25,"./cloak":26,"./component":27,"./el":28,"./html":29,"./if":30,"./model":33,"./on":37,"./prop":38,"./ref":39,"./repeat":40,"./show":41,"./style":42,"./text":43,"./transition":44}],32:[function(require,module,exports){
var _ = require('../../util')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el
    var trueExp = this._checkParam('true-exp')
    var falseExp = this._checkParam('false-exp')

    this._matchValue = function (value) {
      if (trueExp !== null) {
        return _.looseEqual(value, self.vm.$eval(trueExp))
      } else {
        return !!value
      }
    }

    function getValue () {
      var val = el.checked
      if (val && trueExp !== null) {
        val = self.vm.$eval(trueExp)
      }
      if (!val && falseExp !== null) {
        val = self.vm.$eval(falseExp)
      }
      return val
    }

    this.on('change', function () {
      self.set(getValue())
    })

    if (el.checked) {
      this._initValue = getValue()
    }
  },

  update: function (value) {
    this.el.checked = this._matchValue(value)
  }
}

},{"../../util":71}],33:[function(require,module,exports){
(function (process){
var _ = require('../../util')

var handlers = {
  text: require('./text'),
  radio: require('./radio'),
  select: require('./select'),
  checkbox: require('./checkbox')
}

module.exports = {

  priority: 800,
  twoWay: true,
  handlers: handlers,

  /**
   * Possible elements:
   *   <select>
   *   <textarea>
   *   <input type="*">
   *     - text
   *     - checkbox
   *     - radio
   *     - number
   *     - TODO: more types may be supplied as a plugin
   */

  bind: function () {
    // friendly warning...
    this.checkFilters()
    if (this.hasRead && !this.hasWrite) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'It seems you are using a read-only filter with ' +
        'v-model. You might want to use a two-way filter ' +
        'to ensure correct behavior.'
      )
    }
    var el = this.el
    var tag = el.tagName
    var handler
    if (tag === 'INPUT') {
      handler = handlers[el.type] || handlers.text
    } else if (tag === 'SELECT') {
      handler = handlers.select
    } else if (tag === 'TEXTAREA') {
      handler = handlers.text
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'v-model does not support element type: ' + tag
      )
      return
    }
    el.__v_model = this
    handler.bind.call(this)
    this.update = handler.update
    this._unbind = handler.unbind
  },

  /**
   * Check read/write filter stats.
   */

  checkFilters: function () {
    var filters = this.filters
    if (!filters) return
    var i = filters.length
    while (i--) {
      var filter = _.resolveAsset(this.vm.$options, 'filters', filters[i].name)
      if (typeof filter === 'function' || filter.read) {
        this.hasRead = true
      }
      if (filter.write) {
        this.hasWrite = true
      }
    }
  },

  unbind: function () {
    this.el.__v_model = null
    this._unbind && this._unbind()
  }
}

}).call(this,require('_process'))
},{"../../util":71,"./checkbox":32,"./radio":34,"./select":35,"./text":36,"_process":1}],34:[function(require,module,exports){
var _ = require('../../util')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el
    var number = this._checkParam('number') != null
    var expression = this._checkParam('exp')

    this.getValue = function () {
      var val = el.value
      if (number) {
        val = _.toNumber(val)
      } else if (expression !== null) {
        val = self.vm.$eval(expression)
      }
      return val
    }

    this.on('change', function () {
      self.set(self.getValue())
    })

    if (el.checked) {
      this._initValue = this.getValue()
    }
  },

  update: function (value) {
    this.el.checked = _.looseEqual(value, this.getValue())
  }
}

},{"../../util":71}],35:[function(require,module,exports){
(function (process){
var _ = require('../../util')
var Watcher = require('../../watcher')
var dirParser = require('../../parsers/directive')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el

    // method to force update DOM using latest value.
    this.forceUpdate = function () {
      if (self._watcher) {
        self.update(self._watcher.get())
      }
    }

    // check options param
    var optionsParam = this._checkParam('options')
    if (optionsParam) {
      initOptions.call(this, optionsParam)
    }
    this.number = this._checkParam('number') != null
    this.multiple = el.hasAttribute('multiple')

    // attach listener
    this.on('change', function () {
      var value = getValue(el, self.multiple)
      value = self.number
        ? _.isArray(value)
          ? value.map(_.toNumber)
          : _.toNumber(value)
        : value
      self.set(value)
    })

    // check initial value (inline selected attribute)
    checkInitialValue.call(this)

    // All major browsers except Firefox resets
    // selectedIndex with value -1 to 0 when the element
    // is appended to a new parent, therefore we have to
    // force a DOM update whenever that happens...
    this.vm.$on('hook:attached', this.forceUpdate)
  },

  update: function (value) {
    var el = this.el
    el.selectedIndex = -1
    if (value == null) {
      if (this.defaultOption) {
        this.defaultOption.selected = true
      }
      return
    }
    var multi = this.multiple && _.isArray(value)
    var options = el.options
    var i = options.length
    var op, val
    while (i--) {
      op = options[i]
      val = op.hasOwnProperty('_value')
        ? op._value
        : op.value
      /* eslint-disable eqeqeq */
      op.selected = multi
        ? indexOf(value, val) > -1
        : _.looseEqual(value, val)
      /* eslint-enable eqeqeq */
    }
  },

  unbind: function () {
    this.vm.$off('hook:attached', this.forceUpdate)
    if (this.optionWatcher) {
      this.optionWatcher.teardown()
    }
  }
}

/**
 * Initialize the option list from the param.
 *
 * @param {String} expression
 */

function initOptions (expression) {
  var self = this
  var el = self.el
  var defaultOption = self.defaultOption = self.el.options[0]
  var descriptor = dirParser.parse(expression)[0]
  function optionUpdateWatcher (value) {
    if (_.isArray(value)) {
      // clear old options.
      // cannot reset innerHTML here because IE family get
      // confused during compilation.
      var i = el.options.length
      while (i--) {
        var option = el.options[i]
        if (option !== defaultOption) {
          var parentNode = option.parentNode
          if (parentNode === el) {
            parentNode.removeChild(option)
          } else {
            el.removeChild(parentNode)
            i = el.options.length
          }
        }
      }
      buildOptions(el, value)
      self.forceUpdate()
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Invalid options value for v-model: ' + value
      )
    }
  }
  this.optionWatcher = new Watcher(
    this.vm,
    descriptor.expression,
    optionUpdateWatcher,
    {
      deep: true,
      filters: descriptor.filters
    }
  )
  // update with initial value
  optionUpdateWatcher(this.optionWatcher.value)
}

/**
 * Build up option elements. IE9 doesn't create options
 * when setting innerHTML on <select> elements, so we have
 * to use DOM API here.
 *
 * @param {Element} parent - a <select> or an <optgroup>
 * @param {Array} options
 */

function buildOptions (parent, options) {
  var op, el
  for (var i = 0, l = options.length; i < l; i++) {
    op = options[i]
    if (!op.options) {
      el = document.createElement('option')
      if (typeof op === 'string' || typeof op === 'number') {
        el.text = el.value = op
      } else {
        if (op.value != null && !_.isObject(op.value)) {
          el.value = op.value
        }
        // object values gets serialized when set as value,
        // so we store the raw value as a different property
        el._value = op.value
        el.text = op.text || ''
        if (op.disabled) {
          el.disabled = true
        }
      }
    } else {
      el = document.createElement('optgroup')
      el.label = op.label
      buildOptions(el, op.options)
    }
    parent.appendChild(el)
  }
}

/**
 * Check the initial value for selected options.
 */

function checkInitialValue () {
  var initValue
  var options = this.el.options
  for (var i = 0, l = options.length; i < l; i++) {
    if (options[i].hasAttribute('selected')) {
      if (this.multiple) {
        (initValue || (initValue = []))
          .push(options[i].value)
      } else {
        initValue = options[i].value
      }
    }
  }
  if (typeof initValue !== 'undefined') {
    this._initValue = this.number
      ? _.toNumber(initValue)
      : initValue
  }
}

/**
 * Get select value
 *
 * @param {SelectElement} el
 * @param {Boolean} multi
 * @return {Array|*}
 */

function getValue (el, multi) {
  var res = multi ? [] : null
  var op, val
  for (var i = 0, l = el.options.length; i < l; i++) {
    op = el.options[i]
    if (op.selected) {
      val = op.hasOwnProperty('_value')
        ? op._value
        : op.value
      if (multi) {
        res.push(val)
      } else {
        return val
      }
    }
  }
  return res
}

/**
 * Native Array.indexOf uses strict equal, but in this
 * case we need to match string/numbers with custom equal.
 *
 * @param {Array} arr
 * @param {*} val
 */

function indexOf (arr, val) {
  var i = arr.length
  while (i--) {
    if (_.looseEqual(arr[i], val)) {
      return i
    }
  }
  return -1
}

}).call(this,require('_process'))
},{"../../parsers/directive":59,"../../util":71,"../../watcher":75,"_process":1}],36:[function(require,module,exports){
var _ = require('../../util')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el
    var isRange = el.type === 'range'

    // check params
    // - lazy: update model on "change" instead of "input"
    var lazy = this._checkParam('lazy') != null
    // - number: cast value into number when updating model.
    var number = this._checkParam('number') != null
    // - debounce: debounce the input listener
    var debounce = parseInt(this._checkParam('debounce'), 10)

    // handle composition events.
    //   http://blog.evanyou.me/2014/01/03/composition-event/
    // skip this for Android because it handles composition
    // events quite differently. Android doesn't trigger
    // composition events for language input methods e.g.
    // Chinese, but instead triggers them for spelling
    // suggestions... (see Discussion/#162)
    var composing = false
    if (!_.isAndroid && !isRange) {
      this.on('compositionstart', function () {
        composing = true
      })
      this.on('compositionend', function () {
        composing = false
        // in IE11 the "compositionend" event fires AFTER
        // the "input" event, so the input handler is blocked
        // at the end... have to call it here.
        //
        // #1327: in lazy mode this is unecessary.
        if (!lazy) {
          self.listener()
        }
      })
    }

    // prevent messing with the input when user is typing,
    // and force update on blur.
    this.focused = false
    if (!isRange) {
      this.on('focus', function () {
        self.focused = true
      })
      this.on('blur', function () {
        self.focused = false
        self.listener()
      })
    }

    // Now attach the main listener
    this.listener = function () {
      if (composing) return
      var val = number || isRange
        ? _.toNumber(el.value)
        : el.value
      self.set(val)
      // force update on next tick to avoid lock & same value
      // also only update when user is not typing
      _.nextTick(function () {
        if (self._bound && !self.focused) {
          self.update(self._watcher.value)
        }
      })
    }
    if (debounce) {
      this.listener = _.debounce(this.listener, debounce)
    }

    // Support jQuery events, since jQuery.trigger() doesn't
    // trigger native events in some cases and some plugins
    // rely on $.trigger()
    //
    // We want to make sure if a listener is attached using
    // jQuery, it is also removed with jQuery, that's why
    // we do the check for each directive instance and
    // store that check result on itself. This also allows
    // easier test coverage control by unsetting the global
    // jQuery variable in tests.
    this.hasjQuery = typeof jQuery === 'function'
    if (this.hasjQuery) {
      jQuery(el).on('change', this.listener)
      if (!lazy) {
        jQuery(el).on('input', this.listener)
      }
    } else {
      this.on('change', this.listener)
      if (!lazy) {
        this.on('input', this.listener)
      }
    }

    // IE9 doesn't fire input event on backspace/del/cut
    if (!lazy && _.isIE9) {
      this.on('cut', function () {
        _.nextTick(self.listener)
      })
      this.on('keyup', function (e) {
        if (e.keyCode === 46 || e.keyCode === 8) {
          self.listener()
        }
      })
    }

    // set initial value if present
    if (
      el.hasAttribute('value') ||
      (el.tagName === 'TEXTAREA' && el.value.trim())
    ) {
      this._initValue = number
        ? _.toNumber(el.value)
        : el.value
    }
  },

  update: function (value) {
    this.el.value = _.toString(value)
  },

  unbind: function () {
    var el = this.el
    if (this.hasjQuery) {
      jQuery(el).off('change', this.listener)
      jQuery(el).off('input', this.listener)
    }
  }
}

},{"../../util":71}],37:[function(require,module,exports){
(function (process){
var _ = require('../util')

module.exports = {

  acceptStatement: true,
  priority: 700,

  bind: function () {
    // deal with iframes
    if (
      this.el.tagName === 'IFRAME' &&
      this.arg !== 'load'
    ) {
      var self = this
      this.iframeBind = function () {
        _.on(self.el.contentWindow, self.arg, self.handler)
      }
      this.on('load', this.iframeBind)
    }
  },

  update: function (handler) {
    if (typeof handler !== 'function') {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Directive v-on="' + this.arg + ': ' +
        this.expression + '" expects a function value, ' +
        'got ' + handler
      )
      return
    }
    this.reset()
    var vm = this.vm
    this.handler = function (e) {
      e.targetVM = vm
      vm.$event = e
      var res = handler(e)
      vm.$event = null
      return res
    }
    if (this.iframeBind) {
      this.iframeBind()
    } else {
      _.on(this.el, this.arg, this.handler)
    }
  },

  reset: function () {
    var el = this.iframeBind
      ? this.el.contentWindow
      : this.el
    if (this.handler) {
      _.off(el, this.arg, this.handler)
    }
  },

  unbind: function () {
    this.reset()
  }
}

}).call(this,require('_process'))
},{"../util":71,"_process":1}],38:[function(require,module,exports){
// NOTE: the prop internal directive is compiled and linked
// during _initScope(), before the created hook is called.
// The purpose is to make the initial prop values available
// inside `created` hooks and `data` functions.

var _ = require('../util')
var Watcher = require('../watcher')
var bindingModes = require('../config')._propBindingModes

module.exports = {

  bind: function () {

    var child = this.vm
    var parent = child._context
    // passed in from compiler directly
    var prop = this._descriptor
    var childKey = prop.path
    var parentKey = prop.parentPath

    this.parentWatcher = new Watcher(
      parent,
      parentKey,
      function (val) {
        if (_.assertProp(prop, val)) {
          child[childKey] = val
        }
      }, { sync: true }
    )

    // set the child initial value.
    var value = this.parentWatcher.value
    if (childKey === '$data') {
      child._data = value
    } else {
      _.initProp(child, prop, value)
    }

    // setup two-way binding
    if (prop.mode === bindingModes.TWO_WAY) {
      // important: defer the child watcher creation until
      // the created hook (after data observation)
      var self = this
      child.$once('hook:created', function () {
        self.childWatcher = new Watcher(
          child,
          childKey,
          function (val) {
            parent.$set(parentKey, val)
          }, { sync: true }
        )
      })
    }
  },

  unbind: function () {
    this.parentWatcher.teardown()
    if (this.childWatcher) {
      this.childWatcher.teardown()
    }
  }
}

},{"../config":22,"../util":71,"../watcher":75}],39:[function(require,module,exports){
(function (process){
var _ = require('../util')

module.exports = {

  isLiteral: true,

  bind: function () {
    var vm = this.el.__vue__
    if (!vm) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'v-ref should only be used on a component root element.'
      )
      return
    }
    // If we get here, it means this is a `v-ref` on a
    // child, because parent scope `v-ref` is stripped in
    // `v-component` already. So we just record our own ref
    // here - it will overwrite parent ref in `v-component`,
    // if any.
    vm._refID = this.expression
  }
}

}).call(this,require('_process'))
},{"../util":71,"_process":1}],40:[function(require,module,exports){
(function (process){
var _ = require('../util')
var config = require('../config')
var isObject = _.isObject
var isPlainObject = _.isPlainObject
var textParser = require('../parsers/text')
var expParser = require('../parsers/expression')
var templateParser = require('../parsers/template')
var compiler = require('../compiler')
var uid = 0

// async component resolution states
var UNRESOLVED = 0
var PENDING = 1
var RESOLVED = 2
var ABORTED = 3

module.exports = {

  /**
   * Setup.
   */

  bind: function () {

    // some helpful tips...
    /* istanbul ignore if */
    if (
      process.env.NODE_ENV !== 'production' &&
      this.el.tagName === 'OPTION' &&
      this.el.parentNode && this.el.parentNode.__v_model
    ) {
      _.warn(
        'Don\'t use v-repeat for v-model options; ' +
        'use the `options` param instead: ' +
        'http://vuejs.org/guide/forms.html#Dynamic_Select_Options'
      )
    }

    // support for item in array syntax
    var inMatch = this.expression.match(/(.*) in (.*)/)
    if (inMatch) {
      this.arg = inMatch[1]
      this._watcherExp = inMatch[2]
    }
    // uid as a cache identifier
    this.id = '__v_repeat_' + (++uid)

    // setup anchor nodes
    this.start = _.createAnchor('v-repeat-start')
    this.end = _.createAnchor('v-repeat-end')
    _.replace(this.el, this.end)
    _.before(this.start, this.end)

    // check if this is a block repeat
    this.template = _.isTemplate(this.el)
      ? templateParser.parse(this.el, true)
      : this.el

    // check for trackby param
    this.idKey = this._checkParam('track-by')
    // check for transition stagger
    var stagger = +this._checkParam('stagger')
    this.enterStagger = +this._checkParam('enter-stagger') || stagger
    this.leaveStagger = +this._checkParam('leave-stagger') || stagger

    // check for v-ref/v-el
    this.refID = this._checkParam(config.prefix + 'ref')
    this.elID = this._checkParam(config.prefix + 'el')

    // check other directives that need to be handled
    // at v-repeat level
    this.checkIf()
    this.checkComponent()

    // create cache object
    this.cache = Object.create(null)
  },

  /**
   * Warn against v-if usage.
   */

  checkIf: function () {
    if (_.attr(this.el, 'if') !== null) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Don\'t use v-if with v-repeat. ' +
        'Use v-show or the "filterBy" filter instead.'
      )
    }
  },

  /**
   * Check the component constructor to use for repeated
   * instances. If static we resolve it now, otherwise it
   * needs to be resolved at build time with actual data.
   */

  checkComponent: function () {
    this.componentState = UNRESOLVED
    var options = this.vm.$options
    var id = _.checkComponent(this.el, options)
    if (!id) {
      // default constructor
      this.Component = _.Vue
      // inline repeats should inherit
      this.inline = true
      // important: transclude with no options, just
      // to ensure block start and block end
      this.template = compiler.transclude(this.template)
      var copy = _.extend({}, options)
      copy._asComponent = false
      this._linkFn = compiler.compile(this.template, copy)
    } else {
      this.Component = null
      this.asComponent = true
      // check inline-template
      if (this._checkParam('inline-template') !== null) {
        // extract inline template as a DocumentFragment
        this.inlineTemplate = _.extractContent(this.el, true)
      }
      var tokens = textParser.parse(id)
      if (tokens) {
        // dynamic component to be resolved later
        var componentExp = textParser.tokensToExp(tokens)
        this.componentGetter = expParser.parse(componentExp).get
      } else {
        // static
        this.componentId = id
        this.pendingData = null
      }
    }
  },

  resolveComponent: function () {
    this.componentState = PENDING
    this.vm._resolveComponent(this.componentId, _.bind(function (Component) {
      if (this.componentState === ABORTED) {
        return
      }
      this.Component = Component
      this.componentState = RESOLVED
      this.realUpdate(this.pendingData)
      this.pendingData = null
    }, this))
  },

  /**
   * Resolve a dynamic component to use for an instance.
   * The tricky part here is that there could be dynamic
   * components depending on instance data.
   *
   * @param {Object} data
   * @param {Object} meta
   * @return {Function}
   */

  resolveDynamicComponent: function (data, meta) {
    // create a temporary context object and copy data
    // and meta properties onto it.
    // use _.define to avoid accidentally overwriting scope
    // properties.
    var context = Object.create(this.vm)
    var key
    for (key in data) {
      _.define(context, key, data[key])
    }
    for (key in meta) {
      _.define(context, key, meta[key])
    }
    var id = this.componentGetter.call(context, context)
    var Component = _.resolveAsset(this.vm.$options, 'components', id)
    if (process.env.NODE_ENV !== 'production') {
      _.assertAsset(Component, 'component', id)
    }
    if (!Component.options) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Async resolution is not supported for v-repeat ' +
        '+ dynamic component. (component: ' + id + ')'
      )
      return _.Vue
    }
    return Component
  },

  /**
   * Update.
   * This is called whenever the Array mutates. If we have
   * a component, we might need to wait for it to resolve
   * asynchronously.
   *
   * @param {Array|Number|String} data
   */

  update: function (data) {
    if (process.env.NODE_ENV !== 'production' && !_.isArray(data)) {
      _.warn(
        'v-repeat pre-converts Objects into Arrays, and ' +
        'v-repeat filters should always return Arrays.'
      )
    }
    if (this.componentId) {
      var state = this.componentState
      if (state === UNRESOLVED) {
        this.pendingData = data
        // once resolved, it will call realUpdate
        this.resolveComponent()
      } else if (state === PENDING) {
        this.pendingData = data
      } else if (state === RESOLVED) {
        this.realUpdate(data)
      }
    } else {
      this.realUpdate(data)
    }
  },

  /**
   * The real update that actually modifies the DOM.
   *
   * @param {Array|Number|String} data
   */

  realUpdate: function (data) {
    this.vms = this.diff(data, this.vms)
    // update v-ref
    if (this.refID) {
      this.vm.$[this.refID] = this.converted
        ? toRefObject(this.vms)
        : this.vms
    }
    if (this.elID) {
      this.vm.$$[this.elID] = this.vms.map(function (vm) {
        return vm.$el
      })
    }
  },

  /**
   * Diff, based on new data and old data, determine the
   * minimum amount of DOM manipulations needed to make the
   * DOM reflect the new data Array.
   *
   * The algorithm diffs the new data Array by storing a
   * hidden reference to an owner vm instance on previously
   * seen data. This allows us to achieve O(n) which is
   * better than a levenshtein distance based algorithm,
   * which is O(m * n).
   *
   * @param {Array} data
   * @param {Array} oldVms
   * @return {Array}
   */

  diff: function (data, oldVms) {
    var idKey = this.idKey
    var converted = this.converted
    var start = this.start
    var end = this.end
    var inDoc = _.inDoc(start)
    var alias = this.arg
    var init = !oldVms
    var vms = new Array(data.length)
    var obj, raw, vm, i, l, primitive
    // First pass, go through the new Array and fill up
    // the new vms array. If a piece of data has a cached
    // instance for it, we reuse it. Otherwise build a new
    // instance.
    for (i = 0, l = data.length; i < l; i++) {
      obj = data[i]
      raw = converted ? obj.$value : obj
      primitive = !isObject(raw)
      vm = !init && this.getVm(raw, i, converted ? obj.$key : null)
      if (vm) { // reusable instance

        if (process.env.NODE_ENV !== 'production' && vm._reused) {
          _.warn(
            'Duplicate objects found in v-repeat="' + this.expression + '": ' +
            JSON.stringify(raw)
          )
        }

        vm._reused = true
        vm.$index = i // update $index
        // update data for track-by or object repeat,
        // since in these two cases the data is replaced
        // rather than mutated.
        if (idKey || converted || primitive) {
          if (alias) {
            vm[alias] = raw
          } else if (_.isPlainObject(raw)) {
            vm.$data = raw
          } else {
            vm.$value = raw
          }
        }
      } else { // new instance
        vm = this.build(obj, i, true)
        vm._reused = false
      }
      vms[i] = vm
      // insert if this is first run
      if (init) {
        vm.$before(end)
      }
    }
    // if this is the first run, we're done.
    if (init) {
      return vms
    }
    // Second pass, go through the old vm instances and
    // destroy those who are not reused (and remove them
    // from cache)
    var removalIndex = 0
    var totalRemoved = oldVms.length - vms.length
    for (i = 0, l = oldVms.length; i < l; i++) {
      vm = oldVms[i]
      if (!vm._reused) {
        this.uncacheVm(vm)
        vm.$destroy(false, true) // defer cleanup until removal
        this.remove(vm, removalIndex++, totalRemoved, inDoc)
      }
    }
    // final pass, move/insert new instances into the
    // right place.
    var targetPrev, prevEl, currentPrev
    var insertionIndex = 0
    for (i = 0, l = vms.length; i < l; i++) {
      vm = vms[i]
      // this is the vm that we should be after
      targetPrev = vms[i - 1]
      prevEl = targetPrev
        ? targetPrev._staggerCb
          ? targetPrev._staggerAnchor
          : targetPrev._fragmentEnd || targetPrev.$el
        : start
      if (vm._reused && !vm._staggerCb) {
        currentPrev = findPrevVm(vm, start, this.id)
        if (currentPrev !== targetPrev) {
          this.move(vm, prevEl)
        }
      } else {
        // new instance, or still in stagger.
        // insert with updated stagger index.
        this.insert(vm, insertionIndex++, prevEl, inDoc)
      }
      vm._reused = false
    }
    return vms
  },

  /**
   * Build a new instance and cache it.
   *
   * @param {Object} data
   * @param {Number} index
   * @param {Boolean} needCache
   */

  build: function (data, index, needCache) {
    var meta = { $index: index }
    if (this.converted) {
      meta.$key = data.$key
    }
    var raw = this.converted ? data.$value : data
    var alias = this.arg
    if (alias) {
      data = {}
      data[alias] = raw
    } else if (!isPlainObject(raw)) {
      // non-object values
      data = {}
      meta.$value = raw
    } else {
      // default
      data = raw
    }
    // resolve constructor
    var Component = this.Component || this.resolveDynamicComponent(data, meta)
    var parent = this._host || this.vm
    var vm = parent.$addChild({
      el: templateParser.clone(this.template),
      data: data,
      inherit: this.inline,
      template: this.inlineTemplate,
      // repeater meta, e.g. $index, $key
      _meta: meta,
      // mark this as an inline-repeat instance
      _repeat: this.inline,
      // is this a component?
      _asComponent: this.asComponent,
      // linker cachable if no inline-template
      _linkerCachable: !this.inlineTemplate && Component !== _.Vue,
      // pre-compiled linker for simple repeats
      _linkFn: this._linkFn,
      // identifier, shows that this vm belongs to this collection
      _repeatId: this.id,
      // transclusion content owner
      _context: this.vm
    }, Component)
    // cache instance
    if (needCache) {
      this.cacheVm(raw, vm, index, this.converted ? meta.$key : null)
    }
    // sync back changes for two-way bindings of primitive values
    var dir = this
    if (this.rawType === 'object' && isPrimitive(raw)) {
      vm.$watch(alias || '$value', function (val) {
        if (dir.filters) {
          process.env.NODE_ENV !== 'production' && _.warn(
            'You seem to be mutating the $value reference of ' +
            'a v-repeat instance (likely through v-model) ' +
            'and filtering the v-repeat at the same time. ' +
            'This will not work properly with an Array of ' +
            'primitive values. Please use an Array of ' +
            'Objects instead.'
          )
        }
        dir._withLock(function () {
          if (dir.converted) {
            dir.rawValue[vm.$key] = val
          } else {
            dir.rawValue.$set(vm.$index, val)
          }
        })
      })
    }
    return vm
  },

  /**
   * Unbind, teardown everything
   */

  unbind: function () {
    this.componentState = ABORTED
    if (this.refID) {
      this.vm.$[this.refID] = null
    }
    if (this.vms) {
      var i = this.vms.length
      var vm
      while (i--) {
        vm = this.vms[i]
        this.uncacheVm(vm)
        vm.$destroy()
      }
    }
  },

  /**
   * Cache a vm instance based on its data.
   *
   * If the data is an object, we save the vm's reference on
   * the data object as a hidden property. Otherwise we
   * cache them in an object and for each primitive value
   * there is an array in case there are duplicates.
   *
   * @param {Object} data
   * @param {Vue} vm
   * @param {Number} index
   * @param {String} [key]
   */

  cacheVm: function (data, vm, index, key) {
    var idKey = this.idKey
    var cache = this.cache
    var primitive = !isObject(data)
    var id
    if (key || idKey || primitive) {
      id = idKey
        ? idKey === '$index'
          ? index
          : data[idKey]
        : (key || index)
      if (!cache[id]) {
        cache[id] = vm
      } else if (!primitive && idKey !== '$index') {
        process.env.NODE_ENV !== 'production' && _.warn(
          'Duplicate objects with the same track-by key in v-repeat: ' + id
        )
      }
    } else {
      id = this.id
      if (data.hasOwnProperty(id)) {
        if (data[id] === null) {
          data[id] = vm
        } else {
          process.env.NODE_ENV !== 'production' && _.warn(
            'Duplicate objects found in v-repeat="' + this.expression + '": ' +
            JSON.stringify(data)
          )
        }
      } else {
        _.define(data, id, vm)
      }
    }
    vm._raw = data
  },

  /**
   * Try to get a cached instance from a piece of data.
   *
   * @param {Object} data
   * @param {Number} index
   * @param {String} [key]
   * @return {Vue|undefined}
   */

  getVm: function (data, index, key) {
    var idKey = this.idKey
    var primitive = !isObject(data)
    if (key || idKey || primitive) {
      var id = idKey
        ? idKey === '$index'
          ? index
          : data[idKey]
        : (key || index)
      return this.cache[id]
    } else {
      return data[this.id]
    }
  },

  /**
   * Delete a cached vm instance.
   *
   * @param {Vue} vm
   */

  uncacheVm: function (vm) {
    var data = vm._raw
    var idKey = this.idKey
    var index = vm.$index
    // fix #948: avoid accidentally fall through to
    // a parent repeater which happens to have $key.
    var key = vm.hasOwnProperty('$key') && vm.$key
    var primitive = !isObject(data)
    if (idKey || key || primitive) {
      var id = idKey
        ? idKey === '$index'
          ? index
          : data[idKey]
        : (key || index)
      this.cache[id] = null
    } else {
      data[this.id] = null
      vm._raw = null
    }
  },

  /**
   * Insert an instance.
   *
   * @param {Vue} vm
   * @param {Number} index
   * @param {Node} prevEl
   * @param {Boolean} inDoc
   */

  insert: function (vm, index, prevEl, inDoc) {
    if (vm._staggerCb) {
      vm._staggerCb.cancel()
      vm._staggerCb = null
    }
    var staggerAmount = this.getStagger(vm, index, null, 'enter')
    if (inDoc && staggerAmount) {
      // create an anchor and insert it synchronously,
      // so that we can resolve the correct order without
      // worrying about some elements not inserted yet
      var anchor = vm._staggerAnchor
      if (!anchor) {
        anchor = vm._staggerAnchor = _.createAnchor('stagger-anchor')
        anchor.__vue__ = vm
      }
      _.after(anchor, prevEl)
      var op = vm._staggerCb = _.cancellable(function () {
        vm._staggerCb = null
        vm.$before(anchor)
        _.remove(anchor)
      })
      setTimeout(op, staggerAmount)
    } else {
      vm.$after(prevEl)
    }
  },

  /**
   * Move an already inserted instance.
   *
   * @param {Vue} vm
   * @param {Node} prevEl
   */

  move: function (vm, prevEl) {
    vm.$after(prevEl, null, false)
  },

  /**
   * Remove an instance.
   *
   * @param {Vue} vm
   * @param {Number} index
   * @param {Boolean} inDoc
   */

  remove: function (vm, index, total, inDoc) {
    if (vm._staggerCb) {
      vm._staggerCb.cancel()
      vm._staggerCb = null
      // it's not possible for the same vm to be removed
      // twice, so if we have a pending stagger callback,
      // it means this vm is queued for enter but removed
      // before its transition started. Since it is already
      // destroyed, we can just leave it in detached state.
      return
    }
    var staggerAmount = this.getStagger(vm, index, total, 'leave')
    if (inDoc && staggerAmount) {
      var op = vm._staggerCb = _.cancellable(function () {
        vm._staggerCb = null
        remove()
      })
      setTimeout(op, staggerAmount)
    } else {
      remove()
    }
    function remove () {
      vm.$remove(function () {
        vm._cleanup()
      })
    }
  },

  /**
   * Get the stagger amount for an insertion/removal.
   *
   * @param {Vue} vm
   * @param {Number} index
   * @param {String} type
   * @param {Number} total
   */

  getStagger: function (vm, index, total, type) {
    type = type + 'Stagger'
    var transition = vm.$el.__v_trans
    var hooks = transition && transition.hooks
    var hook = hooks && (hooks[type] || hooks.stagger)
    return hook
      ? hook.call(vm, index, total)
      : index * this[type]
  },

  /**
   * Pre-process the value before piping it through the
   * filters, and convert non-Array objects to arrays.
   *
   * This function will be bound to this directive instance
   * and passed into the watcher.
   *
   * @param {*} value
   * @return {Array}
   * @private
   */

  _preProcess: function (value) {
    // regardless of type, store the un-filtered raw value.
    this.rawValue = value
    var type = this.rawType = typeof value
    if (!isPlainObject(value)) {
      this.converted = false
      if (type === 'number') {
        value = range(value)
      } else if (type === 'string') {
        value = _.toArray(value)
      }
      return value || []
    } else {
      // convert plain object to array.
      var keys = Object.keys(value)
      var i = keys.length
      var res = new Array(i)
      var key
      while (i--) {
        key = keys[i]
        res[i] = {
          $key: key,
          $value: value[key]
        }
      }
      this.converted = true
      return res
    }
  }
}

/**
 * Helper to find the previous element that is an instance
 * root node. This is necessary because a destroyed vm's
 * element could still be lingering in the DOM before its
 * leaving transition finishes, but its __vue__ reference
 * should have been removed so we can skip them.
 *
 * If this is a block repeat, we want to make sure we only
 * return vm that is bound to this v-repeat. (see #929)
 *
 * @param {Vue} vm
 * @param {Comment|Text} anchor
 * @return {Vue}
 */

function findPrevVm (vm, anchor, id) {
  var el = vm.$el.previousSibling
  /* istanbul ignore if */
  if (!el) return
  while (
    (!el.__vue__ || el.__vue__.$options._repeatId !== id) &&
    el !== anchor
  ) {
    el = el.previousSibling
  }
  return el.__vue__
}

/**
 * Create a range array from given number.
 *
 * @param {Number} n
 * @return {Array}
 */

function range (n) {
  var i = -1
  var ret = new Array(n)
  while (++i < n) {
    ret[i] = i
  }
  return ret
}

/**
 * Convert a vms array to an object ref for v-ref on an
 * Object value.
 *
 * @param {Array} vms
 * @return {Object}
 */

function toRefObject (vms) {
  var ref = {}
  for (var i = 0, l = vms.length; i < l; i++) {
    ref[vms[i].$key] = vms[i]
  }
  return ref
}

/**
 * Check if a value is a primitive one:
 * String, Number, Boolean, null or undefined.
 *
 * @param {*} value
 * @return {Boolean}
 */

function isPrimitive (value) {
  var type = typeof value
  return value == null ||
    type === 'string' ||
    type === 'number' ||
    type === 'boolean'
}

}).call(this,require('_process'))
},{"../compiler":20,"../config":22,"../parsers/expression":60,"../parsers/template":62,"../parsers/text":63,"../util":71,"_process":1}],41:[function(require,module,exports){
var transition = require('../transition')

module.exports = function (value) {
  var el = this.el
  transition.apply(el, value ? 1 : -1, function () {
    el.style.display = value ? '' : 'none'
  }, this.vm)
}

},{"../transition":64}],42:[function(require,module,exports){
var _ = require('../util')
var prefixes = ['-webkit-', '-moz-', '-ms-']
var camelPrefixes = ['Webkit', 'Moz', 'ms']
var importantRE = /!important;?$/
var camelRE = /([a-z])([A-Z])/g
var testEl = null
var propCache = {}

module.exports = {

  deep: true,

  update: function (value) {
    if (this.arg) {
      this.setProp(this.arg, value)
    } else {
      if (typeof value === 'object') {
        this.objectHandler(value)
      } else {
        this.el.style.cssText = value
      }
    }
  },

  objectHandler: function (value) {
    // cache object styles so that only changed props
    // are actually updated.
    var cache = this.cache || (this.cache = {})
    var prop, val
    for (prop in cache) {
      if (!(prop in value)) {
        this.setProp(prop, null)
        delete cache[prop]
      }
    }
    for (prop in value) {
      val = value[prop]
      if (val !== cache[prop]) {
        cache[prop] = val
        this.setProp(prop, val)
      }
    }
  },

  setProp: function (prop, value) {
    prop = normalize(prop)
    if (!prop) return // unsupported prop
    // cast possible numbers/booleans into strings
    if (value != null) value += ''
    if (value) {
      var isImportant = importantRE.test(value)
        ? 'important'
        : ''
      if (isImportant) {
        value = value.replace(importantRE, '').trim()
      }
      this.el.style.setProperty(prop, value, isImportant)
    } else {
      this.el.style.removeProperty(prop)
    }
  }

}

/**
 * Normalize a CSS property name.
 * - cache result
 * - auto prefix
 * - camelCase -> dash-case
 *
 * @param {String} prop
 * @return {String}
 */

function normalize (prop) {
  if (propCache[prop]) {
    return propCache[prop]
  }
  var res = prefix(prop)
  propCache[prop] = propCache[res] = res
  return res
}

/**
 * Auto detect the appropriate prefix for a CSS property.
 * https://gist.github.com/paulirish/523692
 *
 * @param {String} prop
 * @return {String}
 */

function prefix (prop) {
  prop = prop.replace(camelRE, '$1-$2').toLowerCase()
  var camel = _.camelize(prop)
  var upper = camel.charAt(0).toUpperCase() + camel.slice(1)
  if (!testEl) {
    testEl = document.createElement('div')
  }
  if (camel in testEl.style) {
    return prop
  }
  var i = prefixes.length
  var prefixed
  while (i--) {
    prefixed = camelPrefixes[i] + upper
    if (prefixed in testEl.style) {
      return prefixes[i] + prop
    }
  }
}

},{"../util":71}],43:[function(require,module,exports){
var _ = require('../util')

module.exports = {

  bind: function () {
    this.attr = this.el.nodeType === 3
      ? 'data'
      : 'textContent'
  },

  update: function (value) {
    this.el[this.attr] = _.toString(value)
  }
}

},{"../util":71}],44:[function(require,module,exports){
var _ = require('../util')
var Transition = require('../transition/transition')

module.exports = {

  priority: 1000,
  isLiteral: true,

  bind: function () {
    if (!this._isDynamicLiteral) {
      this.update(this.expression)
    }
  },

  update: function (id, oldId) {
    var el = this.el
    var vm = this.el.__vue__ || this.vm
    var hooks = _.resolveAsset(vm.$options, 'transitions', id)
    id = id || 'v'
    el.__v_trans = new Transition(el, id, hooks, vm)
    if (oldId) {
      _.removeClass(el, oldId + '-transition')
    }
    _.addClass(el, id + '-transition')
  }
}

},{"../transition/transition":66,"../util":71}],45:[function(require,module,exports){
var _ = require('../util')
var clone = require('../parsers/template').clone

// This is the elementDirective that handles <content>
// transclusions. It relies on the raw content of an
// instance being stored as `$options._content` during
// the transclude phase.

module.exports = {

  bind: function () {
    var vm = this.vm
    var host = vm
    // we need find the content context, which is the
    // closest non-inline-repeater instance.
    while (host.$options._repeat) {
      host = host.$parent
    }
    var raw = host.$options._content
    var content
    if (!raw) {
      this.fallback()
      return
    }
    var context = host._context
    var selector = this._checkParam('select')
    if (!selector) {
      // Default content
      var self = this
      var compileDefaultContent = function () {
        self.compile(
          extractFragment(raw.childNodes, raw, true),
          context,
          vm
        )
      }
      if (!host._isCompiled) {
        // defer until the end of instance compilation,
        // because the default outlet must wait until all
        // other possible outlets with selectors have picked
        // out their contents.
        host.$once('hook:compiled', compileDefaultContent)
      } else {
        compileDefaultContent()
      }
    } else {
      // select content
      var nodes = raw.querySelectorAll(selector)
      if (nodes.length) {
        content = extractFragment(nodes, raw)
        if (content.hasChildNodes()) {
          this.compile(content, context, vm)
        } else {
          this.fallback()
        }
      } else {
        this.fallback()
      }
    }
  },

  fallback: function () {
    this.compile(_.extractContent(this.el, true), this.vm)
  },

  compile: function (content, context, host) {
    if (content && context) {
      this.unlink = context.$compile(content, host)
    }
    if (content) {
      _.replace(this.el, content)
    } else {
      _.remove(this.el)
    }
  },

  unbind: function () {
    if (this.unlink) {
      this.unlink()
    }
  }
}

/**
 * Extract qualified content nodes from a node list.
 *
 * @param {NodeList} nodes
 * @param {Element} parent
 * @param {Boolean} main
 * @return {DocumentFragment}
 */

function extractFragment (nodes, parent, main) {
  var frag = document.createDocumentFragment()
  for (var i = 0, l = nodes.length; i < l; i++) {
    var node = nodes[i]
    // if this is the main outlet, we want to skip all
    // previously selected nodes;
    // otherwise, we want to mark the node as selected.
    // clone the node so the original raw content remains
    // intact. this ensures proper re-compilation in cases
    // where the outlet is inside a conditional block
    if (main && !node.__v_selected) {
      frag.appendChild(clone(node))
    } else if (!main && node.parentNode === parent) {
      node.__v_selected = true
      frag.appendChild(clone(node))
    }
  }
  return frag
}

},{"../parsers/template":62,"../util":71}],46:[function(require,module,exports){
exports.content = require('./content')
exports.partial = require('./partial')

},{"./content":45,"./partial":47}],47:[function(require,module,exports){
(function (process){
var _ = require('../util')
var templateParser = require('../parsers/template')
var textParser = require('../parsers/text')
var compiler = require('../compiler')
var Cache = require('../cache')
var cache = new Cache(1000)

// v-partial reuses logic from v-if
var vIf = require('../directives/if')

module.exports = {

  link: vIf.link,
  teardown: vIf.teardown,
  getContainedComponents: vIf.getContainedComponents,

  bind: function () {
    var el = this.el
    this.start = _.createAnchor('v-partial-start')
    this.end = _.createAnchor('v-partial-end')
    _.replace(el, this.end)
    _.before(this.start, this.end)
    var id = el.getAttribute('name')
    var tokens = textParser.parse(id)
    if (tokens) {
      // dynamic partial
      this.setupDynamic(tokens)
    } else {
      // static partial
      this.insert(id)
    }
  },

  setupDynamic: function (tokens) {
    var self = this
    var exp = textParser.tokensToExp(tokens)
    this.unwatch = this.vm.$watch(exp, function (value) {
      self.teardown()
      self.insert(value)
    }, {
      immediate: true,
      user: false
    })
  },

  insert: function (id) {
    var partial = _.resolveAsset(this.vm.$options, 'partials', id)
    if (process.env.NODE_ENV !== 'production') {
      _.assertAsset(partial, 'partial', id)
    }
    if (partial) {
      var frag = templateParser.parse(partial, true)
      // cache partials based on constructor id.
      var cacheId = (this.vm.constructor.cid || '') + partial
      var linker = this.compile(frag, cacheId)
      // this is provided by v-if
      this.link(frag, linker)
    }
  },

  compile: function (frag, cacheId) {
    var hit = cache.get(cacheId)
    if (hit) return hit
    var linker = compiler.compile(frag, this.vm.$options, true)
    cache.put(cacheId, linker)
    return linker
  },

  unbind: function () {
    if (this.unlink) this.unlink()
    if (this.unwatch) this.unwatch()
  }
}

}).call(this,require('_process'))
},{"../cache":17,"../compiler":20,"../directives/if":30,"../parsers/template":62,"../parsers/text":63,"../util":71,"_process":1}],48:[function(require,module,exports){
var _ = require('../util')
var Path = require('../parsers/path')

/**
 * Filter filter for v-repeat
 *
 * @param {String} searchKey
 * @param {String} [delimiter]
 * @param {String} dataKey
 */

exports.filterBy = function (arr, search, delimiter /* ...dataKeys */) {
  if (search == null) {
    return arr
  }
  if (typeof search === 'function') {
    return arr.filter(search)
  }
  // cast to lowercase string
  search = ('' + search).toLowerCase()
  // allow optional `in` delimiter
  // because why not
  var n = delimiter === 'in' ? 3 : 2
  // extract and flatten keys
  var keys = _.toArray(arguments, n).reduce(function (prev, cur) {
    return prev.concat(cur)
  }, [])
  return arr.filter(function (item) {
    if (keys.length) {
      return keys.some(function (key) {
        return contains(Path.get(item, key), search)
      })
    } else {
      return contains(item, search)
    }
  })
}

/**
 * Filter filter for v-repeat
 *
 * @param {String} sortKey
 * @param {String} reverse
 */

exports.orderBy = function (arr, sortKey, reverse) {
  if (!sortKey) {
    return arr
  }
  var order = 1
  if (arguments.length > 2) {
    if (reverse === '-1') {
      order = -1
    } else {
      order = reverse ? -1 : 1
    }
  }
  // sort on a copy to avoid mutating original array
  return arr.slice().sort(function (a, b) {
    if (sortKey !== '$key' && sortKey !== '$value') {
      if (a && '$value' in a) a = a.$value
      if (b && '$value' in b) b = b.$value
    }
    a = _.isObject(a) ? Path.get(a, sortKey) : a
    b = _.isObject(b) ? Path.get(b, sortKey) : b
    return a === b ? 0 : a > b ? order : -order
  })
}

/**
 * String contain helper
 *
 * @param {*} val
 * @param {String} search
 */

function contains (val, search) {
  var i
  if (_.isPlainObject(val)) {
    var keys = Object.keys(val)
    i = keys.length
    while (i--) {
      if (contains(val[keys[i]], search)) {
        return true
      }
    }
  } else if (_.isArray(val)) {
    i = val.length
    while (i--) {
      if (contains(val[i], search)) {
        return true
      }
    }
  } else if (val != null) {
    return val.toString().toLowerCase().indexOf(search) > -1
  }
}

},{"../parsers/path":61,"../util":71}],49:[function(require,module,exports){
var _ = require('../util')

/**
 * Stringify value.
 *
 * @param {Number} indent
 */

exports.json = {
  read: function (value, indent) {
    return typeof value === 'string'
      ? value
      : JSON.stringify(value, null, Number(indent) || 2)
  },
  write: function (value) {
    try {
      return JSON.parse(value)
    } catch (e) {
      return value
    }
  }
}

/**
 * 'abc' => 'Abc'
 */

exports.capitalize = function (value) {
  if (!value && value !== 0) return ''
  value = value.toString()
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * 'abc' => 'ABC'
 */

exports.uppercase = function (value) {
  return (value || value === 0)
    ? value.toString().toUpperCase()
    : ''
}

/**
 * 'AbC' => 'abc'
 */

exports.lowercase = function (value) {
  return (value || value === 0)
    ? value.toString().toLowerCase()
    : ''
}

/**
 * 12345 => $12,345.00
 *
 * @param {String} sign
 */

var digitsRE = /(\d{3})(?=\d)/g
exports.currency = function (value, currency) {
  value = parseFloat(value)
  if (!isFinite(value) || (!value && value !== 0)) return ''
  currency = currency != null ? currency : '$'
  var stringified = Math.abs(value).toFixed(2)
  var _int = stringified.slice(0, -3)
  var i = _int.length % 3
  var head = i > 0
    ? (_int.slice(0, i) + (_int.length > 3 ? ',' : ''))
    : ''
  var _float = stringified.slice(-3)
  var sign = value < 0 ? '-' : ''
  return currency + sign + head +
    _int.slice(i).replace(digitsRE, '$1,') +
    _float
}

/**
 * 'item' => 'items'
 *
 * @params
 *  an array of strings corresponding to
 *  the single, double, triple ... forms of the word to
 *  be pluralized. When the number to be pluralized
 *  exceeds the length of the args, it will use the last
 *  entry in the array.
 *
 *  e.g. ['single', 'double', 'triple', 'multiple']
 */

exports.pluralize = function (value) {
  var args = _.toArray(arguments, 1)
  return args.length > 1
    ? (args[value % 10 - 1] || args[args.length - 1])
    : (args[0] + (value === 1 ? '' : 's'))
}

/**
 * A special filter that takes a handler function,
 * wraps it so it only gets triggered on specific
 * keypresses. v-on only.
 *
 * @param {String} key
 */

var keyCodes = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  'delete': 46,
  up: 38,
  left: 37,
  right: 39,
  down: 40
}

exports.key = function (handler, key) {
  if (!handler) return
  var code = keyCodes[key]
  if (!code) {
    code = parseInt(key, 10)
  }
  return function (e) {
    if (e.keyCode === code) {
      return handler.call(this, e)
    }
  }
}

// expose keycode hash
exports.key.keyCodes = keyCodes

exports.debounce = function (handler, delay) {
  if (!handler) return
  if (!delay) {
    delay = 300
  }
  return _.debounce(handler, delay)
}

/**
 * Install special array filters
 */

_.extend(exports, require('./array-filters'))

},{"../util":71,"./array-filters":48}],50:[function(require,module,exports){
var _ = require('../util')
var Directive = require('../directive')
var compiler = require('../compiler')

/**
 * Transclude, compile and link element.
 *
 * If a pre-compiled linker is available, that means the
 * passed in element will be pre-transcluded and compiled
 * as well - all we need to do is to call the linker.
 *
 * Otherwise we need to call transclude/compile/link here.
 *
 * @param {Element} el
 * @return {Element}
 */

exports._compile = function (el) {
  var options = this.$options
  var host = this._host
  if (options._linkFn) {
    // pre-transcluded with linker, just use it
    this._initElement(el)
    this._unlinkFn = options._linkFn(this, el, host)
  } else {
    // transclude and init element
    // transclude can potentially replace original
    // so we need to keep reference; this step also injects
    // the template and caches the original attributes
    // on the container node and replacer node.
    var original = el
    el = compiler.transclude(el, options)
    this._initElement(el)

    // root is always compiled per-instance, because
    // container attrs and props can be different every time.
    var rootLinker = compiler.compileRoot(el, options)

    // compile and link the rest
    var contentLinkFn
    var ctor = this.constructor
    // component compilation can be cached
    // as long as it's not using inline-template
    if (options._linkerCachable) {
      contentLinkFn = ctor.linker
      if (!contentLinkFn) {
        contentLinkFn = ctor.linker = compiler.compile(el, options)
      }
    }

    // link phase
    var rootUnlinkFn = rootLinker(this, el)
    var contentUnlinkFn = contentLinkFn
      ? contentLinkFn(this, el)
      : compiler.compile(el, options)(this, el, host)

    // register composite unlink function
    // to be called during instance destruction
    this._unlinkFn = function () {
      rootUnlinkFn()
      // passing destroying: true to avoid searching and
      // splicing the directives
      contentUnlinkFn(true)
    }

    // finally replace original
    if (options.replace) {
      _.replace(original, el)
    }
  }
  return el
}

/**
 * Initialize instance element. Called in the public
 * $mount() method.
 *
 * @param {Element} el
 */

exports._initElement = function (el) {
  if (el instanceof DocumentFragment) {
    this._isFragment = true
    this.$el = this._fragmentStart = el.firstChild
    this._fragmentEnd = el.lastChild
    // set persisted text anchors to empty
    if (this._fragmentStart.nodeType === 3) {
      this._fragmentStart.data = this._fragmentEnd.data = ''
    }
    this._blockFragment = el
  } else {
    this.$el = el
  }
  this.$el.__vue__ = this
  this._callHook('beforeCompile')
}

/**
 * Create and bind a directive to an element.
 *
 * @param {String} name - directive name
 * @param {Node} node   - target node
 * @param {Object} desc - parsed directive descriptor
 * @param {Object} def  - directive definition object
 * @param {Vue|undefined} host - transclusion host component
 */

exports._bindDir = function (name, node, desc, def, host) {
  this._directives.push(
    new Directive(name, node, this, desc, def, host)
  )
}

/**
 * Teardown an instance, unobserves the data, unbind all the
 * directives, turn off all the event listeners, etc.
 *
 * @param {Boolean} remove - whether to remove the DOM node.
 * @param {Boolean} deferCleanup - if true, defer cleanup to
 *                                 be called later
 */

exports._destroy = function (remove, deferCleanup) {
  if (this._isBeingDestroyed) {
    return
  }
  this._callHook('beforeDestroy')
  this._isBeingDestroyed = true
  var i
  // remove self from parent. only necessary
  // if parent is not being destroyed as well.
  var parent = this.$parent
  if (parent && !parent._isBeingDestroyed) {
    parent.$children.$remove(this)
  }
  // destroy all children.
  i = this.$children.length
  while (i--) {
    this.$children[i].$destroy()
  }
  // teardown props
  if (this._propsUnlinkFn) {
    this._propsUnlinkFn()
  }
  // teardown all directives. this also tearsdown all
  // directive-owned watchers.
  if (this._unlinkFn) {
    this._unlinkFn()
  }
  i = this._watchers.length
  while (i--) {
    this._watchers[i].teardown()
  }
  // remove reference to self on $el
  if (this.$el) {
    this.$el.__vue__ = null
  }
  // remove DOM element
  var self = this
  if (remove && this.$el) {
    this.$remove(function () {
      self._cleanup()
    })
  } else if (!deferCleanup) {
    this._cleanup()
  }
}

/**
 * Clean up to ensure garbage collection.
 * This is called after the leave transition if there
 * is any.
 */

exports._cleanup = function () {
  // remove reference from data ob
  // frozen object may not have observer.
  if (this._data.__ob__) {
    this._data.__ob__.removeVm(this)
  }
  // Clean up references to private properties and other
  // instances. preserve reference to _data so that proxy
  // accessors still work. The only potential side effect
  // here is that mutating the instance after it's destroyed
  // may affect the state of other components that are still
  // observing the same object, but that seems to be a
  // reasonable responsibility for the user rather than
  // always throwing an error on them.
  this.$el =
  this.$parent =
  this.$root =
  this.$children =
  this._watchers =
  this._directives = null
  // call the last hook...
  this._isDestroyed = true
  this._callHook('destroyed')
  // turn off all instance listeners.
  this.$off()
}

},{"../compiler":20,"../directive":23,"../util":71}],51:[function(require,module,exports){
(function (process){
var _ = require('../util')
var inDoc = _.inDoc

/**
 * Setup the instance's option events & watchers.
 * If the value is a string, we pull it from the
 * instance's methods by name.
 */

exports._initEvents = function () {
  var options = this.$options
  registerCallbacks(this, '$on', options.events)
  registerCallbacks(this, '$watch', options.watch)
}

/**
 * Register callbacks for option events and watchers.
 *
 * @param {Vue} vm
 * @param {String} action
 * @param {Object} hash
 */

function registerCallbacks (vm, action, hash) {
  if (!hash) return
  var handlers, key, i, j
  for (key in hash) {
    handlers = hash[key]
    if (_.isArray(handlers)) {
      for (i = 0, j = handlers.length; i < j; i++) {
        register(vm, action, key, handlers[i])
      }
    } else {
      register(vm, action, key, handlers)
    }
  }
}

/**
 * Helper to register an event/watch callback.
 *
 * @param {Vue} vm
 * @param {String} action
 * @param {String} key
 * @param {Function|String|Object} handler
 * @param {Object} [options]
 */

function register (vm, action, key, handler, options) {
  var type = typeof handler
  if (type === 'function') {
    vm[action](key, handler, options)
  } else if (type === 'string') {
    var methods = vm.$options.methods
    var method = methods && methods[handler]
    if (method) {
      vm[action](key, method, options)
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Unknown method: "' + handler + '" when ' +
        'registering callback for ' + action +
        ': "' + key + '".'
      )
    }
  } else if (handler && type === 'object') {
    register(vm, action, key, handler.handler, handler)
  }
}

/**
 * Setup recursive attached/detached calls
 */

exports._initDOMHooks = function () {
  this.$on('hook:attached', onAttached)
  this.$on('hook:detached', onDetached)
}

/**
 * Callback to recursively call attached hook on children
 */

function onAttached () {
  if (!this._isAttached) {
    this._isAttached = true
    this.$children.forEach(callAttach)
  }
}

/**
 * Iterator to call attached hook
 *
 * @param {Vue} child
 */

function callAttach (child) {
  if (!child._isAttached && inDoc(child.$el)) {
    child._callHook('attached')
  }
}

/**
 * Callback to recursively call detached hook on children
 */

function onDetached () {
  if (this._isAttached) {
    this._isAttached = false
    this.$children.forEach(callDetach)
  }
}

/**
 * Iterator to call detached hook
 *
 * @param {Vue} child
 */

function callDetach (child) {
  if (child._isAttached && !inDoc(child.$el)) {
    child._callHook('detached')
  }
}

/**
 * Trigger all handlers for a hook
 *
 * @param {String} hook
 */

exports._callHook = function (hook) {
  var handlers = this.$options[hook]
  if (handlers) {
    for (var i = 0, j = handlers.length; i < j; i++) {
      handlers[i].call(this)
    }
  }
  this.$emit('hook:' + hook)
}

}).call(this,require('_process'))
},{"../util":71,"_process":1}],52:[function(require,module,exports){
var mergeOptions = require('../util').mergeOptions

/**
 * The main init sequence. This is called for every
 * instance, including ones that are created from extended
 * constructors.
 *
 * @param {Object} options - this options object should be
 *                           the result of merging class
 *                           options and the options passed
 *                           in to the constructor.
 */

exports._init = function (options) {

  options = options || {}

  this.$el = null
  this.$parent = options._parent
  this.$root = options._root || this
  this.$children = []
  this.$ = {}           // child vm references
  this.$$ = {}          // element references
  this._watchers = []   // all watchers as an array
  this._directives = [] // all directives
  this._childCtors = {} // inherit:true constructors

  // a flag to avoid this being observed
  this._isVue = true

  // events bookkeeping
  this._events = {}            // registered callbacks
  this._eventsCount = {}       // for $broadcast optimization
  this._eventCancelled = false // for event cancellation

  // fragment instance properties
  this._isFragment = false
  this._fragmentStart =    // @type {CommentNode}
  this._fragmentEnd = null // @type {CommentNode}

  // lifecycle state
  this._isCompiled =
  this._isDestroyed =
  this._isReady =
  this._isAttached =
  this._isBeingDestroyed = false
  this._unlinkFn = null

  // context: the scope in which the component was used,
  // and the scope in which props and contents of this
  // instance should be compiled in.
  this._context =
    options._context ||
    options._parent

  // push self into parent / transclusion host
  if (this.$parent) {
    this.$parent.$children.push(this)
  }

  // props used in v-repeat diffing
  this._reused = false
  this._staggerOp = null

  // merge options.
  options = this.$options = mergeOptions(
    this.constructor.options,
    options,
    this
  )

  // initialize data as empty object.
  // it will be filled up in _initScope().
  this._data = {}

  // initialize data observation and scope inheritance.
  this._initScope()

  // setup event system and option events.
  this._initEvents()

  // call created hook
  this._callHook('created')

  // if `el` option is passed, start compilation.
  if (options.el) {
    this.$mount(options.el)
  }
}

},{"../util":71}],53:[function(require,module,exports){
(function (process){
var _ = require('../util')

/**
 * Apply a list of filter (descriptors) to a value.
 * Using plain for loops here because this will be called in
 * the getter of any watcher with filters so it is very
 * performance sensitive.
 *
 * @param {*} value
 * @param {*} [oldValue]
 * @param {Array} filters
 * @param {Boolean} write
 * @return {*}
 */

exports._applyFilters = function (value, oldValue, filters, write) {
  var filter, fn, args, arg, offset, i, l, j, k
  for (i = 0, l = filters.length; i < l; i++) {
    filter = filters[i]
    fn = _.resolveAsset(this.$options, 'filters', filter.name)
    if (process.env.NODE_ENV !== 'production') {
      _.assertAsset(fn, 'filter', filter.name)
    }
    if (!fn) continue
    fn = write ? fn.write : (fn.read || fn)
    if (typeof fn !== 'function') continue
    args = write ? [value, oldValue] : [value]
    offset = write ? 2 : 1
    if (filter.args) {
      for (j = 0, k = filter.args.length; j < k; j++) {
        arg = filter.args[j]
        args[j + offset] = arg.dynamic
          ? this.$get(arg.value)
          : arg.value
      }
    }
    value = fn.apply(this, args)
  }
  return value
}

/**
 * Resolve a component, depending on whether the component
 * is defined normally or using an async factory function.
 * Resolves synchronously if already resolved, otherwise
 * resolves asynchronously and caches the resolved
 * constructor on the factory.
 *
 * @param {String} id
 * @param {Function} cb
 */

exports._resolveComponent = function (id, cb) {
  var factory = _.resolveAsset(this.$options, 'components', id)
  if (process.env.NODE_ENV !== 'production') {
    _.assertAsset(factory, 'component', id)
  }
  if (!factory) {
    return
  }
  // async component factory
  if (!factory.options) {
    if (factory.resolved) {
      // cached
      cb(factory.resolved)
    } else if (factory.requested) {
      // pool callbacks
      factory.pendingCallbacks.push(cb)
    } else {
      factory.requested = true
      var cbs = factory.pendingCallbacks = [cb]
      factory(function resolve (res) {
        if (_.isPlainObject(res)) {
          res = _.Vue.extend(res)
        }
        // cache resolved
        factory.resolved = res
        // invoke callbacks
        for (var i = 0, l = cbs.length; i < l; i++) {
          cbs[i](res)
        }
      }, function reject (reason) {
        process.env.NODE_ENV !== 'production' && _.warn(
          'Failed to resolve async component: ' + id + '. ' +
          (reason ? '\nReason: ' + reason : '')
        )
      })
    }
  } else {
    // normal component
    cb(factory)
  }
}

}).call(this,require('_process'))
},{"../util":71,"_process":1}],54:[function(require,module,exports){
(function (process){
var _ = require('../util')
var compiler = require('../compiler')
var Observer = require('../observer')
var Dep = require('../observer/dep')
var Watcher = require('../watcher')

/**
 * Setup the scope of an instance, which contains:
 * - observed data
 * - computed properties
 * - user methods
 * - meta properties
 */

exports._initScope = function () {
  this._initProps()
  this._initMeta()
  this._initMethods()
  this._initData()
  this._initComputed()
}

/**
 * Initialize props.
 */

exports._initProps = function () {
  var options = this.$options
  var el = options.el
  var props = options.props
  if (props && !el) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Props will not be compiled if no `el` option is ' +
      'provided at instantiation.'
    )
  }
  // make sure to convert string selectors into element now
  el = options.el = _.query(el)
  this._propsUnlinkFn = el && el.nodeType === 1 && props
    ? compiler.compileAndLinkProps(
        this, el, props
      )
    : null
}

/**
 * Initialize the data.
 */

exports._initData = function () {
  var propsData = this._data
  var optionsDataFn = this.$options.data
  var optionsData = optionsDataFn && optionsDataFn()
  if (optionsData) {
    this._data = optionsData
    for (var prop in propsData) {
      if (
        this._props[prop].raw !== null ||
        !optionsData.hasOwnProperty(prop)
      ) {
        optionsData.$set(prop, propsData[prop])
      }
    }
  }
  var data = this._data
  // proxy data on instance
  var keys = Object.keys(data)
  var i, key
  i = keys.length
  while (i--) {
    key = keys[i]
    if (!_.isReserved(key)) {
      this._proxy(key)
    }
  }
  // observe data
  Observer.create(data, this)
}

/**
 * Swap the isntance's $data. Called in $data's setter.
 *
 * @param {Object} newData
 */

exports._setData = function (newData) {
  newData = newData || {}
  var oldData = this._data
  this._data = newData
  var keys, key, i
  // copy props.
  // this should only happen during a v-repeat of component
  // that also happens to have compiled props.
  var props = this.$options.props
  if (props) {
    i = props.length
    while (i--) {
      key = props[i].name
      if (key !== '$data' && !newData.hasOwnProperty(key)) {
        newData.$set(key, oldData[key])
      }
    }
  }
  // unproxy keys not present in new data
  keys = Object.keys(oldData)
  i = keys.length
  while (i--) {
    key = keys[i]
    if (!_.isReserved(key) && !(key in newData)) {
      this._unproxy(key)
    }
  }
  // proxy keys not already proxied,
  // and trigger change for changed values
  keys = Object.keys(newData)
  i = keys.length
  while (i--) {
    key = keys[i]
    if (!this.hasOwnProperty(key) && !_.isReserved(key)) {
      // new property
      this._proxy(key)
    }
  }
  oldData.__ob__.removeVm(this)
  Observer.create(newData, this)
  this._digest()
}

/**
 * Proxy a property, so that
 * vm.prop === vm._data.prop
 *
 * @param {String} key
 */

exports._proxy = function (key) {
  // need to store ref to self here
  // because these getter/setters might
  // be called by child instances!
  var self = this
  Object.defineProperty(self, key, {
    configurable: true,
    enumerable: true,
    get: function proxyGetter () {
      return self._data[key]
    },
    set: function proxySetter (val) {
      self._data[key] = val
    }
  })
}

/**
 * Unproxy a property.
 *
 * @param {String} key
 */

exports._unproxy = function (key) {
  delete this[key]
}

/**
 * Force update on every watcher in scope.
 */

exports._digest = function () {
  var i = this._watchers.length
  while (i--) {
    this._watchers[i].update(true) // shallow updates
  }
  var children = this.$children
  i = children.length
  while (i--) {
    var child = children[i]
    if (child.$options.inherit) {
      child._digest()
    }
  }
}

/**
 * Setup computed properties. They are essentially
 * special getter/setters
 */

function noop () {}
exports._initComputed = function () {
  var computed = this.$options.computed
  if (computed) {
    for (var key in computed) {
      var userDef = computed[key]
      var def = {
        enumerable: true,
        configurable: true
      }
      if (typeof userDef === 'function') {
        def.get = makeComputedGetter(userDef, this)
        def.set = noop
      } else {
        def.get = userDef.get
          ? userDef.cache !== false
            ? makeComputedGetter(userDef.get, this)
            : _.bind(userDef.get, this)
          : noop
        def.set = userDef.set
          ? _.bind(userDef.set, this)
          : noop
      }
      Object.defineProperty(this, key, def)
    }
  }
}

function makeComputedGetter (getter, owner) {
  var watcher = new Watcher(owner, getter, null, {
    lazy: true
  })
  return function computedGetter () {
    if (watcher.dirty) {
      watcher.evaluate()
    }
    if (Dep.target) {
      watcher.depend()
    }
    return watcher.value
  }
}

/**
 * Setup instance methods. Methods must be bound to the
 * instance since they might be called by children
 * inheriting them.
 */

exports._initMethods = function () {
  var methods = this.$options.methods
  if (methods) {
    for (var key in methods) {
      this[key] = _.bind(methods[key], this)
    }
  }
}

/**
 * Initialize meta information like $index, $key & $value.
 */

exports._initMeta = function () {
  var metas = this.$options._meta
  if (metas) {
    for (var key in metas) {
      this._defineMeta(key, metas[key])
    }
  }
}

/**
 * Define a meta property, e.g $index, $key, $value
 * which only exists on the vm instance but not in $data.
 *
 * @param {String} key
 * @param {*} value
 */

exports._defineMeta = function (key, value) {
  var dep = new Dep()
  Object.defineProperty(this, key, {
    get: function metaGetter () {
      if (Dep.target) {
        dep.depend()
      }
      return value
    },
    set: function metaSetter (val) {
      if (val !== value) {
        value = val
        dep.notify()
      }
    }
  })
}

}).call(this,require('_process'))
},{"../compiler":20,"../observer":57,"../observer/dep":56,"../util":71,"../watcher":75,"_process":1}],55:[function(require,module,exports){
var _ = require('../util')
var arrayProto = Array.prototype
var arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 */

;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  var original = arrayProto[method]
  _.define(arrayMethods, method, function mutator () {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    var i = arguments.length
    var args = new Array(i)
    while (i--) {
      args[i] = arguments[i]
    }
    var result = original.apply(this, args)
    var ob = this.__ob__
    var inserted, removed
    switch (method) {
      case 'push':
        inserted = args
        break
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        removed = result
        break
      case 'pop':
      case 'shift':
        removed = [result]
        break
    }
    if (inserted) ob.observeArray(inserted)
    if (removed) ob.unobserveArray(removed)
    // notify change
    ob.notify()
    return result
  })
})

/**
 * Swap the element at the given index with a new value
 * and emits corresponding event.
 *
 * @param {Number} index
 * @param {*} val
 * @return {*} - replaced element
 */

_.define(
  arrayProto,
  '$set',
  function $set (index, val) {
    if (index >= this.length) {
      this.length = index + 1
    }
    return this.splice(index, 1, val)[0]
  }
)

/**
 * Convenience method to remove the element at given index.
 *
 * @param {Number} index
 * @param {*} val
 */

_.define(
  arrayProto,
  '$remove',
  function $remove (index) {
    /* istanbul ignore if */
    if (!this.length) return
    if (typeof index !== 'number') {
      index = _.indexOf(this, index)
    }
    if (index > -1) {
      return this.splice(index, 1)
    }
  }
)

module.exports = arrayMethods

},{"../util":71}],56:[function(require,module,exports){
var _ = require('../util')
var uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 *
 * @constructor
 */

function Dep () {
  this.id = uid++
  this.subs = []
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null

/**
 * Add a directive subscriber.
 *
 * @param {Directive} sub
 */

Dep.prototype.addSub = function (sub) {
  this.subs.push(sub)
}

/**
 * Remove a directive subscriber.
 *
 * @param {Directive} sub
 */

Dep.prototype.removeSub = function (sub) {
  this.subs.$remove(sub)
}

/**
 * Add self as a dependency to the target watcher.
 */

Dep.prototype.depend = function () {
  Dep.target.addDep(this)
}

/**
 * Notify all subscribers of a new value.
 */

Dep.prototype.notify = function () {
  // stablize the subscriber list first
  var subs = _.toArray(this.subs)
  for (var i = 0, l = subs.length; i < l; i++) {
    subs[i].update()
  }
}

module.exports = Dep

},{"../util":71}],57:[function(require,module,exports){
var _ = require('../util')
var config = require('../config')
var Dep = require('./dep')
var arrayMethods = require('./array')
var arrayKeys = Object.getOwnPropertyNames(arrayMethods)
require('./object')

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * @param {Array|Object} value
 * @constructor
 */

function Observer (value) {
  this.value = value
  this.dep = new Dep()
  _.define(value, '__ob__', this)
  if (_.isArray(value)) {
    var augment = config.proto && _.hasProto
      ? protoAugment
      : copyAugment
    augment(value, arrayMethods, arrayKeys)
    this.observeArray(value)
  } else {
    this.walk(value)
  }
}

// Static methods

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * @param {*} value
 * @param {Vue} [vm]
 * @return {Observer|undefined}
 * @static
 */

Observer.create = function (value, vm) {
  var ob
  if (
    value &&
    value.hasOwnProperty('__ob__') &&
    value.__ob__ instanceof Observer
  ) {
    ob = value.__ob__
  } else if (
    (_.isArray(value) || _.isPlainObject(value)) &&
    !Object.isFrozen(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (ob && vm) {
    ob.addVm(vm)
  }
  return ob
}

// Instance methods

/**
 * Walk through each property and convert them into
 * getter/setters. This method should only be called when
 * value type is Object. Properties prefixed with `$` or `_`
 * and accessor properties are ignored.
 *
 * @param {Object} obj
 */

Observer.prototype.walk = function (obj) {
  var keys = Object.keys(obj)
  var i = keys.length
  while (i--) {
    this.convert(keys[i], obj[keys[i]])
  }
}

/**
 * Try to carete an observer for a child value,
 * and if value is array, link dep to the array.
 *
 * @param {*} val
 * @return {Dep|undefined}
 */

Observer.prototype.observe = function (val) {
  return Observer.create(val)
}

/**
 * Observe a list of Array items.
 *
 * @param {Array} items
 */

Observer.prototype.observeArray = function (items) {
  var i = items.length
  while (i--) {
    var ob = this.observe(items[i])
    if (ob) {
      (ob.parents || (ob.parents = [])).push(this)
    }
  }
}

/**
 * Remove self from the parent list of removed objects.
 *
 * @param {Array} items
 */

Observer.prototype.unobserveArray = function (items) {
  var i = items.length
  while (i--) {
    var ob = items[i] && items[i].__ob__
    if (ob) {
      ob.parents.$remove(this)
    }
  }
}

/**
 * Notify self dependency, and also parent Array dependency
 * if any.
 */

Observer.prototype.notify = function () {
  this.dep.notify()
  var parents = this.parents
  if (parents) {
    var i = parents.length
    while (i--) {
      parents[i].notify()
    }
  }
}

/**
 * Convert a property into getter/setter so we can emit
 * the events when the property is accessed/changed.
 *
 * @param {String} key
 * @param {*} val
 */

Observer.prototype.convert = function (key, val) {
  var ob = this
  var childOb = ob.observe(val)
  var dep = new Dep()
  Object.defineProperty(ob.value, key, {
    enumerable: true,
    configurable: true,
    get: function () {
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
        }
      }
      return val
    },
    set: function (newVal) {
      if (newVal === val) return
      val = newVal
      childOb = ob.observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Add an owner vm, so that when $add/$delete mutations
 * happen we can notify owner vms to proxy the keys and
 * digest the watchers. This is only called when the object
 * is observed as an instance's root $data.
 *
 * @param {Vue} vm
 */

Observer.prototype.addVm = function (vm) {
  (this.vms || (this.vms = [])).push(vm)
}

/**
 * Remove an owner vm. This is called when the object is
 * swapped out as an instance's $data object.
 *
 * @param {Vue} vm
 */

Observer.prototype.removeVm = function (vm) {
  this.vms.$remove(vm)
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function protoAugment (target, src) {
  target.__proto__ = src
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function copyAugment (target, src, keys) {
  var i = keys.length
  var key
  while (i--) {
    key = keys[i]
    _.define(target, key, src[key])
  }
}

module.exports = Observer

},{"../config":22,"../util":71,"./array":55,"./dep":56,"./object":58}],58:[function(require,module,exports){
var _ = require('../util')
var objProto = Object.prototype

/**
 * Add a new property to an observed object
 * and emits corresponding event
 *
 * @param {String} key
 * @param {*} val
 * @public
 */

_.define(
  objProto,
  '$add',
  function $add (key, val) {
    if (this.hasOwnProperty(key)) return
    var ob = this.__ob__
    if (!ob || _.isReserved(key)) {
      this[key] = val
      return
    }
    ob.convert(key, val)
    ob.notify()
    if (ob.vms) {
      var i = ob.vms.length
      while (i--) {
        var vm = ob.vms[i]
        vm._proxy(key)
        vm._digest()
      }
    }
  }
)

/**
 * Set a property on an observed object, calling add to
 * ensure the property is observed.
 *
 * @param {String} key
 * @param {*} val
 * @public
 */

_.define(
  objProto,
  '$set',
  function $set (key, val) {
    this.$add(key, val)
    this[key] = val
  }
)

/**
 * Deletes a property from an observed object
 * and emits corresponding event
 *
 * @param {String} key
 * @public
 */

_.define(
  objProto,
  '$delete',
  function $delete (key) {
    if (!this.hasOwnProperty(key)) return
    delete this[key]
    var ob = this.__ob__
    if (!ob || _.isReserved(key)) {
      return
    }
    ob.notify()
    if (ob.vms) {
      var i = ob.vms.length
      while (i--) {
        var vm = ob.vms[i]
        vm._unproxy(key)
        vm._digest()
      }
    }
  }
)

},{"../util":71}],59:[function(require,module,exports){
var _ = require('../util')
var Cache = require('../cache')
var cache = new Cache(1000)
var argRE = /^[^\{\?]+$|^'[^']*'$|^"[^"]*"$/
var filterTokenRE = /[^\s'"]+|'[^']*'|"[^"]*"/g
var reservedArgRE = /^in$|^-?\d+/

/**
 * Parser state
 */

var str
var c, i, l
var inSingle
var inDouble
var curly
var square
var paren
var begin
var argIndex
var dirs
var dir
var lastFilterIndex
var arg

/**
 * Push a directive object into the result Array
 */

function pushDir () {
  dir.raw = str.slice(begin, i).trim()
  if (dir.expression === undefined) {
    dir.expression = str.slice(argIndex, i).trim()
  } else if (lastFilterIndex !== begin) {
    pushFilter()
  }
  if (i === 0 || dir.expression) {
    dirs.push(dir)
  }
}

/**
 * Push a filter to the current directive object
 */

function pushFilter () {
  var exp = str.slice(lastFilterIndex, i).trim()
  var filter
  if (exp) {
    filter = {}
    var tokens = exp.match(filterTokenRE)
    filter.name = tokens[0]
    if (tokens.length > 1) {
      filter.args = tokens.slice(1).map(processFilterArg)
    }
  }
  if (filter) {
    (dir.filters = dir.filters || []).push(filter)
  }
  lastFilterIndex = i + 1
}

/**
 * Check if an argument is dynamic and strip quotes.
 *
 * @param {String} arg
 * @return {Object}
 */

function processFilterArg (arg) {
  var stripped = reservedArgRE.test(arg)
    ? arg
    : _.stripQuotes(arg)
  var dynamic = stripped === false
  return {
    value: dynamic ? arg : stripped,
    dynamic: dynamic
  }
}

/**
 * Parse a directive string into an Array of AST-like
 * objects representing directives.
 *
 * Example:
 *
 * "click: a = a + 1 | uppercase" will yield:
 * {
 *   arg: 'click',
 *   expression: 'a = a + 1',
 *   filters: [
 *     { name: 'uppercase', args: null }
 *   ]
 * }
 *
 * @param {String} str
 * @return {Array<Object>}
 */

exports.parse = function (s) {

  var hit = cache.get(s)
  if (hit) {
    return hit
  }

  // reset parser state
  str = s
  inSingle = inDouble = false
  curly = square = paren = begin = argIndex = 0
  lastFilterIndex = 0
  dirs = []
  dir = {}
  arg = null

  for (i = 0, l = str.length; i < l; i++) {
    c = str.charCodeAt(i)
    if (inSingle) {
      // check single quote
      if (c === 0x27) inSingle = !inSingle
    } else if (inDouble) {
      // check double quote
      if (c === 0x22) inDouble = !inDouble
    } else if (
      c === 0x2C && // comma
      !paren && !curly && !square
    ) {
      // reached the end of a directive
      pushDir()
      // reset & skip the comma
      dir = {}
      begin = argIndex = lastFilterIndex = i + 1
    } else if (
      c === 0x3A && // colon
      !dir.expression &&
      !dir.arg
    ) {
      // argument
      arg = str.slice(begin, i).trim()
      // test for valid argument here
      // since we may have caught stuff like first half of
      // an object literal or a ternary expression.
      if (argRE.test(arg)) {
        argIndex = i + 1
        dir.arg = _.stripQuotes(arg) || arg
      }
    } else if (
      c === 0x7C && // pipe
      str.charCodeAt(i + 1) !== 0x7C &&
      str.charCodeAt(i - 1) !== 0x7C
    ) {
      if (dir.expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1
        dir.expression = str.slice(argIndex, i).trim()
      } else {
        // already has filter
        pushFilter()
      }
    } else {
      switch (c) {
        case 0x22: inDouble = true; break // "
        case 0x27: inSingle = true; break // '
        case 0x28: paren++; break         // (
        case 0x29: paren--; break         // )
        case 0x5B: square++; break        // [
        case 0x5D: square--; break        // ]
        case 0x7B: curly++; break         // {
        case 0x7D: curly--; break         // }
      }
    }
  }

  if (i === 0 || begin !== i) {
    pushDir()
  }

  cache.put(s, dirs)
  return dirs
}

},{"../cache":17,"../util":71}],60:[function(require,module,exports){
(function (process){
var _ = require('../util')
var Path = require('./path')
var Cache = require('../cache')
var expressionCache = new Cache(1000)

var allowedKeywords =
  'Math,Date,this,true,false,null,undefined,Infinity,NaN,' +
  'isNaN,isFinite,decodeURI,decodeURIComponent,encodeURI,' +
  'encodeURIComponent,parseInt,parseFloat'
var allowedKeywordsRE =
  new RegExp('^(' + allowedKeywords.replace(/,/g, '\\b|') + '\\b)')

// keywords that don't make sense inside expressions
var improperKeywords =
  'break,case,class,catch,const,continue,debugger,default,' +
  'delete,do,else,export,extends,finally,for,function,if,' +
  'import,in,instanceof,let,return,super,switch,throw,try,' +
  'var,while,with,yield,enum,await,implements,package,' +
  'proctected,static,interface,private,public'
var improperKeywordsRE =
  new RegExp('^(' + improperKeywords.replace(/,/g, '\\b|') + '\\b)')

var wsRE = /\s/g
var newlineRE = /\n/g
var saveRE = /[\{,]\s*[\w\$_]+\s*:|('[^']*'|"[^"]*")|new |typeof |void /g
var restoreRE = /"(\d+)"/g
var pathTestRE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\['.*?'\]|\[".*?"\]|\[\d+\]|\[[A-Za-z_$][\w$]*\])*$/
var pathReplaceRE = /[^\w$\.]([A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\['.*?'\]|\[".*?"\])*)/g
var booleanLiteralRE = /^(true|false)$/

/**
 * Save / Rewrite / Restore
 *
 * When rewriting paths found in an expression, it is
 * possible for the same letter sequences to be found in
 * strings and Object literal property keys. Therefore we
 * remove and store these parts in a temporary array, and
 * restore them after the path rewrite.
 */

var saved = []

/**
 * Save replacer
 *
 * The save regex can match two possible cases:
 * 1. An opening object literal
 * 2. A string
 * If matched as a plain string, we need to escape its
 * newlines, since the string needs to be preserved when
 * generating the function body.
 *
 * @param {String} str
 * @param {String} isString - str if matched as a string
 * @return {String} - placeholder with index
 */

function save (str, isString) {
  var i = saved.length
  saved[i] = isString
    ? str.replace(newlineRE, '\\n')
    : str
  return '"' + i + '"'
}

/**
 * Path rewrite replacer
 *
 * @param {String} raw
 * @return {String}
 */

function rewrite (raw) {
  var c = raw.charAt(0)
  var path = raw.slice(1)
  if (allowedKeywordsRE.test(path)) {
    return raw
  } else {
    path = path.indexOf('"') > -1
      ? path.replace(restoreRE, restore)
      : path
    return c + 'scope.' + path
  }
}

/**
 * Restore replacer
 *
 * @param {String} str
 * @param {String} i - matched save index
 * @return {String}
 */

function restore (str, i) {
  return saved[i]
}

/**
 * Rewrite an expression, prefixing all path accessors with
 * `scope.` and generate getter/setter functions.
 *
 * @param {String} exp
 * @param {Boolean} needSet
 * @return {Function}
 */

function compileExpFns (exp, needSet) {
  if (improperKeywordsRE.test(exp)) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Avoid using reserved keywords in expression: ' + exp
    )
  }
  // reset state
  saved.length = 0
  // save strings and object literal keys
  var body = exp
    .replace(saveRE, save)
    .replace(wsRE, '')
  // rewrite all paths
  // pad 1 space here becaue the regex matches 1 extra char
  body = (' ' + body)
    .replace(pathReplaceRE, rewrite)
    .replace(restoreRE, restore)
  var getter = makeGetter(body)
  if (getter) {
    return {
      get: getter,
      body: body,
      set: needSet
        ? makeSetter(body)
        : null
    }
  }
}

/**
 * Compile getter setters for a simple path.
 *
 * @param {String} exp
 * @return {Function}
 */

function compilePathFns (exp) {
  var getter, path
  if (exp.indexOf('[') < 0) {
    // really simple path
    path = exp.split('.')
    path.raw = exp
    getter = Path.compileGetter(path)
  } else {
    // do the real parsing
    path = Path.parse(exp)
    getter = path.get
  }
  return {
    get: getter,
    // always generate setter for simple paths
    set: function (obj, val) {
      Path.set(obj, path, val)
    }
  }
}

/**
 * Build a getter function. Requires eval.
 *
 * We isolate the try/catch so it doesn't affect the
 * optimization of the parse function when it is not called.
 *
 * @param {String} body
 * @return {Function|undefined}
 */

function makeGetter (body) {
  try {
    return new Function('scope', 'return ' + body + ';')
  } catch (e) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Invalid expression. ' +
      'Generated function body: ' + body
    )
  }
}

/**
 * Build a setter function.
 *
 * This is only needed in rare situations like "a[b]" where
 * a settable path requires dynamic evaluation.
 *
 * This setter function may throw error when called if the
 * expression body is not a valid left-hand expression in
 * assignment.
 *
 * @param {String} body
 * @return {Function|undefined}
 */

function makeSetter (body) {
  try {
    return new Function('scope', 'value', body + '=value;')
  } catch (e) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Invalid setter function body: ' + body
    )
  }
}

/**
 * Check for setter existence on a cache hit.
 *
 * @param {Function} hit
 */

function checkSetter (hit) {
  if (!hit.set) {
    hit.set = makeSetter(hit.body)
  }
}

/**
 * Parse an expression into re-written getter/setters.
 *
 * @param {String} exp
 * @param {Boolean} needSet
 * @return {Function}
 */

exports.parse = function (exp, needSet) {
  exp = exp.trim()
  // try cache
  var hit = expressionCache.get(exp)
  if (hit) {
    if (needSet) {
      checkSetter(hit)
    }
    return hit
  }
  // we do a simple path check to optimize for them.
  // the check fails valid paths with unusal whitespaces,
  // but that's too rare and we don't care.
  // also skip boolean literals and paths that start with
  // global "Math"
  var res = exports.isSimplePath(exp)
    ? compilePathFns(exp)
    : compileExpFns(exp, needSet)
  expressionCache.put(exp, res)
  return res
}

/**
 * Check if an expression is a simple path.
 *
 * @param {String} exp
 * @return {Boolean}
 */

exports.isSimplePath = function (exp) {
  return pathTestRE.test(exp) &&
    // don't treat true/false as paths
    !booleanLiteralRE.test(exp) &&
    // Math constants e.g. Math.PI, Math.E etc.
    exp.slice(0, 5) !== 'Math.'
}

}).call(this,require('_process'))
},{"../cache":17,"../util":71,"./path":61,"_process":1}],61:[function(require,module,exports){
(function (process){
var _ = require('../util')
var Cache = require('../cache')
var pathCache = new Cache(1000)
var identRE = exports.identRE = /^[$_a-zA-Z]+[\w$]*$/

// actions
var APPEND = 0
var PUSH = 1

// states
var BEFORE_PATH = 0
var IN_PATH = 1
var BEFORE_IDENT = 2
var IN_IDENT = 3
var BEFORE_ELEMENT = 4
var AFTER_ZERO = 5
var IN_INDEX = 6
var IN_SINGLE_QUOTE = 7
var IN_DOUBLE_QUOTE = 8
var IN_SUB_PATH = 9
var AFTER_ELEMENT = 10
var AFTER_PATH = 11
var ERROR = 12

var pathStateMachine = []

pathStateMachine[BEFORE_PATH] = {
  'ws': [BEFORE_PATH],
  'ident': [IN_IDENT, APPEND],
  '[': [BEFORE_ELEMENT],
  'eof': [AFTER_PATH]
}

pathStateMachine[IN_PATH] = {
  'ws': [IN_PATH],
  '.': [BEFORE_IDENT],
  '[': [BEFORE_ELEMENT],
  'eof': [AFTER_PATH]
}

pathStateMachine[BEFORE_IDENT] = {
  'ws': [BEFORE_IDENT],
  'ident': [IN_IDENT, APPEND]
}

pathStateMachine[IN_IDENT] = {
  'ident': [IN_IDENT, APPEND],
  '0': [IN_IDENT, APPEND],
  'number': [IN_IDENT, APPEND],
  'ws': [IN_PATH, PUSH],
  '.': [BEFORE_IDENT, PUSH],
  '[': [BEFORE_ELEMENT, PUSH],
  'eof': [AFTER_PATH, PUSH]
}

pathStateMachine[BEFORE_ELEMENT] = {
  'ws': [BEFORE_ELEMENT],
  '0': [AFTER_ZERO, APPEND],
  'number': [IN_INDEX, APPEND],
  "'": [IN_SINGLE_QUOTE, APPEND, ''],
  '"': [IN_DOUBLE_QUOTE, APPEND, ''],
  'ident': [IN_SUB_PATH, APPEND, '*']
}

pathStateMachine[AFTER_ZERO] = {
  'ws': [AFTER_ELEMENT, PUSH],
  ']': [IN_PATH, PUSH]
}

pathStateMachine[IN_INDEX] = {
  '0': [IN_INDEX, APPEND],
  'number': [IN_INDEX, APPEND],
  'ws': [AFTER_ELEMENT],
  ']': [IN_PATH, PUSH]
}

pathStateMachine[IN_SINGLE_QUOTE] = {
  "'": [AFTER_ELEMENT],
  'eof': ERROR,
  'else': [IN_SINGLE_QUOTE, APPEND]
}

pathStateMachine[IN_DOUBLE_QUOTE] = {
  '"': [AFTER_ELEMENT],
  'eof': ERROR,
  'else': [IN_DOUBLE_QUOTE, APPEND]
}

pathStateMachine[IN_SUB_PATH] = {
  'ident': [IN_SUB_PATH, APPEND],
  '0': [IN_SUB_PATH, APPEND],
  'number': [IN_SUB_PATH, APPEND],
  'ws': [AFTER_ELEMENT],
  ']': [IN_PATH, PUSH]
}

pathStateMachine[AFTER_ELEMENT] = {
  'ws': [AFTER_ELEMENT],
  ']': [IN_PATH, PUSH]
}

/**
 * Determine the type of a character in a keypath.
 *
 * @param {Char} ch
 * @return {String} type
 */

function getPathCharType (ch) {
  if (ch === undefined) {
    return 'eof'
  }

  var code = ch.charCodeAt(0)

  switch (code) {
    case 0x5B: // [
    case 0x5D: // ]
    case 0x2E: // .
    case 0x22: // "
    case 0x27: // '
    case 0x30: // 0
      return ch

    case 0x5F: // _
    case 0x24: // $
      return 'ident'

    case 0x20: // Space
    case 0x09: // Tab
    case 0x0A: // Newline
    case 0x0D: // Return
    case 0xA0:  // No-break space
    case 0xFEFF:  // Byte Order Mark
    case 0x2028:  // Line Separator
    case 0x2029:  // Paragraph Separator
      return 'ws'
  }

  // a-z, A-Z
  if (
    (code >= 0x61 && code <= 0x7A) ||
    (code >= 0x41 && code <= 0x5A)
  ) {
    return 'ident'
  }

  // 1-9
  if (code >= 0x31 && code <= 0x39) {
    return 'number'
  }

  return 'else'
}

/**
 * Parse a string path into an array of segments
 * Todo implement cache
 *
 * @param {String} path
 * @return {Array|undefined}
 */

function parsePath (path) {
  var keys = []
  var index = -1
  var mode = BEFORE_PATH
  var c, newChar, key, type, transition, action, typeMap

  var actions = []
  actions[PUSH] = function () {
    if (key === undefined) {
      return
    }
    keys.push(key)
    key = undefined
  }
  actions[APPEND] = function () {
    if (key === undefined) {
      key = newChar
    } else {
      key += newChar
    }
  }

  function maybeUnescapeQuote () {
    var nextChar = path[index + 1]
    if ((mode === IN_SINGLE_QUOTE && nextChar === "'") ||
        (mode === IN_DOUBLE_QUOTE && nextChar === '"')) {
      index++
      newChar = nextChar
      actions[APPEND]()
      return true
    }
  }

  while (mode != null) {
    index++
    c = path[index]

    if (c === '\\' && maybeUnescapeQuote()) {
      continue
    }

    type = getPathCharType(c)
    typeMap = pathStateMachine[mode]
    transition = typeMap[type] || typeMap['else'] || ERROR

    if (transition === ERROR) {
      return // parse error
    }

    mode = transition[0]
    action = actions[transition[1]]
    if (action) {
      newChar = transition[2]
      newChar = newChar === undefined
        ? c
        : newChar === '*'
          ? newChar + c
          : newChar
      action()
    }

    if (mode === AFTER_PATH) {
      keys.raw = path
      return keys
    }
  }
}

/**
 * Format a accessor segment based on its type.
 *
 * @param {String} key
 * @return {Boolean}
 */

function formatAccessor (key) {
  if (identRE.test(key)) { // identifier
    return '.' + key
  } else if (+key === key >>> 0) { // bracket index
    return '[' + key + ']'
  } else if (key.charAt(0) === '*') {
    return '[o' + formatAccessor(key.slice(1)) + ']'
  } else { // bracket string
    return '["' + key.replace(/"/g, '\\"') + '"]'
  }
}

/**
 * Compiles a getter function with a fixed path.
 * The fixed path getter supresses errors.
 *
 * @param {Array} path
 * @return {Function}
 */

exports.compileGetter = function (path) {
  var body = 'return o' + path.map(formatAccessor).join('')
  return new Function('o', body)
}

/**
 * External parse that check for a cache hit first
 *
 * @param {String} path
 * @return {Array|undefined}
 */

exports.parse = function (path) {
  var hit = pathCache.get(path)
  if (!hit) {
    hit = parsePath(path)
    if (hit) {
      hit.get = exports.compileGetter(hit)
      pathCache.put(path, hit)
    }
  }
  return hit
}

/**
 * Get from an object from a path string
 *
 * @param {Object} obj
 * @param {String} path
 */

exports.get = function (obj, path) {
  path = exports.parse(path)
  if (path) {
    return path.get(obj)
  }
}

/**
 * Set on an object from a path
 *
 * @param {Object} obj
 * @param {String | Array} path
 * @param {*} val
 */

exports.set = function (obj, path, val) {
  var original = obj
  if (typeof path === 'string') {
    path = exports.parse(path)
  }
  if (!path || !_.isObject(obj)) {
    return false
  }
  var last, key
  for (var i = 0, l = path.length; i < l; i++) {
    last = obj
    key = path[i]
    if (key.charAt(0) === '*') {
      key = original[key.slice(1)]
    }
    if (i < l - 1) {
      obj = obj[key]
      if (!_.isObject(obj)) {
        warnNonExistent(path)
        obj = {}
        last.$add(key, obj)
      }
    } else {
      if (_.isArray(obj)) {
        obj.$set(key, val)
      } else if (key in obj) {
        obj[key] = val
      } else {
        warnNonExistent(path)
        obj.$add(key, val)
      }
    }
  }
  return true
}

function warnNonExistent (path) {
  process.env.NODE_ENV !== 'production' && _.warn(
    'You are setting a non-existent path "' + path.raw + '" ' +
    'on a vm instance. Consider pre-initializing the property ' +
    'with the "data" option for more reliable reactivity ' +
    'and better performance.'
  )
}

}).call(this,require('_process'))
},{"../cache":17,"../util":71,"_process":1}],62:[function(require,module,exports){
var _ = require('../util')
var Cache = require('../cache')
var templateCache = new Cache(1000)
var idSelectorCache = new Cache(1000)

var map = {
  _default: [0, '', ''],
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [
    2,
    '<table><tbody></tbody><colgroup>',
    '</colgroup></table>'
  ]
}

map.td =
map.th = [
  3,
  '<table><tbody><tr>',
  '</tr></tbody></table>'
]

map.option =
map.optgroup = [
  1,
  '<select multiple="multiple">',
  '</select>'
]

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>']

map.g =
map.defs =
map.symbol =
map.use =
map.image =
map.text =
map.circle =
map.ellipse =
map.line =
map.path =
map.polygon =
map.polyline =
map.rect = [
  1,
  '<svg ' +
    'xmlns="http://www.w3.org/2000/svg" ' +
    'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    'xmlns:ev="http://www.w3.org/2001/xml-events"' +
    'version="1.1">',
  '</svg>'
]

/**
 * Check if a node is a supported template node with a
 * DocumentFragment content.
 *
 * @param {Node} node
 * @return {Boolean}
 */

function isRealTemplate (node) {
  return _.isTemplate(node) &&
    node.content instanceof DocumentFragment
}

var tagRE = /<([\w:]+)/
var entityRE = /&\w+;|&#\d+;|&#x[\dA-F]+;/

/**
 * Convert a string template to a DocumentFragment.
 * Determines correct wrapping by tag types. Wrapping
 * strategy found in jQuery & component/domify.
 *
 * @param {String} templateString
 * @return {DocumentFragment}
 */

function stringToFragment (templateString) {
  // try a cache hit first
  var hit = templateCache.get(templateString)
  if (hit) {
    return hit
  }

  var frag = document.createDocumentFragment()
  var tagMatch = templateString.match(tagRE)
  var entityMatch = entityRE.test(templateString)

  if (!tagMatch && !entityMatch) {
    // text only, return a single text node.
    frag.appendChild(
      document.createTextNode(templateString)
    )
  } else {

    var tag = tagMatch && tagMatch[1]
    var wrap = map[tag] || map._default
    var depth = wrap[0]
    var prefix = wrap[1]
    var suffix = wrap[2]
    var node = document.createElement('div')

    node.innerHTML = prefix + templateString.trim() + suffix
    while (depth--) {
      node = node.lastChild
    }

    var child
    /* eslint-disable no-cond-assign */
    while (child = node.firstChild) {
    /* eslint-enable no-cond-assign */
      frag.appendChild(child)
    }
  }

  templateCache.put(templateString, frag)
  return frag
}

/**
 * Convert a template node to a DocumentFragment.
 *
 * @param {Node} node
 * @return {DocumentFragment}
 */

function nodeToFragment (node) {
  // if its a template tag and the browser supports it,
  // its content is already a document fragment.
  if (isRealTemplate(node)) {
    _.trimNode(node.content)
    return node.content
  }
  // script template
  if (node.tagName === 'SCRIPT') {
    return stringToFragment(node.textContent)
  }
  // normal node, clone it to avoid mutating the original
  var clone = exports.clone(node)
  var frag = document.createDocumentFragment()
  var child
  /* eslint-disable no-cond-assign */
  while (child = clone.firstChild) {
  /* eslint-enable no-cond-assign */
    frag.appendChild(child)
  }
  _.trimNode(frag)
  return frag
}

// Test for the presence of the Safari template cloning bug
// https://bugs.webkit.org/show_bug.cgi?id=137755
var hasBrokenTemplate = (function () {
  /* istanbul ignore else */
  if (_.inBrowser) {
    var a = document.createElement('div')
    a.innerHTML = '<template>1</template>'
    return !a.cloneNode(true).firstChild.innerHTML
  } else {
    return false
  }
})()

// Test for IE10/11 textarea placeholder clone bug
var hasTextareaCloneBug = (function () {
  /* istanbul ignore else */
  if (_.inBrowser) {
    var t = document.createElement('textarea')
    t.placeholder = 't'
    return t.cloneNode(true).value === 't'
  } else {
    return false
  }
})()

/**
 * 1. Deal with Safari cloning nested <template> bug by
 *    manually cloning all template instances.
 * 2. Deal with IE10/11 textarea placeholder bug by setting
 *    the correct value after cloning.
 *
 * @param {Element|DocumentFragment} node
 * @return {Element|DocumentFragment}
 */

exports.clone = function (node) {
  if (!node.querySelectorAll) {
    return node.cloneNode()
  }
  var res = node.cloneNode(true)
  var i, original, cloned
  /* istanbul ignore if */
  if (hasBrokenTemplate) {
    var clone = res
    if (isRealTemplate(node)) {
      node = node.content
      clone = res.content
    }
    original = node.querySelectorAll('template')
    if (original.length) {
      cloned = clone.querySelectorAll('template')
      i = cloned.length
      while (i--) {
        cloned[i].parentNode.replaceChild(
          exports.clone(original[i]),
          cloned[i]
        )
      }
    }
  }
  /* istanbul ignore if */
  if (hasTextareaCloneBug) {
    if (node.tagName === 'TEXTAREA') {
      res.value = node.value
    } else {
      original = node.querySelectorAll('textarea')
      if (original.length) {
        cloned = res.querySelectorAll('textarea')
        i = cloned.length
        while (i--) {
          cloned[i].value = original[i].value
        }
      }
    }
  }
  return res
}

/**
 * Process the template option and normalizes it into a
 * a DocumentFragment that can be used as a partial or a
 * instance template.
 *
 * @param {*} template
 *    Possible values include:
 *    - DocumentFragment object
 *    - Node object of type Template
 *    - id selector: '#some-template-id'
 *    - template string: '<div><span>{{msg}}</span></div>'
 * @param {Boolean} clone
 * @param {Boolean} noSelector
 * @return {DocumentFragment|undefined}
 */

exports.parse = function (template, clone, noSelector) {
  var node, frag

  // if the template is already a document fragment,
  // do nothing
  if (template instanceof DocumentFragment) {
    _.trimNode(template)
    return clone
      ? exports.clone(template)
      : template
  }

  if (typeof template === 'string') {
    // id selector
    if (!noSelector && template.charAt(0) === '#') {
      // id selector can be cached too
      frag = idSelectorCache.get(template)
      if (!frag) {
        node = document.getElementById(template.slice(1))
        if (node) {
          frag = nodeToFragment(node)
          // save selector to cache
          idSelectorCache.put(template, frag)
        }
      }
    } else {
      // normal string template
      frag = stringToFragment(template)
    }
  } else if (template.nodeType) {
    // a direct node
    frag = nodeToFragment(template)
  }

  return frag && clone
    ? exports.clone(frag)
    : frag
}

},{"../cache":17,"../util":71}],63:[function(require,module,exports){
var Cache = require('../cache')
var config = require('../config')
var dirParser = require('./directive')
var regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g
var cache, tagRE, htmlRE, firstChar, lastChar

/**
 * Escape a string so it can be used in a RegExp
 * constructor.
 *
 * @param {String} str
 */

function escapeRegex (str) {
  return str.replace(regexEscapeRE, '\\$&')
}

/**
 * Compile the interpolation tag regex.
 *
 * @return {RegExp}
 */

function compileRegex () {
  config._delimitersChanged = false
  var open = config.delimiters[0]
  var close = config.delimiters[1]
  firstChar = open.charAt(0)
  lastChar = close.charAt(close.length - 1)
  var firstCharRE = escapeRegex(firstChar)
  var lastCharRE = escapeRegex(lastChar)
  var openRE = escapeRegex(open)
  var closeRE = escapeRegex(close)
  tagRE = new RegExp(
    firstCharRE + '?' + openRE +
    '(.+?)' +
    closeRE + lastCharRE + '?',
    'g'
  )
  htmlRE = new RegExp(
    '^' + firstCharRE + openRE +
    '.*' +
    closeRE + lastCharRE + '$'
  )
  // reset cache
  cache = new Cache(1000)
}

/**
 * Parse a template text string into an array of tokens.
 *
 * @param {String} text
 * @return {Array<Object> | null}
 *               - {String} type
 *               - {String} value
 *               - {Boolean} [html]
 *               - {Boolean} [oneTime]
 */

exports.parse = function (text) {
  if (config._delimitersChanged) {
    compileRegex()
  }
  var hit = cache.get(text)
  if (hit) {
    return hit
  }
  text = text.replace(/\n/g, '')
  if (!tagRE.test(text)) {
    return null
  }
  var tokens = []
  var lastIndex = tagRE.lastIndex = 0
  var match, index, value, first, oneTime, twoWay
  /* eslint-disable no-cond-assign */
  while (match = tagRE.exec(text)) {
  /* eslint-enable no-cond-assign */
    index = match.index
    // push text token
    if (index > lastIndex) {
      tokens.push({
        value: text.slice(lastIndex, index)
      })
    }
    // tag token
    first = match[1].charCodeAt(0)
    oneTime = first === 42 // *
    twoWay = first === 64  // @
    value = oneTime || twoWay
      ? match[1].slice(1)
      : match[1]
    tokens.push({
      tag: true,
      value: value.trim(),
      html: htmlRE.test(match[0]),
      oneTime: oneTime,
      twoWay: twoWay
    })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push({
      value: text.slice(lastIndex)
    })
  }
  cache.put(text, tokens)
  return tokens
}

/**
 * Format a list of tokens into an expression.
 * e.g. tokens parsed from 'a {{b}} c' can be serialized
 * into one single expression as '"a " + b + " c"'.
 *
 * @param {Array} tokens
 * @param {Vue} [vm]
 * @return {String}
 */

exports.tokensToExp = function (tokens, vm) {
  if (tokens.length > 1) {
    return tokens.map(function (token) {
      return formatToken(token, vm)
    }).join('+')
  } else {
    return formatToken(tokens[0], vm, true)
  }
}

/**
 * Format a single token.
 *
 * @param {Object} token
 * @param {Vue} [vm]
 * @param {Boolean} single
 * @return {String}
 */

function formatToken (token, vm, single) {
  return token.tag
    ? vm && token.oneTime
      ? '"' + vm.$eval(token.value) + '"'
      : inlineFilters(token.value, single)
    : '"' + token.value + '"'
}

/**
 * For an attribute with multiple interpolation tags,
 * e.g. attr="some-{{thing | filter}}", in order to combine
 * the whole thing into a single watchable expression, we
 * have to inline those filters. This function does exactly
 * that. This is a bit hacky but it avoids heavy changes
 * to directive parser and watcher mechanism.
 *
 * @param {String} exp
 * @param {Boolean} single
 * @return {String}
 */

var filterRE = /[^|]\|[^|]/
function inlineFilters (exp, single) {
  if (!filterRE.test(exp)) {
    return single
      ? exp
      : '(' + exp + ')'
  } else {
    var dir = dirParser.parse(exp)[0]
    if (!dir.filters) {
      return '(' + exp + ')'
    } else {
      return 'this._applyFilters(' +
        dir.expression + // value
        ',null,' +       // oldValue (null for read)
        JSON.stringify(dir.filters) + // filter descriptors
        ',false)'        // write?
    }
  }
}

},{"../cache":17,"../config":22,"./directive":59}],64:[function(require,module,exports){
var _ = require('../util')

/**
 * Append with transition.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

exports.append = function (el, target, vm, cb) {
  apply(el, 1, function () {
    target.appendChild(el)
  }, vm, cb)
}

/**
 * InsertBefore with transition.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

exports.before = function (el, target, vm, cb) {
  apply(el, 1, function () {
    _.before(el, target)
  }, vm, cb)
}

/**
 * Remove with transition.
 *
 * @param {Element} el
 * @param {Vue} vm
 * @param {Function} [cb]
 */

exports.remove = function (el, vm, cb) {
  apply(el, -1, function () {
    _.remove(el)
  }, vm, cb)
}

/**
 * Remove by appending to another parent with transition.
 * This is only used in block operations.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

exports.removeThenAppend = function (el, target, vm, cb) {
  apply(el, -1, function () {
    target.appendChild(el)
  }, vm, cb)
}

/**
 * Append the childNodes of a fragment to target.
 *
 * @param {DocumentFragment} block
 * @param {Node} target
 * @param {Vue} vm
 */

exports.blockAppend = function (block, target, vm) {
  var nodes = _.toArray(block.childNodes)
  for (var i = 0, l = nodes.length; i < l; i++) {
    exports.before(nodes[i], target, vm)
  }
}

/**
 * Remove a block of nodes between two edge nodes.
 *
 * @param {Node} start
 * @param {Node} end
 * @param {Vue} vm
 */

exports.blockRemove = function (start, end, vm) {
  var node = start.nextSibling
  var next
  while (node !== end) {
    next = node.nextSibling
    exports.remove(node, vm)
    node = next
  }
}

/**
 * Apply transitions with an operation callback.
 *
 * @param {Element} el
 * @param {Number} direction
 *                  1: enter
 *                 -1: leave
 * @param {Function} op - the actual DOM operation
 * @param {Vue} vm
 * @param {Function} [cb]
 */

var apply = exports.apply = function (el, direction, op, vm, cb) {
  var transition = el.__v_trans
  if (
    !transition ||
    // skip if there are no js hooks and CSS transition is
    // not supported
    (!transition.hooks && !_.transitionEndEvent) ||
    // skip transitions for initial compile
    !vm._isCompiled ||
    // if the vm is being manipulated by a parent directive
    // during the parent's compilation phase, skip the
    // animation.
    (vm.$parent && !vm.$parent._isCompiled)
  ) {
    op()
    if (cb) cb()
    return
  }
  var action = direction > 0 ? 'enter' : 'leave'
  transition[action](op, cb)
}

},{"../util":71}],65:[function(require,module,exports){
var _ = require('../util')
var queue = []
var queued = false

/**
 * Push a job into the queue.
 *
 * @param {Function} job
 */

exports.push = function (job) {
  queue.push(job)
  if (!queued) {
    queued = true
    _.nextTick(flush)
  }
}

/**
 * Flush the queue, and do one forced reflow before
 * triggering transitions.
 */

function flush () {
  // Force layout
  var f = document.documentElement.offsetHeight
  for (var i = 0; i < queue.length; i++) {
    queue[i]()
  }
  queue = []
  queued = false
  // dummy return, so js linters don't complain about
  // unused variable f
  return f
}

},{"../util":71}],66:[function(require,module,exports){
var _ = require('../util')
var queue = require('./queue')
var addClass = _.addClass
var removeClass = _.removeClass
var transitionEndEvent = _.transitionEndEvent
var animationEndEvent = _.animationEndEvent
var transDurationProp = _.transitionProp + 'Duration'
var animDurationProp = _.animationProp + 'Duration'

var TYPE_TRANSITION = 1
var TYPE_ANIMATION = 2

var uid = 0

/**
 * A Transition object that encapsulates the state and logic
 * of the transition.
 *
 * @param {Element} el
 * @param {String} id
 * @param {Object} hooks
 * @param {Vue} vm
 */

function Transition (el, id, hooks, vm) {
  this.id = uid++
  this.el = el
  this.enterClass = id + '-enter'
  this.leaveClass = id + '-leave'
  this.hooks = hooks
  this.vm = vm
  // async state
  this.pendingCssEvent =
  this.pendingCssCb =
  this.cancel =
  this.pendingJsCb =
  this.op =
  this.cb = null
  this.justEntered = false
  this.entered = this.left = false
  this.typeCache = {}
  // bind
  var self = this
  ;['enterNextTick', 'enterDone', 'leaveNextTick', 'leaveDone']
    .forEach(function (m) {
      self[m] = _.bind(self[m], self)
    })
}

var p = Transition.prototype

/**
 * Start an entering transition.
 *
 * 1. enter transition triggered
 * 2. call beforeEnter hook
 * 3. add enter class
 * 4. insert/show element
 * 5. call enter hook (with possible explicit js callback)
 * 6. reflow
 * 7. based on transition type:
 *    - transition:
 *        remove class now, wait for transitionend,
 *        then done if there's no explicit js callback.
 *    - animation:
 *        wait for animationend, remove class,
 *        then done if there's no explicit js callback.
 *    - no css transition:
 *        done now if there's no explicit js callback.
 * 8. wait for either done or js callback, then call
 *    afterEnter hook.
 *
 * @param {Function} op - insert/show the element
 * @param {Function} [cb]
 */

p.enter = function (op, cb) {
  this.cancelPending()
  this.callHook('beforeEnter')
  this.cb = cb
  addClass(this.el, this.enterClass)
  op()
  this.entered = false
  this.callHookWithCb('enter')
  if (this.entered) {
    return // user called done synchronously.
  }
  this.cancel = this.hooks && this.hooks.enterCancelled
  queue.push(this.enterNextTick)
}

/**
 * The "nextTick" phase of an entering transition, which is
 * to be pushed into a queue and executed after a reflow so
 * that removing the class can trigger a CSS transition.
 */

p.enterNextTick = function () {
  this.justEntered = true
  _.nextTick(function () {
    this.justEntered = false
  }, this)
  var enterDone = this.enterDone
  var type = this.getCssTransitionType(this.enterClass)
  if (!this.pendingJsCb) {
    if (type === TYPE_TRANSITION) {
      // trigger transition by removing enter class now
      removeClass(this.el, this.enterClass)
      this.setupCssCb(transitionEndEvent, enterDone)
    } else if (type === TYPE_ANIMATION) {
      this.setupCssCb(animationEndEvent, enterDone)
    } else {
      enterDone()
    }
  } else if (type === TYPE_TRANSITION) {
    removeClass(this.el, this.enterClass)
  }
}

/**
 * The "cleanup" phase of an entering transition.
 */

p.enterDone = function () {
  this.entered = true
  this.cancel = this.pendingJsCb = null
  removeClass(this.el, this.enterClass)
  this.callHook('afterEnter')
  if (this.cb) this.cb()
}

/**
 * Start a leaving transition.
 *
 * 1. leave transition triggered.
 * 2. call beforeLeave hook
 * 3. add leave class (trigger css transition)
 * 4. call leave hook (with possible explicit js callback)
 * 5. reflow if no explicit js callback is provided
 * 6. based on transition type:
 *    - transition or animation:
 *        wait for end event, remove class, then done if
 *        there's no explicit js callback.
 *    - no css transition:
 *        done if there's no explicit js callback.
 * 7. wait for either done or js callback, then call
 *    afterLeave hook.
 *
 * @param {Function} op - remove/hide the element
 * @param {Function} [cb]
 */

p.leave = function (op, cb) {
  this.cancelPending()
  this.callHook('beforeLeave')
  this.op = op
  this.cb = cb
  addClass(this.el, this.leaveClass)
  this.left = false
  this.callHookWithCb('leave')
  if (this.left) {
    return // user called done synchronously.
  }
  this.cancel = this.hooks && this.hooks.leaveCancelled
  // only need to handle leaveDone if
  // 1. the transition is already done (synchronously called
  //    by the user, which causes this.op set to null)
  // 2. there's no explicit js callback
  if (this.op && !this.pendingJsCb) {
    // if a CSS transition leaves immediately after enter,
    // the transitionend event never fires. therefore we
    // detect such cases and end the leave immediately.
    if (this.justEntered) {
      this.leaveDone()
    } else {
      queue.push(this.leaveNextTick)
    }
  }
}

/**
 * The "nextTick" phase of a leaving transition.
 */

p.leaveNextTick = function () {
  var type = this.getCssTransitionType(this.leaveClass)
  if (type) {
    var event = type === TYPE_TRANSITION
      ? transitionEndEvent
      : animationEndEvent
    this.setupCssCb(event, this.leaveDone)
  } else {
    this.leaveDone()
  }
}

/**
 * The "cleanup" phase of a leaving transition.
 */

p.leaveDone = function () {
  this.left = true
  this.cancel = this.pendingJsCb = null
  this.op()
  removeClass(this.el, this.leaveClass)
  this.callHook('afterLeave')
  if (this.cb) this.cb()
  this.op = null
}

/**
 * Cancel any pending callbacks from a previously running
 * but not finished transition.
 */

p.cancelPending = function () {
  this.op = this.cb = null
  var hasPending = false
  if (this.pendingCssCb) {
    hasPending = true
    _.off(this.el, this.pendingCssEvent, this.pendingCssCb)
    this.pendingCssEvent = this.pendingCssCb = null
  }
  if (this.pendingJsCb) {
    hasPending = true
    this.pendingJsCb.cancel()
    this.pendingJsCb = null
  }
  if (hasPending) {
    removeClass(this.el, this.enterClass)
    removeClass(this.el, this.leaveClass)
  }
  if (this.cancel) {
    this.cancel.call(this.vm, this.el)
    this.cancel = null
  }
}

/**
 * Call a user-provided synchronous hook function.
 *
 * @param {String} type
 */

p.callHook = function (type) {
  if (this.hooks && this.hooks[type]) {
    this.hooks[type].call(this.vm, this.el)
  }
}

/**
 * Call a user-provided, potentially-async hook function.
 * We check for the length of arguments to see if the hook
 * expects a `done` callback. If true, the transition's end
 * will be determined by when the user calls that callback;
 * otherwise, the end is determined by the CSS transition or
 * animation.
 *
 * @param {String} type
 */

p.callHookWithCb = function (type) {
  var hook = this.hooks && this.hooks[type]
  if (hook) {
    if (hook.length > 1) {
      this.pendingJsCb = _.cancellable(this[type + 'Done'])
    }
    hook.call(this.vm, this.el, this.pendingJsCb)
  }
}

/**
 * Get an element's transition type based on the
 * calculated styles.
 *
 * @param {String} className
 * @return {Number}
 */

p.getCssTransitionType = function (className) {
  /* istanbul ignore if */
  if (
    !transitionEndEvent ||
    // skip CSS transitions if page is not visible -
    // this solves the issue of transitionend events not
    // firing until the page is visible again.
    // pageVisibility API is supported in IE10+, same as
    // CSS transitions.
    document.hidden ||
    // explicit js-only transition
    (this.hooks && this.hooks.css === false) ||
    // element is hidden
    isHidden(this.el)
  ) {
    return
  }
  var type = this.typeCache[className]
  if (type) return type
  var inlineStyles = this.el.style
  var computedStyles = window.getComputedStyle(this.el)
  var transDuration =
    inlineStyles[transDurationProp] ||
    computedStyles[transDurationProp]
  if (transDuration && transDuration !== '0s') {
    type = TYPE_TRANSITION
  } else {
    var animDuration =
      inlineStyles[animDurationProp] ||
      computedStyles[animDurationProp]
    if (animDuration && animDuration !== '0s') {
      type = TYPE_ANIMATION
    }
  }
  if (type) {
    this.typeCache[className] = type
  }
  return type
}

/**
 * Setup a CSS transitionend/animationend callback.
 *
 * @param {String} event
 * @param {Function} cb
 */

p.setupCssCb = function (event, cb) {
  this.pendingCssEvent = event
  var self = this
  var el = this.el
  var onEnd = this.pendingCssCb = function (e) {
    if (e.target === el) {
      _.off(el, event, onEnd)
      self.pendingCssEvent = self.pendingCssCb = null
      if (!self.pendingJsCb && cb) {
        cb()
      }
    }
  }
  _.on(el, event, onEnd)
}

/**
 * Check if an element is hidden - in that case we can just
 * skip the transition alltogether.
 *
 * @param {Element} el
 * @return {Boolean}
 */

function isHidden (el) {
  return el.style.display === 'none' ||
    el.style.visibility === 'hidden' ||
    el.hidden
}

module.exports = Transition

},{"../util":71,"./queue":65}],67:[function(require,module,exports){
(function (process){
var _ = require('./index')

/**
 * Check if an element is a component, if yes return its
 * component id.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {String|undefined}
 */

exports.commonTagRE = /^(div|p|span|img|a|br|ul|ol|li|h1|h2|h3|h4|h5|code|pre)$/
exports.checkComponent = function (el, options) {
  var tag = el.tagName.toLowerCase()
  if (tag === 'component') {
    // dynamic syntax
    var exp = el.getAttribute('is')
    el.removeAttribute('is')
    return exp
  } else if (
    !exports.commonTagRE.test(tag) &&
    _.resolveAsset(options, 'components', tag)
  ) {
    return tag
  /* eslint-disable no-cond-assign */
  } else if (tag = _.attr(el, 'component')) {
  /* eslint-enable no-cond-assign */
    return tag
  }
}

/**
 * Set a prop's initial value on a vm and its data object.
 * The vm may have inherit:true so we need to make sure
 * we don't accidentally overwrite parent value.
 *
 * @param {Vue} vm
 * @param {Object} prop
 * @param {*} value
 */

exports.initProp = function (vm, prop, value) {
  if (exports.assertProp(prop, value)) {
    var key = prop.path
    if (key in vm) {
      _.define(vm, key, value, true)
    } else {
      vm[key] = value
    }
    vm._data[key] = value
  }
}

/**
 * Assert whether a prop is valid.
 *
 * @param {Object} prop
 * @param {*} value
 */

exports.assertProp = function (prop, value) {
  // if a prop is not provided and is not required,
  // skip the check.
  if (prop.raw === null && !prop.required) {
    return true
  }
  var options = prop.options
  var type = options.type
  var valid = true
  var expectedType
  if (type) {
    if (type === String) {
      expectedType = 'string'
      valid = typeof value === expectedType
    } else if (type === Number) {
      expectedType = 'number'
      valid = typeof value === 'number'
    } else if (type === Boolean) {
      expectedType = 'boolean'
      valid = typeof value === 'boolean'
    } else if (type === Function) {
      expectedType = 'function'
      valid = typeof value === 'function'
    } else if (type === Object) {
      expectedType = 'object'
      valid = _.isPlainObject(value)
    } else if (type === Array) {
      expectedType = 'array'
      valid = _.isArray(value)
    } else {
      valid = value instanceof type
    }
  }
  if (!valid) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Invalid prop: type check failed for ' +
      prop.path + '="' + prop.raw + '".' +
      ' Expected ' + formatType(expectedType) +
      ', got ' + formatValue(value) + '.'
    )
    return false
  }
  var validator = options.validator
  if (validator) {
    if (!validator.call(null, value)) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Invalid prop: custom validator check failed for ' +
        prop.path + '="' + prop.raw + '"'
      )
      return false
    }
  }
  return true
}

function formatType (val) {
  return val
    ? val.charAt(0).toUpperCase() + val.slice(1)
    : 'custom type'
}

function formatValue (val) {
  return Object.prototype.toString.call(val).slice(8, -1)
}

}).call(this,require('_process'))
},{"./index":71,"_process":1}],68:[function(require,module,exports){
(function (process){
/**
 * Enable debug utilities.
 */

if (process.env.NODE_ENV !== 'production') {

  var config = require('../config')
  var hasConsole = typeof console !== 'undefined'

  /**
   * Log a message.
   *
   * @param {String} msg
   */

  exports.log = function (msg) {
    if (hasConsole && config.debug) {
      console.log('[Vue info]: ' + msg)
    }
  }

  /**
   * We've got a problem here.
   *
   * @param {String} msg
   */

  exports.warn = function (msg, e) {
    if (hasConsole && (!config.silent || config.debug)) {
      console.warn('[Vue warn]: ' + msg)
      /* istanbul ignore if */
      if (config.debug) {
        console.warn((e || new Error('Warning Stack Trace')).stack)
      }
    }
  }

  /**
   * Assert asset exists
   */

  exports.assertAsset = function (val, type, id) {
    /* istanbul ignore if */
    if (type === 'directive') {
      if (id === 'with') {
        exports.warn(
          'v-with has been deprecated in ^0.12.0. ' +
          'Use props instead.'
        )
        return
      }
      if (id === 'events') {
        exports.warn(
          'v-events has been deprecated in ^0.12.0. ' +
          'Pass down methods as callback props instead.'
        )
        return
      }
    }
    if (!val) {
      exports.warn('Failed to resolve ' + type + ': ' + id)
    }
  }
}

}).call(this,require('_process'))
},{"../config":22,"_process":1}],69:[function(require,module,exports){
(function (process){
var _ = require('./index')
var config = require('../config')

/**
 * Query an element selector if it's not an element already.
 *
 * @param {String|Element} el
 * @return {Element}
 */

exports.query = function (el) {
  if (typeof el === 'string') {
    var selector = el
    el = document.querySelector(el)
    if (!el) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Cannot find element: ' + selector
      )
    }
  }
  return el
}

/**
 * Check if a node is in the document.
 * Note: document.documentElement.contains should work here
 * but always returns false for comment nodes in phantomjs,
 * making unit tests difficult. This is fixed byy doing the
 * contains() check on the node's parentNode instead of
 * the node itself.
 *
 * @param {Node} node
 * @return {Boolean}
 */

exports.inDoc = function (node) {
  var doc = document.documentElement
  var parent = node && node.parentNode
  return doc === node ||
    doc === parent ||
    !!(parent && parent.nodeType === 1 && (doc.contains(parent)))
}

/**
 * Extract an attribute from a node.
 *
 * @param {Node} node
 * @param {String} attr
 */

exports.attr = function (node, attr) {
  attr = config.prefix + attr
  var val = node.getAttribute(attr)
  if (val !== null) {
    node.removeAttribute(attr)
  }
  return val
}

/**
 * Insert el before target
 *
 * @param {Element} el
 * @param {Element} target
 */

exports.before = function (el, target) {
  target.parentNode.insertBefore(el, target)
}

/**
 * Insert el after target
 *
 * @param {Element} el
 * @param {Element} target
 */

exports.after = function (el, target) {
  if (target.nextSibling) {
    exports.before(el, target.nextSibling)
  } else {
    target.parentNode.appendChild(el)
  }
}

/**
 * Remove el from DOM
 *
 * @param {Element} el
 */

exports.remove = function (el) {
  el.parentNode.removeChild(el)
}

/**
 * Prepend el to target
 *
 * @param {Element} el
 * @param {Element} target
 */

exports.prepend = function (el, target) {
  if (target.firstChild) {
    exports.before(el, target.firstChild)
  } else {
    target.appendChild(el)
  }
}

/**
 * Replace target with el
 *
 * @param {Element} target
 * @param {Element} el
 */

exports.replace = function (target, el) {
  var parent = target.parentNode
  if (parent) {
    parent.replaceChild(el, target)
  }
}

/**
 * Add event listener shorthand.
 *
 * @param {Element} el
 * @param {String} event
 * @param {Function} cb
 */

exports.on = function (el, event, cb) {
  el.addEventListener(event, cb)
}

/**
 * Remove event listener shorthand.
 *
 * @param {Element} el
 * @param {String} event
 * @param {Function} cb
 */

exports.off = function (el, event, cb) {
  el.removeEventListener(event, cb)
}

/**
 * Add class with compatibility for IE & SVG
 *
 * @param {Element} el
 * @param {Strong} cls
 */

exports.addClass = function (el, cls) {
  if (el.classList) {
    el.classList.add(cls)
  } else {
    var cur = ' ' + (el.getAttribute('class') || '') + ' '
    if (cur.indexOf(' ' + cls + ' ') < 0) {
      el.setAttribute('class', (cur + cls).trim())
    }
  }
}

/**
 * Remove class with compatibility for IE & SVG
 *
 * @param {Element} el
 * @param {Strong} cls
 */

exports.removeClass = function (el, cls) {
  if (el.classList) {
    el.classList.remove(cls)
  } else {
    var cur = ' ' + (el.getAttribute('class') || '') + ' '
    var tar = ' ' + cls + ' '
    while (cur.indexOf(tar) >= 0) {
      cur = cur.replace(tar, ' ')
    }
    el.setAttribute('class', cur.trim())
  }
}

/**
 * Extract raw content inside an element into a temporary
 * container div
 *
 * @param {Element} el
 * @param {Boolean} asFragment
 * @return {Element}
 */

exports.extractContent = function (el, asFragment) {
  var child
  var rawContent
  /* istanbul ignore if */
  if (
    exports.isTemplate(el) &&
    el.content instanceof DocumentFragment
  ) {
    el = el.content
  }
  if (el.hasChildNodes()) {
    exports.trimNode(el)
    rawContent = asFragment
      ? document.createDocumentFragment()
      : document.createElement('div')
    /* eslint-disable no-cond-assign */
    while (child = el.firstChild) {
    /* eslint-enable no-cond-assign */
      rawContent.appendChild(child)
    }
  }
  return rawContent
}

/**
 * Trim possible empty head/tail textNodes inside a parent.
 *
 * @param {Node} node
 */

exports.trimNode = function (node) {
  trim(node, node.firstChild)
  trim(node, node.lastChild)
}

function trim (parent, node) {
  if (node && node.nodeType === 3 && !node.data.trim()) {
    parent.removeChild(node)
  }
}

/**
 * Check if an element is a template tag.
 * Note if the template appears inside an SVG its tagName
 * will be in lowercase.
 *
 * @param {Element} el
 */

exports.isTemplate = function (el) {
  return el.tagName &&
    el.tagName.toLowerCase() === 'template'
}

/**
 * Create an "anchor" for performing dom insertion/removals.
 * This is used in a number of scenarios:
 * - fragment instance
 * - v-html
 * - v-if
 * - component
 * - repeat
 *
 * @param {String} content
 * @param {Boolean} persist - IE trashes empty textNodes on
 *                            cloneNode(true), so in certain
 *                            cases the anchor needs to be
 *                            non-empty to be persisted in
 *                            templates.
 * @return {Comment|Text}
 */

exports.createAnchor = function (content, persist) {
  return config.debug
    ? document.createComment(content)
    : document.createTextNode(persist ? ' ' : '')
}

}).call(this,require('_process'))
},{"../config":22,"./index":71,"_process":1}],70:[function(require,module,exports){
// can we use __proto__?
exports.hasProto = '__proto__' in {}

// Browser environment sniffing
var inBrowser = exports.inBrowser =
  typeof window !== 'undefined' &&
  Object.prototype.toString.call(window) !== '[object Object]'

exports.isIE9 =
  inBrowser &&
  navigator.userAgent.toLowerCase().indexOf('msie 9.0') > 0

exports.isAndroid =
  inBrowser &&
  navigator.userAgent.toLowerCase().indexOf('android') > 0

// Transition property/event sniffing
if (inBrowser && !exports.isIE9) {
  var isWebkitTrans =
    window.ontransitionend === undefined &&
    window.onwebkittransitionend !== undefined
  var isWebkitAnim =
    window.onanimationend === undefined &&
    window.onwebkitanimationend !== undefined
  exports.transitionProp = isWebkitTrans
    ? 'WebkitTransition'
    : 'transition'
  exports.transitionEndEvent = isWebkitTrans
    ? 'webkitTransitionEnd'
    : 'transitionend'
  exports.animationProp = isWebkitAnim
    ? 'WebkitAnimation'
    : 'animation'
  exports.animationEndEvent = isWebkitAnim
    ? 'webkitAnimationEnd'
    : 'animationend'
}

/**
 * Defer a task to execute it asynchronously. Ideally this
 * should be executed as a microtask, so we leverage
 * MutationObserver if it's available, and fallback to
 * setTimeout(0).
 *
 * @param {Function} cb
 * @param {Object} ctx
 */

exports.nextTick = (function () {
  var callbacks = []
  var pending = false
  var timerFunc
  function nextTickHandler () {
    pending = false
    var copies = callbacks.slice(0)
    callbacks = []
    for (var i = 0; i < copies.length; i++) {
      copies[i]()
    }
  }
  /* istanbul ignore if */
  if (typeof MutationObserver !== 'undefined') {
    var counter = 1
    var observer = new MutationObserver(nextTickHandler)
    var textNode = document.createTextNode(counter)
    observer.observe(textNode, {
      characterData: true
    })
    timerFunc = function () {
      counter = (counter + 1) % 2
      textNode.data = counter
    }
  } else {
    timerFunc = setTimeout
  }
  return function (cb, ctx) {
    var func = ctx
      ? function () { cb.call(ctx) }
      : cb
    callbacks.push(func)
    if (pending) return
    pending = true
    timerFunc(nextTickHandler, 0)
  }
})()

},{}],71:[function(require,module,exports){
var lang = require('./lang')
var extend = lang.extend

extend(exports, lang)
extend(exports, require('./env'))
extend(exports, require('./dom'))
extend(exports, require('./options'))
extend(exports, require('./component'))
extend(exports, require('./debug'))

},{"./component":67,"./debug":68,"./dom":69,"./env":70,"./lang":72,"./options":73}],72:[function(require,module,exports){
/**
 * Check if a string starts with $ or _
 *
 * @param {String} str
 * @return {Boolean}
 */

exports.isReserved = function (str) {
  var c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Guard text output, make sure undefined outputs
 * empty string
 *
 * @param {*} value
 * @return {String}
 */

exports.toString = function (value) {
  return value == null
    ? ''
    : value.toString()
}

/**
 * Check and convert possible numeric strings to numbers
 * before setting back to data
 *
 * @param {*} value
 * @return {*|Number}
 */

exports.toNumber = function (value) {
  if (typeof value !== 'string') {
    return value
  } else {
    var parsed = Number(value)
    return isNaN(parsed)
      ? value
      : parsed
  }
}

/**
 * Convert string boolean literals into real booleans.
 *
 * @param {*} value
 * @return {*|Boolean}
 */

exports.toBoolean = function (value) {
  return value === 'true'
    ? true
    : value === 'false'
      ? false
      : value
}

/**
 * Strip quotes from a string
 *
 * @param {String} str
 * @return {String | false}
 */

exports.stripQuotes = function (str) {
  var a = str.charCodeAt(0)
  var b = str.charCodeAt(str.length - 1)
  return a === b && (a === 0x22 || a === 0x27)
    ? str.slice(1, -1)
    : false
}

/**
 * Camelize a hyphen-delmited string.
 *
 * @param {String} str
 * @return {String}
 */

exports.camelize = function (str) {
  return str.replace(/-(\w)/g, toUpper)
}

function toUpper (_, c) {
  return c ? c.toUpperCase() : ''
}

/**
 * Hyphenate a camelCase string.
 *
 * @param {String} str
 * @return {String}
 */

exports.hyphenate = function (str) {
  return str
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * Converts hyphen/underscore/slash delimitered names into
 * camelized classNames.
 *
 * e.g. my-component => MyComponent
 *      some_else    => SomeElse
 *      some/comp    => SomeComp
 *
 * @param {String} str
 * @return {String}
 */

var classifyRE = /(?:^|[-_\/])(\w)/g
exports.classify = function (str) {
  return str.replace(classifyRE, toUpper)
}

/**
 * Simple bind, faster than native
 *
 * @param {Function} fn
 * @param {Object} ctx
 * @return {Function}
 */

exports.bind = function (fn, ctx) {
  return function (a) {
    var l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }
}

/**
 * Convert an Array-like object to a real Array.
 *
 * @param {Array-like} list
 * @param {Number} [start] - start index
 * @return {Array}
 */

exports.toArray = function (list, start) {
  start = start || 0
  var i = list.length - start
  var ret = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * Mix properties into target object.
 *
 * @param {Object} to
 * @param {Object} from
 */

exports.extend = function (to, from) {
  for (var key in from) {
    to[key] = from[key]
  }
  return to
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 *
 * @param {*} obj
 * @return {Boolean}
 */

exports.isObject = function (obj) {
  return obj !== null && typeof obj === 'object'
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 *
 * @param {*} obj
 * @return {Boolean}
 */

var toString = Object.prototype.toString
var OBJECT_STRING = '[object Object]'
exports.isPlainObject = function (obj) {
  return toString.call(obj) === OBJECT_STRING
}

/**
 * Array type check.
 *
 * @param {*} obj
 * @return {Boolean}
 */

exports.isArray = Array.isArray

/**
 * Define a non-enumerable property
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 * @param {Boolean} [enumerable]
 */

exports.define = function (obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Debounce a function so it only gets called after the
 * input stops arriving after the given wait period.
 *
 * @param {Function} func
 * @param {Number} wait
 * @return {Function} - the debounced function
 */

exports.debounce = function (func, wait) {
  var timeout, args, context, timestamp, result
  var later = function () {
    var last = Date.now() - timestamp
    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last)
    } else {
      timeout = null
      result = func.apply(context, args)
      if (!timeout) context = args = null
    }
  }
  return function () {
    context = this
    args = arguments
    timestamp = Date.now()
    if (!timeout) {
      timeout = setTimeout(later, wait)
    }
    return result
  }
}

/**
 * Manual indexOf because it's slightly faster than
 * native.
 *
 * @param {Array} arr
 * @param {*} obj
 */

exports.indexOf = function (arr, obj) {
  var i = arr.length
  while (i--) {
    if (arr[i] === obj) return i
  }
  return -1
}

/**
 * Make a cancellable version of an async callback.
 *
 * @param {Function} fn
 * @return {Function}
 */

exports.cancellable = function (fn) {
  var cb = function () {
    if (!cb.cancelled) {
      return fn.apply(this, arguments)
    }
  }
  cb.cancel = function () {
    cb.cancelled = true
  }
  return cb
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 *
 * @param {*} a
 * @param {*} b
 * @return {Boolean}
 */

exports.looseEqual = function (a, b) {
  /* eslint-disable eqeqeq */
  return a == b || (
    exports.isObject(a) && exports.isObject(b)
      ? JSON.stringify(a) === JSON.stringify(b)
      : false
  )
  /* eslint-enable eqeqeq */
}

},{}],73:[function(require,module,exports){
(function (process){
var _ = require('./index')
var config = require('../config')
var extend = _.extend

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 *
 * All strategy functions follow the same signature:
 *
 * @param {*} parentVal
 * @param {*} childVal
 * @param {Vue} [vm]
 */

var strats = config.optionMergeStrategies = Object.create(null)

/**
 * Helper that recursively merges two data objects together.
 */

function mergeData (to, from) {
  var key, toVal, fromVal
  for (key in from) {
    toVal = to[key]
    fromVal = from[key]
    if (!to.hasOwnProperty(key)) {
      to.$add(key, fromVal)
    } else if (_.isObject(toVal) && _.isObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */

strats.data = function (parentVal, childVal, vm) {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && _.warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.'
      )
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      return mergeData(
        childVal.call(this),
        parentVal.call(this)
      )
    }
  } else if (parentVal || childVal) {
    return function mergedInstanceDataFn () {
      // instance merge
      var instanceData = typeof childVal === 'function'
        ? childVal.call(vm)
        : childVal
      var defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm)
        : undefined
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

/**
 * El
 */

strats.el = function (parentVal, childVal, vm) {
  if (!vm && childVal && typeof childVal !== 'function') {
    process.env.NODE_ENV !== 'production' && _.warn(
      'The "el" option should be a function ' +
      'that returns a per-instance value in component ' +
      'definitions.'
    )
    return
  }
  var ret = childVal || parentVal
  // invoke the element factory if this is instance merge
  return vm && typeof ret === 'function'
    ? ret.call(vm)
    : ret
}

/**
 * Hooks and param attributes are merged as arrays.
 */

strats.created =
strats.ready =
strats.attached =
strats.detached =
strats.beforeCompile =
strats.compiled =
strats.beforeDestroy =
strats.destroyed =
strats.props = function (parentVal, childVal) {
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : _.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

/**
 * 0.11 deprecation warning
 */

strats.paramAttributes = function () {
  /* istanbul ignore next */
  process.env.NODE_ENV !== 'production' && _.warn(
    '"paramAttributes" option has been deprecated in 0.12. ' +
    'Use "props" instead.'
  )
}

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */

function mergeAssets (parentVal, childVal) {
  var res = Object.create(parentVal)
  return childVal
    ? extend(res, guardArrayAssets(childVal))
    : res
}

config._assetTypes.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Events & Watchers.
 *
 * Events & watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */

strats.watch =
strats.events = function (parentVal, childVal) {
  if (!childVal) return parentVal
  if (!parentVal) return childVal
  var ret = {}
  extend(ret, parentVal)
  for (var key in childVal) {
    var parent = ret[key]
    var child = childVal[key]
    if (parent && !_.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */

strats.methods =
strats.computed = function (parentVal, childVal) {
  if (!childVal) return parentVal
  if (!parentVal) return childVal
  var ret = Object.create(parentVal)
  extend(ret, childVal)
  return ret
}

/**
 * Default strategy.
 */

var defaultStrat = function (parentVal, childVal) {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Make sure component options get converted to actual
 * constructors.
 *
 * @param {Object} options
 */

function guardComponents (options) {
  if (options.components) {
    var components = options.components =
      guardArrayAssets(options.components)
    var def
    var ids = Object.keys(components)
    for (var i = 0, l = ids.length; i < l; i++) {
      var key = ids[i]
      if (_.commonTagRE.test(key)) {
        process.env.NODE_ENV !== 'production' && _.warn(
          'Do not use built-in HTML elements as component ' +
          'id: ' + key
        )
        continue
      }
      def = components[key]
      if (_.isPlainObject(def)) {
        def.id = def.id || key
        components[key] = def._Ctor || (def._Ctor = _.Vue.extend(def))
      }
    }
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 *
 * @param {Object} options
 */

function guardProps (options) {
  var props = options.props
  if (_.isPlainObject(props)) {
    options.props = Object.keys(props).map(function (key) {
      var val = props[key]
      if (!_.isPlainObject(val)) {
        val = { type: val }
      }
      val.name = key
      return val
    })
  } else if (_.isArray(props)) {
    options.props = props.map(function (prop) {
      return typeof prop === 'string'
        ? { name: prop }
        : prop
    })
  }
}

/**
 * Guard an Array-format assets option and converted it
 * into the key-value Object format.
 *
 * @param {Object|Array} assets
 * @return {Object}
 */

function guardArrayAssets (assets) {
  if (_.isArray(assets)) {
    var res = {}
    var i = assets.length
    var asset
    while (i--) {
      asset = assets[i]
      var id = asset.id || (asset.options && asset.options.id)
      if (!id) {
        process.env.NODE_ENV !== 'production' && _.warn(
          'Array-syntax assets must provide an id field.'
        )
      } else {
        res[id] = asset
      }
    }
    return res
  }
  return assets
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 *
 * @param {Object} parent
 * @param {Object} child
 * @param {Vue} [vm] - if vm is present, indicates this is
 *                     an instantiation merge.
 */

exports.mergeOptions = function merge (parent, child, vm) {
  guardComponents(child)
  guardProps(child)
  var options = {}
  var key
  if (child.mixins) {
    for (var i = 0, l = child.mixins.length; i < l; i++) {
      parent = merge(parent, child.mixins[i], vm)
    }
  }
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!(parent.hasOwnProperty(key))) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    var strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 *
 * @param {Object} options
 * @param {String} type
 * @param {String} id
 * @return {Object|Function}
 */

exports.resolveAsset = function resolve (options, type, id) {
  var camelizedId = _.camelize(id)
  var pascalizedId = camelizedId.charAt(0).toUpperCase() + camelizedId.slice(1)
  var assets = options[type]
  var asset = assets[id] || assets[camelizedId] || assets[pascalizedId]
  while (
    !asset &&
    options._parent &&
    (!config.strict || options._repeat)
  ) {
    options = (options._context || options._parent).$options
    assets = options[type]
    asset = assets[id] || assets[camelizedId] || assets[pascalizedId]
  }
  return asset
}

}).call(this,require('_process'))
},{"../config":22,"./index":71,"_process":1}],74:[function(require,module,exports){
var _ = require('./util')
var extend = _.extend

/**
 * The exposed Vue constructor.
 *
 * API conventions:
 * - public API methods/properties are prefiexed with `$`
 * - internal methods/properties are prefixed with `_`
 * - non-prefixed properties are assumed to be proxied user
 *   data.
 *
 * @constructor
 * @param {Object} [options]
 * @public
 */

function Vue (options) {
  this._init(options)
}

/**
 * Mixin global API
 */

extend(Vue, require('./api/global'))

/**
 * Vue and every constructor that extends Vue has an
 * associated options object, which can be accessed during
 * compilation steps as `this.constructor.options`.
 *
 * These can be seen as the default options of every
 * Vue instance.
 */

Vue.options = {
  replace: true,
  directives: require('./directives'),
  elementDirectives: require('./element-directives'),
  filters: require('./filters'),
  transitions: {},
  components: {},
  partials: {}
}

/**
 * Build up the prototype
 */

var p = Vue.prototype

/**
 * $data has a setter which does a bunch of
 * teardown/setup work
 */

Object.defineProperty(p, '$data', {
  get: function () {
    return this._data
  },
  set: function (newData) {
    if (newData !== this._data) {
      this._setData(newData)
    }
  }
})

/**
 * Mixin internal instance methods
 */

extend(p, require('./instance/init'))
extend(p, require('./instance/events'))
extend(p, require('./instance/scope'))
extend(p, require('./instance/compile'))
extend(p, require('./instance/misc'))

/**
 * Mixin public API methods
 */

extend(p, require('./api/data'))
extend(p, require('./api/dom'))
extend(p, require('./api/events'))
extend(p, require('./api/child'))
extend(p, require('./api/lifecycle'))

module.exports = _.Vue = Vue

},{"./api/child":10,"./api/data":11,"./api/dom":12,"./api/events":13,"./api/global":14,"./api/lifecycle":15,"./directives":31,"./element-directives":46,"./filters":49,"./instance/compile":50,"./instance/events":51,"./instance/init":52,"./instance/misc":53,"./instance/scope":54,"./util":71}],75:[function(require,module,exports){
(function (process){
var _ = require('./util')
var config = require('./config')
var Dep = require('./observer/dep')
var expParser = require('./parsers/expression')
var batcher = require('./batcher')
var uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 *
 * @param {Vue} vm
 * @param {String} expression
 * @param {Function} cb
 * @param {Object} options
 *                 - {Array} filters
 *                 - {Boolean} twoWay
 *                 - {Boolean} deep
 *                 - {Boolean} user
 *                 - {Boolean} sync
 *                 - {Boolean} lazy
 *                 - {Function} [preProcess]
 * @constructor
 */

function Watcher (vm, expOrFn, cb, options) {
  // mix in options
  if (options) {
    _.extend(this, options)
  }
  var isFn = typeof expOrFn === 'function'
  this.vm = vm
  vm._watchers.push(this)
  this.expression = isFn ? expOrFn.toString() : expOrFn
  this.cb = cb
  this.id = ++uid // uid for batching
  this.active = true
  this.dirty = this.lazy // for lazy watchers
  this.deps = Object.create(null)
  this.newDeps = null
  this.prevError = null // for async error stacks
  // parse expression for getter/setter
  if (isFn) {
    this.getter = expOrFn
    this.setter = undefined
  } else {
    var res = expParser.parse(expOrFn, this.twoWay)
    this.getter = res.get
    this.setter = res.set
  }
  this.value = this.lazy
    ? undefined
    : this.get()
  // state for avoiding false triggers for deep and Array
  // watchers during vm._digest()
  this.queued = this.shallow = false
}

/**
 * Add a dependency to this directive.
 *
 * @param {Dep} dep
 */

Watcher.prototype.addDep = function (dep) {
  var id = dep.id
  if (!this.newDeps[id]) {
    this.newDeps[id] = dep
    if (!this.deps[id]) {
      this.deps[id] = dep
      dep.addSub(this)
    }
  }
}

/**
 * Evaluate the getter, and re-collect dependencies.
 */

Watcher.prototype.get = function () {
  this.beforeGet()
  var vm = this.vm
  var value
  try {
    value = this.getter.call(vm, vm)
  } catch (e) {
    if (
      process.env.NODE_ENV !== 'production' &&
      config.warnExpressionErrors
    ) {
      _.warn(
        'Error when evaluating expression "' +
        this.expression + '". ' +
        (config.debug
          ? ''
          : 'Turn on debug mode to see stack trace.'
        ), e
      )
    }
  }
  // "touch" every property so they are all tracked as
  // dependencies for deep watching
  if (this.deep) {
    traverse(value)
  }
  if (this.preProcess) {
    value = this.preProcess(value)
  }
  if (this.filters) {
    value = vm._applyFilters(value, null, this.filters, false)
  }
  this.afterGet()
  return value
}

/**
 * Set the corresponding value with the setter.
 *
 * @param {*} value
 */

Watcher.prototype.set = function (value) {
  var vm = this.vm
  if (this.filters) {
    value = vm._applyFilters(
      value, this.value, this.filters, true)
  }
  try {
    this.setter.call(vm, vm, value)
  } catch (e) {
    if (
      process.env.NODE_ENV !== 'production' &&
      config.warnExpressionErrors
    ) {
      _.warn(
        'Error when evaluating setter "' +
        this.expression + '"', e
      )
    }
  }
}

/**
 * Prepare for dependency collection.
 */

Watcher.prototype.beforeGet = function () {
  Dep.target = this
  this.newDeps = Object.create(null)
}

/**
 * Clean up for dependency collection.
 */

Watcher.prototype.afterGet = function () {
  Dep.target = null
  var ids = Object.keys(this.deps)
  var i = ids.length
  while (i--) {
    var id = ids[i]
    if (!this.newDeps[id]) {
      this.deps[id].removeSub(this)
    }
  }
  this.deps = this.newDeps
}

/**
 * Subscriber interface.
 * Will be called when a dependency changes.
 *
 * @param {Boolean} shallow
 */

Watcher.prototype.update = function (shallow) {
  if (this.lazy) {
    this.dirty = true
  } else if (this.sync || !config.async) {
    this.run()
  } else {
    // if queued, only overwrite shallow with non-shallow,
    // but not the other way around.
    this.shallow = this.queued
      ? shallow
        ? this.shallow
        : false
      : !!shallow
    this.queued = true
    // record before-push error stack in debug mode
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.debug) {
      this.prevError = new Error('[vue] async stack trace')
    }
    batcher.push(this)
  }
}

/**
 * Batcher job interface.
 * Will be called by the batcher.
 */

Watcher.prototype.run = function () {
  if (this.active) {
    var value = this.get()
    if (
      value !== this.value ||
      // Deep watchers and Array watchers should fire even
      // when the value is the same, because the value may
      // have mutated; but only do so if this is a
      // non-shallow update (caused by a vm digest).
      ((_.isArray(value) || this.deep) && !this.shallow)
    ) {
      // set new value
      var oldValue = this.value
      this.value = value
      // in debug + async mode, when a watcher callbacks
      // throws, we also throw the saved before-push error
      // so the full cross-tick stack trace is available.
      var prevError = this.prevError
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' &&
          config.debug && prevError) {
        this.prevError = null
        try {
          this.cb.call(this.vm, value, oldValue)
        } catch (e) {
          _.nextTick(function () {
            throw prevError
          }, 0)
          throw e
        }
      } else {
        this.cb.call(this.vm, value, oldValue)
      }
    }
    this.queued = this.shallow = false
  }
}

/**
 * Evaluate the value of the watcher.
 * This only gets called for lazy watchers.
 */

Watcher.prototype.evaluate = function () {
  // avoid overwriting another watcher that is being
  // collected.
  var current = Dep.target
  this.value = this.get()
  this.dirty = false
  Dep.target = current
}

/**
 * Depend on all deps collected by this watcher.
 */

Watcher.prototype.depend = function () {
  var depIds = Object.keys(this.deps)
  var i = depIds.length
  while (i--) {
    this.deps[depIds[i]].depend()
  }
}

/**
 * Remove self from all dependencies' subcriber list.
 */

Watcher.prototype.teardown = function () {
  if (this.active) {
    // remove self from vm's watcher list
    // we can skip this if the vm if being destroyed
    // which can improve teardown performance.
    if (!this.vm._isBeingDestroyed) {
      this.vm._watchers.$remove(this)
    }
    var depIds = Object.keys(this.deps)
    var i = depIds.length
    while (i--) {
      this.deps[depIds[i]].removeSub(this)
    }
    this.active = false
    this.vm = this.cb = this.value = null
  }
}

/**
 * Recrusively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 *
 * @param {Object} obj
 */

function traverse (obj) {
  var key, val, i
  for (key in obj) {
    val = obj[key]
    if (_.isArray(val)) {
      i = val.length
      while (i--) traverse(val[i])
    } else if (_.isObject(val)) {
      traverse(val)
    }
  }
}

module.exports = Watcher

}).call(this,require('_process'))
},{"./batcher":16,"./config":22,"./observer/dep":56,"./parsers/expression":60,"./util":71,"_process":1}],76:[function(require,module,exports){
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */
if("undefined"==typeof jQuery)throw new Error("Froala requires jQuery");!function(a){"use strict";var b=function(c,d){return this.options=a.extend({},b.DEFAULTS,a(c).data(),"object"==typeof d&&d),this.options.unsupportedAgents.test(navigator.userAgent)?!1:(this.valid_nodes=a.merge([],b.VALID_NODES),this.valid_nodes=a.merge(this.valid_nodes,a.map(Object.keys(this.options.blockTags),function(a){return a.toUpperCase()})),this.browser=b.browser(),this.disabledList=[],this._id=++b.count,this._events={},this.blurred=!0,this.$original_element=a(c),this.document=c.ownerDocument,this.window="defaultView"in this.document?this.document.defaultView:this.document.parentWindow,this.$document=a(this.document),this.$window=a(this.window),this.br=this.browser.msie&&a.Editable.getIEversion()<=10?"":"<br/>",this.init(c),void a(c).on("editable.focus",a.proxy(function(){for(var b=1;b<=a.Editable.count;b++)b!=this._id&&this.$window.trigger("blur."+b)},this)))};b.initializers=[],b.count=0,b.VALID_NODES=["P","DIV","LI","TD","TH"],b.LANGS=[],b.INVISIBLE_SPACE="&#x200b;",b.DEFAULTS={allowComments:!0,allowScript:!1,allowStyle:!1,allowedAttrs:["accept","accept-charset","accesskey","action","align","alt","async","autocomplete","autofocus","autoplay","autosave","background","bgcolor","border","charset","cellpadding","cellspacing","checked","cite","class","color","cols","colspan","content","contenteditable","contextmenu","controls","coords","data","data-.*","datetime","default","defer","dir","dirname","disabled","download","draggable","dropzone","enctype","for","form","formaction","headers","height","hidden","high","href","hreflang","http-equiv","icon","id","ismap","itemprop","keytype","kind","label","lang","language","list","loop","low","max","maxlength","media","method","min","multiple","name","novalidate","open","optimum","pattern","ping","placeholder","poster","preload","pubdate","radiogroup","readonly","rel","required","reversed","rows","rowspan","sandbox","scope","scoped","scrolling","seamless","selected","shape","size","sizes","span","src","srcdoc","srclang","srcset","start","step","summary","spellcheck","style","tabindex","target","title","type","translate","usemap","value","valign","width","wrap"],allowedTags:["a","abbr","address","area","article","aside","audio","b","base","bdi","bdo","blockquote","br","button","canvas","caption","cite","code","col","colgroup","datalist","dd","del","details","dfn","dialog","div","dl","dt","em","embed","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hgroup","hr","i","iframe","img","input","ins","kbd","keygen","label","legend","li","link","main","map","mark","menu","menuitem","meter","nav","noscript","object","ol","optgroup","option","output","p","param","pre","progress","queue","rp","rt","ruby","s","samp","script","section","select","small","source","span","strike","strong","sub","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","title","tr","track","u","ul","var","video","wbr"],alwaysBlank:!1,alwaysVisible:!1,autosave:!1,autosaveInterval:1e4,beautifyCode:!0,blockTags:{n:"Normal",blockquote:"Quote",pre:"Code",h1:"Heading 1",h2:"Heading 2",h3:"Heading 3",h4:"Heading 4",h5:"Heading 5",h6:"Heading 6"},buttons:["bold","italic","underline","strikeThrough","fontSize","fontFamily","color","sep","formatBlock","blockStyle","align","insertOrderedList","insertUnorderedList","outdent","indent","sep","createLink","insertImage","insertVideo","insertHorizontalRule","undo","redo","html"],crossDomain:!0,convertMailAddresses:!0,customButtons:{},customDropdowns:{},customText:!1,defaultTag:"P",direction:"ltr",disableRightClick:!1,editInPopup:!1,editorClass:"",formatTags:["p","pre","blockquote","h1","h2","h3","h4","h5","h6","div","ul","ol","li","table","tbody","thead","tfoot","tr","th","td","body","head","html","title","meta","link","base","script","style"],headers:{},height:"auto",icons:{},inlineMode:!0,initOnClick:!1,fullPage:!1,language:"en_us",linkList:[],linkText:!1,linkClasses:{},linkAttributes:{},linkAutoPrefix:"",maxHeight:"auto",minHeight:"auto",multiLine:!0,noFollow:!0,paragraphy:!0,placeholder:"Type something",plainPaste:!1,preloaderSrc:"",saveURL:null,saveParam:"body",saveParams:{},saveRequestType:"POST",scrollableContainer:"body",simpleAmpersand:!1,shortcuts:!0,shortcutsAvailable:["show","bold","italic","underline","createLink","insertImage","indent","outdent","html","formatBlock n","formatBlock h1","formatBlock h2","formatBlock h3","formatBlock h4","formatBlock h5","formatBlock h6","formatBlock blockquote","formatBlock pre","strikeThrough"],showNextToCursor:!1,spellcheck:!1,theme:null,toolbarFixed:!0,trackScroll:!1,unlinkButton:!0,useClasses:!0,tabSpaces:!0,typingTimer:500,pastedImagesUploadRequestType:"POST",pastedImagesUploadURL:"http://i.froala.com/upload_base64",unsupportedAgents:/Opera Mini/i,useFrTag:!1,width:"auto",withCredentials:!1,zIndex:2e3},b.prototype.destroy=function(){this.sync(),this.options.useFrTag&&this.addFrTag(),this.hide(),this.isHTML&&this.html(),this.$bttn_wrapper&&this.$bttn_wrapper.html("").removeData().remove(),this.$editor&&this.$editor.html("").removeData().remove(),this.raiseEvent("destroy"),this.$popup_editor&&this.$popup_editor.html("").removeData().remove(),this.$placeholder&&this.$placeholder.html("").removeData().remove(),clearTimeout(this.ajaxInterval),clearTimeout(this.typingTimer),this.$element.off("mousedown mouseup click keydown keyup cut copy paste focus keypress touchstart touchend touch drop"),this.$element.off("mousedown mouseup click keydown keyup cut copy paste focus keypress touchstart touchend touch drop","**"),this.$window.off("mouseup."+this._id),this.$window.off("keydown."+this._id),this.$window.off("keyup."+this._id),this.$window.off("blur."+this._id),this.$window.off("hide."+this._id),this.$window.off("scroll."+this._id),this.$window.off("resize."+this._id),this.$window.off("orientationchange."+this._id),this.$document.off("selectionchange."+this._id),this.$original_element.off("editable"),void 0!==this.$upload_frame&&this.$upload_frame.remove(),this.$textarea&&(this.$box.remove(),this.$textarea.removeData("fa.editable"),this.$textarea.show());for(var a in this._events)delete this._events[a];this.$placeholder&&this.$placeholder.remove(),this.isLink?this.$element.removeData("fa.editable"):(this.$wrapper?this.$wrapper.replaceWith(this.getHTML(!1,!1)):this.$element.replaceWith(this.getHTML(!1,!1)),this.$box&&!this.editableDisabled&&(this.$box.removeClass("froala-box f-rtl"),this.$box.find(".html-switch").remove(),this.$box.removeData("fa.editable"),clearTimeout(this.typingTimer))),this.$lb&&this.$lb.remove()},b.prototype.triggerEvent=function(b,c,d,e){void 0===d&&(d=!0),void 0===e&&(e=!1),d===!0&&(this.isResizing()||this.editableDisabled||this.imageMode||!e||this.cleanify(),this.sync());var f=!0;return c||(c=[]),f=this.$original_element.triggerHandler("editable."+b,a.merge([this],c)),void 0===f?!0:f},b.prototype.syncStyle=function(){if(this.options.fullPage){var a=this.$element.html().match(/\[style[^\]]*\].*\[\/style\]/gi);if(this.$document.find("head style[data-id]").remove(),a)for(var b=0;b<a.length;b++)this.$document.find("head").append(a[b].replace(/\[/gi,"<").replace(/\]/gi,">"))}},b.prototype.sync=function(){if(!this.isHTML){this.raiseEvent("sync"),this.disableImageResize(),this.isLink||this.isImage||this.checkPlaceholder();var a=this.getHTML();this.trackHTML!==a&&null!=this.trackHTML?(this.refreshImageList(),this.refreshButtons(),this.trackHTML=a,this.$textarea&&this.$textarea.val(a),this.doingRedo||this.saveUndoStep(),this.triggerEvent("contentChanged",[],!1)):null==this.trackHTML&&(this.trackHTML=a),this.syncStyle()}},b.prototype.emptyElement=function(b){if("IMG"==b.tagName||a(b).find("img").length>0)return!1;if(a(b).find("input, iframe, object").length>0)return!1;for(var c=a(b).text(),d=0;d<c.length;d++)if("\n"!==c[d]&&"\r"!==c[d]&&"	"!==c[d]&&8203!=c[d].charCodeAt(0))return!1;return!0},b.prototype.initEvents=function(){this.mobile()?(this.mousedown="touchstart",this.mouseup="touchend",this.move="touchmove"):(this.mousedown="mousedown",this.mouseup="mouseup",this.move="")},b.prototype.initDisable=function(){this.$element.on("keypress keydown keyup",a.proxy(function(a){return this.isDisabled?(a.stopPropagation(),a.preventDefault(),!1):void 0},this))},b.prototype.continueInit=function(){this.initDisable(),this.initEvents(),this.browserFixes(),this.handleEnter(),this.editableDisabled||(this.initUndoRedo(),this.enableTyping(),this.initShortcuts()),this.initTabs(),this.initEditor();for(var b=0;b<a.Editable.initializers.length;b++)a.Editable.initializers[b].call(this);this.initOptions(),this.initEditorSelection(),this.initAjaxSaver(),this.setLanguage(),this.setCustomText(),this.editableDisabled||this.registerPaste(),this.refreshDisabledState(),this.refreshUndo(),this.refreshRedo(),this.initPopupSubmit(),this.initialized=!0,this.triggerEvent("initialized",[],!1,!1)},b.prototype.initPopupSubmit=function(){this.$popup_editor.find(".froala-popup input").keydown(function(b){var c=b.which;13==c&&(b.preventDefault(),b.stopPropagation(),a(this).blur(),a(this).parents(".froala-popup").find("button.f-submit").click())})},b.prototype.lateInit=function(){this.saveSelectionByMarkers(),this.continueInit(),this.restoreSelectionByMarkers(),this.$element.focus(),this.hideOtherEditors()},b.prototype.init=function(b){this.options.paragraphy||(this.options.defaultTag="DIV"),this.options.allowStyle&&this.setAllowStyle(),this.options.allowScript&&this.setAllowScript(),this.initElement(b),this.initElementStyle(),(!this.isLink||this.isImage)&&(this.initImageEvents(),this.buildImageMove()),this.options.initOnClick?(this.editableDisabled||(this.$element.attr("contenteditable",!0),this.$element.attr("spellcheck",!1)),this.$element.bind("mousedown.element focus.element",a.proxy(function(a){return this.isLink||a.stopPropagation(),this.isDisabled?!1:(this.$element.unbind("mousedown.element focus.element"),this.browser.webkit&&(this.initMouseUp=!1),void this.lateInit())},this))):this.continueInit()},b.prototype.phone=function(){var a=!1;return function(b){(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(b)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(b.substr(0,4)))&&(a=!0)}(navigator.userAgent||navigator.vendor||window.opera),a},b.prototype.mobile=function(){return this.phone()||this.android()||this.iOS()||this.blackberry()},b.prototype.iOS=function(){return/(iPad|iPhone|iPod)/g.test(navigator.userAgent)},b.prototype.iOSVersion=function(){if(/iP(hone|od|ad)/.test(navigator.platform)){var a=navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/),b=[parseInt(a[1],10),parseInt(a[2],10),parseInt(a[3]||0,10)];if(b&&b[0])return b[0]}return 0},b.prototype.iPad=function(){return/(iPad)/g.test(navigator.userAgent)},b.prototype.iPhone=function(){return/(iPhone)/g.test(navigator.userAgent)},b.prototype.iPod=function(){return/(iPod)/g.test(navigator.userAgent)},b.prototype.android=function(){return/(Android)/g.test(navigator.userAgent)},b.prototype.blackberry=function(){return/(Blackberry)/g.test(navigator.userAgent)},b.prototype.initOnTextarea=function(b){this.$textarea=a(b),void 0!==this.$textarea.attr("placeholder")&&"Type something"==this.options.placeholder&&(this.options.placeholder=this.$textarea.attr("placeholder")),this.$element=a("<div>").html(this.clean(this.$textarea.val(),!0,!1)),this.$element.find("pre br").replaceWith("\n"),this.$textarea.before(this.$element).hide(),this.$textarea.parents("form").bind("submit",a.proxy(function(){this.isHTML?this.html():this.sync()},this)),this.addListener("destroy",a.proxy(function(){this.$textarea.parents("form").unbind("submit")},this))},b.prototype.initOnLink=function(b){this.isLink=!0,this.options.linkText=!0,this.selectionDisabled=!0,this.editableDisabled=!0,this.options.buttons=[],this.$element=a(b),this.options.paragraphy=!1,this.options.countCharacters=!1,this.$box=this.$element},b.prototype.initOnImage=function(b){var c=a(b).css("float");"A"==a(b).parent().get(0).tagName&&(b=a(b).parent()),this.isImage=!0,this.editableDisabled=!0,this.imageList=[],this.options.buttons=[],this.options.paragraphy=!1,this.options.imageMargin="auto",a(b).wrap("<div>"),this.$element=a(b).parent(),this.$element.css("display","inline-block"),this.$element.css("max-width","100%"),this.$element.css("margin-left","auto"),this.$element.css("margin-right","auto"),this.$element.css("float",c),this.$element.addClass("f-image"),this.$box=a(b)},b.prototype.initForPopup=function(b){this.$element=a(b),this.$box=this.$element,this.editableDisabled=!0,this.options.countCharacters=!1,this.options.buttons=[],this.$element.on("click",a.proxy(function(a){a.preventDefault()},this))},b.prototype.initOnDefault=function(b){"DIV"!=b.tagName&&this.options.buttons.indexOf("formatBlock")>=0&&this.disabledList.push("formatBlock"),this.$element=a(b)},b.prototype.initElement=function(b){if("TEXTAREA"==b.tagName?this.initOnTextarea(b):"A"==b.tagName?this.initOnLink(b):"IMG"==b.tagName?this.initOnImage(b):this.options.editInPopup?this.initForPopup(b):this.initOnDefault(b),!this.editableDisabled){this.$box=this.$element.addClass("froala-box"),this.$wrapper=a('<div class="froala-wrapper">'),this.$element=a("<div>");var c=this.$box.html();this.$box.html(this.$wrapper.html(this.$element)),this.$element.on("keyup",a.proxy(function(){this.$element.find("ul, ol").length>1&&this.cleanupLists()},this)),this.setHTML(c,!0)}this.$element.on("drop",a.proxy(function(){setTimeout(a.proxy(function(){a("html").click(),this.$element.find(".f-img-wrap").each(function(b,c){0===a(c).find("img").length&&a(c).remove()}),this.$element.find(this.options.defaultTag+":empty").remove()},this),1)},this))},b.prototype.trim=function(a){return a=String(a).replace(/^\s+|\s+$/g,""),a=a.replace(/\u200B/gi,"")},b.prototype.unwrapText=function(){this.options.paragraphy||this.$element.find(this.options.defaultTag).each(a.proxy(function(b,c){if(0===c.attributes.length){var d=a(c).find("br:last");a(c).replaceWith(d.length&&this.isLastSibling(d.get(0))?a(c).html():a(c).html()+"<br/>")}},this))},b.prototype.wrapTextInElement=function(b,c){void 0===c&&(c=!1);var d=[],e=["SPAN","A","B","I","EM","U","S","STRONG","STRIKE","FONT","IMG","SUB","SUP","BUTTON","INPUT"],f=this;this.no_verify=!0;var g=function(){if(0===d.length)return!1;var b=a("<"+f.options.defaultTag+">"),c=a(d[0]);if(1==d.length&&"f-marker"==c.attr("class"))return void(d=[]);for(var e=0;e<d.length;e++){var g=a(d[e]);b.append(g.clone()),e==d.length-1?g.replaceWith(b):g.remove()}d=[]},h=!1,i=!1,j=!1;b.contents().filter(function(){var b=a(this);if(b.hasClass("f-marker")||b.find(".f-marker").length){var k=b;if(1==b.find(".f-marker").length||b.hasClass("f-marker")){k=b.find(".f-marker").length?a(b.find(".f-marker")[0]):b;var l=k.prev();"true"===k.attr("data-type")?l.length&&a(l[0]).hasClass("f-marker")?j=!0:(h=!0,i=!1):i=!0}else j=!0}this.nodeType==Node.TEXT_NODE&&b.text().length>0||e.indexOf(this.tagName)>=0?d.push(this):this.nodeType==Node.TEXT_NODE&&0===b.text().length&&f.options.beautifyCode?b.remove():h||c||j?("BR"===this.tagName&&(d.length>0?b.remove():d.push(this)),g(),i&&(h=!1),j=!1):d=[]}),(h||c||j)&&g(),b.find("> "+this.options.defaultTag).each(function(b,c){0===a(c).text().trim().length&&0===a(c).find("img").length&&0===a(c).find("br").length&&a(c).append(this.br)}),b.find("div:empty:not([class])").remove(),b.is(":empty")&&b.append(f.options.paragraphy===!0?"<"+this.options.defaultTag+">"+this.br+"</"+this.options.defaultTag+">":this.br),this.no_verify=!1},b.prototype.wrapText=function(b){if(this.isImage||this.isLink)return!1;this.allow_div=!0,this.removeBlankSpans();for(var c=this.getSelectionElements(),d=0;d<c.length;d++){var e=a(c[d]);["LI","TH","TD"].indexOf(e.get(0).tagName)>=0?this.wrapTextInElement(e,!0):this.parents(e,"li").length?this.wrapTextInElement(a(this.parents(e,"li")[0]),b):this.wrapTextInElement(this.$element,b)}this.allow_div=!1},b.prototype.convertNewLines=function(){this.$element.find("pre").each(function(b,c){var d=a(c),e=a(c).html();e.indexOf("\n")>=0&&d.html(e.replace(/\n/g,"<br>"))})},b.prototype.setHTML=function(b,c){this.no_verify=!0,this.allow_div=!0,void 0===c&&(c=!0),b=this.clean(b,!0,!1),b=b.replace(/>\s+</g,"><"),this.$element.html(b),this.cleanAttrs(this.$element.get(0)),this.convertNewLines(),this.imageList=[],this.refreshImageList(),this.options.paragraphy&&this.wrapText(!0),this.$element.find("li:empty").append(a.Editable.INVISIBLE_SPACE),this.cleanupLists(),this.cleanify(!1,!0,!1),c&&(this.restoreSelectionByMarkers(),this.sync()),this.$element.find("span").attr("data-fr-verified",!0),this.initialized&&(this.hide(),this.closeImageMode(),this.imageMode=!1),this.no_verify=!1,this.allow_div=!1},b.prototype.beforePaste=function(){this.saveSelectionByMarkers(),this.clipboardHTML=null,this.scrollPosition=this.$window.scrollTop(),this.$pasteDiv?this.$pasteDiv.html(""):(this.$pasteDiv=a('<div contenteditable="true" style="position: fixed; top: 0; left: -9999px; height: 100%; width: 0; z-index: 4000; line-height: 140%;" tabindex="-1"></div>'),this.$box.after(this.$pasteDiv)),this.$pasteDiv.focus(),this.window.setTimeout(a.proxy(this.processPaste,this),1)},b.prototype.processPaste=function(){var c=this.clipboardHTML;null===this.clipboardHTML&&(c=this.$pasteDiv.html(),this.restoreSelectionByMarkers(),this.$window.scrollTop(this.scrollPosition));var d,e=this.triggerEvent("onPaste",[c],!1);"string"==typeof e&&(c=e),c=c.replace(/<img /gi,'<img data-fr-image-pasted="true" '),c.match(/(class=\"?Mso|style=\"[^\"]*\bmso\-|w:WordDocument)/gi)?(d=this.wordClean(c),d=this.clean(a("<div>").append(d).html(),!1,!0),d=this.removeEmptyTags(d)):(d=this.clean(c,!1,!0),d=this.removeEmptyTags(d),b.copiedText&&a("<div>").html(d).text().replace(/\u00A0/gi," ")==b.copiedText.replace(/(\u00A0|\r|\n)/gi," ")&&(d=b.copiedHTML)),this.options.plainPaste&&(d=this.plainPasteClean(d)),e=this.triggerEvent("afterPasteCleanup",[d],!1),"string"==typeof e&&(d=e),""!==d&&(this.insertHTML(d,!0,!0),this.saveSelectionByMarkers(),this.removeBlankSpans(),this.$element.find(this.valid_nodes.join(":empty, ")+":empty").remove(),this.restoreSelectionByMarkers(),this.$element.find("li[data-indent]").each(a.proxy(function(b,c){this.indentLi?(a(c).removeAttr("data-indent"),this.indentLi(a(c))):a(c).removeAttr("data-indent")},this)),this.$element.find("li").each(a.proxy(function(b,c){this.wrapTextInElement(a(c),!0)},this)),this.options.paragraphy&&this.wrapText(!0),this.cleanupLists()),this.afterPaste()},b.prototype.afterPaste=function(){this.uploadPastedImages(),this.checkPlaceholder(),this.pasting=!1,this.triggerEvent("afterPaste",[],!0,!1)},b.prototype.getSelectedHTML=function(){function b(b,d){for(;3==d.nodeType||c.valid_nodes.indexOf(d.tagName)<0;)3!=d.nodeType&&a(b).wrapInner("<"+d.tagName+c.attrs(d)+"></"+d.tagName+">"),d=d.parentNode}var c=this,d="";if("undefined"!=typeof window.getSelection)for(var e=this.getRanges(),f=0;f<e.length;f++){var g=document.createElement("div");g.appendChild(e[f].cloneContents()),b(g,this.getSelectionParent()),d+=g.innerHTML}else"undefined"!=typeof document.selection&&"Text"==document.selection.type&&(d=document.selection.createRange().htmlText);return d},b.prototype.registerPaste=function(){this.$element.on("copy cut",a.proxy(function(){this.isHTML||(b.copiedHTML=this.getSelectedHTML(),b.copiedText=a("<div>").html(b.copiedHTML).text())},this)),this.$element.on("paste",a.proxy(function(b){if(!this.isHTML){if(b.originalEvent&&(b=b.originalEvent),!this.triggerEvent("beforePaste",[],!1))return!1;if(this.clipboardPaste(b))return!1;this.clipboardHTML="",this.pasting=!0,this.scrollPosition=this.$window.scrollTop();var c=!1;if(b&&b.clipboardData&&b.clipboardData.getData){var d="",e=b.clipboardData.types;if(a.Editable.isArray(e))for(var f=0;f<e.length;f++)d+=e[f]+";";else d=e;if(/text\/html/.test(d)?this.clipboardHTML=b.clipboardData.getData("text/html"):/text\/rtf/.test(d)&&this.browser.safari?this.clipboardHTML=b.clipboardData.getData("text/rtf"):/text\/plain/.test(d)&&!this.browser.mozilla&&(this.clipboardHTML=this.escapeEntities(b.clipboardData.getData("text/plain")).replace(/\n/g,"<br/>")),""!==this.clipboardHTML?c=!0:this.clipboardHTML=null,c)return this.processPaste(),b.preventDefault&&(b.stopPropagation(),b.preventDefault()),!1}this.beforePaste()}},this))},b.prototype.clipboardPaste=function(b){if(b&&b.clipboardData&&b.clipboardData.items&&b.clipboardData.items[0]){var c=b.clipboardData.items[0].getAsFile();if(c){var d=new FileReader;return d.onload=a.proxy(function(a){var b=a.target.result;this.insertHTML('<img data-fr-image-pasted="true" src="'+b+'" />'),this.afterPaste()},this),d.readAsDataURL(c),!0}}return!1},b.prototype.uploadPastedImages=function(){this.options.pasteImage?this.options.imageUpload&&this.$element.find("img[data-fr-image-pasted]").each(a.proxy(function(b,c){if(0===c.src.indexOf("data:")){if(this.options.defaultImageWidth&&a(c).attr("width",this.options.defaultImageWidth),this.options.pastedImagesUploadURL){if(!this.triggerEvent("beforeUploadPastedImage",[c],!1))return!1;setTimeout(a.proxy(function(){this.showImageLoader(),this.$progress_bar.find("span").css("width","100%").text("Please wait!"),this.showByCoordinates(a(c).offset().left+a(c).width()/2,a(c).offset().top+a(c).height()+10),this.isDisabled=!0},this),10),a.ajax({type:this.options.pastedImagesUploadRequestType,url:this.options.pastedImagesUploadURL,data:a.extend({image:decodeURIComponent(c.src)},this.options.imageUploadParams),crossDomain:this.options.crossDomain,xhrFields:{withCredentials:this.options.withCredentials},headers:this.options.headers,dataType:"json"}).done(a.proxy(function(b){try{if(b.link){var d=new Image;d.onerror=a.proxy(function(){a(c).remove(),this.hide(),this.throwImageError(1)},this),d.onload=a.proxy(function(){c.src=b.link,this.hideImageLoader(),this.hide(),this.enable(),setTimeout(function(){a(c).trigger("touchend")},50),this.triggerEvent("afterUploadPastedImage",[a(c)])},this),d.src=b.link}else b.error?(a(c).remove(),this.hide(),this.throwImageErrorWithMessage(b.error)):(a(c).remove(),this.hide(),this.throwImageError(2))}catch(e){a(c).remove(),this.hide(),this.throwImageError(4)}},this)).fail(a.proxy(function(){a(c).remove(),this.hide(),this.throwImageError(3)},this))}}else 0!==c.src.indexOf("http")&&a(c).remove();a(c).removeAttr("data-fr-image-pasted")},this)):this.$element.find("img[data-fr-image-pasted]").remove()},b.prototype.disable=function(){this.isDisabled=!0,this.$element.blur(),this.$box.addClass("fr-disabled"),this.$element.attr("contenteditable",!1)},b.prototype.enable=function(){this.isDisabled=!1,this.$box.removeClass("fr-disabled"),this.$element.attr("contenteditable",!0)},b.prototype.wordClean=function(a){a.indexOf("<body")>=0&&(a=a.replace(/[.\s\S\w\W<>]*<body[^>]*>([.\s\S\w\W<>]*)<\/body>[.\s\S\w\W<>]*/g,"$1")),a=a.replace(/<p(.*?)class="?'?MsoListParagraph"?'? ([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<ul><li>$3</li></ul>"),a=a.replace(/<p(.*?)class="?'?NumberedText"?'? ([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<ol><li>$3</li></ol>"),a=a.replace(/<p(.*?)class="?'?MsoListParagraphCxSpFirst"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<ul><li$3>$5</li>"),a=a.replace(/<p(.*?)class="?'?NumberedTextCxSpFirst"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<ol><li$3>$5</li>"),a=a.replace(/<p(.*?)class="?'?MsoListParagraphCxSpMiddle"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<li$3>$5</li>"),a=a.replace(/<p(.*?)class="?'?NumberedTextCxSpMiddle"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<li$3>$5</li>"),a=a.replace(/<p(.*?)class="?'?MsoListParagraphCxSpLast"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<li$3>$5</li></ul>"),a=a.replace(/<p(.*?)class="?'?NumberedTextCxSpLast"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<li$3>$5</li></ol>"),a=a.replace(/<span([^<]*?)style="?'?mso-list:Ignore"?'?([\s\S]*?)>([\s\S]*?)<span/gi,"<span><span"),a=a.replace(/<!--\[if \!supportLists\]-->([\s\S]*?)<!--\[endif\]-->/gi,""),a=a.replace(/<!\[if \!supportLists\]>([\s\S]*?)<!\[endif\]>/gi,""),a=a.replace(/(\n|\r| class=(")?Mso[a-zA-Z0-9]+(")?)/gi," "),a=a.replace(/<!--[\s\S]*?-->/gi,""),a=a.replace(/<(\/)*(meta|link|span|\\?xml:|st1:|o:|font)(.*?)>/gi,"");for(var b=["style","script","applet","embed","noframes","noscript"],c=0;c<b.length;c++){var d=new RegExp("<"+b[c]+".*?"+b[c]+"(.*?)>","gi");a=a.replace(d,"")}a=a.replace(/&nbsp;/gi," ");var e;do e=a,a=a.replace(/<[^\/>][^>]*><\/[^>]+>/gi,"");while(a!=e);return a=a.replace(/<lilevel([^1])([^>]*)>/gi,'<li data-indent="true"$2>'),a=a.replace(/<lilevel1([^>]*)>/gi,"<li$1>"),a=this.clean(a),a=a.replace(/<a>(.[^<]+)<\/a>/gi,"$1")},b.prototype.tabs=function(a){for(var b="",c=0;a>c;c++)b+="  ";return b},b.prototype.cleanTags=function(a,b){void 0===b&&(b=!1);var c,d,e,f,g=[],h=[],i=!1,j=!1,k=this.options.formatTags;for(d=0;d<a.length;d++)if(c=a.charAt(d),"<"==c){var l=a.indexOf(">",d+1);if(-1!==l){var m=a.substring(d,l+1),n=this.tagName(m);if(0===n.indexOf("!--")&&(l=a.indexOf("-->",d+1),-1!==l)){m=a.substring(d,l+3),h.push(m),d=l+2;continue}if(0===n.indexOf("!")&&h.length&&h[h.length-1]!=m){h.push(m),d=l;continue}if("head"==n&&this.options.fullPage&&(j=!0),j){h.push(m),d=l,"head"==n&&this.isClosingTag(m)&&(j=!1);continue}if(this.options.allowedTags.indexOf(n)<0&&(!this.options.fullPage||["html","head","body","!doctype"].indexOf(n)<0)){d=l;continue}var o=this.isClosingTag(m);if("pre"===n&&(i=o?!1:!0),this.isSelfClosingTag(m))h.push("br"===n&&i?"\n":m);else if(o)for(e=!1,f=!0;e===!1&&void 0!==f;)f=g.pop(),void 0!==f&&f.tag_name!==n?h.splice(f.i,1):(e=!0,void 0!==f&&h.push(m));else h.push(m),g.push({tag_name:n,i:h.length-1});d=l}}else"\n"===c&&this.options.beautifyCode?b&&i?h.push("<br/>"):i?h.push(c):g.length>0&&h.push(" "):9!=c.charCodeAt(0)&&h.push(c);for(;g.length>0;)f=g.pop(),h.splice(f.i,1);var p="\n";this.options.beautifyCode||(p=""),a="",g=0;var q=!0;for(d=0;d<h.length;d++)1==h[d].length?q&&" "===h[d]||(a+=h[d],q=!1):k.indexOf(this.tagName(h[d]).toLowerCase())<0?(a+=h[d],"br"==this.tagName(h[d])&&(a+=p)):this.isSelfClosingTag(h[d])?k.indexOf(this.tagName(h[d]).toLowerCase())>=0?(a+=this.tabs(g)+h[d]+p,q=!1):a+=h[d]:this.isClosingTag(h[d])?(g-=1,0===g&&(q=!0),a.length>0&&a[a.length-1]==p&&(a+=this.tabs(g)),a+=h[d]+p):(a+=p+this.tabs(g)+h[d],g+=1,q=!1);return a[0]==p&&(a=a.substring(1,a.length)),a[a.length-1]==p&&(a=a.substring(0,a.length-1)),a},b.prototype.cleanupLists=function(){this.$element.find("ul, ol").each(a.proxy(function(b,c){var d=a(c);if(this.parents(a(c),"ul, ol").length>0)return!0;if(d.find(".close-ul, .open-ul, .close-ol, .open-ol, .open-li, .close-li").length>0){var e="<"+c.tagName.toLowerCase()+">"+d.html()+"</"+c.tagName.toLowerCase()+">";e=e.replace(new RegExp('<span class="close-ul" data-fr-verified="true"></span>',"g"),"</ul>"),e=e.replace(new RegExp('<span class="open-ul" data-fr-verified="true"></span>',"g"),"<ul>"),e=e.replace(new RegExp('<span class="close-ol" data-fr-verified="true"></span>',"g"),"</ol>"),e=e.replace(new RegExp('<span class="open-ol" data-fr-verified="true"></span>',"g"),"<ol>"),e=e.replace(new RegExp('<span class="close-li" data-fr-verified="true"></span>',"g"),"</li>"),e=e.replace(new RegExp('<span class="open-li" data-fr-verified="true"></span>',"g"),"<li>"),e=e.replace(new RegExp("<li></li>","g"),""),d.replaceWith(e)}},this)),this.$element.find("li > td").remove(),this.$element.find("li td:empty").append(a.Editable.INVISIBLE_SPACE),this.$element.find(" > li").wrap("<ul>"),this.$element.find("ul, ol").each(a.proxy(function(b,c){var d=a(c);0===d.find(this.valid_nodes.join(",")).length&&d.remove()},this)),this.$element.find("li > ul, li > ol").each(a.proxy(function(b,c){var d=a(c).parent().get(0).previousSibling;this.isFirstSibling(c)&&(d&&"LI"==d.tagName?a(d).append(a(c)):a(c).before("<br/>"))},this)),this.$element.find("li:empty").remove();for(var b=this.$element.find("ol + ol, ul + ul"),c=0;c<b.length;c++){var d=a(b[c]);this.attrs(b[c])==this.attrs(d.prev().get(0))&&(d.prev().append(d.html()),d.remove())}this.$element.find("li > td").remove(),this.$element.find("li td:empty").append(a.Editable.INVISIBLE_SPACE),this.$element.find("li > "+this.options.defaultTag).each(function(b,c){0===c.attributes.length&&a(c).replaceWith(a(c).html())})},b.prototype.escapeEntities=function(a){return a.replace(/</gi,"&lt;").replace(/>/gi,"&gt;").replace(/"/gi,"&quot;").replace(/'/gi,"&apos;")},b.prototype.cleanNodeAttrs=function(a,b){var c=a.attributes;if(c)for(var d=new RegExp("^"+b.join("$|^")+"$","i"),e=0;e<c.length;e++){var f=c[e];d.test(f.nodeName)?a.setAttribute(f.nodeName,f.nodeValue.replace(/</gi,"&lt;").replace(/>/gi,"&gt;")):a.removeAttribute(f.nodeName)}},b.prototype.cleanAttrs=function(a){1==a.nodeType&&a.className.indexOf("f-marker")<0&&a!==this.$element.get(0)&&"IFRAME"!=a.tagName&&this.cleanNodeAttrs(a,this.options.allowedAttrs,!0);for(var b=a.childNodes,c=0;c<b.length;c++)this.cleanAttrs(b[c])},b.prototype.clean=function(c,d,e,f,g){this.pasting&&b.copiedText===a("<div>").html(c).text()&&(e=!1,d=!0),g||(g=a.merge([],this.options.allowedAttrs)),f||(f=a.merge([],this.options.allowedTags)),d||g.indexOf("id")>-1&&g.splice(g.indexOf("id"),1),this.options.fullPage&&(c=c.replace(/<!DOCTYPE([^>]*?)>/i,"<!-- DOCTYPE$1 -->"),c=c.replace(/<html([^>]*?)>/i,"<!-- html$1 -->"),c=c.replace(/<\/html([^>]*?)>/i,"<!-- /html$1 -->"),c=c.replace(/<body([^>]*?)>/i,"<!-- body$1 -->"),c=c.replace(/<\/body([^>]*?)>/i,"<!-- /body$1 -->"),c=c.replace(/<head>([\w\W]*)<\/head>/i,function(a,b){var c=1;return b=b.replace(/(<style)/gi,function(a,b){return b+" data-id="+c++}),"<!-- head "+b.replace(/(>)([\s|\t]*)(<)/gi,"$1$3").replace(/</gi,"[").replace(/>/gi,"]")+" -->"})),this.options.allowComments?(this.options.allowedTags.push("!--"),this.options.allowedTags.push("!")):c=c.replace(/(<!--[.\s\w\W]*?-->)/gi,""),this.options.allowScript||(c=c.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,"")),this.options.allowStyle||(c=c.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,"")),c=c.replace(/<!--([.\s\w\W]*?)-->/gi,function(a,b){return"<!--"+b.replace(/</g,"[[").replace(/>/g,"]]")+"-->"
});var h=new RegExp("<\\/?((?!(?:"+f.join(" |")+" |"+f.join(">|")+">|"+f.join("/>|")+"/>))\\w+)[^>]*?>","gi");if(c=c.replace(h,""),c=c.replace(/<!--([.\s\w\W]*?)-->/gi,function(a,b){return"<!--"+b.replace(/\[\[/g,"<").replace(/\]\]/g,">")+"-->"}),e){var i=new RegExp("style=(\"[a-zA-Z0-9:;\\.\\s\\(\\)\\-\\,!\\/'%]*\"|'[a-zA-Z0-9:;\\.\\s\\(\\)\\-\\,!\\/\"%]*')","gi");c=c.replace(i,""),c=c.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,"")}c=this.cleanTags(c,!0),c=c.replace(/(\r|\n)/gi,"");var j=new RegExp("<([^>]*)( src| href)=('[^']*'|\"[^\"]*\"|[^\\s>]+)([^>]*)>","gi");if(c=c.replace(j,a.proxy(function(a,b,c,d,e){return"<"+b+c+'="'+this.sanitizeURL(d.replace(/^["'](.*)["']\/?$/gi,"$1"))+'"'+e+">"},this)),!d){var k=a("<div>").append(c);k.find('[class]:not([class^="fr-"])').each(function(b,c){a(c).removeAttr("class")}),c=k.html()}return c},b.prototype.removeBlankSpans=function(){this.no_verify=!0,this.$element.find("span").removeAttr("data-fr-verified"),this.$element.find("span").each(a.proxy(function(b,c){0===this.attrs(c).length&&a(c).replaceWith(a(c).html())},this)),this.$element.find("span").attr("data-fr-verified",!0),this.no_verify=!1},b.prototype.plainPasteClean=function(b){var c=a("<div>").html(b);c.find("p, div, h1, h2, h3, h4, h5, h6, pre, blockquote").each(a.proxy(function(b,c){a(c).replaceWith("<"+this.options.defaultTag+">"+a(c).html()+"</"+this.options.defaultTag+">")},this)),a(c.find("*").not("p, div, h1, h2, h3, h4, h5, h6, pre, blockquote, ul, ol, li, table, tbody, thead, tr, td, br").get().reverse()).each(function(){a(this).replaceWith(a(this).html())});var d=function(b){for(var c=b.contents(),e=0;e<c.length;e++)3!=c[e].nodeType&&1!=c[e].nodeType?a(c[e]).remove():d(a(c[e]))};return d(c),c.html()},b.prototype.removeEmptyTags=function(b){for(var c,d=a("<div>").html(b),e=d.find("*:empty:not(br, img, td, th)");e.length;){for(c=0;c<e.length;c++)a(e[c]).remove();e=d.find("*:empty:not(br, img, td, th)")}for(var f=d.find("> div, td > div, th > div, li > div");f.length;){var g=a(f[f.length-1]);g.replaceWith(g.html()+"<br/>"),f=d.find("> div, td > div, th > div, li > div")}for(f=d.find("div");f.length;){for(c=0;c<f.length;c++){var h=a(f[c]),i=h.html().replace(/\u0009/gi,"").trim();h.replaceWith(i)}f=d.find("div")}return d.html()},b.prototype.initElementStyle=function(){this.editableDisabled||this.$element.attr("contenteditable",!0);var a="froala-view froala-element "+this.options.editorClass;this.browser.msie&&b.getIEversion()<9&&(a+=" ie8"),this.$element.css("outline",0),this.browser.msie||(a+=" not-msie"),this.$element.addClass(a)},b.prototype.CJKclean=function(a){var b=/[\u3041-\u3096\u30A0-\u30FF\u4E00-\u9FFF\u3130-\u318F\uAC00-\uD7AF]/gi;return a.replace(b,"")},b.prototype.enableTyping=function(){this.typingTimer=null,this.$element.on("keydown","textarea, input",function(a){a.stopPropagation()}),this.$element.on("keydown cut",a.proxy(function(b){if(!this.isHTML){if(!this.options.multiLine&&13==b.which)return b.preventDefault(),b.stopPropagation(),!1;if("keydown"===b.type&&!this.triggerEvent("keydown",[b],!1))return!1;clearTimeout(this.typingTimer),this.ajaxSave=!1,this.oldHTML=this.getHTML(!0,!1),this.typingTimer=setTimeout(a.proxy(function(){var a=this.getHTML(!0,!1);this.ime||this.CJKclean(a)===this.CJKclean(this.oldHTML)||this.CJKclean(a)!==a||this.sync()},this),Math.max(this.options.typingTimer,500))}},this))},b.prototype.removeMarkersByRegex=function(a){return a.replace(/<span[^>]*? class\s*=\s*["']?f-marker["']?[^>]+>([\S\s][^\/])*<\/span>/gi,"")},b.prototype.getImageHTML=function(){return JSON.stringify({src:this.$element.find("img").attr("src"),style:this.$element.find("img").attr("style"),alt:this.$element.find("img").attr("alt"),width:this.$element.find("img").attr("width"),link:this.$element.find("a").attr("href"),link_title:this.$element.find("a").attr("title"),link_target:this.$element.find("a").attr("target")})},b.prototype.getLinkHTML=function(){return JSON.stringify({body:this.$element.html(),href:this.$element.attr("href"),title:this.$element.attr("title"),popout:this.$element.hasClass("popout"),nofollow:"nofollow"==this.$element.attr("ref"),blank:"_blank"==this.$element.attr("target"),cls:this.$element.attr("class")?this.$element.attr("class").replace(/froala-element ?|not-msie ?|froala-view ?/gi,"").trim():""})},b.prototype.addFrTag=function(){this.$element.find(this.valid_nodes.join(",")+", table, ul, ol, img").addClass("fr-tag")},b.prototype.removeFrTag=function(){this.$element.find(this.valid_nodes.join(",")+", table, ul, ol, img").removeClass("fr-tag")},b.prototype.getHTML=function(b,c,d){if(void 0===b&&(b=!1),void 0===c&&(c=this.options.useFrTag),void 0===d&&(d=!0),this.$element.hasClass("f-placeholder")&&!b)return"";if(this.isHTML)return this.$html_area.val();if(this.isImage)return this.getImageHTML();if(this.isLink)return this.getLinkHTML();this.$element.find("a").data("fr-link",!0),c&&this.addFrTag(),this.$element.find(".f-img-editor > img").each(a.proxy(function(b,c){a(c).removeClass("fr-fin fr-fil fr-fir fr-dib fr-dii").addClass(this.getImageClass(a(c).parent().attr("class")))},this)),this.options.useClasses||this.$element.find("img").each(a.proxy(function(b,c){var d=a(c);d.attr("data-style",this.getImageStyle(d))},this)),this.$element.find("pre").each(a.proxy(function(b,c){var d=a(c),e=d.html(),f=e.replace(/\&nbsp;/gi," ").replace(/\n/gi,"<br>");e!=f&&(this.saveSelectionByMarkers(),d.html(f),this.restoreSelectionByMarkers())},this)),this.$element.find("pre br").addClass("fr-br"),this.$element.find('[class=""]').removeAttr("class"),this.cleanAttrs(this.$element.get(0));var e=this.$element.html();this.removeFrTag(),this.$element.find("pre br").removeAttr("class"),e=e.replace(/<a[^>]*?><\/a>/g,""),b||(e=this.removeMarkersByRegex(e)),e=e.replace(/<span[^>]*? class\s*=\s*["']?f-img-handle[^>]+><\/span>/gi,""),e=e.replace(/^([\S\s]*)<span[^>]*? class\s*=\s*["']?f-img-editor[^>]+>([\S\s]*)<\/span>([\S\s]*)$/gi,"$1$2$3"),e=e.replace(/^([\S\s]*)<span[^>]*? class\s*=\s*["']?f-img-wrap[^>]+>([\S\s]*)<\/span>([\S\s]*)$/gi,"$1$2$3"),this.options.useClasses||(e=e.replace(/data-style/gi,"style"),e=e.replace(/(<img[^>]*)( class\s*=['"]?[a-zA-Z0-9- ]+['"]?)([^>]*\/?>)/gi,"$1$3")),this.options.simpleAmpersand&&(e=e.replace(/\&amp;/gi,"&")),d&&(e=e.replace(/ data-fr-verified="true"/gi,"")),this.options.beautifyCode&&(e=e.replace(/\n/gi,"")),e=e.replace(/<br class="fr-br">/gi,"\n"),e=e.replace(/\u200B/gi,""),this.options.fullPage&&(e=e.replace(/<!-- DOCTYPE([^>]*?) -->/i,"<!DOCTYPE$1>"),e=e.replace(/<!-- html([^>]*?) -->/i,"<html$1>"),e=e.replace(/<!-- \/html([^>]*?) -->/i,"</html$1>"),e=e.replace(/<!-- body([^>]*?) -->/i,"<body$1>"),e=e.replace(/<!-- \/body([^>]*?) -->/i,"</body$1>"),e=e.replace(/<!-- head ([\w\W]*?) -->/i,function(a,b){return"<head>"+b.replace(/\[/gi,"<").replace(/\]/gi,">")+"</head>"}));var f=this.triggerEvent("getHTML",[e],!1);return"string"==typeof f?f:e},b.prototype.getText=function(){return this.$element.text()},b.prototype.setDirty=function(a){this.dirty=a,a||(clearTimeout(this.ajaxInterval),this.ajaxHTML=this.getHTML(!1,!1))},b.prototype.initAjaxSaver=function(){this.ajaxHTML=this.getHTML(!1,!1),this.ajaxSave=!0,this.ajaxInterval=setInterval(a.proxy(function(){var a=this.getHTML(!1,!1);(this.ajaxHTML!=a||this.dirty)&&this.ajaxSave&&(this.options.autosave&&this.save(),this.dirty=!1,this.ajaxHTML=a),this.ajaxSave=!0},this),Math.max(this.options.autosaveInterval,100))},b.prototype.disableBrowserUndo=function(){this.$element.keydown(a.proxy(function(a){var b=a.which,c=(a.ctrlKey||a.metaKey)&&!a.altKey;if(!this.isHTML&&c){if(90==b&&a.shiftKey)return a.preventDefault(),!1;if(90==b)return a.preventDefault(),!1}},this))},b.prototype.shortcutEnabled=function(a){return this.options.shortcutsAvailable.indexOf(a)>=0},b.prototype.shortcuts_map={69:{cmd:"show",params:[null],id:"show"},66:{cmd:"exec",params:["bold"],id:"bold"},73:{cmd:"exec",params:["italic"],id:"italic"},85:{cmd:"exec",params:["underline"],id:"underline"},83:{cmd:"exec",params:["strikeThrough"],id:"strikeThrough"},75:{cmd:"exec",params:["createLink"],id:"createLink"},80:{cmd:"exec",params:["insertImage"],id:"insertImage"},221:{cmd:"exec",params:["indent"],id:"indent"},219:{cmd:"exec",params:["outdent"],id:"outdent"},72:{cmd:"exec",params:["html"],id:"html"},48:{cmd:"exec",params:["formatBlock","n"],id:"formatBlock n"},49:{cmd:"exec",params:["formatBlock","h1"],id:"formatBlock h1"},50:{cmd:"exec",params:["formatBlock","h2"],id:"formatBlock h2"},51:{cmd:"exec",params:["formatBlock","h3"],id:"formatBlock h3"},52:{cmd:"exec",params:["formatBlock","h4"],id:"formatBlock h4"},53:{cmd:"exec",params:["formatBlock","h5"],id:"formatBlock h5"},54:{cmd:"exec",params:["formatBlock","h6"],id:"formatBlock h6"},222:{cmd:"exec",params:["formatBlock","blockquote"],id:"formatBlock blockquote"},220:{cmd:"exec",params:["formatBlock","pre"],id:"formatBlock pre"}},b.prototype.ctrlKey=function(a){if(-1!=navigator.userAgent.indexOf("Mac OS X")){if(a.metaKey&&!a.altKey)return!0}else if(a.ctrlKey&&!a.altKey)return!0;return!1},b.prototype.initShortcuts=function(){this.options.shortcuts&&this.$element.on("keydown",a.proxy(function(a){var b=a.which,c=this.ctrlKey(a);if(!this.isHTML&&c){if(this.shortcuts_map[b]&&this.shortcutEnabled(this.shortcuts_map[b].id))return this.execDefaultShortcut(this.shortcuts_map[b].cmd,this.shortcuts_map[b].params);if(90==b&&a.shiftKey)return a.preventDefault(),a.stopPropagation(),this.redo(),!1;if(90==b)return a.preventDefault(),a.stopPropagation(),this.undo(),!1}},this))},b.prototype.initTabs=function(){this.$element.on("keydown",a.proxy(function(a){var b=a.which;if(9!=b||a.shiftKey)9==b&&a.shiftKey&&(this.raiseEvent("shift+tab")?this.options.tabSpaces?a.preventDefault():this.blur():a.preventDefault());else if(this.raiseEvent("tab"))if(this.options.tabSpaces){a.preventDefault();var c="&nbsp;&nbsp;&nbsp;&nbsp;",d=this.getSelectionElements()[0];"PRE"===d.tagName&&(c="    "),this.insertHTML(c,!1)}else this.blur();else a.preventDefault()},this))},b.prototype.textEmpty=function(b){var c=a(b).text().replace(/(\r\n|\n|\r|\t)/gm,"");return(""===c||b===this.$element.get(0))&&0===a(b).find("br").length},b.prototype.inEditor=function(a){for(;a&&"BODY"!==a.tagName;){if(a===this.$element.get(0))return!0;a=a.parentNode}return!1},b.prototype.focus=function(b){if(this.isDisabled)return!1;if(void 0===b&&(b=!0),""!==this.text()&&!this.$element.is(":focus"))return void(this.browser.msie||(this.clearSelection(),this.$element.focus()));if(!this.isHTML){if(b&&!this.pasting&&this.$element.focus(),this.pasting&&!this.$element.is(":focus")&&this.$element.focus(),this.$element.hasClass("f-placeholder"))return void this.setSelection(this.$element.find(this.options.defaultTag).length>0?this.$element.find(this.options.defaultTag)[0]:this.$element.get(0));var c=this.getRange();if(""===this.text()&&c&&(0===c.startOffset||c.startContainer===this.$element.get(0)||!this.inEditor(c.startContainer))){var d,e,f=this.getSelectionElements();if(a.merge(["IMG","BR"],this.valid_nodes).indexOf(this.getSelectionElement().tagName)<0)return!1;if(c.startOffset>0&&this.valid_nodes.indexOf(this.getSelectionElement().tagName)>=0&&"BODY"!=c.startContainer.tagName||c.startContainer&&3===c.startContainer.nodeType)return;if(!this.options.paragraphy&&f.length>=1&&f[0]===this.$element.get(0)){var g=function(b){if(!b)return null;if(3==b.nodeType&&b.textContent.length>0)return b;if(1==b.nodeType&&"BR"==b.tagName)return b;for(var c=a(b).contents(),d=0;d<c.length;d++){var e=g(c[d]);if(null!=e)return e}return null};if(0===c.startOffset&&this.$element.contents().length>0&&3!=this.$element.contents()[0].nodeType){var h=g(this.$element.get(0));null!=h&&("BR"==h.tagName?this.$element.is(":focus")&&(a(h).before(this.markers_html),this.restoreSelectionByMarkers()):this.setSelection(h))}return!1}if(f.length>=1&&f[0]!==this.$element.get(0))for(d=0;d<f.length;d++){if(e=f[d],!this.textEmpty(e)||this.browser.msie)return void this.setSelection(e);if(this.textEmpty(e)&&["LI","TD"].indexOf(e.tagName)>=0)return}if(c.startContainer===this.$element.get(0)&&c.startOffset>0&&!this.options.paragraphy)return void this.setSelection(this.$element.get(0),c.startOffset);for(f=this.$element.find(this.valid_nodes.join(",")),d=0;d<f.length;d++)if(e=f[d],!this.textEmpty(e)&&0===a(e).find(this.valid_nodes.join(",")).length)return void this.setSelection(e);this.setSelection(this.$element.get(0))}}},b.prototype.addMarkersAtEnd=function(b){if(b.find(".fr-marker").length>0)return!1;for(var c=b.get(0),d=a(c).contents();d.length&&this.valid_nodes.indexOf(d[d.length-1].tagName)>=0;)c=d[d.length-1],d=a(d[d.length-1]).contents();a(c).append(this.markers_html)},b.prototype.setFocusAtEnd=function(a){void 0===a&&(a=this.$element),this.addMarkersAtEnd(a),this.restoreSelectionByMarkers()},b.prototype.breakHTML=function(b,c){"undefined"==typeof c&&(c=!0),this.removeMarkers(),0===this.$element.find("break").length&&this.insertSimpleHTML("<break></break>");var d=this.parents(this.$element.find("break"),a.merge(["UL","OL"],this.valid_nodes).join(","))[0];if(this.parents(a(d),"ul, ol").length&&(d=this.parents(a(d),"ul, ol")[0]),void 0===d&&(d=this.$element.get(0)),["UL","OL"].indexOf(d.tagName)>=0){var e=a("<div>").html(b);e.find("> li").wrap("<"+d.tagName+">"),b=e.html()}if(d==this.$element.get(0)){if(this.$element.find("break").next().length){this.insertSimpleHTML('<div id="inserted-div">'+b+"</div>");var f=this.$element.find("div#inserted-div");this.setFocusAtEnd(f),this.saveSelectionByMarkers(),f.replaceWith(f.contents()),this.restoreSelectionByMarkers()}else this.insertSimpleHTML(b),this.setFocusAtEnd();return this.$element.find("break").remove(),this.checkPlaceholder(),!0}if("TD"===d.tagName)return this.$element.find("break").remove(),this.insertSimpleHTML(b),!0;var g=a("<div>").html(b);if(this.addMarkersAtEnd(g),b=g.html(),this.emptyElement(a(d)))return a(d).replaceWith(b),this.restoreSelectionByMarkers(),this.checkPlaceholder(),!0;this.$element.find("li").each(a.proxy(function(b,c){this.emptyElement(c)&&a(c).addClass("empty-li")},this));for(var h,i,j=a("<div></div>").append(a(d).clone()).html(),k=[],l={},m=[],n=0,o=0;o<j.length;o++)if(i=j.charAt(o),"<"==i){var p=j.indexOf(">",o+1);if(-1!==p){h=j.substring(o,p+1);var q=this.tagName(h);if(o=p,"break"==q){if(!this.isClosingTag(h)){for(var r=!0,s=[],t=k.length-1;t>=0;t--){var u=this.tagName(k[t]);if(!c&&"LI"==u.toUpperCase()){r=!1;break}m.push("</"+u+">"),s.push(k[t])}m.push(b),r||m.push("</li><li>");for(var v=0;v<s.length;v++)m.push(s[v])}}else if(m.push(h),!this.isSelfClosingTag(h))if(this.isClosingTag(h)){var w=l[q].pop();k.splice(w,1)}else k.push(h),void 0===l[q]&&(l[q]=[]),l[q].push(k.length-1)}}else n++,m.push(i);a(d).replaceWith(m.join("")),this.$element.find("li").each(a.proxy(function(b,c){var d=a(c);d.hasClass("empty-li")?d.removeClass("empty-li"):this.emptyElement(c)&&d.remove()},this)),this.cleanupLists(),this.restoreSelectionByMarkers()},b.prototype.insertSimpleHTML=function(a){var b,c;if(this.no_verify=!0,this.window.getSelection){if(b=this.window.getSelection(),b.getRangeAt&&b.rangeCount){c=b.getRangeAt(0),this.browser.webkit?c.collapsed||this.document.execCommand("delete"):c.deleteContents(),this.$element.find(this.valid_nodes.join(":empty, ")+":empty").remove();var d=this.document.createElement("div");d.innerHTML=a;for(var e,f,g=this.document.createDocumentFragment();e=d.firstChild;)f=g.appendChild(e);c.insertNode(g),f&&(c=c.cloneRange(),c.setStartAfter(f),c.collapse(!0),b.removeAllRanges(),b.addRange(c))}}else if((b=this.document.selection)&&"Control"!=b.type){var h=b.createRange();h.collapse(!0),b.createRange().pasteHTML(a)}this.no_verify=!1},b.prototype.insertHTML=function(b,c,d){if(void 0===c&&(c=!0),void 0===d&&(d=!1),!this.isHTML&&c&&this.focus(),this.removeMarkers(),this.insertSimpleHTML("<break></break>"),this.checkPlaceholder(!0),this.$element.hasClass("f-placeholder"))return this.$element.html(b),this.options.paragraphy&&this.wrapText(!0),this.$element.find("p > br").each(function(){var b=this.parentNode;1==a(b).contents().length&&a(b).remove()}),this.$element.find("break").remove(),this.setFocusAtEnd(),this.checkPlaceholder(),this.convertNewLines(),!1;for(var e=a("<div>").append(b).find("*"),f=0;f<e.length;f++)if(this.valid_nodes.indexOf(e[f].tagName)>=0)return this.breakHTML(b),this.$element.find("break").remove(),this.convertNewLines(),!1;this.$element.find("break").remove(),this.insertSimpleHTML(b),this.convertNewLines()},b.prototype.execDefaultShortcut=function(a,b){return this[a].apply(this,b),!1},b.prototype.initEditor=function(){var c="froala-editor";this.mobile()&&(c+=" touch"),this.browser.msie&&b.getIEversion()<9&&(c+=" ie8"),this.$editor=a('<div class="'+c+'" style="display: none;">');var d=this.$document.find(this.options.scrollableContainer);d.append(this.$editor),this.options.inlineMode?this.initInlineEditor():this.initBasicEditor()},b.prototype.refreshToolbarPosition=function(){this.$window.scrollTop()>this.$box.offset().top&&this.$window.scrollTop()<this.$box.offset().top+this.$box.outerHeight()-this.$editor.outerHeight()?(this.$element.css("padding-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$placeholder.css("margin-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$editor.addClass("f-scroll").removeClass("f-scroll-abs").css("bottom","").css("left",this.$box.offset().left+parseFloat(this.$box.css("padding-left"),10)-this.$window.scrollLeft()).width(this.$box.width()-parseFloat(this.$editor.css("border-left-width"),10)-parseFloat(this.$editor.css("border-right-width"),10)),this.iOS()&&(this.$element.is(":focus")?this.$editor.css("top",this.$window.scrollTop()):this.$editor.css("top",""))):this.$window.scrollTop()<this.$box.offset().top?this.iOS()&&this.$element.is(":focus")?(this.$element.css("padding-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$placeholder.css("margin-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$editor.addClass("f-scroll").removeClass("f-scroll-abs").css("bottom","").css("left",this.$box.offset().left+parseFloat(this.$box.css("padding-left"),10)-this.$window.scrollLeft()).width(this.$box.width()-parseFloat(this.$editor.css("border-left-width"),10)-parseFloat(this.$editor.css("border-right-width"),10)),this.$editor.css("top",this.$box.offset().top)):(this.$editor.removeClass("f-scroll f-scroll-abs").css("bottom","").css("top","").width(""),this.$element.css("padding-top",""),this.$placeholder.css("margin-top","")):this.$window.scrollTop()>this.$box.offset().top+this.$box.outerHeight()-this.$editor.outerHeight()&&!this.$editor.hasClass("f-scroll-abs")?(this.$element.css("padding-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$placeholder.css("margin-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$editor.removeClass("f-scroll").addClass("f-scroll-abs"),this.$editor.css("bottom",0).css("top","").css("left","")):this.$editor.removeClass("f-scroll").css("bottom","").css("top","").css("left","").width("")},b.prototype.toolbarTop=function(){this.options.toolbarFixed||this.options.inlineMode||(this.$element.data("padding-top",parseInt(this.$element.css("padding-top"),10)),this.$window.on("scroll resize load",a.proxy(function(){this.refreshToolbarPosition()},this)),this.iOS()&&this.$element.on("focus blur",a.proxy(function(){this.refreshToolbarPosition()},this)))},b.prototype.initBasicEditor=function(){this.$element.addClass("f-basic"),this.$wrapper.addClass("f-basic"),this.$popup_editor=this.$editor.clone();var a=this.$document.find(this.options.scrollableContainer);this.$popup_editor.appendTo(a).addClass("f-inline"),this.$editor.addClass("f-basic").show(),this.$editor.insertBefore(this.$wrapper),this.toolbarTop()},b.prototype.initInlineEditor=function(){this.$editor.addClass("f-inline"),this.$element.addClass("f-inline"),this.$popup_editor=this.$editor},b.prototype.initDrag=function(){this.drag_support={filereader:"undefined"!=typeof FileReader,formdata:!!this.window.FormData,progress:"upload"in new XMLHttpRequest}},b.prototype.initOptions=function(){this.setDimensions(),this.setSpellcheck(),this.setImageUploadURL(),this.setButtons(),this.setDirection(),this.setZIndex(),this.setTheme(),this.options.editInPopup&&this.buildEditPopup(),this.editableDisabled||(this.setPlaceholder(),this.setPlaceholderEvents())},b.prototype.setAllowStyle=function(a){"undefined"==typeof a&&(a=this.options.allowStyle),a?this.options.allowedTags.push("style"):this.options.allowedTags.splice(this.options.allowedTags.indexOf("style"),1)},b.prototype.setAllowScript=function(a){"undefined"==typeof a&&(a=this.options.allowScript),a?this.options.allowedTags.push("script"):this.options.allowedTags.splice(this.options.allowedTags.indexOf("script"),1)},b.prototype.isTouch=function(){return WYSIWYGModernizr.touch&&void 0!==this.window.Touch},b.prototype.initEditorSelection=function(){this.$element.on("keyup",a.proxy(function(a){return this.triggerEvent("keyup",[a],!1)},this)),this.$element.on("focus",a.proxy(function(){this.blurred&&(this.blurred=!1,this.pasting||""!==this.text()||this.focus(!1),this.triggerEvent("focus",[],!1))},this)),this.$element.on("mousedown touchstart",a.proxy(function(){return this.isDisabled?!1:void(this.isResizing()||(this.closeImageMode(),this.hide()))},this)),this.options.disableRightClick&&this.$element.contextmenu(a.proxy(function(a){return a.preventDefault(),this.options.inlineMode&&this.$element.focus(),!1},this)),this.$element.on(this.mouseup,a.proxy(function(b){if(this.isDisabled)return!1;if(!this.isResizing()){var c=this.text();b.stopPropagation(),this.imageMode=!1,!(""!==c||this.options.alwaysVisible||this.options.editInPopup||(3==b.which||2==b.button)&&this.options.inlineMode&&!this.isImage&&this.options.disableRightClick)||this.link||this.imageMode?this.options.inlineMode||this.refreshButtons():setTimeout(a.proxy(function(){c=this.text(),!(""!==c||this.options.alwaysVisible||this.options.editInPopup||(3==b.which||2==b.button)&&this.options.inlineMode&&!this.isImage&&this.options.disableRightClick)||this.link||this.imageMode||(this.show(b),this.options.editInPopup&&this.showEditPopup())},this),0)}this.hideDropdowns(),this.hideOtherEditors()},this)),this.$editor.on(this.mouseup,a.proxy(function(a){return this.isDisabled?!1:void(this.isResizing()||(a.stopPropagation(),this.options.inlineMode===!1&&this.hide()))},this)),this.$editor.on("mousedown",".fr-dropdown-menu",a.proxy(function(a){return this.isDisabled?!1:(a.stopPropagation(),void(this.noHide=!0))},this)),this.$popup_editor.on("mousedown",".fr-dropdown-menu",a.proxy(function(a){return this.isDisabled?!1:(a.stopPropagation(),void(this.noHide=!0))},this)),this.$popup_editor.on("mouseup",a.proxy(function(a){return this.isDisabled?!1:void(this.isResizing()||a.stopPropagation())},this)),this.$edit_popup_wrapper&&this.$edit_popup_wrapper.on("mouseup",a.proxy(function(a){return this.isDisabled?!1:void(this.isResizing()||a.stopPropagation())},this)),this.setDocumentSelectionChangeEvent(),this.setWindowMouseUpEvent(),this.setWindowKeyDownEvent(),this.setWindowKeyUpEvent(),this.setWindowOrientationChangeEvent(),this.setWindowHideEvent(),this.setWindowBlurEvent(),this.options.trackScroll&&this.setWindowScrollEvent(),this.setWindowResize()},b.prototype.setWindowResize=function(){this.$window.on("resize."+this._id,a.proxy(function(){this.hide(),this.closeImageMode(),this.imageMode=!1},this))},b.prototype.blur=function(b){this.blurred||this.pasting||(this.selectionDisabled=!0,this.triggerEvent("blur",[]),b&&0===a("*:focus").length&&this.clearSelection(),this.isLink||this.isImage||(this.selectionDisabled=!1),this.blurred=!0)},b.prototype.setWindowBlurEvent=function(){this.$window.on("blur."+this._id,a.proxy(function(a,b){this.blur(b)},this))},b.prototype.setWindowHideEvent=function(){this.$window.on("hide."+this._id,a.proxy(function(){this.isResizing()?this.$element.find(".f-img-handle").trigger("moveend"):this.hide(!1)},this))},b.prototype.setWindowOrientationChangeEvent=function(){this.$window.on("orientationchange."+this._id,a.proxy(function(){setTimeout(a.proxy(function(){this.hide()},this),10)},this))},b.prototype.setDocumentSelectionChangeEvent=function(){this.$document.on("selectionchange."+this._id,a.proxy(function(b){return this.isDisabled?!1:void(this.isResizing()||this.isScrolling||(clearTimeout(this.selectionChangedTimeout),this.selectionChangedTimeout=setTimeout(a.proxy(function(){if(this.options.inlineMode&&this.selectionInEditor()&&this.link!==!0&&this.isTouch()){var a=this.text();""!==a?(this.iPod()?this.options.alwaysVisible&&this.hide():this.show(null),b.stopPropagation()):this.options.alwaysVisible?this.show(null):(this.hide(),this.closeImageMode(),this.imageMode=!1)}},this),75)))},this))},b.prototype.setWindowMouseUpEvent=function(){this.$window.on(this.mouseup+"."+this._id,a.proxy(function(){return this.browser.webkit&&!this.initMouseUp?(this.initMouseUp=!0,!1):(this.isResizing()||this.isScrolling||this.isDisabled||(this.$bttn_wrapper.find("button.fr-trigger").removeClass("active"),this.selectionInEditor()&&""!==this.text()&&!this.isTouch()?this.show(null):this.$popup_editor.is(":visible")&&(this.hide(),this.closeImageMode(),this.imageMode=!1),this.blur(!0)),void a("[data-down]").removeAttr("data-down"))},this))},b.prototype.setWindowKeyDownEvent=function(){this.$window.on("keydown."+this._id,a.proxy(function(b){var c=b.which;if(27==c&&(this.focus(),this.restoreSelection(),this.hide(),this.closeImageMode(),this.imageMode=!1),this.imageMode){if(13==c)return this.$element.find(".f-img-editor").parents(".f-img-wrap").before("<br/>"),this.sync(),this.$element.find(".f-img-editor img").click(),!1;if(46==c||8==c)return b.stopPropagation(),b.preventDefault(),setTimeout(a.proxy(function(){this.removeImage(this.$element.find(".f-img-editor img"))},this),0),!1}else if(this.selectionInEditor()){if(this.isDisabled)return!0;var d=(b.ctrlKey||b.metaKey)&&!b.altKey;!d&&this.$popup_editor.is(":visible")&&this.$bttn_wrapper.is(":visible")&&this.options.inlineMode&&(this.hide(),this.closeImageMode(),this.imageMode=!1)}},this))},b.prototype.setWindowKeyUpEvent=function(){this.$window.on("keyup."+this._id,a.proxy(function(){return this.isDisabled?!1:void(this.selectionInEditor()&&""!==this.text()&&!this.$popup_editor.is(":visible")&&this.repositionEditor())},this))},b.prototype.setWindowScrollEvent=function(){a.merge(this.$window,a(this.options.scrollableContainer)).on("scroll."+this._id,a.proxy(function(){return this.isDisabled?!1:(clearTimeout(this.scrollTimer),this.isScrolling=!0,void(this.scrollTimer=setTimeout(a.proxy(function(){this.isScrolling=!1},this),2500)))},this))},b.prototype.setPlaceholder=function(b){b&&(this.options.placeholder=b),this.$textarea&&this.$textarea.attr("placeholder",this.options.placeholder),this.$placeholder||(this.$placeholder=a('<span class="fr-placeholder" unselectable="on"></span>').bind("click",a.proxy(function(){this.focus()},this)),this.$element.after(this.$placeholder)),this.$placeholder.text(this.options.placeholder)},b.prototype.isEmpty=function(){var b=this.$element.text().replace(/(\r\n|\n|\r|\t|\u200B|\u0020)/gm,"");return""===b&&0===this.$element.find("img, table, iframe, input, textarea, hr, li, object").length&&0===this.$element.find(this.options.defaultTag+" > br, br").length&&0===this.$element.find(a.map(this.valid_nodes,a.proxy(function(a){return this.options.defaultTag==a?null:a},this)).join(", ")).length},b.prototype.checkPlaceholder=function(c){if(this.isDisabled&&!c)return!1;if(this.pasting&&!c)return!1;if(this.$element.find("td:empty, th:empty").append(a.Editable.INVISIBLE_SPACE),this.$element.find(this.valid_nodes.join(":empty, ")+":empty").append(this.br),!this.isHTML)if(this.isEmpty()&&!this.fakeEmpty()){var d,e=this.selectionInEditor()||this.$element.is(":focus");this.options.paragraphy?(d=a("<"+this.options.defaultTag+">"+this.br+"</"+this.options.defaultTag+">"),this.$element.html(d),e&&this.setSelection(d.get(0)),this.$element.addClass("f-placeholder")):(0!==this.$element.find("br").length||this.browser.msie&&b.getIEversion()<=10||(this.$element.append(this.br),e&&this.browser.msie&&this.focus()),this.$element.addClass("f-placeholder"))}else!this.$element.find(this.options.defaultTag+", li, td, th").length&&this.options.paragraphy?(this.wrapText(!0),this.$element.find(this.options.defaultTag).length&&""===this.text()?this.setSelection(this.$element.find(this.options.defaultTag)[0],this.$element.find(this.options.defaultTag).text().length,null,this.$element.find(this.options.defaultTag).text().length):this.$element.removeClass("f-placeholder")):this.fakeEmpty()===!1&&(!this.options.paragraphy||this.$element.find(this.valid_nodes.join(",")).length>=1)?this.$element.removeClass("f-placeholder"):!this.options.paragraphy&&this.$element.find(this.valid_nodes.join(",")).length>=1?this.$element.removeClass("f-placeholder"):this.$element.addClass("f-placeholder");return!0},b.prototype.fakeEmpty=function(a){void 0===a&&(a=this.$element);var b=!0;this.options.paragraphy&&(b=1==a.find(this.options.defaultTag).length?!0:!1);var c=a.text().replace(/(\r\n|\n|\r|\t|\u200B)/gm,"");return""===c&&b&&1==a.find("br, li").length&&0===a.find("img, table, iframe, input, textarea, hr, li").length},b.prototype.setPlaceholderEvents=function(){this.browser.msie&&b.getIEversion()<9||(this.$element.on("focus click",a.proxy(function(a){return this.isDisabled?!1:void(""!==this.$element.text()||this.pasting||(this.$element.data("focused")||"click"!==a.type?"focus"==a.type&&this.focus(!1):this.$element.focus(),this.$element.data("focused",!0)))},this)),this.$element.on("keyup keydown input focus placeholderCheck",a.proxy(function(){return this.checkPlaceholder()},this)),this.$element.trigger("placeholderCheck"))},b.prototype.setDimensions=function(a,b,c,d){a&&(this.options.height=a),b&&(this.options.width=b),c&&(this.options.minHeight=c),d&&(this.options.maxHeight=d),"auto"!=this.options.height&&(this.$wrapper.css("height",this.options.height),this.$element.css("minHeight",this.options.height-parseInt(this.$element.css("padding-top"),10)-parseInt(this.$element.css("padding-bottom"),10))),"auto"!=this.options.minHeight&&(this.$wrapper.css("minHeight",this.options.minHeight),this.$element.css("minHeight",this.options.minHeight)),"auto"!=this.options.maxHeight&&this.$wrapper.css("maxHeight",this.options.maxHeight),"auto"!=this.options.width&&this.$box.css("width",this.options.width)},b.prototype.setDirection=function(a){a&&(this.options.direction=a),"ltr"!=this.options.direction&&"rtl"!=this.options.direction&&(this.options.direction="ltr"),"rtl"==this.options.direction?(this.$element.removeAttr("dir"),this.$box.addClass("f-rtl"),this.$element.addClass("f-rtl"),this.$editor.addClass("f-rtl"),this.$popup_editor.addClass("f-rtl"),this.$image_modal&&this.$image_modal.addClass("f-rtl")):(this.$element.attr("dir","auto"),this.$box.removeClass("f-rtl"),this.$element.removeClass("f-rtl"),this.$editor.removeClass("f-rtl"),this.$popup_editor.removeClass("f-rtl"),this.$image_modal&&this.$image_modal.removeClass("f-rtl"))},b.prototype.setZIndex=function(a){a&&(this.options.zIndex=a),this.$editor.css("z-index",this.options.zIndex),this.$popup_editor.css("z-index",this.options.zIndex+1),this.$overlay&&this.$overlay.css("z-index",this.options.zIndex+1002),this.$image_modal&&this.$image_modal.css("z-index",this.options.zIndex+1003)},b.prototype.setTheme=function(a){a&&(this.options.theme=a),null!=this.options.theme&&(this.$editor.addClass(this.options.theme+"-theme"),this.$popup_editor.addClass(this.options.theme+"-theme"),this.$box&&this.$box.addClass(this.options.theme+"-theme"),this.$image_modal&&this.$image_modal.addClass(this.options.theme+"-theme"))},b.prototype.setSpellcheck=function(a){void 0!==a&&(this.options.spellcheck=a),this.$element.attr("spellcheck",this.options.spellcheck)
},b.prototype.customizeText=function(b){if(b){var c=this.$editor.find("[title]").add(this.$popup_editor.find("[title]"));this.$image_modal&&(c=c.add(this.$image_modal.find("[title]"))),c.each(a.proxy(function(c,d){for(var e in b)a(d).attr("title").toLowerCase()==e.toLowerCase()&&a(d).attr("title",b[e])},this)),c=this.$editor.find('[data-text="true"]').add(this.$popup_editor.find('[data-text="true"]')),this.$image_modal&&(c=c.add(this.$image_modal.find('[data-text="true"]'))),c.each(a.proxy(function(c,d){for(var e in b)a(d).text().toLowerCase()==e.toLowerCase()&&a(d).text(b[e])},this))}},b.prototype.setLanguage=function(b){void 0!==b&&(this.options.language=b),a.Editable.LANGS[this.options.language]&&(this.customizeText(a.Editable.LANGS[this.options.language].translation),a.Editable.LANGS[this.options.language].direction&&a.Editable.LANGS[this.options.language].direction!=a.Editable.DEFAULTS.direction&&this.setDirection(a.Editable.LANGS[this.options.language].direction),a.Editable.LANGS[this.options.language].translation[this.options.placeholder]&&this.setPlaceholder(a.Editable.LANGS[this.options.language].translation[this.options.placeholder]))},b.prototype.setCustomText=function(a){a&&(this.options.customText=a),this.options.customText&&this.customizeText(this.options.customText)},b.prototype.execHTML=function(){this.html()},b.prototype.initHTMLArea=function(){this.$html_area=a('<textarea wrap="hard">').keydown(function(b){var c=b.keyCode||b.which;if(9==c){b.preventDefault();var d=a(this).get(0).selectionStart,e=a(this).get(0).selectionEnd;a(this).val(a(this).val().substring(0,d)+"	"+a(this).val().substring(e)),a(this).get(0).selectionStart=a(this).get(0).selectionEnd=d+1}}).focus(a.proxy(function(){this.blurred&&(this.blurred=!1,this.triggerEvent("focus",[],!1))},this)).mouseup(a.proxy(function(){this.blurred&&(this.blurred=!1,this.triggerEvent("focus",[],!1))},this))},b.prototype.command_dispatcher={align:function(a){var b=this.buildDropdownAlign(a),c=this.buildDropdownButton(a,b);return c},formatBlock:function(a){var b=this.buildDropdownFormatBlock(a),c=this.buildDropdownButton(a,b);return c},html:function(b){var c=this.buildDefaultButton(b);return this.options.inlineMode&&this.$box.append(a(c).clone(!0).addClass("html-switch").attr("title","Hide HTML").click(a.proxy(this.execHTML,this))),this.initHTMLArea(),c}},b.prototype.setButtons=function(a){a&&(this.options.buttons=a),this.$editor.append('<div class="bttn-wrapper" id="bttn-wrapper-'+this._id+'">'),this.$bttn_wrapper=this.$editor.find("#bttn-wrapper-"+this._id),this.mobile()&&this.$bttn_wrapper.addClass("touch");for(var c,d,e="",f=0;f<this.options.buttons.length;f++){var g=this.options.buttons[f];if("sep"!=g){var h=b.commands[g];if(void 0!==h){h.cmd=g;var i=this.command_dispatcher[h.cmd];i?e+=i.apply(this,[h]):h.seed?(c=this.buildDefaultDropdown(h),d=this.buildDropdownButton(h,c),e+=d):(d=this.buildDefaultButton(h),e+=d,this.bindRefreshListener(h))}else{if(h=this.options.customButtons[g],void 0===h){if(h=this.options.customDropdowns[g],void 0===h)continue;d=this.buildCustomDropdown(h,g),e+=d,this.bindRefreshListener(h);continue}d=this.buildCustomButton(h,g),e+=d,this.bindRefreshListener(h)}}else e+=this.options.inlineMode?'<div class="f-clear"></div><hr/>':'<span class="f-sep"></span>'}this.$bttn_wrapper.html(e),this.$bttn_wrapper.find('button[data-cmd="undo"], button[data-cmd="redo"]').prop("disabled",!0),this.bindButtonEvents()},b.prototype.bindRefreshListener=function(b){b.refresh&&this.addListener("refresh",a.proxy(function(){b.refresh.apply(this,[b.cmd])},this))},b.prototype.buildDefaultButton=function(a){var b='<button tabIndex="-1" type="button" class="fr-bttn" title="'+a.title+'" data-cmd="'+a.cmd+'">';return b+=void 0===this.options.icons[a.cmd]?this.addButtonIcon(a):this.prepareIcon(this.options.icons[a.cmd],a.title),b+="</button>"},b.prototype.prepareIcon=function(a,b){switch(a.type){case"font":return this.addButtonIcon({icon:a.value});case"img":return this.addButtonIcon({icon_img:a.value,title:b});case"txt":return this.addButtonIcon({icon_txt:a.value})}},b.prototype.addButtonIcon=function(a){return a.icon?'<i class="'+a.icon+'"></i>':a.icon_alt?'<i class="for-text">'+a.icon_alt+"</i>":a.icon_img?'<img src="'+a.icon_img+'" alt="'+a.title+'"/>':a.icon_txt?"<i>"+a.icon_txt+"</i>":a.title},b.prototype.buildCustomButton=function(a,b){this["call_"+b]=a.callback;var c='<button tabIndex="-1" type="button" class="fr-bttn" data-callback="call_'+b+'" data-cmd="button_name" data-name="'+b+'" title="'+a.title+'">'+this.prepareIcon(a.icon,a.title)+"</button>";return c},b.prototype.callDropdown=function(b,c){this.$bttn_wrapper.on("click touch",'[data-name="'+b+'"]',a.proxy(function(a){a.preventDefault(),a.stopPropagation(),c.apply(this)},this))},b.prototype.buildCustomDropdown=function(a,b){var c='<div class="fr-bttn fr-dropdown">';c+='<button tabIndex="-1" type="button" class="fr-trigger" title="'+a.title+'" data-name="'+b+'">'+this.prepareIcon(a.icon,a.title)+"</button>",c+='<ul class="fr-dropdown-menu">';var d=0;for(var e in a.options){this["call_"+b+d]=a.options[e];var f='<li data-callback="call_'+b+d+'" data-cmd="'+b+d+'" data-name="'+b+d+'"><a href="#">'+e+"</a></li>";c+=f,d++}return c+="</ul></div>"},b.prototype.buildDropdownButton=function(a,b,c){c=c||"";var d='<div class="fr-bttn fr-dropdown '+c+'">',e="";e+=void 0===this.options.icons[a.cmd]?this.addButtonIcon(a):this.prepareIcon(this.options.icons[a.cmd],a.title);var f='<button tabIndex="-1" type="button" data-name="'+a.cmd+'" class="fr-trigger" title="'+a.title+'">'+e+"</button>";return d+=f,d+=b,d+="</div>"},b.prototype.buildDropdownAlign=function(a){this.bindRefreshListener(a);for(var b='<ul class="fr-dropdown-menu f-align">',c=0;c<a.seed.length;c++){var d=a.seed[c];b+='<li data-cmd="align" data-val="'+d.cmd+'" title="'+d.title+'"><a href="#"><i class="'+d.icon+'"></i></a></li>'}return b+="</ul>"},b.prototype.buildDropdownFormatBlock=function(a){var b='<ul class="fr-dropdown-menu">';for(var c in this.options.blockTags){var d='<li data-cmd="'+a.cmd+'" data-val="'+c+'">';d+='<a href="#" data-text="true" class="format-'+c+'" title="'+this.options.blockTags[c]+'">'+this.options.blockTags[c]+"</a></li>",b+=d}return b+="</ul>"},b.prototype.buildDefaultDropdown=function(a){for(var b='<ul class="fr-dropdown-menu">',c=0;c<a.seed.length;c++){var d=a.seed[c],e='<li data-namespace="'+a.namespace+'" data-cmd="'+(d.cmd||a.cmd)+'" data-val="'+d.value+'" data-param="'+(d.param||a.param)+'">';e+='<a href="#" data-text="true" class="'+d.value+'" title="'+d.title+'">'+d.title+"</a></li>",b+=e}return b+="</ul>"},b.prototype.createEditPopupHTML=function(){var a='<div class="froala-popup froala-text-popup" style="display:none;">';return a+='<h4><span data-text="true">Edit text</span><i title="Cancel" class="fa fa-times" id="f-text-close-'+this._id+'"></i></h4></h4>',a+='<div class="f-popup-line"><input type="text" placeholder="http://www.example.com" class="f-lu" id="f-ti-'+this._id+'">',a+='<button data-text="true" type="button" class="f-ok" id="f-edit-popup-ok-'+this._id+'">OK</button>',a+="</div>",a+="</div>"},b.prototype.buildEditPopup=function(){this.$edit_popup_wrapper=a(this.createEditPopupHTML()),this.$popup_editor.append(this.$edit_popup_wrapper),this.$edit_popup_wrapper.find("#f-ti-"+this._id).on("mouseup keydown",function(a){a.stopPropagation()}),this.addListener("hidePopups",a.proxy(function(){this.$edit_popup_wrapper.hide()},this)),this.$edit_popup_wrapper.on("click","#f-edit-popup-ok-"+this._id,a.proxy(function(){this.$element.text(this.$edit_popup_wrapper.find("#f-ti-"+this._id).val()),this.sync(),this.hide()},this)),this.$edit_popup_wrapper.on("click","i#f-text-close-"+this._id,a.proxy(function(){this.hide()},this))},b.prototype.createCORSRequest=function(a,b){var c=new XMLHttpRequest;if("withCredentials"in c){c.open(a,b,!0),this.options.withCredentials&&(c.withCredentials=!0);for(var d in this.options.headers)c.setRequestHeader(d,this.options.headers[d])}else"undefined"!=typeof XDomainRequest?(c=new XDomainRequest,c.open(a,b)):c=null;return c},b.prototype.isEnabled=function(b){return a.inArray(b,this.options.buttons)>=0},b.prototype.bindButtonEvents=function(){this.bindDropdownEvents(this.$bttn_wrapper),this.bindCommandEvents(this.$bttn_wrapper)},b.prototype.bindDropdownEvents=function(c){var d=this;c.on(this.mousedown,".fr-dropdown .fr-trigger:not([disabled])",function(b){return"mousedown"===b.type&&1!==b.which?!0:("LI"===this.tagName&&"touchstart"===b.type&&d.android()||d.iOS()||b.preventDefault(),void a(this).attr("data-down",!0))}),c.on(this.mouseup,".fr-dropdown .fr-trigger:not([disabled])",function(e){if(d.isDisabled)return!1;if(e.stopPropagation(),e.preventDefault(),!a(this).attr("data-down"))return a("[data-down]").removeAttr("data-down"),!1;a("[data-down]").removeAttr("data-down"),d.options.inlineMode===!1&&0===a(this).parents(".froala-popup").length&&(d.hide(),d.closeImageMode(),d.imageMode=!1),a(this).toggleClass("active").trigger("blur");var f,g=a(this).attr("data-name");return b.commands[g]?f=b.commands[g].refreshOnShow:d.options.customDropdowns[g]?f=d.options.customDropdowns[g].refreshOnShow:b.image_commands[g]&&(f=b.image_commands[g].refreshOnShow),f&&f.call(d),c.find("button.fr-trigger").not(this).removeClass("active"),!1}),c.on(this.mouseup,".fr-dropdown",function(a){a.stopPropagation(),a.preventDefault()}),this.$element.on("mouseup","img, a",a.proxy(function(){return this.isDisabled?!1:void c.find(".fr-dropdown .fr-trigger").removeClass("active")},this)),c.on("click","li[data-cmd] > a",function(a){a.preventDefault()})},b.prototype.bindCommandEvents=function(b){var c=this;b.on(this.mousedown,"button[data-cmd], li[data-cmd], span[data-cmd], a[data-cmd]",function(b){return"mousedown"===b.type&&1!==b.which?!0:("LI"===this.tagName&&"touchstart"===b.type&&c.android()||c.iOS()||b.preventDefault(),void a(this).attr("data-down",!0))}),b.on(this.mouseup+" "+this.move,"button[data-cmd], li[data-cmd], span[data-cmd], a[data-cmd]",a.proxy(function(b){if(c.isDisabled)return!1;if("mouseup"===b.type&&1!==b.which)return!0;var d=b.currentTarget;if("touchmove"!=b.type){if(b.stopPropagation(),b.preventDefault(),!a(d).attr("data-down"))return a("[data-down]").removeAttr("data-down"),!1;if(a("[data-down]").removeAttr("data-down"),a(d).data("dragging")||a(d).attr("disabled"))return a(d).removeData("dragging"),!1;var e=a(d).data("timeout");e&&(clearTimeout(e),a(d).removeData("timeout"));var f=a(d).attr("data-callback");if(c.options.inlineMode===!1&&0===a(d).parents(".froala-popup").length&&(c.hide(),c.closeImageMode(),c.imageMode=!1),f)a(d).parents(".fr-dropdown").find(".fr-trigger.active").removeClass("active"),c[f]();else{var g=a(d).attr("data-namespace"),h=a(d).attr("data-cmd"),i=a(d).attr("data-val"),j=a(d).attr("data-param");g?c["exec"+g](h,i,j):(c.exec(h,i,j),c.$bttn_wrapper.find(".fr-dropdown .fr-trigger").removeClass("active"))}return!1}a(d).data("timeout")||a(d).data("timeout",setTimeout(function(){a(d).data("dragging",!0)},200))},this))},b.prototype.save=function(){if(!this.triggerEvent("beforeSave",[],!1))return!1;if(this.options.saveURL){var b={};for(var c in this.options.saveParams){var d=this.options.saveParams[c];b[c]="function"==typeof d?d.call(this):d}var e={};e[this.options.saveParam]=this.getHTML(),a.ajax({type:this.options.saveRequestType,url:this.options.saveURL,data:a.extend(e,b),crossDomain:this.options.crossDomain,xhrFields:{withCredentials:this.options.withCredentials},headers:this.options.headers}).done(a.proxy(function(a){this.triggerEvent("afterSave",[a])},this)).fail(a.proxy(function(){this.triggerEvent("saveError",["Save request failed on the server."])},this))}else this.triggerEvent("saveError",["Missing save URL."])},b.prototype.isURL=function(a){if(!/^(https?:|ftps?:|)\/\//.test(a))return!1;a=String(a).replace(/</g,"%3C").replace(/>/g,"%3E").replace(/"/g,"%22").replace(/ /g,"%20");var b=/\(?(?:(https?:|ftps?:|)\/\/)?(?:((?:[^\W\s]|\.|-|[:]{1})+)@{1})?((?:www.)?(?:[^\W\s]|\.|-)+[\.][^\W\s]{2,4}|(?:www.)?(?:[^\W\s]|\.|-)|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d*))?([\/]?[^\s\?]*[\/]{1})*(?:\/?([^\s\n\?\[\]\{\}\#]*(?:(?=\.)){1}|[^\s\n\?\[\]\{\}\.\#]*)?([\.]{1}[^\s\?\#]*)?)?(?:\?{1}([^\s\n\#\[\]]*))?([\#][^\s\n]*)?\)?/gi;return b.test(a)},b.prototype.sanitizeURL=function(a){if(/^(https?:|ftps?:|)\/\//.test(a)){if(!this.isURL(a))return""}else a=encodeURIComponent(a).replace(/%23/g,"#").replace(/%2F/g,"/").replace(/%25/g,"%").replace(/mailto%3A/g,"mailto:").replace(/tel%3A/g,"tel:").replace(/data%3Aimage/g,"data:image").replace(/webkit-fake-url%3A/g,"webkit-fake-url:").replace(/%3F/g,"?").replace(/%3D/g,"=").replace(/%26/g,"&").replace(/&amp;/g,"&").replace(/%2C/g,",").replace(/%3B/g,";").replace(/%2B/g,"+").replace(/%40/g,"@");return a},b.prototype.parents=function(a,b){return a.get(0)!=this.$element.get(0)?a.parentsUntil(this.$element,b):[]},b.prototype.option=function(b,c){if(void 0===b)return this.options;if(b instanceof Object)this.options=a.extend({},this.options,b),this.initOptions(),this.setCustomText(),this.setLanguage(),this.setAllowScript(),this.setAllowStyle();else{if(void 0===c)return this.options[b];switch(this.options[b]=c,b){case"direction":this.setDirection();break;case"height":case"width":case"minHeight":case"maxHeight":this.setDimensions();break;case"spellcheck":this.setSpellcheck();break;case"placeholder":this.setPlaceholder();break;case"customText":this.setCustomText();break;case"language":this.setLanguage();break;case"textNearImage":this.setTextNearImage();break;case"zIndex":this.setZIndex();break;case"theme":this.setTheme();break;case"allowScript":this.setAllowScript();break;case"allowStyle":this.setAllowStyle()}}};var c=a.fn.editable;a.fn.editable=function(c){for(var d=[],e=0;e<arguments.length;e++)d.push(arguments[e]);if("string"==typeof c){var f=[];return this.each(function(){var b=a(this),e=b.data("fa.editable");if(!e[c])return a.error("Method "+c+" does not exist in Froala Editor.");var g=e[c].apply(e,d.slice(1));void 0===g?f.push(this):0===f.length&&f.push(g)}),1==f.length?f[0]:f}return"object"!=typeof c&&c?void 0:this.each(function(){var d=this,e=a(d),f=e.data("fa.editable");f||e.data("fa.editable",f=new b(d,c))})},a.fn.editable.Constructor=b,a.Editable=b,a.fn.editable.noConflict=function(){return a.fn.editable=c,this}}(window.jQuery),function(a){a.Editable.prototype.initUndoRedo=function(){this.undoStack=[],this.undoIndex=0,this.saveUndoStep(),this.disableBrowserUndo()},a.Editable.prototype.undo=function(){if(this.no_verify=!0,this.undoIndex>1){clearTimeout(this.typingTimer),this.triggerEvent("beforeUndo",[],!1);var a=this.undoStack[--this.undoIndex-1];this.restoreSnapshot(a),this.doingRedo=!0,this.triggerEvent("afterUndo",[]),this.doingRedo=!1,""!==this.text()?this.repositionEditor():this.hide(),this.$element.trigger("placeholderCheck"),this.focus(),this.refreshButtons()}this.no_verify=!1},a.Editable.prototype.redo=function(){if(this.no_verify=!0,this.undoIndex<this.undoStack.length){clearTimeout(this.typingTimer),this.triggerEvent("beforeRedo",[],!1);var a=this.undoStack[this.undoIndex++];this.restoreSnapshot(a),this.doingRedo=!0,this.triggerEvent("afterRedo",[]),this.doingRedo=!1,""!==this.text()?this.repositionEditor():this.hide(),this.$element.trigger("placeholderCheck"),this.focus(),this.refreshButtons()}this.no_verify=!1},a.Editable.prototype.saveUndoStep=function(){if(!this.undoStack)return!1;for(;this.undoStack.length>this.undoIndex;)this.undoStack.pop();var a=this.getSnapshot();this.undoStack[this.undoIndex-1]&&this.identicSnapshots(this.undoStack[this.undoIndex-1],a)||(this.undoStack.push(a),this.undoIndex++),this.refreshUndo(),this.refreshRedo()},a.Editable.prototype.refreshUndo=function(){if(this.isEnabled("undo")){if(void 0===this.$editor)return;this.$bttn_wrapper.find('[data-cmd="undo"]').removeAttr("disabled"),(0===this.undoStack.length||this.undoIndex<=1||this.isHTML)&&this.$bttn_wrapper.find('[data-cmd="undo"]').attr("disabled",!0)}},a.Editable.prototype.refreshRedo=function(){if(this.isEnabled("redo")){if(void 0===this.$editor)return;this.$bttn_wrapper.find('[data-cmd="redo"]').removeAttr("disabled"),(this.undoIndex==this.undoStack.length||this.isHTML)&&this.$bttn_wrapper.find('[data-cmd="redo"]').prop("disabled",!0)}},a.Editable.prototype.getNodeIndex=function(a){for(var b=a.parentNode.childNodes,c=0,d=null,e=0;e<b.length;e++){if(d){var f=3===b[e].nodeType&&""===b[e].textContent,g=3===d.nodeType&&3===b[e].nodeType;f||g||c++}if(b[e]==a)return c;d=b[e]}},a.Editable.prototype.getNodeLocation=function(a){var b=[];if(!a.parentNode)return[];for(;a!=this.$element.get(0);)b.push(this.getNodeIndex(a)),a=a.parentNode;return b.reverse()},a.Editable.prototype.getNodeByLocation=function(a){for(var b=this.$element.get(0),c=0;c<a.length;c++)b=b.childNodes[a[c]];return b},a.Editable.prototype.getRealNodeOffset=function(a,b){for(;a&&3===a.nodeType;){var c=a.previousSibling;c&&3==c.nodeType&&(b+=c.textContent.length),a=c}return b},a.Editable.prototype.getRangeSnapshot=function(a){return{scLoc:this.getNodeLocation(a.startContainer),scOffset:this.getRealNodeOffset(a.startContainer,a.startOffset),ecLoc:this.getNodeLocation(a.endContainer),ecOffset:this.getRealNodeOffset(a.endContainer,a.endOffset)}},a.Editable.prototype.getSnapshot=function(){var a={};if(a.html=this.$element.html(),a.ranges=[],this.selectionInEditor()&&this.$element.is(":focus"))for(var b=this.getRanges(),c=0;c<b.length;c++)a.ranges.push(this.getRangeSnapshot(b[c]));return a},a.Editable.prototype.identicSnapshots=function(a,b){return a.html!=b.html?!1:JSON.stringify(a.ranges)!=JSON.stringify(b.ranges)?!1:!0},a.Editable.prototype.restoreRangeSnapshot=function(a,b){try{var c=this.getNodeByLocation(a.scLoc),d=a.scOffset,e=this.getNodeByLocation(a.ecLoc),f=a.ecOffset,g=this.document.createRange();g.setStart(c,d),g.setEnd(e,f),b.addRange(g)}catch(h){}},a.Editable.prototype.restoreSnapshot=function(b){this.$element.html()!=b.html&&this.$element.html(b.html);var c=this.getSelection();this.clearSelection(),this.$element.focus();for(var d=0;d<b.ranges.length;d++)this.restoreRangeSnapshot(b.ranges[d],c);setTimeout(a.proxy(function(){this.$element.find(".f-img-wrap img").click()},this),0)}}(jQuery),function(a){a.Editable.prototype.refreshButtons=function(b){return this.initialized&&(this.selectionInEditor()&&!this.isHTML||this.browser.msie&&a.Editable.getIEversion()<9||b)?(this.$editor.find("button[data-cmd]").removeClass("active"),this.refreshDisabledState(),void this.raiseEvent("refresh")):!1},a.Editable.prototype.refreshDisabledState=function(){if(this.isHTML)return!1;if(this.$editor){for(var b=0;b<this.options.buttons.length;b++){var c=this.options.buttons[b];if(void 0!==a.Editable.commands[c]){var d=!1;a.isFunction(a.Editable.commands[c].disabled)?d=a.Editable.commands[c].disabled.apply(this):void 0!==a.Editable.commands[c].disabled&&(d=!0),d?(this.$editor.find('button[data-cmd="'+c+'"]').prop("disabled",!0),this.$editor.find('button[data-name="'+c+'"]').prop("disabled",!0)):(this.$editor.find('button[data-cmd="'+c+'"]').removeAttr("disabled"),this.$editor.find('button[data-name="'+c+'"]').removeAttr("disabled"))}}this.refreshUndo(),this.refreshRedo()}},a.Editable.prototype.refreshFormatBlocks=function(){var a=this.getSelectionElements()[0],b=a.tagName.toLowerCase();this.options.paragraphy&&b===this.options.defaultTag.toLowerCase()&&(b="n"),this.$editor.find('.fr-bttn > button[data-name="formatBlock"] + ul li').removeClass("active"),this.$bttn_wrapper.find('.fr-bttn > button[data-name="formatBlock"] + ul li[data-val="'+b+'"]').addClass("active")},a.Editable.prototype.refreshDefault=function(a){try{this.document.queryCommandState(a)===!0&&this.$editor.find('[data-cmd="'+a+'"]').addClass("active")}catch(b){}},a.Editable.prototype.refreshAlign=function(){var b=a(this.getSelectionElements()[0]);this.$editor.find('.fr-dropdown > button[data-name="align"] + ul li').removeClass("active");var c,d=b.css("text-align");["left","right","justify","center"].indexOf(d)<0&&(d="left"),"left"==d?c="justifyLeft":"right"==d?c="justifyRight":"justify"==d?c="justifyFull":"center"==d&&(c="justifyCenter"),this.$editor.find('.fr-dropdown > button[data-name="align"].fr-trigger i').attr("class","fa fa-align-"+d),this.$editor.find('.fr-dropdown > button[data-name="align"] + ul li[data-val="'+c+'"]').addClass("active")},a.Editable.prototype.refreshHTML=function(){this.isActive("html")?this.$editor.find('[data-cmd="html"]').addClass("active"):this.$editor.find('[data-cmd="html"]').removeClass("active")}}(jQuery),function(a){a.Editable.commands={bold:{title:"Bold",icon:"fa fa-bold",shortcut:"(Ctrl + B)",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},italic:{title:"Italic",icon:"fa fa-italic",shortcut:"(Ctrl + I)",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},underline:{cmd:"underline",title:"Underline",icon:"fa fa-underline",shortcut:"(Ctrl + U)",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},strikeThrough:{title:"Strikethrough",icon:"fa fa-strikethrough",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},subscript:{title:"Subscript",icon:"fa fa-subscript",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},superscript:{title:"Superscript",icon:"fa fa-superscript",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},formatBlock:{title:"Format Block",icon:"fa fa-paragraph",refreshOnShow:a.Editable.prototype.refreshFormatBlocks,callback:function(a,b){this.formatBlock(b)},undo:!0},align:{title:"Alignment",icon:"fa fa-align-left",refresh:a.Editable.prototype.refreshAlign,refreshOnShow:a.Editable.prototype.refreshAlign,seed:[{cmd:"justifyLeft",title:"Align Left",icon:"fa fa-align-left"},{cmd:"justifyCenter",title:"Align Center",icon:"fa fa-align-center"},{cmd:"justifyRight",title:"Align Right",icon:"fa fa-align-right"},{cmd:"justifyFull",title:"Justify",icon:"fa fa-align-justify"}],callback:function(a,b){this.align(b)},undo:!0},outdent:{title:"Indent Less",icon:"fa fa-dedent",activeless:!0,shortcut:"(Ctrl + <)",callback:function(){this.outdent(!0)},undo:!0},indent:{title:"Indent More",icon:"fa fa-indent",activeless:!0,shortcut:"(Ctrl + >)",callback:function(){this.indent()},undo:!0},selectAll:{title:"Select All",icon:"fa fa-file-text",shortcut:"(Ctrl + A)",callback:function(a,b){this.$element.focus(),this.execDefault(a,b)},undo:!1},createLink:{title:"Insert Link",icon:"fa fa-link",shortcut:"(Ctrl + K)",callback:function(){this.insertLink()},undo:!1},insertImage:{title:"Insert Image",icon:"fa fa-picture-o",activeless:!0,shortcut:"(Ctrl + P)",callback:function(){this.insertImage()},undo:!1},undo:{title:"Undo",icon:"fa fa-undo",activeless:!0,shortcut:"(Ctrl+Z)",refresh:a.Editable.prototype.refreshUndo,callback:function(){this.undo()},undo:!1},redo:{title:"Redo",icon:"fa fa-repeat",activeless:!0,shortcut:"(Shift+Ctrl+Z)",refresh:a.Editable.prototype.refreshRedo,callback:function(){this.redo()},undo:!1},html:{title:"Show HTML",icon:"fa fa-code",refresh:a.Editable.prototype.refreshHTML,callback:function(){this.html()},undo:!1},save:{title:"Save",icon:"fa fa-floppy-o",callback:function(){this.save()},undo:!1},insertHorizontalRule:{title:"Insert Horizontal Line",icon:"fa fa-minus",callback:function(a){this.insertHR(a)},undo:!0},removeFormat:{title:"Clear formatting",icon:"fa fa-eraser",activeless:!0,callback:function(){this.removeFormat()},undo:!0}},a.Editable.prototype.exec=function(b,c,d){return!this.selectionInEditor()&&a.Editable.commands[b].undo&&this.focus(),this.selectionInEditor()&&""===this.text()&&a.Editable.commands[b].callbackWithoutSelection?(a.Editable.commands[b].callbackWithoutSelection.apply(this,[b,c,d]),!1):void(a.Editable.commands[b].callback?a.Editable.commands[b].callback.apply(this,[b,c,d]):this.execDefault(b,c))},a.Editable.prototype.html=function(){var a;this.isHTML?(this.isHTML=!1,a=this.$html_area.val(),this.$box.removeClass("f-html"),this.$element.attr("contenteditable",!0),this.setHTML(a,!1),this.$editor.find('.fr-bttn:not([data-cmd="html"]), .fr-trigger').removeAttr("disabled"),this.$editor.find('.fr-bttn[data-cmd="html"]').removeClass("active"),this.$element.blur(),this.focus(),this.refreshButtons(),this.triggerEvent("htmlHide",[a],!0,!1)):(this.$box.removeClass("f-placeholder"),this.clearSelection(),this.cleanify(!1,!0,!1),a=this.cleanTags(this.getHTML(!1,!1)),this.$html_area.val(a).trigger("resize"),this.$html_area.css("height",this.$element.height()-1),this.$element.html("").append(this.$html_area).removeAttr("contenteditable"),this.$box.addClass("f-html"),this.$editor.find('button.fr-bttn:not([data-cmd="html"]), button.fr-trigger').attr("disabled",!0),this.$editor.find('.fr-bttn[data-cmd="html"]').addClass("active"),this.isHTML=!0,this.hide(),this.imageMode=!1,this.$element.blur(),this.$element.removeAttr("contenteditable"),this.triggerEvent("htmlShow",[a],!0,!1))},a.Editable.prototype.insertHR=function(b){this.$element.find("hr").addClass("fr-tag"),this.$element.hasClass("f-placeholder")?a(this.$element.find("> "+this.valid_nodes.join(", >"))[0]).before("<hr/>"):this.document.execCommand(b),this.hide();var c=this.$element.find("hr:not(.fr-tag)").next(this.valid_nodes.join(","));c.length>0?a(c[0]).prepend(this.markers_html):this.$element.find("hr:not(.fr-tag)").after(this.options.paragraphy?"<p>"+this.markers_html+"<br/></p>":this.markers_html),this.restoreSelectionByMarkers(),this.triggerEvent(b,[],!0,!1)},a.Editable.prototype.formatBlock=function(b){if(this.disabledList.indexOf("formatBlock")>=0)return!1;if(this.browser.msie&&a.Editable.getIEversion()<9)return"n"==b&&(b=this.options.defaultTag),this.document.execCommand("formatBlock",!1,"<"+b+">"),this.triggerEvent("formatBlock"),!1;if(this.$element.hasClass("f-placeholder")){if(this.options.paragraphy||"n"!=b){"n"==b&&(b=this.options.defaultTag);var c=a("<"+b+"><br/></"+b+">");this.$element.html(c),this.setSelection(c.get(0),0),this.$element.removeClass("f-placeholder")}}else{this.saveSelectionByMarkers(),this.wrapText(),this.restoreSelectionByMarkers();var d=this.getSelectionElements();d[0]==this.$element.get(0)&&(d=this.$element.find("> "+this.valid_nodes.join(", >"))),this.saveSelectionByMarkers();for(var e,f=function(b){if("PRE"==b.get(0).tagName)for(;b.find("br + br").length>0;){var c=a(b.find("br + br")[0]);c.prev().remove(),c.replaceWith("\n\n")}},g=0;g<d.length;g++){var h=a(d[g]);if(!this.fakeEmpty(h)){if(f(h),!this.options.paragraphy&&this.emptyElement(h.get(0))&&h.append("<br/>"),"n"==b)if(this.options.paragraphy){var i="<"+this.options.defaultTag+this.attrs(h.get(0))+">"+h.html()+"</"+this.options.defaultTag+">";e=a(i)}else e=h.html()+"<br/>";else e=a("<"+b+this.attrs(h.get(0))+">").html(h.html());h.get(0)!=this.$element.get(0)?h.replaceWith(e):h.html(e)}}this.unwrapText(),this.$element.find("pre + pre").each(function(){a(this).prepend(a(this).prev().html()+"<br/><br/>"),a(this).prev().remove()});var j=this;this.$element.find(this.valid_nodes.join(",")).each(function(){"PRE"!=this.tagName&&a(this).replaceWith("<"+this.tagName+j.attrs(this)+">"+a(this).html().replace(/\n\n/gi,"</"+this.tagName+"><"+this.tagName+">")+"</"+this.tagName+">")}),this.$element.find(this.valid_nodes.join(":empty ,")+":empty").append("<br/>"),this.cleanupLists(),this.restoreSelectionByMarkers()}this.triggerEvent("formatBlock"),this.repositionEditor()},a.Editable.prototype.align=function(b){if(this.browser.msie&&a.Editable.getIEversion()<9)return this.document.execCommand(b,!1,!1),this.triggerEvent("align",[b]),!1;this.saveSelectionByMarkers(),this.wrapText(),this.restoreSelectionByMarkers(),this.saveSelectionByMarkers();var c=this.getSelectionElements();"justifyLeft"==b?b="left":"justifyRight"==b?b="right":"justifyCenter"==b?b="center":"justifyFull"==b&&(b="justify");for(var d=0;d<c.length;d++)this.parents(a(c[d]),"LI").length>0&&(c[d]=a(c[d]).parents("LI").get(0)),a(c[d]).css("text-align",b);this.cleanupLists(),this.unwrapText(),this.restoreSelectionByMarkers(),this.repositionEditor(),this.triggerEvent("align",[b])},a.Editable.prototype.indent=function(b,c){if(void 0===c&&(c=!0),this.browser.msie&&a.Editable.getIEversion()<9)return b?this.document.execCommand("outdent",!1,!1):this.document.execCommand("indent",!1,!1),!1;var d=20;b&&(d=-20),this.saveSelectionByMarkers(),this.wrapText(),this.restoreSelectionByMarkers();var e=this.getSelectionElements();this.saveSelectionByMarkers();for(var f=0;f<e.length;f++)a(e[f]).parentsUntil(this.$element,"li").length>0&&(e[f]=a(e[f]).closest("li").get(0));for(var g=0;g<e.length;g++){var h=a(e[g]);if(this.raiseEvent("indent",[h,b]))if(h.get(0)!=this.$element.get(0)){var i=parseInt(h.css("margin-left"),10),j=Math.max(0,i+d);h.css("marginLeft",j),0===j&&(h.css("marginLeft",""),void 0===h.css("style")&&h.removeAttr("style"))}else{var k=a("<div>").html(h.html());h.html(k),k.css("marginLeft",Math.max(0,d)),0===Math.max(0,d)&&(k.css("marginLeft",""),void 0===k.css("style")&&k.removeAttr("style"))}}this.unwrapText(),this.restoreSelectionByMarkers(),c&&this.repositionEditor(),b||this.triggerEvent("indent")},a.Editable.prototype.outdent=function(a){this.indent(!0,a),this.triggerEvent("outdent")},a.Editable.prototype.execDefault=function(a,b){this.saveUndoStep(),this.document.execCommand(a,!1,b),this.triggerEvent(a,[],!0,!0)},a.Editable.prototype._startInDefault=function(a){this.focus(),this.document.execCommand(a,!1,!1),this.refreshButtons()},a.Editable.prototype._startInFontExec=function(b,c,d){this.focus();try{var e=this.getRange(),f=e.cloneRange();f.collapse(!1);var g=a('<span data-inserted="true" data-fr-verified="true" style="'+b+": "+d+';">'+a.Editable.INVISIBLE_SPACE+"</span>",this.document);f.insertNode(g[0]),g=this.$element.find("[data-inserted]"),g.removeAttr("data-inserted"),this.setSelection(g.get(0),1),null!=c&&this.triggerEvent(c,[d],!0,!0)}catch(h){}},a.Editable.prototype.removeFormat=function(){this.document.execCommand("removeFormat",!1,!1),this.document.execCommand("unlink",!1,!1),this.refreshButtons()},a.Editable.prototype.inlineStyle=function(b,c,d){if(this.browser.webkit){var e=function(a){return a.attr("style").indexOf("font-size")>=0};this.$element.find("[style]").each(function(b,c){var d=a(c);e(d)&&(d.attr("data-font-size",d.css("font-size")),d.css("font-size",""))})}this.document.execCommand("fontSize",!1,4),this.saveSelectionByMarkers(),this.browser.webkit&&this.$element.find("[data-font-size]").each(function(b,c){var d=a(c);d.css("font-size",d.attr("data-font-size")),d.removeAttr("data-font-size")});var f=function(c){var e=a(c);e.css(b)!=d&&e.css(b,""),""===e.attr("style")&&e.replaceWith(e.html())};this.$element.find("font").each(function(c,e){var g=a('<span data-fr-verified="true" style="'+b+": "+d+';">'+a(e).html()+"</span>");a(e).replaceWith(g);for(var h=g.find("span"),i=h.length-1;i>=0;i--)f(h[i])}),this.removeBlankSpans(),this.restoreSelectionByMarkers(),this.repositionEditor(),null!=c&&this.triggerEvent(c,[d],!0,!0)}}(jQuery),function(a){a.Editable.prototype.addListener=function(a,b){var c=this._events,d=c[a]=c[a]||[];d.push(b)},a.Editable.prototype.raiseEvent=function(a,b){void 0===b&&(b=[]);var c=!0,d=this._events[a];if(d)for(var e=0,f=d.length;f>e;e++){var g=d[e].apply(this,b);void 0!==g&&c!==!1&&(c=g)}return void 0===c&&(c=!0),c}}(jQuery),function(a){a.Editable.prototype.start_marker='<span class="f-marker" data-id="0" data-fr-verified="true" data-type="true"></span>',a.Editable.prototype.end_marker='<span class="f-marker" data-id="0" data-fr-verified="true" data-type="false"></span>',a.Editable.prototype.markers_html='<span class="f-marker" data-id="0" data-fr-verified="true" data-type="false"></span><span class="f-marker" data-id="0" data-fr-verified="true" data-type="true"></span>',a.Editable.prototype.text=function(){var a="";
return this.window.getSelection?a=this.window.getSelection():this.document.getSelection?a=this.document.getSelection():this.document.selection&&(a=this.document.selection.createRange().text),a.toString()},a.Editable.prototype.selectionInEditor=function(){var b=this.getSelectionParent(),c=!1;return b==this.$element.get(0)&&(c=!0),c===!1&&a(b).parents().each(a.proxy(function(a,b){b==this.$element.get(0)&&(c=!0)},this)),c},a.Editable.prototype.getSelection=function(){var a="";return a=this.window.getSelection?this.window.getSelection():this.document.getSelection?this.document.getSelection():this.document.selection.createRange()},a.Editable.prototype.getRange=function(){var a=this.getRanges();return a.length>0?a[0]:null},a.Editable.prototype.getRanges=function(){var a=this.getSelection();if(a.getRangeAt&&a.rangeCount){for(var b=[],c=0;c<a.rangeCount;c++)b.push(a.getRangeAt(c));return b}return this.document.createRange?[this.document.createRange()]:[]},a.Editable.prototype.clearSelection=function(){var a=this.getSelection();try{a.removeAllRanges?a.removeAllRanges():a.empty?a.empty():a.clear&&a.clear()}catch(b){}},a.Editable.prototype.getSelectionElement=function(){var b=this.getSelection();if(b&&b.rangeCount){var c=this.getRange(),d=c.startContainer;if(1==d.nodeType){var e=!1;d.childNodes.length>0&&d.childNodes[c.startOffset]&&a(d.childNodes[c.startOffset]).text()===this.text()&&(d=d.childNodes[c.startOffset],e=!0),!e&&d.childNodes.length>0&&a(d.childNodes[0]).text()===this.text()&&["BR","IMG","HR"].indexOf(d.childNodes[0].tagName)<0&&(d=d.childNodes[0])}for(;1!=d.nodeType&&d.parentNode;)d=d.parentNode;for(var f=d;f&&"BODY"!=f.tagName;){if(f==this.$element.get(0))return d;f=a(f).parent()[0]}}return this.$element.get(0)},a.Editable.prototype.getSelectionParent=function(){var b,c=null;return this.window.getSelection?(b=this.window.getSelection(),b&&b.rangeCount&&(c=b.getRangeAt(0).commonAncestorContainer,1!=c.nodeType&&(c=c.parentNode))):(b=this.document.selection)&&"Control"!=b.type&&(c=b.createRange().parentElement()),null!=c&&(a.inArray(this.$element.get(0),a(c).parents())>=0||c==this.$element.get(0))?c:null},a.Editable.prototype.nodeInRange=function(a,b){var c;if(a.intersectsNode)return a.intersectsNode(b);c=b.ownerthis.document.createRange();try{c.selectNode(b)}catch(d){c.selectNodeContents(b)}return-1==a.compareBoundaryPoints(Range.END_TO_START,c)&&1==a.compareBoundaryPoints(Range.START_TO_END,c)},a.Editable.prototype.getElementFromNode=function(b){for(1!=b.nodeType&&(b=b.parentNode);null!==b&&this.valid_nodes.indexOf(b.tagName)<0;)b=b.parentNode;return null!=b&&"LI"==b.tagName&&a(b).find(this.valid_nodes.join(",")).not("li").length>0?null:a.makeArray(a(b).parents()).indexOf(this.$element.get(0))>=0?b:null},a.Editable.prototype.nextNode=function(a,b){if(a.hasChildNodes())return a.firstChild;for(;a&&!a.nextSibling&&a!=b;)a=a.parentNode;return a&&a!=b?a.nextSibling:null},a.Editable.prototype.getRangeSelectedNodes=function(a){var b=[],c=a.startContainer,d=a.endContainer;if(c==d&&"TR"!=c.tagName){if(c.hasChildNodes()&&0!==c.childNodes.length){for(var e=c.childNodes,f=a.startOffset;f<a.endOffset;f++)e[f]&&b.push(e[f]);return 0===b.length&&b.push(c),b}return[c]}if(c==d&&"TR"==c.tagName){var g=c.childNodes,h=a.startOffset;if(g.length>h&&h>=0){var i=g[h];if("TD"==i.tagName||"TH"==i.tagName)return[i]}}for(;c&&c!=d;)c=this.nextNode(c,d),(c!=d||a.endOffset>0)&&b.push(c);for(c=a.startContainer;c&&c!=a.commonAncestorContainer;)b.unshift(c),c=c.parentNode;return b},a.Editable.prototype.getSelectedNodes=function(){if(this.window.getSelection){var b=this.window.getSelection();if(!b.isCollapsed){for(var c=this.getRanges(),d=[],e=0;e<c.length;e++)d=a.merge(d,this.getRangeSelectedNodes(c[e]));return d}if(this.selectionInEditor()){var f=b.getRangeAt(0).startContainer;return 3==f.nodeType?[f.parentNode]:[f]}}return[]},a.Editable.prototype.getSelectionElements=function(){var b=this.getSelectedNodes(),c=[];return a.each(b,a.proxy(function(a,b){if(null!==b){var d=this.getElementFromNode(b);c.indexOf(d)<0&&d!=this.$element.get(0)&&null!==d&&c.push(d)}},this)),0===c.length&&c.push(this.$element.get(0)),c},a.Editable.prototype.getSelectionLink=function(){var b=this.getSelectionLinks();return b.length>0?a(b[0]).attr("href"):null},a.Editable.prototype.saveSelection=function(){if(!this.selectionDisabled){this.savedRanges=[];for(var a=this.getRanges(),b=0;b<a.length;b++)this.savedRanges.push(a[b].cloneRange())}},a.Editable.prototype.restoreSelection=function(){if(!this.selectionDisabled){var a,b,c=this.getSelection();if(this.savedRanges&&this.savedRanges.length)for(c.removeAllRanges(),a=0,b=this.savedRanges.length;b>a;a+=1)c.addRange(this.savedRanges[a]);this.savedRanges=null}},a.Editable.prototype.insertMarkersAtPoint=function(a){var b=a.clientX,c=a.clientY;this.removeMarkers();var d,e=null;if("undefined"!=typeof this.document.caretPositionFromPoint?(d=this.document.caretPositionFromPoint(b,c),e=this.document.createRange(),e.setStart(d.offsetNode,d.offset),e.setEnd(d.offsetNode,d.offset)):"undefined"!=typeof this.document.caretRangeFromPoint&&(d=this.document.caretRangeFromPoint(b,c),e=this.document.createRange(),e.setStart(d.startContainer,d.startOffset),e.setEnd(d.startContainer,d.startOffset)),null!==e&&"undefined"!=typeof this.window.getSelection){var f=this.window.getSelection();f.removeAllRanges(),f.addRange(e)}else if("undefined"!=typeof this.document.body.createTextRange)try{e=this.document.body.createTextRange(),e.moveToPoint(b,c);var g=e.duplicate();g.moveToPoint(b,c),e.setEndPoint("EndToEnd",g),e.select()}catch(h){}this.placeMarker(e,!0,0),this.placeMarker(e,!1,0)},a.Editable.prototype.saveSelectionByMarkers=function(){if(!this.selectionDisabled){this.selectionInEditor()||this.focus(),this.removeMarkers();for(var a=this.getRanges(),b=0;b<a.length;b++)if(a[b].startContainer!==this.document){var c=a[b];this.placeMarker(c,!0,b),this.placeMarker(c,!1,b)}}},a.Editable.prototype.hasSelectionByMarkers=function(){var a=this.$element.find('.f-marker[data-type="true"]');return a.length>0?!0:!1},a.Editable.prototype.restoreSelectionByMarkers=function(b){if(void 0===b&&(b=!0),!this.selectionDisabled){var c=this.$element.find('.f-marker[data-type="true"]');if(0===c.length)return!1;this.$element.is(":focus")||this.browser.msie||this.$element.focus();var d=this.getSelection();(b||this.getRange()&&!this.getRange().collapsed||!a(c[0]).attr("data-collapsed"))&&(this.browser.msie&&a.Editable.getIEversion()<9||(this.clearSelection(),b=!0));for(var e=0;e<c.length;e++){var f=a(c[e]).data("id"),g=c[e],h=this.$element.find('.f-marker[data-type="false"][data-id="'+f+'"]');if(this.browser.msie&&a.Editable.getIEversion()<9)return this.setSelection(g,0,h,0),this.removeMarkers(),!1;var i;if(i=b?this.document.createRange():this.getRange(),h.length>0){h=h[0];try{i.setStartAfter(g),i.setEndBefore(h)}catch(j){}}b&&d.addRange(i)}this.removeMarkers()}},a.Editable.prototype.setSelection=function(a,b,c,d){var e=this.getSelection();if(e){this.clearSelection();try{c||(c=a),void 0===b&&(b=0),void 0===d&&(d=b);var f=this.getRange();f.setStart(a,b),f.setEnd(c,d),e.addRange(f)}catch(g){}}},a.Editable.prototype.buildMarker=function(b,c,d){return void 0===d&&(d=""),a('<span class="f-marker"'+d+' style="display:none; line-height: 0;" data-fr-verified="true" data-id="'+c+'" data-type="'+b+'">',this.document)[0]},a.Editable.prototype.placeMarker=function(b,c,d){var e="";b.collapsed&&(e=' data-collapsed="true"');try{var f=b.cloneRange();f.collapse(c);var g,h,i;if(f.insertNode(this.buildMarker(c,d,e)),c===!0&&e)for(g=this.$element.find('span.f-marker[data-type="true"][data-id="'+d+'"]').get(0).nextSibling;3===g.nodeType&&0===g.data.length;)a(g).remove(),g=this.$element.find('span.f-marker[data-type="true"][data-id="'+d+'"]').get(0).nextSibling;if(c===!0&&""===e&&(i=this.$element.find('span.f-marker[data-type="true"][data-id="'+d+'"]').get(0),g=i.nextSibling,g&&g.nodeType===Node.ELEMENT_NODE&&this.valid_nodes.indexOf(g.tagName)>=0)){h=[g];do g=h[0],h=a(g).contents();while(h[0]&&this.valid_nodes.indexOf(h[0].tagName)>=0);a(g).prepend(a(i))}if(c===!1&&""===e&&(i=this.$element.find('span.f-marker[data-type="false"][data-id="'+d+'"]').get(0),g=i.previousSibling,g&&g.nodeType===Node.ELEMENT_NODE&&this.valid_nodes.indexOf(g.tagName)>=0)){h=[g];do g=h[h.length-1],h=a(g).contents();while(h[h.length-1]&&this.valid_nodes.indexOf(h[h.length-1].tagName)>=0);a(g).append(a(i))}}catch(j){}},a.Editable.prototype.removeMarkers=function(){this.$element.find(".f-marker").remove()},a.Editable.prototype.getSelectionTextInfo=function(a){var b,c,d=!1,e=!1;if(this.window.getSelection){var f=this.window.getSelection();f&&f.rangeCount&&(b=f.getRangeAt(0),c=b.cloneRange(),c.selectNodeContents(a),c.setEnd(b.startContainer,b.startOffset),d=""===c.toString(),c.selectNodeContents(a),c.setStart(b.endContainer,b.endOffset),e=""===c.toString())}else this.document.selection&&"Control"!=this.document.selection.type&&(b=this.document.selection.createRange(),c=b.duplicate(),c.moveToElementText(a),c.setEndPoint("EndToStart",b),d=""===c.text,c.moveToElementText(a),c.setEndPoint("StartToEnd",b),e=""===c.text);return{atStart:d,atEnd:e}},a.Editable.prototype.endsWith=function(a,b){return-1!==a.indexOf(b,a.length-b.length)}}(jQuery),function(a){a.Editable.hexToRGB=function(a){var b=/^#?([a-f\d])([a-f\d])([a-f\d])$/i;a=a.replace(b,function(a,b,c,d){return b+b+c+c+d+d});var c=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(a);return c?{r:parseInt(c[1],16),g:parseInt(c[2],16),b:parseInt(c[3],16)}:null},a.Editable.hexToRGBString=function(a){var b=this.hexToRGB(a);return b?"rgb("+b.r+", "+b.g+", "+b.b+")":""},a.Editable.RGBToHex=function(a){function b(a){return("0"+parseInt(a,10).toString(16)).slice(-2)}try{return a&&"transparent"!==a?/^#[0-9A-F]{6}$/i.test(a)?a:(a=a.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/),("#"+b(a[1])+b(a[2])+b(a[3])).toUpperCase()):""}catch(c){return null}},a.Editable.getIEversion=function(){var a,b,c=-1;return"Microsoft Internet Explorer"==navigator.appName?(a=navigator.userAgent,b=new RegExp("MSIE ([0-9]{1,}[\\.0-9]{0,})"),null!==b.exec(a)&&(c=parseFloat(RegExp.$1))):"Netscape"==navigator.appName&&(a=navigator.userAgent,b=new RegExp("Trident/.*rv:([0-9]{1,}[\\.0-9]{0,})"),null!==b.exec(a)&&(c=parseFloat(RegExp.$1))),c},a.Editable.browser=function(){var a={};if(this.getIEversion()>0)a.msie=!0;else{var b=navigator.userAgent.toLowerCase(),c=/(chrome)[ \/]([\w.]+)/.exec(b)||/(webkit)[ \/]([\w.]+)/.exec(b)||/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(b)||/(msie) ([\w.]+)/.exec(b)||b.indexOf("compatible")<0&&/(mozilla)(?:.*? rv:([\w.]+)|)/.exec(b)||[],d={browser:c[1]||"",version:c[2]||"0"};c[1]&&(a[d.browser]=!0),parseInt(d.version,10)<9&&a.msie&&(a.oldMsie=!0),a.chrome?a.webkit=!0:a.webkit&&(a.safari=!0)}return a},a.Editable.isArray=function(a){return a&&!a.propertyIsEnumerable("length")&&"object"==typeof a&&"number"==typeof a.length},a.Editable.uniq=function(b){return a.grep(b,function(c,d){return d==a.inArray(c,b)})},a.Editable.cleanWhitespace=function(b){b.contents().filter(function(){return 1==this.nodeType&&a.Editable.cleanWhitespace(a(this)),3==this.nodeType&&!/\S/.test(this.nodeValue)}).remove()}}(jQuery),function(a){a.Editable.prototype.show=function(b){if(this.hideDropdowns(),void 0!==b){if(this.options.inlineMode||this.options.editInPopup)if(null!==b&&"touchend"!==b.type){if(this.options.showNextToCursor){var c=b.pageX,d=b.pageY;c<this.$element.offset().left&&(c=this.$element.offset().left),c>this.$element.offset().left+this.$element.width()&&(c=this.$element.offset().left+this.$element.width()),d<this.$element.offset.top&&(d=this.$element.offset().top),d>this.$element.offset().top+this.$element.height()&&(d=this.$element.offset().top+this.$element.height()),20>c&&(c=20),0>d&&(d=0),this.showByCoordinates(c,d)}else this.repositionEditor();a(".froala-editor:not(.f-basic)").hide(),this.$editor.show(),0!==this.options.buttons.length||this.options.editInPopup||this.$editor.hide()}else a(".froala-editor:not(.f-basic)").hide(),this.$editor.show(),this.repositionEditor();this.hidePopups(),this.options.editInPopup||this.showEditPopupWrapper(),this.$bttn_wrapper.show(),this.refreshButtons(),this.imageMode=!1}},a.Editable.prototype.hideDropdowns=function(){this.$bttn_wrapper.find(".fr-dropdown .fr-trigger").removeClass("active"),this.$bttn_wrapper.find(".fr-dropdown .fr-trigger")},a.Editable.prototype.hide=function(a){return this.initialized?(void 0===a&&(a=!0),a?this.hideOtherEditors():(this.closeImageMode(),this.imageMode=!1),this.$popup_editor.hide(),this.hidePopups(!1),void(this.link=!1)):!1},a.Editable.prototype.hideOtherEditors=function(){for(var b=1;b<=a.Editable.count;b++)b!=this._id&&this.$window.trigger("hide."+b)},a.Editable.prototype.hideBttnWrapper=function(){this.options.inlineMode&&this.$bttn_wrapper.hide()},a.Editable.prototype.showBttnWrapper=function(){this.options.inlineMode&&this.$bttn_wrapper.show()},a.Editable.prototype.showEditPopupWrapper=function(){this.$edit_popup_wrapper&&(this.$edit_popup_wrapper.show(),setTimeout(a.proxy(function(){this.$edit_popup_wrapper.find("input").val(this.$element.text()).focus().select()},this),1))},a.Editable.prototype.hidePopups=function(a){void 0===a&&(a=!0),a&&this.hideBttnWrapper(),this.raiseEvent("hidePopups")},a.Editable.prototype.showEditPopup=function(){this.showEditPopupWrapper()}}(jQuery),function(a){a.Editable.prototype.getBoundingRect=function(){var b;if(this.isLink){b={};var c=this.$element;b.left=c.offset().left-this.$window.scrollLeft(),b.top=c.offset().top-this.$window.scrollTop(),b.width=c.outerWidth(),b.height=parseInt(c.css("padding-top").replace("px",""),10)+c.height(),b.right=1,b.bottom=1,b.ok=!0}else if(this.getRange()&&this.getRange().collapsed){var d=a(this.getSelectionElement());this.saveSelectionByMarkers();var e=this.$element.find(".f-marker:first");e.css("display","inline");var f=e.offset();e.css("display","none"),b={},b.left=f.left-this.$window.scrollLeft(),b.width=0,b.height=(parseInt(d.css("line-height").replace("px",""),10)||10)-10-this.$window.scrollTop(),b.top=f.top,b.right=1,b.bottom=1,b.ok=!0,this.removeMarkers()}else this.getRange()&&(b=this.getRange().getBoundingClientRect());return b},a.Editable.prototype.repositionEditor=function(a){var b,c,d;if(this.options.inlineMode||a){if(b=this.getBoundingRect(),this.showBttnWrapper(),b.ok||b.left>=0&&b.top>=0&&b.right>0&&b.bottom>0)c=b.left+b.width/2,d=b.top+b.height,this.iOS()&&this.iOSVersion()<8||(c+=this.$window.scrollLeft(),d+=this.$window.scrollTop()),this.showByCoordinates(c,d);else if(this.options.alwaysVisible)this.hide();else{var e=this.$element.offset();this.showByCoordinates(e.left,e.top+10)}0===this.options.buttons.length&&this.hide()}},a.Editable.prototype.showByCoordinates=function(a,b){a-=22,b+=8;var c=this.$document.find(this.options.scrollableContainer);"body"!=this.options.scrollableContainer&&(a-=c.offset().left,b-=c.offset().top,this.iPad()||(a+=c.scrollLeft(),b+=c.scrollTop()));var d=Math.max(this.$popup_editor.outerWidth(),250);a+d>=c.outerWidth()-50&&a+44-d>0?(this.$popup_editor.addClass("right-side"),a=c.outerWidth()-(a+44),"static"==c.css("position")&&(a=a+parseFloat(c.css("margin-left"),10)+parseFloat(c.css("margin-right"),10)),this.$popup_editor.css("top",b),this.$popup_editor.css("right",a),this.$popup_editor.css("left","auto")):a+d<c.outerWidth()-50?(this.$popup_editor.removeClass("right-side"),this.$popup_editor.css("top",b),this.$popup_editor.css("left",a),this.$popup_editor.css("right","auto")):(this.$popup_editor.removeClass("right-side"),this.$popup_editor.css("top",b),this.$popup_editor.css("left",Math.max(c.outerWidth()-d,10)/2),this.$popup_editor.css("right","auto")),this.$popup_editor.show()},a.Editable.prototype.positionPopup=function(b){if(a(this.$editor.find('button.fr-bttn[data-cmd="'+b+'"]')).length){var c=this.$editor.find('button.fr-bttn[data-cmd="'+b+'"]'),d=c.width(),e=c.height(),f=c.offset().left+d/2,g=c.offset().top+e;this.showByCoordinates(f,g)}}}(jQuery),function(a){a.Editable.prototype.refreshImageAlign=function(a){this.$image_editor.find('.fr-dropdown > button[data-name="align"] + ul li').removeClass("active");var b="floatImageNone",c="center";a.hasClass("fr-fil")?(c="left",b="floatImageLeft"):a.hasClass("fr-fir")&&(c="right",b="floatImageRight"),this.$image_editor.find('.fr-dropdown > button[data-name="align"].fr-trigger i').attr("class","fa fa-align-"+c),this.$image_editor.find('.fr-dropdown > button[data-name="align"] + ul li[data-val="'+b+'"]').addClass("active")},a.Editable.prototype.refreshImageDisplay=function(){var a=this.$element.find(".f-img-editor");this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li').removeClass("active"),a.hasClass("fr-dib")?this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li[data-val="fr-dib"]').addClass("active"):this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li[data-val="fr-dii"]').addClass("active")},a.Editable.image_commands={align:{title:"Alignment",icon:"fa fa-align-center",refresh:a.Editable.prototype.refreshImageAlign,refreshOnShow:a.Editable.prototype.refreshImageAlign,seed:[{cmd:"floatImageLeft",title:"Align Left",icon:"fa fa-align-left"},{cmd:"floatImageNone",title:"Align Center",icon:"fa fa-align-center"},{cmd:"floatImageRight",title:"Align Right",icon:"fa fa-align-right"}],callback:function(a,b,c){this[c](a)},undo:!0},display:{title:"Text Wrap",icon:"fa fa-star",refreshOnShow:a.Editable.prototype.refreshImageDisplay,namespace:"Image",seed:[{title:"Inline",value:"fr-dii"},{title:"Break Text",value:"fr-dib"}],callback:function(a,b,c){this.displayImage(a,c)},undo:!0},linkImage:{title:"Insert Link",icon:{type:"font",value:"fa fa-link"},callback:function(a){this.linkImage(a)}},replaceImage:{title:"Replace Image",icon:{type:"font",value:"fa fa-exchange"},callback:function(a){this.replaceImage(a)}},removeImage:{title:"Remove Image",icon:{type:"font",value:"fa fa-trash-o"},callback:function(a){this.removeImage(a)}}},a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{allowedImageTypes:["jpeg","jpg","png","gif"],customImageButtons:{},defaultImageTitle:"Image title",defaultImageWidth:300,defaultImageDisplay:"block",defaultImageAlignment:"center",imageButtons:["display","align","linkImage","replaceImage","removeImage"],imageDeleteConfirmation:!0,imageDeleteURL:null,imageDeleteParams:{},imageMove:!0,imageResize:!0,imageLink:!0,imageTitle:!0,imageUpload:!0,imageUploadParams:{},imageUploadParam:"file",imageUploadToS3:!1,imageUploadURL:"http://i.froala.com/upload",maxImageSize:10485760,pasteImage:!0,textNearImage:!0}),a.Editable.prototype.hideImageEditorPopup=function(){this.$image_editor&&this.$image_editor.hide()},a.Editable.prototype.showImageEditorPopup=function(){this.$image_editor&&this.$image_editor.show(),this.options.imageMove||this.$element.attr("contenteditable",!1)},a.Editable.prototype.showImageWrapper=function(){this.$image_wrapper&&this.$image_wrapper.show()},a.Editable.prototype.hideImageWrapper=function(a){this.$image_wrapper&&(this.$element.attr("data-resize")||a||(this.closeImageMode(),this.imageMode=!1),this.$image_wrapper.hide(),this.$image_wrapper.find("input").blur())},a.Editable.prototype.showInsertImage=function(){this.hidePopups(),this.showImageWrapper()},a.Editable.prototype.showImageEditor=function(){this.hidePopups(),this.showImageEditorPopup()},a.Editable.prototype.insertImageHTML=function(){var b='<div class="froala-popup froala-image-popup" style="display: none;"><h4><span data-text="true">Insert Image</span><span data-text="true">Uploading image</span><i title="Cancel" class="fa fa-times" id="f-image-close-'+this._id+'"></i></h4>';return b+='<div id="f-image-list-'+this._id+'">',this.options.imageUpload&&(b+='<div class="f-popup-line drop-upload">',b+='<div class="f-upload" id="f-upload-div-'+this._id+'"><strong data-text="true">Drop Image</strong><br>(<span data-text="true">or click</span>)<form target="frame-'+this._id+'" enctype="multipart/form-data" encoding="multipart/form-data" action="'+this.options.imageUploadURL+'" method="post" id="f-upload-form-'+this._id+'"><input id="f-file-upload-'+this._id+'" type="file" name="'+this.options.imageUploadParam+'" accept="image/*"></form></div>',this.browser.msie&&a.Editable.getIEversion()<=9&&(b+='<iframe id="frame-'+this._id+'" name="frame-'+this._id+'" src="javascript:false;" style="width:0; height:0; border:0px solid #FFF; position: fixed; z-index: -1;"></iframe>'),b+="</div>"),this.options.imageLink&&(b+='<div class="f-popup-line"><label><span data-text="true">Enter URL</span>: </label><input id="f-image-url-'+this._id+'" type="text" placeholder="http://example.com"><button class="f-browse fr-p-bttn" id="f-browser-'+this._id+'"><i class="fa fa-search"></i></button><button data-text="true" class="f-ok fr-p-bttn f-submit" id="f-image-ok-'+this._id+'">OK</button></div>'),b+="</div>",b+='<p class="f-progress" id="f-progress-'+this._id+'"><span></span></p>',b+="</div>"},a.Editable.prototype.iFrameLoad=function(){var a=this.$image_wrapper.find("iframe#frame-"+this._id);if(!a.attr("data-loaded"))return a.attr("data-loaded",!0),!1;try{var b=this.$image_wrapper.find("#f-upload-form-"+this._id);if(this.options.imageUploadToS3){var c=b.attr("action"),d=b.find('input[name="key"]').val(),e=c+d;this.writeImage(e),this.options.imageUploadToS3.callback&&this.options.imageUploadToS3.callback.call(this,e,d)}else{var f=a.contents().text();this.parseImageResponse(f)}}catch(g){this.throwImageError(7)}},a.Editable.prototype.initImage=function(){this.buildInsertImage(),(!this.isLink||this.isImage)&&this.initImagePopup(),this.addListener("destroy",this.destroyImage)},a.Editable.initializers.push(a.Editable.prototype.initImage),a.Editable.prototype.destroyImage=function(){this.$image_editor&&this.$image_editor.html("").removeData().remove(),this.$image_wrapper&&this.$image_wrapper.html("").removeData().remove()},a.Editable.prototype.buildInsertImage=function(){this.$image_wrapper=a(this.insertImageHTML()),this.$popup_editor.append(this.$image_wrapper);var b=this;if(this.$image_wrapper.on("mouseup touchend",a.proxy(function(a){this.isResizing()||a.stopPropagation()},this)),this.addListener("hidePopups",a.proxy(function(){this.hideImageWrapper(!0)},this)),this.$progress_bar=this.$image_wrapper.find("p#f-progress-"+this._id),this.options.imageUpload){if(this.browser.msie&&a.Editable.getIEversion()<=9){var c=this.$image_wrapper.find("iframe").get(0);c.attachEvent?c.attachEvent("onload",function(){b.iFrameLoad()}):c.onload=function(){b.iFrameLoad()}}this.$image_wrapper.on("change",'input[type="file"]',function(){if(void 0!==this.files)b.uploadImage(this.files);else{if(!b.triggerEvent("beforeImageUpload",[],!1))return!1;var c=a(this).parents("form");c.find('input[type="hidden"]').remove();var d;for(d in b.options.imageUploadParams)c.prepend('<input type="hidden" name="'+d+'" value="'+b.options.imageUploadParams[d]+'" />');if(b.options.imageUploadToS3!==!1){for(d in b.options.imageUploadToS3.params)c.prepend('<input type="hidden" name="'+d+'" value="'+b.options.imageUploadToS3.params[d]+'" />');c.prepend('<input type="hidden" name="success_action_status" value="201" />'),c.prepend('<input type="hidden" name="X-Requested-With" value="xhr" />'),c.prepend('<input type="hidden" name="Content-Type" value="" />'),c.prepend('<input type="hidden" name="key" value="'+b.options.imageUploadToS3.keyStart+(new Date).getTime()+"-"+a(this).val().match(/[^\/\\]+$/)+'" />')}else c.prepend('<input type="hidden" name="XHR_CORS_TRARGETORIGIN" value="'+b.window.location.href+'" />');b.showInsertImage(),b.showImageLoader(!0),b.disable(),c.submit()}a(this).val("")})}this.buildDragUpload(),this.$image_wrapper.on("mouseup keydown","#f-image-url-"+this._id,a.proxy(function(a){var b=a.which;b&&27===b||a.stopPropagation()},this)),this.$image_wrapper.on("click","#f-image-ok-"+this._id,a.proxy(function(){this.writeImage(this.$image_wrapper.find("#f-image-url-"+this._id).val(),!0)},this)),this.$image_wrapper.on(this.mouseup,"#f-image-close-"+this._id,a.proxy(function(a){return this.isDisabled?!1:(a.stopPropagation(),this.$bttn_wrapper.show(),this.hideImageWrapper(!0),this.options.inlineMode&&0===this.options.buttons.length&&(this.imageMode?this.showImageEditor():this.hide()),this.imageMode||(this.restoreSelection(),this.focus()),void(this.options.inlineMode||this.imageMode?this.imageMode&&this.showImageEditor():this.hide()))},this)),this.$image_wrapper.on("click",function(a){a.stopPropagation()}),this.$image_wrapper.on("click","*",function(a){a.stopPropagation()})},a.Editable.prototype.deleteImage=function(b){if(this.options.imageDeleteURL){var c=this.options.imageDeleteParams;c.info=b.data("info"),c.src=b.attr("src"),a.ajax({type:"POST",url:this.options.imageDeleteURL,data:c,crossDomain:this.options.crossDomain,xhrFields:{withCredentials:this.options.withCredentials},headers:this.options.headers}).done(a.proxy(function(a){b.parent().parent().hasClass("f-image-list")?b.parent().remove():b.parent().removeClass("f-img-deleting"),this.triggerEvent("imageDeleteSuccess",[a],!1)},this)).fail(a.proxy(function(){b.parent().removeClass("f-img-deleting"),this.triggerEvent("imageDeleteError",["Error during image delete."],!1)},this))}else b.parent().removeClass("f-img-deleting"),this.triggerEvent("imageDeleteError",["Missing imageDeleteURL option."],!1)},a.Editable.prototype.imageHandle=function(){var b=this,c=a('<span data-fr-verified="true">').addClass("f-img-handle").on({movestart:function(c){b.hide(),b.$element.addClass("f-non-selectable").attr("contenteditable",!1),b.$element.attr("data-resize",!0),a(this).attr("data-start-x",c.startX),a(this).attr("data-start-y",c.startY)},move:function(c){var d=a(this),e=c.pageX-parseInt(d.attr("data-start-x"),10);d.attr("data-start-x",c.pageX),d.attr("data-start-y",c.pageY);var f=d.prevAll("img"),g=f.width();d.hasClass("f-h-ne")||d.hasClass("f-h-se")?f.attr("width",g+e):f.attr("width",g-e),b.triggerEvent("imageResize",[f],!1)},moveend:function(){a(this).removeAttr("data-start-x"),a(this).removeAttr("data-start-y");var c=a(this),d=c.prevAll("img");b.$element.removeClass("f-non-selectable"),b.isImage||b.$element.attr("contenteditable",!0),b.triggerEvent("imageResizeEnd",[d]),a(this).trigger("mouseup")},touchend:function(){a(this).trigger("moveend")}});return c},a.Editable.prototype.disableImageResize=function(){if(this.browser.mozilla)try{document.execCommand("enableObjectResizing",!1,!1),document.execCommand("enableInlineTableEditing",!1,!1)}catch(a){}},a.Editable.prototype.isResizing=function(){return this.$element.attr("data-resize")},a.Editable.prototype.getImageStyle=function(a){var b="z-index: 1; position: relative; overflow: auto;",c=a,d="padding";return a.parent().hasClass("f-img-editor")&&(c=a.parent(),d="margin"),b+=" padding-left:"+c.css(d+"-left")+";",b+=" padding-right:"+c.css(d+"-right")+";",b+=" padding-bottom:"+c.css(d+"-bottom")+";",b+=" padding-top:"+c.css(d+"-top")+";",a.hasClass("fr-dib")?(b+=" vertical-align: top; display: block;",b+=a.hasClass("fr-fir")?" float: none; margin-right: 0; margin-left: auto;":a.hasClass("fr-fil")?" float: none; margin-left: 0; margin-right: auto;":" float: none; margin: auto;"):(b+=" display: inline-block;",b+=a.hasClass("fr-fir")?" float: right;":a.hasClass("fr-fil")?" float: left;":" float: none;"),b},a.Editable.prototype.getImageClass=function(a){var b=a.split(" ");return a="fr-fin",b.indexOf("fr-fir")>=0&&(a="fr-fir"),b.indexOf("fr-fil")>=0&&(a="fr-fil"),b.indexOf("fr-dib")>=0&&(a+=" fr-dib"),b.indexOf("fr-dii")>=0&&(a+=" fr-dii"),a},a.Editable.prototype.refreshImageButtons=function(a){this.$image_editor.find("button").removeClass("active");var b=a.css("float");b=a.hasClass("fr-fil")?"Left":a.hasClass("fr-fir")?"Right":"None",this.$image_editor.find('button[data-cmd="floatImage'+b+'"]').addClass("active"),this.raiseEvent("refreshImage",[a])},a.Editable.prototype.initImageEvents=function(){document.addEventListener&&!document.dropAssigned&&(document.dropAssigned=!0,document.addEventListener("drop",a.proxy(function(b){return a(".froala-element img.fr-image-move").length?(b.preventDefault(),b.stopPropagation(),a(".froala-element img.fr-image-move").removeClass("fr-image-move"),!1):void 0},this))),this.disableImageResize();var b=this;this.$element.on("mousedown",'img:not([contenteditable="false"])',function(c){return b.isDisabled?!1:void(b.isResizing()||(b.initialized&&c.stopPropagation(),b.$element.attr("contenteditable",!1),a(this).addClass("fr-image-move")))}),this.$element.on("mouseup",'img:not([contenteditable="false"])',function(){return b.isDisabled?!1:void(b.isResizing()||(b.options.imageMove||b.isImage||b.isHTML||b.$element.attr("contenteditable",!0),a(this).removeClass("fr-image-move")))}),this.$element.on("click touchend",'img:not([contenteditable="false"])',function(c){if(b.isDisabled)return!1;if(!b.isResizing()&&b.initialized){if(c.preventDefault(),c.stopPropagation(),b.closeImageMode(),b.$element.blur(),b.refreshImageButtons(a(this)),b.$image_editor.find('.f-image-alt input[type="text"]').val(a(this).attr("alt")||a(this).attr("title")),b.showImageEditor(),!a(this).parent().hasClass("f-img-editor")||"SPAN"!=a(this).parent().get(0).tagName){var d=b.getImageClass(a(this).attr("class"));a(this).wrap('<span data-fr-verified="true" class="f-img-editor '+d+'"></span>'),0!==a(this).parents(".f-img-wrap").length||b.isImage?a(this).parents(".f-img-wrap").attr("class",d+" f-img-wrap"):a(this).parents("a").length>0?a(this).parents("a:first").wrap('<span data-fr-verified="true" class="f-img-wrap '+d+'"></span>'):a(this).parent().wrap('<span data-fr-verified="true" class="f-img-wrap '+d+'"></span>')}if(a(this).parent().find(".f-img-handle").remove(),b.options.imageResize){var e=b.imageHandle();a(this).parent().append(e.clone(!0).addClass("f-h-ne")),a(this).parent().append(e.clone(!0).addClass("f-h-se")),a(this).parent().append(e.clone(!0).addClass("f-h-sw")),a(this).parent().append(e.clone(!0).addClass("f-h-nw"))}b.showByCoordinates(a(this).offset().left+a(this).width()/2,a(this).offset().top+a(this).height()),b.imageMode=!0,b.$bttn_wrapper.find(".fr-bttn").removeClass("active"),b.clearSelection()}}),this.$element.on("mousedown touchstart",".f-img-handle",a.proxy(function(){return b.isDisabled?!1:void this.$element.attr("data-resize",!0)},this)),this.$element.on("mouseup",".f-img-handle",a.proxy(function(c){if(b.isDisabled)return!1;var d=a(c.target).prevAll("img");setTimeout(a.proxy(function(){this.$element.removeAttr("data-resize"),d.click()},this),0)},this))},a.Editable.prototype.execImage=function(b,c,d){var e=this.$element.find("span.f-img-editor"),f=e.find("img"),g=a.Editable.image_commands[b]||this.options.customImageButtons[b];g&&g.callback&&g.callback.apply(this,[f,b,c,d])},a.Editable.prototype.bindImageRefreshListener=function(b){b.refresh&&this.addListener("refreshImage",a.proxy(function(a){b.refresh.apply(this,[a])},this))},a.Editable.prototype.buildImageButton=function(a,b){var c='<button class="fr-bttn" data-namespace="Image" data-cmd="'+b+'" title="'+a.title+'">';return c+=void 0!==this.options.icons[b]?this.prepareIcon(this.options.icons[b],a.title):this.prepareIcon(a.icon,a.title),c+="</button>",this.bindImageRefreshListener(a),c},a.Editable.prototype.buildImageAlignDropdown=function(a){this.bindImageRefreshListener(a);for(var b='<ul class="fr-dropdown-menu f-align">',c=0;c<a.seed.length;c++){var d=a.seed[c];b+='<li data-cmd="align" data-namespace="Image" data-val="'+d.cmd+'" title="'+d.title+'"><a href="#"><i class="'+d.icon+'"></i></a></li>'}return b+="</ul>"},a.Editable.prototype.buildImageDropdown=function(a){return dropdown=this.buildDefaultDropdown(a),btn=this.buildDropdownButton(a,dropdown),btn},a.Editable.prototype.image_command_dispatcher={align:function(a){var b=this.buildImageAlignDropdown(a),c=this.buildDropdownButton(a,b);return c}},a.Editable.prototype.buildImageButtons=function(){for(var b="",c=0;c<this.options.imageButtons.length;c++){var d=this.options.imageButtons[c];
if(void 0!==a.Editable.image_commands[d]||void 0!==this.options.customImageButtons[d]){var e=a.Editable.image_commands[d]||this.options.customImageButtons[d];e.cmd=d;var f=this.image_command_dispatcher[d];b+=f?f.apply(this,[e]):e.seed?this.buildImageDropdown(e,d):this.buildImageButton(e,d)}}return b},a.Editable.prototype.initImagePopup=function(){this.$image_editor=a('<div class="froala-popup froala-image-editor-popup" style="display: none">');var b=a('<div class="f-popup-line f-popup-toolbar">').appendTo(this.$image_editor);b.append(this.buildImageButtons()),this.addListener("hidePopups",this.hideImageEditorPopup),this.options.imageTitle&&a('<div class="f-popup-line f-image-alt">').append('<label><span data-text="true">Title</span>: </label>').append(a('<input type="text">').on("mouseup keydown touchend",function(a){var b=a.which;b&&27===b||a.stopPropagation()})).append('<button class="fr-p-bttn f-ok" data-text="true" data-callback="setImageAlt" data-cmd="setImageAlt" title="OK">OK</button>').appendTo(this.$image_editor),this.$popup_editor.append(this.$image_editor),this.bindCommandEvents(this.$image_editor),this.bindDropdownEvents(this.$image_editor)},a.Editable.prototype.displayImage=function(a,b){var c=a.parents("span.f-img-editor");c.removeClass("fr-dii fr-dib").addClass(b),this.triggerEvent("imageDisplayed",[a,b]),a.click()},a.Editable.prototype.floatImageLeft=function(a){var b=a.parents("span.f-img-editor");b.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fil"),this.isImage&&this.$element.css("float","left"),this.triggerEvent("imageFloatedLeft",[a]),a.click()},a.Editable.prototype.floatImageNone=function(a){var b=a.parents("span.f-img-editor");b.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fin"),this.isImage||(b.parent().get(0)==this.$element.get(0)?b.wrap('<div style="text-align: center;"></div>'):b.parents(".f-img-wrap:first").css("text-align","center")),this.isImage&&this.$element.css("float","none"),this.triggerEvent("imageFloatedNone",[a]),a.click()},a.Editable.prototype.floatImageRight=function(a){var b=a.parents("span.f-img-editor");b.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fir"),this.isImage&&this.$element.css("float","right"),this.triggerEvent("imageFloatedRight",[a]),a.click()},a.Editable.prototype.linkImage=function(a){this.imageMode=!0,this.showInsertLink();var b=a.parents("span.f-img-editor");"A"==b.parent().get(0).tagName?this.updateLinkValues(b.parent()):this.resetLinkValues()},a.Editable.prototype.replaceImage=function(a){this.showInsertImage(),this.imageMode=!0,this.$image_wrapper.find('input[type="text"]').val(a.attr("src")),this.showByCoordinates(a.offset().left+a.width()/2,a.offset().top+a.height())},a.Editable.prototype.removeImage=function(b){var c=b.parents("span.f-img-editor");if(0===c.length)return!1;var d=b.get(0),e="Are you sure? Image will be deleted.";if(a.Editable.LANGS[this.options.language]&&(e=a.Editable.LANGS[this.options.language].translation[e]),!this.options.imageDeleteConfirmation||confirm(e)){if(this.triggerEvent("beforeRemoveImage",[a(d)],!1)){var f=c.parents(this.valid_nodes.join(","));c.parents(".f-img-wrap").length?c.parents(".f-img-wrap").remove():c.remove(),this.refreshImageList(!0),this.hide(),f.length&&f[0]!=this.$element.get(0)&&""===a(f[0]).text()&&1==f[0].childNodes.length&&a(f[0]).remove(),this.wrapText(),this.triggerEvent("afterRemoveImage",[b]),this.focus(),this.imageMode=!1}}else b.click()},a.Editable.prototype.setImageAlt=function(){var a=this.$element.find("span.f-img-editor"),b=a.find("img");b.attr("alt",this.$image_editor.find('.f-image-alt input[type="text"]').val()),b.attr("title",this.$image_editor.find('.f-image-alt input[type="text"]').val()),this.hide(),this.closeImageMode(),this.triggerEvent("imageAltSet",[b])},a.Editable.prototype.buildImageMove=function(){var b=this;this.isLink||this.initDrag(),b.$element.on("dragover dragenter dragend",function(a){a.preventDefault()}),b.$element.on("drop",function(c){if(b.isDisabled)return!1;if(b.closeImageMode(),b.hide(),b.imageMode=!1,b.initialized||(b.$element.unbind("mousedown.element"),b.lateInit()),!b.options.imageUpload||0!==a(".froala-element img.fr-image-move").length){if(a(".froala-element .fr-image-move").length>0&&b.options.imageMove){c.preventDefault(),c.stopPropagation(),b.insertMarkersAtPoint(c.originalEvent),b.restoreSelectionByMarkers();var d=a("<div>").append(a(".froala-element img.fr-image-move").clone().removeClass("fr-image-move").addClass("fr-image-dropped")).html();b.insertHTML(d);var e=a(".froala-element img.fr-image-move").parent();a(".froala-element img.fr-image-move").remove(),e.get(0)!=b.$element.get(0)&&e.is(":empty")&&e.remove(),b.clearSelection(),b.initialized?setTimeout(function(){b.$element.find(".fr-image-dropped").removeClass(".fr-image-dropped").click()},0):b.$element.find(".fr-image-dropped").removeClass(".fr-image-dropped"),b.sync(),b.hideOtherEditors()}else c.preventDefault(),c.stopPropagation(),a(".froala-element img.fr-image-move").removeClass("fr-image-move");return!1}if(c.originalEvent.dataTransfer&&c.originalEvent.dataTransfer.files&&c.originalEvent.dataTransfer.files.length){if(b.isDisabled)return!1;var f=c.originalEvent.dataTransfer.files;b.options.allowedImageTypes.indexOf(f[0].type.replace(/image\//g,""))>=0&&(b.insertMarkersAtPoint(c.originalEvent),b.showByCoordinates(c.originalEvent.pageX,c.originalEvent.pageY),b.uploadImage(f),c.preventDefault(),c.stopPropagation())}})},a.Editable.prototype.buildDragUpload=function(){var b=this;b.$image_wrapper.on("dragover","#f-upload-div-"+this._id,function(){return a(this).addClass("f-hover"),!1}),b.$image_wrapper.on("dragend","#f-upload-div-"+this._id,function(){return a(this).removeClass("f-hover"),!1}),b.$image_wrapper.on("drop","#f-upload-div-"+this._id,function(c){return c.preventDefault(),c.stopPropagation(),b.options.imageUpload?(a(this).removeClass("f-hover"),void b.uploadImage(c.originalEvent.dataTransfer.files)):!1})},a.Editable.prototype.showImageLoader=function(b){if(void 0===b&&(b=!1),b){var c="Please wait!";a.Editable.LANGS[this.options.language]&&(c=a.Editable.LANGS[this.options.language].translation[c]),this.$progress_bar.find("span").css("width","100%").text(c)}else this.$image_wrapper.find("h4").addClass("uploading");this.$image_wrapper.find("#f-image-list-"+this._id).hide(),this.$progress_bar.show(),this.showInsertImage()},a.Editable.prototype.hideImageLoader=function(){this.$progress_bar.hide(),this.$progress_bar.find("span").css("width","0%").text(""),this.$image_wrapper.find("#f-image-list-"+this._id).show(),this.$image_wrapper.find("h4").removeClass("uploading")},a.Editable.prototype.writeImage=function(b,c,d){if(c&&(b=this.sanitizeURL(b),""===b))return!1;var e=new Image;e.onerror=a.proxy(function(){this.hideImageLoader(),this.throwImageError(1)},this),e.onload=this.imageMode?a.proxy(function(){var a=this.$element.find(".f-img-editor > img");a.attr("src",b),this.hide(),this.hideImageLoader(),this.$image_editor.show(),this.enable(),this.triggerEvent("imageReplaced",[a,d]),setTimeout(function(){a.trigger("click")},0)},this):a.proxy(function(){this.insertLoadedImage(b,d)},this),this.showImageLoader(!0),e.src=b},a.Editable.prototype.processInsertImage=function(b,c){void 0===c&&(c=!0),this.enable(),this.focus(),this.restoreSelection();var d="";parseInt(this.options.defaultImageWidth,10)&&(d=' width="'+this.options.defaultImageWidth+'"');var e="fr-fin";"left"==this.options.defaultImageAlignment&&(e="fr-fil"),"right"==this.options.defaultImageAlignment&&(e="fr-fir"),e+=" fr-di"+this.options.defaultImageDisplay[0];var f='<img class="'+e+' fr-just-inserted" alt="'+this.options.defaultImageTitle+'" src="'+b+'"'+d+">",g=this.getSelectionElements()[0],h=this.getRange(),i=!this.browser.msie&&a.Editable.getIEversion()>8?a(h.startContainer):null;i&&i.hasClass("f-img-wrap")?(1===h.startOffset?(i.after("<"+this.options.defaultTag+'><span class="f-marker" data-type="true" data-id="0"></span><br/><span class="f-marker" data-type="false" data-id="0"></span></'+this.options.defaultTag+">"),this.restoreSelectionByMarkers(),this.getSelection().collapseToStart()):0===h.startOffset&&(i.before("<"+this.options.defaultTag+'><span class="f-marker" data-type="true" data-id="0"></span><br/><span class="f-marker" data-type="false" data-id="0"></span></'+this.options.defaultTag+">"),this.restoreSelectionByMarkers(),this.getSelection().collapseToStart()),this.insertHTML(f)):this.getSelectionTextInfo(g).atStart&&g!=this.$element.get(0)&&"TD"!=g.tagName&&"TH"!=g.tagName&&"LI"!=g.tagName?a(g).before("<"+this.options.defaultTag+">"+f+"</"+this.options.defaultTag+">"):this.insertHTML(f),this.disable()},a.Editable.prototype.insertLoadedImage=function(b,c){this.triggerEvent("imageLoaded",[b],!1),this.processInsertImage(b,!1),this.browser.msie&&this.$element.find("img").each(function(a,b){b.oncontrolselect=function(){return!1}}),this.enable(),this.hide(),this.hideImageLoader(),this.wrapText(),this.cleanupLists();var d,e=this.$element.find("img.fr-just-inserted").get(0);e&&(d=e.previousSibling),d&&3==d.nodeType&&/\u200B/gi.test(d.textContent)&&a(d).remove(),this.triggerEvent("imageInserted",[this.$element.find("img.fr-just-inserted"),c]),setTimeout(a.proxy(function(){this.$element.find("img.fr-just-inserted").removeClass("fr-just-inserted").trigger("touchend")},this),50)},a.Editable.prototype.throwImageErrorWithMessage=function(a){this.enable(),this.triggerEvent("imageError",[{message:a,code:0}],!1),this.hideImageLoader()},a.Editable.prototype.throwImageError=function(a){this.enable();var b="Unknown image upload error.";1==a?b="Bad link.":2==a?b="No link in upload response.":3==a?b="Error during file upload.":4==a?b="Parsing response failed.":5==a?b="Image too large.":6==a?b="Invalid image type.":7==a&&(b="Image can be uploaded only to same domain in IE 8 and IE 9."),this.triggerEvent("imageError",[{code:a,message:b}],!1),this.hideImageLoader()},a.Editable.prototype.uploadImage=function(b){if(!this.triggerEvent("beforeImageUpload",[b],!1))return!1;if(void 0!==b&&b.length>0){var c;if(this.drag_support.formdata&&(c=this.drag_support.formdata?new FormData:null),c){var d;for(d in this.options.imageUploadParams)c.append(d,this.options.imageUploadParams[d]);if(this.options.imageUploadToS3!==!1){for(d in this.options.imageUploadToS3.params)c.append(d,this.options.imageUploadToS3.params[d]);c.append("success_action_status","201"),c.append("X-Requested-With","xhr"),c.append("Content-Type",b[0].type),c.append("key",this.options.imageUploadToS3.keyStart+(new Date).getTime()+"-"+b[0].name)}if(c.append(this.options.imageUploadParam,b[0]),b[0].size>this.options.maxImageSize)return this.throwImageError(5),!1;if(this.options.allowedImageTypes.indexOf(b[0].type.replace(/image\//g,""))<0)return this.throwImageError(6),!1}if(c){var e;if(this.options.crossDomain)e=this.createCORSRequest("POST",this.options.imageUploadURL);else{e=new XMLHttpRequest,e.open("POST",this.options.imageUploadURL);for(var f in this.options.headers)e.setRequestHeader(f,this.options.headers[f])}e.onload=a.proxy(function(){var b="Please wait!";a.Editable.LANGS[this.options.language]&&(b=a.Editable.LANGS[this.options.language].translation[b]),this.$progress_bar.find("span").css("width","100%").text(b);try{if(this.options.imageUploadToS3)201==e.status?this.parseImageResponseXML(e.responseXML):this.throwImageError(3);else if(e.status>=200&&e.status<300)this.parseImageResponse(e.responseText);else try{var c=a.parseJSON(e.responseText);c.error?this.throwImageErrorWithMessage(c.error):this.throwImageError(3)}catch(d){this.throwImageError(3)}}catch(d){this.throwImageError(4)}},this),e.onerror=a.proxy(function(){this.throwImageError(3)},this),e.upload.onprogress=a.proxy(function(a){if(a.lengthComputable){var b=a.loaded/a.total*100|0;this.$progress_bar.find("span").css("width",b+"%")}},this),this.disable(),e.send(c),this.showImageLoader()}}},a.Editable.prototype.parseImageResponse=function(b){try{if(!this.triggerEvent("afterImageUpload",[b],!1))return!1;var c=a.parseJSON(b);c.link?this.writeImage(c.link,!1,b):c.error?this.throwImageErrorWithMessage(c.error):this.throwImageError(2)}catch(d){this.throwImageError(4)}},a.Editable.prototype.parseImageResponseXML=function(b){try{var c=a(b).find("Location").text(),d=a(b).find("Key").text();this.options.imageUploadToS3.callback&&this.options.imageUploadToS3.callback.call(this,c,d),c?this.writeImage(c):this.throwImageError(2)}catch(e){this.throwImageError(4)}},a.Editable.prototype.setImageUploadURL=function(a){a&&(this.options.imageUploadURL=a),this.options.imageUploadToS3&&(this.options.imageUploadURL="https://"+this.options.imageUploadToS3.bucket+"."+this.options.imageUploadToS3.region+".amazonaws.com/")},a.Editable.prototype.closeImageMode=function(){this.$element.find("span.f-img-editor > img").each(a.proxy(function(b,c){a(c).removeClass("fr-fin fr-fil fr-fir fr-dib fr-dii").addClass(this.getImageClass(a(c).parent().attr("class"))),a(c).parents(".f-img-wrap").length>0?"A"==a(c).parent().parent().get(0).tagName?a(c).siblings("span.f-img-handle").remove().end().unwrap().parent().unwrap():a(c).siblings("span.f-img-handle").remove().end().unwrap().unwrap():a(c).siblings("span.f-img-handle").remove().end().unwrap()},this)),this.$element.find("span.f-img-editor").length&&(this.$element.find("span.f-img-editor").remove(),this.$element.parents("span.f-img-editor").remove()),this.$element.removeClass("f-non-selectable"),this.editableDisabled||this.isHTML||this.$element.attr("contenteditable",!0),this.$image_editor&&this.$image_editor.hide(),this.$link_wrapper&&this.options.linkText&&this.$link_wrapper.find('input[type="text"].f-lt').parent().removeClass("fr-hidden")},a.Editable.prototype.refreshImageList=function(b){if(!this.isLink&&!this.options.editInPopup){var c=[],d=[],e=this;if(this.$element.find("img").each(function(b,f){var g=a(f);if(c.push(g.attr("src")),d.push(g),"false"==g.attr("contenteditable"))return!0;if(0!==g.parents(".f-img-editor").length||g.hasClass("fr-dii")||g.hasClass("fr-dib")||(e.options.textNearImage?g.addClass(g.hasClass("fr-fin")?"fr-dib":g.hasClass("fr-fil")||g.hasClass("fr-fir")?"fr-dii":"block"==g.css("display")&&"none"==g.css("float")?"fr-dib":"fr-dii"):(g.addClass("fr-dib"),e.options.imageButtons.splice(e.options.imageButtons.indexOf("display"),1))),e.options.textNearImage||g.removeClass("fr-dii").addClass("fr-dib"),0===g.parents(".f-img-editor").length&&!g.hasClass("fr-fil")&&!g.hasClass("fr-fir")&&!g.hasClass("fr-fin"))if(g.hasClass("fr-dii"))g.addClass("right"==g.css("float")?"fr-fir":"left"==g.css("float")?"fr-fil":"fr-fin");else{var h=g.attr("style");g.hide(),g.addClass(0===parseInt(g.css("margin-right"),10)&&h?"fr-fir":0===parseInt(g.css("margin-left"),10)&&h?"fr-fil":"fr-fin"),g.show()}g.css("margin",""),g.css("float",""),g.css("display",""),g.removeAttr("data-style")}),void 0===b)for(var f=0;f<this.imageList.length;f++)c.indexOf(this.imageList[f].attr("src"))<0&&this.triggerEvent("afterRemoveImage",[this.imageList[f]],!1);this.imageList=d}},a.Editable.prototype.insertImage=function(){this.options.inlineMode||(this.closeImageMode(),this.imageMode=!1,this.positionPopup("insertImage")),this.selectionInEditor()&&this.saveSelection(),this.showInsertImage(),this.imageMode=!1,this.$image_wrapper.find('input[type="text"]').val("")}}(jQuery),function(a){a.Editable.prototype.showLinkWrapper=function(){this.$link_wrapper&&(this.$link_wrapper.show(),this.$link_wrapper.trigger("hideLinkList"),this.$link_wrapper.trigger("hideLinkClassList"),this.$link_wrapper.find("input.f-lu").removeClass("fr-error"),this.imageMode||!this.options.linkText?this.$link_wrapper.find('input[type="text"].f-lt').parent().addClass("fr-hidden"):this.$link_wrapper.find('input[type="text"].f-lt').parent().removeClass("fr-hidden"),this.imageMode&&this.$link_wrapper.find('input[type="text"].f-lu').removeAttr("disabled"),this.phone()?this.$document.scrollTop(this.$link_wrapper.offset().top+30):setTimeout(a.proxy(function(){this.imageMode&&this.iPad()||this.$link_wrapper.find('input[type="text"].f-lu').focus().select()},this),0),this.link=!0),this.refreshDisabledState()},a.Editable.prototype.hideLinkWrapper=function(){this.$link_wrapper&&(this.$link_wrapper.hide(),this.$link_wrapper.find("input").blur()),this.refreshDisabledState()},a.Editable.prototype.showInsertLink=function(){this.hidePopups(),this.showLinkWrapper()},a.Editable.prototype.updateLinkValues=function(b){var c=b.attr("href")||"http://";this.$link_wrapper.find("input.f-lt").val(b.text()),this.isLink?("#"==c&&(c=""),this.$link_wrapper.find("input#f-lu-"+this._id).val(c.replace(/\&amp;/g,"&")),this.$link_wrapper.find(".f-external-link").attr("href",c||"#")):(this.$link_wrapper.find("input.f-lu").val(c.replace(/\&amp;/g,"&")),this.$link_wrapper.find(".f-external-link").attr("href",c)),this.$link_wrapper.find("input.f-target").prop("checked","_blank"==b.attr("target")),this.$link_wrapper.find("li.f-choose-link-class").each(a.proxy(function(c,d){b.hasClass(a(d).data("class"))&&a(d).click()},this));for(var d in this.options.linkAttributes){var e=b.attr(d);this.$link_wrapper.find("input.fl-"+d).val(e?e:"")}this.$link_wrapper.find("a.f-external-link, button.f-unlink").show()},a.Editable.prototype.initLinkEvents=function(){var b=this,c=function(a){a.stopPropagation(),a.preventDefault()},d=function(c){return c.stopPropagation(),c.preventDefault(),b.isDisabled?!1:""!==b.text()?(b.hide(),!1):(b.link=!0,b.clearSelection(),b.removeMarkers(),b.selectionDisabled||(a(this).before('<span class="f-marker" data-type="true" data-id="0" data-fr-verified="true"></span>'),a(this).after('<span class="f-marker" data-type="false" data-id="0" data-fr-verified="true"></span>'),b.restoreSelectionByMarkers()),b.exec("createLink"),b.updateLinkValues(a(this)),b.showByCoordinates(a(this).offset().left+a(this).outerWidth()/2,a(this).offset().top+(parseInt(a(this).css("padding-top"),10)||0)+a(this).height()),b.showInsertLink(),a(this).hasClass("fr-file")?b.$link_wrapper.find("input.f-lu").attr("disabled","disabled"):b.$link_wrapper.find("input.f-lu").removeAttr("disabled"),void b.closeImageMode())};this.$element.on("mousedown","a",a.proxy(function(a){this.isResizing()||a.stopPropagation()},this)),this.isLink?this.iOS()?(this.$element.on("touchstart",c),this.$element.on("touchend",d)):this.$element.on("click",d):this.iOS()?(this.$element.on("touchstart",'a:not([contenteditable="false"])',c),this.$element.on("touchend",'a:not([contenteditable="false"])',d),this.$element.on("touchstart",'a[contenteditable="false"]',c),this.$element.on("touchend",'a[contenteditable="false"]',c)):(this.$element.on("click",'a:not([contenteditable="false"])',d),this.$element.on("click",'a[contenteditable="false"]',c))},a.Editable.prototype.destroyLink=function(){this.$link_wrapper.html("").removeData().remove()},a.Editable.prototype.initLink=function(){this.buildCreateLink(),this.initLinkEvents(),this.addListener("destroy",this.destroyLink)},a.Editable.initializers.push(a.Editable.prototype.initLink),a.Editable.prototype.removeLink=function(){this.imageMode?("A"==this.$element.find(".f-img-editor").parent().get(0).tagName&&a(this.$element.find(".f-img-editor").get(0)).unwrap(),this.triggerEvent("imageLinkRemoved"),this.showImageEditor(),this.$element.find(".f-img-editor").find("img").click(),this.link=!1):(this.restoreSelection(),this.document.execCommand("unlink",!1,null),this.isLink||this.$element.find("a:empty").remove(),this.triggerEvent("linkRemoved"),this.hideLinkWrapper(),this.$bttn_wrapper.show(),(!this.options.inlineMode||this.isLink)&&this.hide(),this.link=!1)},a.Editable.prototype.writeLink=function(b,c,d,e,f){var g,h=this.options.noFollow;this.options.alwaysBlank&&(e=!0);var i,j="",k="",l="";h===!0&&/^https?:\/\//.test(b)&&(j='rel="nofollow"'),e===!0&&(k='target="_blank"');for(i in f)l+=" "+i+'="'+f[i]+'"';var m=b;if(b=this.sanitizeURL(b),this.options.convertMailAddresses){var n=/^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/i;n.test(b)&&0!==b.indexOf("mailto:")&&(b="mailto:"+b)}if(0===b.indexOf("mailto:")||""===this.options.linkAutoPrefix||/^(https?:|ftps?:|)\/\//.test(b)||(b=this.options.linkAutoPrefix+b),""===b)return this.$link_wrapper.find("input.f-lu").addClass("fr-error").focus(),this.triggerEvent("badLink",[m],!1),!1;if(this.$link_wrapper.find("input.f-lu").removeClass("fr-error"),this.imageMode){if("A"!=this.$element.find(".f-img-editor").parent().get(0).tagName)this.$element.find(".f-img-editor").wrap('<a data-fr-link="true" href="'+b+'" '+k+" "+j+l+"></a>");else{var o=this.$element.find(".f-img-editor").parent();e===!0?o.attr("target","_blank"):o.removeAttr("target"),h===!0?o.attr("rel","nofollow"):o.removeAttr("rel");for(i in f)f[i]?o.attr(i,f[i]):o.removeAttr(i);o.removeClass(Object.keys(this.options.linkClasses).join(" ")),o.attr("href",b).addClass(d)}this.triggerEvent("imageLinkInserted",[b]),this.showImageEditor(),this.$element.find(".f-img-editor").find("img").click(),this.link=!1}else{var p=null;this.isLink?""===c&&(c=this.$element.text()):(this.restoreSelection(),g=this.getSelectionLinks(),g.length>0&&(p=g[0].attributes,is_file=a(g[0]).hasClass("fr-file")),this.saveSelectionByMarkers(),this.document.execCommand("unlink",!1,b),this.$element.find('span[data-fr-link="true"]').each(function(b,c){a(c).replaceWith(a(c).html())}),this.restoreSelectionByMarkers()),this.isLink?(this.$element.text(c),g=[this.$element.attr("href",b).get(0)]):(this.removeMarkers(),(this.options.linkText||""===this.text())&&(this.insertHTML('<span class="f-marker" data-fr-verified="true" data-id="0" data-type="true"></span>'+(c||this.clean(m))+'<span class="f-marker" data-fr-verified="true" data-id="0" data-type="false"></span>'),this.restoreSelectionByMarkers()),this.document.execCommand("createLink",!1,b),g=this.getSelectionLinks());for(var q=0;q<g.length;q++){if(p)for(var r=0;r<p.length;r++)"href"!=p[r].nodeName&&a(g[q]).attr(p[r].nodeName,p[r].value);e===!0?a(g[q]).attr("target","_blank"):a(g[q]).removeAttr("target"),h===!0&&/^https?:\/\//.test(b)?a(g[q]).attr("rel","nofollow"):a(g[q]).removeAttr("rel"),a(g[q]).data("fr-link",!0),a(g[q]).removeClass(Object.keys(this.options.linkClasses).join(" ")),a(g[q]).addClass(d);for(i in f)f[i]?a(g[q]).attr(i,f[i]):a(g[q]).removeAttr(i)}this.$element.find("a:empty").remove(),this.triggerEvent("linkInserted",[b]),this.hideLinkWrapper(),this.$bttn_wrapper.show(),(!this.options.inlineMode||this.isLink)&&this.hide(),this.link=!1}},a.Editable.prototype.createLinkHTML=function(){var a='<div class="froala-popup froala-link-popup" style="display: none;">';a+='<h4><span data-text="true">Insert Link</span><a target="_blank" title="Open Link" class="f-external-link" href="#"><i class="fa fa-external-link"></i></a><i title="Cancel" class="fa fa-times" id="f-link-close-'+this._id+'"></i></h4>',a+='<div class="f-popup-line fr-hidden"><input type="text" placeholder="Text" class="f-lt" id="f-lt-'+this._id+'"></div>';var b="";if(this.options.linkList.length&&(b="f-bi"),a+='<div class="f-popup-line"><input type="text" placeholder="http://www.example.com" class="f-lu '+b+'" id="f-lu-'+this._id+'"/>',this.options.linkList.length){a+='<button class="fr-p-bttn f-browse-links" id="f-browse-links-'+this._id+'"><i class="fa fa-chevron-down"></i></button>',a+='<ul id="f-link-list-'+this._id+'">';for(var c=0;c<this.options.linkList.length;c++){var d=this.options.linkList[c],e="";for(var f in d)e+=" data-"+f+'="'+d[f]+'"';a+='<li class="f-choose-link"'+e+">"+d.body+"</li>"}a+="</ul>"}if(a+="</div>",Object.keys(this.options.linkClasses).length){a+='<div class="f-popup-line"><input type="text" placeholder="Choose link type" class="f-bi" id="f-luc-'+this._id+'" disabled="disabled"/>',a+='<button class="fr-p-bttn f-browse-links" id="f-links-class-'+this._id+'"><i class="fa fa-chevron-down"></i></button>',a+='<ul id="f-link-class-list-'+this._id+'">';for(var g in this.options.linkClasses){var h=this.options.linkClasses[g];a+='<li class="f-choose-link-class" data-class="'+g+'">'+h+"</li>"}a+="</ul>",a+="</div>"}for(var i in this.options.linkAttributes){var j=this.options.linkAttributes[i];a+='<div class="f-popup-line"><input class="fl-'+i+'" type="text" placeholder="'+j+'" id="fl-'+i+"-"+this._id+'"/></div>'}return a+='<div class="f-popup-line"><input type="checkbox" class="f-target" id="f-target-'+this._id+'"> <label data-text="true" for="f-target-'+this._id+'">Open in new tab</label><button data-text="true" type="button" class="fr-p-bttn f-ok f-submit" id="f-ok-'+this._id+'">OK</button>',this.options.unlinkButton&&(a+='<button type="button" data-text="true" class="fr-p-bttn f-ok f-unlink" id="f-unlink-'+this._id+'">UNLINK</button>'),a+="</div></div>"},a.Editable.prototype.buildCreateLink=function(){this.$link_wrapper=a(this.createLinkHTML()),this.$popup_editor.append(this.$link_wrapper);var b=this;this.addListener("hidePopups",this.hideLinkWrapper),this.$link_wrapper.on("mouseup touchend",a.proxy(function(a){this.isResizing()||(a.stopPropagation(),this.$link_wrapper.trigger("hideLinkList"))},this)),this.$link_wrapper.on("click",function(a){a.stopPropagation()}),this.$link_wrapper.on("click","*",function(a){a.stopPropagation()}),this.options.linkText&&this.$link_wrapper.on("mouseup keydown","input#f-lt-"+this._id,a.proxy(function(a){var b=a.which;b&&27===b||a.stopPropagation(),this.$link_wrapper.trigger("hideLinkList"),this.$link_wrapper.trigger("hideLinkClassList")},this)),this.$link_wrapper.on("mouseup keydown touchend touchstart","input#f-lu-"+this._id,a.proxy(function(a){var b=a.which;b&&27===b||a.stopPropagation(),this.$link_wrapper.trigger("hideLinkList"),this.$link_wrapper.trigger("hideLinkClassList")},this)),this.$link_wrapper.on("click keydown","input#f-target-"+this._id,function(a){var b=a.which;b&&27===b||a.stopPropagation()}),this.$link_wrapper.on("touchend","button#f-ok-"+this._id,function(a){a.stopPropagation()}).on("click","button#f-ok-"+this._id,a.proxy(function(){var a,b=this.$link_wrapper.find("input#f-lt-"+this._id),c=this.$link_wrapper.find("input#f-lu-"+this._id),d=this.$link_wrapper.find("input#f-luc-"+this._id),e=this.$link_wrapper.find("input#f-target-"+this._id);a=b?b.val():"";var f=c.val();this.isLink&&""===f&&(f="#");var g="";d&&(g=d.data("class"));var h={};for(var i in this.options.linkAttributes)h[i]=this.$link_wrapper.find("input#fl-"+i+"-"+this._id).val();this.writeLink(f,a,g,e.prop("checked"),h)},this)),this.$link_wrapper.on("click touch","button#f-unlink-"+this._id,a.proxy(function(){this.link=!0,this.removeLink()},this)),this.options.linkList.length&&(this.$link_wrapper.on("click touch","li.f-choose-link",function(){b.resetLinkValues();var c=b.$link_wrapper.find("button#f-browse-links-"+b._id),d=b.$link_wrapper.find("input#f-lt-"+b._id),e=b.$link_wrapper.find("input#f-lu-"+b._id),f=b.$link_wrapper.find("input#f-target-"+b._id);d&&d.val(a(this).data("body")),e.val(a(this).data("href")),f.prop("checked",a(this).data("blank"));for(var g in b.options.linkAttributes)a(this).data(g)&&b.$link_wrapper.find("input#fl-"+g+"-"+b._id).val(a(this).data(g));c.click()}).on("mouseup","li.f-choose-link",function(a){a.stopPropagation()}),this.$link_wrapper.on("click","button#f-browse-links-"+this._id+", button#f-browse-links-"+this._id+" > i",function(c){c.stopPropagation();var d=b.$link_wrapper.find("ul#f-link-list-"+b._id);b.$link_wrapper.trigger("hideLinkClassList"),a(this).find("i").toggleClass("fa-chevron-down"),a(this).find("i").toggleClass("fa-chevron-up"),d.toggle()}).on("mouseup","button#f-browse-links-"+this._id+", button#f-browse-links-"+this._id+" > i",function(a){a.stopPropagation()}),this.$link_wrapper.bind("hideLinkList",function(){var a=b.$link_wrapper.find("ul#f-link-list-"+b._id),c=b.$link_wrapper.find("button#f-browse-links-"+b._id);a&&a.is(":visible")&&c.click()})),Object.keys(this.options.linkClasses).length&&(this.$link_wrapper.on("mouseup keydown","input#f-luc-"+this._id,a.proxy(function(a){var b=a.which;b&&27===b||a.stopPropagation(),this.$link_wrapper.trigger("hideLinkList"),this.$link_wrapper.trigger("hideLinkClassList")},this)),this.$link_wrapper.on("click touch","li.f-choose-link-class",function(){var c=b.$link_wrapper.find("input#f-luc-"+b._id);c.val(a(this).text()),c.data("class",a(this).data("class")),b.$link_wrapper.trigger("hideLinkClassList")}).on("mouseup","li.f-choose-link-class",function(a){a.stopPropagation()}),this.$link_wrapper.on("click","button#f-links-class-"+this._id,function(c){c.stopPropagation(),b.$link_wrapper.trigger("hideLinkList");var d=b.$link_wrapper.find("ul#f-link-class-list-"+b._id);a(this).find("i").toggleClass("fa-chevron-down"),a(this).find("i").toggleClass("fa-chevron-up"),d.toggle()}).on("mouseup","button#f-links-class-"+this._id,function(a){a.stopPropagation()}),this.$link_wrapper.bind("hideLinkClassList",function(){var a=b.$link_wrapper.find("ul#f-link-class-list-"+b._id),c=b.$link_wrapper.find("button#f-links-class-"+b._id);a&&a.is(":visible")&&c.click()})),this.$link_wrapper.on(this.mouseup,"i#f-link-close-"+this._id,a.proxy(function(){this.$bttn_wrapper.show(),this.hideLinkWrapper(),(!this.options.inlineMode&&!this.imageMode||this.isLink||0===this.options.buttons.length)&&this.hide(),this.imageMode?this.showImageEditor():(this.restoreSelection(),this.focus())},this))},a.Editable.prototype.getSelectionLinks=function(){var a,b,c,d,e=[];if(this.window.getSelection){var f=this.window.getSelection();if(f.getRangeAt&&f.rangeCount){d=this.document.createRange();for(var g=0;g<f.rangeCount;++g)if(a=f.getRangeAt(g),b=a.commonAncestorContainer,b&&1!=b.nodeType&&(b=b.parentNode),b&&"a"==b.nodeName.toLowerCase())e.push(b);else{c=b.getElementsByTagName("a");for(var h=0;h<c.length;++h)d.selectNodeContents(c[h]),d.compareBoundaryPoints(a.END_TO_START,a)<1&&d.compareBoundaryPoints(a.START_TO_END,a)>-1&&e.push(c[h])}}}else if(this.document.selection&&"Control"!=this.document.selection.type)if(a=this.document.selection.createRange(),b=a.parentElement(),"a"==b.nodeName.toLowerCase())e.push(b);else{c=b.getElementsByTagName("a"),d=this.document.body.createTextRange();for(var i=0;i<c.length;++i)d.moveToElementText(c[i]),d.compareEndPoints("StartToEnd",a)>-1&&d.compareEndPoints("EndToStart",a)<1&&e.push(c[i])}return e},a.Editable.prototype.resetLinkValues=function(){this.$link_wrapper.find("input").val(""),this.$link_wrapper.find('input[type="checkbox"].f-target').prop("checked",this.options.alwaysBlank),this.$link_wrapper.find('input[type="text"].f-lt').val(this.text()),this.$link_wrapper.find('input[type="text"].f-lu').val("http://"),this.$link_wrapper.find('input[type="text"].f-lu').removeAttr("disabled"),this.$link_wrapper.find("a.f-external-link, button.f-unlink").hide();for(var a in this.options.linkAttributes)this.$link_wrapper.find('input[type="text"].fl-'+a).val("")},a.Editable.prototype.insertLink=function(){this.options.inlineMode||(this.closeImageMode(),this.imageMode=!1,this.positionPopup("createLink")),this.selectionInEditor()&&this.saveSelection(),this.showInsertLink();var b=this.getSelectionLinks();b.length>0?this.updateLinkValues(a(b[0])):this.resetLinkValues()}}(jQuery),function(a){a.Editable.prototype.browserFixes=function(){this.backspaceEmpty(),this.backspaceInEmptyBlock(),this.fixHR(),this.domInsert(),this.fixIME(),this.cleanInvisibleSpace(),this.cleanBR(),this.insertSpace()},a.Editable.prototype.backspaceInEmptyBlock=function(){this.$element.on("keyup",a.proxy(function(b){var c=b.which;if(this.browser.mozilla&&!this.isHTML&&8==c){var d=a(this.getSelectionElement());this.valid_nodes.indexOf(d.get(0).tagName)>=0&&1==d.find("*").length&&""===d.text()&&1==d.find("br").length&&this.setSelection(d.get(0))}},this))},a.Editable.prototype.insertSpace=function(){this.browser.mozilla&&this.$element.on("keypress",a.proxy(function(a){var b=a.which,c=this.getSelectionElements()[0];this.isHTML||32!=b||"PRE"==c.tagName||(a.preventDefault(),this.insertSimpleHTML("&nbsp;"))},this))},a.Editable.prototype.cleanBR=function(){this.$element.on("keyup",a.proxy(function(){this.$element.find(this.valid_nodes.join(",")).each(a.proxy(function(b,c){if(["TH","TD","LI"].indexOf(c.tagName)>=0)return!0;
var d=c.childNodes,e=null;if(!d.length||"BR"!=d[d.length-1].tagName)return!0;e=d[d.length-1];var f=e.previousSibling;f&&"BR"!=f.tagName&&a(e).parent().text().length>0&&this.valid_nodes.indexOf(f.tagName)<0&&a(e).remove()},this))},this))},a.Editable.prototype.replaceU200B=function(b){for(var c=0;c<b.length;c++)3==b[c].nodeType&&/\u200B/gi.test(b[c].textContent)?b[c].textContent=b[c].textContent.replace(/\u200B/gi,""):1==b[c].nodeType&&this.replaceU200B(a(b[c]).contents())},a.Editable.prototype.cleanInvisibleSpace=function(){var b=function(b){var c=a(b).text();return b&&/\u200B/.test(a(b).text())&&c.replace(/\u200B/gi,"").length>0?!0:!1};this.$element.on("keyup",a.proxy(function(){var c=this.getSelectionElement();b(c)&&0===a(c).find("li").length&&(this.saveSelectionByMarkers(),this.replaceU200B(a(c).contents()),this.restoreSelectionByMarkers())},this))},a.Editable.prototype.fixHR=function(){this.$element.on("keypress",a.proxy(function(b){var c=a(this.getSelectionElement());if(c.is("hr")||c.parents("hr").length)return!1;var d=b.which;if(8==d){var e=a(this.getSelectionElements()[0]);e.prev().is("hr")&&this.getSelectionTextInfo(e.get(0)).atStart&&(this.saveSelectionByMarkers(),e.prev().remove(),this.restoreSelectionByMarkers(),b.preventDefault())}},this))},a.Editable.prototype.backspaceEmpty=function(){this.$element.on("keydown",a.proxy(function(a){var b=a.which;!this.isHTML&&8==b&&this.$element.hasClass("f-placeholder")&&a.preventDefault()},this))},a.Editable.prototype.domInsert=function(){this.$element.on("keydown",a.proxy(function(a){var b=a.which;13===b&&(this.add_br=!0)},this)),this.$element.on("DOMNodeInserted",a.proxy(function(b){if("SPAN"!==b.target.tagName||a(b.target).attr("data-fr-verified")||this.no_verify||this.textEmpty(b.target)||a(b.target).replaceWith(a(b.target).contents()),"BR"===b.target.tagName&&setTimeout(function(){a(b.target).removeAttr("type")},0),"A"===b.target.tagName&&setTimeout(function(){a(b.target).removeAttr("_moz_dirty")},0),this.options.paragraphy&&this.add_br&&"BR"===b.target.tagName&&(a(b.target).prev().length&&"TABLE"===a(b.target).prev().get(0).tagName||a(b.target).next().length&&"TABLE"===a(b.target).next().get(0).tagName)){a(b.target).wrap('<p class="fr-p-wrap">');var c=this.$element.find("p.fr-p-wrap").removeAttr("class");this.setSelection(c.get(0))}"BR"===b.target.tagName&&this.isLastSibling(b.target)&&"LI"==b.target.parentNode.tagName&&this.textEmpty(b.target.parentNode)&&a(b.target).remove()},this)),this.$element.on("keyup",a.proxy(function(a){var b=a.which;8===b&&this.$element.find("span:not([data-fr-verified])").attr("data-fr-verified",!0),13===b&&(this.add_br=!1)},this))},a.Editable.prototype.fixIME=function(){try{this.$element.get(0).msGetInputContext&&(this.$element.get(0).msGetInputContext().addEventListener("MSCandidateWindowShow",a.proxy(function(){this.ime=!0},this)),this.$element.get(0).msGetInputContext().addEventListener("MSCandidateWindowHide",a.proxy(function(){this.ime=!1,this.$element.trigger("keydown"),this.oldHTML=""},this)))}catch(b){}}}(jQuery),function(a){a.Editable.prototype.handleEnter=function(){var b=a.proxy(function(){var b=this.getSelectionElement();return"LI"==b.tagName||this.parents(a(b),"li").length>0?!0:!1},this);this.$element.on("keypress",a.proxy(function(a){if(!this.isHTML&&!b()){var c=a.which;if(13==c&&!a.shiftKey){a.preventDefault(),this.saveUndoStep(),this.insertSimpleHTML("<break></break>");var d=this.getSelectionElements();if(d[0]==this.$element.get(0)?this.enterInMainElement(d[0]):this.enterInElement(d[0]),this.getSelectionTextInfo(this.$element.get(0)).atEnd)this.$wrapper.scrollTop(this.$element.height());else{var e=this.getBoundingRect();this.$wrapper.offset().top+this.$wrapper.height()<e.top+e.height&&this.$wrapper.scrollTop(e.top+this.$wrapper.scrollTop()-(this.$wrapper.height()+this.$wrapper.offset().top)+e.height+10)}}}},this))},a.Editable.prototype.enterInMainElement=function(b){var c=a(b).find("break").get(0);if(a(c).parent().get(0)==b)this.isLastSibling(c)?this.insertSimpleHTML("</br>"+this.markers_html+this.br):a(b).hasClass("f-placeholder")?a(b).html("</br>"+this.markers_html+this.br):this.insertSimpleHTML("</br>"+this.markers_html),a(b).find("break").remove(),this.restoreSelectionByMarkers();else if(a(c).parents(this.$element).length){for(b=this.getSelectionElement();"BREAK"==b.tagName||0===a(b).text().length&&b.parentNode!=this.$element.get(0);)b=b.parentNode;if(this.getSelectionTextInfo(b).atEnd)a(b).after(this.breakEnd(this.getDeepParent(b),!0)),this.$element.find("break").remove(),this.restoreSelectionByMarkers();else if(this.getSelectionTextInfo(b).atStart){for(;c.parentNode!=this.$element.get(0);)c=c.parentNode;a(c).before("<br/>"),this.$element.find("break").remove(),this.$element.find("a:empty").replaceWith(this.markers_html+"<br/>"),this.restoreSelectionByMarkers()}else this.breakMiddle(this.getDeepParent(b),!0),this.restoreSelectionByMarkers()}else a(c).remove()},a.Editable.prototype.enterInElement=function(b){if(["TD","TH"].indexOf(b.tagName)<0){var c=!1;if(this.emptyElement(b)&&b.parentNode&&"BLOCKQUOTE"==b.parentNode.tagName){a(b).before(this.$element.find("break"));var d=b;b=b.parentNode,a(d).remove(),c=!0}this.getSelectionTextInfo(b).atEnd?(a(b).after(this.breakEnd(b),!1),this.$element.find("break").remove(),this.restoreSelectionByMarkers()):this.getSelectionTextInfo(b).atStart?(this.options.paragraphy?c?(a(b).before("<"+this.options.defaultTag+">"+this.markers_html+this.br+"</"+this.options.defaultTag+">"),this.restoreSelectionByMarkers()):a(b).before("<"+this.options.defaultTag+">"+this.br+"</"+this.options.defaultTag+">"):c?(a(b).before(this.markers_html+"<br/>"),this.restoreSelectionByMarkers()):a(b).before("<br/>"),this.$element.find("break").remove()):"PRE"==b.tagName?(this.$element.find("break").after("<br/>"+this.markers_html),this.$element.find("break").remove(),this.restoreSelectionByMarkers()):(this.breakMiddle(b,!1,c),this.restoreSelectionByMarkers())}else this.enterInMainElement(b)},a.Editable.prototype.breakEnd=function(b,c){if(void 0===c&&(c=!1),"BLOCKQUOTE"==b.tagName){var d=a(b).contents();d.length&&"BR"==d[d.length-1].tagName&&a(d[d.length-1]).remove()}var e=a(b).find("break").get(0),f=this.br;this.options.paragraphy||(f="<br/>");var g=this.markers_html+f;for(c&&(g=this.markers_html+a.Editable.INVISIBLE_SPACE);e!=b;)"A"!=e.tagName&&"BREAK"!=e.tagName&&(g="<"+e.tagName+this.attrs(e)+">"+g+"</"+e.tagName+">"),e=e.parentNode;return c&&"A"!=e.tagName&&"BREAK"!=e.tagName&&(g="<"+e.tagName+this.attrs(e)+">"+g+"</"+e.tagName+">"),this.options.paragraphy&&(g="<"+this.options.defaultTag+">"+g+"</"+this.options.defaultTag+">"),c&&(g=f+g),g},a.Editable.prototype.breakMiddle=function(b,c,d){void 0===c&&(c=!1),void 0===d&&(d=!1);var e=a(b).find("break").get(0),f=this.markers_html;d&&(f="");for(var g="";e!=b;)e=e.parentNode,g=g+"</"+e.tagName+">",f="<"+e.tagName+this.attrs(e)+">"+f;var h="";d&&(h=this.options.paragraphy?"<"+this.options.defaultTag+">"+this.markers_html+"<br/></"+this.options.defaultTag+">":this.markers_html+"<br/>");var i="<"+b.tagName+this.attrs(b)+">"+a(b).html()+"</"+b.tagName+">";i=i.replace(/<break><\/break>/,g+(c?this.br:"")+h+f),a(b).replaceWith(i)}}(jQuery),function(a){a.Editable.prototype.isFirstSibling=function(a){var b=a.previousSibling;return b?3==b.nodeType&&""===b.textContent?this.isFirstSibling(b):!1:!0},a.Editable.prototype.isLastSibling=function(a){var b=a.nextSibling;return b?3==b.nodeType&&""===b.textContent?this.isLastSibling(b):!1:!0},a.Editable.prototype.getDeepParent=function(a){return a.parentNode==this.$element.get(0)?a:this.getDeepParent(a.parentNode)},a.Editable.prototype.attrs=function(a){for(var b="",c=a.attributes,d=0;d<c.length;d++){var e=c[d];b+=" "+e.nodeName+'="'+e.value+'"'}return b}}(jQuery),function(a){"function"==typeof define&&define.amd?define(["jquery"],a):a(jQuery)}(function(a,b){function c(a){function b(){d?(c(),M(b),e=!0,d=!1):e=!1}var c=a,d=!1,e=!1;this.kick=function(){d=!0,e||b()},this.end=function(a){var b=c;a&&(e?(c=d?function(){b(),a()}:a,d=!0):a())}}function d(){return!0}function e(){return!1}function f(a){a.preventDefault()}function g(a){N[a.target.tagName.toLowerCase()]||a.preventDefault()}function h(a){return 1===a.which&&!a.ctrlKey&&!a.altKey}function i(a,b){var c,d;if(a.identifiedTouch)return a.identifiedTouch(b);for(c=-1,d=a.length;++c<d;)if(a[c].identifier===b)return a[c]}function j(a,b){var c=i(a.changedTouches,b.identifier);if(c&&(c.pageX!==b.pageX||c.pageY!==b.pageY))return c}function k(a){var b;h(a)&&(b={target:a.target,startX:a.pageX,startY:a.pageY,timeStamp:a.timeStamp},J(document,O.move,l,b),J(document,O.cancel,m,b))}function l(a){var b=a.data;s(a,b,a,n)}function m(){n()}function n(){K(document,O.move,l),K(document,O.cancel,m)}function o(a){var b,c;N[a.target.tagName.toLowerCase()]||(b=a.changedTouches[0],c={target:b.target,startX:b.pageX,startY:b.pageY,timeStamp:a.timeStamp,identifier:b.identifier},J(document,P.move+"."+b.identifier,p,c),J(document,P.cancel+"."+b.identifier,q,c))}function p(a){var b=a.data,c=j(a,b);c&&s(a,b,c,r)}function q(a){var b=a.data,c=i(a.changedTouches,b.identifier);c&&r(b.identifier)}function r(a){K(document,"."+a,p),K(document,"."+a,q)}function s(a,b,c,d){var e=c.pageX-b.startX,f=c.pageY-b.startY;I*I>e*e+f*f||v(a,b,c,e,f,d)}function t(){return this._handled=d,!1}function u(a){try{a._handled()}catch(b){return!1}}function v(a,b,c,d,e,f){{var g,h;b.target}g=a.targetTouches,h=a.timeStamp-b.timeStamp,b.type="movestart",b.distX=d,b.distY=e,b.deltaX=d,b.deltaY=e,b.pageX=c.pageX,b.pageY=c.pageY,b.velocityX=d/h,b.velocityY=e/h,b.targetTouches=g,b.finger=g?g.length:1,b._handled=t,b._preventTouchmoveDefault=function(){a.preventDefault()},L(b.target,b),f(b.identifier)}function w(a){var b=a.data.timer;a.data.touch=a,a.data.timeStamp=a.timeStamp,b.kick()}function x(a){var b=a.data.event,c=a.data.timer;y(),D(b,c,function(){setTimeout(function(){K(b.target,"click",e)},0)})}function y(){K(document,O.move,w),K(document,O.end,x)}function z(a){var b=a.data.event,c=a.data.timer,d=j(a,b);d&&(a.preventDefault(),b.targetTouches=a.targetTouches,a.data.touch=d,a.data.timeStamp=a.timeStamp,c.kick())}function A(a){var b=a.data.event,c=a.data.timer,d=i(a.changedTouches,b.identifier);d&&(B(b),D(b,c))}function B(a){K(document,"."+a.identifier,z),K(document,"."+a.identifier,A)}function C(a,b,c){var d=c-a.timeStamp;a.type="move",a.distX=b.pageX-a.startX,a.distY=b.pageY-a.startY,a.deltaX=b.pageX-a.pageX,a.deltaY=b.pageY-a.pageY,a.velocityX=.3*a.velocityX+.7*a.deltaX/d,a.velocityY=.3*a.velocityY+.7*a.deltaY/d,a.pageX=b.pageX,a.pageY=b.pageY}function D(a,b,c){b.end(function(){return a.type="moveend",L(a.target,a),c&&c()})}function E(){return J(this,"movestart.move",u),!0}function F(){return K(this,"dragstart drag",f),K(this,"mousedown touchstart",g),K(this,"movestart",u),!0}function G(a){"move"!==a.namespace&&"moveend"!==a.namespace&&(J(this,"dragstart."+a.guid+" drag."+a.guid,f,b,a.selector),J(this,"mousedown."+a.guid,g,b,a.selector))}function H(a){"move"!==a.namespace&&"moveend"!==a.namespace&&(K(this,"dragstart."+a.guid+" drag."+a.guid),K(this,"mousedown."+a.guid))}var I=6,J=a.event.add,K=a.event.remove,L=function(b,c,d){a.event.trigger(c,d,b)},M=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(a){return window.setTimeout(function(){a()},25)}}(),N={textarea:!0,input:!0,select:!0,button:!0},O={move:"mousemove",cancel:"mouseup dragstart",end:"mouseup"},P={move:"touchmove",cancel:"touchend",end:"touchend"};a.event.special.movestart={setup:E,teardown:F,add:G,remove:H,_default:function(a){function d(){C(f,g.touch,g.timeStamp),L(a.target,f)}var f,g;a._handled()&&(f={target:a.target,startX:a.startX,startY:a.startY,pageX:a.pageX,pageY:a.pageY,distX:a.distX,distY:a.distY,deltaX:a.deltaX,deltaY:a.deltaY,velocityX:a.velocityX,velocityY:a.velocityY,timeStamp:a.timeStamp,identifier:a.identifier,targetTouches:a.targetTouches,finger:a.finger},g={event:f,timer:new c(d),touch:b,timeStamp:b},a.identifier===b?(J(a.target,"click",e),J(document,O.move,w,g),J(document,O.end,x,g)):(a._preventTouchmoveDefault(),J(document,P.move+"."+a.identifier,z,g),J(document,P.end+"."+a.identifier,A,g)))}},a.event.special.move={setup:function(){J(this,"movestart.move",a.noop)},teardown:function(){K(this,"movestart.move",a.noop)}},a.event.special.moveend={setup:function(){J(this,"movestart.moveend",a.noop)},teardown:function(){K(this,"movestart.moveend",a.noop)}},J(document,"mousedown.move",k),J(document,"touchstart.move",o),"function"==typeof Array.prototype.indexOf&&!function(a){for(var b=["changedTouches","targetTouches"],c=b.length;c--;)-1===a.event.props.indexOf(b[c])&&a.event.props.push(b[c])}(a)}),window.WYSIWYGModernizr=function(a,b,c){function d(a){n.cssText=a}function e(a,b){return typeof a===b}var f,g,h,i="2.7.1",j={},k=b.documentElement,l="modernizr",m=b.createElement(l),n=m.style,o=({}.toString," -webkit- -moz- -o- -ms- ".split(" ")),p={},q=[],r=q.slice,s=function(a,c,d,e){var f,g,h,i,j=b.createElement("div"),m=b.body,n=m||b.createElement("body");if(parseInt(d,10))for(;d--;)h=b.createElement("div"),h.id=e?e[d]:l+(d+1),j.appendChild(h);return f=["&#173;",'<style id="s',l,'">',a,"</style>"].join(""),j.id=l,(m?j:n).innerHTML+=f,n.appendChild(j),m||(n.style.background="",n.style.overflow="hidden",i=k.style.overflow,k.style.overflow="hidden",k.appendChild(n)),g=c(j,a),m?j.parentNode.removeChild(j):(n.parentNode.removeChild(n),k.style.overflow=i),!!g},t=function(b){var c=a.matchMedia||a.msMatchMedia;if(c)return c(b).matches;var d;return s("@media "+b+" { #"+l+" { position: absolute; } }",function(b){d="absolute"==(a.getComputedStyle?getComputedStyle(b,null):b.currentStyle).position}),d},u={}.hasOwnProperty;h=e(u,"undefined")||e(u.call,"undefined")?function(a,b){return b in a&&e(a.constructor.prototype[b],"undefined")}:function(a,b){return u.call(a,b)},Function.prototype.bind||(Function.prototype.bind=function(a){var b=this;if("function"!=typeof b)throw new TypeError;var c=r.call(arguments,1),d=function(){if(this instanceof d){var e=function(){};e.prototype=b.prototype;var f=new e,g=b.apply(f,c.concat(r.call(arguments)));return Object(g)===g?g:f}return b.apply(a,c.concat(r.call(arguments)))};return d}),p.touch=function(){var c;return"ontouchstart"in a||a.DocumentTouch&&b instanceof DocumentTouch?c=!0:s(["@media (",o.join("touch-enabled),("),l,")","{#modernizr{top:9px;position:absolute}}"].join(""),function(a){c=9===a.offsetTop}),c};for(var v in p)h(p,v)&&(g=v.toLowerCase(),j[g]=p[v](),q.push((j[g]?"":"no-")+g));return j.addTest=function(a,b){if("object"==typeof a)for(var d in a)h(a,d)&&j.addTest(d,a[d]);else{if(a=a.toLowerCase(),j[a]!==c)return j;b="function"==typeof b?b():b,"undefined"!=typeof enableClasses&&enableClasses&&(k.className+=" "+(b?"":"no-")+a),j[a]=b}return j},d(""),m=f=null,j._version=i,j._prefixes=o,j.mq=t,j.testStyles=s,j}(this,document),!function(a){a.Editable.prototype.coreInit=function(){var a=this,b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",c=function(a){for(var b=a.toString(),c=0,d=0;d<b.length;d++)c+=parseInt(b.charAt(d),10);return c>10?c%9+1:c};if(a.options.key!==!1){var d=function(a,b,c){for(var d=Math.abs(c);d-->0;)a-=b;return 0>c&&(a+=123),a},e=function(a){return a},f=function(a){if(!a)return a;for(var f="",g=e("charCodeAt"),h=e("fromCharCode"),i=b.indexOf(a[0]),j=1;j<a.length-2;j++){for(var k=c(++i),l=a[g](j),m="";/[0-9-]/.test(a[j+1]);)m+=a[++j];m=parseInt(m,10)||0,l=d(l,k,m),l^=i-1&31,f+=String[h](l)}return f},g=e(f),h=function(a){return"none"==a.css("display")?(a.attr("style",a.attr("style")+g("zD4D2qJ-7dhuB-11bB4E1wqlhlfE4gjhkbB6C5eg1C-8h1besB-16e1==")),!0):!1},i=function(){for(var a=0,b=document.domain,c=b.split("."),d="_gd"+(new Date).getTime();a<c.length-1&&-1==document.cookie.indexOf(d+"="+d);)b=c.slice(-1-++a).join("."),document.cookie=d+"="+d+";domain="+b+";";return document.cookie=d+"=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain="+b+";",b}(),j=function(){var b=g(a.options.key)||"";return b!==g("eQZMe1NJGC1HTMVANU==")&&b.indexOf(i,b.length-i.length)<0&&[g("9qqG-7amjlwq=="),g("KA3B3C2A6D1D5H5H1A3==")].indexOf(i)<0?(a.$box.append(g("uA5kygD3g1h1lzrA7E2jtotjvooB2A5eguhdC-22C-16nC2B3lh1deA-21C-16B4A2B4gi1F4D1wyA-13jA4H5C2rA-65A1C10dhzmoyJ2A10A-21d1B-13xvC2I4enC4C2B5B4G4G4H1H4A10aA8jqacD1C3c1B-16D-13A-13B2E5A4jtxfB-13fA1pewxvzA3E-11qrB4E4qwB-16icA1B3ykohde1hF4A2E4clA4C7E6haA4D1xtmolf1F-10A1H4lhkagoD5naalB-22B8B4quvB-8pjvouxB3A-9plnpA2B6D6BD2D1C2H1C3C3A4mf1G-10C-8i1G3C5B3pqB-9E5B1oyejA3ddalvdrnggE3C3bbj1jC6B3D3gugqrlD8B2DB-9qC-7qkA10D2VjiodmgynhA4HA-9D-8pI-7rD4PrE-11lvhE3B5A-16C7A6A3ekuD1==")),a.$lb=a.$box.find("> div:last"),a.$ab=a.$lb.find("> a"),h(a.$lb)||h(a.$ab)):void 0};j()}},a.Editable.initializers.push(a.Editable.prototype.coreInit)}(jQuery),function(a){a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{allowedBlankTags:["TEXTAREA"],selfClosingTags:["br","input","img","hr","param","!--","source","embed","!","meta","link","base"],doNotJoinTags:["a"],iconClasses:["fa-"]}),a.Editable.prototype.isClosingTag=function(a){return a?null!==a.match(/^<\/([a-zA-Z0-9]+)([^<]+)*>$/gi):!1},a.Editable.prototype.tagName=function(a){return a.replace(/^<\/?([a-zA-Z0-9-!]+)([^>]+)*>$/gi,"$1").toLowerCase()},a.Editable.SELF_CLOSING_AFTER=["source"],a.Editable.prototype.isSelfClosingTag=function(a){var b=this.tagName(a);return this.options.selfClosingTags.indexOf(b.toLowerCase())>=0},a.Editable.prototype.tagKey=function(a){return a.type+(a.attrs||[]).sort().join("|")},a.Editable.prototype.extendedKey=function(a){return this.tagKey(a)+JSON.stringify(a.style)},a.Editable.prototype.mapDOM=function(b){var c=[],d={},e={},f=0,g=this;a(b).find(".f-marker").html(a.Editable.INVISIBLE_SPACE);var h=function(b,c){if(3===b.nodeType)return[];if(8===b.nodeType)return[{comment:!0,attrs:{},styles:{},idx:f++,sp:c,ep:c,text:b.textContent}];var d=b.tagName;"B"==d&&(d="STRONG"),"I"!=d||b.className&&null!=b.className.match(new RegExp(g.options.iconClasses.join("|"),"gi"))||(d="EM");var e={},h={},i=null;if(b.attributes)for(var j=0;j<b.attributes.length;j++){var k=b.attributes[j];"style"==k.nodeName?i=k.value:e[k.nodeName]=k.value}if(i){var l=i.match(/([^:]*):([^:;]*(;|$))/gi);if(l)for(var m=0;m<l.length;m++){var n=l[m].split(":"),o=n.slice(1).join(":").trim();";"==o[o.length-1]&&(o=o.substr(0,o.length-1)),h[n[0].trim()]=o}}var p=[];if(a.isEmptyObject(e)&&"SPAN"==b.tagName&&!a.isEmptyObject(h)){for(var q in h){var r={};r[q]=h[q],p.push({selfClosing:!1,attrs:e,styles:r,idx:f++,sp:c,ep:c+b.textContent.length,tagName:d,noJoin:b.nextSibling&&"BR"===b.nextSibling.tagName})}return p}return[{selfClosing:g.options.selfClosingTags.indexOf(d.toLowerCase())>=0,attrs:e,styles:h,idx:f++,sp:c,ep:c+b.textContent.length,tagName:d,noJoin:b.nextSibling&&"BR"===b.nextSibling.tagName}]},i=function(a,g){var j,k,l;if(a!=b)for(k=h(a,g),j=0;j<k.length;j++)l=k[j],c.push(l),d[l.sp]||(d[l.sp]={}),e[l.ep]||(e[l.ep]={}),d[l.sp][l.tagName]||(d[l.sp][l.tagName]=[]),e[l.ep][l.tagName]||(e[l.ep][l.tagName]=[]),d[l.sp][l.tagName].push(l),e[l.ep][l.tagName].push(l);var m=a.childNodes;if(m){for(j=0;j<m.length;j++)j>0&&8!=m[j-1].nodeType&&(g+=m[j-1].textContent.length),i(m[j],g);if(k)for(j=0;j<k.length;j++)l=k[j],l.ci=f++,d[l.ep]||(d[l.ep]={}),d[l.ep][l.tagName]||(d[l.ep][l.tagName]=[]),d[l.ep][l.tagName].push({shadow:!0,ci:f-1})}},j=function(){var b,e,f,h;for(b in d)for(var i in d[b])for(f=0;f<d[b][i].length;f++)if(e=d[b][i][f],!e.selfClosing&&!(e.dirty||e.shadow||e.comment||e.noJoin))for(var j=f+1;j<d[b][i].length;j++)if(h=d[b][i][j],!h.selfClosing&&!(h.dirty||h.shadow||h.comment||h.noJoin||1!=Object.keys(e.styles).length||1!=Object.keys(h.styles).length||h.sp==h.ep)){var k=Object.keys(e.styles)[0];if(h.styles[k]){e.sp=h.ep;for(var l=0;l<d[e.sp][e.tagName].length;l++){var m=d[e.sp][e.tagName][l];if(m.shadow&&m.ci==h.ci){d[e.sp][e.tagName].splice(l,0,e);break}}d[b][i].splice(f,1),f--;break}}for(b=0;b<c.length;b++)if(e=c[b],!(e.dirty||e.selfClosing||e.comment||e.noJoin||e.shadow||g.options.doNotJoinTags.indexOf(e.tagName.toLowerCase())>=0||!a.isEmptyObject(e.attrs)))if(e.sp==e.ep&&a.isEmptyObject(e.attrs)&&a.isEmptyObject(e.styles)&&g.options.allowedBlankTags.indexOf(e.tagName)<0)e.dirty=!0;else if(d[e.ep]&&d[e.ep][e.tagName])for(f=0;f<d[e.ep][e.tagName].length;f++)if(h=d[e.ep][e.tagName][f],e!=h&&!(h.dirty||h.selfClosing||h.shadow||h.comment||h.noJoin||!a.isEmptyObject(h.attrs)||JSON.stringify(h.styles)!=JSON.stringify(e.styles))){e.ep<h.ep&&(e.ep=h.ep),e.sp>h.sp&&(e.sp=h.sp),h.dirty=!0,b--;break}for(b=0;b<c.length;b++)if(e=c[b],!(e.dirty||e.selfClosing||e.comment||e.noJoin||e.shadow||!a.isEmptyObject(e.attrs)))if(e.sp==e.ep&&a.isEmptyObject(e.attrs)&&a.isEmptyObject(e.style)&&g.options.allowedBlankTags.indexOf(e.tagName)<0)e.dirty=!0;else if(d[e.sp]&&d[e.sp][e.tagName])for(f=d[e.sp][e.tagName].length-1;f>=0;f--)h=d[e.sp][e.tagName][f],e!=h&&(h.dirty||h.selfClosing||h.shadow||h.comment||h.noJoin||e.ep==h.ep&&a.isEmptyObject(h.attrs)&&(e.styles=a.extend(e.styles,h.styles),h.dirty=!0))};i(b,0),j();for(var k=c.length-1;k>=0;k--)c.dirty&&c.splice(k,1);return c},a.Editable.prototype.sortNodes=function(a,b){if(a.comment)return 1;if(a.selfClosing||b.selfClosing)return a.idx-b.idx;var c=a.ep-a.sp,d=b.ep-b.sp;return 0===c&&0===d?a.idx-b.idx:c===d?b.ci-a.ci:d-c},a.Editable.prototype.openTag=function(a){var b,c="<"+a.tagName.toLowerCase(),d=Object.keys(a.attrs).sort();for(b=0;b<d.length;b++){var e=d[b];c+=" "+e+'="'+a.attrs[e]+'"'}var f="",g=Object.keys(a.styles).sort();for(b=0;b<g.length;b++){var h=g[b];null!=a.styles[h]&&(f+=h.replace("_","-")+": "+a.styles[h]+"; ")}return""!==f&&(c+=' style="'+f.trim()+'"'),c+=">"},a.Editable.prototype.commentTag=function(a){var b="";if(a.selfClosing){var c;b="<"+a.tagName.toLowerCase();var d=Object.keys(a.attrs).sort();for(c=0;c<d.length;c++){var e=d[c];b+=" "+e+'="'+a.attrs[e]+'"'}var f="",g=Object.keys(a.styles).sort();for(c=0;c<g.length;c++){var h=g[c];null!=a.styles[h]&&(f+=h.replace("_","-")+": "+a.styles[h]+"; ")}""!==f&&(b+=' style="'+f.trim()+'"'),b+="/>"}else a.comment&&(b="<!--"+a.text+"-->");return b},a.Editable.prototype.closeTag=function(a){return"</"+a.tagName.toLowerCase()+">"},a.Editable.prototype.nodesOpenedAt=function(a,b){for(var c=[],d=a.length-1;d>=0&&a[d].sp==b;)c.push(a.pop()),d--;return c},a.Editable.prototype.entity=function(a){return ch_map={">":"&gt;","<":"&lt;","&":"&amp;"},ch_map[a]?ch_map[a]:a},a.Editable.prototype.removeInvisibleWhitespace=function(a){for(var b=0;b<a.childNodes.length;b++){var c=a.childNodes[b];c.childNodes.length?this.removeInvisibleWhitespace(c):c.textContent=c.textContent.replace(/\u200B/gi,"")}},a.Editable.prototype.cleanOutput=function(b,c){var d,e,f,g;c&&this.removeInvisibleWhitespace(b);var h=this.mapDOM(b,c).sort(function(a,b){return b.sp-a.sp}),i=b.textContent;html="";var j=[],k=-1,l=a.proxy(function(){var b="";for(simple_nodes_to_close=[],j=j.sort(function(a,b){return a.idx-b.idx}).reverse();j.length;){for(var c=j.pop();simple_nodes_to_close.length&&simple_nodes_to_close[simple_nodes_to_close.length-1].ci<c.ci;)b+=this.closeTag(simple_nodes_to_close.pop());c.selfClosing||c.comment?b+=this.commentTag(c):(!a.isEmptyObject(c.attrs)||this.options.allowedBlankTags.indexOf(c.tagName)>=0)&&(b+=this.openTag(c),simple_nodes_to_close.push(c))}for(;simple_nodes_to_close.length;)b+=this.closeTag(simple_nodes_to_close.pop());html+=b},this),m={},n=[];for(d=0;d<=i.length;d++){if(m[d])for(e=m[d].length-1;e>=0;e--)if(n.length&&n[n.length-1].tagName==m[d][e].tagName&&JSON.stringify(n[n.length-1].styles)==JSON.stringify(m[d][e].styles))html+=this.closeTag(m[d][e]),n.pop();else{for(var o=[];n.length&&(n[n.length-1].tagName!==m[d][e].tagName||JSON.stringify(n[n.length-1].styles)!==JSON.stringify(m[d][e].styles));)g=n.pop(),html+=this.closeTag(g),o.push(g);for(html+=this.closeTag(m[d][e]),n.pop();o.length;){var p=o.pop();html+=this.openTag(p),n.push(p)}}for(var q=this.nodesOpenedAt(h,d).sort(this.sortNodes).reverse();q.length;){var r=q.pop();if(!r.dirty)if(r.selfClosing||r.comment)r.ci>k||"BR"==r.tagName?(l(),html+=this.commentTag(r),k=r.ci):j.length?(j.push(r),k<r.ci&&(k=r.ci)):(html+=this.commentTag(r),k<r.ci&&(k=r.ci));else if(r.ep>r.sp){r.ci>k&&l();var s=[];if("A"==r.tagName)for(var t=r.sp+1;t<r.ep;t++)if(m[t]&&m[t].length)for(f=0;f<m[t].length;f++)s.push(m[t][f]),html+=this.closeTag(m[t][f]),n.pop();var u=[];if("SPAN"==r.tagName&&("#123456"==r.styles["background-color"]||"#123456"===a.Editable.RGBToHex(r.styles["background-color"])||"#123456"==r.styles.color||"#123456"===a.Editable.RGBToHex(r.styles.color)))for(;n.length;){var v=n.pop();html+=this.closeTag(v),u.push(v)}for(html+=this.openTag(r),k<r.ci&&(k=r.ci),n.push(r),m[r.ep]||(m[r.ep]=[]),m[r.ep].push(r);s.length;)r=s.pop(),html+=this.openTag(r),n.push(r);for(;u.length;)r=u.pop(),html+=this.openTag(r),n.push(r)}else r.sp==r.ep&&(j.push(r),k<r.ci&&(k=r.ci))}l(),d!=i.length&&(html+=this.entity(i[d]))}return html=html.replace(/(<span[^>]*? class\s*=\s*["']?f-marker["']?[^>]+>)\u200B(<\/span>)/gi,"$1$2"),html},a.Editable.prototype.wrapDirectContent=function(){var b=a.merge(["UL","OL","TABLE"],this.valid_nodes);if(!this.options.paragraphy)for(var c=null,d=this.$element.contents(),e=0;e<d.length;e++)1!=d[e].nodeType||b.indexOf(d[e].tagName)<0?(c||(c=a('<div class="fr-wrap">'),a(d[e]).before(c)),c.append(d[e])):c=null},a.Editable.prototype.cleanify=function(b,c,d){if(this.browser.msie&&a.Editable.getIEversion()<9)return!1;var e;if(this.isHTML)return!1;void 0===b&&(b=!0),void 0===d&&(d=!0),this.no_verify=!0,this.$element.find("span").removeAttr("data-fr-verified"),d&&this.saveSelectionByMarkers(),b?e=this.getSelectionElements():(this.wrapDirectContent(),e=this.$element.find(this.valid_nodes.join(",")),0===e.length&&(e=[this.$element.get(0)]));var f,g;if(e[0]!=this.$element.get(0))for(var h=0;h<e.length;h++){var i=a(e[h]);0===i.find(this.valid_nodes.join(",")).length&&(f=i.html(),g=this.cleanOutput(i.get(0),c),g!==f&&i.html(g))}else 0===this.$element.find(this.valid_nodes.join(",")).length&&(f=this.$element.html(),g=this.cleanOutput(this.$element.get(0),c),g!==f&&this.$element.html(g));this.$element.find("[data-fr-idx]").removeAttr("data-fr-idx"),this.$element.find(".fr-wrap").each(function(){a(this).replaceWith(a(this).html())}),this.$element.find(".f-marker").html(""),d&&this.restoreSelectionByMarkers(),this.$element.find("span").attr("data-fr-verified",!0),this.no_verify=!1}}(jQuery);

//----------------------------------------------------------------------------------------------------
// LET THE MAGIC FLOW.
//----------------------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------------------
// Also try to use browserify for all the vendors you can.
//----------------------------------------------------------------------------------------------------
'use strict';

var Vue = require('vue');

Vue.use(require('vue-resource'));

Vue.config.silent = true;
Vue.config.strict = true;



'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('home')) {
		var home = new Vue({
			el: 'body.home',
			data: {
				projects: {}
			},
			ready: function () {
				this.fetchDrafts();
			},
			methods: {
				fetchDrafts: function () {
					this.$http.get('/api/projects/drafts').success(function (projects) {
						console.log(projects);
						this.projects = projects;
					})
				}
			}
		})
	}
});


'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('projects')) {
		var projects = new Vue({
			el: 'body.projects',
			data: {
				projects: {}
			},
			ready: function() {
				this.fetchProjects();
			},
			methods: {
				fetchProjects: function() {
					this.$http.get('/api/projects').success(function(projects) {
						this.projects = projects;
					})
				},
				destroyProject: function(pId) {
					if(confirm('Are you sure you want to delete this projects')) {
						this.$http.delete('/api/projects', {id: pId}).success(function() {
							console.log('Deleted with success.');
							this.fetchProjects();
						}).error(function(err) {
							console.log('Error while deleting :: ', err);
						})
					}
				}
			}
		})
	}
});


'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('projectcreate')) {

		$('#description').editable({
			inlineMode: false
		});

		var projectcreate = new Vue({

			el: 'body.projectcreate',

			data: {
				project: {
					published: '',
					title: '',
					description: '',
					categories: '',
					credits: '',
					thumbnail: '',
					cover: ''
				},
				thumbnail: '',
				cover: '',
				message: '',
				status: ''
			},

			methods: {

				saveProject: function(e) {

					e.preventDefault();

					console.log(this.project.thumbnail);

					this.project.description = document.querySelector('.froala-element').innerHTML;

					this.$http.post('/api/projects', {project: this.project}).success(function(project) {

						console.log('Created project with success.');
						this.message = 'Success, redirecting to project page.';
						this.status = 'success';

						window.setTimeout(function(){
							document.getElementById('fileForm').submit();
						}, 3000)

					}).error(function(err) {

						console.log('Error while creating project :: ', err);
						this.message = 'Error while creating project. Retry.';
						this.status = 'error';

					})

				},

				chooseFile: function(id) {

					document.getElementById(id).click();

				},

				saveFileName: function(e) {

					this[e.target.id] = e.target.files[0].name

				},

				getFile: function(e) {

					e.preventDefault();

					if (this.files.filter(function(file) { return file.name === e.target.files[0].name; }).length > 0) {
						console.log('has file');
					}
					else {
						console.log('doesnt has file');
						this.files.push(e.target.files[0]);
					}

					console.log(this.files);

				}

			}

		})

	}

});


'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('projectedit')) {

		var projectedit = new Vue({

			el: 'body.projectedit',

			data: {
				test: 'hello',
				project: {
					id: '',
					published: '',
					title: '',
					description: '',
					categories: '',
					credits: '',
					thumbnail: '',
					cover: ''
				},
				thumbnail: '',
				cover: '',
				message: '',
				status: ''
			},

			ready: function() {

				var href = window.location.href.split('/'),
					id = href[href.length-1];

				this.fetchProject(id);

			},

			methods: {

				fetchProject: function(id) {

					this.$http.get('/api/projects/' + id).success(function(project) {

						document.getElementById('description').innerHTML = project.description;

						this.thumbnail = project.thumbnail;
						this.cover = project.cover;

						this.project = {
							id: project.id,
							published: project.published,
							title: project.title,
							description: project.description,
							categories: project.categories,
							link: project.link,
							credits: project.credits
						};

						window.setTimeout(function() {
							$('#description').editable({
								inlineMode: false
							});
						}, 10)

					});

				},

				saveProject: function(e) {

					e.preventDefault();

					this.project.description = document.querySelector('.froala-element').innerHTML;

					this.$http.put('/api/projects/' + this.project.id , { project: this.project }).success(function(project) {

						console.log('Updated project with success.');
						this.message = 'Success, project updated.';
						this.status = 'success';

						window.setTimeout(function(){
							document.getElementById('fileForm').submit();
						}, 3000)

					}).error(function(err) {

						console.log('Error while updating project :: ', err);
						this.message = 'Error while updating project. Retry.';
						this.status = 'error';

					})

				},

				chooseFile: function(id) {

					document.getElementById(id).click();

				},

				saveFileName: function(e) {

					this[e.target.id] = e.target.files[0].name

				},

				getFile: function(e) {

					e.preventDefault();

					if (this.files.filter(function(file) { return file.name === e.target.files[0].name; }).length > 0) {
						console.log('has file');
					}
					else {
						console.log('doesnt has file');
						this.files.push(e.target.files[0]);
					}

					console.log(this.files);

				}

			}

		})

	}

});


'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('contact')) {

		var contact = new Vue({

			el: 'body.contact',

			data: {
				infos: {},
				message: '',
				status: '',
				about: ''
			},

			ready: function() {
				this.fetchInfos();
			},

			methods: {

				fetchInfos: function() {

					this.$http.get('/api/contact').success(function(infos) {

						window.setTimeout(function() {
							$('#about').editable({
								inlineMode: false
							});
						}, 10);

						this.infos = infos;

					})

				},

				saveInfos: function(e) {

					e.preventDefault();

					this.$http.put('/api/contact/' + this.infos.id , { infos: this.infos }).success(function(infos) {

						console.log('Updated infos with success.');
						this.message = 'Success, infos updated.';
						this.status = 'success';

						window.setTimeout(function(){
							this.status = '';
						}.bind(this), 3000);

					}).error(function(err) {

						console.log('Error while updating infos :: ', err);
						this.message = 'Error while updating infos. Retry.';
						this.status = 'error';

					})

				}

			}

		})

	}

});

},{"vue":74,"vue-resource":3}]},{},[76]);
