const getImageDimensionsFromBlob = async function (imageBlob) {
    const imageBitmap = await createImageBitmap(imageBlob);

    const {
        width,
        height
    } = imageBitmap;

    return {
        width,
        height
    };
};

export { getImageDimensionsFromBlob };
