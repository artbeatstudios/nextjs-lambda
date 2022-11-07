import { executeAsyncCmd } from '../utils'

interface Props {
	cwd: string
	stackName: string
	appPath: string
	bootstrap: boolean
	lambdaMemory?: number
	lambdaTimeout?: number
	hostedZone?: string
	domainNamePrefix?: string
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const deployHandler = async ({ cwd, stackName, appPath, bootstrap, lambdaMemory, lambdaTimeout, domainNamePrefix, hostedZone }: Props) => {
	// All paths are absolute.
	const cdkApp = `node ${appPath}`
	const cdkCiFlags = `--require-approval never --ci`
	const envConfig = [
		`CWD=${cwd}`,
		`STACK_NAME=${stackName}`,
		lambdaMemory ? `LAMBDA_MEMORY=${lambdaMemory}` : '',
		lambdaTimeout ? `LAMBDA_TIMEOUT=${lambdaTimeout}` : '',
		hostedZone ? `HOSTED_ZONE=${hostedZone}` : '',
		domainNamePrefix ? `DNS_PREFIX=${domainNamePrefix}` : '',
	].join(' ')

	if (bootstrap) {
		await executeAsyncCmd({
			cmd: `${envConfig} ${cdkExecutable} bootstrap --app "${cdkApp}"`,
		})
	}

	await executeAsyncCmd({
		cmd: `${envConfig} ${cdkExecutable} deploy --app "${cdkApp}" ${cdkCiFlags}`,
	})
}
