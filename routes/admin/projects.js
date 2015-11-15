module.exports = function(app)
{
	var mysql = app.get('mysql');

	app.get('/admin/projects', renderProjects);
	app.get('/admin/projects/edit/:id', renderProjectUpdate);
	app.get('/admin/projects/create', renderProjectsCreate);

	function renderProjects(req, res)
	{
		// Render the view with the projects
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