module.exports = function(app, passport)
{
	var login = require('../api/login-controller')(app, passport);

	app.get('/admin/contact', login.isLoggedIn, renderContact);

	function renderContact(req, res)
	{
		res.render('admin/contact', {'title': 'Contact', 'icon': 'ti-mobile'});
	}
};