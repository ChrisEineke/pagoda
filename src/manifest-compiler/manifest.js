const lo = require("lodash")
const winston = require("winston")


class ManifestV1 {

    constructor(id, owner, stereotypes, requires, defines, resources, integrations, deployments, templates) {
        this.id = id
        this.owner = owner
        this.stereotypes = stereotypes
        this.requires = requires
        this.defines = defines
        this.resources = resources
        this.integrations = integrations
        this.deployments = deployments
        this.templates = templates
    }

    async expand(args) {
        if (!lo.isObject(args)) {
            throw new Error("args is not an object: " + args)
        }
        if (!args.context) {
            args.context = {
                id: this.id,
                owner: this.owner,
            }
        }
        args.context = {
            ...this.defines,
            ...args.context,
        }
        winston.debug("Expanding manifest %s with the following bindings: %j", this.id, args.context)
        await this._applyStereotypes(args)
        await this._expandRequires(args)
        await this._expandDefines(args)
        await this._expandResources(args)
        await this._expandIntegrations(args)
        await this._expandDeployments(args)
        await this._expandTemplates(args)
        return this
    }

    async _applyStereotypes(args) {
        if (!this.stereotypes || this.stereotypes.length === 0) {
            winston.debug("No stereotypes to be applied.")
            return this
        }
        if (!lo.isArray(this.stereotypes)) {
            this.stereotypes = [ this.stereotypes ]
        }
        for (const stereotypeId of this.stereotypes) {
            winston.debug("Applying stereotype %s...", stereotypeId)
            const [ _, stereotype ] = await args.documentDAO.getStereotype(stereotypeId)
            const stereotypeManifest = await stereotype.render(args.context)
            Array.prototype.unshift.call(this.requires, ...stereotypeManifest.requires)
            Object.assign(this.defines, stereotypeManifest.defines)
            Array.prototype.unshift.call(this.resources, ...stereotypeManifest.resources)
            Array.prototype.unshift.call(this.integrations, ...stereotypeManifest.integrations)
            Array.prototype.unshift.call(this.deployments, ...stereotypeManifest.deployments)
            Array.prototype.unshift.call(this.templates, ...stereotypeManifest.templates)
            winston.debug("Applied stereotype %s.", stereotypeId)
        }
        return this
    }

    async _expandRequires(args) {
        return this
    }

    async _expandDefines(args) {
        return this
    }

    async _expandResources(args) {
        const expandedResources = {}
        for (const resourceRef of this.resources) {
            const [ resourceId, resourceManifest ] = await args.documentDAO.getManifest(resourceRef)
            await resourceManifest.expand(args)
            expandedResources[resourceId] = resourceManifest
        }
        this.resources = expandedResources
        return this
    }

    async _expandIntegrations(args) {
        const expandedIntegrations = {}
        for (const integrationRef of this.integrations) {
            const [ integrationId, integrationManifest ] = await args.documentDAO.getManifest(integrationRef)
            await integrationManifest.expand(args)
            expandedIntegrations[integrationId] = integrationManifest
        }
        this.integrations = expandedIntegrations
        return this
    }

    async _expandDeployments(args) {
        const expandedDeployments = {}
        for (const deploymentRef of this.deployments) {
            const [ deploymentId, deploymentManifest ] = await args.documentDAO.getManifest(deploymentRef)
            await deploymentManifest.expand(args)
            expandedDeployments[deploymentId] = deploymentManifest
        }
        this.deployments = expandedDeployments
        return this
    }

    async _expandTemplates(args) {
        const expandedTemplates = {}
        for (const templateRef of this.templates) {
            const [ _, templates ] = await args.documentDAO.getTemplate(templateRef)
            for (const template of templates) {
                const res = await template.generate(args.context)
                expandedTemplates[res.id] = res.contents
            }
        }
        this.templates = expandedTemplates
        return this
    }

    collectTemplates() {
        return Object.assign({}, this.templates,
            ...lo.invokeMap(this.resources, "collectTemplates"),
            ...lo.invokeMap(this.integrations, "collectTemplates"),
            ...lo.invokeMap(this.deployments, "collectTemplates"))
    }

}

module.exports = ManifestV1
