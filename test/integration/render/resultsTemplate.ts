// eslint-disable-next-line no-unused-expressions
(meta) => `
<!doctype html>
<html lang="en">
<head>
<title>Render Test Results</title>
<style>
    body { 
        font: 18px/1.2 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; 
        padding: 10px; 
    }
    h1 { 
        font-size: 32px; 
        margin-bottom: 0; 
    }
    button { 
        vertical-align: middle; 
    }
    h2 { 
        font-size: 24px; 
        font-weight: normal; 
        margin: 10px 0 10px; 
        line-height: 1; 
    }
    img { 
        margin: 0 10px 10px 0; 
        border: 1px dotted #ccc; 
    }
    .stats { 
        margin-top: 10px; 
    }
    .test { 
        border-bottom: 1px dotted #bbb; 
        padding-bottom: 5px; 
    }
    .tests { 
        border-top: 1px dotted #bbb; 
        margin-top: 10px; 
    }
    .diff { 
        color: #777; 
    }
    .test p, .test pre { 
        margin: 0 0 10px; 
    }
    .test pre { 
        font-size: 14px; 
    }
    .label { 
        color: white; 
        font-size: 18px; 
        padding: 2px 6px 3px; 
        border-radius: 3px; 
        margin-right: 3px; 
        vertical-align: bottom; 
        display: inline-block; 
    }
    .hide { 
        display: none; 
    }
</style>
</head>

<body>

<div class="tests passed">
    <h1 style="color: green;"><button id="toggle-passed">Toggle</button> Passed Tests (${meta.passed.length})</h1>
    <!-- Passed tests go here -->
</div>

<div class="tests failed">
    <h1 style="color: red;"><button id="toggle-failed">Toggle</button> Failed Tests (${meta.failed.length})</h1>
    <!-- Failed tests go here -->
</div>

<div class="tests errored">
    <h1 style="color: black;"><button id="toggle-errored">Toggle</button> Errored Tests (${meta.errored.length})</h1>
    <!-- Errored tests go here -->
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
        for (const row of document.querySelectorAll('.tests.passed .test')) {
            row.classList.toggle('hide');
        }
    });
    document.getElementById('toggle-failed').addEventListener('click', function (e) {
        for (const row of document.querySelectorAll('.tests.failed .test')) {
            row.classList.toggle('hide');
        }
    });
    document.getElementById('toggle-errored').addEventListener('click', function (e) {
        for (const row of document.querySelectorAll('.tests.errored .test.')) {
            row.classList.toggle('hide');
        }
    });
</script>
</body>
</html>
`;