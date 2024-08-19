# Derived index resources

Derived index resources are a specific kind of derived resources whose main purpose is
to provide an index of resources matching a specific triple pattern.
The contents of the index only links to resources the credentials performing the request have read access to.

Similar to the standard derived resources, there is a startup script with examples.
`npm run start:example:index` will start the server with some example derived index resources.

## New features

Several new features have been added specifically to support this functionality,
which are described below.

### Index filter

A new filter type was developed.
The implementation expects the filter resource to be a JSON resource containing a partial RDF/JS Quad,
with exactly 1 variable.
For example:
```json
{
  "predicate": {
    "termType": "NamedNode",
    "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
  },
  "object": {
    "termType": "Variable",
    "value": "v"
  }
}
```
For every input resource defined by the selector,
if that resource has a triple that matches the filter,
an output triple will be generated indicating which resource was a match with which value.
For example:

```turtle
@prefix derived-index: <urn:npm:solid:derived-index:>.

_:b0 derived-index:for <http://www.w3.org/ns/ldp#Container>;
    derived-index:instance <http://localhost:3000/data/>.
_:b1 derived-index:for <http://xmlns.com/foaf/0.1/Project>;
    derived-index:instance <http://localhost:3000/data/public>.
_:b2 derived-index:for <http://www.w3.org/ns/ldp#BasicContainer>;
    derived-index:instance <http://localhost:3000/data/>.
_:b3 derived-index:for <http://xmlns.com/foaf/0.1/Agent>;
    derived-index:instance <http://localhost:3000/data/public>.
_:b4 derived-index:for <http://www.w3.org/ns/ldp#Resource>;
    derived-index:instance <http://localhost:3000/data/>.
```

This is a simpler filter than the original SPARQL filter,
but has as advantage that we can apply it to data streams without having to fully read them first.

### Authorized selector

A new selector has been added that wraps around the existing selectors.
After the original selectors determine a list of identifiers of input sources,
the new selector validates which ones the client doing the request has read access to.
Only those identifiers will be used to determine the input for the filter.

To indicate that this feature should be applied,
a new `derived:feature` triple can be added to the metadata defining the derived resource:

```turtle
@prefix derived: <urn:npm:solid:derived-resources:> .
<> derived:derivedResource [
    derived:template "type";
    derived:selector <data/**>;
    derived:filter <filters/type.json>;
    derived:feature derived:ReadableSources
].
```

## Example

When starting the server with `npm run start:example`,
several index related examples will also be created.
The metadata for these can be seen in <http://localhost:3000/index/.meta>.

Several derived resources are created,
all of these applied to the data in the <http://localhost:3000/data/auth> container.

* <http://localhost:3000/index/predicate> provides an index of all predicates.
* <http://localhost:3000/index/type> provides an index of all `rdf:type` objects.
* <http://localhost:3000/index/qpf> provides a [QPF](filters.md#quad-pattern-fragments) interface over the data.

One of the two documents in the `data` container only provides read acces to the WebID `http://example.com/alice`.
The server has been configured so that you can authenticate as a user by adding the WebID to the authorization header,
to make it easier to test this out.
The previous example would only show the examples everyone has read access to.
If you perform the GET request and add the header `Authorization: WebID http://example.com/alice`,
you will see more results.

## Caching

Besides the caching already present for all derived resources,
there is also some specific caching for derived index resources.
For every resource that is used to generate an index,
the server caches the matching quads that resource had for the filter.
This way, if new resources get included in the index generation,
due to using different credentials for example,
the results of the ones previously included can be reused.
Similar to standard caching for derived resources,
the timestamp of the resource is used to make sure outdated data is not used.

## CSS architecture workarounds

While it was possible to implement these new features without having to make any changes to the CSS,
certain workarounds were necessary to make everything work.
While it is good that we can get things to work,
both of these feel more like hacky solutions
so could be used as indications that we might want some robust architecture solution in the future to prevent this.

Some classes introduced to solve these problems are generic and could potentially move to the main CSS repo.
Specifically `WeakStorage`, `ParamInitializer`, and `ParamSetter`.

### Storing credentials

By the time the request reaches the ResourceStore,
the credentials have already been handled and are no part of the incoming parameters.
Those are needed to determine which resources can be used as input though.
To circumvent this issue,
a new Authorizer was made that caches the credentials and links them to the ResourceIdentifier of the request
when authorizing the initial permissions of the request.
The new components can then access the credentials by accessing the same cache.

### Recursive ResourceStore calls

While handling the request in the new ResourceStore,
we need to check the permissions of all the input resources.
The class responsible for checking permissions also requires access to the ResourceStore,
when using WAC/ACP at least.
If all references are provided through constructors,
as we tend to do with Components.js,
this would create a dependency loop,
making it impossible to instantiate the classes.

To prevent this,
some of the dependencies are applied after initialization.
The `ParamSetter` interface and `ParamInitializer` class have been created specifically for this purpose.
An example of this issue can be seen in the `AuthorizedSelectorParser`.
