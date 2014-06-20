/* play files to the sound card */
var cp = require("child_process");

function play_sound(path, device, callback) {
  // Starts playing the wave file at path. Calls callback(error, data) when
  // playback starts and ends. Requires aplay. Plays to default ALSA device
  // unless otherwise specified.

  var msg;
  var aplay = cp.spawn("aplay", ["-D", device || "default", path]);
  aplay.stderr.on("data", function(data) {
    if (/^Playing/.test(data)) {
      callback(null, {
        "entity": "sound",
        "time": new Date().getTime(),
        "stimulus": path,
        "playing": 1,
      });
    }
    else {
      msg = ("error: " + data).trimRight();
    }
  })

  aplay.on("close", function (code) {
    if (code == 0) {
      callback(null, {
        "entity": "sound",
        "time": new Date().getTime(),
        "stimulus": path,
        "playing": 0,
      });
    }
    else {
      callback(msg, null);
    }
  })
}

module.exports = {
  "play_sound": play_sound,
};