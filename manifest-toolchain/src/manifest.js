const Ajv = require("ajv")
const fs = require("fs-extra")
const path = require("path")
const util = require("util")
const when = require("when")
const yaml = require("js-yaml")


function raise(fmt, ...args) {
    const msg = util.format(fmt, ...args)
    throw new Error(msg)
}

class ManifestV1 {

    constructor(id, owner, requires, provides, resources, integrations, deployments) {
        this.id = id
        this.owner = owner
        this.requires = requires
        this.provides = provides
        this.resources = resources
        this.integrations = integrations
        this.deployments = deployments
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
        const validate = ajv.compile({
            "type": "object",
            "properties": {
                "version":      { "$ref": "#/definitions/version" },
                "id":           { "$ref": "#/definitions/id" },
                "owner":        { "$ref": "#/definitions/owner" },
                "requires":     { "$ref": "#/definitions/requires" },
                "provides":     { "$ref": "#/definitions/provides" },
                "resources":    { "$ref": "#/definitions/resources" },
                "integrations": { "$ref": "#/definitions/integrations" },
                "deployments":  { "$ref": "#/definitions/deployments" },
            },
            "definitions": {
                "version": { "type": "integer" },
                "id": { "type": "string" },
                "owner": { "type": "string" },
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
        })
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
            doc.manifest.requires,
            doc.manifest.provides,
            doc.manifest.resources,
            doc.manifest.integrations,
            doc.manifest.deployments)
    }
}

module.exports.ManifestV1 = ManifestV1
module.exports.ManifestFactory = ManifestFactory
