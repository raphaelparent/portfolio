module.exports = function(app, passport)
{
	require('./api/index')(app);
	require('./site/index')(app);
	require('./admin/index')(app, passport);
};

