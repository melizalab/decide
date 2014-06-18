/*
 * lightweight replacement for bonescript using gpio-led and gpio-key drivers.
 *
 * example:
 * var b = require("./bonescript-lite");
 * // if cape not already loaded
 * var cape = b.read_eeprom("1-0054");
 * b.init_overlay(cape.part, cape.revision);
 * // turn on center green led
 * b.led_write("starboard:center:green", 1, console.log)
 */

var fs = require('fs');
var glob = require("glob");
var debug = process.env.DEBUG ? true : false;

var f = {};

f.init_overlay = function(board, revision) {
  // loads the device tree overlay, if it hasn't been already
  var capemgr = glob.sync("/sys/devices/bone_capemgr.*");
  var slots = fs.readFileSync(capemgr[0] + "/slots");
  // not a very good test
  var re = new RegExp(board);
  if (re.exec(slots)) return;
  fs.writeFileSync(capemgr[0] + "/slots", board + ":" + revision);
}

f.read_eeprom = function(addr) {
  // Returns the contents of a cape eeprom on the i2c bus at addr
  var path = "/sys/bus/i2c/devices/" + addr + "/eeprom";
  var fd = fs.openSync(path, "r");
  var buf = new Buffer(244);
  fs.readSync(fd, buf, 0, 244, 0);
  return {
    "board": buf.toString('ascii', 6, 6 + 32).replace(/\u0000/g, ""),
    "part": buf.toString('ascii', 58, 58 + 16).replace(/\u0000/g, ""),
    "revision": buf.toString("ascii", 38, 38 + 4),
    "serial": buf.toString("ascii", 76, 76 + 12)
  }
}

f.gpio_monitor = function(dev, callback) {
  // monitors a /dev/input device. This is used to capture events from GPIO
  // inputs that have been defined with gpio-keys in the device tree. For each
  // rising or falling event, callback is called with the timestamp [seconds,
  // microseconds], the key code, and the value (1 for falling and 0 for
  // rising). Dev is usually input1 or event1 for the BBB.


  var EV_KEY = 1;

  var bufsize = 24;
  var buf = new Buffer(bufsize);
  var fd;

  function reader(err, fdx) {
    fd = fdx;
    if (err) {
      callback(err, null);
      return;
    }

    // For me, the buffer indexes were originally 8 off with everything but time, which was 4 off
    fs.read(fd, buf, 0, bufsize, null, function(err, N) {
      if (err === null && buf.readUInt16LE(8) === EV_KEY) {
        callback(null, {
          'time': [buf.readUInt32LE(0), buf.readUInt32LE(4)],
          'key': buf.readUInt16LE(10),
          'value': buf.readUInt32LE(12),
        })
      }
      if (fd !== null) reader(err, fd);
    });
  }
  reader.close = function() {
    fd = null;
  };

  fs.open("/dev/input/" + dev, "r", reader);
  return reader;
};

f.led_read = function(led, callback) {
  // reads the current brightness of LED and returns it in a callback
  var led = "/sys/class/leds/" + led;
  fs.readFile(led + "/brightness", function(err, data) {
    if (callback) {
      if (err) callback(err, null);
      else callback(null, {
        "led": led,
        "value": parseInt(data)
    });
    }
  }
);
}

f.led_write = function(led, value, callback) {
  // write a value to an LED. The LED trigger is set to 'none' and value is
  // written to brightness. For LEDs on a GPIO, any nonzero value turns the LED
  // on. For LEDs on a PWM, the value determines the duty of the timer. When the
  // write is complete, callback(err, {"led": led, "value": value}) is called.
  var led = "/sys/class/leds/" + led;
  fs.writeFileSync(led + "/trigger", "none");
  fs.writeFile(led + "/brightness", value, function(err) {
    if (callback){
    if (err) callback(err, null);
    else if (callback) callback(null, {
      "led": led,
      "value": value
    });
    }
  });
};

f.led_timer = function(led, ms_on, ms_off, callback) {
  // flash an LED using the internal kernel timer. The LED trigger is set to
  // 'timer' and the ms_on and ms_off values are used to set the timer period
  // and duty cycle. When the setup is complete, callback is called. The
  // behavior during the first cycle may be undefined if the default on and off
  // times are different from the ones requested. Use led_write to turn the
  // timer off.
  var led = "/sys/class/leds/" + led;
  fs.writeFileSync(led + "/trigger", "timer");
  fs.writeFileSync(led + "/delay_on", ms_on);
  fs.writeFile(led + "/delay_off", ms_off, function(err) {
    if (callback) {
    if (err) callback(err, null);
    else callback(null, {
      "led": led,
      "value": "timer",
      "on_off": [ms_on, ms_off]
    });
    }
  });
};

f.led_oneshot = function(led, ms_on, callack) {
  // Turn on a LED once for a specified period of time. The LED trigger is set
  // to 'oneshot'. When the LED is turned on, the callback is called. There
  // doesn't seem to be a way to generate a callback when the event is over. If
  // this is important, use led_write
  var led = "/sys/class/leds/" + led;
  fs.writeFileSync(led + "/trigger", "oneshot");
  fs.writeFileSync(led + "/delay_on", ms_on);
  fs.writeFileSync(led + "/delay_off", "0");
  fs.writeFile(led + "/shot", 1, function(err) {
    if (callback){
    if (err) callback(err, null);
    else if (callback) callback(null, {
      "led": led,
      "value": "oneshot",
      "on_off": [ms_on, ms_off]
    });
    }
  })

}

module.exports = f;
