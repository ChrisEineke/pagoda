const lo = require("lodash")

module.exports = {
    Object: function (v) {
        if (lo.isObject(v)) {
            return v
        }
        else if (lo.isNil(v)) {
            return {}
        }
        else {
            return { [v]: v }
        }
    },
    Array: function (v) {
        if (lo.isArray(v)) {
            return v
        }
        else if (lo.isNil(v)) {
            return []
        }
        else {
            return [ v ]
        }
    }
}
