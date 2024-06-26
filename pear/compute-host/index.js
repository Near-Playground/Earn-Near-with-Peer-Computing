/* global Pear */
import Hyperswarm from 'hyperswarm'; // Module for P2P networking and connecting peers
import b4a from 'b4a'; // Module for buffer-to-string and vice-versa conversions
import crypto from 'hypercore-crypto'; // Cryptographic functions for generating the key in app
import readline from 'bare-readline'; // Module for reading user input in terminal
import tty from 'bare-tty'; // Module to control terminal behavior

const { teardown, config } = Pear; // Import configuration options and cleanup functions from Pear

const [accountId] = config.args;
const swarm = new Hyperswarm();

// Unannounce the public key before exiting the process
// (This is not a requirement, but it helps avoid DHT pollution)
teardown(() => swarm.destroy());

const rl = readline.createInterface({
    input: new tty.ReadStream(0),
    output: new tty.WriteStream(1),
});

const peerList = {};

// When there's a new connection, listen for new messages, and output them to the terminal
swarm.on('connection', (peer) => {
    const name = b4a.toString(peer.remotePublicKey, 'hex');
    peerList[name] = peer;

    peer.once('close', () => delete peerList[name]);
    peer.on('data', (data) => handlePeerData(name, data));
    peer.on('error', (e) => {
        // do nothing
    });

    peer.write(
        JSON.stringify({
            eventType: 'host',
            accountId,
        })
    );
});

await createRoom();

rl.input.setMode(tty.constants.MODE_NORMAL); // Enable raw input mode for efficient key reading
rl.on('data', processStdin);

async function createRoom() {
    const topicBuffer = crypto.randomBytes(32);
    const discovery = swarm.join(topicBuffer, { client: true, server: true });
    const topic = b4a.toString(topicBuffer, 'hex');
    await discovery.flushed();
    console.log(
        JSON.stringify({
            eventType: 'roomCreated',
            topic,
        })
    );
}

function handlePeerData(name, data) {
    try {
        const parsedData = JSON.parse(data.toString());

        if (parsedData.eventType === 'submitAnswer') {
            console.log(
                JSON.stringify({
                    eventType: 'answerSubmitted',
                    from: name,
                    question: parsedData.question,
                    answer: parsedData.answer,
                    accountId: parsedData.accountId,
                })
            );
        }
    } catch (e) {
        //do nothing
    }
}

function processStdin(data) {
    try {
        const parsedData = JSON.parse(data.toString());

        if (parsedData.eventType === 'message') {
            const peer = peerList[parsedData.to];
            peer.write(
                JSON.stringify({
                    eventType: 'message',
                    from: accountId,
                    message: parsedData.message,
                })
            );
        } else if (parsedData.eventType === 'broadcast') {
            for (const peer of Object.values(peerList)) {
                peer.write(JSON.stringify(parsedData.object));
            }
        }
    } catch (e) {
        log(`Error parsing data: ${data.toString()}`);
    }
}

function log(message) {
    console.log(
        JSON.stringify({
            eventType: 'log',
            message,
        })
    );
}
