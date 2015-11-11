
'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('projectcreate')) {

		$('#description').editable({
			inlineMode: false
		});

		var projectcreate = new Vue({

			el: 'body.projectcreate',

			data: {
				project: {
					published: '',
					title: '',
					description: '',
					categories: '',
					credits: '',
					thumbnail: '',
					cover: ''
				},

				message: '',
				status: ''
			},

			methods: {

				saveProject: function(e) {

					e.preventDefault();

					console.log(this.project.thumbnail);

					this.project.description = document.querySelector('.froala-element').innerHTML;

					this.$http.post('/api/projects', {project: this.project}).success(function(project) {

						console.log('Created project with success.');
						this.message = 'Success, redirecting to project page.';
						this.status = 'success';

						window.setTimeout(function(){
							document.getElementById('fileForm').submit();
						}, 3000)

					}).error(function(err) {

						console.log('Error while creating project :: ', err);
						this.message = 'Error while creating project. Retry.';
						this.status = 'error';

					})

				},

				getFile: function(e) {

					e.preventDefault();

					var self = this;

					//if(this.files.length > 0) {
					//
					//	this.files.forEach(function (file) {
					//
					//		if (file.name !== e.target.files[0].name) {
					//			console.log('pushing!');
					//			self.files.push(e.target.files[0]);
					//		}
					//		else {
					//			console.log('File already in array!');
					//		}
					//
					//	});
					//
					//}
					//else {
					//
					//	console.log('first file');
					//	this.files.push(e.target.files[0]);
					//
					//}

					if (this.files.filter(function(file) { return file.name === e.target.files[0].name; }).length > 0) {
						/* vendors contains the element we're looking for */
						console.log('has file');
					}
					else {
						console.log('doesnt has file');
						this.files.push(e.target.files[0]);
					}

					console.log(this.files);

				}

			}

		})

	}

});
