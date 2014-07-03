# s3blaster Blast files in and out of S3

## Usage

s3blaster [options] OPERATION [parameters]

### OPERATIONS
 - PUT LOCAL_FOLDER BUCKET [DESTINATION_FOLDER]: Recursively put local files and directories into S3. DESTINATION_FOLDER is optional

### Examples
```shell
s3blaster -v PUT folder s3bucket s3folder
```
Recursively put all files and folders in local folder to s3bucket in s3folder, in verbose mode.

```
Options:
  -h, --help     display this help message
  -v, --verbose  verbose mode
  -d, --dry-run  print log messages but do not actually put or get from S3
```
