// Grayboard HTML5 whiteboard
// (c)  Adrian Siekierka 2013

var canvas = null;
var isMouseDown = false;

var brushes = {};
brushes.brush = function(pos,ev,trigger) {
  pointBrush.color = colorPicker.getColor();
  pointBrush.draw(pos["x"],pos["y"],canvas,!smoothenCheck.prop("checked"));  
}
brushes.eraser = function(pos,ev,trigger) {
  pointBrush.color = "#FFFFFF";
  pointBrush.draw(pos["x"],pos["y"],canvas,!smoothenCheck.prop("checked"));  
}
brushes.eyedropper = function(pos,ev,trigger) {
  colorPicker.setColor(canvas.getColor(pos["x"],pos["y"]));
  checkMenubar();
}

var pointBrush = new PointBrush();
var colorPicker = new ColorPicker(config.colorPickerId);
var colorPreview = $("#colorpreview");
var smoothenCheck = $('#smooth');
var smoothenVal = $('#smoothslider');
var mode = "brush";
var chatbox = null;

function fixURL(url) {
  return config.baseURL + "/" + config.roomName + url;
}

function chatHTML(msg) {
  var text = msg.text.replace("<","&lt;").replace(">","&gt;");
  var pref = ""; var suff = "";
  if(msg.bold) { pref += "<b>"; suff += "</b>"; }
  return "<span style='color: " + msg.color + ";'>" + pref + text + suff + "</span>";
}

function mouseHandler(ev,trig) {
  if(!isMouseDown) return;
  var trigger = trig || "mousemove";
  // calculate position
  var pos = canvas.getMousePos(ev);
  if(_.isFunction(brushes[mode]))
    brushes[mode](pos,ev,trigger);
}

function mouseDHandler(ev) {
  if(isMouseDown) return;
  ev.preventDefault();
  isMouseDown = true;
  socketSend(); // verify if sent
  pointBrush.reset();
  pointBrush.coeff = 1.0-((smoothenVal.slider("value")+25)/150);
  mouseHandler(ev,"mousedown");
  return false;
}

function mouseUHandler(ev) {
  isMouseDown = false;
  socketSend(); // verify again
  return false;
}

function mouseWHandler(e,delta) {
  e.preventDefault();
  if(isMouseDown) {
    socketSend();
    pointBrush.reset();
  }
  var newsize = pointBrush.size+(delta*2);
  if(newsize>=config.room.minBrushSize && newsize<=config.room.maxBrushSize) changeBrushSize(newsize);
  return false;
}

function keyHandler(e) {
  console.log(e.which);
  console.log(e);
  if(e.which == 81) { setMode("brush"); return false; }
  if(e.which == 87) { setMode("eraser"); return false; }
  if(e.which == 69) { setMode("eyedropper"); return false; }

}

function changeBrushSize(val) {
  pointBrush.size = val;
  $('#size_val').text(Math.floor(val)+"px");
}

function checkMenubar() {
  colorPreview.css("background-color",colorPicker.getColor());
  if(!colorPicker.isHidden || mode == "eyedropper") setTimeout(checkMenubar,40);
}

function setMode(mmode) {
  mode = mmode;
  for(var key in brushes) {
    if(key==mode)
      $("#btn_"+mode).addClass("selected");
    else $("#btn_"+key).removeClass("selected");
  }
}

function sendPacket(name,data) { socket.emit(name,data); }

function socketSend() {
  if(!pointBrush.isEmpty()) {
    cmd = {name: "points", color: pointBrush.color,
           continued: pointBrush.continued, size: pointBrush.size,
           points: pointBrush.getDelta()};
    pointBrush.resetHistory();
    pointBrush.addLastHistory();
    sendPacket("draw_command",cmd);
  }
}

function checkSocket() {
  socketSend();
  setTimeout(function(){checkSocket()},config.socketWaitTime);
}

