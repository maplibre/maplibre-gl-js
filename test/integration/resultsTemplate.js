// eslint-disable-next-line no-unused-expressions
(meta) => `<style>
body { font: 18px/1.2 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; padding: 10px; }
h1 { font-size: 32px; margin-bottom: 0; }
button { vertical-align: middle; }
h2 { font-size: 24px; font-weight: normal; margin: 10px 0 10px; line-height: 1; }
img { margin: 0 10px 10px 0; border: 1px dotted #ccc; }
.stats { margin-top: 10px; }
.test { border-bottom: 1px dotted #bbb; padding-bottom: 5px; }
.tests { border-top: 1px dotted #bbb; margin-top: 10px; }
.diff { color: #777; }
.test p, .test pre { margin: 0 0 10px; }
.test pre { font-size: 14px; }
.label { color: white; font-size: 18px; padding: 2px 6px 3px; border-radius: 3px; margin-right: 3px; vertical-align: bottom; display: inline-block; }
.hide { display: none; }
</style>

${meta.unsuccessful.length ?
        `<h1 style="color: red;">${meta.unsuccessful.length} tests failed.` :
        '<h1 style="color: green;">All tests passed!'}

    <button id='toggle-sequence'>Toggle test sequence</button>
    <button id='toggle-passed'>Toggle passed tests</button>
    <button id='toggle-ignored'>Toggle ignored tests</button>
</h1>

<p class="stats">${Object.keys(meta.stats).map(status => `${meta.stats[status]} ${status}`).join(', ')}.</p>

<div id='test-sequence' class='hide'>
    ${meta.unsuccessful.length ? `<p><strong>Failed tests:</strong>
      ${meta.unsuccessful.map(failedTest => failedTest.id)}
      </p>` : ''}

    <p><strong>Test sequence:</strong>
    ${meta.tests.map(sequence => sequence.id)}

    ${meta.shuffle ? `<p><strong>Shuffle seed</strong>: ${meta.seed}</p>` : ''}
</div>

<script>
document.addEventListener('mouseover', handleHover);
document.addEventListener('mouseout', handleHover);

function handleHover(e) {
    var el = e.target;
    if (el.tagName === 'IMG' && el.dataset.altSrc) {
        var tmp = el.src;
        el.src = el.dataset.altSrc;
        el.dataset.altSrc = tmp;
    }
}

document.getElementById('toggle-passed').addEventListener('click', function (e) {
    for (const row of document.querySelectorAll('.test.passed')) {
        row.classList.toggle('hide');
    }
});
document.getElementById('toggle-ignored').addEventListener('click', function (e) {
    for (const row of document.querySelectorAll('.test.ignored')) {
        row.classList.toggle('hide');
    }
});
document.getElementById('toggle-sequence').addEventListener('click', function (e) {
    document.getElementById('test-sequence').classList.toggle('hide');
});
</script>

<div class="tests">
<!-- results go here -->
</div>`;
