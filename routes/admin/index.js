
module.exports = function(app, passport)
{
	require('./projects')(app, passport);
	require('./contact')(app, passport);

	var login = require('../api/login-controller')(app, passport);

	app.get('/admin/login', renderLogin);
	app.get('/admin/logout', logout);

	app.post('/api/login/', passport.authenticate('local-login', {
		successRedirect : '/admin/home',
		failureRedirect : '/admin/login',
		failureFlash : false
	}));

	app.get('/admin/home', login.isLoggedIn, renderHome);

	function renderLogin(req, res) {
		res.render('admin/login', {'title': 'Login', 'icon': 'ti-lock'})
	}

	function renderHome(req,res) {
		res.render('admin/home', {'title': 'Home', 'icon': 'ti-home'});
	}

	function logout(req, res) {
		req.logout();
		res.redirect('/admin/login');
	}
};
