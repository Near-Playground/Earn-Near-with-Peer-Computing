import childProcess from 'child_process';

export default {
    command: 'test [args...]',
    desc: 'Run pear dev with custom arguments.',
    handler: test,
};

async function test(options) {
    const args = ['dev', '.', ...(options.args ?? [])];

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
