interface Props {
    stackName: string;
    appPath: string;
    bootstrap: boolean;
    lambdaMemory?: number;
    lambdaTimeout?: number;
    hostedZone?: string;
    domainNamePrefix?: string;
}
export declare const deployHandler: ({ stackName, appPath, bootstrap, lambdaMemory, lambdaTimeout, domainNamePrefix, hostedZone }: Props) => Promise<void>;
export {};
