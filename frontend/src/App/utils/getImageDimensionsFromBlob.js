import { tryCatchSafeAsync } from 'helpmate/dist/control/tryCatch.js';

const getSvgImageDimensions = async function (svgImageBlob) {
    try {
        const img = new Image();

        // Load the SVG image into the image element
        img.src = URL.createObjectURL(svgImageBlob);

        // Wait for the image to load
        await new Promise((resolve, reject) => {
            img.addEventListener('load', resolve);
            img.addEventListener('error', reject);
        });

        return [null, {
            width: img.width,
            height: img.height
        }];
    } catch (err) {
        return [err];
    }
};

const getImageDimensionsFromBlob = async function (imageBlob) {
    let obWithDimensions;

    if (imageBlob.type === 'image/svg+xml') {
        const [err, svgDimensions] = await getSvgImageDimensions(imageBlob);
        if (err) {
            return [err];
        }
        obWithDimensions = svgDimensions;
    } else {
        const [err, imageBitmap] = await tryCatchSafeAsync(() => createImageBitmap(imageBlob));
        if (err) {
            return [err];
        }
        obWithDimensions = imageBitmap;
    }

    const dimensions = {
        width: obWithDimensions.width,
        height: obWithDimensions.height
    };

    return [null, dimensions];
};

export { getImageDimensionsFromBlob };
