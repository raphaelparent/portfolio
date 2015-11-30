module.exports = function(app, passport)
{
	var mysql = app.get('mysql');

	var login = require('../api/login-controller')(app, passport);

	app.get('/admin/projects', login.isLoggedIn, renderProjects);
	app.get('/admin/projects/edit/:id', login.isLoggedIn, renderProjectUpdate);
	app.get('/admin/projects/create', login.isLoggedIn, renderProjectsCreate);

	function renderProjects(req, res)
	{
		res.render('admin/projects', {
			'title': 'Projects',
			'icon': 'ti-layout-media-overlay-alt-2'
		});

	}

	function renderProjectsCreate(req, res)
	{
		res.render('admin/project_form', {
			'title': 'ProjectCreate',
			'action': 'Create',
			'icon': 'ti-layout-media-overlay-alt-2'
		});
	}

	function renderProjectUpdate(req, res)
	{
		res.render('admin/project_form', {
			'title': 'ProjectEdit',
			'action': 'Save',
			'icon': 'ti-layout-media-overlay-alt-2'
		});
	}
};