function initCanvas() {
  $('#'+config.canvasId).bind({
			  mousedown: mouseDHandler,
                          mousemove: mouseHandler,
                          mouseup: mouseUHandler,
                          mouseout: mouseUHandler,
                          touchmove: mouseHandler,
                          touchstart: mouseDHandler, 
                          touchend: mouseUHandler,
                          mousewheel: mouseWHandler
			});
  $("#canv_box").keydown(keyHandler);
  $("#tools").keydown(keyHandler);
}

function loadCanvas(conf,callback) {
  config.room = conf;
  var w = config.room.width
    , h = config.room.height;
  $("#"+config.toolboxId).css("width",(w-8)+"px");
  $("#canv_box").css("width",w+"px").css("height",h+"px");
  canvas = new Canvas(config.canvasId,null,w,h);
  canvas.clear();
  canvas.drawImageURL(fixURL("/canvas.png"),0,0,callback);
}

function initConfig() {
  config.baseURL = "http://" + window.location.host;
  config.socketURL = "http://" + window.location.host;
}

function initMenubar() {
  for(var key in brushes)
    $("#btn_"+key).click({mode: key}, function(ev){setMode(ev.data.mode); return false;});
  smoothenVal.slider({min: 0, max: 99})
             .css("width","100px").css("height","16px")
             .css("display","inline-block");
  colorPicker.hide();
  $("#color_icon_on").hide();
  checkMenubar();
  $("#toggle_color").click(function(ev) {
    ev.preventDefault();
    if(colorPicker.isHidden) {
      colorPicker.show();
      $("#color_icon_on").show();
      $("#color_icon_off").hide();
    } else {
      colorPicker.hide();
      $("#color_icon_on").hide();
      $("#color_icon_off").show();
    }
    checkMenubar();
    return false;
  });
  $("#size_minus").click(function() {
    var newsize = pointBrush.size-2;
    if(newsize>=config.room.minBrushSize) changeBrushSize(newsize);
    return false;
  });
  $("#size_plus").click(function() {
    var newsize = pointBrush.size+2;
    if(newsize<=config.room.maxBrushSize) changeBrushSize(newsize);
    return false;
  });
}

function initSockets() {
  socket = io(config.socketURL);
  socket.on("draw_command", function(data) {
    try {
      var cmd = data;
      console.log(cmd);
      drawCommand(cmd,canvas,config);
    }
    catch(e) { console.log("Error: " + e.message); }
  });
  socket.on("draw_commands", function(data) {
    try {
      var cmd = data;
      console.log(cmd);
      for(var key in cmd) {
        if(_.isUndefined(cmd[key].id) || cmd[key].id != socket.id)
          drawCommand(cmd[key],canvas,config);
      }
    }
    catch(e) { console.log("Error: " + e.message); }
  });
  socket.on("init", function(data) {
    var cmd = data;
    if(_.isNull(canvas))
      loadCanvas(cmd,function(){
        changeBrushSize(config.room.brushSize);
        $("#grayboard").show();
        $("#loading").hide();
      });
  });
  socket.emit("join_room", "room_" + config.roomName);
  checkSocket();
}

function initChat() {
  chatbox = $("#chatbox");
  socket.on("chat_message", function(msg) {
    var data = chatHTML(msg);
    var old = chatbox.html();
    if(old!="") old += "<br>";
    chatbox.html(old + data);
    chatbox.scrollTop(chatbox.scrollTop()+500);
  });
  $("#chatsubmit").click(function() {
    var msg = $("#chatmsg").val();
    $("#chatmsg").val("");
    socket.emit("chat_send",msg);
  });
  $("#chatmsg").bind('keypress',function(ev) {
    if(ev.which == 13)
      $("#chatsubmit").click();
  });
}

function initGrayboard() {
  console.log("Initializing config...");
  initConfig();
  console.log("Initializing sockets...");
  initSockets();
  console.log("Initializing canvas...");
  initCanvas();
  console.log("Initializing menu...");
  initMenubar();
  console.log("Initializing chat...");
  initChat();
}
