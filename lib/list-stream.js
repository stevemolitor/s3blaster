'use strict';

var moment = require('moment');
var sprintf = require('sprintf-js').sprintf;
var through = require('through2');

var FORMAT = '%16s %10s\t%s\n';

/**
   Transform stream that formats list entries for listing on command line.
*/
function listStream() {
  return through.obj(function (item, encoding, cb) {
    this.push(formatLine(item));
    cb();
  });
}

function formatLine(item) {
  if (item.type === 'directory') {
    return sprintf(FORMAT, '', 'DIR', item.name);
  } else {
    var date = moment(item.lastModified).format('YYYY-MM-DD HH:mm');
    return sprintf(FORMAT, date, item.size, item.name);
  }
}

module.exports = listStream;
