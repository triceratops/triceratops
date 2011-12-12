var linkage = function() {

  // add properties from one object to another.
  var extend = function() {
    var target = arguments[0];
    var len = arguments.length;

    for (var i = 1; i < len; i++) {
      if ((options = arguments[i]) != null) {
        for (var name in options) {
          var src = target[name];
          var copy = options[name];

          if (!options.hasOwnProperty(name)) {continue;}
          if (target === copy) {continue;}

          // provide access to overwritten methods by attaching an 'uber' property 
          // on the new version that references the function it is overwriting.
          if (src && typeof src == 'function') {
            copy.uber = src;
          }

          // recurse if we're merging object values
          if (copy && typeof copy == "object" && !copy.nodeType) {
            target[name] = extend( // never move original objects, clone them
              src || (copy.length != null ? [] : {}), 
              copy
            );
          } else if (copy !== undefined) {
            target[name] = copy;
          }
        }
      }
    }

    return target;
  };

  // provide methods for a class of objects which can then be constructed 
  // with the returned function.
  var type = function() {
    var methods = {};
    var ancestors = [];

    // if one argument is given, it is the methods.
    // if two, the first is the list of ancestors, the second the methods.
    if (arguments.length === 1) {
      methods = arguments[0];
    } else if (arguments.length === 2) {
      ancestors = arguments[0];
      methods = arguments[1];
    }

    // encapsulate the creation of the function object type.
    var fn = function(args) {
      if (!(this instanceof arguments.callee)) {
        return new arguments.callee(arguments);
      }

      if (typeof this.init == 'function') {
        var ultimate_args = args.callee ? args : arguments;
        this.init.apply(this, ultimate_args);
      }

      return null;
    };
    
    // extend the type with the ancestor types' prototypes.
    var y, len = ancestors.length;
    for (y = 0; y < len; y++) {
      extend(fn.prototype, ancestors[y].prototype);
    }

    // add the methods
    extend(fn.prototype, methods);
    return fn;
  };

  // a simple cache ---------------------

  // give it a function that computes a value
  // it will compute the value the first time it is called,
  // and then cache it.  It uses the cached value
  // until expire is called, which triggers the cache
  // to be recomputed on its next access.
  var cache = function() {
    var obj, find = arguments[0];
    if (arguments.length > 1) {
      obj = arguments[0];
      find = arguments[1];
    }

    var value = null;

    var that = function() {
      if (value === null) {
        value = obj ? find.call(obj) : find();
      }
      return value;
    };

    that.expiring = function() {};
    that.expire = function() {
      value = null;
      obj ? that.expiring.call(obj) : that.expiring();
    };

    return that;
  };


  // model of dependent values --------------------

  // a link is a single value which can be watched for changes.
  var link = function() {
    var value = arguments.length === 0 ? null : arguments[0];
    var observers = {};

    var trigger = function(recent) {
      var keys = _.keys(observers);
      if (keys.length > 0) {
        _.each(keys, function(key) {
          observers[key](recent);
        });
      }
    };

    // if called with no arguments, returns its value
    // a single argument sets the value
    var that = function() {
      if (arguments.length === 0) {
        return value;
      } else {
        value = arguments[0];
        trigger(value);
        return value;
      }
    };

    // watch takes a function of one argument
    // which is called whenever this value changes
    that.watch = function(observer) {
      observers[observer] = observer;
    };

    // given the id returned from a previous watch() call,
    // disables that observer
    that.unwatch = function(observer) {
      delete observers[observer];
    };

    // used for updating a value in an object, rather than 
    // replacing the object as a whole.
    that.update = function(key, subvalue) {
      value[key] = subvalue;
      trigger(value);
    };

    that.updateIn = function(keys, f) {
      var val = value;
      var finalkey = keys[keys.length-1];
      for (var k = 0; k < keys.length-1; k++) {
        val = val[keys[k]];
      }
      val[finalkey] = f(val[finalkey]);
      trigger(value);
    }

    that.del = function(key) {
      delete value[key];
      trigger(value);
    };

    that.delIn = function(keys) {
      var val = value;
      var finalkey = keys[keys.length-1];
      for (var k = 0; k < keys.length-1; k++) {
        val = val[keys[k]];
      }
      if (val) delete val[finalkey];
      trigger(value);
    };

    return that;
  };
  
  // provide a means to call any chain of properties or functions by string
  var access = function(obj, entry) {
    if (entry) {
      var path = entry.split('.');
      var component = path.shift();
      var parts = component.match(/([^\(]+)\(([^\)]*)\)/);
      var found = parts === null ? obj[component] : obj[parts[1]](parts[2]);

      return found.access(path.join('.'));
    } else {
      return obj;
    }
  };
  
  return {
    extend: extend,
    type: type,
    cache: cache,
    link: link,
    access: access
  };


}();

