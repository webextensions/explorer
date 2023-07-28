const resizeImageBlob = async function (imageBlob, maxSize, mimeType) {
    // Create a canvas element with the maximum size
    const canvas = document.createElement('canvas');
    canvas.width = maxSize;
    canvas.height = maxSize;

    // Get the canvas context
    const ctx = canvas.getContext('2d');

    // Set background as white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create an image element
    const img = document.createElement('img');

    // Set the image element's src attribute to the image data
    img.src = URL.createObjectURL(imageBlob);

    // Wait for the image to load
    await new Promise((resolve, reject) => {
        img.addEventListener('load', resolve);
        img.addEventListener('error', reject);
    });

    // Get the image's width and height
    const { width, height } = img;

    // Calculate the new width and height
    let newWidth,
        newHeight;
    if (width > height) {
        newWidth = maxSize;
        newHeight = (height / width) * maxSize;
    } else {
        newWidth = (width / height) * maxSize;
        newHeight = maxSize;
    }

    // Draw the image on the canvas
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert the canvas to a blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, mimeType);
    });
};

export { resizeImageBlob };
