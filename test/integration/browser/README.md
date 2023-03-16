This folder contains files for automated testing of Maplibre GL in real browsers using [Selenium WebDriver](https://www.npmjs.com/package/selenium-webdriver).

## Prerequisites

To run Webdriver, you'll have to install the driver for every browser you want to test in.

- **Google Chrome**: `npm install -g chromedriver`
- **Mozilla Firefox**: `npm install -g geckodriver`
- **Apple Safari**: (`safaridriver` ships with macOS)
- **Microsoft Edge**: See https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/

## Running

- Run browser tests with `npx jest test/integration/browser/browser.test.ts`.
- The tests default to Chrome, but it's possible to use a different browser by setting the `SELENIUM_BROWSER` environment variable, e.g. like this: `SELENIUM_BROWSER=firefox npx jest test/integration/browser/browser.test.ts` (on Linux platform).
- To run on iOS Safari, use `SELENIUM_BROWSER=safari::ios npx jest test/integration/browser/browser.test.ts`. Make sure that the iOS device is in the same local Wifi network as your computer.
- To run on Android Chrome, use `SELENIUM_BROWSER=chrome::android npx jest test/integration/browser/browser.test.ts`. Make sure that the Android device is in the same local Wifi network as your computer.
