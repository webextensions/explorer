import fs from 'node:fs';
import path from 'node:path';

// FIXME: Fix this issue
// eslint-disable-next-line import/no-unresolved
import got from 'got';
import FormData from 'form-data';

const __dirname = path.dirname(import.meta.url).replace('file://', '');

const apiKey = process.env.IMAGGA_API_KEY;
const apiSecret = process.env.IMAGGA_API_SECRET;

const timeout = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const tagImage = async (fileContents) => {
    // DEBUG-HELPER: Useful for debugging
    if (false) { // eslint-disable-line no-constant-condition
        await timeout(300);
    }

    const formData = new FormData();
    formData.append('image', fileContents);

    try {
        // DEBUG-HELPER: Useful for debugging/development
        const useHardCodedResponse = false;
        // const useHardCodedResponse = true;

        if (useHardCodedResponse) {
            const response = await fs.promises.readFile(
                path.resolve(__dirname, 'tag-image.dummy-data.json'),
                'utf-8'
            );
            const json = JSON.parse(response);
            return [null, json];
        } else {
            const response = await got.post(
                'https://api.imagga.com/v2/tags',
                {
                    body: formData,
                    username: apiKey,
                    password: apiSecret
                }
            );
            const json = JSON.parse(response.body);
            return [null, json];
        }
    } catch (error) {
        console.log(error);
        return [error];
    }
};

export { tagImage };
