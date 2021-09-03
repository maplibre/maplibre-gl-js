import packlist from 'npm-packlist'
import npmContent from 'list-npm-contents';

npmContent('maplibre-gl').then(function(last_version_files) {
    packlist({ path: '.' }).then(function(new_version_files) {
        new_version_files = new_version_files.map(file => file.replace(/\/\/+/g, '/'));
        let diff_new = new_version_files.filter(x => !last_version_files.includes(x));

        // excludes folder names which caused this script
        // to fail with message: xx files are about to be deleted in the new tarball
        // i.e. src/ui was reported but src/ui/anchor.js, src/ui/camera.js, etc are included indeed
        let diff_last = last_version_files
            .filter(x => !new_version_files.includes(x) && !new_version_files.some(y => y.startsWith(x)));

        console.log(`${diff_new.length} files are about to be added in the new tarball`)
        diff_new.forEach(file => {
            console.log('+', file);
        });
        console.log(`${diff_last.length} files are about to be deleted in the new tarball`)
        diff_last.forEach(file => {
            console.log('-', file);
        });

        if (diff_new.length > 0 || diff_last.length > 0) {
            console.log('\x1b[31m%s\x1b[0m', 'Number of files in tarball will change!');
        }
    });
});
