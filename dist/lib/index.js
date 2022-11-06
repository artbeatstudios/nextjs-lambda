'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var path = require('path');
var NextServer = require('next/dist/server/next-server');
var slsHttp = require('serverless-http');
var clientS3 = require('@aws-sdk/client-s3');
var configShared = require('next/dist/server/config-shared');
var imageOptimizer = require('next/dist/server/image-optimizer');
var awsApigatewayv2Alpha = require('@aws-cdk/aws-apigatewayv2-alpha');
var awsApigatewayv2IntegrationsAlpha = require('@aws-cdk/aws-apigatewayv2-integrations-alpha');
var awsCdkLib = require('aws-cdk-lib');
var awsCertificatemanager = require('aws-cdk-lib/aws-certificatemanager');
var awsCloudfront = require('aws-cdk-lib/aws-cloudfront');
var awsCloudfrontOrigins = require('aws-cdk-lib/aws-cloudfront-origins');
var awsLambda = require('aws-cdk-lib/aws-lambda');
var awsRoute53 = require('aws-cdk-lib/aws-route53');
var awsRoute53Targets = require('aws-cdk-lib/aws-route53-targets');
var awsS3 = require('aws-cdk-lib/aws-s3');
var awsS3Deployment = require('aws-cdk-lib/aws-s3-deployment');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
	if (e && e.__esModule) return e;
	var n = Object.create(null);
	if (e) {
		Object.keys(e).forEach(function (k) {
			if (k !== 'default') {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () { return e[k]; }
				});
			}
		});
	}
	n["default"] = e;
	return Object.freeze(n);
}

var path__namespace = /*#__PURE__*/_interopNamespace(path);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var NextServer__default = /*#__PURE__*/_interopDefaultLegacy(NextServer);
var slsHttp__default = /*#__PURE__*/_interopDefaultLegacy(slsHttp);

const sharpLayerZipPath = path__namespace.resolve(__dirname, './sharp-layer.zip');
const imageHandlerZipPath = path__namespace.resolve(__dirname, './image-handler.zip');
const serverHandlerZipPath = path__namespace.resolve(__dirname, './server-handler.zip');
path__namespace.resolve(__dirname, '../cdk');

var _a$1;
// ! This is needed for nextjs to correctly resolve.
process.chdir(__dirname);
process.env.NODE_ENV = 'production';
// This will be loaded from custom config parsed via CLI.
const nextConf = require(`${(_a$1 = process.env.NEXT_CONFIG_FILE) !== null && _a$1 !== void 0 ? _a$1 : './config.json'}`);
const config = {
    hostname: 'localhost',
    port: Number(process.env.PORT) || 3000,
    dir: path__default["default"].join(__dirname),
    dev: false,
    customServer: false,
    conf: nextConf,
};
const getErrMessage = (e) => ({ message: 'Server failed to respond.', details: e });
const nextHandler = new NextServer__default["default"](config).getRequestHandler();
const server = slsHttp__default["default"](async (req, res) => {
    await nextHandler(req, res).catch((e) => {
        // Log into Cloudwatch for easier debugging.
        console.error(`NextJS request failed due to:`);
        console.error(e);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(getErrMessage(e), null, 3));
    });
}, {
    // We have separate function for handling images. Assets are handled by S3.
    binary: false,
    provider: 'aws',
    basePath: process.env.NEXTJS_LAMBDA_BASE_PATH,
});
const handler$1 = server;

var _a;
const sourceBucket = (_a = process.env.S3_SOURCE_BUCKET) !== null && _a !== void 0 ? _a : undefined;
// Handle fetching of S3 object before optimization happens in nextjs.
const requestHandler = (bucketName) => async (req, res, url) => {
    if (!url) {
        throw new Error('URL is missing from request.');
    }
    // S3 expects keys without leading `/`
    const trimmedKey = url.href.startsWith('/') ? url.href.substring(1) : url.href;
    const client = new clientS3.S3Client({});
    const response = await client.send(new clientS3.GetObjectCommand({ Bucket: bucketName, Key: trimmedKey }));
    if (!response.Body) {
        throw new Error(`Could not fetch image ${trimmedKey} from bucket.`);
    }
    const stream = response.Body;
    const data = await new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.once('end', () => resolve(Buffer.concat(chunks)));
        stream.once('error', reject);
    });
    res.statusCode = 200;
    if (response.ContentType) {
        res.setHeader('Content-Type', response.ContentType);
    }
    if (response.CacheControl) {
        res.setHeader('Cache-Control', response.CacheControl);
    }
    res.write(data);
    res.end();
};
// Make header keys lowercase to ensure integrity.
const normalizeHeaders = (headers) => Object.entries(headers).reduce((acc, [key, value]) => ({ ...acc, [key.toLowerCase()]: value }), {});
// @TODO: Allow passing params as env vars.
const nextConfig = {
    ...configShared.defaultConfig,
    images: {
        ...configShared.defaultConfig.images,
        // ...(domains && { domains }),
        // ...(deviceSizes && { deviceSizes }),
        // ...(formats && { formats }),
        // ...(imageSizes && { imageSizes }),
        // ...(dangerouslyAllowSVG && { dangerouslyAllowSVG }),
        // ...(contentSecurityPolicy && { contentSecurityPolicy }),
    },
};
// We don't need serverless-http neither basePath configuration as endpoint works as single route API.
// Images are handled via header and query param information.
const optimizer = async (event) => {
    try {
        if (!sourceBucket) {
            throw new Error('Bucket name must be defined!');
        }
        const imageParams = imageOptimizer.ImageOptimizerCache.validateParams({ headers: event.headers }, event.queryStringParameters, nextConfig, false);
        if ('errorMessage' in imageParams) {
            throw new Error(imageParams.errorMessage);
        }
        const optimizedResult = await imageOptimizer.imageOptimizer({ headers: normalizeHeaders(event.headers) }, {}, // res object is not necessary as it's not actually used.
        imageParams, nextConfig, false, // not in dev mode
        requestHandler(sourceBucket));
        return {
            statusCode: 200,
            body: optimizedResult.buffer.toString('base64'),
            isBase64Encoded: true,
            headers: { Vary: 'Accept', 'Content-Type': optimizedResult.contentType },
        };
    }
    catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: (error === null || error === void 0 ? void 0 : error.message) || (error === null || error === void 0 ? void 0 : error.toString()) || error,
        };
    }
};
const handler = optimizer;

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

exports.NextStandaloneStack = NextStandaloneStack;
exports.imageHandler = handler;
exports.imageHandlerZipPath = imageHandlerZipPath;
exports.serverHandler = handler$1;
exports.serverHandlerZipPath = serverHandlerZipPath;
exports.sharpLayerZipPath = sharpLayerZipPath;
