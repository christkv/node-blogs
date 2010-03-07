
// Express - View - Copyright TJ Holowaychuk <tj@vision-media.ca> (MIT Licensed)

/**
 * Module dependencies.
 */

var utils = require('express/utils'),
    fs = require('fs')

/**
 * Supported template engines.
 */

var engine = {
  ejs: require('ejs'),
  haml: require('haml'),
  sass: require('sass')
}

// --- View

exports.View = Plugin.extend({
  extend: {
    
    /**
     * Initialize extensions.
     */
    
    init: function() {
      
      // Settings
      
      set('views', function(){ return set('root') + '/views' })
      
      // Request
      
      Request.include({

        /**
         * Render _view_ with _options_.
         *
         * Views are looked up relative to the'views' path setting. 
         * View filenames should conform to ANY.ENGINE.TYPE so for example
         * 'layout.ejs.html', 'ejs' represents the template engine, 'html'
         * represents the type of content being rendered, which is then passed
         * to contentType().
         *
         * Engines must export a render() method accepting the template string
         * and a hash of options.
         *
         * Options:
         *
         *  - layout:   The layout to use, none when falsey. Defaults to 'layout'
         *  - locals:   Most engines support a hash of local variable names / values.
         *  - context:  Most engines support an evaluation context (the 'this' keyword). 
         *              Defaults to the current Request instance.
         *
         * @param  {string} view
         * @param  {hash} options
         * @settings 'views', 'cache view contents'
         * @api public
         */

        render: function(view, options) {
          var self = this,
              options = options || {},
              path = set('views') + '/' + view,
              type = path.split('.').slice(-2)[0],
              ext = utils.extname(path),
              layout = options.layout === undefined ? 'layout' : options.layout
          options.context = options.context || this
          self.contentType(ext)
          function render(content) {
            content = engine[type].render(content, options)
            if (layout)
              self.render(layout + '.' + type + '.' + ext, process.mixin(true, options, {
                layout: false,
                locals: {
                  body: content
                }
              }))
            else
              self.halt(200, content)
          }
          if (set('cache view contents') && self.cache.get(path))
            render(self.cache.get(path))
          else
            fs.readFile(path, function(e, content){
              if (e) throw e
              set('cache view contents') ?
                render(self.cache.set(path, content)) :
                  render(content)
            })
        }
      })
    }
  }
})

