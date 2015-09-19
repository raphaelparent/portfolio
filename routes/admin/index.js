
module.exports = function(app)
{
	require('./projects')(app);

	app.get('/admin/home', renderHome);
	app.get('/admin/contact', renderContact);

	function renderHome(req,res)
	{
		res.render('admin/home', {'title': 'Home', 'icon': 'ti-home'});
	}

	function renderContact(req, res)
	{
		res.render('admin/contact', {'title': 'Contact', 'icon': 'ti-mobile'});
	}
};
