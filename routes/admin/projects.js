module.exports = function(app)
{
	app.get('/admin/projects', renderProjects);
	app.get('/admin/projects/create', renderProjectsCreate);

	var mysql = app.get('mysql');

	function renderProjects(req, res)
	{
		mysql.connection.query('SELECT * FROM `projects`',
			function (err, projects) {
				if (err) {
					return console.log('Errors while getting scores ===>', err);
				}
				// Send the scores back
				//res.send(rows);
				res.render('admin/projects', {
					'title': 'Projects',
					'icon': 'ti-layout-media-overlay-alt-2',
					'projects': projects
				});
			});
	}

	function renderProjectsCreate(req, res)
	{
		res.render('admin/project_form', {'title': 'ProjectEdit', 'icon': 'ti-layout-media-overlay-alt-2'});
	}
};