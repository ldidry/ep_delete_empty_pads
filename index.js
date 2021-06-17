const log4js = require('ep_etherpad-lite/node_modules/log4js');
const logger = log4js.getLogger('ep_delete_empty_pads');

var PadManager = require('ep_etherpad-lite/node/db/PadManager'),
    asyncM     = require('ep_etherpad-lite/node_modules/async');

// Check if we need to delete the pad each time a user leaves
exports.deletePadAtLeave = (hook, session, cb) => {
    (async () => {
        if (session == null) return;
        if (!(await PadManager.doesPadExist(session.padId))) return;
        const pad = await PadManager.getPad(session.padId);
        if (pad.getHeadRevisionNumber() !== 0) return;
        logger.info(`Deleting ${session.padId} when user leaved since empty`);
        await pad.remove();
    })();
    return cb(); // No need to wait for completion before calling the callback.
};

// Delete empty pads at startup
exports.deletePadsAtStart = (hook_name, args, cb) => {
    (async () => {
        // Deletion queue (avoids max stack size error), 2 workers
        const q = asyncM.queue(async (pad) => {
            logger.info(`Deleting ${pad.id} at startup since empty`);
            await pad.remove();
        }, 2);

        const {padIDs} = await PadManager.listAllPads();
        for (const padId of padIDs) {
            const pad = await PadManager.getPad(padId);
            if (pad.getHeadRevisionNumber() !== 0) continue;
            q.push(pad);
        }
    })();
    return cb(); // No need to wait for completion before calling the callback.
};
