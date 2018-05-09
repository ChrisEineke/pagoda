const Liquid = require("liquidjs")
const lo = require("lodash")

const engine = Liquid({
    // strict_filters  is used to enable strict filter existence. If set to false, undefined filters will be rendered as
    // empty string. Otherwise, undefined filters will cause an exception. Defaults to false.
    strict_filters: true,
    // strict_variables is used to enable strict variable derivation. If set to false, undefined variables will be
    // rendered as empty string. Otherwise, undefined variables will cause an exception. Defaults to false.
    strict_variables: true,
})

async function renderTemplate(template, context) {
    if (!lo.isString(template)) {
        return template
    }
    return engine.parseAndRender(template, context)
}

module.exports = renderTemplate;
