
'use strict';

document.addEventListener('DOMContentLoaded', function() {

	if(document.body.classList.contains('contact')) {

		var contact = new Vue({

			el: 'body.contact',

			data: {
				infos: {},
				message: '',
				status: '',
				about: ''
			},

			ready: function() {
				this.fetchInfos();
			},

			methods: {

				fetchInfos: function() {

					this.$http.get('/api/contact').success(function(infos) {

						window.setTimeout(function() {
							$('#about').editable({
								inlineMode: false
							});
						}, 10);

						this.infos = infos;

					})

				},

				saveInfos: function(e) {

					e.preventDefault();

					this.$http.put('/api/contact/' + this.infos.id , { infos: this.infos }).success(function(infos) {

						console.log('Updated infos with success.');
						this.message = 'Success, infos updated.';
						this.status = 'success';

						window.setTimeout(function(){
							this.status = '';
						}.bind(this), 3000);

					}).error(function(err) {

						console.log('Error while updating infos :: ', err);
						this.message = 'Error while updating infos. Retry.';
						this.status = 'error';

					})

				}

			}

		})

	}

});
