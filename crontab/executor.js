require.paths.unshift('../lib');
require.paths.unshift('../external-libs');

var kiwi = require('kiwi'),
  sys = require('sys'),
  querystring = require('querystring'),
  fs = require('fs'),
  urlParser = require('url'),
  http = require('http'),
  exec  = require('child_process').exec,
  sys = require('sys');
  
var current_location = 0;
// var executor_time = 1000*60*30;
var executor_time = 1000 * 180;
// Control execution
var executing = false;
var executing_timeout = 1000 * 60;
// Running process
var fetch_feed_process = null;

// Run a timer and execute the scripts
var intervalId = setInterval(function() {
  // If not already executing
  if(!executing) {
    // Read the content file containing all the aggregation users and their content
    fs.readFile("../conf/content.json", function(err, data) {
      // Parse the config of users
      var users = JSON.parse(data.toString());
      // Fetch a user
      var user = users[current_location];
      // Update the location
      current_location = current_location < users.length ? current_location + 1 : 0;
      if(user) {
        fetch__twitter_feed_process = exec('node fetch_feeds.js ' + user.github + ' twitter', { encoding: 'utf8', timeout: executing_timeout, killSignal: 'SIGKILL'},          
          function (error, stdout, stderr) {
            sys.puts(stdout);
            sys.puts(stderr);
            if (error !== null) {
              sys.puts(error);
            }
          });        

        fetch__twitter_feed_process = exec('node fetch_feeds.js ' + user.github + ' github', { encoding: 'utf8', timeout: executing_timeout, killSignal: 'SIGKILL'},          
          function (error, stdout, stderr) {
            sys.puts(stdout);
            sys.puts(stderr);
            if (error !== null) {
              sys.puts(error);
            }
          });        

        fetch__twitter_feed_process = exec('node fetch_feeds.js ' + user.github + ' blog', { encoding: 'utf8', timeout: executing_timeout, killSignal: 'SIGKILL'},          
          function (error, stdout, stderr) {
            sys.puts(stdout);
            sys.puts(stderr);
            if (error !== null) {
              sys.puts(error);
            }
          });        
      }    
    });    
  }
}, executor_time);        
