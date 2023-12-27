/* global showDirectoryPicker */

import React from 'react';
import PropTypes from 'prop-types';

import { useAtom } from 'jotai';

import Tree from 'rc-tree';

import {
    RootDirectoryAtom,
    CurrentDirectoryAtom,
    WorkspaceDirectoriesAtom
} from '../../store/jotaiStore.js';

import 'rc-tree/assets/index.css';

const containsDirectoryAsChild = async function (directoryHandle) {
    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'directory') {
            return true;
        }
    }
    return false;
};

const DirectoryTree = function ({ directoryHandle }) {
    // eslint-disable-next-line no-unused-vars
    const [directoryEntries, setDirectoryEntries] = React.useState([]);

    const [treeData, setTreeData] = React.useState([]);

    // eslint-disable-next-line no-unused-vars
    const [currentDirectoryAtom, setCurrentDirectoryAtom] = useAtom(CurrentDirectoryAtom);

    React.useEffect(() => {
        (async () => {
            const entries = [];
            const treeEntries = [];
            const rootFolderEntry = {
                title: directoryHandle.name,
                key: directoryHandle.name,
                children: [],
                isLeaf: !(await containsDirectoryAsChild(directoryHandle)),
                directoryHandle
            };
            treeEntries.push(rootFolderEntry);
            for await (const entry of directoryHandle.values()) {
                if (entry.kind === 'directory') {
                    entries.push(entry);

                    const treeEntry = {
                        title: entry.name,
                        key: entry.name,
                        children: [],
                        isLeaf: !(await containsDirectoryAsChild(entry)),
                        directoryHandle: entry
                    };
                    rootFolderEntry.children.push(treeEntry);
                }
            }
            setDirectoryEntries(entries);

            setTreeData(treeEntries);
        })();
    }, [directoryHandle]);

    const defaultExpandedKeys = (() => {
        if (treeData.length) {
            return [treeData[0].key];
        } else {
            return [];
        }
    })();

    return (
        <div>
            <Tree
                // TODO: FIXME: This is a hack to force the tree to re-render when the directoryHandle changes (and related data gets populated to eventually set `defaultExpandedKeys` with a value)
                key={(defaultExpandedKeys.length && defaultExpandedKeys[0]) || Math.random()}
                defaultExpandedKeys={defaultExpandedKeys}

                onSelect={function (entry, evt) {
                    const selectedNodes = evt.selectedNodes;

                    if (selectedNodes.length) {
                        const selectedNode = selectedNodes[0];
                        const directoryHandle = selectedNode.directoryHandle;
                        setCurrentDirectoryAtom(directoryHandle);
                    } else {
                        setCurrentDirectoryAtom(null);
                    }
                }}
                loadData={async function (treeEntry) {
                    const entries = [];
                    for await (const entry of treeEntry.directoryHandle.values()) {
                        if (entry.kind === 'directory') {
                            console.log(entry);
                            entries.push(entry);
                        }
                    }
                    setDirectoryEntries(entries);

                    const treeEntries = structuredClone(treeData);

                    /* TODO: Pending */

                    setTreeData(treeEntries);
                }}
                treeData={treeData}
            />
        </div>
    );
};
DirectoryTree.propTypes = {
    directoryHandle: PropTypes.object.isRequired
};

const TreeView = function () {
    // eslint-disable-next-line no-unused-vars
    const [workspaceDirectoriesAtom, setWorkspaceDirectoriesAtom] = useAtom(WorkspaceDirectoriesAtom);

    return (
        <div
            style={{
                display: 'grid',
                gap: 10
            }}
        >
            {workspaceDirectoriesAtom.map((workspaceDirectoryHandle, workspaceDirectoryHandleIndex) => {
                return (
                    <div key={workspaceDirectoryHandleIndex}>
                        <DirectoryTree directoryHandle={workspaceDirectoryHandle} />
                    </div>
                );
            })}
        </div>
    );
};

const OpenFolderButton = function () {
    // eslint-disable-next-line no-unused-vars
    const [rootDirectoryAtom, setRootDirectoryAtom] = useAtom(RootDirectoryAtom);

    const [workspaceDirectoriesAtom, setWorkspaceDirectoriesAtom] = useAtom(WorkspaceDirectoriesAtom);

    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
                style={{
                    cursor: 'pointer',
                    padding: '5px 10px'
                }}
                onClick={async () => {
                    let dirHandle = null;
                    try {
                        dirHandle = await showDirectoryPicker({
                            // mode: 'read'
                            mode: 'readwrite'
                        });
                    } catch (e) {
                        console.error(e);
                        // eslint-disable-next-line no-alert
                        alert('An error occurred.\n\nPlease check the console for more details.');
                        return;
                    }

                    setRootDirectoryAtom(dirHandle);

                    const workspaceDirectoryHandle = dirHandle;
                    setWorkspaceDirectoriesAtom([
                        ...workspaceDirectoriesAtom,
                        workspaceDirectoryHandle
                    ]);
                }}
            >
                <span>
                    Open Folder
                </span>
                &nbsp;
                <span style={{ color: '#999' }}>
                    (from disk)
                </span>
            </button>
        </div>
    );
};

const FoldersTreePane = function () {
    return (
        <div style={{ height: '100%' }}>
            <div>
                <OpenFolderButton />
            </div>

            <div style={{ marginTop: 15 }}>
                <TreeView />
            </div>
        </div>
    );
};

export { FoldersTreePane };
