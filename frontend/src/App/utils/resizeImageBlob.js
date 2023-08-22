const resizeImageBlob = async function (imageBlob, maxSize, mimeType) {
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

    // Create a canvas element with the maximum size
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Get the canvas context
    const ctx = canvas.getContext('2d');

    // Set background as transparent (white)
    ctx.fillStyle = 'rgba(255, 255, 255, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image on the canvas
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert the canvas to a blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, mimeType);
    });
};

// eg:
//     If an image is of size 500x1000 and we want to generate a thumbnail of size 100x100,
//     then we will first resize the image to 100x200 and then crop it to 100x100 from the center.
// TODO: Improve logic / performance
const resizeImageBlobAndCropToSize = async function ({
    imageBlob,
    width,
    height,
    mimeType
}) {
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
    const { width: originalWidth, height: originalHeight } = img;

    // Calculate the new width and height
    let newWidth,
        newHeight;

    // If the image is wider than it is tall
    if (originalHeight > originalWidth) {
        // Calculate the new width
        newWidth = width;

        // Calculate the new height
        newHeight = (originalHeight / originalWidth) * width;
    } else {
        // Calculate the new width
        newWidth = (originalWidth / originalHeight) * height;

        // Calculate the new height
        newHeight = height;
    }

    // Create a canvas element with the maximum size
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Get the canvas context
    const ctx = canvas.getContext('2d');

    // Set background as transparent (white)
    ctx.fillStyle = 'rgba(255, 255, 255, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image on the canvas
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Now crop the image to width x height from the center
    const x = (newWidth - width) / 2;
    const y = (newHeight - height) / 2;

    // Create a canvas element with the maximum size
    const canvas2 = document.createElement('canvas');
    canvas2.width = width;
    canvas2.height = height;

    // Get the canvas context
    const ctx2 = canvas2.getContext('2d');

    // Set background as transparent (white)
    ctx2.fillStyle = 'rgba(255, 255, 255, 0)';
    ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

    // Draw the image on the canvas
    ctx2.drawImage(canvas, x, y, width, height, 0, 0, width, height);

    // Convert the canvas to a blob
    return new Promise((resolve) => {
        canvas2.toBlob((blob) => {
            resolve(blob);
        }, mimeType);
    });
};

export {
    resizeImageBlob,
    resizeImageBlobAndCropToSize
};
