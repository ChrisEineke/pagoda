const Jsonnet = require('jsonnet');
const Liquid = require("liquidjs")
const lo = require("lodash")

const liquidJsEngine = Liquid({
    // strict_filters  is used to enable strict filter existence. If set to false, undefined filters will be rendered as
    // empty string. Otherwise, undefined filters will cause an exception. Defaults to false.
    strict_filters: true,
    // strict_variables is used to enable strict variable derivation. If set to false, undefined variables will be
    // rendered as empty string. Otherwise, undefined variables will cause an exception. Defaults to false.
    strict_variables: true,
})
const jsonnetEngine = new Jsonnet();

async function renderTemplate(text, context, engineName) {
    if (!lo.isString(text)) {
        return text
    }
    if (!engineName) {
        // Default to liquidjs because that's the syntax stereotypes use.
        engineName = 'liquidjs'
    }
    switch (engineName.toLowerCase().trim()) {
    case "liquidjs":
        return liquidJsEngine.parseAndRender(text, context)
    case "jsonnet":
        // Generate a series of 'local <key> = <value>;' statements.
        const definitions = lo.flatMap(context, (value, key) => {
            return `local ${key} = ${JSON.stringify(value)};`
        }).join('\n') + '\n'
        return jsonnetEngine.eval(definitions + text)
    default:
        throw new Error(`Unsupported template engine ${engineName}`)
    }
}

module.exports = renderTemplate;
