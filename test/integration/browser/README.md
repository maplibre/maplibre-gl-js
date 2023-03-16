This folder contains files for automated testing of Maplibre GL in real browsers using [Selenium WebDriver](https://www.npmjs.com/package/selenium-webdriver).

## Prerequisites

To run Webdriver, you'll have to install the driver for every browser you want to test in.

- **Google Chrome**: `npm install -g chromedriver`
- **Mozilla Firefox**: `npm install -g geckodriver`
- **Apple Safari**: (`safaridriver` ships with macOS)
- **Microsoft Edge**: See https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/

## Running

- Run browser tests with `npx jest test/integration/browser/browser.test.ts`.
