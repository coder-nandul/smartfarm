const fs = require('fs');

let html = fs.readFileSync('g:/내 드라이브/귤/스마트팜/대시보드/index.html', 'utf8');

const farms = ['haye', 'hawon', 'hahyo'];

for (const farm of farms) {
    // 1. Find the pesticide tracker for the specific farm
    const trackerStartStr = `<div class="pesticide-tracker" style="padding: 1rem; margin-top: 1rem; background: rgba(0,0,0,0.2); border-radius: 0.5rem;">`;
    const btnStr = `<button class="action-btn-small btn-reset-rain" data-farm="${farm}"`;
    
    // Using string search to safely find the block
    const btnIndex = html.indexOf(btnStr);
    if (btnIndex === -1) continue;
    
    const trackerIndex = html.lastIndexOf(trackerStartStr, btnIndex);
    if (trackerIndex === -1) continue;
    
    const trackerEndIndex = html.indexOf('</div>\n                    </div>\n', btnIndex) + 36;
    
    const trackerHtml = html.substring(trackerIndex, trackerEndIndex);
    
    // Remove the tracker from the log-panel
    html = html.substring(0, trackerIndex) + html.substring(trackerEndIndex);
    
    // 2. Find the weather-content for the specific farm
    const tabStart = html.indexOf(`<main id="tab-${farm}"`);
    if (tabStart === -1) continue;
    
    const weatherContentStartStr = `<div class="weather-content" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 0; color:var(--text-secondary);">`;
    const weatherContentStart = html.indexOf(weatherContentStartStr, tabStart);
    if (weatherContentStart === -1) continue;
    
    const pEndStr = `<p>장비 연동 대기 중</p>\n                </div>`;
    const pEnd = html.indexOf(pEndStr, weatherContentStart);
    
    if (pEnd !== -1) {
        const replacement = `<div class="weather-content" style="display:flex; flex-direction:column; padding: 1rem 0;">
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 0; color:var(--text-secondary);">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:1rem;"></i>
                        <p>장비 연동 대기 중</p>
                    </div>
                    ${trackerHtml.trim()}
                </div>`;
        html = html.substring(0, weatherContentStart) + replacement + html.substring(pEnd + pEndStr.length);
    }
}

fs.writeFileSync('g:/내 드라이브/귤/스마트팜/대시보드/index.html', html);
console.log('Fixed index.html structure properly');
