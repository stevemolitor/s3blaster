'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var aws = require('aws-sdk');

var ASYNC_LIMIT = 100; // maximum number of files to process concurrently

var s3 = new aws.S3();
var queue = async.queue(putFile, ASYNC_LIMIT);

function getPutCommands(srcDir, s3Bucket, destPath, commands, cb) {
  if (!cb) {
    cb = commands;
    commands = [];
  }

  fs.readdir(srcDir, function (err, files) {
    if (err) return cb(err);

    async.forEach(files, function (file, cb) {
      var srcPath = path.resolve(srcDir, file);
      fs.lstat(srcPath, function (err, stat) {
        if (err) return asyncCB(err);

        if (stat.isFile()) {
          var s3Key = path.join(destPath, file);
          commands.push({srcPath: srcPath, s3Bucket: s3Bucket, s3Key: s3Key, metadata: {}});
          cb(null, commands);
        } else if (stat.isSymbolicLink()) {
          fs.readlink(srcPath, function (err, linkPath) {
            if (err) return cb(err);

            var s3Key = path.join(destPath, file);
            commands.push({srcPath: srcPath, s3Bucket: s3Bucket, s3Key: s3Key,
                           metadata: {
                             'mode': '41471',
                             'gid': '0',
                             'mtime': '1403905661',
                             'uid': '0'
                           }, body: linkPath});
            cb(null, commands);
          });
        } else if (stat.isDirectory()) {
          var newDestPath = path.join(destPath, path.basename(file));
          var newSrcDir = path.resolve(srcDir, file);
          getPutCommands(newSrcDir, s3Bucket, newDestPath, commands, cb);
        }
      });
    }, function (err) {
      cb(err, commands);
    });
  });
}

function putFile(verbose, opts, cb) {
  var s3Params = {Bucket: opts.s3Bucket, Key: opts.s3Key, Metadata: opts.metadata};

  if (!opts.body) {
    var src = fs.createReadStream(opts.srcPath);
    s3Params.Body = src;

    src.on('error', function (err) {
      console.error('Error putting file:', err);
    });

    if (verbose) {
      console.log('Uploading', opts.srcPath);
      src.on('end', function () {
        console.log('Finished uploading', opts.srcPath);
      });
    }
  } else {
    debugger;
    s3Params.Body = opts.body;
    if (verbose) {
      console.log('Uploading symbolic link from', s3Params.Key, 'to', s3Params.Body);
    }
  }

  debugger;
  console.log('put object, params', s3Params);
  s3.putObject(s3Params, cb);
}

function copyDirectory(srcDir, s3Bucket, destPath, verbose, cb) {
  var putFn = putFile.bind(null, verbose);
  getPutCommands(srcDir, s3Bucket, destPath, function (err, commands) {
    if (err) return cb(err);

    console.log('Uploading', commands.length, 'files....');
    async.forEachLimit(commands, ASYNC_LIMIT, putFn, cb);
  });
}

module.exports = {
  getPutCommands: getPutCommands,
  copyDirectory: copyDirectory
};
