require.paths.unshift('../lib');
require.paths.unshift('../external-libs');

var kiwi = require('kiwi'),
  sys = require('sys'),
  querystring = require('querystring'),
  fs = require('fs'),
  urlParser = require('url'),
  http = require('http'),
  sys = require('sys');

var current_location = 0;
// var executor_time = 1000*60*30;
var executor_time = 1000 * 30;
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
      var users = JSON.parse(data);
      // Fetch a user
      var user = users[current_location];
      // Update the location
      current_location = current_location < users.length ? current_location + 1 : 0;
      if(user) {
        sys.puts("================================== executing process");
        fetch_feed_process = require('child_process').spawn('node', ['fetch_feeds.js', user.github]);
        // Set executing
        executing = true;
        // Read all the data
        fetch_feed_process.addListener('data', function(data) {
          sys.puts(data);
        })
        // Process finished
        fetch_feed_process.addListener('exit', function(code) {
          sys.puts("Process exited with code: " + code);
          // Allow us to execute the next fetch process
          executing = false;
        })        
      }    
    });    
  }
  
  // Set up time out for the process killing it if it takes to long
  var interval_execution_id = setInterval(function() {
    if(executing && fetch_feed_process) {
      // Kill the process
      fetch_feed_process.kill('SIGHUP');
      // Reset for the next call to happen
      executing = false;
    }
  }, executing_timeout);  
}, executor_time);        
