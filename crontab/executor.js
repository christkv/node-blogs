require.paths.unshift('../lib');
require.paths.unshift('../external-libs');

sys = require('sys');

// Run a timer and execute the scripts
var intervalId = setInterval(function() {
  sys.puts("================================== executing process");
  var ls = process.createChildProcess('node', ['fetch_feeds.js']);
  ls.addListener("output", function (data) {
    sys.puts(data);
  });
}, 1000*60);        
