'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var aws = require('aws-sdk');
var mime = require('mime');
var mkdirp = require('mkdirp');
var moment = require('moment');
var sprintf = require('sprintf-js').sprintf;
var _ = require('lodash');

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
  s3.headObject(params, function (err, data) {
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
      getFile(bucket, key, localPath, options, cb);
    } else {
      var getFn = getFile.bind(null, bucket, options, localPath);
      var walkOpts = {prefix: key};
      walkBucket(bucket, getFn, walkOpts, cb);
    }
  });
}

function del(bucket, key, options, cb) {
  var listParams = {
    Bucket: bucket,
    Prefix: key
  };
  if (options.marker) {
    params.Marker = options.marker;
  }

  var total = 0 + (options.total || 0);

  s3.listObjects(listParams, function (err, data) {
    if (err) return cb(err);
    if (data.Contents.length === 0) return cb(null, 0);

    var objects = data.Contents.map(function (item) {
      return { Key: item.Key };
    });
    var deleteParams = {
      Bucket: bucket,
      Delete: { Objects: objects }
    };

    s3.deleteObjects(deleteParams, function (err, results) {
      if (err) return cb(err);
      total += results.Deleted.length;

      if (data.IsTruncated) {
        options.marker = data.NextMarker;
        options.total = total;
        del(bucket, key, options, cb);
      } else {
        cb(null, total);
      }
    });
  });
}

function getFile(bucket, options, localPath, key, cb) {
  var destPath = path.resolve(localPath, key);
  var dir = path.resolve(localPath, path.dirname(key));

  mkdirp(dir, function (err) {
    if (err) return cb(err);

    var file = fs.createWriteStream(destPath);
    file.on('error', cb);
    var params = {
      Bucket: bucket,
      Key: key
    };

    var file = require('fs').createWriteStream(destPath);
    var req = s3.getObject(params);

    req.on('httpData', function (chunk) {
      file.write(chunk);
    });
    req.on('httpDone', function (res) {
      file.end();
      cb(res.error);
    });

    req.send();
  });
}

function walkBucket(bucket, iterator, options, cb) {
  var params = { Bucket: bucket };
  if (options.prefix) {
    params.Prefix = options.prefix;
  }
  if (options.marker) {
    params.Marker = marker;
  }

  s3.listObjects(params, function (err, data) {
    if (err) return cb(err);

    var keys = _.pluck(data.Contents, 'Key');
    async.forEachLimit(keys, ASYNC_LIMIT, iterator, function (err) {
      if (err) return cb(err);
      if (data.IsTruncated) {
        var nextOptions = _.clone(options);
        nextOptions.marker = _.last(keys);
        walkBucket(buckter, iterator, nextOptions, cb);
      } else {
        cb();
      }
    });
  });
}

/**
   List objects in S3 bucket starting with prefix, or all if no prefix.
*/
function list(bucket, prefix, options, out, cb) {
  var params = {
    Bucket: bucket,
    Delimiter: '/'
  };
  if (prefix) {
    params.Prefix = prefix;
  }
  if (options.marker) {
    params.Marker = options.marker;
  }

  var formatStr = '%16s %10s\t%s\n';

  s3.listObjects(params, function (err, data) {
    if (err) return cb(err);

    data.CommonPrefixes.forEach(function (item) {
      var line = sprintf(formatStr, '', 'DIR', item.Prefix);
      out.write(line);
    });

    data.Contents.forEach(function (item) {
      var date = moment(item.LastModified).format('YYYY-MM-DD HH:mm');
      var line = sprintf(formatStr, date, item.Size, item.Key);
      out.write(line);
    });

    if (data.IsTruncated) {
      options.marker = data.NextMarker;
      list(bucket, prefix, options, out, cb);
    } else {
      cb();
    }
  });
}

module.exports = {
  listLocal: listLocal,
  list: list,
  put: put,
  get: get,
  del: del
};
