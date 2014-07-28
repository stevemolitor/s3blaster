var USAGE =
    's3blaster OPERATION [parameters] [options]\n' +
    '\n' +
    'Operations:\n' +
    '  PUT {local folder} {bucket} [destination folder]:\n' +
    '    recursively put local files and directories into S3. Destination folder is optional.\n' +
    '  GET {s3bucket} {s3key} [local folder]:\n' +
    '    recursively get folder and/or file from S3 and place in destination folder (defaults to current directory).\n' +
    '  LIST {s3bucket} [prefix]:\n' +
    '    List objects in S3 bucket starting with prefix, or all objects if no prefix.\n' +
    '  DELETE {s3bucket} [prefix]:\n' +
    '    Delete all objects in S3 bucket starting with prefix, or all objects if no prefix.\n';

module.exports = {
  synopsis: 's3blaster OPERATION parameters [options]',
  operations: {
    PUT: {
      required: ['local_folder', 'bucket'],
      optional: ['destination_folder'],
      description: 'recursively put local files and directories into S3. Destination folder is optional.'
    },
    GET: {
      required: ['bucket', 'key'],
      optional: ['local_folder'],
      description: 'recursively get folder and/or file from S3 and place in destination folder (defaults to current directory).'
    },
    LIST: {
      required: ['bucket'],
      optional: ['prefix'],
      description: 'List objects in S3 bucket starting with prefix, or all objects if no prefix.'
    },
    DELETE: {
      required: ['bucket'],
      optional: ['prefix'],
      description: 'Delete all objects in S3 bucket starting with prefix, or all objects if no prefix.'
    }
  },
  options: {
    help: {
      describe: 'display this help message',
      alias: 'h',
      type: 'boolean'
    },
    verbose: {
      describe: 'verbose mode',
      alias: 'v'
    },
    dryrun: {
      describe: 'print log messages but do not actually put or get from S3',
      alias: 'd'
    }
  },
  examples: [
    [
      's3blaster -v PUT folder s3bucket s3folder',
      'Recursively put all files and folders in local folder to s3bucket in s3folder, in verbose mode.'
    ],
    [
      's3blaster LIST s3bucket folder1/folder2',
      "List top level objects starting with prefix 'folder1/folder2'."
    ],
    [
      's3blaster DELETE s3bucket folder1/folder2',
      "Delete all objects starting with prefix 'folder1/folder2'."
    ]
  ]
};
