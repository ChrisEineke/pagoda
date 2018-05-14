const renderTemplate = require("./render-template")


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

module.exports = TemplateV1
