/// <reference types="replace-in-file" />
import { IOptions as GlobOptions } from 'glob';
export declare enum BumpType {
    Patch = "patch",
    Minor = "minor",
    Major = "major"
}
export declare const bumpMapping: ({
    test: RegExp;
    bump: BumpType;
    scanBody?: undefined;
} | {
    test: RegExp;
    bump: BumpType;
    scanBody: boolean;
})[];
export declare const isValidTag: (tag: string, prefix: string) => boolean;
export declare const bumpCalculator: (version: string, bumpType: BumpType) => string;
export declare const replaceVersionInCommonFiles: (oldVersion: string, newVersion: string) => import("replace-in-file").ReplaceResult[];
export declare const findInFile: (filePath: string, regex: RegExp) => string;
interface ZipFolderProps {
    outputName: string;
    folderPath: string;
    dir?: string;
}
export declare const zipFolder: ({ folderPath, outputName, dir }: ZipFolderProps) => Promise<unknown>;
interface FolderInput {
    path: string;
    dir?: string;
}
interface FileInput {
    path: string;
    name: string;
    isFile: true;
}
interface SymlinkInput {
    source: string;
    target: string;
    isSymlink: true;
}
interface GlobInput extends GlobOptions {
    path: string;
    isGlob: true;
}
interface ZipProps {
    outputName: string;
    inputDefinition: (FolderInput | FileInput | SymlinkInput | GlobInput)[];
}
export declare const zipMultipleFoldersOrFiles: ({ outputName, inputDefinition }: ZipProps) => Promise<unknown>;
interface SymlinkProps {
    sourcePath: string;
    linkLocation: string;
}
export declare const createSymlink: ({ linkLocation, sourcePath }: SymlinkProps) => void;
interface CommandProps {
    cmd: string;
    path?: string;
}
export declare const executeAsyncCmd: ({ cmd, path }: CommandProps) => Promise<unknown>;
export declare const wrapProcess: (fn: Promise<any>) => Promise<void>;
export declare const findPathToNestedFile: (filename: string, inPath: string) => string;
export declare const validatePublicFolderStructure: (publicFolderPath: string) => void;
export declare const validateFolderExists: (folderPath: string) => void;
export declare const sortTagsDescending: (tags: string[]) => string[];
export declare const findHighestTag: (tags: string[]) => string;
export declare const getCommitLink: (remoteUrl: string, commit: string) => string | null;
export declare const getCompareLink: (remoteUrl: string, previous: string, next: string) => string | null;
export {};
