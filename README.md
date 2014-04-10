# Haze

An in-memory document cache.

## Installation

    npm install haze

## Synopsis

    var haze = require('haze')

    haze.createDocument()
    haze.getDocument()
    haze.updateDocument()
    haze.destroyDocument()
    haze.incrementDocument()
    haze.queryCollection()

    haze.eventEmitter.on("documentCreated", function (collectionName, doc) {})
    haze.eventEmitter.on("documentUpdated", function (collectionName, doc) {})
    haze.eventEmitter.on("documentDestroyed", function (collectionName, doc) {})

## About Documents

Documents are objects with at least the following keys:

- id, a string
- version, a number

An `id` is a UUID (version 4) that is automatically set on document creation.

A `version` is a UNIX epoch timestamp with milliseconds precision.
It represents when the document was most recently modified (or created when
no modifications have been performed).  `version` is set internally when a
document is created, updated, or one of its values is incremented.

## Collections

While a document's `id` is a "universally unique" value, documents are grouped
into logical "collections".  This reduces the search-space for various operations
and is natural enough.

## References

A document may refer to another document (even in another collection) via
a "reference".  A reference is a string value of the form:

    "collectionName:referencedDocumentId"

e.g.

    "Users:0C305E2A-71FF-42F7-A60F-ADEE001AC026"

Referenced documents may be "included" in "getDocument" and "queryCollection"
operations.  The value of the key holding the reference becomes the referenced
document.

When including referenced documents, one may specify a "key path" instead of
a single key.  A key path is a dot/period (.) delimited, ordered list of keys
to include.

Here is an example key path:

    "A.B.C"

This would be processed as follows (pseudocode):

    doc.A     = loadReference(doc.A)
    doc.A.B   = loadReference(doc.A.B)
    doc.A.B.C = loadReference(doc.A.B.C)

## CRUD document operations

### Create

To create a document, use `createDocument`. Do not specify a `id` or `version`
as these are generated.

    haze.createDocument({
      collection: "name",
      doc: { ... }
    })

The return value is:

    { id: string, version: number }

On success, a "documentCreated" event is emitted.

### Retrieve

To retrieve/get/fetch/load a document, use `getDocument`.  Specify the collection
name and the document id.  Optionally specify the keys to treat as references via
the `include` parameter.

    var doc = haze.getDocument({
      collection: "name",
      id: "a UUID",
      include: [ "A", "B.C.D", "E" ]
    })

If the document is not found, an error document is returned. The code 404 is
a nod to HTTP which uses 404 to indicate "Not found".

    { error: "document not found", code: 404 }

If a referenced document is not found, the value will be set to `null`.

### Update

To update/put a document, use `updateDocument`.  Specify the collection name
and the document to be updated.

    haze.updateDocument({
      collection: "name",
      doc: {
        id: "a UUID",
        version: number,
        ...
      }
    })

If the document is not found, an error document is returned. The code 404 is
a nod to HTTP which uses 404 to indicate "Not found".

    { error: "document not found", code: 404 }

The `id` is used to find the document to update in the given collection.
The `version` must match that of the stored document;
one cannot update an outdated document.

If outdated, an error document is returned.  The code 409 is a nod to HTTP
which uses 409 to indicate a "Conflict".

    { error: "version mismatch", code: 409 }

If versions match, a new `version` is set on the inbound doc and the inbound doc
replaces the stored doc entirely. In this case, the return value includes the
new document version.

    { id: string, version: number }

On success, a "documentUpdated" event is emitted.

### Delete

To delete/destroy/remove a document, use `destroyDocument`.  Pass the collection
name and the id and version of the document.

    haze.destroyDocument({
      collection: "name",
      doc: {
        id: "a UUID",
        version: number
      }
    })

As with document updates, versions must match.  The return value is an error
document if the document was not found or versions do not match. Otherwise, the
return value is an empty document:

    {}

On success, a "documentDeleted" event is emitted.

## Error Documents

    { error: string, code: number }

The following a list of all error documents:

    { error: "bad request", code: 400 }

    { error: "document not found", code: 404 }

    { error: "version mismatch", code: 409 }

## Queries on Collections

