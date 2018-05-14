const Ajv = require("ajv")
const always = require("./always")
const check = require("check-types")
const fs = require("fs-extra")
const lo = require("lodash")
const ManifestV1 = require("./manifest")
const ManifestV1Schema = require("./manifest_v1.schema.json")
const path = require("path")
const raise = require("./raiseFn")
const StereotypeV1 = require("./stereotype")
const StereotypeV1Schema = require("./stereotype_v1.schema.json")
const TemplateV1 = require("./template")
const TemplateV1Schema = require("./template_v1.schema.json")
const winston = require("winston")
const yaml = require("js-yaml")


const ajv = new Ajv({ useDefaults: true })
const validateManifestV1 = ajv.compile(ManifestV1Schema)
const validateStereotypeV1 = ajv.compile(StereotypeV1Schema)
const validateTemplateV1 = ajv.compile(TemplateV1Schema)

class DocumentDAO {

    constructor(kwargs) {
        check.assert.object(kwargs)
        this.manifestSearchpath = check.assert.array.of.string(kwargs.manifestSearchpath)
        this.stereotypeSearchpath = check.assert.array.of.string(kwargs.stereotypeSearchpath)
        this.templateSearchpath = check.assert.array.of.string(kwargs.templateSearchpath)
        this.cache = {}
    }

    /**
     * Creates a DocumentDAO with the searchpath for manifests, stereotypes, and templates derived from the (possibly
     * relative) filepath of the manifest to be dumped/compiled.
     */
    static createBasedOnManifestFilepath(manifestFilepath) {
        check.assert.nonEmptyString(manifestFilepath)

        const absManifestFilepath = path.isAbsolute(manifestFilepath)
            ? manifestFilepath
            : path.resolve(process.cwd(), manifestFilepath)
        const absManifestDirpath = path.dirname(absManifestFilepath)

        const manifestSearchpath = []
        manifestSearchpath.push(absManifestDirpath)
        for (const i of ["manifests", "resources", "integrations", "deployments"]) {
            // directories in the directory that contains the manifest
            manifestSearchpath.push(path.resolve(path.dirname(absManifestFilepath), i))
            // directories in the current working directory
            manifestSearchpath.push(path.resolve(process.cwd(), i))
            // the current working directory
        }
        manifestSearchpath.push(process.cwd())

        const templateSearchpath = []
        templateSearchpath.push(absManifestDirpath)
        // 'templates' directory in the directory that contains the manifest
        templateSearchpath.push(path.resolve(path.dirname(absManifestFilepath), "templates"))
        // directory that contains the manifest
        templateSearchpath.push(path.dirname(absManifestFilepath))
        // 'templates' directory in the current working directory
        templateSearchpath.push(path.resolve(process.cwd(), "templates"))
        // the current working directory
        templateSearchpath.push(process.cwd())

        const stereotypeSearchpath = []
        // 'stereotypes' directory in the directory that contains the manifest
        stereotypeSearchpath.push(path.resolve(path.dirname(absManifestFilepath), "stereotypes"))
        // directory that contains the manifest
        stereotypeSearchpath.push(path.dirname(absManifestFilepath))
        // 'stereotypes' directory in the current working directory
        stereotypeSearchpath.push(path.resolve(process.cwd(), "stereotypes"))
        // the current working directory
        stereotypeSearchpath.push(process.cwd())

        return new DocumentDAO({ manifestSearchpath, templateSearchpath, stereotypeSearchpath })
    }

    async getManifest(ref) {
        if (lo.isString(ref)) {
            const isNameOfFile = await fs.pathExists(ref)
            if (isNameOfFile) {
                return [ ref, await this._getManifestByFilename(ref) ]
            }
            else {
                return [ ref, await this._getManifestById(ref) ]
            }
        }
        else if (lo.isArray(ref)) {
            return ref.map(ref => {
                return [ ref.id, this._getManifestFromJsonDoc(Object.assign({}, { version: 1 }, { manifests: ref })) ]
            })
        }
        else if (lo.isObject(ref)) {
            return [ ref.id, this._getManifestFromJsonDoc(Object.assign({}, { version: 1 }, { manifest: ref })) ]
        }
        else {
            throw new Error(`Unsupported manifest reference type: ${typeof ref}`)
        }
    }

