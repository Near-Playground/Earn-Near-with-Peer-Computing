import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalkTemplate from 'chalk-template';
import tutorialCommand from './commands/tutorial.js';

// Remarks from: Steve Kok
// This code is copied and edited from https://github.com/near/near-cli/blob/master/bin/near-cli.js
// I have checked the documentation of yargs and it seems that the code is correct.

yargs(hideBin(process.argv))
    .strict()
    .scriptName('node cli.js')
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
