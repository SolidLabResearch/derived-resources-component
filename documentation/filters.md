# Available filter implementations

Below is a list of all filter types supported in this repository.

## SPARQL

Loads all selected data into memory and performs a SPARQL query on that dataset.
The SPARQL query is expected to be a CONSTRUCT query.

## SHACL

Loads all selected data into memory and validates it using a SHACL shape.
To generate quads, we first extract all focus nodes that matched the shape.
For each focus node, a path is determined, starting with that node as subject,
using the `sh:property`/`sh:path` predicates.
The `sh:node` predicate is also used to continue the path.

Only text/turtle SHACL shapes are supported at the moment.
Don't use JSON-LD.

## Quad Pattern Index

Generates an index of the selected data,
returning a stream of quads that indicate in which resources matches for the given pattern can be found,
grouped by the selected field.
This is done in a streaming fashion, the data never gets fully loaded into memory.

The pattern needs to be represented as a JSON object with up to 4 fields,
representing the possible positions in a quad (subject/predicate/object/graph).
Each of those fields, if present, needs to contain a valid RDF.js term,
which means having a `termType` and `value` field in there.
One of the fields needs to contain a `Variable`,
this is the field that will be used to group the results by.

## Quad Pattern Fragments

This will add the necessary metadata to the response stream so the resources is recognized as a QPF endpoint.
The fragment can be selected using the s/p/o/g query parameters.
The result is streaming and returns all results in a single page.
Due to streaming the data the exact size can't be determined,
so we always return 1 million as value.
To work around this issue,
a set amount of triples will from the stream will be loaded into memory before streaming the data.
If this is more than the size of the dataset,
we can determine the exact size.
The default value for this is 1000 quads.

The filter just needs to contain the value `qpf` to indicate that it is a QPF filter.
