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

    constructor(id, owner, stereotype, requires, provides, resources, integrations, deployments, templates) {
        this.id = id
        this.owner = owner
        this.stereotype = stereotype
        this.requires = requires || []
        this.provides = provides || []
        this.resources = resources || []
        this.integrations = integrations || []
        this.deployments = deployments || []
        this.templates = templates || []
    }

    expand(args) {
        if (!lo.isObject(args)) {
            throw new Error("args is not an object: " + args)
        }
        return when.try(() => {
            return this.applyStereotype(args)
        }).then(() => {
            return this.expandRequires(args)
        }).then(() => {
            return this.expandProvides(args)
        }).then(() => {
            return this.expandResources(args)
        }).then(() => {
            return this.expandIntegrations(args)
        }).then(() => {
            return this.expandDeployments(args)
        }).then(() => {
            return this.expandTemplates(args)
        }).then(() => {
            return this
        })
    }

    applyStereotype(args) {
        if (!this.stereotype) {
            return this
        }
        return when.try(() => {
            return args.stereotypeDAO.fromId(this.stereotype)
        }).then(stereotype => {
            return stereotype.render(this)
        }).then(stereotypeManifest => {
            Array.prototype.unshift.call(this.requires, ...stereotypeManifest.requires)
            Array.prototype.unshift.call(this.provides, ...stereotypeManifest.provides)
            Array.prototype.unshift.call(this.resources, ...stereotypeManifest.resources)
            Array.prototype.unshift.call(this.integrations, ...stereotypeManifest.integrations)
            Array.prototype.unshift.call(this.deployments, ...stereotypeManifest.deployments)
            Array.prototype.unshift.call(this.templates, ...stereotypeManifest.templates)
            this.stereotype = undefined
            return this
        })
    }

    expandRequires(args) {
        return this
    }

    expandProvides(args) {
        return this
    }

    expandResources(args) {
        const expandedResources = {}
        return when.map(this.resources, resourceId => {
            return args.manifestDAO.fromId(resourceId).then(resourceManifest => {
                return resourceManifest.expand(args)
            }).then(resourceManifest => {
                expandedResources[resourceId] = resourceManifest
            })
        }).then(() => {
            this.resources = expandedResources
            return this
        })
    }

    expandIntegrations(args) {
        const expandedIntegrations = {}
        return when.map(this.integrations, integrationId => {
            return args.manifestDAO.fromId(integrationId).then(integrationManifest => {
                return integrationManifest.expand(args)
            }).then(integrationManifest => {
                expandedIntegrations[integrationId] = integrationManifest
            })
        }).then(() => {
            this.integrations = expandedIntegrations
            return this
        })
    }

    expandDeployments(args) {
        const expandedDeployments = {}
        return when.map(this.deployments, deploymentId => {
            return args.manifestDAO.fromId(deploymentId).then(deploymentManifest => {
                return deploymentManifest.expand(args)
            }).then(deploymentManifest => {
                expandedDeployments[deploymentId] = deploymentManifest
            })
        }).then(() => {
            this.deployments = expandedDeployments
            return this
        })
    }

    expandTemplates(args) {
        const expandedTemplates = {}
        return when.map(this.templates, templateId => {
            return args.templateDAO.fromId(templateId).then(templates => {
                return when.map(templates, template => {
                    return template.generate(Object.assign({}, args.context)).then(res => {
                        expandedTemplates[res.id] = res.contents
                    })
                })
            })
        }).then(() => {
            this.templates = expandedTemplates
            return this
        })
    }

    collectTemplates() {
        return Object.assign({}, this.templates,
            ...lo.invokeMap(this.resources, "collectTemplates"),
            ...lo.invokeMap(this.integrations, "collectTemplates"),
            ...lo.invokeMap(this.deployments, "collectTemplates"))
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
            doc.manifest.deployments,
            doc.manifest.templates)
    }

   toYaml(manifest) {
        try {
            return yaml.safeDump(manifest, { skipInvalid: true })
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
