'use strict';

/**
   Local file system utility functions
*/

var async = require('async');
var fs = require('fs');
var path = require('path');

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

  var walkQueue = async.queue(walkDir, options.dirlimit);
  walkQueue.drain = cb;
  walkQueue.push(dir);
}

function makeFileEntry(relativePath, stat, cb) {
  if (stat.isFile()) {
    var entry = {
      relativePath: relativePath,
      stat: stat,
      retryCount: 0
    };
    cb(null, entry);
  } else if (stat.isSymbolicLink()) {
    fs.readlink(relativePath, function (err, linkPath) {
      if (err) return cb(err);
      var entry = {
        relativePath: relativePath,
        linkPath: linkPath,
        stat: stat,
        retryCount: 0
      };
      cb(null, entry);
    });
  }
}

module.exports = {
  walk: walk,
  makeFileEntry: makeFileEntry
};
