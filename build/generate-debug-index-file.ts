/** This file is meant to create an index.html file to allow knowing which debug files exists */
import fs from 'fs';

const htmlFilesLinks = fs.readdirSync('test/debug-pages')
    .filter(f => f.endsWith('.html'))
    .map(f => `    <a href='/test/debug-pages/${f}'>${f}</a><br/>`)
    .join('\n');

fs.writeFileSync('test/debug-pages/index.html', `
<html>
<head>
    <title>Debug Pages</title>
</head>
<body>
    <h1>Debug Pages</h1>
${htmlFilesLinks}
</body>
</html>
`);
