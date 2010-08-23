require.paths.unshift('lib');
require.paths.unshift('external-libs');

var express = require('express'),
  querystring = require('querystring'),
  sys = require('sys'),
  simplifier = require('simplifier');

// Get classes for Mongodb  
var Db = require('mongodb').Db,
  Server = require('mongodb').Server;

// Set up the host for the server
var host = process.env['NODEBLOGS_HOST'] != null ? process.env['NODEBLOGS_HOST'] : 'localhost';
var port = process.env['NODEBLOGS_PORT'] != null ? process.env['NODEBLOGS_PORT'] : 3000;

// Path to our public directory
var pub = __dirname + '/public';

// Auto-compile sass to css with "compiler"
// and then serve with connect's staticProvider
var app = express.createServer(
    express.compiler({ src: pub, enable: ['sass'] }),
    express.staticProvider(pub)
);

// Optional since express defaults to CWD/views
app.set('views', __dirname + '/views');

// Set our default template engine to "jade"
// which prevents the need for extensions (although you can still mix and match)
app.set('view engine', 'jade');

// / Page showing the nodeblogs page
app.get('/', function(req, res, next) {
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
    new simplifier.ParallelFlow(
      // Functions to execute
      function(callback) {
        db.collection('blogentries', function(err, collection) {
          collection.find({}, {limit:10}, function(err, cursor) {
            cursor.sort('published_on_mili', -1, function(err, cursor) {
              cursor.toArray(function(err, docs) { callback(err, docs); });
            });
          });
        });      
      },

      function(callback) {
        db.collection('githubusers', function(err, collection) {
          collection.find({}, {limit:30}, function(err, cursor) {
            cursor.toArray(function(err, users) { callback(err, users); })
          });
        });      
      },
    
      function(callback) {
        db.collection('githubprojects', function(err, collection) {
          collection.find({}, {limit:45, sort:[['watchers', -1]]}, function(err, cursor) {
            cursor.toArray(function(err, projects) { callback(err, projects); })
          });
        });              
      }
    ),
        
    // Handle the final result
    function(docsResult, usersResult, projectsResult) {
      res.render('index', {
        locals: {
          entries:docsResult[1],
          users:usersResult[1],
          projects:projectsResult[1],
          initialize_function:googleMapsInitializeFunction
        }
      });                            
    }
  );
})

/**
  Allows google maps gadget to render the user locations
**/
app.get('/users/location', function(req, res, next) {
  // Execute 
  new simplifier.Simplifier().execute(
    function(callback) {
      db.collection('twitterusers', function(err, collection) {
        collection.find({}, {limit:45, sort:[['followers', -1]], fields:['screen_name', 'loc', 'profile_image_url']}, function(err, cursor) {
          cursor.toArray(function(err, users) { callback(err, users); });
        });
      });              
    },
    
    // Handle the final result
    function(err, userlocations) {
      res.send(JSON.stringify(userlocations));
    })
})

/**
  RSS feed for aggregated blogs
**/
app.get('/feeds/main.xml', function(req, res, next) {
  // Execute 
  new simplifier.Simplifier().execute(
    function(callback) {
      db.collection('blogentries', function(err, collection) {
        collection.find({}, {limit:25}, function(err, cursor) {
          cursor.sort('published_on_mili', -1, function(err, cursor) {
            cursor.toArray(function(err, docs) { callback(err, docs); });
          });
        });
      });      
    },
    
    // Handle the final result
    function(err, docs) {
      res.render('rss', {
        locals: {
          entries:docs,
          querystring:querystring
        },
        layout: false
      });   
                               
      res.contentType('application/xhtml+xml');
    }
  );
})

var db = new Db('nodeblogs', new Server("127.0.0.1", 27017, {auto_reconnect: true}, {}));
db.open(function(err, db) {
  // Start listening
  app.listen(port, host);  
});