    async _getManifestByFilename(filepath) {
        const exists = await fs.pathExists(filepath)
        if (!exists) {
            winston.debug("Manifest YAML file %s does not exist.", filepath)
            return null
        }
        const doc = yaml.safeLoad(fs.readFileSync(filepath, "utf-8"))
        return this._getManifestFromJsonDoc(doc)
    }

    async _getManifestById(id) {
        winston.debug("Checking cache for manifest %s.", id)
        if (this.cache[id] !== undefined) {
            winston.debug("Found manifest %s in cache.", id)
            return this.cache[id]
        }
        winston.debug("Couldn't find manifest %s in cache.", id)

        winston.debug("Searching the filsystem for manifest %s.", id)
        const competitors = this.manifestSearchpath.map(dirpath => {
            const contestant = path.join(dirpath, id + ".manifest.yaml")
            winston.debug("Will try %s.", contestant)
            return contestant
        })
        const race = await Promise.all(competitors.map(competitor => {
            return this._getManifestByFilename(competitor)
        }))
        const winningPaths = lo.compact(race)
        if (winningPaths.length === 0) {
            winston.error("Failed to find manifest file for %s.", id)
            throw new Error(`Manifest not found: ${id}`)
        }
        const winner = winningPaths[0]
        this.cache[id] = winner
        winston.debug("Added %s to the cache.", id)
        return winner
    }

    _getManifestFromJsonDoc(doc) {
        const valid = validateManifestV1(doc)
        if (!valid) {
            raise("Invalid manifest format: %j", validateManifestV1.errors)
        }
        if (doc.version != 1) {
            raise("Invalid version: given %d, supported %d", doc.version, 1)
        }
        return new ManifestV1(
            doc.manifest.id,
            doc.manifest.owner,
            always.Array(doc.manifest.stereotypes),
            always.Array(doc.manifest.requires),
            always.Object(doc.manifest.defines),
            always.Array(doc.manifest.resources),
            always.Array(doc.manifest.integrations),
            always.Array(doc.manifest.deployments),
            always.Array(doc.manifest.templates))
    }

    async putManifest(ref, manifest) {
        try {
            const yamlString = yaml.safeDump(manifest, { skipInvalid: true })
            if (check.maybe.nonEmptyString(ref) === true) {
                return yamlString
            }
            return await fs.writeFile(ref, yamlString)
        }
        catch (e) {
            winston.error("Failed to convert value to YAML: %j", manifest, e)
            return null
        }
    }

    async getStereotype(ref) {
        if (lo.isString(ref)) {
            const isNameOfFile = await fs.pathExists(ref)
            if (isNameOfFile) {
                return [ ref, await this._getStereotypeByFilename(ref) ]
            }
            else {
                return [ ref, await this._getStereotypeById(ref) ]
            }
        }
        else if (lo.isArray(ref)) {
            return ref.map(ref => {
                return [ ref.id, this._getStereotypeFromJsonDoc(Object.assign({}, { version: 1 }, { stereotypes: ref })) ]
            })
        }
        else if (lo.isObject(ref)) {
            return [ ref.id, this._getStereotypeFromJsonDoc(Object.assign({}, { version: 1 }, { stereotype: ref })) ]
        }
        else {
            throw new Error(`Unsupported stereotype reference type: ${typeof ref}`)
        }
    }

    async _getStereotypeById(id) {
        winston.debug("Checking cache for stereotype %s.", id)
        if (this.cache[id] !== undefined) {
            winston.debug("Found stereotype %s in cache.", id)
            return this.cache[id]
        }
        winston.debug("Couldn't find stereotype %s in cache.", id)

        winston.debug("Searching the filsystem for stereotype %s.", id)
        const competitors = this.stereotypeSearchpath.map(dirpath => {
            const contestant = path.join(dirpath, id + ".stereotype.yaml")
            winston.debug("Will try %s.", contestant)
            return contestant
        })
        const race = await Promise.all(competitors.map(competitor => {
            return this._getStereotypeByFilename(competitor)
        }))
        const winningPaths = lo.compact(race)
        if (winningPaths.length === 0) {
            winston.error("Failed to find stereotype file for %s.", id)
            throw new Error(`Stereotype not found: ${id}`)
        }
        const winner = winningPaths[0]
        this.cache[id] = winner
        winston.debug("Added %s to the cache.", id)
        return winner
    }

