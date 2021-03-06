require.paths.unshift('../lib');
require.paths.unshift('../external-libs');
require.paths.unshift('../external-libs/node-httpclient/lib');

var kiwi = require('kiwi'),
  sys = require('sys'),
  querystring = require('querystring'),
  fs = require('fs'),
  urlParser = require('url'),
  http = require('http'),
  httpclient = require('httpclient');  

// Initialize the seeds  
kiwi.seed('mongodb-native');  
kiwi.seed('simplify');  

// Fetch the library records
var mongo = require('mongodb'), 
    simplifier = require('simplifier');

// Fetch other needed classes
var FeedReader = require('feedreader/feedreader').FeedReader;
var MD5 = mongo.MD5;

var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : mongo.Connection.DEFAULT_PORT;

// Read the content file containing all the aggregation users and their content
fs.readFile("../conf/content.json", function(err, data) {  
  var users = JSON.parse(data.toString());
  var github_user = process.argv[2];
  var service = process.argv[3];

  // List of users to execute
  var execute_users = users.filter(function(user) {
    return user.github == github_user ? true : false;
  });

  if(execute_users.length == 1) {
    if(service == 'blog') {
      // Fetch all the blog content
      new mongo.Db('nodeblogs', new mongo.Server(host, port, {}), {}).open(function(err, db) {
        fetchBlogs(db, execute_users);
      });      
    } else if(service == 'github') {
      // Fetch all the github content
      new mongo.Db('nodeblogs', new mongo.Server(host, port, {}), {}).open(function(err, db) {
        fetchGithub(db, execute_users);
      });      
    } else if(service == 'twitter') {
      // Fetch all the twitter info for a user
      new mongo.Db('nodeblogs', new mongo.Server(host, port, {}), {}).open(function(err, db) {
        fetchTwitter(db, execute_users);
      });          
    }
  }
});

/***********************************************************************
  Fetch twitter related info including location if available
***********************************************************************/
function fetchTwitter(db, users) {
  // Status variables to keep track of the state of the app
  var totalParsed = 0;

  db.collection('twitterusers', function(err, collection) {
    users.forEach(function(user) {
      var client = new httpclient.httpclient();

      client.perform("http://api.twitter.com/1/users/show.json?screen_name=" + querystring.escape(user.twitter), 'GET', function(result) {
        var body = result.response.body;
        if(body) {
          var twitterUser = JSON.parse(body);
          twitterUser['_id'] = twitterUser.screen_name;

          // Now geocode the location if possible using google
          var client = new httpclient.httpclient();
          client.perform('http://maps.google.com/maps/geo?output=json&q=' + querystring.escape(twitterUser.location), 'GET', function(result) {
            var body = result.response.body;
            var geoObject = JSON.parse(body);
            if(geoObject.Status.code == 200) {
              twitterUser['loc'] = {lat:geoObject.Placemark[0].Point.coordinates[0], long:geoObject.Placemark[0].Point.coordinates[1], addr:geoObject.Placemark[0].address};
            }
            // Save or update the twitter user
            collection.save(twitterUser, function(err, twitterUser) {
              totalParsed = totalParsed + 1;
            });
          });          
        }
      });
    });
  });
  
  var intervalId = setInterval(function() {
    if(totalParsed == users.length) { 
      clearInterval(intervalId);
      db.close();
    }
  }, 100);        
}

