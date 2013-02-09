var _ = require('underscore');

var User = function(sock,nick) {
  this.id = sock.id; this.socket = sock; this.nickname = nick;
}

User.prototype.setNickname = function(nick) { this.nickname = nick; }

User.prototype.genNickname = function(pNick) {
  var nick = pNick || config.nick;
  if(_.isString(nick) && nick != "random")
    this.nickname = nick + Math.floor((Math.random()*998)+1);
  else {
    var colors = new Array("red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink");
    var adjectives = new Array("Fast", "Smart", "Shy", "Fabulous", "Honest", "Silly");
    var colidx = Math.floor(Math.random()*colors.length);
    var adjidx = Math.floor(Math.random()*adjectives.length);
    this.nickname = colors[colidx] + adjectives[adjidx];
  }
  return this.nickname;
}

exports.User = User;
