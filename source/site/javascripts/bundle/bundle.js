
//----------------------------------------------------------------------------------------------------
// LET THE MAGIC FLOW.
//----------------------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------------------
// Also try to use browserify for all the vendors you can.
//----------------------------------------------------------------------------------------------------
'use strict';

'use strict';

(function(){

	window.addEventListener('resize', () => {
		window.setTimeout(()=>{ resizeSections(); }, 250);
	});

	function resizeSections() {
		var sections = document.querySelectorAll('.card'),
			slider = document.querySelector('.slider'),
			leftCol = document.querySelector('.col.left'),
			header = document.querySelector('header');

		if(sections[0].clientWidth / 2 < 350) {
			leftCol.style.marginTop = '-' + sections[0].clientWidth / 2 + 'px';
			slider.style.marginTop = '-' + sections[0].clientWidth / 2 + 'px';
		}
		else {
			leftCol.style.marginTop = '-350px';
			slider.style.marginTop = '-350px';
		}

		if(window.innerWidth < 720)
			leftCol.style.marginTop = 0;

		for(var i = 0, slength = sections.length; i < slength; i++){
			sections[i].style.height = sections[i].clientWidth + 'px';
		}

		console.log('foo');

		header.style.height = sections[0].style.height;
		slider.style.height = sections[0].style.height;

	}

	resizeSections();

})();
