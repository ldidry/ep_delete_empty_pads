var API        = require('ep_etherpad-lite/node/db/API'),
    PadManager = require('ep_etherpad-lite/node/db/PadManager'),
    ERR        = require('ep_etherpad-lite/node_modules/async-stacktrace'),
    async      = require('ep_etherpad-lite/node_modules/async');

// Check if we need to delete the pad each time a user leaves
exports.deletePadAtLeave = function(hook, session, cb) {
    var pad = session.padId;
    PadManager.doesPadExists(pad, function(err, exists) {
        if (exists) {
            API.getRevisionsCount(pad, function(err, d) {
                if (d.revisions === 0) {
                    API.deletePad(pad, function(err, d) {
                        console.log('Deleting %s when user leaved since empty', session.padId);
                        cb && cb();
                    });
                } else {
                    cb && cb();
                }
            });
        } else {
            cb && cb();
        }
    });
};

// Delete empty pads at startup
exports.deletePadsAtStart = function (hook_name, args, cb) {
    var i = 0;
    // Deletion queue (avoids max stack size error)
    var q = async.queue(function (pad, cb) {
        API.deletePad(pad, function(err, d) {
            cb && cb();
        });
    }, 2);
    API.listAllPads(function(err, data) {
        async.each(data.padIDs, function(pad, callback) {
            API.getRevisionsCount(pad, function(err, d) {
                if (d.revisions === 0) {
                    // Enqueue the pad for deletion
                    q.push(pad, function(err) {
                        console.log('Deleting %s at startup since empty', pad);
                    });
                }
            });
        });
        cb && cb();
    });
};
