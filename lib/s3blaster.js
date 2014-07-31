'use strict';

/**
   API function for interacting with S3
*/

var fs = require('fs');
var path = require('path');
var async = require('async');
var aws = require('aws-sdk');
var mime = require('mime');
var mkdirp = require('mkdirp');
var _ = require('lodash');
var local = require('./local');
var stream = require('stream');

var ASYNC_LIMIT = 100; // maximum number of files to process concurrently
var LINK_MODE = '41471'; // magic value that tells S3FS that the file is a symbolic link

var s3 = new aws.S3();
var queue = async.queue(putFile, ASYNC_LIMIT);

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
  var params = {Bucket: bucket, Key: key, Metadata: metadata, ContentType: metadata['Content-Type']};

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
  };

  s3.putObject(params, finishedCb);
}

function put(srcDir, bucket, destPath, options, cb) {
  if (!cb) {
    cb = options;
    options = {};
  }
  if (!cb) {
    cb = destPath;
    destPath = '';
  }

  var putFn = putFile.bind(null, bucket, destPath, options);

  fs.stat(srcDir, function (err, stat) {
    if (err) return cb(err);

    if (stat.isDirectory()) {
      local.list(srcDir, function (err, entries) {
        if (err) return cb(err);
        async.forEachLimit(entries, ASYNC_LIMIT, putFn, cb);
      });
    } else { // put single file
      var relativePath = srcDir;
      console.log('Uploading', relativePath);
      var absolutePath = path.resolve(relativePath);
      local.makeFileEntry(absolutePath, relativePath, stat, function (err, entry) {
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
  if (!cb) {
    cb = options;
    options = {};
  }

  fileExists(bucket, key, function (err, exists) {
    if (err) return cb(err);

    if (exists) {
      // if this exact file exists, get it and we're done:
      getFile(bucket, options, localPath, key, cb);
    } else {
      var getFn = getFile.bind(null, bucket, options, localPath);
      var walkOpts = {prefix: key};
      walkBucket(bucket, getFn, walkOpts, cb);
    }
  });
}

function del(bucket, key, options, cb) {
  if (!cb) {
    cb = options;
    options = {};
  }
  if (!cb) {
    cb = key;
    key = '';
  }

  var listParams = {
    Bucket: bucket,
    Prefix: key
  };
  if (options.marker) {
    listParams.Marker = options.marker;
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
function list(bucket, prefix, options, out) {
  if (!out) {
    out = new stream.PassThrough({objectMode: true});
  }
  if (!options) {
    options = {};
  }

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

  s3.listObjects(params, function (err, data) {
    if (err) {
      return out.emit('error', err);
    }

    data.CommonPrefixes.forEach(function (item) {
      var entry = {type: 'directory', name: item.Prefix};
      out.write(entry);
    });

    data.Contents.forEach(function (item) {
      var entry = {type: 'file', lastModified: item.LastModified, size: item.Size, name: item.Key};
      out.write(entry);
    });

    if (data.IsTruncated) {
      options.marker = data.NextMarker;
      list(bucket, prefix, options, out);
    } else {
      out.end();
    }
  });

  return out;
}

function copy(srcBucket, srcPrefix, dstBucket, dstPrefix, options, cb) {
  if (!options) {
    cb = options;
    options = {};
  }

  var total = 0;
  function copyFile(key, destKey, cb) {
    if (!cb) {
      cb = destKey;
      destKey = null;
    }


    if (!destKey) {
      if (dstPrefix) {
        destKey = dstPrefix + '/' + key.substr(srcPrefix.length + 1);
      } else {
        destKey = key;
      }
    }

    var copySource = srcBucket + '/' + key; // TODO URL encode?
    var params = {CopySource: copySource, MetadataDirective: 'COPY', Bucket: dstBucket, Key: destKey};

    if (options.verbose) {
      console.log('Copying from', key, 'to', destKey);
    }

    s3.copyObject(params, function (err) {
      if (err) return cb(err);
      total += 1;
      cb(null, total);
    });
  }

  fileExists(srcBucket, srcPrefix, function (err, exists) {
    if (err) return cb(err);

    if (exists) {
      // if this exact file exists, copy it to destination and we're done:
      copyFile(srcPrefix, dstPrefix, cb);
    } else {
      var walkOpts = {prefix: srcPrefix};
      walkBucket(srcBucket, copyFile, walkOpts, function (err) {
        if (err) return cb(err);
        cb(null, total);
      });
    }
  });
}

function fixLinks(srcDir, bucket, options, cb) {
  var filterFn = function (entry) {
    return entry.linkPath;
  };

  filteredPut(srcDir, bucket, filterFn, options, cb);
}

function putLatest(srcDir, bucket, lastModified, options, cb) {
  var filterFn = function (entry) {
    return lastModified < entry.stat.mtime;
  };

  filteredPut(srcDir, bucket, filterFn, options, cb);
}

function filteredPut(srcDir, bucket, filterFn, options, cb) {
  if (!cb) {
    cb = options;
    options = {};
  }

  local.list(srcDir, function (err, entries) {
    if (err) return cb(err);

    var linkEntries = entries.filter(filterFn);
    var putFn = putFile.bind(null, bucket, '', options);
    async.forEachLimit(entries, ASYNC_LIMIT, putFn, cb);
  });
}

module.exports = {
  list: list,
  put: put,
  get: get,
  del: del,
  copy: copy,
  fixLinks: fixLinks,
  putLatest: putLatest
};
