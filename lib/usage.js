module.exports = {
  synopsis: 's3blaster OPERATION parameters [options]',
  description: 'Set the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables\nbefore running, to provide the AWS credentials.',
  operations: {
    PUT: {
      required: ['local_folder', 'bucket'],
      optional: ['key'],
      description: 'Recursively put local files and directories into S3 at key (folder or file).'
    },
    GET: {
      required: ['bucket', 'key'],
      optional: ['local_folder'],
      description: 'Recursively get folder and/or file from S3 and place in destination folder (defaults to current directory).'
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
    },
    COPY: {
      required: ['source-bucket', 'source-prefix', 'destination-bucket'],
      optional: ['destination-prefix'],
      description: 'Copy all objects in S3 in source bucket starting with prefix to destination bucket'
    },
    PUT_LINKS: {
      required: ['source-dir', 'bucket'],
      optional: [],
      description: 'Fix links in source directory to S3.'
    },
    PUT_LATEST: {
      required: ['source-dir', 'bucket', 'last-modified'],
      optional: [],
      description: 'Put all files from source dir modifed after last-modified to S3.'
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
    },
    e: {
      describe: 'exclude files matching regular expcession',
      alias: 'exclude',
      type: 'string'
    },
    limit: {
      describe: 'number of files to process concurrently. Higher values are faster but may cause timeouts or memory problems.',
      'default': 50
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
    ],
    [
      's3blaster COPY staging-bucket folder/ prod-bucket',
      'Recursively copy all files in staging-bucket/folder to prod-bucket.'
    ]
  ]
};
