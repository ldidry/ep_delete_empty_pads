var PadManager = require('ep_etherpad-lite/node/db/PadManager'),
    async      = require('ep_etherpad-lite/node_modules/async');

var epVersion = parseFloat(require('ep_etherpad-lite/package.json').version);
var usePromises = epVersion >= 1.8
var getPad, listAllPads, doesPadExists

if (usePromises) {
  getPad = callbackify2(PadManager.getPad)
  doesPadExists = callbackify1(PadManager.doesPadExists)
  listAllPads = callbackify0(PadManager.listAllPads)
} else {
  getPad = PadManager.getPad
  doesPadExists = PadManager.doesPadExists
  listAllPads = PadManager.listAllPads
}

// Check if we need to delete the pad each time a user leaves
exports.deletePadAtLeave = function(hook, session, cb) {
    if (session !== undefined && session !== null) {
        var pad = session.padId;
        doesPadExists(pad, function(err, exists) {
            if (exists !== undefined && exists !== null) {
                if (exists) {
                    getPad(pad, null, function (err, pad) {
                        if (err) {
                            return cb(err);
                        }
                        var head = pad.getHeadRevisionNumber();
                        if (head !== undefined && head !== null) {
                            if (head === 0) {
                                console.log('Deleting %s when user leaved since empty', session.padId);
                                var remove = getRemoveFun(pad)
                                remove(cb);
                            } else {
                                cb();
                            }
                        }
                    });
                } else {
                    cb();
                }
            }
        });
    }
};

// Delete empty pads at startup
exports.deletePadsAtStart = function (hook_name, args, cb) {
    // Deletion queue (avoids max stack size error), 2 workers
    var q = async.queue(function (pad, callback) {
        var remove = getRemoveFun(pad)
        remove(callback);
    }, 2);
    // Emptyness test queue
    var p = async.queue(function(padId, callback) {
        getPad(padId, null, function (err, pad) {
            if (err) {
                return callback(err);
            }
            var head = pad.getHeadRevisionNumber();
            if (head !== undefined && head !== null) {
                if (head === 0) {
                    q.push(pad, function (err) {
                        if (err) {
                            return callback(err);
                        }
                        console.log('Deleting %s at startup since empty', pad.id);
                    });
                }
                callback();
            }
        });
    }, 1);

    listAllPads(function (err, data) {
        for (var i = 0; i < data.padIDs.length; i++) {
            var padId = data.padIDs[i];
            p.push(padId, function(err) {
                if (err) {
                    return cb(err);
                }
            });
        }
    });
};

function wrapPromise (p, cb) {
  return p.then(function (result) { cb(null, result); })
    .catch(function(err) { cb(err); });
}

function callbackify0 (fun) {
  return function (cb) {
    return wrapPromise(fun(), cb);
  };
};

function callbackify1 (fun) {
  return function (arg1, cb) {
    return wrapPromise(fun(arg1), cb);
  };
};

function callbackify2 (fun) {
  return function (arg1, arg2, cb) {
    return wrapPromise(fun(arg1, arg2), cb);
  };
};

function getRemoveFun (pad) {
  var fun = pad.remove.bind(pad)

  if (usePromises) {
    return callbackify0(fun)
  }

  return fun
}
