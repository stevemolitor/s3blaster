module.exports = {
  synopsis: 's3blaster OPERATION parameters [options]',
  operations: {
    PUT: {
      required: ['local_folder', 'bucket'],
      optional: ['key'],
      description: 'recursively put local files and directories into S3 at key (folder or file).'
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
      's3blaster -v PUT local_folder my-s3-bucket my-s3-key',
      'Recursively put all files and folders in local_folder to my-s3-bucket / my-s3-key (file or folder), in verbose mode.'
    ],
    [
      's3blaster GET my-s3-bucket my-s3-key local_folder',
      'Recursively get all files and folders from S3 at my-s3-key (folder or file) to local_folder.'
    ]
    [
      's3blaster LIST my-s3-bucket folder1/folder2',
      "List top level objects starting with prefix 'folder1/folder2'."
    ],
    [
      's3blaster DELETE my-s3-bucket folder1/folder2',
      "Delete all objects starting with prefix 'folder1/folder2'."
    ]
  ]
};