
//----------------------------------------------------------------------------------------------------
// LET THE MAGIC FLOW.
//----------------------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------------------
// Also try to use browserify for all the vendors you can.
//----------------------------------------------------------------------------------------------------
'use strict';

document.addEventListener('DOMContentLoaded', function() {

	var Vue = require('vue');
	Vue.use(require('vue-resource'));
	Vue.config.silent = true;
	Vue.config.strict = true;

	if(document.body.classList.contains('projects')) {
		var projects = new Vue({
			el: 'body.projects',
			data: {
				projects: {}
			},
			ready: function() {
				this.fetchProjects();
			},
			methods: {
				fetchProjects: function() {
					this.$http.get('/api/projects').success(function(projects) {
						this.projects = projects;
					})
				},
				destroyProject: function(pId) {
					if(confirm('Are you sure you want to delete this projects')) {
						this.$http.delete('/api/projects', {id: pId}).success(function() {
							console.log('Deleted with success.');
							this.fetchProjects();
						}).error(function(err) {
							console.log('Error while deleting :: ', err);
						})
					}
				}
			}
		})
	}

	if(document.body.classList.contains('projectcreate')) {

		$('#description').editable({
			inlineMode: false
		});

		var projectcreate = new Vue({
			el: 'body.projectcreate',

			data: {
				project: {
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

			ready: function() {

			},

			methods: {
				saveProject: function(e) {
					e.preventDefault();

					this.project.description = document.querySelector('.froala-element').innerHTML;

					this.$http.post('/api/projects', {project: this.project}).success(function(project) {
						console.log('Created project with success.');
						this.message = 'Success, redirecting to project page.';
						this.status = 'success';
						window.setTimeout(function(){
							window.location.href = '/admin/projects';
						}, 3000)
					}).error(function(err) {
						console.log('Error while creating project :: ', err);
						this.message = 'Error while creating project. Retry.';
						this.status = 'error';
					})
				}
			}
		})
	}

	if(document.body.classList.contains('projectedit')) {
		var projectedit = new Vue({
			el: 'body.projectedit',

			data: {
				project: {
					id: '',
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

			ready: function() {
				var href = window.location.href.split('/'),
					id = href[href.length-1];

				this.fetchProject(id);
			},

			methods: {
				fetchProject: function(id) {
					this.$http.get('/api/projects/' + id).success(function(project) {
						document.getElementById('description').innerHTML = project.description;
						this.project = {
							id: project.id,
							title: project.title,
							description: project.description,
							categories: project.categories,
							link: project.link,
							credits: project.credits
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
