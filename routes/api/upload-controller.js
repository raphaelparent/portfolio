


//var upload = Multer({dest: ''})

module.exports = function(app)
{
	function uploadFile(req, res) {
		res.redirect('/admin/projects')
	}

	return {
		upload: uploadFile
	}

}
