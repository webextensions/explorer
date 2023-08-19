const zipFiles = async (files) => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const file of files) {
        const fileAsArrayBuffer = await file.arrayBuffer();
        zip.file(file.name, fileAsArrayBuffer);
    }

    const zippedContent = await zip.generateAsync({ type:'blob' });

    return zippedContent;
};

export { zipFiles };
