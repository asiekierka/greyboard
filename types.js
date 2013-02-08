// Dependencies
var NodeCanvas = require('canvas'),
    fs = require('fs'),
    JSON = require('JSON2');

// Constructor
var Room = function(name,width,height) {
  console.log("Created room " + name);
  this.name = name;
  if(!this.loadConfig()) this.defaultConfig(width,height);
  this.nodeCanvas = new NodeCanvas(this.width,this.height);
  this.canvas = new Canvas(undefined,this.nodeCanvas.getContext('2d'),this.width,this.height);
  this.loadBackup();
  this.autoBackup();
  this.users = new Array();
}
Room.rooms = new Array();
Room.create = function(name) {
  if(typeof Room.rooms[name] == "undefined")
    Room.rooms[name] = new Room(name);
  return Room.rooms[name];
}
Room.remove = function(name) {
  Room.rooms[name] = null;
}
Room.exists = function(name) {
  return (Room.rooms[name] !== undefined);
}

// Setters/getters
Room.getChannel = function(name) { return "room_" + name; }
Room.getName = function(ch) { return ch.replace("room_",""); }
Room.get = function(name) { return Room.rooms[name]; }
Room.prototype.getChannel = function() { return Room.getChannel(this.name); }
Room.prototype.getName = function() { return this.name; }
Room.prototype.getPath = function() { return "rooms/" + this.name + "/"; }

// Config load/save
Room.prototype.loadConfig = function(json) {
  if(this.config) return true;
  try {
    this.config = json || JSON.parse(fs.readFileSync(this.getPath() + 'config.json','utf8'));
    if(!this.config) return false;
    this.width = this.config.width;
    this.height = this.config.height;
    return true;
  }
  catch(e) {}
}

Room.prototype.getInitString = function() {
  var cmd = {};
  cmd.width = this.width;
  cmd.height = this.height;
  return JSON.stringify(cmd);
}

Room.prototype.defaultConfig = function() { 
  return this.loadConfig(Room.defaultConfig);
}

// User handling
Room.prototype.addUser = function(user) { user.room = this; this.users[user.id] = user; }
Room.prototype.getUser = function(id) { return this.users[id]; }
Room.prototype.removeUser = function(id) { this.users[id] = null; }
Room.findUserRoom = function(id) {
  for(var r in Room.rooms) {
    room = Room.get(r);
    if(room.getUser(id) !== undefined)
      return room;
  }
  return null;
}
Room.findUserRoomName = function(id) {
  var r = Room.findUserRoom(id);
  if(!r) return null;
  return r.name;
}
Room.findUser = function(id) {
  var r = Room.findUserRoom(id);
  if(!r) return null;
  return r.getUser(id);
}

Room.prototype.listUsers = function() {
  var userList = new Array();
  for(var k in this.users) {
    userList.push(this.users[k].nickname);
  }
  return userList;
}

// PNG/Backups
Room.prototype.autoBackup = function() {
  if(!this.config || !this.config.autoBackup || !this.config.autoBackupTime) return;
  var room = this;
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

var User = function(id,nick) {
  this.id = id; this.nickname = nick;
}

User.prototype.setNickname = function(nick) { this.nickname = nick; }

User.prototype.genNickname = function(pNick) {
  var nick = pNick || config.nick;
  if(typeof nick !== undefined && nick != "random")
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
