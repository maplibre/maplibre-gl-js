import fs from 'fs';
export const timingFile = './staging/.timing';

if (!fs.existsSync('./staging')) {
    fs.mkdirSync('./staging');
}

if (!fs.existsSync(timingFile)) {
    // timer-stop imports this file so make sure dont write it again
    const start = Date.now();
    fs.writeFileSync(timingFile, `${start}`, 'utf8');
    console.log('Start time:', (new Date(start)).toTimeString());
}

