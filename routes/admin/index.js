
module.exports = function(app)
{
	require('./projects')(app);
	require('./contact')(app);

	app.get('/admin/home', renderHome);

	function renderHome(req,res)
	{
		res.render('admin/home', {'title': 'Home', 'icon': 'ti-home'});
	}
};
