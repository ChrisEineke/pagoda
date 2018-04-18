const Ajv = require("ajv")
const fs = require("fs-extra")
const path = require("path")
const raise = require("./raiseFn")
const renderTemplate = require("./render-template")
const util = require("util")
const when = require("when")
const yaml = require("js-yaml")


const ajv = new Ajv()
const schema = require("./template_v1.schema.json")
const validateTemplate = ajv.compile(schema)

class TemplateV1 {

    constructor(id, contents) {
        this.id = id
        this.contents = contents
    }

    generate(context) {
        return when(renderTemplate(this.contents, context)).then((contents) => {
            return {
                id: this.id,
                contents: contents,
            }
        })
    }

}

class TemplateDAO {

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
