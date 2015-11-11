
'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('home')) {
		var home = new Vue({
			el: 'body.home',
			data: {
				projects: {}
			},
			ready: function () {
				this.fetchDrafts();
			},
			methods: {
				fetchDrafts: function () {
					this.$http.get('/api/projects/drafts').success(function (projects) {
						console.log(projects);
						this.projects = projects;
					})
				}
			}
		})
	}
});
