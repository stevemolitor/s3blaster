# s3blaster

Blast files in and out of S3

## Usage

```<%= usage.synopsis %>```

<%= usage.description %>

## Operations
<% _.forIn(usage.operations, function (cfg, op) { %>
<% var args = cfg.required.join(' ') + ' ' + cfg.optional.join(' '); %>
* <%= op %>

```<%= op %> <%= args %>```

<%= cfg.description %>
<% }); %>

## Examples
<% _.forEach(usage.examples, function (ex) { %>
* ```<%= ex[0] %>```

<%= ex[1] %>
<% }); %>

### Options
<% _.forIn(usage.options, function (op, short) { %>
```--<%= short %>, --<%= op.alias %>```
<%= op.describe %>
<% }); %>
