/* global Pear */
import Hyperswarm from 'hyperswarm'; // Module for P2P networking and connecting peers
import b4a from 'b4a'; // Module for buffer-to-string and vice-versa conversions
import crypto from 'hypercore-crypto'; // Cryptographic functions for generating the key in app
import readline from 'bare-readline'; // Module for reading user input in terminal
import tty from 'bare-tty'; // Module to control terminal behavior

const { teardown, config } = Pear; // Import configuration options and cleanup functions from Pear

if (config.dev) {
    const { Inspector } = await import('pear-inspect');
    const inspector = await new Inspector();
    const key = await inspector.enable();
    console.log(
        JSON.stringify({
            eventType: 'debug',
            key: key.toString('hex'),
        })
    );
}

const [topic, accountId] = config.args;
const swarm = new Hyperswarm();

// Unannounce the public key before exiting the process
// (This is not a requirement, but it helps avoid DHT pollution)
teardown(() => swarm.destroy());

const rl = readline.createInterface({
    input: new tty.ReadStream(0),
    output: new tty.WriteStream(1),
});

let requestSent = false;

// When there's a new connection, listen for new messages, and output them to the terminal
swarm.on('connection', (peer) => {
    peer.once('close', () => delete peerList[name]);
    peer.on('data', (data) => handlePeerData(peer, data));
    peer.on('error', (e) => {
        console.log('Error when connecting: ', e);
    });
});

await joinRoom(topic);

rl.input.setMode(tty.constants.MODE_RAW); // Enable raw input mode for efficient key reading
rl.on('data', (data) => {
    processStdin(data);
    rl.prompt();
});
rl.prompt();

async function joinRoom(topicString) {
    const topicBuffer = b4a.from(topicString, 'hex');
    const discovery = swarm.join(topicBuffer, { client: true, server: true });
    const topic = b4a.toString(topicBuffer, 'hex');
    await discovery.flushed();
}

async function handlePeerData(peer, data) {
    try {
        const parsedData = JSON.parse(data);

        if (parsedData.eventType === 'message') {
            console.log(parsedData.message);
        }

        if (parsedData.eventType === 'faucet') {
            console.log(
                `Faucet account found: ${parsedData.accountId}, requesting funds from it...`
            );
            peer.write({
                eventType: 'sponsor',
                accountId,
            });
        }
    } catch (e) {
        //do nothing
    }
}

async function processStdin(data) {
    // do nothing
}
