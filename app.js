require.paths.unshift('lib');
require.paths.unshift('external-libs');
require.paths.unshift('external-libs/express');
require('express');
require('express/plugins');

// awesome_app = require('oauth/oauth_services');
// process.mixin(awesome_app, require('mongodb/db'));
// process.mixin(awesome_app, require('mongodb/connection'));

// Set up a Db and open connection to the mongodb
// var db = new awesome_app.Db('awesome', new awesome_app.Server("127.0.0.1", 27017, {auto_reconnect: true}, {}));
// db.open(function(db) {});
// Set up the OAuth provider and data source
// var oauthService = new awesome_app.OAuthServices(new awesome_app.OAuthDataProvider(db));

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
  Static file providers
**/
get('/public/*', function(file){
  this.sendfile(__dirname + '/public/' + file)
})

get('/*.css', function(file){
  this.render(file + '.sass.css', { layout: false })
})

run()