var mesh = function() {

  var makeId = function() {
    var last = 0;
    return function() {
      last += 1;
      return last;
    }
  }();

  var node = function(def) {
    var id = makeId(); // always unique
    var position = def.position; // (x, y)
    var velocity = def.velocity; // (r, theta)
    var radius = def.radius;
    var neighbors = {};
    var channels = {}; // fifo connection between nodes

    var discoverNeighbors = function() {};
    var sendNeighbor = function(neighbor, message) {};
    var broadcast = function(message) {};

    return {
      
    };
  };
}();