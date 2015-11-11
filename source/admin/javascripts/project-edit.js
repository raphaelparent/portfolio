
'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('projectedit')) {

		var projectedit = new Vue({

			el: 'body.projectedit',

			data: {
				test: 'hello',
				project: {
					id: '',
					published: '',
					title: '',
					description: '',
					categories: '',
					credits: ''
				},
				thumbnail: '',
				cover: '',
				message: '',
				status: ''
			},

			ready: function() {

				var href = window.location.href.split('/'),
					id = href[href.length-1];

				this.fetchProject(id);

			},

			methods: {

				fetchProject: function(id) {

					this.$http.get('/api/projects/' + id).success(function(project) {

						document.getElementById('description').innerHTML = project.description;

						console.log(project);

						this.thumbnail = project.thumbnail;
						this.cover = project.cover;

						this.project = {
							id: project.id,
							published: project.published,
							title: project.title,
							description: project.description,
							categories: project.categories,
							link: project.link,
							credits: project.credits,
							thumbnail: project.thumbnail,
							cover: project.cover
						};

						window.setTimeout(function() {
							$('#description').editable({
								inlineMode: false
							});
						}, 10)

					});

				},

				saveProject: function(e) {

					e.preventDefault();

					this.project.description = document.querySelector('.froala-element').innerHTML;

					this.$http.put('/api/projects/' + this.project.id , { project: this.project }).success(function(project) {

						console.log('Updated project with success.');
						this.message = 'Success, project updated.';
						this.status = 'success';

					}).error(function(err) {

						console.log('Error while updating project :: ', err);
						this.message = 'Error while updating project. Retry.';
						this.status = 'error';

					})

				}

			}

		})

	}
});
