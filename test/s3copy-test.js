'use strict';

/*global describe, it */
/*jshint expr: true, regexp: false */

var chai = require('chai');
var expect = chai.expect;
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var s3copy = require('../lib/s3copy');

chai.config.includeStack = true;

describe('s3copy', function () {
  var SRC_DIR = path.resolve(__dirname, 'test-content');

  it('should get list of copy commands', function (done) {
    s3copy.getPutCommands(SRC_DIR, 's3-bucket', 'dest-path', function (err, commands) {
      expect(err).to.not.exist;

      var actualCommands = commands.sort(function (a, b) {
        return a.srcPath.localeCompare(b.srcPath);
      });

      var expectedCommands = [
        { srcPath: SRC_DIR + '/file1.txt',
          s3Bucket: 's3-bucket',
          s3Key: 'dest-path/file1.txt' },
        { srcPath: SRC_DIR + '/file2.txt',
          s3Bucket: 's3-bucket',
          s3Key: 'dest-path/file2.txt' },
        { srcPath: SRC_DIR + '/folder/file3.txt',
          s3Bucket: 's3-bucket',
          s3Key: 'dest-path/folder/file3.txt' },
        { srcPath: SRC_DIR + '/folder/subfolder/file4.txt',
          s3Bucket: 's3-bucket',
          s3Key: 'dest-path/folder/subfolder/file4.txt' }
      ];

      expect(actualCommands).to.deep.equal(expectedCommands);

      done();
    });
  });
});
