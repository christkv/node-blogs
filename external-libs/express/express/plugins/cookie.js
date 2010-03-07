
// Express - Cookie - Copyright TJ Holowaychuk <tj@vision-media.ca> (MIT Licensed)

/**
 * Parse an HTTP _cookie_ string into a hash.
 *
 * @param  {string} cookie
 * @return {hash}
 * @api public
 */

exports.parseCookie = function(cookie) {
  return $(cookie.replace(/^ *| *$/g, '').split(/ *; */)).reduce({}, function(hash, pair){
    var parts = pair.split(/ *= */)
    hash[parts[0]] = parts[1]
    return hash
  })
}

/**
 * Compile cookie _name_, _val_ and _options_ to a string.
 *
 * @param  {string} name
 * @param  {string} val
 * @param  {hash} options
 * @return {string}
 * @api public
 */

exports.compileCookie = function(name, val, options) {
  if (!options) return name + '=' + val
  return name + '=' + val + '; ' + $(options).map(function(val, key){
    if (val instanceof Date)
      val = val.toString()
        .replace(/^(\w+)/, '$1,')
        .replace(/(\w+) (\d+) (\d+)/, '$2-$1-$3')
        .replace(/GMT.*$/, 'GMT')
    return val === true ? key : key + '=' + val
  }).toArray().join('; ')
}

// --- Cookie

exports.Cookie = Plugin.extend({
  extend: {
    
    /**
     * Initialize extensions.
     */
    
    init: function() {
      Request.include({

        /**
         * Get or set cookie values.
         *
         * Options:
         *
         *  - path       Cookie path, defaults to '/'
         *  - domain     Tail matched domain name such as 'vision-media.ca' or 'blog.vision-media.ca' etc
         *  - expires    Date object converted to 'Wdy, DD-Mon-YYYY HH:MM:SS GMT'
         *               when undefined the cookie will last the duration of a the
         *               client's session.
         *  - secure     When true the cookie will be sent by the client only when transfering data via HTTPS
         *  - httpOnly   When true the cookie will be sent to the server only and will not be accessable via
         *               client-side scripting.
         *
         * @param  {string} name
         * @param  {string} val
         * @param  {hash} options
         * @return {string}
         * @api public
         */

        cookie: function(name, val, options) {
          options = options || {}
          options.path = options.path || '/'
          return val ?
            this.response.cookies.push(exports.compileCookie(name, val, options)) :
              this.cookies[name]
        }  
      })
    }
  },
  
  // --- Events
  
  on: {
    
    /**
     * Parse request cookie data.
     */
    
    request: function(event) {
      event.request.response.cookies = []
      event.request.cookies = event.request.headers.cookie ? 
        exports.parseCookie(event.request.headers.cookie) : 
          {}
    },
    
    /**
     * Set the Set-Cookie header when response cookies are available.
     */
    
    response: function(event) {
      if (event.response.cookies.length)
        event.request.header('set-cookie', event.response.cookies.join(', '))
    }
  }
})