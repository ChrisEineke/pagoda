const Ajv = require("ajv")
const fs = require("fs")
const path = require("path")
const yaml = require("js-yaml")


function raise(fmt, ...args) {
    const msg = util.format(fmt, ...args)
    throw new Error(msg)
}

class ManifestV1 {

    constructor(id, owner, requires, provides, deployment) {
        this.id = id
        this.owner = owner
        this.requires = requires
        this.provides = provides
        this.deployment = deployment
    }

}

class ManifestFactory {

    static FromYamlFile(filepath) {
        const doc = yaml.safeLoad(fs.readFileSync(filepath, "utf-8"))
        return ManifestFactory.FromJsonDoc(doc)
    }

    static FromJsonDoc(doc) {
        const ajv = new Ajv()
        const validate = ajv.compile({
            "type": "object",
            "properties": {
                "version": { "$ref": "#/definitions/version" },
                "id": { "$ref": "#/definitions/id" },
                "owner": { "$ref": "#/definitions/owner" },
                "requires": { "$ref": "#/definitions/requires" },
                "provides": { "$ref": "#/definitions/provides" },
                "deployment": { "$ref": "#/definitions/deployment" },
            },
            "definitions": {
                "version": { "type": "integer" },
                "id": { "type": "string" },
                "owner": { "type": "string" },
                "requires": { "type": "array", "items": { "type": "object" } },
                "provides": { "type": "array", "items": { "type": "object" } },
                "deployment": { "type": "string" },
            },
        })
        const valid = validate(doc)
        if (!valid) {
            raise("Invalid manifest format: %j", ajv.errors)
        }
        if (doc.version != 1) {
            raise("Invalid version: given %d, supported %d", doc.version, 1)
        }
        return new ManifestV1(doc.manifest.id, doc.manifest.owner, doc.manifest.requires, doc.manifest.provides,
            doc.manifest.deployment)
    }
}

module.exports.ManifestV1 = ManifestV1
module.exports.Factory = ManifestFactory
