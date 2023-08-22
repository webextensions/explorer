const getAverageColorFromImageBlob = async function (imageBlob) {
    try {
        // Create a canvas element with the maximum size
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;

        // Get the canvas context
        const ctx = canvas.getContext('2d');

        // TODO: FIXME: Identify how to do the computation with transparent background color
        // Set background as transparent (white)
        ctx.fillStyle = 'rgba(255, 255, 255, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let imageObjectToDraw;
        if (imageBlob.type === 'image/svg+xml') {
            // Load the SVG image into the image element
            const img = new Image();
            img.src = URL.createObjectURL(imageBlob);

            // Wait for the image to load
            await new Promise((resolve, reject) => {
                img.addEventListener('load', resolve);
                img.addEventListener('error', reject);
            });

            imageObjectToDraw = img;
        } else {
            const imageBitmap = await createImageBitmap(imageBlob);
            imageObjectToDraw = imageBitmap;
        }

        // Draw the image on the canvas
        ctx.drawImage(imageObjectToDraw, 0, 0, 1, 1);

        // Get the image data
        const imageData = ctx.getImageData(0, 0, 1, 1);

        // Get the color data
        const colorData = imageData.data;

        // Calculate the average color
        const averageColor = {
            red: colorData[0],
            green: colorData[1],
            blue: colorData[2],
            alpha: parseInt((100 * colorData[3]) / 255) / 100
        };

        // Return the average color
        return [null, averageColor];
    } catch (err) {
        return [err];
    }
};

export { getAverageColorFromImageBlob };
