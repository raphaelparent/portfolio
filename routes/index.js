module.exports = function(app)
{
	require('./api/index')(app);
	require('./admin/index')(app);
};

