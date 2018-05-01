const util = require("util")

function raise(fmt, ...args) {
    const msg = util.format(fmt, ...args)
    throw new Error(msg)
}

module.exports = raise
