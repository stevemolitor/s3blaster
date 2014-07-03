# s3blaster

Blast files in and out of S3

## Usage

```shell
s3blaster [options] OPERATION [parameters]
```

## Operations

- PUT

```PUT {local folder} {bucket} [destination folder]```

Recursively put local files and directories into S3. Destination folder is optional.

## Examples

```shell
s3blaster -v PUT folder s3bucket s3folder
```

Recursively put all files and folders in local folder to s3bucket in s3folder, in verbose mode.

## Options
```
  -h, --help     display this help message
  -v, --verbose  verbose mode
  -d, --dryrun   print log messages but do not actually put or get from S3
```
