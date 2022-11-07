import { Command } from 'commander'
import path from 'path'
import packageJson from '../package.json'
import { changelogHandler } from './cli/changelog'
import { deployHandler } from './cli/deploy'
import { guessHandler } from './cli/guess'
import { packHandler } from './cli/pack'
import { shipitHandler } from './cli/shipit'
import { wrapProcess } from './utils'

const commandCwd = process.cwd()
const program = new Command()

program
	//
	.name(packageJson.name)
	.description(packageJson.description)
	.version(packageJson.version)

program
	.command('pack')
	.description('Package standalone Next12 build into Lambda compatible ZIPs.')
	.option('--cwd <path>', 'Current working directory', process.cwd())
	.option('--standaloneFolder <path>', 'Folder including NextJS standalone build. Parental folder should include more folders as well.', '.next/standalone')
	.option('--publicFolder <path>', 'Folder where public assets are located, typically this folder is located in root of the project.', './public')
	.option(
		'--handlerPath <path>',
		'Path to custom handler to be used to handle ApiGw events. By default this is provided for you.',
		path.resolve(path.dirname(__filename), './server-handler.js'),
	)
	.option(
		'--outputFolder <path>',
		'Path to folder which should be used for outputting bundled ZIP files for your Lambda. It will be cleared before every script run.',
		'./next.out',
	)
	.action(async (options) => {
		console.log('Our config is: ', options)
		const { standaloneFolder, publicFolder, handlerPath, outputFolder, cwd } = options
		wrapProcess(
			packHandler({
				commandCwd: cwd,
				handlerPath, //: path.resolve(commandCwd, handlerPath),
				outputFolder: path.resolve(cwd, outputFolder),
				publicFolder: path.resolve(cwd, publicFolder),
				standaloneFolder: path.resolve(cwd, standaloneFolder),
			}),
		)
	})

program
	.command('guess')
	.description('Calculate next version based on last version and commit message.')
	.argument('<commitMessage>', 'Commit message to use for guessing bump.')
	.argument('<latestVersion>', 'Your existing app version which should be used for calculation of next version.')
	.option('-t, --tagPrefix <prefix>', 'Prefix version with string of your choice', 'v')
	.action(async (commitMessage, latestVersion, options) => {
		console.log('Our config is: ', options)
		const { tagPrefix } = options
		wrapProcess(guessHandler({ commitMessage, latestVersion, tagPrefix }))
	})

program
	.command('shipit')
	.description('Get last tag, calculate bump version for all commits that happened and create release branch.')
	.option('--cwd <path>', 'Current working directory', process.cwd())
	.option('--failOnMissingCommit', 'In case commit has not happened since last tag (aka. we are on latest tag) fail.', Boolean, true)
	.option('-f, --forceBump', 'In case no compatible commits found, use patch as fallback and ensure bump happens.', Boolean, true)
	.option('-a, --autoPush', 'This will automatically create release branch and tag commit in master.', Boolean, true)
	.option('-t, --tagPrefix <prefix>', 'Prefix version with string of your choice.', 'v')
	.option('-r, --releaseBranchPrefix <prefix>', 'Prefix for release branch fork.', 'release/')
	.option('--gitUser <user>', 'User name to be used for commits.', 'Bender')
	.option('--gitEmail <email>', 'User email to be used for commits.', 'bender@bot.eu')
	.option('--changelog', 'Generate changelog.', false)
	.action(async (options) => {
		console.log('Our config is: ', options)
		const { tagPrefix, failOnMissingCommit, releaseBranchPrefix, forceBump, gitUser, gitEmail, changelog, cwd } = options
		wrapProcess(
			shipitHandler({
				tagPrefix,
				gitEmail,
				gitUser,
				failOnMissingCommit,
				forceBump,
				releaseBranchPrefix,
				generateChangelog: changelog,
				changelogPath: path.resolve(cwd, './CHANGELOG.md'),
			}),
		)
	})

program
	.command('deploy')
	.description('Deploy Next application via CDK')
	.option('--stackName <name>', 'Name of the stack to be deployed.', 'StandaloneNextjsStack-Temporary')
	.option('--appPath <path>', 'Absolute path to app.', path.resolve(__dirname, '../dist/cdk-app.js'))
	.option('--bootstrap', 'Bootstrap CDK stack.', false)
	.option('--lambdaTimeout <sec>', 'Set timeout for lambda function handling server requirests.', Number, 15)
	.option('--lambdaMemory <mb>', 'Set memory for lambda function handling server requirests.', Number, 512)
	.option('--hostedZone <domainName>', 'Hosted zone domain name to be used for creating DNS records (example: example.com).', undefined)
	.option('--domainNamePrefix <prefix>', 'Prefix for creating DNS records, if left undefined, hostedZone will be used (example: app).', undefined)
	.action(async (options) => {
		console.log('Our config is: ', options)
		// const { stackName, appPath, bootstrap, lambdaTimeout, lambdaMemory, hostedZone, domainNamePrefix } = options
		wrapProcess(deployHandler(options))
	})

program
	.command('changelog')
	.description('Generate changelog from Git, assuming tag being a release.')
	.option('--cwd <path>', 'Current working directory', process.cwd())
	.option('--outputFile <path>', 'Path to file where changelog should be written.', './CHANGELOG.md')
	.option('--gitBaseUrl <url>', 'Absolute URL to your git project', undefined)
	.action(async (options) => {
		console.log('Our config is: ', options)
		const { outputFile, gitBaseUrl, cwd } = options
		wrapProcess(changelogHandler({ outputFile: path.resolve(cwd, outputFile), gitBaseUrl }))
	})

program.parse(process.argv)
