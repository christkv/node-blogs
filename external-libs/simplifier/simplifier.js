var sys = require('sys');

var Simplifier = exports.Simplifier = function(context) {
  this.context = context;
}

Simplifier.prototype.execute = function() {
  this.functions = Array.prototype.slice.call(arguments, 0);
  this.results = {};
  this.finalFunction = this.functions.pop();
  this.totalNumberOfCallbacks = 0
  var self = this.context != null ? this.context : this;
  
  this.functions.forEach(function(f) {
    f(function() {
      self.totalNumberOfCallbacks = self.totalNumberOfCallbacks + 1;
      self.results[f] = Array.prototype.slice.call(arguments, 0);     
      if(self.totalNumberOfCallbacks >= self.functions.length) {
        // Order the results by the calling order of the functions
        var finalResults = [];
        self.functions.forEach(function(f) {
          finalResults.push(self.results[f]);
        })
        // Call the final function passing back all the collected results in the right order 
        self.finalFunction.apply(self, finalResults);
      }
    });
  });
}