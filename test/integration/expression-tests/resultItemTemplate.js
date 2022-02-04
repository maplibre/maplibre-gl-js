// eslint-disable-next-line no-unused-expressions
(meta) => `<div class="test ${meta.r.status} ${(meta.hasFailedTests && /passed/.test(meta.r.status) || /ignored/.test(meta.r.status)) ? 'hide' : ''}">
    <h2><span class="label" style="background: ${meta.r.color}">${meta.r.status}</span> ${meta.r.id}</h2>
    <pre>${meta.r.expression}</pre>

    ${meta.r.error ? `<p style="color: red"><strong>Error:</strong> ${meta.r.error.message}</p>` : ''}

    ${meta.r.difference ? `
    <strong>Difference:</strong>
    <pre>${meta.r.difference}</pre>
    ` : ''}

    ${meta.r.serialized ? `
    <strong>Serialized:</strong>
    <pre>${meta.r.serialized}</pre>
    ` : ''}
</div>`;
