const Ajv = require("ajv")
const fs = require("fs-extra")
const lo = require("lodash")
const path = require("path")
const util = require("util")
const walkAsync = require("./walk-async")
const winston = require("winston")
const yaml = require("js-yaml")
const raise = require("./raiseFn")


const ajv = new Ajv()
const schema = require("./manifest_v1.schema.json")
const validateManifest = ajv.compile(schema)

class ManifestV1 {

    constructor(id, owner, stereotype, requires, defines, resources, integrations, deployments, templates) {
        this.id = id
        this.owner = owner
        this.stereotype = stereotype
        this.requires = requires || []
        this.defines = defines || {}
        this.resources = resources || []
        this.integrations = integrations || []
        this.deployments = deployments || []
        this.templates = templates || []
    }

    async expand(args) {
        if (!lo.isObject(args)) {
            throw new Error("args is not an object: " + args)
        }
        await this._applyStereotype(args)
        await this._expandRequires(args)
        await this._expandDefines(args)
        await this._expandResources(args)
        await this._expandIntegrations(args)
        await this._expandDeployments(args)
        await this._expandTemplates(args)
        return this
    }

    async _applyStereotype(args) {
        if (!this.stereotype) {
            winston.debug("No stereotype provided.")
            return this
        }
        winston.debug("Applying stereotype %s...", this.stereotype)
        const stereotype = await args.stereotypeDAO.fromId(this.stereotype)
        const renderContext = {
            id: args.context.id,
            owner: args.context.owner,
            ...this.defines,
            ...args.context.defines
        }
        const stereotypeManifest = await stereotype.render(renderContext)
        Array.prototype.unshift.call(this.requires, ...stereotypeManifest.requires)
        Object.assign(this.defines, stereotypeManifest.defines)
        Array.prototype.unshift.call(this.resources, ...stereotypeManifest.resources)
        Array.prototype.unshift.call(this.integrations, ...stereotypeManifest.integrations)
        Array.prototype.unshift.call(this.deployments, ...stereotypeManifest.deployments)
        Array.prototype.unshift.call(this.templates, ...stereotypeManifest.templates)
        winston.debug("Applied stereotype %s.", this.stereotype)
        this.stereotype = undefined
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
            const [ resourceId, resourceManifest ] = await args.manifestDAO.fromRef(resourceRef, 1)
            await resourceManifest.expand(args)
            expandedResources[resourceId] = resourceManifest
        }
        this.resources = expandedResources
        return this
    }

    async _expandIntegrations(args) {
        const expandedIntegrations = {}
        for (const integrationRef of this.integrations) {
            const [ integrationId, integrationManifest ] = await args.manifestDAO.fromRef(integrationRef, 1)
            await integrationManifest.expand(args)
            expandedIntegrations[integrationId] = integrationManifest
        }
        this.integrations = expandedIntegrations
        return this
    }

    async _expandDeployments(args) {
        const expandedDeployments = {}
        for (const deploymentRef of this.deployments) {
            const [ deploymentId, deploymentManifest ] = await args.manifestDAO.fromRef(deploymentRef, 1)
            await deploymentManifest.expand(args)
            expandedDeployments[deploymentId] = deploymentManifest
        }
        this.deployments = expandedDeployments
        return this
    }

    async _expandTemplates(args) {
        const expandedTemplates = {}
        for (const templateRef of this.templates) {
            const [ templateId, templates ] = await args.templateDAO.fromRef(templateRef)
            for (const template of templates) {
                const templateContext = {
                    id: args.context.id,
                    owner: args.context.owner,
                    ...this.defines,
                    ...args.context.defines
                }
                const res = await template.generate(templateContext)
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

class ManifestDAO {

    constructor(dirpaths) {
        this.dirpaths = dirpaths
        this.cache = {}
    }

    async fromRef(ref, version) {
        if (lo.isString(ref)) {
            return [ ref, await this.fromId(ref) ]
        }
        else if (lo.isArray(ref)) {
            return ref.map(ref => {
                return [ ref.id, this.fromJsonDoc(Object.assign({}, { version }, { manifests: ref })) ]
            })
        }
        else if (lo.isObject(ref)) {
            return [ ref.id, this.fromJsonDoc(Object.assign({}, { version }, { manifest: ref })) ]
        }
        else {
            throw new Error(`Unsupported manifest reference type: ${typeof ref}`)
        }
    }

    async fromId(id) {
        winston.debug("Checking cache for manifest %s...", id)
        if (this.cache[id] !== undefined) {
            winston.debug("Found manifest %s in cache.", id)
            return this.cache[id]
        }
        winston.debug("Couldn't find manifest %s in cache.", id)

        winston.debug("Searching the filsystem for manifest %s...", id)
        const competitors = this.dirpaths.map(dirpath => {
            const contestant = path.join(dirpath, id + ".manifest.yaml")
            winston.debug("Will try %s...", contestant)
            return contestant
        })
        const race = await Promise.all(competitors.map(competitor => {
            return this.fromYamlFile(competitor)
        }))
        const winningPaths = lo.compact(race)
        if (winningPaths.length === 0) {
            winston.error("Failed to find manifest file for %s.", id)
            throw new Error(`Manifest not found: ${id}`)
        }
        const winner = winningPaths[0]
        this.cache[id] = winner
        winston.debug("Added %s to the manifest cache.", id)
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
            doc.manifest.defines,
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
