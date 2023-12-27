import { create } from 'zustand';

const useZustandStore = create((set) => ({
    relevantHandlesCount: null,
    setRelevantHandlesCount: (relevantHandlesCount) => {
        set({ relevantHandlesCount });
    },

    relevantFilesTotal: null,
    setRelevantFilesTotal: (relevantFilesTotal) => {
        set({ relevantFilesTotal });
    },

    resourcesCount: null,
    setResourcesCount: (resourcesCount) => {
        set({ resourcesCount });
    },

    filesAndIndexInfo: {
        handleForFolder: null,
        filesAndDetails: null,
        readNames: false,
        readMetadataFiles: false
    },
    setFilesAndIndexInfo: (filesAndIndexInfo) => {
        set({ filesAndIndexInfo });
    }
}));

export { useZustandStore };
