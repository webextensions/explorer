import path from 'node:path';
import fs from 'node:fs';

// FIXME: Fix this issue
// eslint-disable-next-line import/no-unresolved
import got from 'got';

import FormData from 'form-data';

const __dirname = path.dirname(import.meta.url).replace('file://', '');

const apiKey = process.env.IMAGGA_API_KEY;
const apiSecret = process.env.IMAGGA_API_SECRET;

const tagImageViaImagga = async (fileContents) => {
    try {
        let json;

        // DEBUG-HELPER: Useful for debugging/development
        const useHardCodedResponse = false;
        // const useHardCodedResponse = true;

        if (useHardCodedResponse) {
            const response = await fs.promises.readFile(
                path.resolve(__dirname, 'tagImageViaImagga.sample.json'),
                'utf-8'
            );
            json = JSON.parse(response);
        } else {
            const formData = new FormData();
            formData.append('image', fileContents);

            const apiUrl = 'https://api.imagga.com/v2/tags';
            const response = await got.post(
                apiUrl,
                {
                    body: formData,
                    username: apiKey,
                    password: apiSecret
                }
            );

            json = JSON.parse(response.body);
        }

        let tags = json.result.tags;

        tags = tags.map((tag) => {
            return {
                description: tag.tag.en,
                score: tag.confidence / 100
            };
        });

        return [null, tags];
    } catch (err) {
        console.error(err);
        return [err];
    }
};

export { tagImageViaImagga };
