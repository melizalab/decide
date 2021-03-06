// The peckboard is basically a pcf8575 chip, which is an i2c-based gpio
// expander. The chip has an active-low interrupt line which needs to be
// connected to a gpio so that the beagleboard can be notified of changes.
//
// To use this class, the BBB-PeckBoard device tree overlay needs to be
// installed, or the i2c adapter needs to be activated using sysfs (echo pcf8575
// 0x20 > /sys/class/i2c-adapter/i2c-1/new_device). This class takes care of
// making sure the gpios are exported and that the interrupt gpio is set to
// detect the right events. (NB: sysfs for gpios is being replaced by gpiod)

const fs = require("fs");
const path = require("path");
const _ = require("underscore");
const GPIO = require("./gpio");
const winston = require("winston");
const util = require("./util");

function peckboard(params, name, pub) {

    const par = {
        device: "/sys/class/gpio/gpiochip496",
        interrupt_gpio: 48,
        keymap: {
            // these are offset from the base of the gpiochip
            peck_left: 13,
            peck_center: 14,
            peck_right: 15
        }
    };
    util.update(par, params);

    const meta = {
        type: "key",
        dir: "input",
        variables: {}
    };

    const trig_gpio = new GPIO(par.interrupt_gpio);
    trig_gpio.set_direction("in");
    trig_gpio.active_low(true);
    const gpios = {};

    const state = {};
    _.each(par.keymap, (v, k) => {
        state[k] = 0;
        gpios[k] = new GPIO(v, par.device);
        meta.variables[k] = [0, 1];
    });

    function check_keys(err, trig_state) {
        _.each(gpios, (gpio, key) => {
            gpio.read((err, value) => {
                if (err)
                    pub.emit("warning", name, "error reading from " + key);
                else if (state[key] != value) {
                    state[key] = value;
                    pub.emit("state-changed", name, {[key] : value});
                }
            });
        });
    }

    if (!util.is_a_dummy())
        winston.debug("peckboard: start monitoring gpio%s for events", par.interrupt_gpio);
    else
        winston.debug("peckboard: in dummy mode; only simulated keypresses will work");

    const trig_poller = trig_gpio.new_poller("rising", check_keys);

    const me = {
        pub: function () {},

        req: function (msg, data, rep) {
            winston.debug("req to keys %s:", par.device, msg, data);
            if (msg == "change-state") {
                // allows dummy keypress
                let upd = {};
                for (let key in data) {
                    if (key in state && state[key] != data[key]) {
                        state[key] = upd[key] = data[key];
                    }
                }
                if (!_.isEmpty(upd))
                    pub.emit("state-changed", name, upd);
                rep();
            }
            else if (msg == "reset-state")
                rep();
            else if (msg == "get-state")
                rep(null, state);
            else if (msg == "get-meta")
                rep(null, meta);
            else if (msg == "get-params")
                rep(null, par);
            else
                rep("invalid or unsupported REQ type");
        },

        disconnect: function() {
            winston.debug("peckboard: stop monitoring gpio%s for events", par.interrupt_gpio);
            trig_poller.close();
        }
    };

    pub.emit("state-changed", name, state);
    return me;

}

module.exports = peckboard;
