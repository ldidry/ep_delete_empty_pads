const log4js = require('ep_etherpad-lite/node_modules/log4js');
const logger = log4js.getLogger('ep_delete_empty_pads');

var PadManager = require('ep_etherpad-lite/node/db/PadManager'),
    asyncM     = require('ep_etherpad-lite/node_modules/async');

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
exports.deletePadAtLeave = (hook, session, cb) => {
    if (session !== undefined && session !== null) {
        var pad = session.padId;
        doesPadExists(pad, (err, exists) => {
            if (exists !== undefined && exists !== null) {
                if (exists) {
                    getPad(pad, null, (err, pad) => {
                        if (err && !usePromises) {
                            return cb(err);
                        }
                        var head = pad.getHeadRevisionNumber();
                        if (head !== undefined && head !== null) {
                            if (head === 0) {
                                logger.info('Deleting '+session.padId+' when user leaved since empty');
                                var remove = getRemoveFun(pad)
                                if (usePromises) {
                                    remove(() => {});
                                } else {
                                    remove(cb);
                                }
                            } else if (!usePromises) {
                                cb();
                            }
                        }
                    });
                } else if (!usePromises) {
                    cb();
                }
            }
        });
    }
    if (usePromises) { return cb(); }
};

// Delete empty pads at startup
exports.deletePadsAtStart = (hook_name, args, cb) => {
    // Deletion queue (avoids max stack size error), 2 workers
    var q = asyncM.queue((pad, callback) => {
        var remove = getRemoveFun(pad)
        remove(callback);
    }, 2);
    // Emptyness test queue
    var p = asyncM.queue((padId, callback) => {
        getPad(padId, null, (err, pad) => {
            if (err) {
                return callback(err);
            }
            var head = pad.getHeadRevisionNumber();
            if (head !== undefined && head !== null) {
                if (head === 0) {
                    q.push(pad, (err) => {
                        if (err) {
                            return callback(err);
                        }
                        logger.info('Deleting '+pad.id+' at startup since empty');
                    });
                }
                callback();
            }
        });
    }, 1);

    listAllPads((err, data) => {
        for (var i = 0; i < data.padIDs.length; i++) {
            var padId = data.padIDs[i];
            p.push(padId, (err) => {
                if (err && !usePromises) {
                    return cb(err);
                }
            });
        }
    });
    if (usePromises) { return cb(); }
};

function wrapPromise (p, cb) {
  return p.then((result) => { cb(null, result); })
    .catch((err) => { cb(err); });
}

function callbackify0 (fun) {
  return (cb) => {
    return wrapPromise(fun(), cb);
  };
};

function callbackify1 (fun) {
  return (arg1, cb) => {
    return wrapPromise(fun(arg1), cb);
  };
};

function callbackify2 (fun) {
  return (arg1, arg2, cb) => {
    return wrapPromise(fun(arg1, arg2), cb);
  };
};

function getRemoveFun (pad) {
  var fun = pad.remove.bind(pad)

  if (usePromises) {
    return callbackify0(fun)
  }

  return fun;
}
