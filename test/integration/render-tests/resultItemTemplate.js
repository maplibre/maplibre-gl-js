// eslint-disable-next-line no-unused-expressions
(meta) => `<div class="test ${meta.r.status} ${(meta.hasFailedTests && /passed/.test(meta.r.status) || /ignored/.test(meta.r.status)) ? 'hide' : ''} }">
    <h2><span class="label" style="background: ${meta.r.color}">${meta.r.status}</span> ${meta.r.id}</h2>
    ${meta.r.status !== 'errored' ? `
        <img width="${meta.r.width}" height="${meta.r.height}" src="data:image/png;base64,${meta.r.actual}" data-alt-src="data:image/png;base64,${meta.r.expected}"><img style="width: ${meta.r.width}; height: ${meta.r.height}" src="data:image/png;base64,${meta.r.diff}">` : ''
}
    ${meta.r.error ? `<p style="color: red"><strong>Error:</strong> ${meta.r.error.message}</p>` : ''}
    ${meta.r.difference ? `<p class="diff"><strong>Diff:</strong> ${meta.r.difference}</p>` : ''}
</div>`;
