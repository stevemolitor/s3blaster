module.exports = {
  synopsis: 's3blaster OPERATION parameters [options]',
  description: 'Set the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables\nbefore running, to provide the AWS credentials.',
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
    h: {
      describe: 'display this help message',
      alias: 'help',
      type: 'boolean'
    },
    v: {
      describe: 'verbose mode',
      alias: 'verbose'
    }
  },
  examples: [
    [
      's3blaster -v PUT folder bucket key',
      'Recursively put all files and folders in local folder to s3 bucket / key, in verbose mode.'
    ],
    [
      's3blaster GET bucket key folder',
      'Recursively get all files and folders from S3 starting with key saving to local folder.'
    ],
    [
      's3blaster LIST bucket folder1/folder2',
      "List top level objects starting with prefix 'folder1/folder2'."
    ],
    [
      's3blaster DELETE bucket folder1/folder2',
      "Delete all objects starting with prefix 'folder1/folder2'."
    ]
  ]
};
