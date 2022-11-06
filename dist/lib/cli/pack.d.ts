interface Props {
    standaloneFolder: string;
    publicFolder: string;
    handlerPath: string;
    outputFolder: string;
    commandCwd: string;
}
export declare const packHandler: ({ handlerPath, outputFolder, publicFolder, standaloneFolder, commandCwd }: Props) => Promise<void>;
export {};
