// eslint-disable-next-line no-unused-expressions
(meta) => `<div class="test ${meta.r.status} ${(meta.hasFailedTests && /passed/.test(meta.r.status) || /ignored/.test(meta.r.status)) ? 'hide' : ''}">
    <h2><span class="label" style="background: ${meta.r.color}">${meta.r.status}</span> ${meta.r.id}</h2>
    
    ${meta.r.status !== 'errored' ? `<img src="data:image/png;base64,${meta.r.actual}">` : ''}
    ${meta.r.error ? `<p style="color: red"><strong>Error:</strong> ${meta.r.errometa.r.message}</p>` : ''}
    ${meta.r.difference ? `<pre>${meta.r.difference.trim()}</pre>` : ''}
</div>`;
