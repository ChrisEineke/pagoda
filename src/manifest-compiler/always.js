const check = require("check-types")


module.exports = {
    Object: function (v) {
        if (check.object(v)) {
            return v
        }
        else if (check.maybe(v)) {
            return {}
        }
        else {
            return { [v]: v }
        }
    },
    Array: function (v) {
        if (check.array(v)) {
            return v
        }
        else if (check.maybe(v)) {
            return []
        }
        else {
            return [ v ]
        }
    }
}
