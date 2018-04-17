const Ajv = require("ajv")
const fs = require("fs-extra")
const lo = require("lodash")
const path = require("path")
const util = require("util")
const when = require("when")
const winston = require("winston")
const yaml = require("js-yaml")


const MANIFEST_V1_SCHEMA = {
    "type": "object",
    "properties": {
        "version":      { "$ref": "#/definitions/version" },
        "manifest":     { "$ref": "#/definitions/manifest" },
    },
    "definitions": {
        "version": { "type": "integer" },
        "manifest": {
            "id":           { "$ref": "#/definitions/id" },
            "owner":        { "$ref": "#/definitions/owner" },
            "stereotype":   { "$ref": "#/definitions/stereotype" },
            "requires":     { "$ref": "#/definitions/requires" },
            "provides":     { "$ref": "#/definitions/provides" },
            "resources":    { "$ref": "#/definitions/resources" },
            "integrations": { "$ref": "#/definitions/integrations" },
            "deployments":  { "$ref": "#/definitions/deployments" },
        },
        "id": { "type": "string" },
        "owner": { "type": "string" },
        "stereotype": { "$ref": "#/definitions/id" },
        "requires": {
            "type": "array",
            "items": { "$ref": "#/definitions/id" }
        },
        "provides": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": { "$ref": "#/definitions/id" },
                },
                "patternProperties": {
                    "[a-z0-9_\-]*": true
                }
            }
        },
        "resources": {
            "type": "array",
            "items": { "$ref": "#/definitions/id" }
        },
        "integrations": {
            "type": "array",
            "items": { "$ref": "#/definitions/id" }
        },
        "deployments": {
            "type": "array",
            "items": { "$ref": "#/definitions/id" },
        },
    },
}

function raise(fmt, ...args) {
    const msg = util.format(fmt, ...args)
    throw new Error(msg)
}

class ManifestV1 {

    constructor(id, owner, stereotype, requires, provides, resources, integrations, deployments) {
        this.id = id
        this.owner = owner
        this.stereotype = stereotype
        this.requires = requires
        this.provides = provides
        this.resources = resources
        this.integrations = integrations
        this.deployments = deployments
    }

    applyStereotype(manifestFactory, templateFactory) {
        if (manifestFactory == null) {
            throw new Error("manifestFactory == null")
        }
        if (templateFactory == null) {
            throw new Error("templateFactory == null")
        }
        return when.try(() => {
            if (this.stereotype) {
                const stereotypeId = this.stereotype
                return when(manifestFactory.fromId(stereotypeId)).then(stereotypeManifest => {
                    Array.prototype.unshift.apply(this.requires, stereotypeManifest.requires)
                    Array.prototype.unshift.apply(this.provides, stereotypeManifest.provides)
                    Array.prototype.unshift.apply(this.resources, stereotypeManifest.resources)
                    Array.prototype.unshift.apply(this.integrations, stereotypeManifest.integrations)
                    Array.prototype.unshift.apply(this.deployments, stereotypeManifest.deployments)
                    return this
                })
            }
        })
    }


}

class ManifestFactory {

    constructor(dirpaths) {
        this.dirpaths = dirpaths
    }

    fromId(id) {
        const competitors = this.dirpaths.map(dirpath => {
            return path.join(dirpath, id + ".manifest.yaml")
        })
        winston.debug("Looking for manifest %s in these paths: %j.", id, competitors)
        return when.map(competitors, competitor => {
            return this.fromYamlFile(competitor)
        }).then(race => {
            const winner = race.filter(x => !!x)[0]
            if (!winner) {
                raise("Manifest ID not found: %s", id)
            }
            return winner
        })
    }

    fromYamlFile(filepath) {
        try {
            const doc = yaml.safeLoad(fs.readFileSync(filepath, "utf-8"))
            return this.fromJsonDoc(doc)
        }
        catch (e) {
            return null
        }
    }

    fromJsonDoc(doc) {
        const ajv = new Ajv()
        const validate = ajv.compile(MANIFEST_V1_SCHEMA)
        const valid = validate(doc)
        if (!valid) {
            raise("Invalid manifest format: %j", ajv.errors)
        }
        if (doc.version != 1) {
            raise("Invalid version: given %d, supported %d", doc.version, 1)
        }
        return new ManifestV1(
            doc.manifest.id,
            doc.manifest.owner,
            doc.manifest.stereotype,
            doc.manifest.requires,
            doc.manifest.provides,
            doc.manifest.resources,
            doc.manifest.integrations,
            doc.manifest.deployments)
    }
}

module.exports.ManifestV1 = ManifestV1
module.exports.ManifestFactory = ManifestFactory
