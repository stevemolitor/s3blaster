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

  it('should list local files', function (done) {
    var dirStream = new DirectoryStream('test-content');
    dirStream.on('data', function (file) {
      console.log(file);
    });
    dirStream.on('end', done);

    // var dirStream = new DirectoryStream('test-content');
    // var actualFiles = [];
    // dirStream.on('data', function (chunk) {
    //   console.log('data called');
    // });
    // dirStream.on('error', done);
    // dirStream.on('end', function () {
    //   console.log('ended', actualFiles);
    //   done();
    // });

    // actualFiles.sort(function (a, b) {
    //   return a.absolutePath.localeCompare(b.absolutePath);
    // });

    // // we don't care about the guids, etc. in this test
    // actualFiles.forEach(function (entry) {
    //   delete entry.stat;
    // });

    // var expectedFiles = [
    //   {
    //     absolutePath: '/Users/molitors/s3blaster/test/test-content/file1-link-link.txt',
    //     relativePath: 'test-content/file1-link-link.txt',
    //     linkPath: 'file1-link.txt'
    //   },
    //   {
    //     absolutePath: '/Users/molitors/s3blaster/test/test-content/file1-link.txt',
    //     relativePath: 'test-content/file1-link.txt',
    //     linkPath: 'file1.txt'
    //   },
    //   {
    //     absolutePath: '/Users/molitors/s3blaster/test/test-content/file1.txt',
    //     relativePath: 'test-content/file1.txt'
    //   },
    //   {
    //     absolutePath: '/Users/molitors/s3blaster/test/test-content/file2.txt',
    //     relativePath: 'test-content/file2.txt'
    //   },
    //   {
    //     absolutePath: '/Users/molitors/s3blaster/test/test-content/file4-link.txt',
    //     relativePath: 'test-content/file4-link.txt',
    //     linkPath: 'folder/subfolder/file4.txt'
    //   },
    //   {
    //     absolutePath: '/Users/molitors/s3blaster/test/test-content/folder/file3.txt',
    //     relativePath: 'test-content/folder/file3.txt'
    //   },
    //   {
    //     absolutePath: '/Users/molitors/s3blaster/test/test-content/folder/subfolder/file4.txt',
    //     relativePath: 'test-content/folder/subfolder/file4.txt'
    //   }
    // ];

    // expect(actualFiles).to.deep.equal(expectedFiles);

    // done();
  });
});
