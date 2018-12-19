// utility functions for sysfs gpios

const fs = require("fs");
const path = require("path");
const { Epoll } = require("epoll");

function GPIO(id) {

    const gdir = "/sys/class/gpio/gpio" + id;
    if (!fs.existsSync(gdir)) {
        let fd = fs.openSync("/sys/class/gpio/export", "w");
        fs.writeSync(fd, id.toString());
    }

    const fd = fs.openSync(path.join(gdir, "value"), "r+");
    const buf = new Buffer(1);

    this.read = function(callback) {
        fs.read(fd, buf, 0, 1, 0, (err, bytes, buffer) => {
            if (callback) callback(err, parseInt(buffer[0]));
        });
    };

    this.write = function(value, callback) {
        let val = ((value != 0) * 1).toString();
        fs.write(fd, val, 0, "ascii", (err, bytes, string) => {
            if (callback) callback(err, string);
        });
    };

    this.active_low = function(value) {
        let val = ((value != 0) * 1).toString();
        let fn = path.join(gdir, "active_low");
        fs.writeFileSync(fn, val);
    };

    this.set_direction = function(value) {
        let fn = path.join(gdir, "direction");
        fs.writeFileSync(fn, value);
    };

    this.set_edge = function(value) {
        let fn = path.join(gdir, "edge");
        fs.writeFileSync(fn, value);
    };

    // creates a poller for the gpio that will run callback on state changes.
    // Returns the poller; caller is responsible for calling poller.close();
    this.new_poller = function(callback) {
        let buffer = new Buffer(1);
        const poller = new Epoll((err, fd, events) => {
            if (err)
                callback(err);
            else {
                fs.readSync(fd, buffer, 0, 1, 0);
                callback(err, buf.toString());
            }
        });
        fs.readSync(fd, buffer, 0, 1, 0);
        poller.add(fd, Epoll.EPOLLPRI);
        return poller;
    }
}

module.exports = GPIO;