import fs from "fs";
import path from "path";
import typedocConfig from "../typedoc.json" assert {type: 'json'};
import packageJson from "../package.json" assert {type: 'json'};

type HtmlDoc = {
    title: string;
    description: string;
    mdFileName: string;
}

function generateAPIIntroMarkdown(lines: string[]): string {
    let intro = `# Intro

This file is intended as a reference for the important and public classes of this API.

We reccomend to look at the [expamples](../examples/index.md) as they will help you the most to start with MapLibre.
`;
    intro += lines.map(l => l.replace("../", "./")).join("\n");
    return intro;
}

function generateMarkdownForExample(title: string, description: string, file: string, htmlContent: string): string {
    return `
# ${title}

${description}

<iframe src="../${file}" width="100%" style="border:none; height:400px"></iframe>

\`\`\`html
${htmlContent}
\`\`\`
`;
}

function generateMarkdownIndexFileOfAllExamples(indexArray: HtmlDoc[]): string {
    let indexMarkdown = "# Exmaples \n\n"
    for (let indexArrayItem of indexArray) {
        indexMarkdown += `
## [${indexArrayItem.title}](./${indexArrayItem.mdFileName})

![${indexArrayItem.description}](../assets/examples/${indexArrayItem.mdFileName!.replace(".md", "-500.png")})

${indexArrayItem.description}
`
    }
    return indexMarkdown;
}

if (!fs.existsSync(typedocConfig.out)) {
    throw new Error("Please run typedoc generation first!");
}

fs.rmSync(path.join(typedocConfig.out, "README.md"));
fs.rmSync(path.join(typedocConfig.out, "modules.md"));
// Intro file for the API
let modulesFolder = path.join(typedocConfig.out, "modules");
let content = fs.readFileSync(path.join(modulesFolder, typedocConfig.internalModule + ".md"), "utf-8");
let lines = content.split("\n");
let classesLineIndex = lines.indexOf(lines.find(l => l.endsWith("Classes")) as string);
lines = lines.splice(3, classesLineIndex - 3);
let contentString = generateAPIIntroMarkdown(lines);
fs.writeFileSync(path.join(typedocConfig.out, "README.md"), contentString);

// Examples manupilation
let examplesDocsFolder = path.join("docs", "examples");
if (fs.existsSync(examplesDocsFolder)) {
    fs.rmSync(examplesDocsFolder, { recursive: true, force: true});
}
fs.mkdirSync(examplesDocsFolder);
let examplesFolder = path.join("test", "examples");
let files = fs.readdirSync(examplesFolder);
let maplibreUnpgk = `https://unpkg.com/maplibre-gl@${packageJson.version}/`;
let indexArray = [] as HtmlDoc[];
for (let file of files) {
    let htmlFile = path.join(examplesFolder, file);
    let htmlContent = fs.readFileSync(htmlFile, 'utf-8');
    htmlContent = htmlContent.replace(/\.\.\/\.\.\//g, maplibreUnpgk);
    htmlContent = htmlContent.replace(/-dev.js/g, '.js');
    let htmlContentLines = htmlContent.split("\n");
    let title = htmlContentLines.find(l => l.includes('<title'))?.replace("<title>", "").replace("</title>", "").trim();
    let description = htmlContentLines.find(l => l.includes('og:description'))?.replace(/.*content=\"(.*)\".*/, '$1');
    fs.writeFileSync(path.join(examplesDocsFolder, file), htmlContent);
    let mdFileName = file.replace(".html", ".md");
    indexArray.push({
        title: title!,
        description: description!,
        mdFileName: mdFileName
    });
    let exampleMarkdown = generateMarkdownForExample(title, description, file, htmlContent);
    fs.writeFileSync(path.join(examplesDocsFolder, mdFileName), exampleMarkdown);
}

let indexMarkdown = generateMarkdownIndexFileOfAllExamples(indexArray);
fs.writeFileSync(path.join(examplesDocsFolder, "index.md"), indexMarkdown);

console.log("Docs generation completed, to see it in action run\n docker run --rm -it -p 8000:8000 -v ${PWD}:/docs squidfunk/mkdocs-material");
