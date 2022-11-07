interface Props {
    cwd: string;
    stackName: string;
    appPath: string;
    bootstrap: boolean;
    lambdaMemory?: number;
    lambdaTimeout?: number;
    hostedZone?: string;
    domainNamePrefix?: string;
}
export declare const deployHandler: ({ cwd, stackName, appPath, bootstrap, lambdaMemory, lambdaTimeout, domainNamePrefix, hostedZone }: Props) => Promise<void>;
export {};
