import st from 'st';
import http from 'http';
import minimist from 'minimist';
import path from 'path';
import sqlite3 from 'sqlite3';

const argv = minimist(process.argv.slice(2));
const mount = st({path: argv.d || './', cache: false});

function notFound(res) {
    res.setHeader('Content-Type', 'text/plain');
    res.statusCode = 404;
    return res.end('404');
}

http.createServer((req, res) => {
    const url = new URL(req.url, 'http:/0.0.0.0:9966/');
    if (url.pathname === '/test/tiles') {
        const name = url.searchParams.get('name');
        const z = Number(url.searchParams.get('z'));
        const x = Number(url.searchParams.get('x'));
        const y = Math.pow(2, z) - Number(url.searchParams.get('y')) - 1; // convert xyz to tms
        const filepath = path.join('test', 'tiles', `${name}.mbtiles`);

        const mbtiles = new sqlite3.Database(filepath, sqlite3.OPEN_READONLY, ((err) => {
            if (err)
                return notFound(res);

            const sql = 'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?';
            mbtiles.get(sql, z, x, y, (err, row) => {
                if (err || !row)
                    return notFound(res);

                res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
                res.setHeader('Content-Encoding', 'gzip');
                res.statusCode = 200;
                return res.end(row.tile_data, 'binary');
            });
        }));
    } else {
        mount(req, res);
    }
}).listen(9966, '0.0.0.0', () => {
    console.log('listening at http://0.0.0.0:9966');
});