/***********************************************************************
  Fetch all the github projects related to nodejs
***********************************************************************/
function fetchGithub(db, users) {
  // var done = false, done2 = false;
  var total_number_of_repos = -1;
  var current_processed_number_of_repos = 0;
  var done = false;
  
  // Fetch the current status of the fetch (to get around the issue of 60 calls pr minute on github :( )
  db.collection('githubconf', function(err, collection) {
    collection.findOne(function(err, conf) {
      // Ensure the conf points at the start of the list
      if(conf == null) conf = {'position':0};
      // fetch the user based on the position
      if(users.length > conf.position) {
        var user = users[conf.position];
        sys.puts("============= fetching github info for: " + user.github);
        // Process the user
        var client = new httpclient.httpclient();
        client.perform("http://github.com/api/v2/json/repos/show/" + querystring.escape(user.github), 'GET', function(result) {
          var body = result.response.body;
          // Modify documents for storage
          var repositoriesObject = JSON.parse(body);
          if(repositoriesObject != null && repositoriesObject.repositories != null) {
            var repositories = repositoriesObject.repositories;
            total_number_of_repos = repositories.length;

            repositories.forEach(function(repo) {
              db.collection('githubprojects', function(err, collection) {
                var client = new httpclient.httpclient();
                client.perform("http://github.com/api/v2/json/repos/show/" + querystring.escape(user.github) + "/" + querystring.escape(repo.name), 'GET', function(result) {
                  var body = result.response.body;
                  try {
                    var repoObject = JSON.parse(body)
                    // Ensure we have a valid json object
                    if(repoObject != null && repoObject.repository != null) {
                      var repository = repoObject.repository;
                      if(((repository.description != null && repository.description.match(/node/i)) || repository.name.match(/node/i)) && repository.fork == false) {
                        sys.puts("== Fetching: [" + repository.name + "] " + repository.description);
                        repository['_id'] = repository.owner + repository.name;
                        repository['description'] = repository.description == null ? 'No description on github' : repository.description;
                        repository['url'] = "http://www.github.com/" + repository.username + "/" + repository.name;
                        delete repository.id;
                        
                        collection.save(repository, function(err, doc) {
                          current_processed_number_of_repos = current_processed_number_of_repos + 1;
                        });
                      } else {
                        total_number_of_repos = total_number_of_repos - 1;
                      }
                    }                  
                  } catch (err) {}
                })
              });
            });            
          }
          // Finish main loop
          done = true;
        });

        // fetch all repos for a user
        var client = new httpclient.httpclient();
        client.perform("http://github.com/api/v2/json/user/show/" + querystring.escape(user.github), 'GET', function(result) {
          var body = result.response.body;
          // Modify documents for storage
          var userObject = JSON.parse(body);
          if(userObject != null && userObject.user != null) {
            var user = userObject.user;
            user['_id'] = user.login;
            user['gravatar_url'] = 'https://secure.gravatar.com/avatar/' + user.gravatar_id;
            db.collection('githubusers', function(err, collection) {
              collection.save(user, function(err, user) {});
              // Finish main loop
              done2 = true;              
            })            
          }
        });        
        
        var intervalId = setInterval(function() {
          if(done & (current_processed_number_of_repos == total_number_of_repos)) { 
            clearInterval(intervalId);
            // Update the conf
            conf.position = conf.position + 1 >= users.length ? conf.position = 0 : conf.position + 1;
            collection.save(conf, function(err, doc) { db.close(); });            
          }
        }, 100);              
      }      
    });    
  });
}

function fetchGetUrl(url, callback) {
  var url = urlParser.parse(url);  
  var client = http.createClient(80, url.host);
  client.setTimeout(1000 * 360);
  client.addListener("timeout", function() {
    sys.puts("================================= received timeout event");
    client.destroy();
    callback();
  });
  
  var path = url.pathname + (url.search == null ? '' : url.search);
  var request = client.request("GET", path, {"host": url.host});
  
  request.addListener('response', function (response) {
    var body = '';
    response.setEncoding("utf8");
    response.addListener("data", function (chunk) { body = body + chunk; });
    response.addListener("end", function() { callback(body); });
  });
  request.end();          
}

