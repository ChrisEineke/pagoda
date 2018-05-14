const always = require("./always")
const ManifestV1 = require("./manifest")
const renderTemplate = require("./render-template")
const walkAsync = require("./walk-async")
const winston = require("winston")


class StereotypeV1 {

    constructor(id, owner, requires, defines, resources, integrations, deployments, templates) {
        this.id = id
        this.owner = owner
        this.requires = requires
        this.defines = defines
        this.resources = resources
        this.integrations = integrations
        this.deployments = deployments
        this.templates = templates
    }

    async render(context) {
        const defines = await walkAsync(this.defines, (k, v) => {
            return Promise.all([renderTemplate(k, context), renderTemplate(v, context) ])
        })
        Object.assign(context, defines)
        winston.debug("Render context for stereotype %s in manifest %s: %j", this.id, context.id, context)

        const requires = await walkAsync(this.requires, (k, v) => {
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
            always.Array(requires),
            always.Object(defines),
            always.Array(resources),
            always.Array(integrations),
            always.Array(deployments),
            always.Array(templates))
    }

}

module.exports = StereotypeV1
