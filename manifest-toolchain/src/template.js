const Ajv = require("ajv")
const fs = require("fs-extra")
const Liquid = require("liquidjs")
const path = require("path")
const util = require("util")
const when = require("when")
const yaml = require("js-yaml")


const ajv = new Ajv()
const engine = Liquid();

function raise(fmt, ...args) {
    const msg = util.format(fmt, ...args)
    throw new Error(msg)
}

const TEMPLATE_V1_SCHEMA = {
    "type": "object",
    "properties": {
        "version":   { "$ref": "#/definitions/version" },
        "template": { "$ref": "#/definitions/template" },
        "templates": { "$ref": "#/definitions/templates" },
    },
    "definitions": {
        "version": { "type": "integer" },
        "id": { "type": "string" },
        "templates": {
            "type": "array",
            "items": { "$ref": "#/definitions/template" }
        },
        "template": {
            "type": "object",
            "properties": {
                "id": { "$ref": "#/definitions/id" },
                "contents": { "type": "string" },
            },
        },
    },
}

class TemplateV1 {

    constructor(id, contents) {
        this.id = id
        this.contents = contents
    }

    generate(context) {
        return when(engine.parseAndRender(this.contents, context)).then((contents) => {
            return {
                id: this.id,
                contents: contents,
            }
        })
    }

}

class TemplateFactory {

    constructor(dirpaths) {
        this.dirpaths = dirpaths
    }

    fromId(id) {
        const competitors = this.dirpaths.map(dirpath => {
            return path.join(dirpath, id + ".template.yaml")
        })
        return when.map(competitors, competitor => {
            return this.fromYamlFile(competitor)
        }).then(race => {
            const winner = race.filter(x => !!x)[0]
            if (!winner) {
                raise("Template ID not found: %s", id)
            }
            return winner
        })
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
        const validate = ajv.compile(TEMPLATE_V1_SCHEMA)
        const valid = validate(doc)
        if (!valid) {
            raise("Invalid template format: %j", ajv.errors)
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
module.exports.TemplateFactory =  TemplateFactory
