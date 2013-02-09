// Dependencies
var NodeCanvas = require('canvas'),
    fs = require('fs'),
    JSON = require('JSON2'),
    _ = require('underscore');

// Constructor
var Room = function(name,defConfig) {
  console.log("Created room " + name);
  this.name = name;
  if(!this.loadConfig(defConfig)) this.config = defConfig;
  this.width = this.config.width; this.height = this.config.height;
  this.displayedName = this.config.name || this.name;
  this.nodeCanvas = new NodeCanvas(this.width,this.height);
  this.canvas = new Canvas(null,this.nodeCanvas.getContext('2d'),this.width,this.height);
  this.canvas.clear();
  this.loadBackup();
  this.autoBackup();
  this.users = new Array();
}
Room.rooms = new Array();
Room.create = function(name,config) {
  if(_.isUndefined(Room.rooms[name]))
    Room.rooms[name] = new Room(name,config);
  return Room.rooms[name];
}
Room.remove = function(name) {
  Room.rooms[name] = null;
}
Room.exists = function(name) {
  return _.isObject(Room.rooms[name]);
}
Room.list = function() {
  var list = {};
  for(var name in Room.rooms)
    if(Room.rooms[name].config.public) list.push(name);
  return list;
}
Room.listNames = function() {
  var list = {};
  for(var name in Room.rooms)
    if(Room.rooms[name].config.public) list[name] = Room.rooms[name].name;
  return list;
}
// Setters/getters
Room.getChannel = function(name) { return "room_" + name; }
Room.getName = function(ch) { return ch.replace("room_",""); }
Room.get = function(name) { return Room.rooms[name]; }
Room.prototype.getChannel = function() { return Room.getChannel(this.name); }
Room.prototype.getName = function() { return this.name; }
Room.prototype.getPath = function() { return "rooms/" + this.name + "/"; }

// Config load/save
Room.prototype.loadConfig = function(defConfig) {
  try {
    var config = JSON.parse(fs.readFileSync(this.getPath() + 'config.json','utf8'));
    if(_.isUndefined(config)) return false;
    this.config = _.defaults(config, defConfig);
    return true;
  }
  catch(e) { return false; }
}

Room.prototype.getInitString = function() {
  var cmd = {};
  cmd.width = this.width;
  cmd.height = this.height;
  return JSON.stringify(cmd);
}

// User handling
Room.prototype.addUser = function(user) { user.room = this; this.users[user.id] = user; }
Room.prototype.getUser = function(id) { return this.users[id]; }
Room.prototype.removeUser = function(id) { this.users[id] = null; }
Room.findUserRoom = function(id) {
  for(var r in Room.rooms) {
    room = Room.get(r);
    if(_.isObject(room.getUser(id)))
      return room;
  }
  return null;
}
Room.findUserRoomName = function(id) {
  var r = Room.findUserRoom(id);
  if(_.isUndefined(r)) return null;
  return r.name;
}
Room.findUser = function(id) {
  var r = Room.findUserRoom(id);
  if(_.isUndefined(r)) return null;
  return r.getUser(id);
}
Room.findUserByName = function(name, caseSensitive) {
  var cs = caseSensitive || false;
  for(var r in Room.rooms) {
    room = Room.get(r);
    for(var u in room.users) {
      if(room.users[u] && ((cs && room.users[u].nickname == name) ||
         (!cs && room.users[u].nickname.toLowerCase() == name.toLowerCase())))
        return room.users[u];        
    }
  }
  return null;
}
Room.findUserId = function(name) { if(Room.findUserByName(name)) { return Room.findUserByName(name).id; } }

Room.prototype.listUsers = function() {
  var userList = new Array();
  for(var k in this.users) {
    userList.push(this.users[k].nickname);
  }
  return userList;
}

// PNG/Backups
Room.prototype.autoBackup = function() {
  if(_.isUndefined(this.config) || !this.config.autoBackup || _.isUndefined(this.config.autoBackupTime)) return;
  var room = this;
  if(!fs.existsSync(this.getPath()))
    fs.mkdirSync(this.getPath());
  console.log("Saving room " + this.name);
  this.savePNG(this.getPath() + 'canvas.png');
  setTimeout(function(){ room.autoBackup(true); }, this.config.autoBackupTime*1000);
}
Room.prototype.loadBackup = function() { this.loadPNG(this.getPath() + 'canvas.png'); }

Room.prototype.loadPNG = function(path) {
  if(fs.existsSync(path)) {
    var img = new NodeCanvas.Image;
    img.src = fs.readFileSync(path);
    this.canvas.canvas.drawImage(img,(this.width-img.width)/2,(this.height-img.height)/2,img.width,img.height);
  }
}
Room.prototype.savePNG = function(path) {
  var out = fs.createWriteStream(path)
    , stream = this.nodeCanvas.pngStream();
  stream.on('data',function(c){out.write(c);});
  stream.on('end',function(){out.end();});
}
Room.prototype.sendPNG = function(req,res,asAttachment) {
  var stream = this.nodeCanvas.pngStream()
    , header = {};
  header["Content-Type"] = "image/png";
  header["Cache-Control"] = "no-cache";
  header["Last-Modified"] = (new Date().toUTCString());
  if(asAttachment) header["Content-Disposition"] = 'attachment; filename="output.png"';
  res.writeHead(200,header);
  stream.on('data', function(chunk){res.write(chunk, "binary");});
  stream.on('end', function(){res.end();});
}

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

exports.Room = Room;
exports.User = User;
