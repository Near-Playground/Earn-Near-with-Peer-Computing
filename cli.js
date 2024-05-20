import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalkTemplate from 'chalk-template';
import claimCommand from './commands/claim.js';
import computeClientCommand from './commands/compute-client/index.js';
import computeHostCommand from './commands/compute-host.js';
import faucetCommand from './commands/faucet.js';
import tutorialCommand from './commands/tutorial.js';

// Remarks from: Steve Kok
// This code is copied and edited from https://github.com/near/near-cli/blob/master/bin/near-cli.js
// I have checked the documentation of yargs and it seems that the code is correct.

yargs(hideBin(process.argv))
    .strict()
    .scriptName('node cli.js')
    .command(claimCommand)
    .command(computeClientCommand)
    .command(computeHostCommand)
    .command(faucetCommand)
    .command(tutorialCommand)
    .showHelpOnFail(true)
    .recommendCommands()
    .demandCommand(
        1,
        chalkTemplate`Pass {bold --help} to see all available commands and options.`
    )
    .usage(chalkTemplate`Usage: {bold $0 <command> [options]}`)
    .wrap(null)
    .parse();
