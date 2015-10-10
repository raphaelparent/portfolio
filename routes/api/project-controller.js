module.exports = function(app)
{
	var mysql = app.get('mysql');

	function createProject(req, res)
	{
		console.log(req.body);

		mysql.connection.query( 'INSERT INTO `projects` SET ?', {
			title: req.body.title,
			description: req.body.desc,
			link: req.body.link,
			credits: req.body.credits,
			created_at: getDate()
		}, function(err) {
			if(err) {
				return console.log('Error with INSERT query', err);
			}
			res.redirect('/admin/projects')
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
		create: createProject
	}
};