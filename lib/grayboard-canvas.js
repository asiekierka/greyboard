// Grayboard HTML5 whiteboard
// (c)  Adrian Siekierka 2013
// Licensed under MIT license

// *CANVAS*
Canvas = function(id,ctx,w,h) {
  this.width=w; this.height=h; this.canvas = ctx;
  if(typeof id == "string") {
    this.htmlCanvas = document.getElementById(id);
    this.htmlCanvas.setAttribute("width",w);
    this.htmlCanvas.setAttribute("height",h);
    this.jqueryCanvas = $("#"+id);
    this.canvas = this.htmlCanvas.getContext('2d');
  }
}

Canvas.prototype.getColor = function(x,y) {
  if(x<0 || y<0 || x>=this.width || y>=this.height) return null;
  var p = this.canvas.getImageData(x,y,1,1).data;
  return { r: p[0], g: p[1], b: p[2]};
}

Canvas.prototype.getMousePos = function(ev) {
  var rect = ev.target.getBoundingClientRect();
  var tx = ev.offsetX || ev.layerX || ev.pageX - this.jqueryCanvas.offset().left;
  var ty = ev.offsetY || ev.layerY || ev.pageY - this.jqueryCanvas.offset().top;
  return { x: tx, y: ty };
}

Canvas.prototype.clear = function() {
  this.canvas.fillStyle="#FFFFFF";
  this.canvas.fillRect(0,0,this.width,this.height); 
}

Canvas.prototype.drawImageURL = function(url,x,y,callback) {
  var img = new Image();
  var ca = this.canvas;
  img.src = url;
  img.onload = (function(){ ca.drawImage(img,0,0); if(_.isFunction(callback)) callback(); });
  
}

Canvas.prototype.getPixelPos = function(x,y) {
  return ((y*this.width)+x)*4;
}

Canvas.dirs = new Array(new Array(-1,0), new Array(1,0), new Array(0,-1), new Array(0,1));

Canvas.prototype.floodFill = function(x,y,color) {
  var imgid = this.canvas.getImageData(0,0,this.width,this.height);
  var imgdata = imgid.data;
  var fpos = this.getPixelPos(x,y);
  var colrgb = tinycolor(color).toRgb();
  var queue = new Array();
  var newQueue = null;
  var dirs = Canvas.dirs;
  var pixels = 0;
  queue.push(this.getPixelPos(x,y));
  while(queue.length>0) {
    newQueue = new Array();
    for(var i=0;i<queue.length;i++) {
      pixels++;
      var pos = queue[i];
      imgdata[pos] = colrgb.r;
      imgdata[pos+1] = colrgb.g;
      imgdata[pos+2] = colrgb.b;
      for(var j=0;j<dirs.length;j++) {
        var npos = pos+this.getPixelPos(dirs[j][0],dirs[j][1]);
        // Check Y *flow
        if(npos<0 || npos>=(this.width*this.height*4)) return;
        // Check X underflow
        if(dirs[j][0]==-1 && npos%(this.width*4) == 0) return;
        // Check X overflow
        if(dirs[j][0]==1 && (npos+4)%(this.width*4) == 0) return;
        // Nothing or the color we're trying to fill
        if(imgdata[npos+3]==0 || (imgdata[npos]==imgdata[fpos] && imgdata[npos+1]==imgdata[fpos+1] && imgdata[npos+2]==imgdata[fpos+2])) {
          newQueue.push(npos);
        }
      }
    }
    queue = newQueue.slice(0);
  }
  console.log("Filled " + pixels + " pixels.");
}

// *POINTBRUSH*
PointBrush = function() {
  this.lastPointX = -1; this.lastPointY = -1; this.pointHistory = new Array();
  this.size = 10; this.color = "#FF0000"; this.isPHEmpty = true; this.continued = false; 
  this.coeff = 0.5;
}

