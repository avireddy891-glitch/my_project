const fs = require('fs');

let html = fs.readFileSync('frontend/index.html', 'utf8');

// The pattern looks like this:
// <div style="display: flex; gap: 0.5rem;">
//     <button class="btn btn-on" style="..." onclick="controlDevice('lights', 'ON')">ON</button>
//     <button class="btn btn-off" style="..." onclick="controlDevice('lights', 'OFF')">OFF</button>
// </div>

const regex = /<div style="display: flex; gap: 0\.5rem;">\s*<button class="btn btn-on" style=".*?" onclick="controlDevice\('([^']+)', 'ON'\)">ON<\/button>\s*<button class="btn btn-off" style=".*?" onclick="controlDevice\('\1', 'OFF'\)">OFF<\/button>\s*<\/div>/g;

html = html.replace(regex, (match, device) => {
    return `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                            <div style="display: flex; gap: 0.5rem;">
                                <button id="btn-${device}-on" class="btn btn-on" style="min-width: 80px; padding: 0.6rem 1.2rem; font-size: 0.95rem; transition: 0.3s;" onclick="controlDevice('${device}', 'ON')">ON</button>
                                <button id="btn-${device}-off" class="btn btn-off" style="min-width: 80px; padding: 0.6rem 1.2rem; font-size: 0.95rem; transition: 0.3s;" onclick="controlDevice('${device}', 'OFF')">OFF</button>
                            </div>
                            <div id="data-${device}" style="display: none; font-size: 0.85rem; color: var(--text-muted); gap: 0.8rem;">
                                <span>⚡ <span id="data-${device}-power">--</span> W</span>
                                <span>🌡️ <span id="data-${device}-temp">--</span> °C</span>
                                <span>💨 <span id="data-${device}-gas">--</span> ppm</span>
                            </div>
                        </div>`;
});

fs.writeFileSync('frontend/index.html', html);
console.log("Updated index.html");
