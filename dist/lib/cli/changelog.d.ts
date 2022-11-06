interface Props {
    outputFile: string;
    gitBaseUrl?: string;
}
export declare const changelogHandler: ({ outputFile, gitBaseUrl }: Props) => Promise<void>;
export {};
