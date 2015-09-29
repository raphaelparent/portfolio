module.exports = function(app)
{
	app.get('/admin/projects', renderProjects);
	app.get('/admin/projects/create', renderProjectsCreate);

	function renderProjects(req, res)
	{
		res.render('admin/projects', {'title': 'Projects', 'icon': 'ti-layout-media-overlay-alt-2'});
	}

	function renderProjectsCreate(req, res)
	{
		res.render('admin/project_form', {'title': 'Project', 'icon': 'ti-layout-media-overlay-alt-2'});
	}
};