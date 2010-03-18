require.paths.unshift('../lib');
require.paths.unshift('../external-libs');

var kiwi = require('kiwi'),
  express = kiwi.require('express'),
  sys = require('sys'),
  simplifier = require('simplifier/simplifier'),
  querystring = require('querystring'),
  fs = require('fs'),
  urlParser = require('url'),
  http = require('http'),
  TwitterNode = require('twitter-node').TwitterNode;

// Initialize the seeds  
kiwi.seed('mongodb-native');  
// Fetch the library records
var mongo = require('mongodb');
// Fetch other needed classes
var FeedReader = require('feedreader/feedreader').FeedReader;
var MD5 = require('mongodb/crypto/md5');

// Mongo db connection setup
var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : mongo.Connection.DEFAULT_PORT;

// Twitter user setup
var twitterUser = process.env['NODEBLOGS_TWITTER_USER'] != null ? process.env['NODEBLOGS_TWITTER_USER'] : 'nodeblogs';
var twitterPassword = process.env['NODEBLOGS_TWITTER_PASSWORD'] != null ? process.env['NODEBLOGS_TWITTER_PASSWORD'] : null;

if(twitterPassword) {
  // Fetch all the blog content
  new mongo.Db('nodeblogs', new mongo.Server(host, port, {auto_reconnect: true}), {}).open(function(db) {
    runTwitterNodeAggregatorListener(db, twitterUser, twitterPassword);
  });  
} else {
  sys.puts("=================================== Please set up env parameters NODEBLOGS_TWITTER_USER and NODEBLOGS_TWITTER_PASSWORD");
}

// Hook up to twitter and listen for trafic based on nodejs hashtag
function runTwitterNodeAggregatorListener(db, twitterUser, twitterPassword) {
  // Fetch the relevant collection
  db.collection('twitternodetagmessages', function(err, collection) {
    // Set up context for twitter
    var twit = new TwitterNode({
      user: twitterUser,
      password: twitterPassword,
      track: ['#nodejs']           // Nodejs hash tag    
    })

    // Filter action is default so add the listeners
    twit.addListener('tweet', function(tweet) {
      // Use the tweet id as mongodb id
      tweet['_id'] = tweet.id
      // Save the tweet to mongo
      collection.save(tweet, function(err, doc) {
        sys.puts("@" + tweet.user.screen_name + ": " + tweet.text);        
      })
    }).addListener('limit', function(limit) {
      sys.puts("LIMIT: " + sys.inspect(limit));
    }).addListener('delete', function(del) {
      sys.puts("DELETE: " + sys.inspect(del));
    }).addListener('close', function(resp) {
      sys.puts("wave goodbye... " + resp.statusCode);
    }).stream();    
  })  
}