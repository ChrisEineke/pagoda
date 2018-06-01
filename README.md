# Overview
Pagoda is a DevOps toolchain with sub-toolchains:
- The manifest toolchain turns a description of a unit of deployment into one or more artifacts.


# Requirements
`node >= v8.11.0`


# Setup
```
nvm install v8.11.0  # or higher
nvm use v8.11.0      # or higher
npm install
npm link
```


# Documentation

## Manifest toolchain
Developers strive to produce software artifacts for production environments. We use build and deployment automation
tools to reduce the amount of time we don't spent writing code to offload tasks like:
- running unit tests
- creating code quality reports 
- packaging artifacts
- distributing packaged artifacts to a repository
- promoting artifacts to production-ready status
- provisioning resources in environments
- deploying artifacts to environments

This is just a small sample of tasks. *Every* software development process incorporates these tasks with varying degrees
of ritual and automation. What differs between organizations are the tools used to accomplish these steps.

Most tools require additional configuration to accomplish the tasks they are designed to automate. For example, if you
use a task runner like Jenkins for executing build and deploy pipelines, then you will have a build pipeline
configuration and a deploy pipeline configuration for each artifact. If you use AWS' Platform-as-a-Service offerings
like Elastic Container Service, then your build and deployment process will very probably generate ECS task definitions
that refer to container images in an Elastic Container Repository. If you AWS, then you very likely use a tool like
Terraform to manage and provision your resources. We have traded the time spent on automating the process with time
spent on writing these snippets and generating and managing all these snippets of configuration becomes painful quickly
as the number of artifacts goes up. 

### Manifest
A manifest is a YAML description of a unit of deployment.


### Single-unit manifest
Here's a rudimentary, single-unit manifest (which will be the majority of manifests you write):
```
version: 1
manifest:
  id: foo
```
The `version` property is required. So are the `manifest` map and the `id` of the key of the `manifest` map. This
manifest compiles to no other artifacts besides itself.


### Multi-unit manifest
Here is a rudimentary multi-unit manifest:
```
version: 1
manifests:
  - manifest:
      id: foo
  - manifest:
      id: bar
```
Again, the `version` property is required and so is the `manifests` list, which contains `manifest` hashes that
themselves contain `id` keys, just like the `manifest` hashes above. Again, this manifest compiles to no other artifacts
besides itself.


#### Single-unit vs. multi-unit
When do you use a multi-unit manifest over a single-unit manifest? You need to use a multi-unit manifest if the artifact
you're deploying itself consists of several sub-artifacts that need to be deployed together.

For example, if you have a source code repository with several applications that need to be deployed together, you
can create one multi-unit manifest that defines each unit.


### Manifest definitions and references
The manifest compiler allows you a wide range of flexibility when referencing/defining manifests. These sections of a
manifest/stereotype:
- stereotypes
- resources
- pipelines
- integrations
allow you to define manifests inline or reference them externally in three different ways.

*Note*: Defining stereotypes inline doesn't provide much benefit apart from being an intermediate step in refactoring.


### Mix of references and definitions
The usual way you refer to manifests is either a list of external IDs (1), a list of definitions (2), or a mix of both
(3).

Example 1:
```
version: 1
manifest:
  id: foo
  pipelines:
    - bar
    - baz
...
```

Example 2:
```
version: 1
manifest:
  id: foo
  pipelines:
    - id: bar
      ...
    - id: baz
      ...
...
```

Example 3:
```
version: 1
manifest:
  id: foo
  pipelines:
    - bar
    - id: baz
      ...
...
```
*Note:* A manifest's external ID is its filename without `.manifest.yaml` suffix.


#### Singular reference
You can provide a single external ID in place of a list as a shortcut.

Example:
```
version: 1
manifest:
  id: foo
  pipelines: bar
...
```


#### By singular, inline definition
Instead of a single external ID, you can also provide a manifest inline.
Example:
```
version: 1
manifest:
  id: foo
  resources:
    id: bar
...
```
*Note:* If you define a manifest in-line, it will inherit the version of its parent.


### Template


### Stereotype
If you find that manifests end up containing common sections, you can use stereotypes to eliminate the redundancies.
Stereotypes are manifests (though without `stereotypes` sections), whose keys and values are run through the template
engine and are then *merged* into the parent manifests.

For example, if you find that you define a certain property based on the name of artifact in several of your manifests:

`foo` manifest w/o stereotype:
```
version: 1
manifest:
  id: foo
  defines:
    foo-service-name: foo-service
    foo-service-port: 8080
...
```

`bar` manifest w/o stereotype:
```
version: 1
manifest:
  id: bar
  defines:
    bar-service-name: bar-service
    bar-service-port: 8080
```

you can extract the defines into a stereotype and use templating syntax to generalize it:

`service-descriptor` stereotype:
```
version: 1
stereotype:
  id: service
  defines:
    {{ id }}-service-name: {{ id }}-service
    {{ id }}-service-port: 8080
```

Now you can reference the stereotype in your the manifests and they will still compile to the same expanded manifest.

`foo` manifest w/ `service-descriptor` stereotype:
```
version: 1
manifest:
  id: foo
  stereotypes:
    - service-descriptor
```

`bar` manifest w/ `service-descriptor` stereotype:
```
version: 1
manifest:
  id: bar
  stereotypes:
    - service-descriptor
```

### Searchpath

When manifests and stereotypes

### Running the compiler 
The manifest compiler has two modes that it can run in:
* compile mode, and
* dump mode.


#### Compile mode
Compile mode processes the manifest and writes the expanded manifest's artifacts to disk. We have provided an example
manifest ('example1.manifest.yaml') for you to try out on. Run this command:
```
pagoda manifest compile --outputDir=gen examples/example1/example1.manifest.yaml
```
This will create a directory named `gen` with a bunch of files in it. One of the files will be `manifest.yaml`. This is
the manifest after processing by the compiler. All other files are the contents of the templates after the compiler has
applied stereotypes and template expansion has taken place.


#### Dump mode
Dump mode aids in writing your manifests, templates, and stereotypes. Rather than rather than saving the expanded
manifest's artifacts to disk it will print the contents of the expanded manifest to standard out:
```
pagoda manifest dump examples/example1/example1.manifest.yaml
```


#### Logging
The default log level of the compiler is "info" and will print close to nothing. If something goes wrong during the
compilation, you can lower the log level to `debug` by setting the `logLevel` option. This will create a file named
`pagoda.log` with diagnostic information about the compilation process. For example:
```
pagoda manifest compile --logLevel=debug --outputDir=gen examples/example1/example1.manifest.yaml
```
