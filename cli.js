import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalkTemplate from 'chalk-template';
import testCommand from './commands/test.js';

yargs(hideBin(process.argv))
    .strict()
    .scriptName('npm start')
    .command(testCommand)
    .showHelpOnFail(true)
    .recommendCommands()
    .demandCommand(
        1,
        chalkTemplate`Pass {bold --help} to see all available commands and options.`
    )
    .usage(chalkTemplate`Usage: {bold $0 <command> [options]}`)
    .wrap(null)
    .parse();
