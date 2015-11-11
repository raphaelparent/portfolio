
// -----------------------------------------------------------------
// Modules declaration
// -----------------------------------------------------------------
var express 	 = require('express'),
    path 		 = require('path'),
    favicon 	 = require('serve-favicon'),
    conf 	 	 = require('nconf'),
    logger 		 = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser   = require('body-parser'),
    http 		 = require('http'),
    jade		 = require('jade'),
    mysql		 = require('mysql');


var app = express();

// -----------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------
app.config = conf.argv().env().defaults({store:require(path.join(__dirname,'/config'))});


// -----------------------------------------------------------------
// App setup
// -----------------------------------------------------------------
app.set('views', path.join(__dirname, 'views'));
app.set('root', __dirname);
app.set('view engine', 'jade');
app.set('port', process.env.PORT || 3000);
app.set('mysql', mysql);

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// -----------------------------------------------------------------
// Error handlers
// -----------------------------------------------------------------
// development error handler -- will print stacktrace
if (app.get('env') === 'development')
{
    app.use(function(err, req, res, next)
    {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler -- no stacktraces leaked to user
app.use(function(err, req, res, next)
{
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

// -----------------------------------------------------------------
// Connect to the database
// -----------------------------------------------------------------

var connection;

function handleDisconnect() {
  // Connect to heroku
	app.get('mysql').connection = app.get('mysql').createConnection({
		//host : app.config.get('database:host'),
		//port : app.config.get('database:port'),
        socketPath : app.config.get('database:socket'),
		user     : app.config.get('database:user'),
		password : app.config.get('database:pass'),
		database : app.config.get('database:name')
	});


	app.get('mysql').connection.connect(function(err)
	{
		if(err)
		{
			console.log('Error connecting to the database', err);
			//setTimeout(handleDisconnect, 2000);
		}
		else
		{
			console.log('Successfully connected to the database');
		}
	});

	app.get('mysql').connection.on('error', function(err) {
		console.log('ERROR CONNECTING TO THE DATABASE: ', err);

		if(err.code === 'PROTOCOL_CONNECTION_LOST') {
			//handleDisconnect();
        }
		else {
			throw err;
        }
	});
}

handleDisconnect();



// -----------------------------------------------------------------
// Routing
// -----------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
require(path.join(__dirname, '/routes/index'))(app);

// -----------------------------------------------------------------
// Create the server
// -----------------------------------------------------------------
http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});

module.exports = app;
