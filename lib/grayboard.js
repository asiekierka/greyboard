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
}

var pointBrush = new PointBrush();
var colorPicker = new ColorPicker(config.colorPickerId);
var colorPreview = $("#colorpreview");
var smoothenCheck = $('#smooth');
var smoothenVal = $('#smoothslider');
var mode = "brush";
var chatbox = null;

function fixURL(url) {
  return config.baseURL + "/" + config.room + url;
}

function formatChat(msg) {
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
  menubarChecker();
  mouseHandler(ev,"mousedown");
  return false;
}

function mouseUHandler(ev) {
  isMouseDown = false;
  return false;
}

function mouseWHandler(e) {
  e.preventDefault();
  if(isMouseDown) {
    socketSend();
    pointBrush.reset();
  }
  var newsize = pointBrush.size+(2*Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail))));
  if(newsize>0 && newsize<=40) changeBrushSize(newsize);
  return false;
}

function changeBrushSize(val) {
  pointBrush.size = val;
  $('#size_val').text(val+"px");
}

function menubarChecker() {
  colorPreview.css("background-color",colorPicker.getColor());
  if(!colorPicker.isHidden || mode == "eyedropper") setTimeout(menubarChecker,40);
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
    cmd = new Object();
    cmd.name = "points";
    cmd.color = pointBrush.color;
    cmd.points = pointBrush.getDelta();
    cmd.continued = pointBrush.continued;
    cmd.size = pointBrush.size;
    pointBrush.resetHistory();
    pointBrush.addLastHistory();
    data = JSON.stringify(cmd);
    sendPacket("draw_command",data);
  }
}

function socketChecks() {
  socketSend();
  setTimeout(function(){socketChecks()},config.socketWaitTime);
}

function initCanvas() {
  $('#'+config.canvasId).mousedown(mouseDHandler)
                        .mousemove(mouseHandler)
                        .mouseup(mouseUHandler)
                        .mouseout(mouseUHandler);
  document.getElementById(config.canvasId).addEventListener("touchmove",mouseHandler);
  document.getElementById(config.canvasId).addEventListener("touchstart",mouseDHandler); 
  document.getElementById(config.canvasId).addEventListener("touchend",mouseUHandler);
  document.getElementById(config.canvasId).addEventListener("mousewheel",mouseWHandler);
  document.getElementById(config.canvasId).addEventListener("DOMMouseScroll",mouseWHandler);
}

function loadCanvas(w,h,callback) {
  $("#"+config.toolboxId).css("width",(w-8)+"px");
  $("#canv_box").css("width",w+"px").css("height",h+"px");
  canvas = new Canvas(config.canvasId,null,w,h);
  canvas.clear();
  canvas.drawImageURL(fixURL("/canvas.png"),0,0,callback);
}

function initModes() {
  for(var key in brushes)
    $("#btn_"+key).click({mode: key}, function(ev){setMode(ev.data.mode); return false;});
}

function initMenubar() {
  smoothenVal.slider({min: 0, max: 99});
  smoothenVal.css("width","100px");
  smoothenVal.css("height","16px");
  smoothenVal.css("display","inline-block");
  colorPicker.hide();
  $("#color_icon_on").hide();
  menubarChecker();
  initModes();
  $("#toggle_color").click(function(ev) {
    ev.preventDefault();
    if(colorPicker.isHidden) {
      colorPicker.show();
      $("#color_icon_on").show();
      $("#color_icon_off").hide();
      menubarChecker();
    } else {
      colorPicker.hide();
      $("#color_icon_on").hide();
      $("#color_icon_off").show();
      menubarChecker();
    }
    return false;
  });
  $("#size_minus").click(function() {
    var newsize = pointBrush.size-2;
    if(newsize>0) changeBrushSize(newsize);
    return false;
  });
  $("#size_plus").click(function() {
    var newsize = pointBrush.size+2;
    if(newsize<=40) changeBrushSize(newsize);
    return false;
  });
}

function initSockets() {
  socket = io.connect(config.socketURL);
  socket.emit("join_room", "room_" + config.room);
  socket.on("draw_command", function(data) {
    try {
      var cmd = JSON.parse(data);
      drawCommand(cmd,canvas,"client");
    }
    catch(e) { console.log("Error: " + e.message); }
  });
  socket.on("init", function(data) {
    if(_.isNull(canvas)) {
      var cmd = JSON.parse(data);
      loadCanvas(cmd.width,cmd.height,function(){
        $("#grayboard").show();
        $("#loading").hide();
      });
    }
  });
  socketChecks();
}

function initChat() {
  chatbox = $("#chatbox");
  socket.on("chat_message", function(msg) {
    var data = formatChat(msg);
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

function initConfig() {
  config.baseURL = "http://" + (new URI()).host();
  config.socketURL = "http://" + (new URI()).hostname();
}

function initGrayboard() {
  initConfig();
  initCanvas();
  initMenubar();
  initSockets();
  initChat();
  changeBrushSize(10);
}
