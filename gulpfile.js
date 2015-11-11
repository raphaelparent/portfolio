
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
	return gulp.src(src+'site/sass/base.sass')
		.pipe(sass())
		.pipe(autoprefixer('last 2 version'))
		.pipe(gulp.dest(dest+'site/stylesheets'))
		.pipe(rename({ suffix: '.min' }))
		.pipe(minifycss())
		.pipe(gulp.dest(dest+'site/stylesheets'))
		.pipe(notify('Style compiled. WOOHOO!'));
});

//----------------------------------------------------------------------------------------------------
// CONCATENATE IN BUNDLE FOR BROWSERIFY
// * Need to add files manually so the order can be the good one.
//----------------------------------------------------------------------------------------------------
gulp.task('scripts', function ()
{
	return gulp.src([
			src+'site/javascripts/main.js',
		])
		.pipe(jshint('.jshintrc'))
		.pipe(jshint.reporter('jshint-stylish'))
		.pipe(concat('bundle.js'))
		.pipe(gulp.dest(src+'site/javascripts/bundle/'));
});

//----------------------------------------------------------------------------------------------------
// BROWSERIFY
//----------------------------------------------------------------------------------------------------
gulp.task('browserify', function()
{
	return browserify(src+'site/javascripts/bundle/bundle.js')
		.bundle()
		.pipe(source('main.js'))
		.pipe(gulp.dest(dest+'site/javascripts/'));
});

//----------------------------------------------------------------------------------------------------
// MINIFY
//----------------------------------------------------------------------------------------------------
gulp.task('uglify', function()
{
	return gulp.src(dest+'site/javascripts/main.js')
		.pipe(rename({ suffix: '.min' }))
		.pipe(uglify())
		.pipe(gulp.dest(dest+'site/javascripts/'))
		.pipe(notify('Scripts compiled, browserified and minified. YEEEEAH!'));
});

//----------------------------------------------------------------------------------------------------
// WATCH ALL THOSE FILES
//----------------------------------------------------------------------------------------------------
gulp.task('watch', function ()
{
	gulp.watch(src+'site/sass/**/*.sass', ['styles']);
	gulp.watch(src+'site/javascripts/**/*.js', ['scripts']);
	gulp.watch(src+'site/javascripts/bundle/bundle.js', ['browserify']);
	//gulp.watch(dest+'site/javascripts/main.js', ['uglify']);
});

gulp.task('site', function ()
{
	gulp.start('styles', 'scripts', 'browserify', /*'uglify',*/ 'watch');
});

//----------------------------------------------------------------------------------------------------
// COMPILE
// AUTOPREFIXER
// CONCATENATE
// MINIFY
//----------------------------------------------------------------------------------------------------
gulp.task('styles_admin', function ()
{
	return gulp.src(src+'admin/sass/base.scss')
		.pipe(sass({outputStyle: 'expanded'}))
		.pipe(autoprefixer('last 2 version'))
		.pipe(gulp.dest(dest+'admin/stylesheets'))
		.pipe(rename({ suffix: '.min' }))
		.pipe(minifycss())
		.pipe(gulp.dest(dest+'admin/stylesheets'))
		.pipe(notify('Admin style compiled'));
});

//----------------------------------------------------------------------------------------------------
// CONCATENATE IN BUNDLE FOR BROWSERIFY
// * Need to add files manually so the order can be the good one.
//----------------------------------------------------------------------------------------------------
gulp.task('scripts_admin', function ()
{
	return gulp.src([
			src+'admin/javascripts/vendors/froala_editor.min.js',
			src+'admin/javascripts/main.js',
			src+'admin/javascripts/home.js',
			src+'admin/javascripts/projects.js',
			src+'admin/javascripts/project-create.js',
			src+'admin/javascripts/project-edit.js',
			src+'admin/javascripts/contact.js',
		])
		//.pipe(jshint('.jshintrc'))
		//.pipe(jshint.reporter('jshint-stylish'))
		.pipe(concat('bundle.js'))
		.pipe(gulp.dest(src+'admin/javascripts/bundle/'));
});

//----------------------------------------------------------------------------------------------------
// BROWSERIFY
//----------------------------------------------------------------------------------------------------
gulp.task('browserify_admin', function()
{
	return browserify(src+'admin/javascripts/bundle/bundle.js')
		.bundle()
		.pipe(source('main.js'))
		.pipe(gulp.dest(dest+'admin/javascripts/'));
});

//----------------------------------------------------------------------------------------------------
// MINIFY
//----------------------------------------------------------------------------------------------------
gulp.task('uglify_admin', function()
{
	return gulp.src(dest+'admin/javascripts/main.js')
		.pipe(rename({ suffix: '.min' }))
		.pipe(uglify())
		.pipe(gulp.dest(dest+'admin/javascripts/'))
		.pipe(notify('Admin scripts'));
});

//----------------------------------------------------------------------------------------------------
// WATCH ALL THOSE FILES
//----------------------------------------------------------------------------------------------------
gulp.task('watch_admin', function ()
{
	gulp.watch(src+'admin/sass/**/*.scss', ['styles_admin']);
	gulp.watch(src+'admin/javascripts/**/*.js', ['scripts_admin']);
	gulp.watch(src+'admin/javascripts/bundle/bundle.js', ['browserify_admin']);
	//gulp.watch(dest+'admin/javascripts/main.js', ['uglify_admin']);
});

gulp.task('admin', function ()
{
	gulp.start('styles_admin', 'scripts_admin', 'browserify_admin', /*'uglify_admin',*/ 'watch_admin');
});