PointBrush.prototype.pickXY = function(x,y,precalc) {
  var o = {};
  var i = {};
  var t = {};
  i.x = x; i.y = y;
  if(this.continued == false || precalc == true) return i; 
  o.x = this.lastPointX; o.y = this.lastPointY;
  var a0 = this.coeff;
  t.x = a0*i.x + (1.0-a0)*o.x;
  t.y = a0*i.y + (1.0-a0)*o.y;
  return t;
}

PointBrush.prototype.draw = function(nx,ny,origcanv,precalc) {
  var canv = origcanv.canvas;
  var tmp = this.pickXY(nx,ny,(precalc || false));
  var x = tmp.x; var y = tmp.y;
  if(this.continued == false) {
    canv.fillStyle = this.color;
    canv.beginPath();
    canv.arc(x,y,this.size/2,Util.deg(0),Util.deg(360),true);
    canv.fill();
    this.continued = true;
  } else {
    canv.lineWidth = this.size;
    canv.lineCap = "round";
    canv.strokeStyle = this.color;
    canv.beginPath();
    canv.moveTo(this.lastPointX,this.lastPointY);
    canv.lineTo(x,y);
    canv.stroke();
  }
  canv.closePath();
  this.advance(x,y);
}

PointBrush.prototype.advance = function(xx,yy) {
  this.addHistory(xx,yy);
  this.lastPointX = xx; this.lastPointY = yy;
  this.isPHEmpty = false;
}

PointBrush.prototype.getDelta = function() {
  var ph = new Array();
  for(var i=0;i<this.pointHistory.length;i++) {
    var pho = {x: this.pointHistory[i].x, y: this.pointHistory[i].y, time: this.pointHistory[i].time};
    if(i>0) {
      var phoLast = this.pointHistory[i-1];
      pho.x = pho.x-phoLast.x; pho.y = pho.y-phoLast.y;
      pho.time = pho.time-phoLast.time;
    } else {
      pho.time = 0;
    }
    ph.push(pho);
  }
  return ph;
}

PointBrush.prototype.addHistory = function(xx,yy) {
  this.pointHistory.push({x: xx, y: yy, time: Util.time()});
}
PointBrush.prototype.addLastHistory = function() { this.addHistory(this.lastPointX,this.lastPointY); }

PointBrush.prototype.resetHistory = function() { this.pointHistory = new Array(); this.isPHEmpty = true; this.continued = true; }
PointBrush.prototype.reset = function() {
  this.resetHistory(); this.continued = false;
}

PointBrush.prototype.isEmpty = function() { return this.isPHEmpty; }

// *POINTBRUSH END*

function recursivePointDraw(brush, points, canvas, i, x, y) {
  if(i>=points.length || !(_.isArray(points)) || _.isUndefined(brush)) return;
  var px = x+points[i].x;
  var py = y+points[i].y;
  if(i==0 && brush.continued) { brush.lastPointX = px; brush.lastPointY = py; brush.addLastHistory(); }
  brush.draw(px,py,canvas,true);
  if((i+1)<points.length)
    setTimeout(function() { recursivePointDraw(brush, points, canvas, i+1, px, py); },points[i+1].time);
}

function drawCommand(cmd,canv,mode) {
  if(!(_.isObject(canv))) return;
  cmdPointBrush = new PointBrush();
  if(cmd.name == "points") {
    var points = cmd.points;
    cmdPointBrush.reset();
    cmdPointBrush.color = cmd.color;
    cmdPointBrush.size = cmd.size;
    cmdPointBrush.continued = cmd.continued;
    var px = 0;
    var py = 0;
    if(mode == "server") {
      for(var i=0;i<points.length;i++) {
        px+=points[i].x; py+=points[i].y;
        if(i==0 && cmd.continued) { cmdPointBrush.lastPointX = px; cmdPointBrush.lastPointY = py; cmdPointBrush.addLastHistory(); }
        cmdPointBrush.draw(px,py,canv,true);
      }
    } else recursivePointDraw(cmdPointBrush,points,canv,0,px,py);
  } else if(cmd.name == "clear") {
    canv.clear();
  }
}

function properCommand(cmd) {
  return (cmd.name == "points");
}