    async _getStereotypeByFilename(filepath) {
        const exists = await fs.pathExists(filepath)
        if (exists === false) {
            winston.debug("Stereotype YAML file %s does not exist.", filepath)
            return null
        }
        const doc = yaml.safeLoad(fs.readFileSync(filepath, "utf-8"))
        return this._getStereotypeFromJsonDoc(doc)
    }

    _getStereotypeFromJsonDoc(doc) {
        const valid = validateStereotypeV1(doc)
        if (!valid) {
            raise("Invalid stereotype format: %j", validateStereotypeV1.errors)
        }
        if (doc.version != 1) {
            raise("Invalid version: given %d, supported %d", doc.version, 1)
        }
        return new StereotypeV1(
            doc.stereotype.id,
            doc.stereotype.owner,
            always.Array(doc.stereotype.requires),
            always.Object(doc.stereotype.defines),
            always.Array(doc.stereotype.resources),
            always.Array(doc.stereotype.integrations),
            always.Array(doc.stereotype.deployments),
            always.Array(doc.stereotype.templates))
    }

    async getTemplate(ref) {
        if (lo.isString(ref)) {
            const isNameOfFile = await fs.pathExists(ref)
            if (isNameOfFile) {
                return [ ref, await this._getTemplateByFilename(ref) ]
            }
            else {
                return [ ref, await this._getTemplateById(ref) ]
            }
        }
        else if (lo.isArray(ref)) {
            return ref.map(ref => {
                return [ ref.id, this._getTemplateFromJsonDoc(Object.assign({}, { version: 1 }, { templates: ref })) ]
            })
        }
        else if (lo.isObject(ref)) {
            return [ ref.id, this._getTemplateFromJsonDoc(Object.assign({}, { version: 1 }, { template: ref })) ]
        }
        else {
            throw new Error(`Unsupported template reference type: ${typeof ref}`)
        }
    }

    async _getTemplateByFilename(filepath) {
        const exists = await fs.pathExists(filepath)
        if (exists === false) {
            winston.debug("Template YAML file %s does not exist.", filepath)
            return null
        }
        const doc = yaml.safeLoad(fs.readFileSync(filepath, "utf-8"))
        return this._getTemplateFromJsonDoc(doc)
    }

    async _getTemplateById(id) {
        winston.debug("Checking cache for template %s.", id)
        if (this.cache[id] !== undefined) {
            winston.debug("Found template %s in cache.", id)
            return this.cache[id]
        }
        winston.debug("Couldn't find template %s in cache.", id)

        winston.debug("Searching the filsystem for template %s.", id)
        const competitors = this.templateSearchpath.map(dirpath => {
            const contestant = path.join(dirpath, id + ".template.yaml")
            winston.debug("Will try %s.", contestant)
            return contestant
        })
        const race = await Promise.all(competitors.map(competitor => {
            return this._getTemplateByFilename(competitor)
        }))
        const winningPaths = lo.compact(race)
        if (winningPaths.length === 0) {
            winston.error("Failed to find template file for %s.", id)
            throw new Error(`template not found: ${id}`)
        }
        const winner = winningPaths[0]
        this.cache[id] = winner
        winston.debug("Added %s to the cache.", id)
        return winner
    }

    _getTemplateFromJsonDoc(doc) {
        const valid = validateTemplateV1(doc)
        if (!valid) {
            raise("Invalid template format: %j", validateTemplateV1.errors)
        }
        if (doc.version != 1) {
            raise("Invalid version: given %d, supported %d", doc.version, 1)
        }
        var templates
        if (doc.template) {
            templates = [ doc.template ]
        } else {
            templates = doc.templates
        }
        return templates.map(function (template) {
            return new TemplateV1(template.id, template.contents)
        })
    }

}

module.exports = DocumentDAO
