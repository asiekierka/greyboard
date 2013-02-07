Util = {}

// Degrees -> Radians
Util.deg = function(n) {
  return (Math.PI/180)*n;
}
Util.time = function() { return (new Date()).getTime(); }
