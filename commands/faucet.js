import childProcess from 'child_process';
import { parseSeedPhrase } from 'near-seed-phrase';

export default {
    command: 'faucet <account-id>',
    desc: 'Run a faucet app that sends Near drop to other users.',
    builder: (yargs) =>
        yargs
            .option('secretKey', {
                desc: 'Secret key for the account',
                type: 'string',
                required: false,
            })
            .option('seedPhrase', {
                desc: 'Seed phrase from which to derive the secret key',
                type: 'string',
                required: false,
            })
            .conflicts('secretKey', 'seedPhrase'),
    handler: faucet,
};

async function faucet(options) {
    if (!options.secretKey && !options.seedPhrase) {
        return console.log('Either secret key or seed phrase must be provided');
    }

    let secretKey;

    if (options.secretKey) {
        secretKey = options.secretKey;
    }

    if (options.seedPhrase) {
        secretKey = parseSeedPhrase(options.seedPhrase).secretKey;
    }

    const args = ['dev', 'pear/faucet'];

    const child = childProcess.spawn('pear', [...args], {
        stdio: 'pipe',
    });

    child.stdout.on('data', (data) => {
        try {
            const parsedData = JSON.parse(data);

            if (parsedData.eventType === 'debug') {
                console.log('Pear Debug key:', parsedData.key);
            }

            if (parsedData.eventType === 'roomCreated') {
                console.log(
                    'Faucet Room created, please ask other users to type this command to get Near from you:'
                );
                console.log(
                    `node cli.js claim ${parsedData.topic} <account-id>`
                );
            }

            if (parsedData.eventType === 'sponsor') {
                console.log(
                    `Sponsor request from ${parsedData.from}, sending Near drop to ${parsedData.accountId}`
                );
            }
        } catch (e) {
            console.error(e);
        }
    });

    child.on('exit', (code) => {
        if (code === 0) {
            console.log('Process exited successfully.');
        } else {
            console.error(`Process exited with code ${code}`);
        }
    });
}
