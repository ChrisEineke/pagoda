const Liquid = require("liquidjs")
const lo = require("lodash")
const when = require("when")

const engine = Liquid()

function renderTemplate(template, context) {
    if (!lo.isString(template)) {
        return when(template)
    }
    return engine.parseAndRender(template, context)
}

module.exports = renderTemplate;
