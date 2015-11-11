
'use strict';

document.addEventListener('DOMContentLoaded', function() {

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
});
