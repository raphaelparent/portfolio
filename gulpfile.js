
var gulp         = require('gulp'),
	browserify	 = require('browserify');
	concat       = require('gulp-concat'),
	sass         = require('gulp-sass'),
	autoprefixer = require('gulp-autoprefixer'),
	minifycss    = require('gulp-minify-css'),
	uglify       = require('gulp-uglify'),
	sourcemaps   = require('gulp-sourcemaps'),
	jshint       = require('gulp-jshint'),
	notify       = require('gulp-notify'),
	source 		 = require('vinyl-source-stream'),
	rename       = require('gulp-rename');

var src = './source/';
var dest = './public/';

//----------------------------------------------------------------------------------------------------
// COMPILE
// AUTOPREFIXER
// CONCATENATE
// MINIFY
//----------------------------------------------------------------------------------------------------
gulp.task('styles', function ()
{
	return gulp.src(src+'sass/base.sass')
		.pipe(sass())
		.pipe(autoprefixer('last 2 version'))
		.pipe(gulp.dest(dest+'stylesheets'))
		.pipe(rename({ suffix: '.min' }))
		.pipe(minifycss())
		.pipe(gulp.dest(dest+'stylesheets'))
		.pipe(notify('Style compiled. WOOHOO!'));
});

//----------------------------------------------------------------------------------------------------
// CONCATENATE IN BUNDLE FOR BROWSERIFY
// * Need to add files manually so the order can be the good one.
//----------------------------------------------------------------------------------------------------
gulp.task('scripts', function ()
{
	return gulp.src([
			src+'javascripts/main.js'
		])
		.pipe(jshint('.jshintrc'))
		.pipe(jshint.reporter('jshint-stylish'))
		.pipe(concat('bundle.js'))
		.pipe(gulp.dest(src+'javascripts/bundle/'));
});

//----------------------------------------------------------------------------------------------------
// BROWSERIFY
//----------------------------------------------------------------------------------------------------
gulp.task('browserify', function()
{
	return browserify(src+'/javascripts/bundle/bundle.js')
		.bundle()
		.pipe(source('main.js'))
		.pipe(gulp.dest(dest+'/javascripts/'));
});

//----------------------------------------------------------------------------------------------------
// MINIFY
//----------------------------------------------------------------------------------------------------
gulp.task('uglify', function()
{
	return gulp.src(dest+'javascripts/main.js')
		.pipe(rename({ suffix: '.min' }))
		.pipe(uglify())
		.pipe(gulp.dest(dest+'javascripts'))
		.pipe(notify('Scripts compiled, browserified and minified. YEEEEAH!'));
});

//----------------------------------------------------------------------------------------------------
// WATCH ALL THOSE FILES
//----------------------------------------------------------------------------------------------------
gulp.task('watch', function ()
{
	gulp.watch(src+'sass/**/*.scss', ['styles']);
	gulp.watch(src+'javascripts/**/*.js', ['scripts']);
	gulp.watch(src+'javascripts/bundle/bundle.js', ['browserify']);
	//gulp.watch(dest+'javascripts/main.js', ['uglify']);
});

gulp.task('default', function ()
{
	gulp.start('styles', 'scripts', 'browserify', /*'uglify',*/ 'watch');
});
