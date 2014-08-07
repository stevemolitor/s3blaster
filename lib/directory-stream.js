'use strict';

var async = require('async');
var fs = require('fs');
var path = require('path');
var Readable = require('stream').Readable;
var util = require('util');

function DirectoryStream(dir) {
  Readable.call(this, {objectMode: true});

  this.startDir = dir;
  this.dirBuffer = [dir];
  this.fileBuffer = [];
}
util.inherits(DirectoryStream, Readable);

DirectoryStream.prototype._read = function () {
  var self = this;

  // If we have something in the file buffer, push that and return:
  if (self.started && self.fileBuffer.length > 0) {
    return self.pushNext();
  }

  // If we have nothing in the file buffer and nothing the directory buffer,
  // we're done:
  if (self.started && self.dirBuffer.length === 0) {
    return self.push(null); // pushing null signals that this stream is empty
  }

  // Process the next directory:
  var nextDir = self.dirBuffer.pop();
  fs.readdir(nextDir, function (err, files) {
    if (err) return self.emit('error', err);

    async.forEach(files, function (file, cb) {
      var absolutePath = path.join(nextDir, file);
      var relativePath = path.join(nextDir, file);
      fs.lstat(absolutePath, function (err, stats) {
        if (err) return cb(err);

        if (stats.isDirectory()) {
          self.dirBuffer.push(relativePath);
          cb();
        } else {
          makeFileEntry(absolutePath, relativePath, stats, function (err, entry) {
            if (err) return cb(err);
            self.fileBuffer.push(entry);
            cb();
          });
        }
      });
    }, function (err) {
      if (err) return self.emit('error', err);
      self.started = true;
      self._read();
    });
  });
};

DirectoryStream.prototype.pushNext = function () {
  this.push(this.fileBuffer.pop() || null);
};

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

module.exports = DirectoryStream;
