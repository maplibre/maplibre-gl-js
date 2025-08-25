import puppeteer, {type Browser} from 'puppeteer';

export async function launchPuppeteer(): Promise<Browser> {
    return puppeteer.launch({
        headless: true,
        args: [
            '--disable-gpu',
            '--enable-features=AllowSwiftShaderFallback,AllowSoftwareGLFallbackDueToCrashes',
            '--enable-unsafe-swiftshader'
        ],
    });
}