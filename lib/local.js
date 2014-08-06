'use strict';

/**
 Local file system utility functions
*/

var async = require('async');
var fs = require('fs');
var path = require('path');

function list(dir, results, cb) {
  if (!cb) {
    cb = results;
    results = [];
  }
  doList(dir, dir, results, cb);
}

function doList(startDir, dir, results, cb) {
  fs.readdir(dir, function (err, files) {
    if (err) return cb(err);

    async.forEach(files, function (file, cb) {
      var absolutePath = path.resolve(dir, file);
      var relativePath = path.join(startDir, file);

      fs.lstat(absolutePath, function (err, stat) {
        if (err) {
          console.error('Error stat-ing', absolutePath, '-', err);
          return cb(); // continue to next file on error
        }

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

module.exports = {
  list: list,
  makeFileEntry: makeFileEntry
};
