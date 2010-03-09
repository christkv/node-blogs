require.paths.unshift('lib');
require.paths.unshift('external-libs');
require.paths.unshift('external-libs/express');
require('express');
require('express/plugins');

var mongo = require('mongodb/mongodb');
var sys = require('sys');

// Set up a Db and open connection to the mongodb
var db = new mongo.Db('node-blogs', new mongo.Server("127.0.0.1", 27017, {auto_reconnect: true}, {}));
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
  
  // Fetch the blog entries
  db.collection('blogentries', function(err, collection) {    
    collection.find({}, {limit:10}, function(err, cursor) {
      cursor.sort('published_on_mili', -1, function(err, cursor) {
        cursor.toArray(function(err, docs) {
          // Fetch the git users
          db.collection('githubusers', function(err, githubusercollection) {
            githubusercollection.find({}, {limit:30}, function(err, githubusercursor) {
              githubusercursor.toArray(function(err, githubusers) {
                self.render('index.haml.html', {
                  locals: {
                    entries:docs,
                    users:githubusers
                  }
                });                        
              })
            });
          });
        });        
      })
    });
  });
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

run()