var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , JSON = require('JSON2')
  , fs = require("fs")
  , grayboardIndex = fs.readFileSync('index.html','utf8')
  , _ = require('underscore');

// People would murder for this line. It's really bad.
eval(fs.readFileSync('lib/grayboard-util.js','utf8'));
eval(fs.readFileSync('lib/grayboard-canvas.js','utf8'));

var configFile = JSON.parse(fs.readFileSync('config.json','utf8'))
  , configDef = JSON.parse(fs.readFileSync('config-default.json','utf8'))
  , NodeCanvas = require('canvas')
  , Room = require('./types.js').Room
  , User = require('./types.js').User
  , Chat = require('./chat.js').Chat;

var config = _.defaults(configFile,configDef);

for(var key in config)
  if(_.isObject(config[key]))
    config[key] = _.defaults(configFile[key],configDef[key]);

server.listen(config.port);

// Reserved room names
var disallowedRooms = new Array("", "css", "fonts", "img", "js", "lib", "room", "user", "list");

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
  Room.get(room).sendPNG(req,res,asAttachment);
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
  if(disallowedRooms.indexOf(room)>=0) { // css, fonts, img, etc.
    res.writeHead(403,{});
    res.end();
    return;
  } else mode = "room";
  if(params.indexOf("canvas")>=0) { sendPNG(req,res,room,false); }
  else if(params.indexOf("download")>=0) { sendPNG(req,res,room,true); }
  else {
    var localIndex = grayboardIndex.replace("ROOMNAMEHERE",room).replace("SOCKETURLHERE",config.socketURL);
    res.type("text/html");
    res.send(localIndex);
  }
});

function getRoomSocket(room) { return io.sockets.in(room.getChannel()); }
function getUserSocket(user) { return user.socket; }

function sendChat(socket,sender,msg) {
  if(_.isString(msg.at)) { // msg.at - message directed at someone else and you [private]
    var user = Room.findUserByName(msg.at,false);
    if(user) {
      var usersock = getUserSocket(user);
      var sendersock = getUserSocket(sender);
      usersock.emit('chat_message',msg);
      sendersock.emit('chat_message',msg);
    }
  } else socket.emit('chat_message',msg);
}

io.sockets.on('connection', function(socket) {

  socket.on('join_room', function(data) {
    roomName = Room.getName(data);
    socket.join(data);
    var room = Room.create(roomName,config.room);
    var chat = new Chat(room,config.chat);
    var user = new User(socket,"");
    user.genNickname(room.config.nickname);
    room.addUser(user);
    room.chat = chat;
    socket.emit('init',room.getInitString());
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
    console.log("Received drawCommand: " + data);
    try {
      var cmd = JSON.parse(data);
      if(properCommand(cmd) && Room.findUserRoom(socket.id)) {
        var room = Room.findUserRoom(socket.id);
        var roomName = room.getChannel();
        var canvas = room.canvas;
        drawCommand(cmd,canvas,"server");
        socket.broadcast.to(roomName).emit('draw_command',data);
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
