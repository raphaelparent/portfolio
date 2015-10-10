'use strict';

document.addEventListener('DOMContentLoaded', function(){

	if(document.body.classList.contains('projectedit')) {

		$('#desc').editable({
			inlineMode: false
		})

	}

});
