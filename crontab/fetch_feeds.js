require.paths.unshift('../lib');
require.paths.unshift('../external-libs');

var test = require("mjsunit");
var sys = require("sys");
var http = require('http');
var urlParser = require('url');
var mongo = require('mongodb/mongodb');
var FeedReader = require('feedreader/feedreader').FeedReader;
var MD5 = require('mongodb/mongodb/crypto/md5');

var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : mongo.Connection.DEFAULT_PORT;

// Blogs to fetch
var blogs = ['http://four.livejournal.com/data/rss', 'http://cpojer.net/xml/blog', 'http://christiankvalheim.posterous.com/rss.xml',
  'http://blog.izs.me/rss', 'http://feeds.feedburner.com/NemikorBlog', 'http://www.stephenbelanger.com/feed/',
  'http://howtonode.org/feed.xml'];

// Github users to follow for projects
var githubUsers = ['christkv', 'ry'];

// Status variables to keep track of the state of the app
var totalParsed = 0;

new mongo.Db('node-blogs', new mongo.Server(host, port, {}), {}).open(function(db) {
  fetchGithub(db, githubUsers);
});

new mongo.Db('node-blogs', new mongo.Server(host, port, {}), {}).open(function(db) {
  fetchBlogs(db, blogs);
});

/***********************************************************************
  Fetch all the github projects related to nodejs
***********************************************************************/
function fetchGithub(db, githubUsers) {
  var done = false, done2 = false;
  
  db.collection('githubprojects', function(err, collection) {
    githubUsers.forEach(function(githubUser) {
      // fetch all repos for a user
      fetchGithubUrl("http://github.com/api/v2/json/repos/show/" + githubUser, function(body) {
        // Modify documents for storage
        var repositories = JSON.parse(body).repositories;
        repositories.forEach(function(repo) {

          new mongo.Db('node-blogs', new mongo.Server(host, port, {}), {}).open(function(db) {
            db.collection('githubprojects', function(err, collection) {
              var doneInternal = false;

              fetchGithubUrl("http://github.com/api/v2/json/repos/search/" + repo.name, function(body) {
                var repositories = JSON.parse(body).repositories;
                repositories.forEach(function(repo) {
                  if(repo.language.match(/javascript/i) != null && repo.description.match(/node/i) && repo.fork == false) {
                    sys.puts("== Fetching: " + repo.description);
                    repo['_id'] = repo.id;
                    delete repo.id;
                
                    collection.save(repo, function(err, doc) {});
                  }
                });            
                // Finish internal fetch
                doneInternal = true;
              });

              var intervalIdInternal = setInterval(function() {
                if(doneInternal) { 
                  clearInterval(intervalIdInternal);
                  db.close();
                }
              }, 100);      
            })
          });
        });
        // Finish main loop
        done = true;
      });

      // fetch all repos for a user
      fetchGithubUrl("http://github.com/api/v2/json/user/show/" + githubUser, function(body) {
        // Modify documents for storage
        var user = JSON.parse(body).user;
        user['_id'] = user.login;
        user['gravatar_url'] = 'https://secure.gravatar.com/avatar/' + user.gravatar_id;
        sys.puts(sys.inspect(user));
        db.collection('githubusers', function(err, collection) {
          collection.save(user, function(err, user) {});
        })
        // Finish main loop
        done2 = true;
      });
    });    
  });  
  
  var intervalId = setInterval(function() {
    if(done & done2) { 
      clearInterval(intervalId);
      db.close();
    }
  }, 100);      
}

function fetchGithubUrl(url, callback) {
  var url = urlParser.parse(url);  
  var client = http.createClient(80, url.host);
  var request = client.request("GET", url.pathname, {"host": url.host});

  request.addListener('response', function (response) {
    var body = '';
    response.setBodyEncoding("utf8");
    response.addListener("data", function (chunk) { body = body + chunk; });
    response.addListener("end", function() { callback(body); });
  });
  request.close();          
}

/***********************************************************************
  Fetch all the blogs
***********************************************************************/
function fetchBlogs(db, blogs) {
  db.collection('blogs', function(err, collection) {
    db.collection('blogentries', function(err, entriesCollection) {
      
      blogs.forEach(function(blogUrl) {
        var feedReader = new FeedReader(blogUrl);
        feedReader.parse(function(document) {
          // Fetch the existing blog based on url
          collection.findOne({'url':blogUrl}, function(err, doc) {
            var blog = doc != null ? doc : {'title':document.title, 'url': blogUrl, 'description':document.description};
            sys.puts("== Parsing: " + blogUrl);
  
            // Just save it (async so we don't care about waiting around)
            collection.save(blog, function(err, blogDoc) {
              document.forEachEntry(function(item) {
                var categories = [];
                var title = item.title != null ? item.title.toString().trim() : '';
                var creator = item.creator != null ? item.creator.toString().trim() : '';
                var guid = item.guid != null ? item.guid.toString().trim() : '';
                var md5 = MD5.hex_md5(guid);
                var link = item.link != null ? item.link.toString().trim() : '';
                var description = item.description != null ? item.description.toString().trim() : '';
                var content = item.encoded != null ? item.encoded.content.toString().trim() : '';
                var pubDate = item.pubDate != null ? new Date(Date.parse(item.pubDate.toString().trim())) : new Date();
                if(item.category != null) {
                  categories = (Array.isArray(item.category) ? item.category.map(function(cat) { return cat.toString(); }).join(",") : [item.category.toString])
                }        
  
                // Only insert a doc if it has a minimum set of fields
                if(title.length > 0 && guid.length > 0 && description.length > 0 && item.pubDate != null) {
                  if(description.match(/nodejs/i) != null || description.match(/javascript/i) != null) {
                    link = link.length == 0 ? guid : link;
                    // Build a simple object from the data
                    var doc = {'_id': md5, 'title':title, 'guid':guid, 'link':link, 'creator':creator, 
                                'categories': categories, 'description':description, 'content':content, 'published_on':pubDate, 'published_on_mili':pubDate.getTime(),
                                'blog': new mongo.DBRef('blogs', blogDoc._id, db.databaseName)};
                    // Insert document if it does not exist
                    entriesCollection.update({'_id':md5}, doc, {'upsert':true}, function(err, doc) {
                      sys.puts("  = inserted doc: " + guid);
                      sys.puts("    = title: " + title);
                    });                  
                  }
                }
              });                
            });
  
            // Build final document
            totalParsed = totalParsed + 1;
          });
          
        });    
      });      
      
      // Build an index
      db.createIndex('blogentries', 'published_on', function(err, indexName) {});                
      db.createIndex('blogentries', 'published_on_mili', function(err, indexName) {});                      
    });    
  });  
  
  var intervalId = setInterval(function() {
    if(totalParsed == blogs.length) { 
      clearInterval(intervalId);
      db.close();
    }
  }, 100);      
}