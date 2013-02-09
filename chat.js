var _ = require('underscore');

var Chat = function(room,config) {
  this.config = config;
  this.room = room;
  // Generate allowed commands based on config
  this.allowedCommands = _.difference(_.functions(this.commands),this.config.disabled);
  for(var f in this.commands)
    this.commands[f] = _.bind(this.commands[f], this);
}

Chat.prototype.commands = {};

Chat.prototype.parse = function(txt) {
  var newTxt = txt;
  if(newTxt.indexOf("/")==0)
    newTxt = txt.substr(1);
  return newTxt.split(" ");
}

Chat.prototype.unparse = function(txt) {
  return txt.join(" ");
}

Chat.prototype.commands.me = function(nick,text,mode) {
  var msg = {color: this.config.meColor, bold: true};
  msg.text = "* " + nick + " " + text.replace("/me ","");
  msg.color = "#701070";
  return msg;
}

Chat.prototype.commands.list = function(nick,text,mode) {
  return this.announcement("Active users: " + this.room.listUsers().join(", ") + ".");
}

Chat.prototype.commands.msg = function(nick,text,mode) {
  var msg = {color: this.config.messageColor, bold: true};
  var cmd = this.parse(text);
  msg.text = "[Private] " + this.messageText(nick,this.unparse(cmd.slice(2)));
  msg.at = [cmd[1], nick];
  if(cmd[1].toLowerCase() == nick.toLowerCase()) msg.at = [nick];
  return msg;
}

Chat.prototype.messageText = function(nick,text) { return "<"+nick+"> "+text; }
Chat.prototype.announcementText = function(text) { return "* " + text; }
Chat.prototype.message = function(nick,text) { return {color: this.config.messageColor, bold: false, text: this.messageText(nick,text)}; }
Chat.prototype.announcement = function(text) { return {color: this.config.serverColor, bold: true, text: this.announcementText(text)}; }
Chat.prototype.selfAnnouncement = function(nick,text) { return {at: [nick], color: this.config.serverColor, bold: true, text: this.announcementText(text)}; }

Chat.prototype.process = function(nick,text,mode) {
  if(text.indexOf("/")==0) {
    var func = this.parse(text)[0];
    if(_.contains(this.allowedCommands,func))
      return this.commands[func](nick,text,mode)
    else if(_.contains(_.functions(this.commands),func)) 
      return this.selfAnnouncement(nick,"Function /"+func+" has been disabled!");
    else
      return this.selfAnnouncement(nick,"Unknown command /"+func+"!");
  }
  if(mode=="client") return this.message(nick,text);
  else return this.announcement(text);
}

exports.Chat = Chat;
