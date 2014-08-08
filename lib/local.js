'use strict';

/**
   Local file system utility functions
*/

var async = require('async');
var fs = require('fs');
var path = require('path');

var WALK_QUEUE_LIMIT = 1000;

var s3Queue;
var walkQueue = async.queue(walkDir, WALK_QUEUE_LIMIT);

function walk(dir, queue, cb) {
  s3Queue = queue;
  walkQueue.drain = function () {
    cb();
  };

  walkQueue.push(dir);
}

function walkDir(dir, cb) {
  fs.readdir(dir, function (err, files) {
    if (err) return cb(err);

    files.forEach(function (file) {
      var filePath = path.join(dir, file);
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

// function walkDir(cmd, topCb) {
//   console.log('1');
//   fs.readdir(cmd.subDir, function (err, files) {
//     console.log('2:', err);
//     if (err) return topCb(err);

//     async.forEach(function (file, asyncIterCb) {
//       var absolutePath = path.resolve(cmd.subDir, file);
//       var relativePath = path.join(cmd.subDir, file);

//       console.log('lstating', absolutePath);
//       fs.lstat(absolutePath, function (err, stat) {
//         console.log('lstat err:', err);

//         if (err) {
//           console.error('Error stat-ing', absolutePath, '-', err);
//           return asyncIterCb(); // continue to next file on error
//         }

//         if (stat.isDirectory()) {
//           var newCmd = {
//             startDir: path.join(cmd.startDir, file),
//             subDir: path.join(cmd.subDir, file)
//           };
//           console.log('pushing', newCmd);
//           walkQueue.push(newCmd);
//         //  asyncIterCb();
//         } else {
//           makeFileEntry(absolutePath, relativePath, stat, function (err, entry) {
//             if (err) return topCb(err);
//             console.log('pushing file entry');
//             s3Queue.push(entry);
//       //      asyncIterCb();
//           });
//         }
//       });
//     }, function (err) {
//       console.log('async loop done for', cmd.subDir);
//       topCb();
//     });
//   });
// }

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
