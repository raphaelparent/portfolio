
var LocalStrategy   = require('passport-local').Strategy,
	bcrypt			= require('bcrypt')

module.exports = function(app, passport) {

	var mysql = app.get('mysql');

	passport.serializeUser(function(user, done) {
		console.log(user);
		done(null, user.id);
	});

	passport.deserializeUser(function(id, done) {
		mysql.connection.query('SELECT * FROM `users` WHERE `id` = ?', [id], function(err, user) {
			done(err, user);
		})
	});

	passport.use('local-login', new LocalStrategy({

		usernameField : 'username',
		passwordField : 'password',
		passReqToCallback : true

	}, function(req, username, password, done) {

		// find a user whose email is the same as the forms email
		// we are checking to see if the user trying to login already exists


		mysql.connection.query('SELECT * FROM `users` WHERE `username` = ?', [username], function (err, user) {

			console.log('Username :: ', username);
			console.log('Password :: ', password);
			console.log('User :: ', user);

			if (err) {
				console.log('Errors while getting password the projects :: ', err);
				return done(null, false, {});
			}

			if (!user) {
				console.log('No user found');
				return done(null, false, {});
			}

			bcrypt.compare(password, user.password, function(err, res) {

				if(err) {
					console.log('Error comparing hash :: ', err);
				}

				return done(null, user[0]);

			});

		});

	}));

}