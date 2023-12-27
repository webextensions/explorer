import { atom } from 'jotai';

export const RootDirectoryAtom = atom(null);

export const CurrentDirectoryAtom = atom(null);

export const WorkspaceDirectoriesAtom = atom([]);

export const selectedFilesAtom = atom(new Set([]));
