require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('G:\\내 드라이브\\귤\\스마트팜\\대시보드'));

// 1. Tuya API Configuration
const tuya = new TuyaContext({
  baseUrl: 'https://openapi.tuyaus.com', // Change depending on region (e.g. tuyaeu.com, tuyacn.com)
  accessKey: process.env.TUYA_ACCESS_ID,
  secretKey: process.env.TUYA_ACCESS_KEY,
});

// 2. Local Database for Farming Logs & Rainfall
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.json');
let db = { logs: [], dailyRainfall: {}, weatherStats: {} };

// Load DB
if (fs.existsSync(dbPath)) {
    try {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        console.error('Failed to parse database.json', e);
    }
}

// Save DB helper
function saveDb() {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// 3. API Endpoints

// Health Check (Wi-Fi Status)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Farming Logs & Cumulative Rainfall & Annual Stats
app.get('/api/logs', (req, res) => {
    const sortedLogs = [...db.logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Find last pesticide date
    const lastPesticide = sortedLogs.find(log => log.type === 'pesticide');
    let cumulativeRain = 0;
    
    if (lastPesticide) {
        // Calculate rain since that date
        const pesticideDate = new Date(lastPesticide.date);
        for (const [dateStr, rainAmt] of Object.entries(db.dailyRainfall)) {
            if (new Date(dateStr) >= pesticideDate) {
                cumulativeRain += rainAmt;
            }
        }
    }

    // Calculate Annual Stats (Current Year)
    const currentYear = new Date().getFullYear().toString();
    let totalHarvestKg = 0;
    let totalSalesWon = 0;

    db.logs.forEach(log => {
        if (log.date && log.date.startsWith(currentYear)) {
            if (log.type === 'harvest' && log.amount) {
                const amt = Number(log.amount);
                if (log.unit === '관') {
                    totalHarvestKg += (amt * 3.75);
                } else {
                    totalHarvestKg += amt;
                }
            } else if (log.type === 'sales' && log.revenue) {
                totalSalesWon += Number(log.revenue);
            }
        }
    });
    
    res.json({
        logs: sortedLogs.slice(0, 15), // Return last 15 logs
        pesticideInfo: lastPesticide ? { date: lastPesticide.date, cumulativeRain: cumulativeRain.toFixed(1) } : null,
        annualStats: {
            totalHarvest: Math.round(totalHarvestKg),
            totalSales: totalSalesWon
        }
    });
});

app.post('/api/logs', (req, res) => {
    const { type, content, amount, unit, revenue, date } = req.body;
    const logDate = date || new Date().toISOString().split('T')[0];
    
    db.logs.push({
        id: Date.now().toString(),
        type,
        content,
        amount: amount || 0,
        unit: unit || 'kg',
        revenue: revenue || 0,
        date: logDate
    });
    
    saveDb();
    res.json({ success: true });
});

// Rainfall data (Mocking logic for Tuya integration or manual update)
app.get('/api/rainfall', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const todayRain = db.dailyRainfall[today] || 0.0;
    
    // Weekly rain
    let weeklyRain = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        weeklyRain += (db.dailyRainfall[dateStr] || 0);
    }
    
    res.json({
        today: todayRain.toFixed(1),
        weekly: weeklyRain.toFixed(1)
    });
});

// Get Weather Data (Tuya 기상대 상태 조회)
app.get('/api/weather', async (req, res) => {
    try {
        if (!process.env.TUYA_WEATHER_STATION_ID) return res.json({ error: 'No device ID' });
        
        const deviceId = process.env.TUYA_WEATHER_STATION_ID;
        
        const [infoResponse, statusResponse] = await Promise.all([
            tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}` }),
            tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}/status` })
        ]);
        
        // Log Statistics locally
        if (!db.weatherStats) db.weatherStats = {};
        const today = new Date(new Date().getTime() + 9 * 3600 * 1000).toISOString().split('T')[0]; // KST
        
        let currentTemp = null;
        let currentRain24h = null;
        
        statusResponse.result.forEach(item => {
            if (item.code === 'temp_current_external' || item.code === 'temp_current') currentTemp = item.value / 10;
            if (item.code === 'rain_24h') currentRain24h = item.value / 10;
        });

        if (currentTemp !== null) {
            if (!db.weatherStats[today]) {
                db.weatherStats[today] = { minTemp: currentTemp, maxTemp: currentTemp, rain24h: currentRain24h || 0 };
            } else {
                db.weatherStats[today].minTemp = Math.min(db.weatherStats[today].minTemp, currentTemp);
                db.weatherStats[today].maxTemp = Math.max(db.weatherStats[today].maxTemp, currentTemp);
                db.weatherStats[today].rain24h = Math.max(db.weatherStats[today].rain24h || 0, currentRain24h || 0);
            }
            saveDb();
        }
        
        res.json({
            name: infoResponse.result.name,
            status: statusResponse.result
        });
    } catch (error) {
        console.error('Error fetching weather data:', error.message);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

// Get Weather Stats (자체 통계 데이터)
app.get('/api/weather/stats', (req, res) => {
    res.json(db.weatherStats || {});
});

// Get Switch Status (Tuya 스위치 상태 조회)
app.get('/api/switch/:id', async (req, res) => {
    try {
        const deviceId = req.params.id;
        
        const [infoResponse, statusResponse] = await Promise.all([
            tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}` }),
            tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}/status` })
        ]);
        
        res.json({
            name: infoResponse.result.name,
            status: statusResponse.result
        });
    } catch (error) {
        console.error('Error fetching switch data:', error.message);
        res.status(500).json({ error: 'Failed to fetch switch data' });
    }
});

// Control Switch (Tuya 스위치 ON/OFF 제어)
app.post('/api/switch/:id', async (req, res) => {
    try {
        const deviceId = req.params.id;
        const { state, channel } = req.body; // true = ON, false = OFF, channel = 'switch_1', etc.
        const commandCode = channel || 'switch_1';
        
        const response = await tuya.request({
            method: 'POST',
            path: `/v1.0/iot-03/devices/${deviceId}/commands`,
            body: {
                commands: [
                    {
                        code: commandCode,
                        value: state
                    }
                ]
            }
        });
        
        res.json({ success: true, result: response.result });
    } catch (error) {
        console.error('Error controlling switch:', error);
        res.status(500).json({ error: 'Failed to control switch' });
    }
});

app.listen(port, () => {
    console.log(`Smart Farm Backend Server running on http://localhost:${port}`);
    console.log(`(Tuya API 연동 활성화)`);
});
