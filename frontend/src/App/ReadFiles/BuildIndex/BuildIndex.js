import React, { Fragment, useState } from 'react';

import imageCompression from 'browser-image-compression';
import ky from 'ky';

import { SplitButton } from '../../Components/SplitButton.js';

import { trackTime } from 'helpmate/dist/misc/trackTime.js';

import { getImageDimensionsFromBlob } from '../../utils/getImageDimensionsFromBlob.js';

const trackTimeAsync = trackTime.async;

const buildIndex = async function ({
    handleForFolder,
    indexType,
    statusUpdateCallback
}) {
    try {
        /*
        // Go through all the files in the folder and find all the files.
        Example input:
            * abc.jpg
            * abc.jpg.metadata.json
            * def.exe
            * ghi.png
            * ghi.png.metadata.json
            * jkl.doc
            * mno.jpg
            * pqr.txt
            * stu.xlsx.metadata.json

        // Now, split them into two sets. One set contains the files ending with the extension ".metadata.json". The other
        // set contains the files that don't end with the extension ".metadata.json".
        Split into two sets:
            Set 1: Set without ".metadata.json" extension:
                * abc.jpg
                * def.exe
                * ghi.png
                * jkl.doc
                * mno.jpg
                * pqr.txt
            Set 2: Set with ".metadata.json" extension:
                * abc.jpg.metadata.json
                * ghi.png.metadata.json
                * stu.xlsx.metadata.json

        // Now from the Set 2 (the one with ".metadata.json" extension), create another set with the same files but without
        // the extension ".metadata.json". This will be the set of files for which we have metadata. We call it Set 3.
        Set 3: Set created from the list of files with ".metadata.json" extension, but without the extension ".metadata.json"
            * abc.jpg
            * ghi.png
            * stu.xlsx

        // Now from the Set 1 (the one without ".metadata.json" extension), remove all the entries that are in the Set 3.
        // This will be the set of files for which we don't have the corresponding ".metadata.json" file. We call it Set 4.
        Set 4: Set created from the list of files without ".metadata.json" extension, but not in the Set 3.
            * def.exe
            * jkl.doc
            * mno.jpg
            * pqr.txt

        Now, for each file in the Set 4, create a new file with the same name but with the extension ".metadata.json".
        */

        const iterator = await handleForFolder.values();

        const listFileHandles = [];
        for await (const handleForFile of iterator) {
            listFileHandles.push(handleForFile);
        }

        const handlesForActualFiles = listFileHandles.filter(function (item) {
            return item.kind === 'file';
        });

        const handlesForActualMetadataFiles = handlesForActualFiles.filter(function (file) {
            return file.name.endsWith('.metadata.json');
        });

        const namesOfFilesWithMetadataWithoutMetadataExtension = handlesForActualMetadataFiles.map(function (file) {
            return file.name.replace(/\.metadata\.json$/, '');
        });

        const setNamesOfFilesWithMetadataWithoutMetadataExtension = new Set(namesOfFilesWithMetadataWithoutMetadataExtension);

        const handlesForActualNonMetadataFiles = handlesForActualFiles.filter(function (file) {
            if (file.name.endsWith('.metadata.json')) {
                return false;
            } else {
                return true;
            }
        });

        const handlesForFilesForWhichMetadataFileNeedsToBeCreated = handlesForActualNonMetadataFiles.filter(function (file) {
            if (setNamesOfFilesWithMetadataWithoutMetadataExtension.has(file.name)) {
                return false;
            } else {
                return true;
            }
        });

        let filesCreated = 0;
        const filesToBeCreated = handlesForFilesForWhichMetadataFileNeedsToBeCreated.length;
        // Now create the ".metadata.json" files for the files for which they don't exist.
        for (const handleForFile of handlesForFilesForWhichMetadataFileNeedsToBeCreated) {
            const handleForMetadataFile = await trackTimeAsync(
                'buildIndex_getFileHandle',
                () => handleForFolder.getFileHandle(handleForFile.name + '.metadata.json', { create: true })
            );

            const file = await trackTimeAsync(
                'buildIndex_getFile',
                () => handleForFile.getFile()
            );

            const metadata = {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified
            };

            if (file.type === 'image/jpeg' || file.type === 'image/png') {
                const imageBlob = new Blob([file], { type: file.type });
                const dimensions = await getImageDimensionsFromBlob(imageBlob);
                metadata.dimensions = dimensions;
            }

            if (indexType === 'full') {
                const imageCompressionOptions = {
                    maxSizeMB: 0.25,
                    maxWidthOrHeight: 500,
                    useWebWorker: true
                };

                const imageFile = file;
                const compressedFile = await imageCompression(imageFile, imageCompressionOptions);

                const apiUrl = '/api/identifyTags';
                const response = await ky.post(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': file.type
                    },
                    timeout: 120000,
                    body: compressedFile
                });
                const json = await response.json();

                const arrTags = ((json) => {
                    const data = json.data;
                    const tags = data;
                    const arr = [];
                    for (const tag of tags) {
                        arr.push(tag.description);
                    }
                    return arr;
                })(json);

                metadata.tags = arrTags;
                metadata.tagsRaw = json;
            }

            const writableStream = await trackTimeAsync(
                'buildIndex_createWritable',
                () => handleForMetadataFile.createWritable()
            );

            await trackTimeAsync(
                'buildIndex_write',
                () => writableStream.write(JSON.stringify(metadata, null, 4))
            );

            setTimeout(async function () {
                await trackTimeAsync(
                    'buildIndex_closeStream',
                    () => writableStream.close()
                );

                filesCreated++;
                statusUpdateCallback({
                    filesCreated,
                    filesToBeCreated
                });
            });
        }
        return [null];
    } catch (e) {
        return [e];
    }
};

const BuildIndex = function ({ handleForFolder }) {
    const [progressStatus, setProgressStatus] = useState(null);

    const buildIndexOptions = [
        {
            value: 'Build Index (Quick)',
            onClick: async function () {
                setProgressStatus(null);

                const [err] = await buildIndex({
                    handleForFolder,
                    indexType: 'quick',
                    statusUpdateCallback: function (status) {
                        const { filesCreated, filesToBeCreated } = status;
                        setProgressStatus({
                            filesCreated,
                            filesToBeCreated
                        });
                    }
                });
            }
        },
        {
            value: 'Build Index (Full)',
            onClick: async function () {
                setProgressStatus(null);

                const [err] = await buildIndex({
                    handleForFolder,
                    indexType: 'full',
                    statusUpdateCallback: function (status) {
                        const { filesCreated, filesToBeCreated } = status;
                        setProgressStatus({
                            filesCreated,
                            filesToBeCreated
                        });
                    }
                });
            }
        }
    ];

    return (
        <div style={{ display: 'flex' }}>
            <SplitButton
                defaultSelectedIndex={0}
                options={buildIndexOptions}
            />
            {
                progressStatus &&
                <Fragment>
                    <div style={{ marginLeft: 10, lineHeight: '20px' }}>
                        {progressStatus.filesCreated} / {progressStatus.filesToBeCreated}
                    </div>
                    <div style={{ marginLeft: 5, lineHeight: '20px' }}>
                        ({
                            parseInt(
                                1000 *
                                (progressStatus.filesCreated / progressStatus.filesToBeCreated)
                            ) / 10
                        }%)
                    </div>
                </Fragment>
            }
        </div>
    );
};

export { BuildIndex };
