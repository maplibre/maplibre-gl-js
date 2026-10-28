self.addEventListener('message', ({data}) => postMessage(data));
postMessage('installed');
await new Promise((resolve) => setTimeout(resolve, 200));
postMessage('ready');
