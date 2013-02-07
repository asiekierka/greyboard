// 256x192 colorpicker applet thing

var ColorPicker = function(caname) {
  // Initialize variables
  this.color = tinycolor("#999999");
  this.recache();
  // Initialize canvas
  this.htmlCanvas = $("#"+caname);
  this.canvas = new Canvas(caname,null,248,192);
  this.canv = this.canvas.canvas;
  this.mouseDown = false;
  this.lastDrawTime = 0;
  this.isHidden = false;
  this.lChange = true;
  if(this.canv.createImageData) {
    this.hsldata = this.canvas.canvas.createImageData(180,180);
    this.hslpixels = this.hsldata.data;
  }
  this.pDraw = $.proxy(this.draw,this);
  this.htmlCanvas.mousedown($.proxy(this.mouseDownHandler,this));
  this.htmlCanvas.mousemove($.proxy(this.mouseMoveHandler,this));
  this.htmlCanvas.mouseup($.proxy(this.mouseUpHandler,this));
  $(document).ready(this.pDraw);
}

ColorPicker.prototype.hide = function(ev) {
 this.htmlCanvas.hide();
 this.isHidden = true;
}
ColorPicker.prototype.show = function(ev) {
 this.htmlCanvas.show();
 this.isHidden = false;
}

ColorPicker.prototype.mouseDownHandler = function(ev) { ev.preventDefault(); this.mouseDown = true; this.mouseMoveHandler(ev); return false; }
ColorPicker.prototype.mouseUpHandler = function(ev) { this.mouseDown = false; return false; }
ColorPicker.prototype.mouseMoveHandler = function(ev) {
  if(!this.mouseDown) return false;
  // calculate position
  var rect = ev.target.getBoundingClientRect();
  var x = ev.offsetX || ev.pageX - rect.left - window.scrollX;
  var y = ev.offsetY || ev.pageY - rect.top - window.scrollY;
  var hsl = this.color.toHsl();
  if(x>=8 && x<188 && y >= 6 && y<186) {
    hsl["h"] = (x-8)/179;
    hsl["s"] = 1-((y-6)/179);
    this.lChange = true;
  }
  else if(x>=195 && x<215 && y >= 6 && y<186) {
    hsl["l"] = (y-6)/179;
  }
  else if(x>=221 && x<241 && y >= 6 && y<156) {
    hsl["a"] = (y-6)/149;
  }
  this.color = tinycolor.fromRatio(hsl);
  this.recache();
  this.drawOnTime();
  return false;
}

ColorPicker.prototype.drawOnTime = function() {
  var diff = (new Date().getTime())-this.lastDrawTime;
  this.lastDrawTime = (new Date().getTime());
  if(diff<0) return; // Future
  if(diff>=40) {
    this.draw();
  } else {
    this.lastDrawTime += diff;
    setInterval(this.pDraw,diff);
  }
}

ColorPicker.prototype.drawHueBox = function(l) {
  if(!this.canv.putImageData) { // graceful fallback
    for(var s=179;s>=0;s--) {
      for(var h=0;h<180;h+=2) { // hack to speed things up
        this.canv.fillStyle = tinycolor.fromRatio({ h: (h/180), s: (s/180), v: l}).toHexString();
        this.canv.fillRect(h+6,s+6,2,1);
      }
    }
  } else {
    var hslpixels = this.hslpixels;
    var pos = 0;
    for(var s=0;s<180;s++) {
      for(var h=0;h<180;h+=2) {
        var t = tinycolor.fromRatio({ h: (h/180), s: 1-(s/180), v: l}).toRgb();
        hslpixels[pos] = t["r"]; hslpixels[pos+1] = t["g"];
        hslpixels[pos+2] = t["b"]; hslpixels[pos+3] = 255;
        hslpixels[pos+4] = t["r"]; hslpixels[pos+5] = t["g"];
        hslpixels[pos+6] = t["b"]; hslpixels[pos+7] = 255;
        pos += 8;
      }
    }
    this.canv.putImageData(this.hsldata,8,6);
  }
}
ColorPicker.prototype.drawLABox = function(hsl) {
  // Alpha
  for(var y=0;y<30;y++) {
    for(var x=0;x<4;x++) {
      var st = (x+y)%2;
      if(st==0) { this.canv.fillStyle = "#555555"; }
      else { this.canv.fillStyle = "#AAAAAA"; }
      this.canv.fillRect(221+(x*5),6+(y*5),5,5)
    }
  }
  var col = tinycolor(hsl).toRgb();
  for(var l=0;l<180;l++) {
    // Luma
    this.canv.fillStyle = tinycolor.fromRatio({ h: hsl["h"], s: hsl["s"], l: (l/180)}).toHexString();
    this.canv.fillRect(195,l+6,20,1);
    // Alpha
    if(l<150) {
      this.canv.fillStyle = "rgba("+col["r"]+","+col["g"]+","+col["b"]+","+(l/150)+")";
      this.canv.fillRect(221,l+6,20,1);
    }
  }
}

ColorPicker.prototype.getColor = function() { return this.localColor; }
ColorPicker.prototype.setColor = function(c) {
  this.color = tinycolor(c); this.recache();
  this.lChange = true; this.drawOnTime();
}
ColorPicker.prototype.recache = function() { this.localColor = this.color.toRgbString(); }

ColorPicker.prototype.draw = function() {
  var hsl = this.color.toHsl();
  // Body
  if(this.lastDrawTime == 0) { // first
    this.canv.fillStyle = "#999999";
    this.canv.fillRect(0,0,256,192);
    this.drawHueBox(0.8);
  }
  // Box for luma
  if(this.lChange)
    this.drawLABox(hsl);
  // Color preview
  this.canv.fillStyle = "#5F5F5F";
  this.canv.fillRect(221,166,20,20);
  for(var y=0;y<4;y++) {
    for(var x=0;x<4;x++) {
      var st = (x+y)%2;
      if(st==0) { this.canv.fillStyle = "#555555"; }
      else { this.canv.fillStyle = "#AAAAAA"; }
      this.canv.fillRect(223+(x*4),168+(y*4),4,4);
    }
  }
  this.canv.fillStyle = this.color.toRgbString();
  this.canv.fillRect(223,168,16,16);
}
