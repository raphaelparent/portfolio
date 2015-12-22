
'use strict';

let sanitizeHtml = require('sanitize-html'),
	async = require('async');

module.exports = function(app)
{

	let mysql = app.get('mysql'),
		project = require('../api/project-controller')(app);

	function render(req, res) {

		async.series({
			// Get the 4 latest projects
			project: function (next) {

				mysql.connection.query('SELECT * FROM `projects` WHERE `id` = ?', [req.params.id], function (err, project) {

					if (err) {
						console.log('Errors while getting single project :: ', err);
						res.sendStatus(500)
					}

					// Sanitize the html to prevent injection.
					project[0].description = sanitizeHtml(project[0].description, {
						allowedTags: [ 'b', 'i', 'em', 'strong', 'p']
					});

					next(null, project[0])

				});

			}

			// Once all of the above is done
		}, function (err, results) {
			res.render('pages/single', {
				title: 'Project',
				project: results.project
			})
		});
	}

	return {
		render: render
	}

};
