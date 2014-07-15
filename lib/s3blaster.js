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

function listLocal(dir, results, cb) {
  if (!cb) {
    cb = results;
    results = [];
  }
  doListLocal('.', dir, results, cb);
}

function doListLocal(startDir, dir, results, cb) {
  fs.readdir(dir, function (err, files) {
    if (err) return cb(err);

    async.forEach(files, function (file, cb) {
      var absolutePath = path.resolve(dir, file);
      var relativePath = path.join(startDir, file);

      fs.lstat(absolutePath, function (err, stat) {
        if (stat.isDirectory()) {
          var newDir = path.join(dir, file);
          var newStartDir = path.join(startDir, file);
          doListLocal(newStartDir, newDir, results, cb);
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

function putFile(bucket, destPath, options, entry, cb) {
  var key = path.join(destPath, entry.relativePath);
  var metadata = makeMetadata(entry);
  var params = {Bucket: bucket, Key: key, Metadata: metadata};

  var type = entry.linkPath ? 'symbolic link' : 'file';
  if (options.verbose) {
    console.log('Uploading', type, entry.relativePath, 'to', key);
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

    if (options.verbose) {
      console.log('Finishing uploading', type, entry.relativePath);
    }
    cb();
  }

  if (!options.dryrun) {
    s3.putObject(params, finishedCb);
  } else {
    process.nextTick(finishedCb);
  }
}

function put(srcDir, bucket, destPath, options, cb) {
  var putFn = putFile.bind(null, bucket, destPath, options);

  fs.stat(srcDir, function (err, stat) {
    if (err) return cb(err);

    if (stat.isDirectory()) {
      listLocal(srcDir, function (err, entries) {
        if (err) return cb(err);

        console.log('Uploading', entries.length, 'files....');
        if (options.dryrun) {
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

// Test to see if object with exact key exists
function fileExists(bucket, key, cb) {
  var params = {
    Bucket: bucket,
    Key: key
  };
  console.log('params', params);
  s3.headObject(params, function (err, data) {
    console.log('head result:', err, data);
    if (err) {
      if (err.statusCode === 404) {
        return cb(null, false);
      }
      return cb(err);
    }
    cb(null, true);
  });
}

function get(bucket, key, localPath, options, cb) {
  fileExists(bucket, key, function (err, exists) {
    if (err) return cb(err);

    if (exists) {
      // if this exact file exists, get it and we're done:
      console.log('it exists!');
      //cb();
      getFile(bucket, key, localPath, options, cb);
    } else {
      // it's either a folder, or not found:
      var params = {
        Bucket: bucket,
        Delimiter: '/',
        Prefix: key
      };
      s3.listObjects(params, function (err, data) {
        if (err) return cb(err);
        console.log('data', data);
        cb();
      });
    }
  });
}

function getFile(bucket, key, options, cb) {
  var destPath = path.resolve(localPath);
  var file = fs.createWriteStream(destPath);
  file.on('error', cb);
  var params = {
    Bucket: bucket,
    Key: key
  };
  var file = require('fs').createWriteStream(destPath);
  var req = s3.getObject(params);

  req.on('httpData', function (chunk) {
    console.log('data:', chunk.toString());
    file.write(chunk);
  });
  req.on('httpDone', function (res) {
    console.log('da done!');
    file.end();
    cb(res.error);
  });

  req.send();
}

/**
 List objects in S3 bucket starting with prefix, or all if no prefix.
*/
function list(bucket, prefix, options, cb) {
  var params = {
    Bucket: bucket,
    Delimiter: '/'
  };
  if (prefix) {
    params.Prefix = prefix;
  }

  console.log('listing');
  s3.listObjects(params, function (err, data) {
    if (err) return cb(err);

    var dirs = data.CommonPrefixes.map(function (item) {
      return ['', 'DIR', item.Prefix];
    };

    var files = data.Contents.map(function (item) {

    });
  });
}

module.exports = {
  listLocal: listLocal,
  list: list,
  put: put,
  get: get
};
