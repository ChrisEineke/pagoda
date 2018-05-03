# Requirements

`node >= v8.11.0`


# Setup
```
nvm install stable
nvm use stable
npm install
npm link
```


# Run

## Dump: process and dump manifest to stdout
```
pagoda manifest dump examples/example1/example1.manifest.yaml
```

## Compile: process and compile manifest into artifacts
```
pagoda manifest compile --logLevel=debug --outputDir=gen examples/example1/example1.manifest.yaml
```


# Logging

## Setting the log level
The default log level is "info" and will print close to nothing. Increasing the log level to debug will print diagnostic
information to the `pagoda.log` log file. Example:

```
pagoda manifest compile --logLevel=debug --outputDir=gen examples/example1/example1.manifest.yaml
```
