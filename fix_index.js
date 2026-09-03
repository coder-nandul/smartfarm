const fs = require('fs');

let html = fs.readFileSync('g:/내 드라이브/귤/스마트팜/대시보드/index.html', 'utf8');

const farms = ['haye', 'hawon', 'hahyo'];

for (const farm of farms) {
    // 1. Remove pesticide-tracker from log-panel
    const trackerRegex = new RegExp(`<div class="pesticide-tracker"[\\s\\S]*?data-farm="${farm}"[\\s\\S]*?</div>\\s*</div>\\s*</div>`, 'g');
    
    let trackerHtml = '';
    html = html.replace(trackerRegex, (match) => {
        trackerHtml = match.trim();
        return ''; // remove it
    });

    // 2. Insert into weather-content
    const weatherRegex = new RegExp(`(<main id="tab-${farm}"[\\s\\S]*?<div class="weather-content") style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 0; color:var(--text-secondary);">\\s*<i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:1rem;"></i>\\s*<p>장비 연동 대기 중</p>\\s*</div>`);
    
    html = html.replace(weatherRegex, `$1 style="display:flex; flex-direction:column;">
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 0; color:var(--text-secondary);">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:1rem;"></i>
                        <p>장비 연동 대기 중</p>
                    </div>
                    ${trackerHtml}
                </div>`);
}

fs.writeFileSync('g:/내 드라이브/귤/스마트팜/대시보드/index.html', html);
console.log('Fixed index.html');
