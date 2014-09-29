'use strict';

var async = require('async');
var fs = require('fs');
var path = require('path');
var mime = require('mime');
var aws = require('aws-sdk');

var LINK_MODE = '41471'; // magic value that tells S3FS that the file is a symbolic link
var QUEUE_SIZE = 20; // default size for dirQueue and fileQueue
var MAX_RETRIES = 2; // number of times to retry failed put operations

var s3 = new aws.S3();

module.exports = function put(dir, bucket, destPath, filterFn, options, cb) {
  if (options.exclude) {
    options.exclude = new RegExp(options.exclude);
  }
  if (options.directoryExclude) {
    options.directoryExclude = new RegExp(options.directoryExclude);
  }

  var report = {
    bytes: 0,
    numErrors: 0,
    numFiles: 0
  };

  var limit = options.limit || QUEUE_SIZE;
  var fileQueue = async.queue(putFile, limit);
  var dirQueue = async.queue(readDir, limit);

  dirQueue.drain = function () {
    if (fileQueue.idle()) {
      cb(null, report);
    }
  };

  fileQueue.drain = function () {
    if (dirQueue.idle()) {
      cb(null, report);
    }
  };

  function readDir(dir, cb) {
    if (options.directoryExclude && options.directoryExclude.test(dir)) {
      if (options.verbose) {
        console.log('Excluding directory', dir);
      }
      return setImmediate(cb);
    }

    fs.readdir(dir, function (err, files) {
      files = files || [];
      async.each(files, function (file, cb) {
        var filePath = path.join(dir, file);
        fileQueue.push({filePath: filePath, retries: 0}, cb);
      }, cb);
    });
  }

  function putFile(item, cb) {
    fs.lstat(item.filePath, function (err, stat) {
      if (err) {
        console.error('error stat-ing file', item.filePath);
        return cb();
      }

      if (stat.isDirectory()) {
        dirQueue.push(item.filePath);
        cb();
      } else {
        makeFileEntry(item.filePath, stat, function (err, entry) {
          if (err) {
            console.error('Error creating file entry - ', err);
            return cb();
          }

          entry.retries = item.retries;
          putEntry(entry, cb);
        });
      }
    });
  }

  function putEntry(entry, cb) {
    var key = path.join(destPath, entry.relativePath);
    var metadata = makeMetadata(entry);
    var params = {Bucket: bucket, Key: key, Metadata: metadata, ContentType: metadata['Content-Type']};
    var cbCalled = false;

    var finishedCb = function (err) {
      if (err) {
        if (entry.retries < MAX_RETRIES) {
          console.error('Error uploading', entry.relativePath, err, 'will retry', MAX_RETRIES - entry.retries, 'more times');
          entry.retries += 1;
          return fileQueue.push({filePath: entry.relativePath, retries: entry.retries}, cb);
        }

        console.error('Erroring uploading', entry.relativePath, err);
        report.numErrors += 1;
        // continue on error
      } else {
        report.numFiles += 1;
        report.bytes += entry.stat.size;

        if (options.verbose) {
          console.log('Finished uploading', type, entry.relativePath, '(' + entry.stat.size + ' bytes)');
        }
      }

      if (!cbCalled) {
        // We could error out twice putting the same file, once on the
        // 'error' event of the fs read stream, and again on
        // s3.putObject.  We only want to call the cb once.
        cbCalled = true;
        cb();
      }
    };

    if (options.exclude && options.exclude.test(entry.relativePath)) {
      if (options.verbose) {
        console.log('Excluding file', entry.relativePath);
      }
      return process.nextTick(cb);
    }

    if (!filterFn(entry)) {
      return process.nextTick(cb);
    }

    var type = entry.linkPath ? 'symbolic link' : 'file';
    if (options.verbose) {
      console.log('Uploading', type, entry.relativePath, 'to', key, '(' + entry.stat.size, ' bytes)');
    }

    if (entry.linkPath) { // symbolic link
      params.Body = entry.linkPath;
      params.Metadata.mode = LINK_MODE;
    } else { // regular file
      params.Body = fs.createReadStream(entry.absolutePath);
      params.Body.on('error', finishedCb);
    }

    s3.putObject(params, finishedCb);
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

  function makeFileEntry(relativePath, stat, cb) {
    var absolutePath = path.resolve(relativePath);
    if (stat.isFile()) {
      var entry = {
        absolutePath: absolutePath,
        relativePath: relativePath,
        stat: stat
      };
      process.nextTick(function () {
        cb(null, entry);
      });
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

  // kick everything off:
  fs.stat(dir, function (err, stats) {
    if (stats.isFile()) {
      fileQueue.push({filePath: dir, retries: 0});
    } else {
      dirQueue.push(dir);
    }
  });
};
