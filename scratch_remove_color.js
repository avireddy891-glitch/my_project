const fs = require('fs');

let html = fs.readFileSync('frontend/index.html', 'utf8');

// The pattern looks like this:
// <button id="btn-{device}-on" class="btn btn-on" style="...">ON</button>
// We'll replace `class="btn btn-on"` with `class="btn btn-off"` specifically for the buttons that have an id starting with `btn-` and ending with `-on`.
// But we should ONLY do this for the device buttons.
const regex = /<button id="(btn-[^"]+-on)" class="btn btn-on"/g;

html = html.replace(regex, '<button id="$1" class="btn btn-off"');

fs.writeFileSync('frontend/index.html', html);
console.log("Updated index.html to make buttons colorless initially.");
