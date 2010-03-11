require.paths.unshift('lib');
require.paths.unshift('external-libs');
require.paths.unshift('external-libs/express');
require('express');
require('express/plugins');

var mongo = require('mongodb/mongodb');
var sys = require('sys');
var simplifier = require('simplifier/simplifier');

// Set up a Db and open connection to the mongodb
var db = new mongo.Db('nodeblogs', new mongo.Server("127.0.0.1", 27017, {auto_reconnect: true}, {}));
db.open(function(db) {});

configure(function(){
  use(MethodOverride);
  use(ContentLength);
  use(CommonLogger);  
  use(Cookie);
  use(Session);
  use(Flash);
  set('root', __dirname);
});

get('/hello', function() {
  this.halt(200, "Hello word");
})

/**
  Main file
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
          // Add double click event handling
          // google.maps.event.addListener(marker, 'dblclick', function() {
          //   alert('double click');
          // });          
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
          collection.find({}, {limit:45, sort:[['followers', -1]]}, function(err, cursor) {
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
});

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
});

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

run()