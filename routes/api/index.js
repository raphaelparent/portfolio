module.exports = function(app)
{
	var project = require('./project-controller')(app);

	app.get('/api/projects', project.fetchMultiple);
	app.get('/api/projects/:id', project.fetchSingle);
	app.post('/api/projects', project.create);
	app.put('/api/projects/:id', project.update);
	app.delete('/api/projects', project.destroy);

};