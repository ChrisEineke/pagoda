const Liquid = require("liquidjs")
const lo = require("lodash")

const engine = Liquid()

async function renderTemplate(template, context) {
    if (!lo.isString(template)) {
        return template
    }
    return engine.parseAndRender(template, context)
}

module.exports = renderTemplate;
