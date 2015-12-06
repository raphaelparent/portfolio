(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

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

},{}]},{},[1]);
