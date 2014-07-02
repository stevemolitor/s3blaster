'use strict';

/*global describe, it */
/*jshint expr: true, regexp: false */

var chai = require('chai');
var expect = chai.expect;
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var s3blaster = require('../lib/s3blaster');

chai.config.includeStack = true;

describe('s3blaster', function () {
  var originalDir = process.cwd();

  beforeEach(function () {
    process.chdir(__dirname);
  });

  afterEach(function () {
    process.chdir(originalDir);
  });

  it('should list files', function (done) {
    s3blaster.list('test-content', function (err, files) {
      expect(err).to.not.exist;

      var actualFiles = files.sort(function (a, b) {
        return a.absolutePath.localeCompare(b.absolutePath);
      });

      var expectedFiles = [
        {
          absolutePath: '/Users/molitors/s3blaster/test/test-content/file1-link-link.txt',
          relativePath: 'file1-link-link.txt',
          linkPath: 'file1-link.txt'
        },
        {
          absolutePath: '/Users/molitors/s3blaster/test/test-content/file1-link.txt',
          relativePath: 'file1-link.txt',
          linkPath: 'file1.txt'
        },
        {
          absolutePath: '/Users/molitors/s3blaster/test/test-content/file1.txt',
          relativePath: 'file1.txt'
        },
        {
          absolutePath: '/Users/molitors/s3blaster/test/test-content/file2.txt',
          relativePath: 'file2.txt'
        },
        {
          absolutePath: '/Users/molitors/s3blaster/test/test-content/file4-link.txt',
          relativePath: 'file4-link.txt',
          linkPath: 'folder/subfolder/file4.txt'
        },
        {
          absolutePath: '/Users/molitors/s3blaster/test/test-content/folder/file3.txt',
          relativePath: 'folder/file3.txt'
        },
        {
          absolutePath: '/Users/molitors/s3blaster/test/test-content/folder/subfolder/file4.txt',
          relativePath: 'folder/subfolder/file4.txt'
        }
      ];

      expect(actualFiles).to.deep.equal(expectedFiles);

      done();
    });
  });
});
