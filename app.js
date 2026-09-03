document.addEventListener('DOMContentLoaded', () => {
    // 0. Tab Navigation Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Initialize currentFarmId based on the initially active tab
    const initialActiveBtn = document.querySelector('.tab-btn.active');
    if (initialActiveBtn) {
        window.currentFarmId = initialActiveBtn.getAttribute('data-target').replace('tab-', '');
    } else {
        window.currentFarmId = 'seohong';
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all buttons and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active to clicked button and target content
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            window.currentFarmId = targetId.replace('tab-', '');
            if (typeof fetchLogs === 'function') {
                fetchLogs();
            }
            
            // 탭이 바뀔 때 즉시 통신 상태(헤더) 업데이트
            if (typeof checkConnection === 'function') {
                checkConnection();
            }
        });
    });

    // 0.5. API Base URL (Dynamic)
    // 깃허브 등 클라우드에 프론트엔드를 배포하고, Render 등에 백엔드를 배포한 경우 
    // 아래 빈 문자열을 백엔드 주소로 변경하세요. (예: 'https://my-farm-backend.onrender.com')
    const PROD_BACKEND_URL = 'https://smartfarm-rk8a.onrender.com';
    let API_BASE = PROD_BACKEND_URL; 
    if (window.location.hostname.includes('github') || window.location.hostname.includes('onrender')) {
        API_BASE = PROD_BACKEND_URL;
    }


    // 1. Time and Date Updates
    const timeEl = document.getElementById('current-time');
    const dateEl = document.getElementById('current-date');
    const dayEl = document.getElementById('current-day');

    function updateDateTime() {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        
        // YY.MM.DD
        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        dateEl.textContent = `${year}.${month}.${date}`;
        
        // Day of week
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        dayEl.textContent = `${days[now.getDay()]}`;
    }
    
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // 1.5 Wi-Fi (Server) Connection Status
    const wifiIndicator = document.getElementById('wifi-indicator');
    const wifiText = document.getElementById('wifi-text');
    
    // 밭별 통신 장비(라우터) 정보 매핑
    const farmNetworkInfo = {
        'tab-seohong': { text: '시스템 연결됨 (LTE: CLM920-3376)', isOnline: true },
        'tab-haye': { text: '라우터 미설치 (연결 대기중)', isOnline: false },
        'tab-hawon': { text: '라우터 미설치 (연결 대기중)', isOnline: false },
        'tab-hahyo': { text: '라우터 미설치 (연결 대기중)', isOnline: false }
    };
    
    async function checkConnection() {
        const activeTabBtn = document.querySelector('.tab-btn.active');
        const currentTabId = activeTabBtn ? activeTabBtn.getAttribute('data-target') : 'tab-seohong';
        const networkInfo = farmNetworkInfo[currentTabId];

        try {
            // 서홍동(또는 서버가 살아있는 메인)일 경우에만 health check로 판단
            if (currentTabId === 'tab-seohong') {
                const res = await fetch(`${API_BASE}/api/health`, { timeout: 3000 });
                if (res.ok) {
                    wifiIndicator.className = 'wifi-indicator online';
                    wifiText.textContent = networkInfo.text;
                    wifiText.style.color = 'var(--text-secondary)';
                } else {
                    throw new Error('Not OK');
                }
            } else {
                // 다른 밭은 현재 미설치 오프라인 상태
                wifiIndicator.className = 'wifi-indicator offline';
                wifiText.textContent = networkInfo.text;
                wifiText.style.color = 'var(--text-secondary)'; // 빨간색 에러보단 회색 대기상태로 표시
            }
        } catch (e) {
            wifiIndicator.className = 'wifi-indicator offline';
            wifiText.textContent = '서버 연결 끊김 (오프라인 모드)';
            wifiText.style.color = 'var(--danger-color)';
        }
    }
    
    checkConnection();
    setInterval(checkConnection, 10000); // Check every 10 seconds

    // 2. Weather Data via Local API
    const tempEl = document.getElementById('temp-val');
    const humEl = document.getElementById('hum-val');
    const windDirEl = document.getElementById('wind-dir-val');
    const windEl = document.getElementById('wind-val');
    const rainRateEl = document.getElementById('rain-rate-val');
    const rain24hEl = document.getElementById('rain-24h-val');
    
    // Weekly rain fallback (if still in HTML)
    const weeklyRainEl = document.getElementById('weekly-rain-val');
    
    async function fetchWeatherData() {
        try {
            const res = await fetch(`${API_BASE}/api/weather`);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            
            const weatherData = Array.isArray(data.status) ? data.status : data;
            
            // Update weather name if provided
            if (data.name) {
                const weatherTitle = document.getElementById('weather-panel-title');
                if (weatherTitle) weatherTitle.innerHTML = `<i class="fas fa-cloud-sun-rain"></i> ${data.name}`;
            }
            
            if (Array.isArray(weatherData)) {
                let mappedTemp = '--';
                let mappedHum = '--';
                let mappedWind = 0;
                let mappedWindDir = '--';
                let mappedRainRate = 0;
                let mappedRain24h = 0;
                
                // 16-point compass mapping helper
                function getWindDirectionStr(val) {
                    if (typeof val === 'string' && isNaN(val)) return val;
                    const degree = parseFloat(val);
                    if (isNaN(degree)) return '--';
                    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
                    const valIndex = Math.floor((degree / 22.5) + 0.5);
                    return directions[valIndex % 16];
                }

                weatherData.forEach(item => {
                    // Strict External mapping
                    if (item.code === 'temp_current_external') mappedTemp = (item.value / 10).toFixed(1);
                    if (item.code === 'humidity_outdoor') mappedHum = item.value;
                    if (item.code === 'windspeed_gust') mappedWind = (item.value / 10).toFixed(1);
                    if (item.code === 'wind_direction') mappedWindDir = getWindDirectionStr(item.value); // Convert degrees to 16-point
                    if (item.code === 'rain_rate') mappedRainRate = (item.value / 10).toFixed(1);
                    if (item.code === 'rain_24h') mappedRain24h = (item.value / 10).toFixed(1);
                });
                
                // 바람이 0일 때 강제로 방위를 설정하던 기존(C 등) 로직을 모두 제거합니다.
                // Tuya API가 풍향 데이터를 주지 않으므로, 주어지지 않으면 그냥 빈 문자열을 출력합니다.

                if(tempEl) tempEl.textContent = mappedTemp;
                if(humEl) humEl.textContent = `${mappedHum}%`;
                if(windDirEl) windDirEl.textContent = mappedWindDir !== '--' ? mappedWindDir : '';
                if(windEl) windEl.textContent = `${mappedWind} m/s`;
                if(rainRateEl) rainRateEl.textContent = `${mappedRainRate} mm/h`;
                if(rain24hEl) rain24hEl.textContent = `${mappedRain24h} mm`;
            }
                // (Old weekly rain fetch removed as per UI update)
        } catch (e) {
            console.error('Failed to fetch weather data:', e);
            if(tempEl) tempEl.textContent = '--';
            if(humEl) humEl.textContent = '--%';
        }
    }

    fetchWeatherData();
    setInterval(fetchWeatherData, 30000);

    // 2.5 CCTV On-Demand Connection
    const btnConnectCctv = document.getElementById('btn-connect-cctv');
    const btnCloseCctv = document.getElementById('btn-close-cctv');
    const cctvOverlay = document.getElementById('cctv-overlay');
    const cctvInstructions = document.getElementById('cctv-instructions');

    btnConnectCctv.addEventListener('click', () => {
        cctvOverlay.style.display = 'none';
        cctvInstructions.style.display = 'block';
    });

    btnCloseCctv.addEventListener('click', () => {
        cctvInstructions.style.display = 'none';
        cctvOverlay.style.display = 'flex';
    });

    // 2.8 Farming Log (Mini-ERP) Interactions
    // Modal Elements
    const modal = document.getElementById('log-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    
    document.addEventListener('click', (e) => {
        const openBtn = e.target.closest('.btn-open-modal');
        if (openBtn) {
            modal.style.display = 'flex';
        }
    });
    const logForm = document.getElementById('log-form');
    const logTypeSelect = document.getElementById('log-type');
    const amountGroup = document.getElementById('amount-group');
    const amountLabel = document.getElementById('amount-label');
    const amountUnitText = document.getElementById('amount-unit-text');
    const amountUnitSelect = document.getElementById('amount-unit-select');
    const revenueGroup = document.getElementById('revenue-group');
    const logDateInput = document.getElementById('log-date');

    // Set default date to today
    const todayStr = new Date().toISOString().split('T')[0];
    logDateInput.value = todayStr;

    // btnOpenModal event replaced by event delegation('click', () => { modal.style.display = 'flex'; });
    btnCloseModal.addEventListener('click', () => { modal.style.display = 'none'; });

    // Pesticide Reset Button
    document.addEventListener('click', async (e) => {
        const resetBtn = e.target.closest('.btn-reset-rain');
        if (resetBtn) {
            if (confirm('현재 시점부터 강수량을 다시 0으로 초기화하시겠습니까? (새로운 중간 리셋 기록이 추가됩니다.)')) {
                const payload = {
                    type: 'pesticide_reset',
                    content: '강수량 초기화 (중간 리셋)',
                    amount: 0,
                    date: new Date().toISOString().split('T')[0],
                    farmId: window.currentFarmId
                };
                
                try {
                    const res = await fetch(`${API_BASE}/api/logs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        fetchLogs();
                        alert('강수량이 초기화되었습니다.');
                    } else {
                        alert('초기화에 실패했습니다.');
                    }
                } catch (e) {
                    console.error('Failed to reset rain:', e);
                    alert('네트워크 오류가 발생했습니다.');
                }
            }
        }
    });

    // Handle form dynamic fields based on log type
    logTypeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'harvest') {
            amountGroup.style.display = 'flex';
            revenueGroup.style.display = 'none';
            amountLabel.textContent = '수확량';
            amountUnitSelect.style.display = 'inline-block';
            amountUnitText.style.display = 'none';
        } else if (val === 'sales') {
            amountGroup.style.display = 'flex';
            revenueGroup.style.display = 'flex';
            amountLabel.textContent = '판매 수량';
            amountUnitSelect.style.display = 'inline-block';
            amountUnitText.style.display = 'none';
        } else {
            amountGroup.style.display = 'none';
            revenueGroup.style.display = 'none';
        }
    });

    const badgeMap = {
        pesticide: { text: '농약', class: 'badge-pesticide' },
        pesticide_reset: { text: '초기화', class: 'badge-other' },
        pruning: { text: '전정', class: 'badge-pruning' },
        fertilizer: { text: '비료', class: 'badge-fertilizer' },
        weeding: { text: '제초', class: 'badge-weeding' },
        water: { text: '관수', class: 'badge-water' },
        harvest: { text: '수확', class: 'badge-harvest' },
        sales: { text: '판매', class: 'badge-sales' },
        other: { text: '기타', class: 'badge-other' }
    };

    let currentLogsData = [];

    window.fetchLogs = async function() {
        try {
            const activeTab = document.getElementById(`tab-${window.currentFarmId}`);
            if (!activeTab) return;
            const logList = activeTab.querySelector('.farming-log-list');
            const lastPesticideDateEl = activeTab.querySelector('.last-pesticide-date');
            const pesticideRainValEl = activeTab.querySelector('.pesticide-rain-val');
            const annualHarvestEl = activeTab.querySelector('.annual-harvest-val');
            const annualSalesEl = activeTab.querySelector('.annual-sales-val');

            const res = await fetch(`${API_BASE}/api/logs?farmId=${window.currentFarmId}`);
            if (!res.ok) throw new Error('Failed to fetch logs');
            const data = await res.json();
            
            // Update Annual Stats
            if (data.annualStats && annualHarvestEl) {
                annualHarvestEl.textContent = data.annualStats.totalHarvest.toLocaleString();
                annualSalesEl.textContent = data.annualStats.totalSales.toLocaleString();
            }

            // Update Log List
            if (logList) logList.innerHTML = '';
            currentLogsData = data.logs || [];
            
            if (currentLogsData.length === 0) {
                if (logList) logList.innerHTML = '<li class="empty-log">기록이 없습니다.</li>';
            } else {
                currentLogsData.forEach(log => {
                    const li = document.createElement('li');
                    li.className = 'log-item';
                    li.style.cursor = 'pointer'; // Make it look clickable
                    li.dataset.logId = log._id;
                    
                    const badgeInfo = badgeMap[log.type] || { text: '기타', class: '' };
                    
                    let amountHtml = '';
                    if (log.type === 'harvest' && log.amount) {
                        amountHtml = `<div class="log-amount-text">${Number(log.amount).toLocaleString()} ${log.unit || 'kg'}</div>`;
                    } else if (log.type === 'sales' && log.amount) {
                        amountHtml = `
                            <div class="log-amount-text" style="color:var(--text-secondary); font-size:0.8rem;">판매량: ${Number(log.amount).toLocaleString()} ${log.unit || 'kg'}</div>
                            <div class="log-amount-text">${Number(log.revenue || 0).toLocaleString()} 원</div>
                        `;
                    }

                    li.innerHTML = `
                        <div class="log-item-header">
                            <span class="log-badge ${badgeInfo.class}">${badgeInfo.text}</span>
                            <span class="log-date">${log.date}</span>
                        </div>
                        <div class="log-text">${log.content || '내용 없음'}</div>
                        ${amountHtml}
                    `;
                    
                    li.addEventListener('click', () => openDetailModal(log));
                    logList.appendChild(li);
                });
            }
            
            // Update Pesticide Tracker
            if (lastPesticideDateEl && pesticideRainValEl) {
                if (data.pesticideInfo) {
                    lastPesticideDateEl.textContent = data.pesticideInfo.date;
                    pesticideRainValEl.textContent = `${data.pesticideInfo.cumulativeRain}mm`;
                } else {
                    lastPesticideDateEl.textContent = '기록 없음';
                    pesticideRainValEl.textContent = '0.0mm';
                }
            }
        } catch (e) {
            console.error('Log fetch error:', e);
        }
    }

    logForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            date: document.getElementById('log-date').value,
            type: document.getElementById('log-type').value,
            amount: document.getElementById('log-amount').value || 0,
            unit: amountUnitSelect.style.display !== 'none' ? amountUnitSelect.value : 'kg',
            revenue: document.getElementById('log-revenue').value || 0,
            content: document.getElementById('log-memo').value,
            farmId: window.currentFarmId
        };

        try {
            const res = await fetch(`${API_BASE}/api/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error('API Error');
            
            // Reset form and close modal
            logForm.reset();
            document.getElementById('log-date').value = todayStr;
            amountGroup.style.display = 'none';
            revenueGroup.style.display = 'none';
            modal.style.display = 'none';
            
            fetchLogs(); // Refresh data
        } catch (error) {
            alert('기록 저장에 실패했습니다. (서버 연결을 확인하세요)');
        }
    });
    
    // Detailed Log Modal Elements
    const detailModal = document.getElementById('log-detail-modal');
    const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');
    const detailLogId = document.getElementById('detail-log-id');
    const detailLogDate = document.getElementById('detail-log-date');
    const detailLogType = document.getElementById('detail-log-type');
    const detailAmountGroup = document.getElementById('detail-amount-group');
    const detailAmountLabel = document.getElementById('detail-amount-label');
    const detailLogAmount = document.getElementById('detail-log-amount');
    const detailAmountUnitSelect = document.getElementById('detail-amount-unit-select');
    const detailAmountUnitText = document.getElementById('detail-amount-unit-text');
    const detailRevenueGroup = document.getElementById('detail-revenue-group');
    const detailLogRevenue = document.getElementById('detail-log-revenue');
    const detailLogMemo = document.getElementById('detail-log-memo');
    const detailLogWeather = document.getElementById('detail-log-weather');
    const btnUpdateLog = document.getElementById('btn-update-log');
    const btnDeleteLog = document.getElementById('btn-delete-log');

    btnCloseDetailModal.addEventListener('click', () => { detailModal.style.display = 'none'; });

    detailLogType.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'harvest') {
            detailAmountGroup.style.display = 'flex';
            detailRevenueGroup.style.display = 'none';
            detailAmountLabel.textContent = '수확량';
            detailAmountUnitSelect.style.display = 'inline-block';
            detailAmountUnitText.style.display = 'none';
        } else if (val === 'sales') {
            detailAmountGroup.style.display = 'flex';
            detailRevenueGroup.style.display = 'flex';
            detailAmountLabel.textContent = '판매 수량';
            detailAmountUnitSelect.style.display = 'inline-block';
            detailAmountUnitText.style.display = 'none';
        } else {
            detailAmountGroup.style.display = 'none';
            detailRevenueGroup.style.display = 'none';
        }
    });

    function openDetailModal(log) {
        detailLogId.value = log._id;
        detailLogDate.value = log.date;
        detailLogType.value = log.type;
        detailLogType.dispatchEvent(new Event('change')); // Trigger visibility logic
        
        detailLogAmount.value = log.amount || '';
        if (log.unit === '관') detailAmountUnitSelect.value = '관';
        else detailAmountUnitSelect.value = 'kg';
        
        detailLogRevenue.value = log.revenue || '';
        detailLogMemo.value = log.content || '';
        
        // Render weather info if available
        if (log.weather) {
            const conditionText = log.weather.condition || '맑음';
            let conditionIcon = '<i class="fa-solid fa-sun"></i>';
            if (conditionText === '비') conditionIcon = '<i class="fa-solid fa-cloud-rain"></i>';
            else if (conditionText === '흐림') conditionIcon = '<i class="fa-solid fa-cloud"></i>';
            
            detailLogWeather.innerHTML = `
                <div><span style="color:var(--text-primary); font-weight:bold;">${conditionIcon} ${conditionText}</span></div>
                <div><span style="color:var(--danger-color);"><i class="fa-solid fa-temperature-arrow-up"></i> ${(log.weather.maxTemp || 0).toFixed(1)}°C</span></div>
                <div><span style="color:var(--info-color);"><i class="fa-solid fa-temperature-arrow-down"></i> ${(log.weather.minTemp || 0).toFixed(1)}°C</span></div>
                <div><span style="color:var(--accent-hover);"><i class="fa-solid fa-cloud-showers-heavy"></i> ${(log.weather.rain24h || 0).toFixed(1)}mm</span></div>
            `;
        } else {
            detailLogWeather.innerHTML = '<div style="color: var(--text-secondary); width: 100%; text-align: center;">저장된 기상 정보가 없습니다.</div>';
        }
        
        detailModal.style.display = 'flex';
    }

    btnUpdateLog.addEventListener('click', async () => {
        const id = detailLogId.value;
        const payload = {
            date: detailLogDate.value,
            type: detailLogType.value,
            amount: detailLogAmount.value || 0,
            unit: detailAmountUnitSelect.style.display !== 'none' ? detailAmountUnitSelect.value : 'kg',
            revenue: detailLogRevenue.value || 0,
            content: detailLogMemo.value
        };

        try {
            const res = await fetch(`${API_BASE}/api/logs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('API Error');
            detailModal.style.display = 'none';
            fetchLogs();
        } catch (error) {
            alert('수정에 실패했습니다.');
        }
    });

    btnDeleteLog.addEventListener('click', async () => {
        const id = detailLogId.value;
        if (confirm('이 농사일지 기록을 정말 삭제하시겠습니까?')) {
            try {
                const res = await fetch(`${API_BASE}/api/logs/${id}`, {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error('API Error');
                detailModal.style.display = 'none';
                fetchLogs();
            } catch (error) {
                alert('삭제에 실패했습니다.');
            }
        }
    });
    
    window.fetchLogs();

    // 3. Switch Controls
    const TUYA_SWITCH_ID = 'ebdba38839acebb0cbq6r2';
    const switchGrid = document.getElementById('dynamic-switch-grid');

    async function initSwitches() {
        try {
            const res = await fetch(`${API_BASE}/api/switch/${TUYA_SWITCH_ID}`);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            
            const deviceName = data.name || '스마트 스위치';
            
            switchGrid.innerHTML = ''; // Clear spinner
            
            if (Array.isArray(data.status)) {
                const switchChannels = data.status.filter(s => s.code.startsWith('switch_') && s.code !== 'switch_type' && s.code !== 'switch_inching' && s.code !== 'switch_interlock');
                
                // Sort channels numerically
                switchChannels.sort((a, b) => {
                    const numA = parseInt(a.code.replace('switch_', '')) || 0;
                    const numB = parseInt(b.code.replace('switch_', '')) || 0;
                    return numA - numB;
                });
                
                // 사용자 지정 스위치 이름 및 아이콘 매핑
                const customNames = {
                    'switch_1': '관수펌프',
                    'switch_2': '여분 스위치 2',
                    'switch_3': '여분 스위치 3',
                    'switch_4': '여분 스위치 4'
                };
                const customIcons = {
                    'switch_1': 'fas fa-power-off',
                    'switch_2': 'fa-solid fa-faucet-drip',
                    'switch_3': 'fa-solid fa-fan',
                    'switch_4': 'fa-solid fa-lightbulb'
                };
                
                switchChannels.forEach(channel => {
                    const isChecked = channel.value;
                    const cardName = customNames[channel.code] || `${deviceName} (${channel.code.replace('switch_', '')}번)`;
                    const iconClass = customIcons[channel.code] || 'fas fa-power-off';
                    
                    const card = document.createElement('div');
                    card.className = 'switch-card';
                    card.dataset.switchId = TUYA_SWITCH_ID;
                    card.innerHTML = `
                        <div class="switch-icon"><i class="${iconClass}" id="icon-${channel.code}"></i></div>
                        <div class="switch-info">
                            <h3>${cardName}</h3>
                            <p id="status-text-${channel.code}"></p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-${channel.code}" ${isChecked ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    `;
                    
                    switchGrid.appendChild(card);
                    
                    const toggleInput = document.getElementById(`toggle-${channel.code}`);
                    const statusText = document.getElementById(`status-text-${channel.code}`);
                    const icon = document.getElementById(`icon-${channel.code}`);
                    
                    const updateUI = (checked) => {
                        if (checked) {
                            statusText.textContent = '동작 중';
                            statusText.style.color = 'var(--success-color)';
                            icon.style.background = 'rgba(16, 185, 129, 0.2)';
                            icon.style.color = 'var(--success-color)';
                        } else {
                            statusText.textContent = '대기 중';
                            statusText.style.color = 'var(--text-secondary)';
                            icon.style.background = 'rgba(59, 130, 246, 0.1)';
                            icon.style.color = 'var(--accent-hover)';
                        }
                    };
                    
                    updateUI(isChecked);
                    
                    toggleInput.addEventListener('change', async (e) => {
                        const checked = e.target.checked;
                        updateUI(checked);
                        
                        try {
                            const res = await fetch(`${API_BASE}/api/switch/${TUYA_SWITCH_ID}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ state: checked, channel: channel.code })
                            });
                            
                            if (!res.ok) throw new Error('API Error');
                        } catch (error) {
                            console.error(`Command failed: Switch ${channel.code}`, error);
                            // Revert on failure
                            toggleInput.checked = !checked;
                            updateUI(!checked);
                            alert('제어에 실패했습니다. 연결을 확인하세요.');
                        }
                    });
                });
            }
        } catch (e) {
            console.error('Failed to init switches', e);
            switchGrid.innerHTML = '<div style="color:var(--danger-color); padding:1rem; grid-column:1/-1; text-align:center;">스위치 연결 실패</div>';
        }
    }
    
    initSwitches();

    // 4. Weather Statistics Modal
    const btnOpenWeatherModal = document.getElementById('btn-open-weather-modal');
    const btnCloseWeatherModal = document.getElementById('btn-close-weather-modal');
    const weatherStatsModal = document.getElementById('weather-stats-modal');
    const weatherStatsTbody = document.getElementById('weather-stats-tbody');
    
    async function loadWeatherStats() {
        try {
            weatherStatsTbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; color: var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> 통계 데이터를 불러오는 중...</td></tr>';
            const res = await fetch(`${API_BASE}/api/weather/stats`);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            
            const dates = Object.keys(data).sort((a, b) => new Date(b) - new Date(a));
            
            if (dates.length === 0) {
                weatherStatsTbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; color: var(--text-secondary);">수집된 통계 데이터가 없습니다.<br>서버가 실행된 이후부터 자동으로 수집됩니다.</td></tr>';
                return;
            }
            
            weatherStatsTbody.innerHTML = '';
            
            // Grouping logic
            const grouped = {};
            dates.forEach(date => {
                const stat = data[date];
                const d = new Date(date);
                const year = d.getFullYear();
                const month = d.getMonth() + 1;
                
                // Calculate week of the month (1~5)
                const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
                const dateNum = d.getDate();
                const weekOfMonth = Math.ceil((dateNum + firstDayOfMonth) / 7);
                
                if (!grouped[year]) grouped[year] = { totalRain: 0, months: {} };
                if (!grouped[year].months[month]) grouped[year].months[month] = { totalRain: 0, weeks: {} };
                if (!grouped[year].months[month].weeks[weekOfMonth]) grouped[year].months[month].weeks[weekOfMonth] = { totalRain: 0, days: [] };
                
                const rain = stat.rain24h || 0;
                grouped[year].totalRain += rain;
                grouped[year].months[month].totalRain += rain;
                grouped[year].months[month].weeks[weekOfMonth].totalRain += rain;
                grouped[year].months[month].weeks[weekOfMonth].days.push({ date, stat });
            });
            
            // Render table rows
            for (const year of Object.keys(grouped).sort((a, b) => b - a)) {
                const yearData = grouped[year];
                for (const month of Object.keys(yearData.months).sort((a, b) => b - a)) {
                    const monthData = yearData.months[month];
                    for (const week of Object.keys(monthData.weeks).sort((a, b) => b - a)) {
                        const weekData = monthData.weeks[week];
                        
                        // 1. Daily rows
                        weekData.days.forEach(day => {
                            const tr = document.createElement('tr');
                            tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                            tr.innerHTML = `
                                <td style="padding: 0.75rem;">${day.date}</td>
                                <td style="padding: 0.75rem; color: var(--danger-color);">${(day.stat.maxTemp || 0).toFixed(1)}°C</td>
                                <td style="padding: 0.75rem; color: var(--info-color);">${(day.stat.minTemp || 0).toFixed(1)}°C</td>
                                <td style="padding: 0.75rem; color: var(--accent-hover);">${(day.stat.rain24h || 0).toFixed(1)}mm</td>
                            `;
                            weatherStatsTbody.appendChild(tr);
                        });
                        
                        // 2. Weekly subtotal row
                        const wTr = document.createElement('tr');
                        wTr.style.background = 'rgba(255,255,255,0.03)';
                        wTr.innerHTML = `
                            <td colspan="3" style="padding: 0.5rem; text-align: right; color: var(--text-secondary); font-size: 0.85rem;">${month}월 ${week}주차 소계</td>
                            <td style="padding: 0.5rem; color: var(--accent-hover); font-weight: bold; font-size: 0.9rem;">${weekData.totalRain.toFixed(1)}mm</td>
                        `;
                        weatherStatsTbody.appendChild(wTr);
                    }
                    
                    // 3. Monthly total row
                    const mTr = document.createElement('tr');
                    mTr.style.background = 'rgba(255,255,255,0.05)';
                    mTr.innerHTML = `
                        <td colspan="3" style="padding: 0.75rem; text-align: right; color: var(--text-primary); font-weight: bold;">${year}년 ${month}월 합계</td>
                        <td style="padding: 0.75rem; color: var(--accent-color); font-weight: bold; font-size: 1.1rem;">${monthData.totalRain.toFixed(1)}mm</td>
                    `;
                    weatherStatsTbody.appendChild(mTr);
                }
                
                // 4. Yearly total row
                const yTr = document.createElement('tr');
                yTr.style.background = 'rgba(59, 130, 246, 0.1)';
                yTr.innerHTML = `
                    <td colspan="3" style="padding: 1rem; text-align: right; color: var(--text-primary); font-weight: bold; font-size: 1.1rem;">${year}년 연간 총계</td>
                    <td style="padding: 1rem; color: var(--accent-color); font-weight: bold; font-size: 1.25rem;">${yearData.totalRain.toFixed(1)}mm</td>
                `;
                weatherStatsTbody.appendChild(yTr);
            }
            
        } catch (e) {
            console.error('Failed to load weather stats', e);
            weatherStatsTbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; color: var(--danger-color);">통계 데이터를 불러오지 못했습니다.</td></tr>';
        }
    }
    
    if (btnOpenWeatherModal) {
        btnOpenWeatherModal.addEventListener('click', () => {
            weatherStatsModal.style.display = 'flex';
            loadWeatherStats();
        });
    }
    
    if (btnCloseWeatherModal) {
        btnCloseWeatherModal.addEventListener('click', () => {
            weatherStatsModal.style.display = 'none';
        });
    }
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === weatherStatsModal) {
            weatherStatsModal.style.display = 'none';
        }
    });
});
