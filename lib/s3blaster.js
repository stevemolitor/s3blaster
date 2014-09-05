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
var stream = require('stream');
var http = require('http');
var https = require('https');
var put = require('./put');

var ASYNC_LIMIT = 20; // maximum number of files to process concurrently
var LINK_MODE = '41471'; // magic value that tells S3FS that the file is a symbolic link

var s3 = new aws.S3();

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
    params.Marker = options.marker;
  }

  s3.listObjects(params, function (err, data) {
    if (err) return cb(err);

    var keys = _.pluck(data.Contents, 'Key');
    async.forEachLimit(keys, options.limit || ASYNC_LIMIT, iterator, function (err) {
      if (err) return cb(err);
      if (data.IsTruncated) {
        var nextOptions = _.clone(options);
        nextOptions.marker = _.last(keys);
        walkBucket(bucket, iterator, nextOptions, cb);
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

module.exports = {
  list: list,
  get: get,
  del: del,
  copy: copy,
  put: put
};
