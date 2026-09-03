const fs = require('fs');

function getTabContent(farm) {
    return `
        <!-- ${farm} -->
        <main id="tab-${farm}" class="dashboard-grid tab-content">
            <section class="glass-panel weather-panel">
                <div class="panel-header">
                    <h2><i class="fas fa-cloud-sun-rain"></i> 기상대</h2>
                    <div class="status-indicator"></div>
                </div>
                <div class="weather-content" style="display:flex; flex-direction:column; padding: 1rem 0;">
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 0; color:var(--text-secondary);">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:1rem;"></i>
                        <p>장비 연동 대기 중</p>
                    </div>
                    
                    <div class="pesticide-tracker" style="padding: 1rem; margin-top: 1rem; background: rgba(0,0,0,0.2); border-radius: 0.5rem; width: 100%;">
                        <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: center;">
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">
                                <i class="fa-solid fa-spray-can"></i> 최근농약 : <span class="last-pesticide-date" style="color:var(--text-primary); font-weight:bold;">기록 없음</span>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-align: right;">
                                누적강수량
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">
                                누적강수량 : <span class="pesticide-rain-val highlight-danger" style="font-size: 1.1rem; font-weight:bold;">0.0mm</span>
                            </div>
                            <div style="text-align: right;">
                                <button class="action-btn-small btn-reset-rain" data-farm="${farm}" style="background-color: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.35rem 0.6rem; font-size: 0.8rem;"><i class="fa-solid fa-rotate-left"></i> 초기화</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="glass-panel log-panel">
                <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2><i class="fa-solid fa-book-open"></i> 농사일지 (작물 관리)</h2>
                    <button class="action-btn-small btn-open-modal" data-farm="${farm}"><i class="fa-solid fa-plus"></i> 새 기록</button>
                </div>
                <div class="log-content">
                    <div class="erp-stats-container">
                        <div class="erp-stat-card harvest-card">
                            <i class="fa-solid fa-wheat-awn"></i>
                            <div class="stat-info">
                                <span class="stat-label">올해 총 수확량</span>
                                <span class="stat-value"><span class="annual-harvest-val">0</span> kg</span>
                            </div>
                        </div>
                        <div class="erp-stat-card sales-card">
                            <i class="fa-solid fa-won-sign"></i>
                            <div class="stat-info">
                                <span class="stat-label">올해 총 매출액</span>
                                <span class="stat-value"><span class="annual-sales-val">0</span> 원</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="log-list-container">
                        <h3>최근 기록</h3>
                        <ul class="log-list farming-log-list">
                            <li class="empty-log">기록이 없습니다.</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section class="glass-panel cctv-panel">
                <div class="panel-header">
                    <h2><i class="fa-solid fa-video"></i> 농장 CCTV</h2>
                    <div class="status-indicator"></div>
                </div>
                <div class="cctv-viewer" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:200px; color:var(--text-secondary);">
                    <i class="fa-solid fa-video-slash" style="font-size:2rem; margin-bottom:1rem;"></i>
                    <p>장비 연동 대기 중</p>
                </div>
            </section>

            <section class="glass-panel switch-panel">
                <div class="panel-header">
                    <h2><i class="fa-solid fa-plug-circle-bolt"></i> 스마트 스위치 제어</h2>
                    <div class="status-indicator"></div>
                </div>
                <div class="switch-grid" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:150px; color:var(--text-secondary);">
                    <i class="fa-solid fa-plug" style="font-size:2rem; margin-bottom:1rem;"></i>
                    <p>장비 연동 대기 중</p>
                </div>
            </section>
        </main>
`;
}

let html = fs.readFileSync('g:/내 드라이브/귤/스마트팜/대시보드/index.html', 'utf8');

// Replace everything from <!-- 2. 하예동 --> to the end of the tabs with our new content
const startIndex = html.indexOf('<!-- 2. 하예동');
const endIndex = html.indexOf('</div>', html.indexOf('</main>', html.lastIndexOf('</main>')) + 7);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = getTabContent('haye') + getTabContent('hawon') + getTabContent('hahyo') + '    </div>';
    html = html.substring(0, startIndex) + newContent + html.substring(endIndex + 6);
    fs.writeFileSync('g:/내 드라이브/귤/스마트팜/대시보드/index.html', html);
    console.log('Restored and fixed index.html');
} else {
    console.log('Could not find indices');
}
