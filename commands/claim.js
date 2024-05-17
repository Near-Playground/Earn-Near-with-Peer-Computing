import childProcess from 'child_process';

export default {
    command: 'claim <room-id> <account-id>',
    desc: 'Claim Near drop from the specific room id with specific account id.',
    handler: claim,
};

async function claim(options) {
    const args = ['dev', 'pear/claim', options.roomId, options.accountId];

    const child = childProcess.spawn('pear', [...args], {
        stdio: 'inherit',
    });

    child.on('exit', (code) => {
        if (code === 0) {
            console.log('Process exited successfully.');
        } else {
            console.error(`Process exited with code ${code}`);
        }
    });
}
