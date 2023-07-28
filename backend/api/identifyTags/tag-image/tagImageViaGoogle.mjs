import path from 'node:path';
import fs from 'node:fs';

// FIXME: Fix this issue
// eslint-disable-next-line import/no-unresolved
import got from 'got';

const __dirname = path.dirname(import.meta.url).replace('file://', '');

const apiKey = process.env.GOOGLE_VISION_API_KEY;

const tagImageViaGoogle = async function (imageBuffer) {
    try {
        let json;

        // DEBUG-HELPER: Useful for debugging/development
        const useHardCodedResponse = false;
        // const useHardCodedResponse = true;

        if (useHardCodedResponse) {
            const response = await fs.promises.readFile(
                path.resolve(__dirname, 'tagImageViaGoogle.sample.json'),
                'utf-8'
            );
            json = JSON.parse(response);
        } else {
            const requestBody = {
                requests: [
                    {
                        image: {
                            content: imageBuffer.toString('base64')
                        },
                        features: [
                            {
                                type: 'LABEL_DETECTION',
                                maxResults: 100
                            }
                        ]
                    }
                ]
            };

            const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
            const response = await got.post(
                apiUrl,
                {
                    json: requestBody
                }
            );

            json = JSON.parse(response.body);
        }

        let tags = json.responses[0].labelAnnotations;

        tags = tags.map((tag) => {
            return {
                description: tag.description,
                score: tag.score
            };
        });

        return [null, tags];
    } catch (err) {
        console.error(err);
        return [err];
    }
};

export { tagImageViaGoogle };
