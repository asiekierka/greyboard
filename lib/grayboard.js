// Grayboard HTML5 whiteboard
// (c)  Adrian Siekierka 2013

var canvas = undefined;
var isMouseDown = false;
var pointBrush = new PointBrush();
var cmdPointBrush = new PointBrush();
var colorPicker = new ColorPicker('colpick');
var colorPreview = $('#colpre');
var smoothenCheck = $('#smooth');
var smoothenVal = $('#smoothslider');
var mode = "brush";
var lastMode = "brush";
var chatbox = undefined;
var modes = new Array("brush","eraser","eyedropper","floodfill");

function fixURL(url) {
  return config.baseURL + "/" + config.room + url;
}

function mouseHandler(ev) {
  if(!isMouseDown) return;
  // calculate position
  var pos = canvas.getMousePos(ev);
  if(mode=="brush") {
    pointBrush.color = colorPicker.getColor();
    pointBrush.draw(pos["x"],pos["y"],canvas,!smoothenCheck.prop("checked"));
  } else if(mode=="eraser") {
    pointBrush.color = "#FFFFFF";
    pointBrush.draw(pos["x"],pos["y"],canvas,!smoothenCheck.prop("checked"));
  } else if(mode=="eyedropper") {
    colorPicker.setColor(canvas.getColor(pos["x"],pos["y"]));
  }
}

function mouseDHandler(ev) {
  if(isMouseDown) return;
  isMouseDown = true;
  socketSend(); // verify if sent
  pointBrush.reset();
  pointBrush.coeff = 1.0-((smoothenVal.slider("value")+25)/150);
  menubarChecker();
  if(mode=="floodfill") {
    var pos = canvas.getMousePos(ev);
    canvas.floodFill(pos["x"],pos["y"],colorPicker.getColor());
  } else mouseHandler(ev);
  return false;
}

function mouseUHandler(ev) {
  isMouseDown = false;
  if(mode == "eyedropper") setMode(lastMode);
  return false;
}

function changeBrushSize(val) {
  pointBrush.size = val;
  $('#size_val').text(val+"px");
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

function initCanvas() {
  $('#canv').mousedown(mouseDHandler);
  $('#canv').mousemove(mouseHandler);
  $('#canv').mouseup(mouseUHandler);
  $('#canv').mouseout(mouseUHandler);
  document.getElementById("canv").addEventListener("touchmove",mouseHandler);
  document.getElementById("canv").addEventListener("touchstart",function(e){ 
    e.preventDefault(); mouseDHandler(e); });
  document.getElementById("canv").addEventListener("touchend",mouseUHandler);
  document.getElementById("canv").addEventListener("mousewheel",mouseWHandler);
  document.getElementById("canv").addEventListener("DOMMouseScroll",mouseWHandler);
}

function loadCanvas(w,h,callback) {
  $("#tools").css("width",(w-8)+"px");
  $("#canv_box").css("width",w+"px");
  $("#canv_box").css("height",h+"px");
  canvas = new Canvas("canv",undefined,w,h);
  canvas.clear();
  canvas.drawImageURL(fixURL("/canvas.png"),0,0,callback);
}

function menubarChecker() {
  colorPreview.css("background-color",colorPicker.getColor());
  if(!colorPicker.isHidden || mode == "eyedropper") setTimeout(menubarChecker,40);
}

function setMode(mmode) {
  lastMode = mode;
  mode = mmode;
  for(var i=0;i<modes.length;i++) {
    if(modes[i]==mode)
      $("#btn_"+mode).addClass("selected");
    else $("#btn_"+modes[i]).removeClass("selected");
  }
}

function initModes() {
  $("#btn_brush").click(function(){setMode("brush"); return false;});
  $("#btn_eraser").click(function(){setMode("eraser"); return false;});
  $("#btn_eyedropper").click(function(){setMode("eyedropper"); return false;});
  $("#btn_floodfill").click(function(){setMode("floodfill"); return false;});
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
    if(!canvas) {
      var cmd = JSON.parse(data);
      loadCanvas(cmd.width,cmd.height,function(){
        $("#grayboard").show();
        $("#loading").hide();
      });
    }
  });
  socketChecks();
}

function formatChat(msg) {
  var text = msg.text.replace("<","&lt;").replace(">","&gt;");
  var pref = ""; var suff = "";
  if(msg.bold) { pref += "<b>"; suff += "</b>"; }
  return "<span style='color: " + msg.color + ";'>" + pref + text + suff + "</span>";
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
