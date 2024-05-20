import childProcess from 'child_process';
import chalkTemplate from 'chalk-template';
import cliProgress from 'cli-progress';

const __dirname = new URL('.', import.meta.url).pathname;

export default {
    command: 'compute-client <room-id> <account-id>',
    desc: 'Run a client to do heavy computing task from host.',
    builder: (yargs) =>
        yargs.option('workers', {
            desc: 'The amount of workers to use for the computation',
            type: 'number',
            default: 4,
        }),
    handler: computeClient,
};

let currentTask = null;
let p2pChild = null;

async function computeClient(options) {
    const args = [
        'dev',
        'pear/compute-client',
        options.roomId,
        options.accountId,
    ];

    const child = childProcess.spawn('pear', [...args], {
        stdio: 'pipe',
    });

    p2pChild = child;

    child.on('exit', (code) => {
        if (code === 0) {
            console.log('Process exited successfully.');
        } else {
            console.error(`Process exited with code ${code}`);
        }
    });

    child.stdin.setEncoding('utf-8');

    child.stdout.on('data', (dataBuffer) => {
        const dataString = dataBuffer.toString().trim();

        try {
            const data = JSON.parse(dataString);

            if (data.eventType === 'answerVerified') {
                if (data.question === currentTask.question) {
                    currentTask.workerBar.stop();
                    currentTask.abort = true;
                }

                console.log(
                    chalkTemplate`{green [Info]} User {blue ${data.winner}} found the answer for question "{blue ${data.question}}, the answer is {blue ${data.answer}}".`
                );
            } else if (data.eventType === 'message') {
                console.log(data.message);
            } else if (data.eventType === 'question') {
                if (currentTask) {
                    return;
                }

                currentTask = {
                    question: data.question,
                    workersCount: options.workers,
                };

                console.log(
                    chalkTemplate`{green [Info]} Received question: "{blue ${data.question}}"`
                );

                computeHash();
            }
        } catch (e) {
            //do nothing
        }
    });
}

function computeHash() {
    const { question, workersCount } = currentTask;

    console.log(
        chalkTemplate`{green [Info]} Solving "{blue ${question}}" with ${workersCount} workers`
    );

    const workerBar = new cliProgress.MultiBar(
        {
            clearOnComplete: false,
            hideCursor: true,
            format: `Worker {workerId}: {value} attempts made`,
        },
        cliProgress.Presets.shades_grey
    );

    currentTask.workerBar = workerBar;

    const workers = [];

    for (let i = 0; i < workersCount; i++) {
        const child = childProcess.fork(`${__dirname}/script.js`, [question], {
            stdio: 'pipe',
        });

        const workerInfo = {
            workerId: i,
            child,
            attempt: 0,
        };

        // Show the full progress as estimatedCalculationNeeded to take care of bad luck
        // User will be happy to see the calculation done faster than expected
        const bar = workerBar.create(0, 0, {
            workerId: i,
        });

        child.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                if (data.eventType === 'answerFound') {
                    workerBar.stop();

                    for (const worker of workers) {
                        worker.child?.kill && worker.child.kill();
                    }

                    console.log(
                        chalkTemplate`{green [Info]} Worker ${i} found the answer: ${data.answer}`
                    );

                    console.log(
                        chalkTemplate`{green [Info]} The sha1 digest of "{blue ${question}${data.answer}}" is {blue ${data.hash}}`
                    );

                    p2pChild.stdin.write(
                        JSON.stringify({
                            eventType: 'answerFound',
                            question,
                            answer: data.answer,
                        }).concat('\r\n')
                    );

                    currentTask.abort = true;
                } else if (data.eventType === 'attempt') {
                    workerInfo.attempt = data.attempt;
                    bar.update(data.attempt);
                }
            } catch (e) {
                console.log(message, e);
            }
        });

        child.on('exit', () => {
            bar.stop();
        });

        workers.push(workerInfo);
    }

    function stopWorkers() {
        if (currentTask.abort !== true) {
            return setTimeout(stopWorkers, 1000);
        }

        for (const worker of workers) {
            worker.child?.kill && worker.child.kill();
        }

        currentTask = null;
    }

    stopWorkers();
}
