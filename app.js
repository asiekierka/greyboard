const express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , SocketServer = require('socket.io')
  , fs = require("fs")
  , _ = require('underscore');

// People would murder for this line. It's really bad.
eval(fs.readFileSync('lib/grayboard-util.js','utf8'));
eval(fs.readFileSync('lib/grayboard-canvas.js','utf8'));

var configFile = JSON.parse(fs.readFileSync('config.json','utf8'))
  , configDef = JSON.parse(fs.readFileSync('config-default.json','utf8'))
  , NodeCanvas = require('canvas')
  , Room = require('./room.js').Room
  , User = require('./user.js').User
  , Chat = require('./chat.js').Chat;

function createTemplate(name) {
  return _.template(fs.readFileSync('templates/'+name+'.html', 'utf8'));
}

var templates = {};
templates.room = createTemplate("room");
templates.roomList = createTemplate("roomlist");

var config = _.defaults(configFile,configDef);
config.mode = "server";

for(var key in config)
  if(_.isObject(config[key]))
    config[key] = _.defaults(configFile[key],configDef[key]);

var socketCfg = {};
if (config.socket_origins != "*") {
	socketCfg.origins = config.socket_origins;
}
const io = new SocketServer(server, socketCfg);

server.listen(config.port);

// Reserved room names
var blockedDirs = new Array("css", "fonts", "img", "js", "lib");

// Lookup dirs
app.use(express.static('static'));
app.use("/lib", express.static('lib'));

function sendPNG(req,res,room,asAttachment) {
  console.log("Sending PNG to room " + room);
  if(!Room.exists(room)) {
    res.writeHead(404,{});
    res.end();
    return;
  }
  try {
    Room.get(room).sendPNG(req,res,asAttachment);
  } catch(e) { res.send(500,{ error: e.message }); }
}

function sendTemplate(res,tpl,config) {
  try {
    var localIndex = tpl(config);
    res.type("text/html");
    res.send(localIndex);
  } catch(e) { res.send(500,{ error: e.message }); }
}
function sendRoomIndex(res,roomName) { sendTemplate(res,templates.room,{room: roomName}); }

function splitURL(url) {
  if(url.indexOf("/") == 0)
    return url.substr(1).split("/");
  if(url.length == 0)
    return null;
  return url.split("/");
}

app.use(function(req,res,next){
  var url = req.url;
  var cmds = splitURL(url);
  if(cmds.length==0 || (cmds.length==1 && cmds[0] == ''))
    cmds = ['list']; // Default
  var cmd = cmds[0];
  if(blockedDirs.indexOf(cmd)>=0) { // css, fonts, img, etc.
    res.writeHead(403,{});
    res.end();
    return;
  }
  // Determine mode of action
  if(cmd == "list") {
    sendTemplate(res,templates.roomList,{rooms: Room.listNames()});
  } else {
    if(cmd != "room") {
      cmd = "room";
      cmds.unshift(cmd);
    }
    var room = cmds[1] || "default"
      , params = cmds[2] || "";
    if(params.indexOf("canvas")==0) { sendPNG(req,res,room,false); }
    else if(params.indexOf("download")==0) { sendPNG(req,res,room,true); }
    else { sendRoomIndex(res,room); }
  }
});

function getRoomSocket(room) { return io.in(room.getChannel()); }
function getUserSocket(user) {
  if(!(_.isObject(user))) return null;
  return user.socket;
}

function sendChat(socket,sender,msg) {
  if(_.isArray(msg.at)) { // msg.at - message directed at specific nicknames
    for(var key in msg.at) {
      var nick = msg.at[key];
      var user = Room.findUserByName(nick);
      var sock = getUserSocket(user);
      if(_.isObject(sock))
        sock.emit('chat_message',msg);
    }
  } else socket.emit('chat_message',msg);
}

function flushBuffer() {
  for(var key in Room.rooms) {
    var room = Room.rooms[key];
    if(_.isObject(room) && room.buffer.length > 0) {
      io.in(room.getChannel()).emit('draw_commands',room.buffer);
      room.buffer = [];
    }
  }
  setTimeout(flushBuffer,50);
}

function draw(cmd,room) {
  return drawCommand(cmd,room.canvas,{mode: config.mode, room: room.config});
}

flushBuffer();

io.on('connection', function(socket) {
  socket.on('join_room', function(data) {
    roomName = Room.getName(data);
    socket.join(data);
    var room = Room.create(roomName, config.room);
    var chat = new Chat(room,config.chat);
    var user = new User(socket,"");
    user.genNickname(room.config.nickname);
    room.addUser(user);
    room.chat = chat;
    socket.emit('init',room.getInitCmd());
    sendChat(socket,null,chat.process('','Welcome to room ' + roomName + '!','server'));
    sendChat(socket.broadcast.to(data),null,chat.process("",user.nickname + " has joined the room!","server"));
  });

  socket.on('chat_send', function(data) {
    var room = Room.findUserRoom(socket.id);
    if(room && room.chat) {
      var sender = Room.findUser(socket.id);
      var msg = room.chat.process(Room.findUser(socket.id).nickname,data,"client");
      sendChat(getRoomSocket(room),sender,('chat_message',msg));
    }
  });

  socket.on('draw_command', function(data) {
    try {
      var cmd = data;
      if(properCommand(cmd) && Room.findUserRoom(socket.id)) {
        var room = Room.findUserRoom(socket.id);
        if(draw(cmd,room)) {
          cmd.id = socket.id;
          room.sendCommand(cmd);
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
        if(room.chat)
          sendChat(getRoomSocket(room),null,room.chat.process('',nick + " has left the room!","server"));
      }
    }
  });
});

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data',function(text){
});
