const Ajv = require("ajv")
const fs = require("fs-extra")
const lo = require("lodash")
const ManifestV1 = require("./manifest").ManifestV1
const path = require("path")
const raise = require("./raiseFn")
const renderTemplate = require("./render-template")
const util = require("util")
const walkAsync = require("./walk-async")
const when = require("when")
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

    render(context) {
        var requires
        var defines
        var resources
        var integrations
        var deployments
        var templates
        return when.try(() => {
            return walkAsync(this.requires, (k, v) => {
                return when.all([
                    renderTemplate(k, context),
                    renderTemplate(v, context) ]).spread((k, v) => [ k, v ])
            }).then(rendered => {
                requires = rendered
            })
        }).then(() => {
            return walkAsync(this.defines, (k, v) => {
                return when.all([
                    renderTemplate(k, context),
                    renderTemplate(v, context) ]).spread((k, v) => [ k, v ])
            }).then(rendered => {
                defines = rendered
            })
        }).then(() => {
            return walkAsync(this.resources, (k, v) => {
                return when.all([
                    renderTemplate(k, context),
                    renderTemplate(v, context) ]).spread((k, v) => [ k, v ])
            }).then(rendered => {
                resources = rendered
            })
        }).then(() => {
            return walkAsync(this.integrations, (k, v) => {
                return when.all([
                    renderTemplate(k, context),
                    renderTemplate(v, context) ]).spread((k, v) => [ k, v ])
            }).then(rendered => {
                integrations = rendered
            })
        }).then(() => {
            return walkAsync(this.deployments, (k, v) => {
                return when.all([
                    renderTemplate(k, context),
                    renderTemplate(v, context) ]).spread((k, v) => [ k, v ])
            }).then(rendered => {
                deployments = rendered
            })
        }).then(() => {
            return walkAsync(this.templates, (k, v) => {
                return when.all([
                    renderTemplate(k, context),
                    renderTemplate(v, context) ]).spread((k, v) => [ k, v ])
            }).then(rendered => {
                templates = rendered
            })
        }).then(() => {
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
        })
    }

}

class StereotypeDAO {

    constructor(dirpaths) {
        this.dirpaths = dirpaths
    }

    fromId(id) {
        const competitors = this.dirpaths.map(dirpath => {
            return path.join(dirpath, id + ".stereotype.yaml")
        })
        winston.debug("Looking for stereotype %s in these paths: %j.", id, competitors)
        return when.map(competitors, competitor => {
            return this.fromYamlFile(competitor)
        }).then(race => {
            const winner = race.filter(x => !!x)[0]
            if (!winner) {
                raise("Stereotype ID not found: %s", id)
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
