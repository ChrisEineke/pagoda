const lo = require("lodash")

async function walkAsync(x, fn) {
    if (lo.isArray(x)) {
        const y = []
        for (const pair of lo.toPairs(x)) {
            y[pair[0]] = await walkAsync(pair[1], fn)
        }
        return y
    }
    else if (lo.isObject(x)) {
        const y = {}
        for (const pair of lo.toPairs(x)) {
            if (lo.isArray(pair[1]) || lo.isObject(pair[1])) {
                y[pair[0]] = await walkAsync(pair[1], fn)
            }
            else {
                const transformedPair = await fn(pair[0], pair[1])
                y[transformedPair[0]] = transformedPair[1]
            }
        }
        return y
    }
    else {
        const pair = await fn(null, x)
        return pair[1]
    }
}

module.exports = walkAsync
