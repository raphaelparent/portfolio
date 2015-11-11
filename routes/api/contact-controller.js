module.exports = function(app) {

	var mysql = app.get('mysql'),
		sanitizeHtml = require('sanitize-html');

	function fetchInfo(req, res) {

		mysql.connection.query('SELECT * FROM `contact` LIMIT 1', (err, info) => {

			if (err) {
				console.log('Errors while getting all the contact info :: ', err);
				res.sendStatus(500)
			}

			info[0].about = sanitizeHtml(info[0].about, {
				allowedTags: [ 'b', 'i', 'em', 'strong', 'p']
			});

			res.send(info[0])

		});
	}

	function updateInfo(req, res) {

		mysql.connection.query('UPDATE `contact` SET ? WHERE `id` = ' + req.params.id, {
			phone: req.body.infos.phone,
			email: req.body.infos.email,
			about: req.body.about,
			codepen: req.body.infos.codepen,
			github: req.body.infos.github,
			twitter: req.body.infos.twitter,
			blog: req.body.infos.blog,
			created_at: getDate()

		}, (err) => {

			if(err) {
				console.log('Error with INSERT query :: ', err);
				res.sendStatus(500)
			}

			res.sendStatus(200)

		});
	}

	function getDate() {

		var current_date = new Date();
		return current_date.getFullYear() + "-"
			+ (current_date.getMonth()+1)  + "-"
			+ current_date.getDate() + " @ "
			+ current_date.getHours() + ":"
			+ current_date.getMinutes() + ":"
			+ current_date.getSeconds();
	}

	return {
		fetch: fetchInfo,
		update: updateInfo
	}

};