import { tagImageViaGoogle } from './tag-image/tagImageViaGoogle.mjs';
import { tagImageViaImagga } from './tag-image/tagImageViaImagga.mjs';

import { getDummyTags } from './tag-image/getDummyTags.mjs';

const timeout = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

// Middleware
const identifyTags = function () {
    return async function (req, res) {
        // DEBUG-HELPER: Useful for debugging
        if (false) { // eslint-disable-line no-constant-condition
            await timeout(300);
        }

        const fileContents = req.body;

        let err,
            response;

        // DEBUG-HELPER: Useful for debugging/development
        const useHardCodedResponse = false;
        // const useHardCodedResponse = true;

        if (useHardCodedResponse) {
            response = getDummyTags();
        } else {
            if (req.query.useImagga) {
                [err, response] = await tagImageViaImagga(fileContents);
            } else {
                [err, response] = await tagImageViaGoogle(fileContents);
            }
        }

        if (err) {
            return res.status(500).send({
                status: 'error',
                message: err.message
            });
        } else {
            return res.send({
                status: 'success',
                data: response
            });
        }
    };
};

export { identifyTags };
