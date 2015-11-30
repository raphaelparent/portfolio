
module.exports = function(app)
{
	var home = require('./home')(app);

	app.get('/', home.render)
}
