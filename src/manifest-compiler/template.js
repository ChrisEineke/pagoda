const Ajv = require("ajv")
const fs = require("fs-extra")
const lo = require("lodash")
const path = require("path")
const raise = require("./raiseFn")
const renderTemplate = require("./render-template")
const util = require("util")
const winston = require("winston")
const yaml = require("js-yaml")


const ajv = new Ajv()
const schema = require("./template_v1.schema.json")
const validateTemplate = ajv.compile(schema)

class TemplateV1 {

    constructor(id, contents) {
        this.id = id
        this.contents = contents
    }

    async generate(context) {
        const contents = await renderTemplate(this.contents, context)
        return {
            id: this.id,
            contents: contents,
        }
    }

}

class TemplateDAO {

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
                return [ ref.id, this.fromJsonDoc(Object.assign({}, { version, templates: ref })) ]
            })
        }
        else if (lo.isObject(ref)) {
            return [ ref.id, this.fromJsonDoc(Object.assign({}, { version, template: ref })) ]
        }
        else {
            throw new Error(`Unsupported template reference type: ${typeof ref}`)
        }
    }

    async fromId(id) {
        winston.debug("Checking cache for template %s...", id)
        if (this.cache[id] !== undefined) {
            winston.debug("Found template %s in cache.", id)
            return this.cache[id]
        }
        winston.debug("Couldn't find template %s in cache.", id)

        winston.debug("Searching the filsystem for template %s...", id)
        const competitors = this.dirpaths.map(dirpath => {
            const contestant = path.join(dirpath, id + ".template.yaml")
            winston.debug("Will try %s...", contestant)
            return contestant
        })
        const race = await Promise.all(competitors.map(competitor => {
            return this.fromYamlFile(competitor)
        }))
        const winningPaths = lo.compact(race)
        if (winningPaths.length === 0) {
            winston.error("Failed to find template file for %s.", id)
            throw new Error(`template not found: ${id}`)
        }
        const winner = winningPaths[0]
        this.cache[id] = winner
        winston.debug("Added %s to the template cache.", id)
        return winner
    }

    fromYamlFile(filepath) {
        return fs.pathExists(filepath).then(exists => {
            if (exists === false) {
                return null
            }
            const doc = yaml.safeLoad(fs.readFileSync(filepath, "utf-8"))
            return this.fromJsonDoc(doc)
        })
    }

    fromJsonDoc(doc) {
        const valid = validateTemplate(doc)
        if (!valid) {
            raise("Invalid template format: %j", validateTemplate.errors)
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
        return templates.map(function (template, i) {
            return new TemplateV1(template.id, template.contents)
        })
    }
}

module.exports.TemplateV1 = TemplateV1
module.exports.TemplateDAO = TemplateDAO
