'use strict';

/**
   Local file system utility functions
*/

var async = require('async');
var fs = require('fs');
var path = require('path');

var WALK_QUEUE_LIMIT = 1000;

function walk(dir, s3Queue, options, cb) {
  function walkDir(dir, cb) {
    if (options.verbose) {
      console.log('Reading directory', dir);
    }

    fs.readdir(dir, function (err, files) {
      if (err) return cb(err);

      files.forEach(function (file) {
        var filePath = path.join(dir, file);

        if (options && options.exclude && options.exclude.test(filePath)) {
          console.log('Excluding', filePath);
          return;
        }

        fs.lstat(filePath, function (err, stat) {
          if (err) {
            return console.error('error stat-ing file', filePath);
          }
          if (stat.isDirectory()) {
            walkQueue.push(filePath);
          } else {
            makeFileEntry(filePath, stat, function (err, entry) {
              if (err) {
                return console.error('error making file entry for path', filePath, '-', err);
              }
              s3Queue.push(entry);
            });
          }
        });
      });
      cb();
    });
  }

  var walkQueue = async.queue(walkDir, WALK_QUEUE_LIMIT);
  walkQueue.drain = cb;
  walkQueue.push(dir);
}

function makeFileEntry(relativePath, stat, cb) {
  var absolutePath = path.resolve(relativePath);
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
  walk: walk,
  makeFileEntry: makeFileEntry
};
