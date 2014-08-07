'use strict';

var Writable = require('stream').Writable;
var util = require('util');
var aws = require('aws-sdk');
var fs = require('fs');
var path = require('path');
var mime = require('mime');

var s3 = new aws.S3();

var LINK_MODE = '41471'; // magic value that tells S3FS that the file is a symbolic link

function S3PutStream(bucket, destPath, options, report) {
  Writable.call(this, {objectMode: true});

  this.bucket = bucket;
  this.destPath = destPath;
  this.options = options;
  this.report = report;
}
util.inherits(S3PutStream, Writable);

S3PutStream.prototype._write = function (entry, encoding, cb) {
  putFile(this.bucket, this.destPath, this.options, this.report, entry, cb);
};

function putFile(bucket, destPath, options, report, entry, cb) {
  console.log('destPath', destPath, 'rel path', entry.relativePath);
  var key = path.join(destPath, entry.relativePath);
  var metadata = makeMetadata(entry);
  var params = {Bucket: bucket, Key: key, Metadata: metadata, ContentType: metadata['Content-Type']};
  var cbCalled = false;

  if (options.exclude && options.exclude.test(entry.relativePath)) {
    console.log('Excluding file', entry.relativePath);
    return cb();
  }

  var finishedCb = function (err) {
    if (err) {
      report.numErrors += 1;
      console.error('Erroring uploading', entry.relativePath, err);
      // continue on error
    } else {
      report.numFiles += 1;
      report.bytes += entry.stat.size;
      if (options.verbose) {
        console.log('Finishing uploading', type, entry.relativePath, '(' + entry.stat.size, 'bytes)');
      }
    }

    if (!cbCalled) {
      // We could error out twice putting the same file, once on the
      // 'error' event of the fs read stream, and again on
      // s3.putObject.  We only want to call the cb once.
      cbCalled = true;
      setTimeout(cb, 2000);
      // cb();
    }
  };

  var type = entry.linkPath ? 'symbolic link' : 'file';
  if (options.verbose) {
    console.log('Uploading', type, entry.relativePath, 'to', key, '(' + entry.stat.size, 'bytes)');
  }

  if (entry.linkPath) { // symbolic link
    params.Body = entry.linkPath;
    params.Metadata.mode = LINK_MODE;
  } else { // regular file
    params.Body = fs.createReadStream(entry.absolutePath);
    params.Body.on('error', function (err) {
      console.error('Error reading stream for file', entry.absolutePath);
      cb();
    });
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

module.exports = S3PutStream;
