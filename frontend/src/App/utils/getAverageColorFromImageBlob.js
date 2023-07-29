const getAverageColorFromImageBlob = async function (imageBlob) {
    // Create a canvas element with the maximum size
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    // Get the canvas context
    const ctx = canvas.getContext('2d');

    // TODO: FIXME: Identify how to do the computation with transparent background color
    // Set background as white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Now draw the image on the canvas
    const imageBitmap = await createImageBitmap(imageBlob);
    ctx.drawImage(imageBitmap, 0, 0, 1, 1);

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
    return averageColor;
};

export { getAverageColorFromImageBlob };
