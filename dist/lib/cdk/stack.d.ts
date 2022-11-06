import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';
import { App, Stack } from 'aws-cdk-lib';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CustomStackProps, GetCfnCertificateProps, SetDnsRecordsProps, SetupApiGwProps, SetupCfnDistroProps, SetupImageLambdaProps, SetupServerLambdaProps, UploadAssetsProps } from './types';
export declare class NextStandaloneStack extends Stack {
    private imageLambda?;
    private serverLambda?;
    private apiGateway?;
    private assetsBucket?;
    private cfnDistro?;
    private cfnCertificate?;
    private hostedZone?;
    private domainName?;
    constructor(scope: App, id: string, config: CustomStackProps);
    setupAssetsBucket(): Bucket;
    setupApiGateway({ imageLambda, imageBasePath, serverLambda, serverBasePath }: SetupApiGwProps): HttpApi;
    setupServerLambda({ basePath, codePath, dependenciesPath, handler, memory, timeout }: SetupServerLambdaProps): Function;
    setupImageLambda({ assetsBucket, codePath, handler }: SetupImageLambdaProps): Function;
    setupCfnDistro({ apiGateway, imageBasePath, serverBasePath, assetsBucket, domainName, certificate }: SetupCfnDistroProps): Distribution;
    getCfnCertificate({ hostedZone, domainName }: GetCfnCertificateProps): DnsValidatedCertificate;
    setDnsRecords({ dnsPrefix: recordName, hostedZone: zone, cfnDistro }: SetDnsRecordsProps): void;
    uploadStaticAssets({ assetsBucket, assetsPath, cfnDistribution }: UploadAssetsProps): void;
}
