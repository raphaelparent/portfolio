module.exports = function(app)
{
	app.get('/admin/contact', renderContact);

	function renderContact(req, res)
	{
		res.render('admin/contact', {'title': 'Contact', 'icon': 'ti-mobile'});
	}
};