'use strict';

/*global describe, it */
/*jshint expr: true, regexp: false */

var chai = require('chai');
var expect = chai.expect;
var DirectoryStream = require('../lib/directory-stream');

chai.config.includeStack = true;

describe('DirectoryStream', function () {
  var originalDir = process.cwd();

  beforeEach(function () {
    process.chdir(__dirname);
  });

  afterEach(function () {
    process.chdir(originalDir);
  });

  it('should emit files', function (done) {
    var stream = new DirectoryStream('test-content');
    stream.on('data', function (file) {
      console.log(file);
    });
    stream.on('end', done);
    stream.on('error', done);
  });
});
