const check = require("check-types")
const lo = require("lodash")


async function walkAsync(x, fn) {
    if (check.array(x)) {
        const y = []
        for (const pair of lo.toPairs(x)) {
            y[pair[0]] = await walkAsync(pair[1], fn)
        }
        return y
    }
    else if (check.object(x)) {
        const y = {}
        for (const pair of lo.toPairs(x)) {
            if (check.array(pair[1]) || check.object(pair[1])) {
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
