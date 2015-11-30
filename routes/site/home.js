
'use strict';

let sanitizeHtml = require('sanitize-html'),
	async = require('async');

module.exports = function(app)
{

	let  mysql = app.get('mysql'),
		contact = require('../api/contact-controller')(app);

	function render(req, res) {

		async.series({
			//Get contact info
			info: function (next) {
				mysql.connection.query('SELECT * FROM `contact` LIMIT 1', (err, info) => {

					if (err) {
						console.log('Errors while getting all the contact info :: ', err);
						res.sendStatus(500)
					}

					info[0].about = sanitizeHtml(info[0].about);

					next(null, info[0])

				});
			},
			// Get latest project
			latest: function(next) {

				mysql.connection.query('SELECT * FROM `projects` ORDER BY `created_at` DESC LIMIT 1', function (err, project) {

					if (err) {
						console.log('Errors while getting  all the projects :: ', err);
						res.sendStatus(500)
					}

					// Sanitize the html to prevent injection.
					project[0].description = sanitizeHtml(project.description, {
						allowedTags: ['b', 'i', 'em', 'strong', 'p']
					});
					
					console.log(project[0]);
					
					next(null, project[0])

				});

			},
			// Get the 4 latest projects
			projects: function(next) {

				mysql.connection.query('SELECT * FROM `projects` ORDER BY `created_at` DESC LIMIT 1, 4', function (err, projects) {

					if (err) {
						console.log('Errors while getting  all the projects :: ', err);
						res.sendStatus(500)
					}

					// Sanitize the html to prevent injection.
					projects.forEach(function(project) {
						projects.description = sanitizeHtml(project.description, {
							allowedTags: [ 'b', 'i', 'em', 'strong', 'p']
						});
					});

					console.log(projects);

					next(null, projects)

				});

			}

			// Once all of the above is done
		}, function(err, results) {
			res.render('pages/index', {
				title: 'Home',
				info: results.info,
				latest: results.latest,
				projects: results.projects
			})
		});

	}

	return {
		render: render
	}
}
