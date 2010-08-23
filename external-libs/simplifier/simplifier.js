var sys = require('sys');

/**
  Simplifier code
**/
var Simplifier = exports.Simplifier = function(context) {
  this.context = context;
}

Simplifier.prototype.execute = function() {
  this.functions = Array.prototype.slice.call(arguments, 0);
  this.results = [];
  this.finalFunction = this.functions.pop();
  this.totalNumberOfCallbacks = 0
  var self = this.context != null ? this.context : this;
  // If we have more than one function execute them serially
  if(this.functions.length > 1) {
    f = new SerialFlow(this.functions);
  } else {
    f = this.functions[0] instanceof SerialFlow || this.functions[0] instanceof ParallelFlow ? this.functions[0] : new SerialFlow(this.functions);
  }
  // Execute the flow
  f.execute(function(results) {
    self.finalFunction.apply(self, results);
  })      
}

/**
  Specify a set of functions to be executed in series
**/
var SerialFlow = exports.SerialFlow = function(functions) {
  this.functions = Array.isArray(functions) ? functions : Array.prototype.slice.call(arguments, 0);
}

SerialFlow.prototype.execute = function(callback, index) {  
  this.serialExecute([], this.functions.splice(0, 1)[0], callback, index);
}

SerialFlow.prototype.serialExecute = function(values, f, callback, index) {
  var self = this;
  
  // If this is a parallel flow
  if(f instanceof ParallelFlow) {
    f.execute(function() {
      if(self.functions.length > 0) {
        var nextFunction = self.functions.splice(0, 1)[0];
        var results = Array.prototype.slice.call(arguments)[0];
        self.serialExecute(results, nextFunction, callback, index);           
      } else {
        var results = Array.prototype.slice.call(arguments);
        if(index != null) results.push(index);
        callback(results);        
      }
    });
  } else {
    // Add a callback to handle the results
    values.push(function() {
      if(self.functions.length > 0) {
        var nextFunction = self.functions.splice(0, 1)[0];
        var results = Array.prototype.slice.call(arguments);        
        // If an error has occured terminate call stack and return
        results[0] != null ? callback(results) : self.serialExecute(results, nextFunction, callback, index);                     
      } else {
        var results = Array.prototype.slice.call(arguments);
        if(index != null) results.push(index);
        callback(results);
      }
    });
    // Execute the code
    try {
      f.apply(self, values);          
    } catch (err) { callback([err]); }
  }  
}

/**
  Specify a set of functions to be executed in parallel
**/
var ParallelFlow = exports.ParallelFlow = function(functions) {
  this.functions = Array.isArray(functions) ? functions : Array.prototype.slice.call(arguments, 0);
  this.numberOfCallsPerformed = 0;
  this.results = [];
}

ParallelFlow.prototype.execute = function(callback) {
  var self = this;
    
  for(var i = 0; i < this.functions.length; i++) {
    if(this.functions[i] instanceof SerialFlow) {
      this.functions[i].execute(function() {
        // Pop the index off the return call and save results in the array
        var results = Array.prototype.slice.call(arguments)[0];
        var index = results.pop();
        self.results[index] = results;

        // Update the number of executed functions and return if we are done
        self.numberOfCallsPerformed = self.numberOfCallsPerformed + 1;        
        if(self.numberOfCallsPerformed >= self.functions.length) {
          callback(self.results);
        }
      }, i)
    } else {
      try {
        // Create a wapper function to contain the call and index reference
        var wrapperFunction = function(index) {
          self.functions[index](function() {
            self.results[index] = Array.prototype.slice.call(arguments);
            self.numberOfCallsPerformed = self.numberOfCallsPerformed + 1;
            if(self.numberOfCallsPerformed >= self.functions.length) {
              callback(self.results);
            }
          });                        
        };
        
        // Call the wrapper function with the index
        wrapperFunction(i);
      } catch (err) { 
        self.numberOfCallsPerformed = self.numberOfCallsPerformed + 1;
        self.results[i] = [err];
        if(self.numberOfCallsPerformed >= self.functions.length) {
          callback(self.results);
        }
      }
    }
  }
}


