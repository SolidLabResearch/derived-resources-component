# Derived resources

[![npm version](https://img.shields.io/npm/v/@solidlab/derived-resources-component)](https://www.npmjs.com/package/@solidlab/derived-resources-component)

Adds support for derived resources to a
[Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer) instance.

## Public instance

A public instance of a Solid server implementing this component can be found at
<https://demo.knows.idlab.ugent.be/eswc2024/derived-resources/>.
It contains all the example resources described in the example [section](#examples) below,
which means the main metadata description resource can be found
[here](https://demo.knows.idlab.ugent.be/eswc2024/derived-resources/.meta).

## Install

```
npm install
npm run build
```

Run `npm run start:example` to have a CSS instance that combines `@css:config/default.json` with the new components implementing the template `templates/root/base`. See 'Examples' below for a walkthrough of the demonstration.

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
Have a look at the [`templates/root/base` folder](https://github.com/SolidLabResearch/derived-resources-component/tree/main/templates/root/base)
for the full data.
The metadata of the root container defines 4 different derived resources:
- `http://localhost:3000/test`: A basic derived resource applying a query to a single selector.
- `http://localhost:3000/template/{var}`: A template for derived resources where `var` will be applied to the query.
     You can try out http://localhost:3000/template/foaf:knows and http://localhost:3000/template/foaf:name.
     **Note**: these are currently not working due to a known
               [issue](https://github.com/SolidLabResearch/derived-resources-component/issues/10).
- `http://localhost:3000/query`: Similar to the previous example, but instead uses a query parameter for the variable.
     For example,`http://localhost:3000/query?var=foaf:knows.
- `http://localhost:3000/pattern`: A derived resource whose selectors are all resources in a container.
- `http://localhost:3000/multiple`: A derived resource with multiple selectors.

The metadata of `http://localhost:3000/dummy.txt` also defines a derived resource,
causing that URl to return the results of a derivation instead of the contents of the template file.

Two containers, `http://localhost:3000/` and `http://localhost:3000/template/`,
return `ldp:contains` triples as expected from a container.
But these are also derived resources,
generated by performing a SPARQL query on the metadata that defines the derived resources.
The query can be seen at `http://localhost:3000/filters/container`.

## Derived index resources

A new feature that was added at a later point was support for derived index resources.
More info on these can be found [here](derived-index.md).

## Known limitations/decisions

- No locks are used when reading data from the selectors. This is to prevent potential deadlocks.
- There is no caching, so derived resources are generated from scratch on every request.
- Authorization on the selector resources is ignored.
  Note that this allows users to access data they do not have access to if they guess the URL of such data.
  We might want to implement it so creating a derived resource requires read access on all selectors,
  similar to notifications.
  This could be done by adding a new `PermissionReader` that checks the contents of a PATCH for such triples.
- An extra conversion store is added to the config as the new `ResourceStore` needs to do content negotiation
  on data it receives from the backend,
  but also wants to allow content negotiation on the data stream it generates.
- The metadata describing these resources is readable for anyone who can read the associated resource.
  If necessary, the solution could be changed to remove that metadata on GET requests.
- The filter triple could be extended to also allow the value directly in the object instead of being in a separate resource.
- The filter could be extended to also support external URIs.
- To make URI templates with query parameters work, query parameters are not stripped from incoming URLs.
  For standard, non-derived, resources this can cause issues if an unexpected query parameter is part of the URL.
- The last modified timestamp of a derived resource will always be the current time, this to make sure its ETag always changes.
  Otherwise, we would have to determine the ETag on:
  - The timestamp of all input resources.
  - The timestamp of the filters.
  - The mappings used.
  - Which resources were used to generate the resource, as those could be different due to changing permissions.

  As ETags in the CSS are currently purely based on the timestamp this would require some changes there first.
