// eslint-disable-next-line no-unused-expressions
(meta) => `<div class="test ${(meta.hasFailedTests && /passed/.test(meta.status)) ? 'hide' : ''}">
    <h2>${meta.test.id}</h2>
    ${meta.status !== 'errored' ? `
        <img width="${meta.test.width}" height="${meta.test.height}" src="${meta.test.actualPath}" data-alt-src="${meta.test.expectedPath}"><img style="width: ${meta.test.width}; height: ${meta.test.height}" src="${meta.test.diffPath}">` : ''
}
    ${meta.test.error ? `<p style="color: red"><strong>Error:</strong> ${meta.test.error.message}</p>` : ''}
    ${meta.test.difference ? `<p class="diff"><strong>Diff:</strong> ${meta.test.difference}</p>` : ''}
</div>`;
