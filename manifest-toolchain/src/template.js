const Ajv = require("ajv")
const fs = require("fs")
const Liquid = require("liquidjs")
const path = require("path")
const yaml = require("js-yaml")

function raise(fmt, ...args) {
    const msg = util.format(fmt, ...args)
    throw new Error(msg)
}

class TemplateV1 {

    constructor(id, contents) {
        this.id = id
        this.contents = contents
    }

    generate(context) {
        var engine = Liquid();
        engine.parseAndRender(this.contents, context).then(console.log)
    }

}

class TemplateFactory {

    static FromId(id) {
        const templateFilepath = path.join("templates/", id + ".template.yaml")
        return TemplateFactory.FromYamlFile(templateFilepath)
    }

    static FromYamlFile(filepath) {
        const doc = yaml.safeLoad(fs.readFileSync(filepath, "utf-8"))
        return TemplateFactory.FromJsonDoc(doc)
    }

    static FromJsonDoc(doc) {
        const ajv = new Ajv()
        const validate = ajv.compile({
            "type": "object",
            "properties": {
                "version": { "$ref": "#/definitions/version" },
                "templates": { "$ref": "#/definitions/templates" },
            },
            "definitions": {
                "version": { "type": "integer" },
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
                "id": { "type": "string" },
            },
        })
        const valid = validate(doc)
        if (!valid) {
            raise("Invalid template format: %j", ajv.errors)
        }
        if (doc.version != 1) {
            raise("Invalid version: given %d, supported %d", doc.version, 1)
        }
        return doc.templates.map(function (t, i) {
            return new TemplateV1(t.id, t.contents)
        })
    }
}

module.exports.TemplateV1 = TemplateV1
module.exports.Factory =  TemplateFactory
