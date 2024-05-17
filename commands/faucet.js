import childProcess from 'child_process';
import { parseSeedPhrase } from 'near-seed-phrase';
import * as nearApiJs from 'near-api-js';
import BN from 'bn.js';

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

    const keyPair = nearApiJs.utils.KeyPair.fromString(secretKey);
    const publicKey = keyPair.getPublicKey().toString();

    const keyStore = new nearApiJs.keyStores.InMemoryKeyStore();
    await keyStore.setKey('testnet', options.accountId, keyPair);

    const near = await nearApiJs.connect({
        networkId: 'testnet',
        nodeUrl: 'https://rpc.testnet.near.org',
        keyStore,
    });

    const account = await near.account(options.accountId);

    if ((await account.state()).amount === '0') {
        console.log('Faucet account has no Near');
        return;
    }

    const accessKeys = await account.getAccessKeys();
    const matchedAccessKey = accessKeys.find(
        (accessKey) => accessKey.public_key === publicKey
    );

    console.log('matchedAccessKey:', matchedAccessKey);

    if (!matchedAccessKey) {
        console.log('Faucet key is wrong.');
        return;
    }

    if (matchedAccessKey.access_key.permission !== 'FullAccess') {
        console.log('Faucet key does not have full access.');
        return;
    }

    const args = ['dev', 'pear/faucet', options.accountId];

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
                sendNearDrop(parsedData, child, near);
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

async function sendNearDrop(parsedData, child, near) {
    console.log(
        `Sponsor request from ${parsedData.from}, sending Near drop to ${parsedData.accountId}`
    );

    child.stdin.write(
        JSON.stringify({
            eventType: 'message',
            to: parsedData.from,
            message: 'Sponsor request accepted. Sending Near drop...',
        })
    );

    const response = await account.sendMoney(
        parsedData.accountId,
        // 0.001 Near, i.e. 1e21 yoctoNear
        new BN('1000000000000000000000')
    );

    const transactionHash = response.transaction_outcome.id;

    child.stdin.write(
        JSON.stringify({
            eventType: 'message',
            to: parsedData.from,
            message: `Near drop sent. Link: https://nearblocks.io/txns/${transactionHash}`,
        })
    );
}
