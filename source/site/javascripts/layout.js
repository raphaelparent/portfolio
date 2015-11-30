'use strict';

(function(){

	window.addEventListener('resize', () => {
		window.setTimeout(()=>{ resizeSections(); }, 250);
	});

	function resizeSections() {
		var sections = document.querySelectorAll('section'),
			leftCol = document.querySelector('.col.left'),
			header = document.querySelector('header'),
			divided = document.querySelector('.divided'),
			divisions = document.querySelectorAll('.division');

		leftCol.style.marginTop = '-' + sections[0].clientWidth / 2 + 'px';

		if(window.innerWidth < 720)
			leftCol.style.marginTop = 0;

		for(var i = 0, slength = sections.length; i < slength; i++){
			sections[i].style.height = sections[i].clientWidth + 'px';
		}

		divided.style.height = sections[0].clientWidth / 3 + 'px';
		header.style.height = sections[0].style.height;

		for(var ii = 0, dlength = divisions.length; i < dlength; i++){
			divisions[ii].style.width = divided.clientWidth / 3 + 'px';
		}
	}

	resizeSections();

})();
