'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var aws = require('aws-sdk');

var ASYNC_LIMIT = 100; // maximum number of files to process concurrently
var LINK_MODE = '41471'; // magic value that tells S3FS that the file is a symbolic link

var s3 = new aws.S3();
var queue = async.queue(putFile, ASYNC_LIMIT);

function list(dir, results, cb) {
  if (!cb) {
    cb = results;
    results = [];
  }
  doList('.', dir, results, cb);
}

function doList(startDir, dir, results, cb) {
  fs.readdir(dir, function (err, files) {
    if (err) return cb(err);

    async.forEach(files, function (file, cb) {
      var absolutePath = path.resolve(dir, file);
      var relativePath = path.join(startDir, file);

      fs.lstat(absolutePath, function (err, stat) {
        if (stat.isFile()) {
          results.push({absolutePath: absolutePath, relativePath: relativePath});
          cb(null, results);
        } else if (stat.isSymbolicLink()) {
          fs.readlink(absolutePath, function (err, linkPath) {
            if (err) return cb(err);
            results.push({absolutePath: absolutePath, relativePath: relativePath, linkPath: linkPath});
            cb(null, results);
          });
        } else if (stat.isDirectory()) {
          var newDir = path.join(dir, file);
          var newStartDir = path.join(startDir, file);
          doList(newStartDir, newDir, results, cb);
        } else {
          cb('Unexpected file type for file ' + file);
        }
      });
    }, function (err) {
      cb(err, results);
    });
  });
}

function putFile(srcDir, s3Bucket, destPath, verbose, entry, cb) {
  var s3Key = path.join(destPath, entry.relativePath);
  var metadata = {
    'gid': '0',
    'uid': '0'
  };
  var params = {Bucket: s3Bucket, Key: s3Key, Metadata: metadata};

  if (verbose) {
    var type = entry.linkPath ? 'symbolic link' : 'file';
    console.log('Uploading', type, entry.relativePath, 'to', s3Key);
  }

  if (entry.linkPath) { // symbolic link
    params.Body = entry.linkPath;
    params.Metadata.mode = LINK_MODE;
    s3.putObject(params, cb);
  } else { // regular file
    params.Body = fs.createReadStream(entry.absolutePath);
    s3.putObject(params, cb);
  }
}

function copyDirectory(srcDir, s3Bucket, destPath, verbose, cb) {
  var putFn = putFile.bind(null, srcDir, s3Bucket, destPath, verbose);

  list(srcDir, function (err, entries) {
    if (err) return cb(err);

    console.log('Uploading', entries.length, 'files....');
    async.forEachLimit(entries, ASYNC_LIMIT, putFn, cb);
  });
}

module.exports = {
  copyDirectory: copyDirectory,
  list: list
};
