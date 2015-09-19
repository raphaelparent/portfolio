module.exports = function(app)
{
	app.get('/admin/projects', renderProjects);
	app.get('/admin/project/create', renderProjectCreate);


	function renderProjects(req, res)
	{
		res.render('admin/projects', {'title': 'Projects', 'icon': 'ti-layout-media-overlay-alt-2'});
	}


	function renderProjectCreate(req, res)
	{
		res.render('admin/project_form', {'title': 'Project', 'icon': 'ti-layout-media-overlay-alt-2'});
	}
};