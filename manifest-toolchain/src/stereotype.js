const Ajv = require("ajv")
const fs = require("fs-extra")
const lo = require("lodash")
const ManifestV1 = require("./manifest").ManifestV1
const path = require("path")
const raise = require("./raiseFn")
const renderTemplate = require("./render-template")
const util = require("util")
const when = require("when")
const winston = require("winston")
const yaml = require("js-yaml")


const ajv = new Ajv()
const schema = require("./stereotype_v1.schema.json")
const validateStereotype = ajv.compile(schema)

class StereotypeV1 {

    constructor(id, owner, requires, provides, resources, integrations, deployments) {
        this.id = id
        this.owner = owner
        this.requires = requires || []
        this.provides = provides || []
        this.resources = resources || []
        this.integrations = integrations || []
        this.deployments = deployments || []
    }

    render(context) {
        const requires = []
        const provides = []
        const resources = []
        const integrations = []
        const deployments = []
        return when.try(() => {
            return when.map(this.requires, require => {
                return renderTemplate(require, context).then(renderedRequire => {
                    requires.push(renderedRequire)
                })
            })
        }).then(() => {
            return when.map(this.provides, provide => {
                const renderedProvide = {}
                return when.map(Object.keys(provide), key => {
                    return renderTemplate(provide[key], context).then(renderedProvideValue => {
                        renderedProvide[key] = renderedProvideValue
                    })
                }).then(() => {
                    provides.push(renderedProvide)
                })
            })
        }).then(() => {
            return when.map(this.resources, resource => {
                return renderTemplate(resource, context).then(renderedResource => {
                    resources.push(renderedResource)
                })
            })
        }).then(() => {
            return when.map(this.integrations, integration => {
                return renderTemplate(integration, context).then(renderedIntegration => {
                    integrations.push(renderedIntegration)
                })
            })
        }).then(() => {
            return when.map(this.deployments, deployment => {
                return renderTemplate(deployment, context).then(renderedDeployment => {
                    deployments.push(renderedDeployment)
                })
            })
        }).then(() => {
            return new ManifestV1(
                this.id,
                this.owner,
                null,
                requires,
                provides,
                resources,
                integrations,
                deployments)
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
            doc.stereotype.provides,
            doc.stereotype.resources,
            doc.stereotype.integrations,
            doc.stereotype.deployments)
    }
}

module.exports.StereotypeV1 = StereotypeV1
module.exports.StereotypeDAO = StereotypeDAO
