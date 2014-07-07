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

- GET

```GET {bucket} {S3 key} [destination folder}```

Recursively get folder and/or file from S3 and place in destination folder (defaults to current directory).

## Examples

```shell
s3blaster -v PUT folder s3bucket s3folder
```

Recursively put all files and folders in ```./local_folder``` to ```s3bucket``` in ```s3folder```, in verbose mode.

```shell
s3bucket GET s3bucket s3folder ./local_folder
```

Recursively get contents of ```s3folder``` from ```s3bucket```, and place in local directory ```./local_folder```.

## Options
```
  -h, --help     display this help message
  -v, --verbose  verbose mode
  -d, --dryrun   print log messages but do not actually put or get from S3
```
