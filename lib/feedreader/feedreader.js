var xml = require('node-xml/node-xml');
var http = require('http');
var urlParser = require('url');
var sys = require('sys');
var EventEmitter = require('events').EventEmitter,
  inherits = require('sys').inherits,
  httpclient = require('httpclient');  

var FeedReader = exports.FeedReader = function(url) {
  EventEmitter.call(this);
  this.url_string = url;
  this.url = urlParser.parse(url);  
  this.atom = false;
}

inherits(FeedReader, EventEmitter);

FeedReader.prototype.parse = function(callback) {  
  // Read the feed
  var self = this;  
  var client = new httpclient.httpclient();

  client.perform(this.url_string, 'GET', function(result) {
    var body = result.response.body;
    // Parse the feed
    self.parseString(body, function(doc) {
      self.doc = doc;
      // Establish if we have a atom or rss feed
      self.atom = self.doc.rss ? false : true;      
      callback(self);
    });    
  });
}

FeedReader.prototype.title = function() {
  return this.atom ? this.doc.feed.title.toString() : this.doc.rss.channel.title.toString();
}

FeedReader.prototype.description = function() {
  return this.atom ? this.doc.feed.subtitle.toString() : this.doc.rss.channel.description.toString();
}

FeedReader.prototype.length = function() {
  // Do the correct foreach depending on if it's atom or rss
  if(this.atom) {
    return Array.isArray(this.doc.feed.entry) ? this.doc.feed.entry.length : 1;
  } else {
    return Array.isArray(this.doc.rss.channel.item) ? this.doc.rss.channel.item.length : 1;      
  }
}

FeedReader.prototype.forEachEntry = function(callback) {
  // Do the correct foreach depending on if it's atom or rss
  if(this.atom) {
    Array.isArray(this.doc.feed.entry) ? this.doc.feed.entry.forEach(callback) : [this.doc.feed.entry].forEach(callback);        
  } else {
    Array.isArray(this.doc.rss.channel.item) ? this.doc.rss.channel.item.forEach(callback) : [this.doc.rss.channel.item].forEach(callback);    
  }
}

// Returns Promise
FeedReader.prototype.parseString = function(string, callback) {
 var parser = new xml.SaxParser(function(cb) {
   var current_tree = [];
   var previous_object = null;
   var current_object = null;

   // TODO: Make this support prefixes and URIs
   cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
     // Set up object
     current_object = new Element(current_object);
     current_object.setAttrs(attrs);
     
     // Time to insert current_object into parent
     var parent = current_object.getParent();
     
     // If it has no parent, just return
     if(parent == null) return;
     
     // Determine how to add to parent
     if(typeof(parent[elem]) === "undefined") {
       // Parent doesn't have this element added yet, so just add it right to it
       parent[elem] = current_object;
     } else if(parent[elem].constructor == Array) {
       // Parent already has an array of elems, so just add it
       parent[elem].push(current_object);
     } else {
       // It already exists and is an object, so it needs to be converted to an array
       parent[elem] = [parent[elem], current_object];
     }
   });
   
   cb.onCharacters(addContent);
   cb.onCdata(addContent);
   
   function addContent(str) {
     if(current_object != null) {
       if(typeof(current_object["content"]) == "undefined") current_object["content"] = "";
       current_object["content"] += str;        
     }
   }
   
   cb.onEndElementNS(function(elem, prefix, uri) {
     if(current_object.getParent() == null) {
       var obj = {};
       obj[elem] = current_object;
       callback(obj);
     } else {
       var p = current_object
       current_object = current_object.getParent();
     }
   });
 });
 parser.parseString(string);
}

/**
  XML 2 Object
**/
var Element = function(parent) {
 var parent = parent;
 var attrs  = {};
 
 this.getParent = function() { return parent; } 
 this.toString = function() { return this['content'] || ""; }
 
 this.setAttrs = function(nAttrs) {
   for(var i in nAttrs) {
     attrs[nAttrs[i][0]] = nAttrs[i][1];
   }
 }
 
 this.attrs = function() { return attrs; } 
 this.attr = function(key) { return attrs[key]; }
}