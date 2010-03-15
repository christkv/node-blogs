require.paths.unshift('lib');
require.paths.unshift('external-libs');

var kiwi = require('kiwi'),
  express = kiwi.require('express'),
  sys = require('sys'),
  simplifier = require('simplifier/simplifier'),
  querystring = require('querystring')

// Require the express libary
require('express');
require('express/plugins');

// Initialize the seeds  
kiwi.seed('mongodb-native');
  
// Fetch the library records
var mongo = require('mongodb');

// Set up the host for the server
var host = process.env['NODEBLOGS_HOST'] != null ? process.env['NODEBLOGS_HOST'] : 'localhost';
var port = process.env['NODEBLOGS_PORT'] != null ? process.env['NODEBLOGS_PORT'] : 3000;

// Set up a Db and open connection to the mongodb
var db = new mongo.Db('nodeblogs', new mongo.Server("127.0.0.1", 27017, {auto_reconnect: true}, {}));
db.open(function(db) {});

// Just mix in a helper method to the String class
String.prototype.escapeHTML = function() {
  return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Configure the app
configure(function(){
  kiwi.seed('haml')
  kiwi.seed('sass')

  use(MethodOverride);
  use(ContentLength);
  use(CommonLogger);  
  use(Cookie);
  use(Session);
  use(Flash);
  set('root', __dirname);
});

/**
  Index showing aggregated information
**/
get('/', function() {
  var self = this;
  
  // Define google map initialize function to run on client
  var googleMapsInitializeFunction = (function initialize() {
    // Setup the map intialization
    var latlng = new google.maps.LatLng(-34.397, 150.644);
    var myOptions = {
      zoom: 1,
      center: latlng,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    
    // Create map
    var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
    
    // Let's do a moo-tools request and get the data for the locations and create the markers
    var jsonRequest = new Request.JSON({url: "/users/location", onSuccess: function(locations){
      for(var i = 0; i < locations.length; i++) {
        if(locations[i].loc != null) {
          var userlatlng = new google.maps.LatLng(locations[i].loc.long, locations[i].loc.lat);
          var marker = new google.maps.Marker({
            position: userlatlng,
            map: map,
            title: locations[i].screen_name,
            icon: locations[i].profile_image_url
          });
          // Add click handling
          google.maps.event.addListener(marker, 'click', function() {
            map.panTo(userlatlng);
          });
        }
      }
    }}).get();
    
    
  }).toString();

  // Execute 
  new simplifier.Simplifier().execute(
    // Context
    self,
    
    // Array of processes to execute before doing final handling
    [
      function(callback) {
        db.collection('blogentries', function(err, collection) {
          collection.find({}, {limit:10}, function(err, cursor) {
            cursor.sort('published_on_mili', -1, function(err, cursor) {
              cursor.toArray(function(err, docs) { callback(docs); });
            });
          });
        });      
      },

      function(callback) {
        db.collection('githubusers', function(err, collection) {
          collection.find({}, {limit:30}, function(err, cursor) {
            cursor.toArray(function(err, users) { callback(users); })
          });
        });      
      },
      
      function(callback) {
        db.collection('githubprojects', function(err, collection) {
          collection.find({}, {limit:45, sort:[['watchers', -1]]}, function(err, cursor) {
            cursor.toArray(function(err, projects) { callback(projects); })
          });
        });              
      }
    ],
    
    // Handle the final result
    function(docs, users, projects) {
      self.render('index.haml.html', {
        locals: {
          entries:docs,
          users:users,
          projects:projects,
          initialize_function:googleMapsInitializeFunction
        }
      });                            
    }
  );
})

/**
  Allows google maps gadget to render the user locations
**/
get('/users/location', function() {
  var self = this;

  // Execute 
  new simplifier.Simplifier().execute(
    // Context
    self,
    
    // Array of processes to execute before doing final handling
    [function(callback) {
      db.collection('twitterusers', function(err, collection) {
        collection.find({}, {limit:45, sort:[['followers', -1]], fields:['screen_name', 'loc', 'profile_image_url']}, function(err, cursor) {
          cursor.toArray(function(err, users) { callback(users); })        
        });
      });              
    }],
    
    // Handle the final result
    function(userlocations) {
      self.halt(200, JSON.stringify(userlocations));
    })
})

/**
  RSS feed for aggregated blogs
**/
get('/feeds/main.xml', function() {  
  var self = this;

  // Execute 
  new simplifier.Simplifier().execute(
    // Context
    self,
    
    // Array of processes to execute before doing final handling
    [
      function(callback) {
        db.collection('blogentries', function(err, collection) {
          collection.find({}, {limit:25}, function(err, cursor) {
            cursor.sort('published_on_mili', -1, function(err, cursor) {
              cursor.toArray(function(err, docs) { callback(docs); });
            });
          });
        });      
      },
    ],
    
    // Handle the final result
    function(docs) {
      self.render('rss.haml.html', {
        locals: {
          entries:docs,
          querystring:querystring
        },
        layout: false
      });                            
      self.contentType('application/xhtml+xml');
    }
  );
})

/**
  Static file providers
**/
get('/public/*', function(file){
  this.sendfile(__dirname + '/public/' + file)
})

get('/*.css', function(file){
  // this.render(file + '.css', { layout: false })
  this.sendfile(__dirname + '/public/' + file + '.css');
})

get('/*.js', function(file){
  this.sendfile(__dirname + '/public/' + file + '.js');
})

run(port, host)