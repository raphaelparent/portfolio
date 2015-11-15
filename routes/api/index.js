
var multer = require('multer');

module.exports = function(app)
{
	var storage = multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, app.get('root') + '/public/site/images/uploaded/')
		},
		filename: function (req, file, cb) {
			cb(null, file.originalname);
		}
	});

	var multerUpload = multer({ storage: storage });

	var project = require('./project-controller')(app);
	var contact = require('./contact-controller')(app);
	var upload = require('./upload-controller')(app);

	app.get('/api/projects', project.all);
	app.post('/api/projects', project.create);
	app.delete('/api/projects', project.destroy);

	app.get('/api/projects/drafts', project.drafts);
	app.get('/api/projects/published', project.published);
	app.get('/api/projects/:id', project.single);
	app.put('/api/projects/:id', project.update);

	app.post('/api/upload', multerUpload.array('pictures', 3), upload.upload);

	app.get('/api/contact', contact.fetch);
	app.put('/api/contact/:id', contact.update);

};
