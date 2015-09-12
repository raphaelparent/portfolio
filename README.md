# What is this

This is a boilerplate for Nodejs v4.0.0 projects.

## What does this include?

This boilerplate is shipped with a couple thing.

 - Gulp.
 - Mysql.
 - JSHint.
 - Browserify.
 - SASS with the Sass syntax
 - 
 
#### Gulp tasks

`scripts`, `browserify` and `uglify` to handle all the js stuff.

`styles` to handle all the sass and css stuff.

`default` that runs all the tasks then watches for changes.

## How to start using it.

Start by installing all the required modules.

    npm install

If you have a databases, you will want to set things in the config file and uncomment the connection to the database in app.js.

## Couple things to be aware of.

#### Gulp
Every time you add a .js file, make sure to add it in the gulpfile under the scripts task.

#### Routing
You can have multiple files with all your routes, just import them in the index.js file in the route folder like this.

    require('./FILE')(app);

And doing something like this in the file you import.

    module.exports = function(app)
    {
      app.get('/ROUTES', function(req,res){
        // Stuff...
      })

      // More routes...
    };

