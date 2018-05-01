const util = require("util")
const winston = require("winston")

function raise(fmt, ...args) {
    const msg = util.format(fmt, ...args)
    winston.error(msg)
    throw new Error(msg)
}

module.exports = raise
