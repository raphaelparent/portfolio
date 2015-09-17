
module.exports = function(app) {

	app.get('/admin/home', function(req, res){
		res.render('admin/home', {'title': 'admin home'});
	});

}
