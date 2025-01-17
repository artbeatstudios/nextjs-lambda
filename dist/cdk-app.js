'use strict';

var awsCdkLib = require('aws-cdk-lib');
var path = require('path');
var awsApigatewayv2Alpha = require('@aws-cdk/aws-apigatewayv2-alpha');
var awsApigatewayv2IntegrationsAlpha = require('@aws-cdk/aws-apigatewayv2-integrations-alpha');
var awsCertificatemanager = require('aws-cdk-lib/aws-certificatemanager');
var awsCloudfront = require('aws-cdk-lib/aws-cloudfront');
var awsCloudfrontOrigins = require('aws-cdk-lib/aws-cloudfront-origins');
var awsLambda = require('aws-cdk-lib/aws-lambda');
var awsRoute53 = require('aws-cdk-lib/aws-route53');
var awsRoute53Targets = require('aws-cdk-lib/aws-route53-targets');
var awsS3 = require('aws-cdk-lib/aws-s3');
var awsS3Deployment = require('aws-cdk-lib/aws-s3-deployment');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);

class NextStandaloneStack extends awsCdkLib.Stack {
    constructor(scope, id, config) {
        super(scope, id, config);
        console.log("CDK's config:", config);
        if (config.hostedZone) {
            this.hostedZone = awsRoute53.HostedZone.fromLookup(this, 'HostedZone_certificate', { domainName: config.hostedZone });
            this.domainName = config.dnsPrefix ? `${config.dnsPrefix}.${config.hostedZone}` : config.hostedZone;
        }
        this.assetsBucket = this.setupAssetsBucket();
        this.imageLambda = this.setupImageLambda({
            codePath: config.imageHandlerZipPath,
            handler: config.customImageHandler,
            assetsBucket: this.assetsBucket,
        });
        this.serverLambda = this.setupServerLambda({
            basePath: config.apigwServerPath,
            codePath: config.codeZipPath,
            handler: config.customServerHandler,
            dependenciesPath: config.dependenciesZipPath,
            timeout: config.lambdaTimeout,
            memory: config.lambdaMemory,
        });
        this.apiGateway = this.setupApiGateway({
            imageLambda: this.imageLambda,
            serverLambda: this.serverLambda,
            imageBasePath: config.apigwImagePath,
            serverBasePath: config.apigwServerPath,
        });
        if (!!this.hostedZone && !!this.domainName) {
            this.cfnCertificate = this.getCfnCertificate({
                hostedZone: this.hostedZone,
                domainName: this.domainName,
            });
        }
        this.cfnDistro = this.setupCfnDistro({
            assetsBucket: this.assetsBucket,
            apiGateway: this.apiGateway,
            imageBasePath: config.apigwImagePath,
            serverBasePath: config.apigwServerPath,
            domainName: config.dnsPrefix ? `${config.dnsPrefix}.${config.hostedZone}` : config.hostedZone,
            certificate: this.cfnCertificate,
        });
        this.uploadStaticAssets({
            assetsBucket: this.assetsBucket,
            assetsPath: config.assetsZipPath,
            cfnDistribution: this.cfnDistro,
        });
        if (!!this.hostedZone && !!this.domainName) {
            this.setDnsRecords({
                cfnDistro: this.cfnDistro,
                hostedZone: this.hostedZone,
                dnsPrefix: config.dnsPrefix,
            });
        }
    }
    setupAssetsBucket() {
        const assetsBucket = new awsS3.Bucket(this, 'NextAssetsBucket', {
            // Those settings are necessary for bucket to be removed on stack removal.
            removalPolicy: awsCdkLib.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            publicReadAccess: false,
        });
        new awsCdkLib.CfnOutput(this, 'assetsBucketUrl', { value: assetsBucket.bucketDomainName });
        new awsCdkLib.CfnOutput(this, 'assetsBucketName', { value: assetsBucket.bucketName });
        return assetsBucket;
    }
    setupApiGateway({ imageLambda, imageBasePath, serverLambda, serverBasePath }) {
        const apiGateway = new awsApigatewayv2Alpha.HttpApi(this, 'ServerProxy');
        // We could do parameter mapping here and remove prefix from path.
        // However passing env var (basePath) is easier to use, understand and integrate to other solutions.
        apiGateway.addRoutes({ path: `${serverBasePath}/{proxy+}`, integration: new awsApigatewayv2IntegrationsAlpha.HttpLambdaIntegration('LambdaApigwIntegration', serverLambda) });
        apiGateway.addRoutes({ path: `${imageBasePath}/{proxy+}`, integration: new awsApigatewayv2IntegrationsAlpha.HttpLambdaIntegration('ImagesApigwIntegration', imageLambda) });
        new awsCdkLib.CfnOutput(this, 'apiGwUrlServerUrl', { value: `${apiGateway.apiEndpoint}${serverBasePath}` });
        new awsCdkLib.CfnOutput(this, 'apiGwUrlImageUrl', { value: `${apiGateway.apiEndpoint}${imageBasePath}` });
        return apiGateway;
    }
    setupServerLambda({ basePath, codePath, dependenciesPath, handler, memory, timeout }) {
        const depsLayer = new awsLambda.LayerVersion(this, 'DepsLayer', {
            // This folder does not use Custom hash as depenendencies are most likely changing every time we deploy.
            code: awsLambda.Code.fromAsset(dependenciesPath),
        });
        const serverLambda = new awsLambda.Function(this, 'DefaultNextJs', {
            code: awsLambda.Code.fromAsset(codePath),
            runtime: awsLambda.Runtime.NODEJS_16_X,
            handler,
            layers: [depsLayer],
            // No need for big memory as image handling is done elsewhere.
            memorySize: memory,
            timeout: awsCdkLib.Duration.seconds(timeout),
            environment: {
                // Set env vars based on what's available in environment.
                ...Object.entries(process.env)
                    .filter(([key]) => key.startsWith('NEXT_'))
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
                NEXTJS_LAMBDA_BASE_PATH: basePath,
            },
        });
        new awsCdkLib.CfnOutput(this, 'serverLambdaArn', { value: serverLambda.functionArn });
        return serverLambda;
    }
    setupImageLambda({ assetsBucket, codePath, handler }) {
        const imageLambda = new awsLambda.Function(this, 'ImageOptimizationNextJs', {
            code: awsLambda.Code.fromAsset(codePath),
            runtime: awsLambda.Runtime.NODEJS_16_X,
            handler,
            memorySize: 1024,
            timeout: awsCdkLib.Duration.seconds(10),
            environment: {
                S3_SOURCE_BUCKET: assetsBucket.bucketName,
            },
        });
        assetsBucket.grantRead(imageLambda);
        new awsCdkLib.CfnOutput(this, 'imageLambdaArn', { value: imageLambda.functionArn });
        return imageLambda;
    }
    setupCfnDistro({ apiGateway, imageBasePath, serverBasePath, assetsBucket, domainName, certificate }) {
        const apiGwDomainName = `${apiGateway.apiId}.execute-api.${this.region}.amazonaws.com`;
        const serverOrigin = new awsCloudfrontOrigins.HttpOrigin(apiGwDomainName, { originPath: serverBasePath });
        const imageOrigin = new awsCloudfrontOrigins.HttpOrigin(apiGwDomainName, { originPath: imageBasePath });
        const assetsOrigin = new awsCloudfrontOrigins.S3Origin(assetsBucket);
        const defaultOptions = {
            viewerProtocolPolicy: awsCloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: awsCloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        };
        const defaultCacheOptions = {
            headerBehavior: awsCloudfront.CacheHeaderBehavior.allowList('accept', 'accept-language', 'content-language', 'content-type', 'user-agent', 'authorization'),
            queryStringBehavior: awsCloudfront.CacheQueryStringBehavior.all(),
            cookieBehavior: awsCloudfront.CacheCookieBehavior.all(),
        };
        const imagesCachePolicy = new awsCloudfront.CachePolicy(this, 'NextImageCachePolicy', {
            queryStringBehavior: awsCloudfront.CacheQueryStringBehavior.all(),
            enableAcceptEncodingGzip: true,
            defaultTtl: awsCdkLib.Duration.days(30),
        });
        const serverCachePolicy = new awsCloudfront.CachePolicy(this, 'NextServerCachePolicy', {
            ...defaultCacheOptions,
        });
        const apiCachePolicy = new awsCloudfront.CachePolicy(this, 'NextApiCachePolicy', {
            ...defaultCacheOptions,
            maxTtl: awsCdkLib.Duration.seconds(0),
        });
        // Public folder persists names so we are making default TTL lower for cases when invalidation does not happen.
        const assetsCachePolicy = new awsCloudfront.CachePolicy(this, 'NextPublicCachePolicy', {
            queryStringBehavior: awsCloudfront.CacheQueryStringBehavior.all(),
            enableAcceptEncodingGzip: true,
            defaultTtl: awsCdkLib.Duration.hours(12),
        });
        // We don't use LambdaFunctionAssociation as that's meant only for Lambda@Edge.
        // Caching is optinionated to work out-of-the-box, for granular access and customization, create your own cache policies.
        const cfnDistro = new awsCloudfront.Distribution(this, 'CfnDistro', {
            defaultRootObject: '',
            enableIpv6: true,
            priceClass: awsCloudfront.PriceClass.PRICE_CLASS_100,
            domainNames: domainName ? [domainName] : undefined,
            certificate,
            defaultBehavior: {
                origin: serverOrigin,
                allowedMethods: awsCloudfront.AllowedMethods.ALLOW_ALL,
                cachePolicy: serverCachePolicy,
                viewerProtocolPolicy: awsCloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            additionalBehaviors: {
                '/api*': {
                    ...defaultOptions,
                    origin: serverOrigin,
                    allowedMethods: awsCloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: apiCachePolicy,
                },
                '_next/data/*': {
                    ...defaultOptions,
                    origin: serverOrigin,
                },
                '_next/image*': {
                    ...defaultOptions,
                    origin: imageOrigin,
                    cachePolicy: imagesCachePolicy,
                    compress: true,
                },
                '_next/*': {
                    ...defaultOptions,
                    origin: assetsOrigin,
                },
                'assets/*': {
                    ...defaultOptions,
                    origin: assetsOrigin,
                    cachePolicy: assetsCachePolicy,
                },
            },
        });
        new awsCdkLib.CfnOutput(this, 'cfnDistroUrl', { value: cfnDistro.distributionDomainName });
        new awsCdkLib.CfnOutput(this, 'cfnDistroId', { value: cfnDistro.distributionId });
        return cfnDistro;
    }
    // Creates a certificate for Cloudfront to use in case parameters are passed.
    getCfnCertificate({ hostedZone, domainName }) {
        // us-east-1 is needed for Cloudfront to accept certificate.
        const certificate = new awsCertificatemanager.DnsValidatedCertificate(this, 'Certificate', { domainName, hostedZone, region: 'us-east-1' });
        new awsCdkLib.CfnOutput(this, 'certificateArn', { value: certificate.certificateArn });
        return certificate;
    }
    setDnsRecords({ dnsPrefix: recordName, hostedZone: zone, cfnDistro }) {
        const target = awsRoute53.RecordTarget.fromAlias(new awsRoute53Targets.CloudFrontTarget(cfnDistro));
        const dnsARecord = new awsRoute53.ARecord(this, 'AAliasRecord', { recordName, target, zone });
        const dnsAaaaRecord = new awsRoute53.AaaaRecord(this, 'AaaaAliasRecord', { recordName, target, zone });
        new awsCdkLib.CfnOutput(this, 'dns_A_Record', { value: dnsARecord.domainName });
        new awsCdkLib.CfnOutput(this, 'dns_AAAA_Record', { value: dnsAaaaRecord.domainName });
    }
    // Upload static assets, public folder, etc.
    uploadStaticAssets({ assetsBucket, assetsPath, cfnDistribution }) {
        // This can be handled by `aws s3 sync` but we need to ensure invalidation of Cfn after deploy.
        new awsS3Deployment.BucketDeployment(this, 'PublicFilesDeployment', {
            destinationBucket: assetsBucket,
            sources: [awsS3Deployment.Source.asset(assetsPath)],
            // Invalidate all paths after deployment.
            distribution: cfnDistribution,
            distributionPaths: ['/*'],
        });
    }
}

var _a, _b, _c;
const app = new awsCdkLib.App();
if (!process.env.STACK_NAME) {
    throw new Error('Name of CDK stack was not specified!');
}
const commandCwd = (_a = process.env.CWD) !== null && _a !== void 0 ? _a : process.cwd();
// This is configured in rollup as exported file is in dist folder.
const cdkFolder = __dirname;
new NextStandaloneStack(app, process.env.STACK_NAME, {
    apigwServerPath: '/_server',
    apigwImagePath: '/_image',
    assetsZipPath: path__default["default"].resolve(commandCwd, './next.out/assetsLayer.zip'),
    codeZipPath: path__default["default"].resolve(commandCwd, './next.out/code.zip'),
    dependenciesZipPath: path__default["default"].resolve(commandCwd, './next.out/dependenciesLayer.zip'),
    imageHandlerZipPath: path__default["default"].resolve(cdkFolder, '../dist/image-handler.zip'),
    customServerHandler: 'handler.handler',
    customImageHandler: 'handler.handler',
    lambdaTimeout: process.env.LAMBDA_TIMEOUT ? Number(process.env.LAMBDA_TIMEOUT) : 15,
    lambdaMemory: process.env.LAMBDA_MEMORY ? Number(process.env.LAMBDA_MEMORY) : 1024,
    hostedZone: (_b = process.env.HOSTED_ZONE) !== null && _b !== void 0 ? _b : undefined,
    dnsPrefix: (_c = process.env.DNS_PREFIX) !== null && _c !== void 0 ? _c : undefined,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});
app.synth();
