# Regex filter

Add `~` operator for regex case sensitive filters

## Basic usage

Case sensitive regex

```js
map.setFilter('layer', ['~', ['get', 'string_property'], 'your_regexp'])
```

[Full example](../test/debug-pages/regex-filter.html)

## TODO

Add more operators for working with regex:
- `~*` - matched with case insensitive option
- `!~` - not matched
- `!~*` - not matched with case insensitive option