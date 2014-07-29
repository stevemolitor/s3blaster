'use strict';

var gulp = require('gulp');
var mocha = require('gulp-mocha');
var template = require('gulp-template');
var usage = require('./lib/usage');

gulp.task('test', function () {
  return gulp.src('./test/*.js', {read: false})
    .pipe(mocha({reporter: 'dot'}));
});

gulp.task('default', ['test']);

gulp.task('readme', function () {
  return gulp.src('./templates/README.md')
    .pipe(template({usage: usage}))
    .pipe(gulp.dest('.'));
});
