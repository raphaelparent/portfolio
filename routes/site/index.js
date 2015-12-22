
module.exports = function(app)
{
	var home = require('./home')(app);
	var project = require('./project')(app);

	app.get('/', home.render);
	app.get('/project/:id', project.render);

};
