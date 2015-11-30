
var bcrypt = require('bcrypt');

module.exports = function(app, passport)
{

	function createPassword() {

		var salt = bcrypt.genSaltSync(10);
		var hash = bcrypt.hashSync('PASSWORD_HERE', salt);
		console.log(hash);

	}

	// Uncomment to create a new hash
	// createPassword()

	function isLoggedIn(req, res, next) {

		console.log('verifying authentification');

		if (req.isAuthenticated()) {
			return next();
		}

		res.redirect('/admin/login');

	}

	return {
		isLoggedIn: isLoggedIn
	}

}