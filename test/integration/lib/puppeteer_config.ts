import puppeteer, {type Browser} from 'puppeteer';

export async function launchPuppeteer(headless = true, backend: 'webgl' | 'webgl2' | 'webgpu' = 'webgl2'): Promise<Browser> {
    const args = [
        '--enable-features=AllowSwiftShaderFallback,AllowSoftwareGLFallbackDueToCrashes',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist'
    ];
    const launchOptions: any = {headless, args};
    if (backend === 'webgpu') {
        args.push('--enable-unsafe-webgpu');
        // Use system Chrome for WebGPU support (Homebrew Chromium lacks it)
        const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || systemChrome;
    }
    return puppeteer.launch(launchOptions);
}