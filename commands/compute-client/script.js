import crypto from 'crypto';

const question = process.argv[2];

if (!question) {
    process.exit(1);
}

let answerFound = false;

function log(object) {
    if (process.send) {
        process.send(JSON.stringify(object));
    } else {
        console.log(JSON.stringify(object));
    }
}

let attempt = 0;

function findAnswer() {
    if (answerFound) {
        return;
    }

    // if we loop 1000 times on all child process, the progress bar seems weird because all of them ends with multiples of 1000
    // By randoming the looping times, we can make the progress bar more dynamic
    for (let i = 0; i < Math.round(Math.random() * 400 + 800); i++) {
        attempt++;

        const answer = crypto.randomBytes(4).toString('hex');

        const sha1 = crypto.createHash('sha1');
        const sha1input = question.concat(answer);
        const hash = sha1.update(sha1input).digest('hex');

        if (hash.startsWith('000000')) {
            log({
                eventType: 'attempt',
                attempt,
            });

            log({
                eventType: 'answerFound',
                question,
                answer,
                hash,
            });
            answerFound = true;
            return;
        }
    }

    log({
        eventType: 'attempt',
        attempt,
    });

    setTimeout(findAnswer, 0);
}

findAnswer();
