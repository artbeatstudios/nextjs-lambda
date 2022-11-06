interface Props {
    gitUser: string;
    gitEmail: string;
    tagPrefix: string;
    failOnMissingCommit: boolean;
    releaseBranchPrefix: string;
    forceBump: boolean;
    generateChangelog: boolean;
    changelogPath: string;
}
export declare const shipitHandler: ({ gitEmail, gitUser, tagPrefix, failOnMissingCommit, forceBump, releaseBranchPrefix, generateChangelog, changelogPath, }: Props) => Promise<void>;
export {};
