# Derived resources

[![npm version](https://img.shields.io/npm/v/@solidlab/derived-resources-component)](https://www.npmjs.com/package/@solidlab/derived-resources-component)

Adds support for derived resources to a
[Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer) instance.

## Install

```
npm install
npm run build
```

Run `npm run start:example` to have a CSS instance with the new components implementing the template `templates/root/base`.
See 'Examples' below for a walkthrough of the demonstration.

## What are derived resources?

Derived resources are resources whose contents are determined by aggregating contents of other resources.
This allows you to apply different access control rules to resources that, for example,
reveal a subset of certain data.

## How does it work

Derived resources, as implemented in this repository,
consist of 3 components:
- The template, describing the URL through which the derived resource is accessible.
- One or more selectors, that determine the resources that are an input for the derivation.
- The filter, which is applied to the selector to determine the result.

To create a derived resource, put the above 3 components in the metadata of a container,
as described in the [CSS metadata documentation](https://communitysolidserver.github.io/CommunitySolidServer/7.x/usage/metadata/).
For example:
```turtle
@prefix derived: <urn:npm:solid:derived-resources:> .

<http://localhost:3000/> derived:derivedResource [
    derived:template "test";
    derived:selector <http://localhost:3000/data>;
    derived:filter <http://localhost:3000/filter>
  ].
```
The above metadata, when placed in the metadata of container `http://localhost:3000`,
defines `http://localhost:3000/test` as a derived resource.
The contents are defined by using `http://localhost:3000/data`
as an input for the query found at `http://localhost:3000/filter`.

The last modified date, and the resulting ETag, of the derived resource
is that of the most recently changed selector.

Below are some more details on each of the fields.

### Template

This string is concatenated with the URL of the container to determine the URL of the derived resource.
URL templates such as `"{testVar}"` can be used, and their value is fed into the filter.
When such a URL template is used, all URLs that match are accessible.
Using this value you would be able to access `http://localhost:3000/foo`,
`http://localhost:3000/bar`, etc.

You can also define derived resources by editing the metadata of a document instead of a container.
In that case the template value needs to be the empty string.
The actual body of such a document is irrelevant and can be anything.
All metadata assigned to this resource will be copied to the corresponding derived resource.

Besides the variables extracted from a URL template,
there are certain variables that will always be available.
Currently, there are two such variables:
- `source`: The identifier of the resource that contains the metadata defining the corresponding derived resource.
- `identifier`: The identifier of the resource being accessed.

### Selectors

The data of all resources linked here is combined before executing the filter in the next step.

Instead of a fixed URL, these can also contain glob patterns `*` and `**`
For example, if the object in the selector triple is `"http://localhost:3000/*"`,
all resources found in the `http://localhost:3000/` container are used.

### Filter

This is the identifier of a resource that contains a valid SPARQL query.

In case the template contains a URL template, the resulting variable(s) can be used here.
This is done with a simple string replacement on the query.
To continue the example of before,
all occurrences of `$testVar$` in the SPARQL query are replaced with the provided value.

## Examples

When you start the server with `npm run start:example`,
it generates several sample resources which define multiple derived resources.
How these are defined can be seen at <http://localhost:3000/derived/.meta>.
That metadata defines the following derived resources:
- <http://localhost:3000/derived/test>: A basic derived resource applying a query to a single selector.
- `http://localhost:3000/derived/template/{var}.ttl`: A template for derived resources where `var` will be applied to the query.
     You can try out <http://localhost:3000/derived/template/foaf:knows.ttl> and <http://localhost:3000/derived/template/foaf:name.ttl>.
- `http://localhost:3000/derived/query`: Similar to the previous example, but instead uses a query parameter for the variable.
     For example, <http://localhost:3000/derived/query?var=foaf:knows>.
  - **Note:** Currently not working due to https://github.com/CommunitySolidServer/CommunitySolidServer/issues/1889
- <http://localhost:3000/derived/pattern>: A derived resource whose selectors are all resources in a container.
- <http://localhost:3000/derived/multiple>: A derived resource with multiple selectors.

The metadata of <http://localhost:3000/dummy.txt> also defines a derived resource,
causing that URl to return the results of a derivation instead of the contents of the template file.

Two containers, <http://localhost:3000/derived/> and <http://localhost:3000/derived/template/>,
return `ldp:contains` triples as expected from a container.
But these are also derived resources,
generated by performing a SPARQL query on the metadata that defines the derived resources.
The query can be seen at <http://localhost:3000/filters/container>.

## Derived index resources

A new feature that was added at a later point was support for derived index resources.
More info on these and the relevant examples can be found [here](derived-index.md).

## Caching

A new `ResourceStore` is added in this component: the `CachedResourceStore`.
This store caches resources in an LRU cache and invalidates them when they are modified.
This is a memory-based cache, meaning this can not be used by servers with worker threads,
and is interesting for servers using non-memory backends, such as a file backend.
This will make it so the input sources can be requested faster.
But this will make it so the input sources can be requested faster.
This class is independent of the derived resources so could move to the main CSS repo.

For derived resources caching is a bit more complicated as they have to be updated when any of their input sources change.
The amount of input sources might also change,
if a wildcard selector is used.
To store the resulting representations in an LRU cache,
a key is generated which is based on
1. the filter,
2. the identifiers of all input resources,
3. and the timestamps of all those input resources.

This way, if any of those changes, the stored cache entry will never be used again,
preventing invalid data.
The disadvantage is that this data is never explicitly invalidated,
so it stays in the cache until it gets dropped because the cache is full.

## Known limitations/decisions

- No locks are used when reading data from the selectors. This is to prevent potential deadlocks.
- Authorization on the selector resources is ignored.
  Note that this allows users to access data they do not have access to if they guess the URL of such data.
  We might want to implement it so creating a derived resource requires read access on all selectors,
  similar to notifications.
  This can be enabled as seen [here](derived-index.md).
- An extra conversion store is added to the config as the new `ResourceStore` needs to do content negotiation
  on data it receives from the backend,
  but also wants to allow content negotiation on the data stream it generates.
- The metadata describing these resources is readable for anyone who can read the associated resource.
  If necessary, the solution could be changed to remove that metadata on GET requests.
- The filter triple could be extended to also allow the value directly in the object instead of being in a separate resource.
- The filter could be extended to also support external URIs.
