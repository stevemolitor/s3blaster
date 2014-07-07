'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var aws = require('aws-sdk');
var mime = require('mime');

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
        if (stat.isDirectory()) {
          var newDir = path.join(dir, file);
          var newStartDir = path.join(startDir, file);
          doList(newStartDir, newDir, results, cb);
        } else {
          makeFileEntry(absolutePath, relativePath, stat, function (err, entry) {
            if (err) return cb(err);
            results.push(entry);
            cb(null, results);
          });
        }
      });
    }, function (err) {
      cb(err, results);
    });
  });
}

function makeFileEntry(absolutePath, relativePath, stat, cb) {
  if (stat.isFile()) {
    var entry = {
      absolutePath: absolutePath,
      relativePath: relativePath,
      stat: stat
    };
    cb(null, entry);
  } else if (stat.isSymbolicLink()) {
    fs.readlink(absolutePath, function (err, linkPath) {
      if (err) return cb(err);
      var entry = {
        absolutePath: absolutePath,
        relativePath: relativePath,
        linkPath: linkPath,
        stat: stat
      };
      cb(null, entry);
    });
  }
}

function makeMetadata(entry) {
  return {
    'x-amz-meta-gid': entry.stat.gid + '',
    'x-amz-meta-uid': entry.stat.uid + '',
    'x-amz-meta-mode': entry.stat.mode + '',
    'x-amz-meta-mtime': entry.stat.mtime.getTime() + '',
    'Content-Type': mime.lookup(entry.absolutePath)
  };
}

function putFile(s3Bucket, destPath, verbose, dryRun, entry, cb) {
  var s3Key = path.join(destPath, entry.relativePath);
  var metadata = makeMetadata(entry);
  var params = {Bucket: s3Bucket, Key: s3Key, Metadata: metadata};

  var type = entry.linkPath ? 'symbolic link' : 'file';
  if (verbose) {
    console.log('Uploading', type, entry.relativePath, 'to', s3Key);
    console.log('Metadata:', params.Metadata);
  }

  if (entry.linkPath) { // symbolic link
    params.Body = entry.linkPath;
    params.Metadata.mode = LINK_MODE;
  } else { // regular file
    params.Body = fs.createReadStream(entry.absolutePath);
    params.Body.on('error', function (err) {
      console.error('Error reading stream for file', entry.absolutePath);
    });
  }

  var finishedCb = function (err) {
    if (err) {
      console.error('Erroring uploading', entry.relativePath, err);
      return cb(err);
    }

    if (verbose) {
      console.log('Finishing uploading', type, entry.relativePath);
    }
    cb();
  }

  if (!dryRun) {
    s3.putObject(params, finishedCb);
  } else {
    process.nextTick(finishedCb);
  }
}

function put(srcDir, s3Bucket, destPath, verbose, dryRun, cb) {
  var putFn = putFile.bind(null, s3Bucket, destPath, verbose, dryRun);

  fs.stat(srcDir, function (err, stat) {
    if (err) return cb(err);

    if (stat.isDirectory()) {
      list(srcDir, function (err, entries) {
        if (err) return cb(err);

        console.log('Uploading', entries.length, 'files....');
        if (dryRun) {
          console.log('(dry run mode - not really uploading)');
        }
        async.forEachLimit(entries, ASYNC_LIMIT, putFn, cb);
      });
    } else { // put single file
      var relativePath = srcDir;
      console.log('Uploading', relativePath);
      var absolutePath = path.resolve(relativePath);
      makeFileEntry(absolutePath, relativePath, stat, function (err, entry) {
        if (err) return cb(err);
        putFn(entry, cb);
      });
    }
  });
}

function get(s3Bucket, s3Key, localPath, verbose, dryRun, cb) {
  console.log('s3Bucket', s3Bucket, 's3Key', s3Key, 'localPath', localPath, 'verbose', verbose, 'dryRun', dryRun);
  console.log('GET not implemented yet.');
  cb();
}

module.exports = {
  list: list,
  put: put,
  get: get
};
