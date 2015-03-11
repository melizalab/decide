// state machine for feeder - uses PRU PWM

var winston = require("winston");
var fs = require("fs");
var path = require("path");
var _ = require("underscore");
var bindings = require("bindings");
var util = require("./util");

var pwm_index = {
    "starboard:hopper:left": 1,
    "starboard:hopper:right": 0
}

function feeder(params, addr, pub) {

    var meta = {
        type: "feeder",
        dir: "output",
        variables: {
            feeding: [true, false],
            interval: "float"
        }
    }

    var par = {
        device: "starboard:hopper:left",
        mode: "pulse-hold",
        pulse_dur: 100,
        pulse_duty: 35,
        hold_duty: 10
    };
    util.update(par, params);

    var state = {
        feeding: false,
        interval: 4000,             // duration of feeding
    };
    var reset = _.clone(state);

    // this will get called once for each feeder, so hopefully the module
    // initialization code is left alone
    var pwm = bindings("pwm");
    var pru_code = path.resolve(__dirname, "../native/pwm.bin");
    winston.debug("loading PRU code from %s", pru_code);
    pwm.start(pru_code);
    winston.debug("%s feeder using PRU-PWM driver", par.device);

    function set_state(data, rep) {
        if (data.interval)
            state.interval = data.interval;
        if (state.feeding == data.feeding) {
            rep();
            return;
        }
        if (data.feeding) {
            pwm.pulse(pwm_index[par.device],
                      par.pulse_duty,
                      par.pulse_dur,
                      par.hold_duty);
            state.feeding = true;
            _.delay(set_state, state.interval, {feeding: false}, function() {});
        }
        else {
            pwm.duty(pwm_index[par.device], 0);
            state.feeding = false;
        }
        pub.emit("state-changed", addr, state);
        rep();
    }

    var me = {
        req: function(msg, data, rep) {
            winston.debug("req to feeder %s:", par.device, msg, data);
            if (msg == "change-state")
                set_state(data, rep);
            else if (msg == "reset-state")
                set_state(reset, rep);
            else if (msg == "get-state")
                rep(null, state);
            else if (msg == "get-meta")
                rep(null, meta);
            else if (msg == "get-params")
                rep(null, par);
            else
                rep("invalid or unsupported REQ type");
        }
    };

    pub.emit("state-changed", addr, state);

    return me;
}

module.exports = feeder;