import childProcess from 'child_process';

export default {
    command: 'tutorial [args...]',
    desc: 'Run pear terminal tutorial project with custom arguments.',
    handler: tutorial,
};

async function tutorial(options) {
    const args = ['dev', 'pear/tutorial', ...(options.args ?? [])];

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
