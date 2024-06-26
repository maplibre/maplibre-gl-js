import fs from 'fs';
import sharp from 'sharp';

const exampleName = process.argv[2];
const folderPath = './docs/assets/examples/';
function listFilesInFolder(folderPath: string): string[] {
    try {
        // Read the contents of the folder
        const files = fs.readdirSync(folderPath);
        return files;
    } catch (error) {
        return [`Error: ${error.message}`];
    }
}

function generateWebPImage(inputFileName: string) {
    const outputFileName = inputFileName.replace('.png', '.webp');
    const inputFilePath = `${folderPath}${inputFileName}`;
    const outputFilePath = `${folderPath}${outputFileName}`;

    convertToWebP(inputFilePath, outputFilePath);
    console.log(`Convert ${inputFilePath} to ${outputFilePath}`);
}

function convertToWebP(inputFile: string, outputFile: string) {
    sharp(inputFile)
        .webp({quality: 90, lossless: false})
        .toFile(outputFile)
        .then(() => {
            console.log(`Created ${outputFile}`);
        })
        .catch((err) => {
            console.log(err);
        });
}

if (exampleName) {
    generateWebPImage(`${exampleName}.png`);
} else {
    const fileNames = listFilesInFolder(folderPath);
    fileNames.forEach((inputFileName) => {
        generateWebPImage(inputFileName);
    });
}
