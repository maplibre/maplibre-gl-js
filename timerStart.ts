import fs from 'fs';

const timingFile = './staging/.timing';
const start = Date.now();

if (!fs.existsSync('./staing/')) {
    fs.mkdirSync('./staging');
}

fs.writeFileSync(timingFile, `${start}`, 'utf8');
console.log('Start time:', (new Date()).toLocaleTimeString());