/***********************************************************************
  Fetch all the blogs
***********************************************************************/
function fetchBlogs(db, users) {
  // Status variables to keep track of the state of the app
  var totalParsed = 0;
  var totalToParse = -1;

  db.collection('blogs', function(err, collection) {
    db.collection('blogentries', function(err, entriesCollection) {
      
      users.forEach(function(user) {
        var feedReader = new FeedReader(user.feed);
        feedReader.parse(function(document) {
          totalToParse = document.length();
          
          // Fetch the existing blog based on url
          collection.findOne({'url':user.feed}, function(err, doc) {
            var blog = doc != null ? doc : {'title':document.title(), 'url': user.feed, 'description':document.description()};
            sys.puts("== Parsing: " + user.feed);
  
            // Just save it (async so we don't care about waiting around)
            collection.save(blog, function(err, blogDoc) {
              
              document.forEachEntry(function(item) {
                var categories = [], title, creator, guid, md5, link, description, content, pubDate, content, description;
                
                // sys.puts("------------------------------------------------------------------------------------")
                // sys.puts(sys.inspect(item))
                
                if(document.atom) {
                  title = item.title != null ? item.title.toString().trim() : '';
                  creator = item.author != null ? item.author.name.toString().trim() : '';
                  guid = item.id != null ? item.id.toString().trim() : '';
                  md5 = MD5.hex_md5(guid);
                  // link = item.link != null ? item.link.toString().trim() : '';
                  description = item.content != null ? item.content.toString().trim() : '';
                  content = '';
                  pubDate = item.updated != null ? new Date(Date.parse(item.updated.toString().trim())) : new Date();
                                    
                  var links = item.link.filter(function(link) {
                    return link.attrs().rel == "self" ? true : false
                  })
                  
                  if(links.length == 1) {
                    link = links[0].attr('href').toString();
                  } else {
                    link = ''
                  }
                } else {
                  title = item.title != null ? item.title.toString().trim() : '';
                  creator = item.creator != null ? item.creator.toString().trim() : '';
                  creator = creator == '' ? item.author != null ? item.author.toString().trim() : '' : creator;
                  guid = item.guid != null ? item.guid.toString().trim() : '';
                  md5 = MD5.hex_md5(guid);
                  link = item.link != null ? item.link.toString().trim() : '';
                  description = item.description != null ? item.description.toString().trim() : '';
                  content = item.encoded != null ? item.encoded.content.toString().trim() : '';
                  pubDate = item.pubDate != null ? new Date(Date.parse(item.pubDate.toString().trim())) : new Date();
                  if(item.category != null) {
                    categories = (Array.isArray(item.category) ? item.category.map(function(cat) { return cat.toString(); }) : [item.category.toString])
                  }        
                }
                // Join categories
                categories = categories.join(",");                    
                // Only insert a doc if it has a minimum set of fields
                if(title.length > 0 && guid.length > 0 && description.length > 0 && (item.pubDate != null || item.updated != null)) {                  
                  if(description.match(/nodejs/i) != null || description.match(/javascript/i) != null || (categories != null && categories.match(/nodejs/) != null)) {
                    link = link.length == 0 ? guid : link;
                    var url = urlParser.parse(link);                      
                    var channel = url.protocol + "//" + url.host;                    
                    var ref = new mongo.DBRef('blogs', blogDoc._id, db.databaseName);
                    
                    // Build a simple object from the data
                    var doc = {'_id': md5, 'title':title, 'guid':guid, 'link':link, 'creator':creator, 'channel':channel,
                                'categories': categories, 'description':description, 'content':content, 'published_on':pubDate, 'published_on_mili':pubDate.getTime(),
                                'blog': ref};
                    
                    // Insert document if it does not exist
                    entriesCollection.update({'_id':md5}, doc, {'upsert':true}, function(err, doc) {
                      sys.puts("  = inserted doc: " + guid);
                      sys.puts("    = title: " + title);

                      // Build final document
                      totalParsed = totalParsed + 1;
                    });                  
                  } else {
                    totalToParse = totalToParse - 1;
                  }
                }
              });                
            });
  
          });          
        });    
      });      
      
      // Build an index
      db.createIndex('blogentries', 'published_on', function(err, indexName) {});                
      db.createIndex('blogentries', 'published_on_mili', function(err, indexName) {});                      
    });    
  });  
  
  var intervalId = setInterval(function() {
    if(totalParsed == totalToParse) { 
      clearInterval(intervalId);
      db.close();
    }
  }, 100);      
}
