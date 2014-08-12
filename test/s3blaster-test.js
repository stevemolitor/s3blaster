'use strict';

/*global describe, it */
/*jshint expr: true, regexp: false */

var chai = require('chai');
var expect = chai.expect;
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var local = require('../lib/local');
var s3blaster = require('../lib/s3blaster');
var _ = require('lodash');

chai.config.includeStack = true;

describe('s3blaster', function () {
  var BUCKET = 's3blaster-test';
  var LOCAL_FOLDER = 'test-content';

  beforeEach(function (done) {
    process.chdir(__dirname);
    s3blaster.del(BUCKET, function (err) {
      expect(err).to.not.exist;
      s3blaster.put(LOCAL_FOLDER, BUCKET, '', done);
    });
  });

  it('should LIST directories', function (done) {
    var stream = s3blaster.list(BUCKET, 'test-content/');

    var results = [];
    stream.on('data', results.push.bind(results));
    stream.on('error', done);

    stream.on('end', function () {
      var names = _.pluck(results, 'name').sort();
      var expectedNames = [
        'test-content/file1-link-link.txt', 'test-content/file1-link.txt',
        'test-content/file1.txt', 'test-content/file2.txt', 'test-content/file4-link.txt', 'test-content/folder/'
      ];
      expect(names).to.deep.equal(expectedNames);
      done();
    });
  });

  it('should LIST single file', function (done) {
    var stream = s3blaster.list(BUCKET, 'test-content/file1.txt');

    var results = [];
    stream.on('data', results.push.bind(results));
    stream.on('error', done);

    stream.on('end', function () {
      var names = _.pluck(results, 'name').sort();
      var expectedNames = ['test-content/file1.txt'];
      expect(names).to.deep.equal(expectedNames);
      done();
    });
  });
});
