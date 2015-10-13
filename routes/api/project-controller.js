module.exports = function(app)
{
	var mysql = app.get('mysql'),
	    sanitizeHtml = require('sanitize-html');

	function fetchProjects(req, res)
	{
		mysql.connection.query('SELECT * FROM `projects` ORDER BY `created_at` DESC', function (err, projects) {
			if (err) {
				console.log('Errors while getting  all the projects :: ', err);
				res.sendStatus(500)
			}

			// Sanitize the html to prevent injection.
			projects.forEach(function(project) {
				project.description = sanitizeHtml(project.description, {
					allowedTags: [ 'b', 'i', 'em', 'strong', 'p']
				});
			});

			res.send(projects)

		});
	}

	function fetchProject(req, res)
	{
		mysql.connection.query('SELECT * FROM `projects` WHERE `id` = ?', [req.params.id], function (err, project) {
			if (err) {
				console.log('Errors while getting single project :: ', err);
				res.sendStatus(500)
			}

			// Sanitize the html to prevent injection.
			project[0].description = sanitizeHtml(project[0].description, {
				allowedTags: [ 'b', 'i', 'em', 'strong', 'p']
			});

			res.send(project[0])
		});
	}

	function createProject(req, res)
	{
		mysql.connection.query('INSERT INTO `projects` SET ?', {
			title: req.body.project.title,
			description: req.body.project.description,
			link: req.body.project.link,
			categories: req.body.project.categories,
			credits: req.body.project.credits,
			created_at: getDate()
		}, function(err) {
			if(err) {
				console.log('Error with INSERT query :: ', err);
				res.sendStatus(500)
			}
			res.sendStatus(200)
		});
	}

	function updateProject(req, res)
	{
		console.log(getDate());
		mysql.connection.query('UPDATE `projects` SET ? WHERE `id` = ' + req.params.id, {
			title: req.body.project.title,
			description: req.body.project.description,
			link: req.body.project.link,
			categories: req.body.project.categories,
			credits: req.body.project.credits,
			created_at: getDate()
		}, function(err) {
			if(err) {
				console.log('Error with INSERT query :: ', err);
				res.sendStatus(500)
			}
			res.sendStatus(200)
		});
	}

	function destroyProject(req, res)
	{
		mysql.connection.query('DELETE FROM `projects` WHERE `id` = ?', [req.body.id], function(err) {
			if(err) {
				console.log('Error with delete query :: ', err);
				res.sendStatus(500);
			}

			res.sendStatus(200);

		});
	}

	function getDate()
	{
		var current_date = new Date();
		return current_date.getFullYear() + "-"
			+ (current_date.getMonth()+1)  + "-"
			+ current_date.getDate() + " @ "
			+ current_date.getHours() + ":"
			+ current_date.getMinutes() + ":"
			+ current_date.getSeconds();
	}

	return {
		fetchMultiple: fetchProjects,
		fetchSingle: fetchProject,
		create: createProject,
		update: updateProject,
		destroy: destroyProject
	}
};