One may query or filter collections via `queryCollection`.  Matching documents
(and/or the count thereof) will be returned.  One can specify AND or OR
queries, paginate via "skip" and "limit", sort the matching documents by a
key, and include references in the final set of matching documents.

    var results = haze.queryCollection({
      collection: "name",
      where: [
        [ "key", "predicate", value ],
        ...
      ],
      combine: "or",
      skip: number,
      limit: number,
      sort: "-key",
      include: [ "A", "B.C.D", "E" ]
    }).results

### Conditions

Conditions are specified via `where` which takes the form:

    [ condition1, condition2, ..., conditionN ]

A condition takes the form:

    [ "key", "predicate", operand ]

where

- `"key"` is the key of the document to test;
- `"predicate"` is the name of the test to apply; and
- `operand` is the value to test against/with.

### Predicates

`"predicate"` may be one of the following:

- `"eq"`        - doc passes test if its value at `key` equals `operand`
- `"neq"`       - doc passes test if its value at `key` does not equal `operand`
- `"gt"`        - doc passes test if its value at `key` is greater than `operand`
- `"ge"`        - doc passes test if its value at `key` is greater than or equal to `operand`
- `"lt"`        - doc passes test if its value at `key` is less than `operand`
- `"le"`        - doc passes test if its value at `key` is less than or equal to `operand`
- `"in"`        - doc passes test if its value at `key` is a member of the set specified by the array `operand`
- `"nin"`       - doc passes test if its value at `key` is not a member of the set specified by the array `operand`
- `"exists"`    - doc passes test if it has given `key` (`operand` ignored)
- `"nexists"`   - doc passes test if it does not have given `key` (`operand` ignored)
- `"prefix"`    - doc passes test if its value at `key` is string that starts with `operand` (case-sensitive)
- `"contains"`  - doc passes test if its value at `key` is string that contains `operand` (case-sensitive)
- `"suffix"`    - doc passes test if its value at `key` is string that ends with `operand` (case-sensitive)
- `"iprefix"`   - doc passes test if its value at `key` is string that starts with `operand` (case-insensitive)
- `"icontains"` - doc passes test if its value at `key` is string that contains `operand` (case-insensitive)
- `"isuffix"`   - doc passes test if its value at `key` is string that ends with `operand` (case-insensitive)

### Combining result sets

Note that multiple conditions may be specified in `where`.  Each condition
generates a matching set of documents from the collection.  How the multiple
result sets are combined into the final result set is controlled by the
`combine` parameter.

`combine` may be "and" or "or".  The default `combine` is "and".  An "and"
value means that the intersection of result sets is returned.  An "or" value
means the union of result sets is returned.

### Counting

To only count the final number of results, specify `count` with a `true` value.

    var count = haze.queryCollection({
      collection: "Users",
      where: [ [ "name", "eq", "Sally" ] ],
      count: true
    }).count

The returned object takes the form:

    { count: number }

### Sorting

To sort the final result set, specify a `sort` parameter value with the value
`"key"` to sort into ascending order by the value at `key` in each document of
the result set or `"-key"` to sort into descending order.

Only a single level of sorting is provided for now.  That is, you cannot
sort by a second (or third) key should the values of the first (or second)
key be equal in two documents being compared.  Perhaps later...

Sorting only makes sense when `count` is not specified or is `false`.

### Pagination

To include a subset of results, specify `skip` and/or `limit` parameters.
Both of these should be positive integers.

The first `skip` documents of the final result set are dropped.
Then the first `limit` documents of the final result are kept.

Pagination only makes sense when `count` is not specified or is `false`.

### References/Includes

References are only included *after* filtering the collection
but *before* sorting.

## Atomic Increments

One can increment a numeric value of a document via `incrementDocument`.
This does *not* require a matching version to be specified.  Specify the
collection name and document id along with the key to be updated and by
how much.

    haze.incrementDocument({
      collection: "name",
      doc: {
        id: "a UUID",
        key: number
      }
    })

On success, a "documentUpdated" event is emitted.  There's no need
for a separate documentIncremented event as far as I can tell.

## Events

Events are emitted on the exported 'eventEmitter':

- "documentCreated"
- "documentUpdated"
- "documentDestroyed"

All events emitted pass `(collectionName, doc)`

## Environment

Haze was implemented for Node.js but would work in the browser via Browserify.
The only Node.js-specific dependency is the events module which Browserify
provides access to.

## Persistence

Persistence adapters do exist for Haze.  See https://github.com/fictorial

## Author

Brian Hammond <brian@fictorial.com>

## License

MIT

## TODO

- multiple sort keys
- group by? or let clients handle this?


