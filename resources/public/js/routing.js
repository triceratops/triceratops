var routing = function() {
  var sherpa = new Sherpa.Router();

  var getPath = function() {
    var state = History.getState().hash.split('?');
    var path = state[0];
    var query = {};

    if (state[1]) {
      var params = state[1].split('&');
      if (params[0] === '') {
        params = params.slice(1);
      }

      query = _.reduce(params, function(args, param) {
        var parts = param.split('=');
        args[parts[0]] = parts[1];
        return args;
      }, {});
    }

    return {path: path, query: query};
  };

  var dispatch = {
    actions: {},

    add: function(path, name, action) {
      sherpa.add(path).to(name);
      this.actions[name] = action;
    },

    match: function(path, query) {
      var match = sherpa.recognize(path);
      var action = this.actions[match.destination];
      return function() {
        return action(match.params, query);
      };
    },

    action: function() {
      var match = getPath();
      return this.match(match.path, match.query);
    },

    act: function() {
      var action = this.action();
      action();
    },

    go: function(path) {
      var state = History.getState();
      var trodden = _.last(state.cleanUrl.match(/https?:\/\/[^\/]+(.*)/));

      if (path === trodden) {
        act();
      } else {
        History.pushState(path, path, path);
      }
    }
  };

  return dispatch;
}();
