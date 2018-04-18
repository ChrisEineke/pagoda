const lo = require("lodash")
const when = require("when")


function walkAsync(x, fn) {
    if (lo.isArray(x)) {
        const y = []
        return when.map(lo.toPairs(x), pair => {
            return when(walkAsync(pair[1], fn)).then(v => {
                y[pair[0]] = v
            })
        }).then(() => {
            return y
        })
    }
    else if (lo.isObject(x)) {
        const y = {}
        return when.map(lo.toPairs(x), pair => {
            if (lo.isArray(pair[1]) || lo.isObject(pair[1])) {
                return when(walkAsync(pair[1], fn)).then(v => {
                    y[pair[0]] = v
                })
            }
            else {
                return when(fn(pair[0], pair[1])).then(pair => {
                    y[pair[0]] = pair[1]
                })
            }
        }).then(() => {
            return y
        })
    }
    else {
        return when(fn(null, x)).then(pair => pair[1])
    }
}

module.exports = walkAsync
