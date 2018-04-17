const Ajv = require("ajv")
const fs = require("fs-extra")
const lo = require("lodash")
const path = require("path")
const util = require("util")
const when = require("when")
const winston = require("winston")
const yaml = require("js-yaml")
const raise = require("./raiseFn")


const ajv = new Ajv()
const schema = require("./manifest_v1.schema.json")
const validateManifest = ajv.compile(schema)

class ManifestV1 {

    constructor(id, owner, stereotype, requires, provides, resources, integrations, deployments) {
        this.id = id
        this.owner = owner
        this.stereotype = stereotype
        this.requires = requires || []
        this.provides = provides || []
        this.resources = resources || []
        this.integrations = integrations || []
        this.deployments = deployments || []
    }

    applyStereotype(stereotypeDAO) {
        if (stereotypeDAO == null) {
            throw new Error("stereotypeDAO == null")
        }
        return when.try(() => {
            return stereotypeDAO.fromId(this.stereotype)
        }).then(stereotype => {
            return stereotype.render(this)
        }).then(stereotypeManifest => {
            Array.prototype.unshift.call(this.requires, ...stereotypeManifest.requires)
            Array.prototype.unshift.call(this.provides, ...stereotypeManifest.provides)
            Array.prototype.unshift.call(this.resources, ...stereotypeManifest.resources || [])
            Array.prototype.unshift.call(this.integrations, ...stereotypeManifest.integrations)
            Array.prototype.unshift.call(this.deployments, ...stereotypeManifest.deployments)
            this.stereotype = undefined
            return this
        })
    }

}

class ManifestDAO {

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
        const valid = validateManifest(doc)
        if (!valid) {
            raise("Invalid manifest format: %j", validateManifest.errors)
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

   toYaml(manifest) {
        try {
            const doc = yaml.safeDump(manifest, { skipInvalid: true })
            return doc
        }
        catch (e) {
            winston.error("Failed to convert manifest to YAML.", e)
            return null
        }
    }

    toYamlFile(manifest, filepath) {
        const doc = this.toYaml(manifest)
        if (doc == null) {
            return null
        }
        return fs.writeFile(filepath, doc)
    }

}

module.exports.ManifestV1 = ManifestV1
module.exports.ManifestDAO = ManifestDAO
