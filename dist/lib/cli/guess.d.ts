interface Props {
    tagPrefix: string;
    latestVersion: string;
    commitMessage: string;
}
export declare const guessHandler: ({ latestVersion, tagPrefix, commitMessage }: Props) => Promise<void>;
export {};
