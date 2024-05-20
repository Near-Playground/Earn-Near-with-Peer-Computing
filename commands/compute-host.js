import childProcess from 'child_process';
import { parseSeedPhrase } from 'near-seed-phrase';
import * as nearApiJs from 'near-api-js';
import BN from 'bn.js';
import chalkTemplate from 'chalk-template';
import crypto from 'crypto';

const questions = [];

export default {
    command: 'compute-host <account-id>',
    desc: 'Run a host to distribute computing task to peer for completion. then rewarding peer upon completion.',
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
    handler: computeHost,
};

async function computeHost(options) {
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

    const accessKeys = await account.getAccessKeys();
    const matchedAccessKey = accessKeys.find(
        (accessKey) => accessKey.public_key === publicKey
    );

    if (!matchedAccessKey) {
        console.log('Access key is wrong.');
        return;
    }

    if (matchedAccessKey.access_key.permission !== 'FullAccess') {
        console.log('Access key does not have full access.');
        return;
    }

    const args = ['dev', 'pear/compute-host', options.accountId];

    const child = childProcess.spawn('pear', [...args], {
        stdio: 'pipe',
    });

    child.on('exit', (code) => {
        if (code === 0) {
            console.log('Process exited successfully.');
        } else {
            console.error(`Process exited with code ${code}`);
        }
    });

    child.stdout.on('data', (dataBuffer) => {
        const datas = dataBuffer.toString().split('\n');

        datas.forEach((data) => processHostData(data, child, account));
    });

    process.stdin.on('data', (data) => {
        const question = data.toString().trim();

        questions.push(question);

        console.log(
            chalkTemplate`{green [Host]} Broadcasting question: "{blue ${question}}"\n`
        );

        broadcast(
            {
                eventType: 'question',
                question,
            },
            child
        );
    });
}

async function sendNearDrop(parsedData, child, account) {
    console.log(
        chalkTemplate`Sending near drop to {green ${parsedData.accountId}} as reward.`
    );

    sendMessage(
        parsedData.from,
        chalkTemplate`{green [Host]} Sending near drop as reward...`,
        child
    );

    const response = await account.sendMoney(
        parsedData.accountId,
        // 0.001 Near, i.e. 1e21 yoctoNear
        new BN('1000000000000000000000')
    );

    const transactionHash = response.transaction_outcome.id;

    console.log(
        chalkTemplate`Near drop sent. Link: {blue https://testnet.nearblocks.io/txns/${transactionHash}}\n`
    );

    sendMessage(
        parsedData.from,
        chalkTemplate`{green [Host]} Near drop sent. Link: {blue https://testnet.nearblocks.io/txns/${transactionHash}}\n`,
        child
    );
}

function sendMessage(peerName, message, child) {
    child.stdin.setEncoding('utf-8');
    child.stdin.write(
        JSON.stringify({
            eventType: 'message',
            to: peerName,
            message,
        }).concat('\r\n')
    );
}

function broadcast(object, child) {
    child.stdin.setEncoding('utf-8');
    child.stdin.write(
        JSON.stringify({
            eventType: 'broadcast',
            object,
        }).concat('\r\n')
    );
}

function processHostData(data, child, account) {
    try {
        const parsedData = JSON.parse(data);

        if (parsedData.eventType === 'log') {
            console.log(parsedData.message);
        }

        if (parsedData.eventType === 'roomCreated') {
            console.log(
                chalkTemplate`\n
Host Room created, please ask other users to type this command to start answering question from you:
{green node cli.js compute-client ${parsedData.topic} <account-id>}

{blue [Instruction]} Type anything into the terminal as question. It will be broadcasted to all currently connected users.
`
            );
        }

        if (parsedData.eventType === 'answerSubmitted') {
            if (verifyAnswer(parsedData, child)) {
                sendNearDrop(parsedData, child, account);
            }
        }
    } catch (e) {
        // do nothing
    }
}

function verifyAnswer(data, child) {
    const sha1 = crypto.createHash('sha1');
    const question = data.question;
    const answer = data.answer;
    const userName = data.from.substring(0, 6);

    console.log(
        chalkTemplate`{green [${userName}]} question: {blue ${question}}, answer: {blue ${answer}}`
    );

    if (!questions.includes(question)) {
        console.log(
            chalkTemplate`{green [${userName}]} The question already answered by someone else.`
        );

        sendMessage(
            data.from,
            chalkTemplate`{green [Host]} The question already answered by someone else.\n`,
            child
        );

        return false;
    }

    const sha1input = question.concat(answer);
    const sha1sum = sha1.update(sha1input);
    const sha1digest = sha1sum.digest('hex');

    console.log(
        chalkTemplate`{green [${userName}]} The hash of "{blue ${sha1input}} is {blue ${sha1digest}}`
    );

    if (!sha1digest.startsWith('000000')) {
        console.log(
            chalkTemplate`{green [${userName}]} It does not start with 6 zeroes. The answer is invalid.`
        );

        sendMessage(
            data.from,
            chalkTemplate`{green [Host]} Answer {blue ${data.answer}} is invalid.`,
            child
        );
        return false;
    }

    broadcast(
        {
            eventType: 'answerVerified',
            winner: data.from,
            question: data.question,
            answer: data.answer,
        },
        child
    );

    questions.splice(questions.indexOf(question), 1);

    return true;
}
