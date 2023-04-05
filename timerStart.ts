import fs from 'fs';

const timingFile = './staging/.timing';
const start = Date.now();

if (!fs.existsSync('./staging')) {
    fs.mkdirSync('./staging');
}

fs.writeFileSync(timingFile, `${start}`, 'utf8');
console.log('Start time:', (new Date()).toLocaleTimeString());
