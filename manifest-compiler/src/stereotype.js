const Ajv = require("ajv")
const fs = require("fs-extra")
const lo = require("lodash")
const ManifestV1 = require("./manifest").ManifestV1
const path = require("path")
const raise = require("./raiseFn")
const renderTemplate = require("./render-template")
const util = require("util")
const walkAsync = require("./walk-async")
const winston = require("winston")
const yaml = require("js-yaml")


const ajv = new Ajv()
const schema = require("./stereotype_v1.schema.json")
const validateStereotype = ajv.compile(schema)

class StereotypeV1 {

    constructor(id, owner, requires, defines, resources, integrations, deployments, templates) {
        this.id = id
        this.owner = owner
        this.requires = requires || []
        this.defines = defines || []
        this.resources = resources || []
        this.integrations = integrations || []
        this.deployments = deployments || []
        this.templates = templates || []
    }

    async render(context) {
        const requires = await walkAsync(this.requires, (k, v) => {
            return Promise.all([renderTemplate(k, context), renderTemplate(v, context) ])
        })
        const defines = await walkAsync(this.defines, (k, v) => {
            return Promise.all([renderTemplate(k, context), renderTemplate(v, context) ])
        })
        const resources = await walkAsync(this.resources, (k, v) => {
            return Promise.all([renderTemplate(k, context), renderTemplate(v, context) ])
        })
        const integrations = await walkAsync(this.integrations, (k, v) => {
            return Promise.all([renderTemplate(k, context), renderTemplate(v, context) ])
        })
        const deployments = await walkAsync(this.deployments, (k, v) => {
            return Promise.all([renderTemplate(k, context), renderTemplate(v, context) ])
        })
        const templates = await walkAsync(this.templates, (k, v) => {
            return Promise.all([renderTemplate(k, context), renderTemplate(v, context) ])
        })
        return new ManifestV1(
            this.id,
            this.owner,
            null,
            requires,
            defines,
            resources,
            integrations,
            deployments,
            templates)
    }

}

class StereotypeDAO {

    constructor(dirpaths) {
        this.dirpaths = dirpaths
        this.cache = {}
    }

    async fromId(id) {
        winston.debug("Checking cache for stereotype %s...", id)
        if (this.cache[id] !== undefined) {
            winston.debug("Found stereotype %s in cache.", id)
            return this.cache[id]
        }
        winston.debug("Couldn't find stereotype %s in cache.", id)

        winston.debug("Searching the filsystem for stereotype %s...", id)
        const competitors = this.dirpaths.map(dirpath => {
            const contestant = path.join(dirpath, id + ".stereotype.yaml")
            winston.debug("Will try %s...", contestant)
            return contestant
        })
        const race = await Promise.all(competitors.map(competitor => {
            return this.fromYamlFile(competitor)
        }))
        const winningPaths = lo.compact(race)
        if (winningPaths.length === 0) {
            winston.error("Failed to find stereotype file for %s.", id)
            throw new Error(`Stereotype not found: ${id}`)
        }
        const winner = winningPaths[0]
        this.cache[id] = winner
        winston.debug("Added %s to the stereotype cache.", id)
        return winner
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
        const valid = validateStereotype(doc)
        if (!valid) {
            raise("Invalid stereotype format: %j", validateStereotype.errors)
        }
        if (doc.version != 1) {
            raise("Invalid version: given %d, supported %d", doc.version, 1)
        }
        return new StereotypeV1(
            doc.stereotype.id,
            doc.stereotype.owner,
            doc.stereotype.requires,
            doc.stereotype.defines,
            doc.stereotype.resources,
            doc.stereotype.integrations,
            doc.stereotype.deployments,
            doc.stereotype.templates)
    }
}

module.exports.StereotypeV1 = StereotypeV1
module.exports.StereotypeDAO = StereotypeDAO
