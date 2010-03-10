var sys = require('sys');

var Simplifier = exports.Simplifier = function() {}

Simplifier.prototype.execute = function(context, functions, finalFunction) {
  this.functions = functions;
  this.results = {};
  this.finalFunction = finalFunction;
  this.totalNumberOfCallbacks = 0
  this.context = context;
  var self = this;
  
  functions.forEach(function(f) {
    f(function() {
      self.totalNumberOfCallbacks = self.totalNumberOfCallbacks + 1;
      self.results[f] = Array.prototype.slice.call(arguments, 0);     
      if(self.totalNumberOfCallbacks >= self.functions.length) {
        // Order the results by the calling order of the functions
        var finalResults = [];
        self.functions.forEach(function(f) {
          finalResults.push(self.results[f][0]);
        })
        // Call the final function passing back all the collected results in the right order 
        finalFunction.apply(self.context, finalResults);
      }
    });
  });
}