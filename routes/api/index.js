module.exports = function(app)
{
	var project = require('./project-controller')(app);

	app.post('/api/projects/create', project.create);

};