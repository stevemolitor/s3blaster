# s3blaster

Blast files in and out of S3

## Usage

```s3blaster OPERATION parameters [options]```

Set the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables
before running, to provide the AWS credentials.

## Operations


* PUT

```PUT local_folder bucket key```

Recursively put local files and directories into S3 at key (folder or file).


* GET

```GET bucket key local_folder```

Recursively get folder and/or file from S3 and place in destination folder (defaults to current directory).


* LIST

```LIST bucket prefix```

List objects in S3 bucket starting with prefix, or all objects if no prefix.


* DELETE

```DELETE bucket prefix```

Delete all objects in S3 bucket starting with prefix, or all objects if no prefix.


## Examples

### ```s3blaster -v PUT folder bucket key```

Recursively put all files and folders in local folder to s3 bucket / key, in verbose mode.

### ```s3blaster GET bucket key folder```

Recursively get all files and folders from S3 starting with key saving to local folder.

### ```s3blaster LIST bucket folder1/folder2```

List top level objects starting with prefix 'folder1/folder2'.

### ```s3blaster DELETE bucket folder1/folder2```

Delete all objects starting with prefix 'folder1/folder2'.


### Options

```--h, --help```
display this help message

```--v, --verbose```
verbose mode

