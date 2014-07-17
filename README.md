# s3blaster

Blast files in and out of S3

## Usage

```shell
s3blaster [options] OPERATION [parameters]
```

You have to set the ```AWS_ACCESS_KEY_ID``` and ```AWS_SECRET_ACCESS_KEY``` environment variables
first, to provide the AWS credentials.

## Operations

- PUT

```PUT {local folder} {s3bucket} [destination folder]```

Recursively put local files and directories into S3. Destination folder is optional.

- GET

```GET {s3bucket} {S3 key} [destination folder}```

Recursively get folder and/or file from S3 and place in destination folder (defaults to current directory).

- LIST

```LIST {s3bucket} [prefix]```

List objects in S3 bucket starting with prefix, or all objects if no prefix.

- DELETE

```DELETE {s3bucket} [prefix]```

Delete all objects in S3 bucket starting with prefix, or all objects if no prefix.

## Examples

```shell
s3blaster -v PUT folder s3bucket s3folder
```

Recursively put all files and folders in ```./local_folder``` to ```s3bucket``` in ```s3folder```, in verbose mode.

```shell
s3bucket GET s3bucket s3folder ./local_folder
```

Recursively get contents of ```s3folder``` from ```s3bucket```, and place in local directory ```./local_folder```.

```shell
s3blaster LIST s3bucket folder1/folder2
```

List top level objects starting with prefix 'folder1/folder2'.

```shell
3blaster DELETE s3bucket folder1/folder2
```

Delete all objects starting with prefix folder1/folder2.

## Options
```
  -h, --help     display this help message
  -v, --verbose  verbose mode
  -d, --dryrun   print log messages but do not actually put or get from S3
```
