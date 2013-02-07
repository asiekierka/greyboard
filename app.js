var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , JSON = require('JSON2')
  , fs = require("fs")
  , grayboardFile = fs.readFileSync('index.html','utf8')

// People would murder for this line. It's really bad.
eval(fs.readFileSync('lib/grayboard-util.js','utf8'));
eval(fs.readFileSync('lib/grayboard-canvas.js','utf8'));

var config = JSON.parse(fs.readFileSync('config.json','utf8'))
  , NodeCanvas = require('canvas');

var disallowedRooms = new Array("css", "fonts", "img", "js", "lib", "room", "user", "list");

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

Room.prototype.getPath = function() { return "rooms/" + this.name + "/"; }
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

Room.prototype.defaultConfig = function() { 
  return this.loadConfig(config);
}

Room.rooms = new Array();
Room.create = function(name) {
  if(typeof Room.rooms[name] === undefined)
    Room.rooms[name] = new Room(name);
  return Room.rooms[name];
}
Room.remove = function(name) {
  Room.rooms[name] = null;
}
Room.exists = function(name) {
  return (Room.rooms[name] !== undefined);
}

Room.getChannel = function(name) { return "room_" + name; }
Room.getName = function(ch) { return ch.replace("room_",""); }
Room.get = function(name) { return Room.rooms[name]; }

Room.prototype.getChannel = function() { return Room.getChannel(this.name); }
Room.prototype.getName = function() { return this.name; }

Room.prototype.addUser = function(user) { this.users[user.id] = user; }
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
    if(k !== undefined)
      userList.push(k.nickname);
  }
  return userList;
}

Room.prototype.sendPng(req,res,asAttachment) = function() {
  var stream = this.nodeCanvas.pngStream();
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

server.listen(config.port);

// Fix base URL
if(config.port!=80)
  config.baseURL = config.baseURL + ":" + config.port;

// Lookup dirs
app.use(express.static('static'));
app.use("/lib", express.static('lib'));

function sendPng(req,res,room,asAttachment) {
  console.log("Sending PNG to room " + room);
  if(!Room.exists(room)) {
    res.writeHead(404,{});
    res.end();
    return;
  }
  Room.get(room).sendPng(req,res,asAttachment);
}

app.use(function(req,res,next){ // TODO: refactor
  var url = req.url;
  var room = "default";
  var params = "";
  if(url.indexOf("/") == 0) // Detect first slash (beginning)
    url = url.substr(1);
  if(url.indexOf("/") >= 0) { // Detect second slash (cut from there)
    room = url.substr(0,url.indexOf("/"));
    params = url.substr(url.indexOf("/")+1);
  } else room = url;
  room = room.toLowerCase(); // ensure lowercase room names
  if(disallowedRooms.indexOf(room)>=0 && mode == "") { // css, fonts, img, etc.
    res.writeHead(403,{});
    res.end();
  } else mode = "room";
  console.log("DEBUG: Room " + room + ", params " + params);
  if(params.indexOf("canvas")>=0) { sendPng(req,res,room,false); }
  else if(params.indexOf("download")>=0) { sendPng(req,res,room,true); }
  else {
    var localIndex = grayboardFile.replace("ROOMNAMEHERE",room).replace("SOCKETURLHERE",config.socketURL);
    res.type("text/html");
    res.send(localIndex);
  }
});

function randomNickname(pNick) {
  var nick = pNick || config.nick;
  if(typeof nick !== undefined && nick != "random")
    return nick + Math.floor((Math.random()*998)+1);
  var colors = new Array("red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink");
  var adjectives = new Array("Fast", "Smart", "Shy", "Fabulous", "Honest", "Silly");
  var colidx = Math.floor(Math.random()*colors.length);
  var adjidx = Math.floor(Math.random()*adjectives.length);
  return colors[colidx] + adjectives[adjidx];
}

function prepareCanvasData(w,h) {
  var cmd = {};
  cmd.width = w;
  cmd.height = h;
  return JSON.stringify(cmd);
}

function formatChat(nick,txt,src) {
  var msg = {}
  if(src=="server") { msg.color = "#205080"; msg.bold = true; msg.text = "* " + txt;}
  else if(src=="client") {
    msg.color = "#101010";
    msg.bold = false;
    if(txt.indexOf("/me ")==0) { // /me
      msg.text = "* " + nick + " " + txt.replace("/me ","");
      msg.color = "#701070"; msg.bold = true;
    }
    else msg.text = "<"+nick+"> "+txt;
 }
  return msg;
}

io.sockets.on('connection', function(socket) {

  socket.on('join_room', function(data) {
    roomName = Room.getName(data);
    socket.join(data);
    var room = Room.create(roomName);
    var nick = randomNickname(room.config.nickname);
    room.addUser(new User(socket.id,nick));
    socket.emit('init',prepareCanvasData(room.width,room.height));
    socket.emit('chat_message',formatChat('','Welcome to room ' + roomName + '!','server'));
    socket.broadcast.to(data).emit('chat_message',formatChat("",nick + " has joined the room!","server"));
  });

  socket.on('chat_send', function(data) {
    var msg = formatChat(Room.findUser(socket.id).nickname,data,"client");
    var room = Room.findUserRoom(socket.id);
    if(room)
      io.sockets.in(room.getChannel()).emit('chat_message',msg);
  });
  socket.on('user_list', function(data) {
    var room = Room.findUserRoom(socket.id);
    if(!room) return;
    socket.emit('user_list',JSON.stringify(room.listUsers()));
  });
  socket.on('draw_command', function(data) {
    console.log("Received drawCommand: " + data);
    try {
      var cmd = JSON.parse(data);
      if(properCommand(cmd)) {
        if(Room.findUserRoom(socket.id)) {
          var room = Room.findUserRoomName(socket.id);
          var roomName = room.getChannel();
          var canvas = Room.get(room).canvas;
          drawCommand(cmd,canvas,"server");
          socket.broadcast.to(roomName).emit('draw_command',data);
          lastCmdSend = Util.time();
        }
      }
    } catch(e) {
      console.log("Error: " + e.message);
    }
  });
  socket.on('disconnect', function() {
    if(Room.findUserRoom(socket.id)) {
      var room = Room.findUserRoom(socket.id);
      if(room.getUser(socket.id)) {
        var nick = room.getUser(socket.id).nickname;
        var roomChannel = room.getChannel();
        room.removeUser(socket.id);
        socket.broadcast.to(roomChannel).emit('chat_message',formatChat("",nick + " has left the room!","server"));
      }
    }
  });
});

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data',function(text){
});
