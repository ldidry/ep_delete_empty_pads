var  PadManager = require('ep_etherpad-lite/node/db/PadManager'),
  async      = require('ep_etherpad-lite/node_modules/async');

// Check if we need to delete the pad each time a user leaves
exports.deletePadAtLeave = function(hook, session, cb) {
  PadManager.getPad(session.padId, function (err, pad) {
    if (err) { return cb(err); }
    if (pad.getHeadRevisionNumber() === 0) {
      console.log('Deleting %s when user leaved since empty', session.padId);
      pad.remove(cb);
    } else {
      cb();
    }
  });
};

// Delete empty pads at startup
exports.deletePadsAtStart = function (hook_name, args, cb) {
  // Deletion queue (avoids max stack size error), 4 workers
  var q = async.queue(function (pad, callback) { pad.remove(callback); }, 4);
  PadManager.listAllPads(function (err, data) {
    async.each(data.padIDs, function (padId, cb) {
      PadManager.getPad(padId, function (err, pad) {
        if (err) { return cb(err); }
        if (pad.getHeadRevisionNumber() === 0) {
          q.push(pad, function (err) {
            if (err) { return cb(err); }
            console.log('Deleting %s at startup since empty', pad.id);
          });
        }
      });
    });
  });
};
