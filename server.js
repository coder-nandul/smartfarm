require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 프론트엔드 정적 파일 서빙 (Render 웹 서비스 대응)
app.use(express.static(__dirname));

// 1. Tuya API Configuration
const tuya = new TuyaContext({
  baseUrl: 'https://openapi.tuyaus.com',
  accessKey: process.env.TUYA_ACCESS_ID,
  secretKey: process.env.TUYA_ACCESS_KEY,
});

// Embedded Fallback Data for 100% Reliability
const embeddedData = {
  "logs": [
    {
      "id": "1786962656917",
      "type": "pesticide",
      "content": "123",
      "amount": 0,
      "unit": "kg",
      "revenue": 0,
      "date": "2026-08-17",
      "farmId": "seohong"
    }
  ],
  "dailyRainfall": {},
  "weatherStats": {
    "2026-08-17": { "minTemp": 25.7, "maxTemp": 26.2, "rain24h": 65.9 },
    "2026-08-18": { "minTemp": 26.2, "maxTemp": 29.6, "rain24h": 56.2 },
    "2026-08-19": { "minTemp": 24.7, "maxTemp": 24.7, "rain24h": 4 },
    "2026-08-20": { "minTemp": 26.5, "maxTemp": 32, "rain24h": 0 },
    "2026-08-21": { "minTemp": 27.7, "maxTemp": 28.7, "rain24h": 0 },
    "2026-08-22": { "minTemp": 28.6, "maxTemp": 28.6, "rain24h": 3.4 },
    "2026-08-23": { "minTemp": 26.5, "maxTemp": 26.9, "rain24h": 3.2 },
    "2026-08-25": { "minTemp": 28.7, "maxTemp": 28.7, "rain24h": 0 },
    "2026-08-26": { "minTemp": 32.5, "maxTemp": 32.5, "rain24h": 0 }
  }
};

// 2. MongoDB Connection (클라우드 DB 마이그레이션)
const MONGODB_URI = process.env.MONGODB_URI || '';

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
        .then(async () => {
            console.log('✅ MongoDB 연결 성공!');
            
            // Auto-Migration
            try {
                const count = await Log.countDocuments();
                if (count === 0) {
                    const localData = embeddedData;
                    if (localData.logs && localData.logs.length > 0) {
                        await Log.insertMany(localData.logs.map(l => ({
                            type: l.type, content: l.content, amount: l.amount,
                            unit: l.unit, revenue: l.revenue, date: l.date,
                            farmId: l.farmId || 'seohong'
                        })));
                        console.log('✅ database.json 기존 농사일지 데이터 마이그레이션 완료!');
                    }
                    if (localData.weatherStats) {
                        const weatherEntries = Object.entries(localData.weatherStats).map(([date, stat]) => ({
                            date,
                            minTemp: stat.minTemp,
                            maxTemp: stat.maxTemp,
                            rain24h: stat.rain24h
                        }));
                        if (weatherEntries.length > 0) {
                            await WeatherStat.insertMany(weatherEntries);
                            console.log('✅ database.json 기존 기상 데이터 마이그레이션 완료!');
                        }
                    }
                }
            } catch (err) {
                console.error('❌ 데이터 마이그레이션 중 오류 발생:', err);
            }
        })
        .catch(err => console.error('❌ MongoDB 연결 실패:', err));
}

// 2.1 Mongoose Schemas & Models
const LogSchema = new mongoose.Schema({
    type: String,
    content: String,
    amount: { type: Number, default: 0 },
    unit: { type: String, default: 'kg' },
    revenue: { type: Number, default: 0 },
    date: String, // YYYY-MM-DD
    weather: {
        maxTemp: Number,
        minTemp: Number,
        rain24h: Number,
        condition: String
    },
    rainOffset: { type: Number, default: 0 },
    farmId: { type: String, default: 'seohong' }
});
const Log = mongoose.model('Log', LogSchema);

const RainfallSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    amount: { type: Number, default: 0 }
});
const DailyRainfall = mongoose.model('DailyRainfall', RainfallSchema);

const WeatherStatSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    minTemp: Number,
    maxTemp: Number,
    rain24h: { type: Number, default: 0 },
    condition: { type: String, default: '맑음' }
});
const WeatherStat = mongoose.model('WeatherStat', WeatherStatSchema);


// --- In-Memory Caching & Background Polling for Tuya API ---
const weatherCache = { data: null, lastFetch: 0 };
const switchCache = {}; // { [id]: { data: any, lastFetch: number } }

async function pollWeather() {
    if (!process.env.TUYA_WEATHER_STATION_ID) return;
    try {
        const deviceId = process.env.TUYA_WEATHER_STATION_ID;
        const [infoResponse, statusResponse] = await Promise.all([
            tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}` }),
            tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}/status` })
        ]);
        
        weatherCache.data = {
            name: infoResponse.result.name,
            status: statusResponse.result
        };
        weatherCache.lastFetch = Date.now();
        
        // Log Statistics to MongoDB
        if (MONGODB_URI) {
            const today = new Date(new Date().getTime() + 9 * 3600 * 1000).toISOString().split('T')[0]; // KST
            let currentTemp = null;
            let currentRain24h = null;
            let currentUv = null;
            
            statusResponse.result.forEach(item => {
                if (item.code === 'temp_current_external' || item.code === 'temp_current') currentTemp = item.value / 10;
                if (item.code === 'rain_24h') currentRain24h = item.value / 10;
                if (item.code === 'uv_index') currentUv = item.value;
            });

            if (currentTemp !== null) {
                let stat = await WeatherStat.findOne({ date: today });
                
                let inferredCondition = '맑음';
                if (currentRain24h > 0) inferredCondition = '비';
                else if (currentUv !== null && currentUv <= 2) inferredCondition = '흐림';
                
                if (!stat) {
                    stat = new WeatherStat({ 
                        date: today, minTemp: currentTemp, maxTemp: currentTemp, 
                        rain24h: currentRain24h || 0, condition: inferredCondition
                    });
                } else {
                    stat.minTemp = Math.min(stat.minTemp, currentTemp);
                    stat.maxTemp = Math.max(stat.maxTemp, currentTemp);
                    stat.rain24h = Math.max(stat.rain24h || 0, currentRain24h || 0);
                    if (currentRain24h > 0) stat.condition = '비';
                    else if (stat.condition !== '비') stat.condition = inferredCondition;
                }
                await stat.save();
            }
        }
    } catch (e) {
        console.error('Background weather poll error:', e.message);
    }
}

async function pollSwitches() {
    for (const deviceId of Object.keys(switchCache)) {
        try {
            const [infoResponse, statusResponse] = await Promise.all([
                tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}` }),
                tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}/status` })
            ]);
            switchCache[deviceId].data = {
                name: infoResponse.result.name,
                status: statusResponse.result
            };
            switchCache[deviceId].lastFetch = Date.now();
        } catch (e) {
            console.error(`Background switch poll error (${deviceId}):`, e.message);
        }
    }
}

// Start polling
setInterval(pollWeather, 30000); // 30s
setInterval(pollSwitches, 15000); // 15s
setTimeout(pollWeather, 2000); // Initial fetch


// 3. API Endpoints

// Health Check (Wi-Fi Status)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Farming Logs & Cumulative Rainfall & Annual Stats
app.get('/api/logs', async (req, res) => {
    try {
        const farmId = req.query.farmId || 'seohong';
        const currentYear = new Date().getFullYear().toString();
        
        const fs = require('fs');
        let logs = [];
        
        if (mongoose.connection.readyState !== 1) {
            // 몽고DB 연결 안됨: 로컬 database.json 폴백
            const localData = embeddedData;
            logs = (localData.logs || []).filter(l => (l.farmId || 'seohong') === farmId);
            logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            // Optimize: Fetch only current year logs for stats + last pesticide
            logs = await Log.find({ farmId }).sort({ date: -1 }).lean();
        }
        
        // Find last pesticide date or reset
        const lastPesticide = logs.find(log => log.type === 'pesticide' || log.type === 'pesticide_reset');
        let cumulativeRain = 0;
        
        if (lastPesticide) {
            const pesticideDateStr = lastPesticide.date;
            // 기상대에서 측정한 실제 비 데이터를 합산합니다.
            if (mongoose.connection.readyState !== 1) {
                const localData = embeddedData;
                if (localData.weatherStats) {
                    for (const [date, stat] of Object.entries(localData.weatherStats)) {
                        if (date >= pesticideDateStr) {
                            cumulativeRain += (stat.rain24h || 0);
                        }
                    }
                }
            } else {
                const rainfallRecords = await WeatherStat.find({ date: { $gte: pesticideDateStr } });
                cumulativeRain = rainfallRecords.reduce((acc, curr) => acc + (curr.rain24h || 0), 0);
            }
            
            if (lastPesticide.rainOffset) {
                cumulativeRain -= lastPesticide.rainOffset;
            }
            if (cumulativeRain < 0) cumulativeRain = 0;
        }

        // Calculate Annual Stats (Current Year)
        let totalHarvestKg = 0;
        let totalSalesWon = 0;

        logs.forEach(log => {
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
            logs: logs.slice(0, 15),
            pesticideInfo: lastPesticide ? { date: lastPesticide.date, cumulativeRain: cumulativeRain.toFixed(1) } : null,
            annualStats: {
                totalHarvest: Math.round(totalHarvestKg),
                totalSales: totalSalesWon
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB Fetch Error' });
    }
});

app.post('/api/logs', async (req, res) => {
    try {
        const { type, content, amount, unit, revenue, date, farmId } = req.body;
        const logDate = date || new Date().toISOString().split('T')[0];
        const logFarmId = farmId || 'seohong';
        
        // Fetch weather stat for the log date
        const weatherStat = await WeatherStat.findOne({ date: logDate });
        const weatherObj = weatherStat ? {
            maxTemp: weatherStat.maxTemp,
            minTemp: weatherStat.minTemp,
            rain24h: weatherStat.rain24h,
            condition: weatherStat.condition || (weatherStat.rain24h > 0 ? '비' : '맑음')
        } : null;
        
        const rainOffset = weatherStat ? (weatherStat.rain24h || 0) : 0;
        
        const newLog = new Log({
            type,
            content,
            amount: amount || 0,
            unit: unit || 'kg',
            revenue: revenue || 0,
            date: logDate,
            weather: weatherObj,
            rainOffset,
            farmId: logFarmId
        });
        
        await newLog.save();
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB Save Error' });
    }
});

app.put('/api/logs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, content, amount, unit, revenue, date } = req.body;
        
        const logDate = date || new Date().toISOString().split('T')[0];
        
        // Fetch weather stat for the updated date
        const weatherStat = await WeatherStat.findOne({ date: logDate });
        const weatherObj = weatherStat ? {
            maxTemp: weatherStat.maxTemp,
            minTemp: weatherStat.minTemp,
            rain24h: weatherStat.rain24h,
            condition: weatherStat.condition || (weatherStat.rain24h > 0 ? '비' : '맑음')
        } : null;
        
        await Log.findByIdAndUpdate(id, {
            type,
            content,
            amount: amount || 0,
            unit: unit || 'kg',
            revenue: revenue || 0,
            date: logDate,
            weather: weatherObj
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB Update Error' });
    }
});

app.delete('/api/logs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Log.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB Delete Error' });
    }
});

// Rainfall data (Mocking logic for Tuya integration or manual update)
app.get('/api/rainfall', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = await DailyRainfall.findOne({ date: today });
        const todayRain = todayRecord ? todayRecord.amount : 0.0;
        
        // Weekly rain
        const now = new Date();
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        
        const weeklyRecords = await DailyRainfall.find({ date: { $in: dates } });
        const weeklyRain = weeklyRecords.reduce((acc, curr) => acc + curr.amount, 0);
        
        res.json({
            today: todayRain.toFixed(1),
            weekly: weeklyRain.toFixed(1)
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB Fetch Error' });
    }
});

// Get Weather Data (Tuya 기상대 상태 조회)
app.get('/api/weather', async (req, res) => {
    try {
        if (!process.env.TUYA_WEATHER_STATION_ID) return res.json({ error: 'No device ID' });
        
        // 캐시 데이터가 있으면 바로 반환하여 속도 최적화
        if (weatherCache.data) {
            // 만약 캐시가 너무 오래되었다면 비동기로 폴링 업데이트만 지시
            if (Date.now() - weatherCache.lastFetch > 60000) {
                pollWeather().catch(console.error);
            }
            return res.json(weatherCache.data);
        }
        
        // 캐시가 완전히 비어있는 경우(서버 켜진 직후)에만 대기
        await pollWeather();
        
        if (weatherCache.data) {
            res.json(weatherCache.data);
        } else {
            res.status(500).json({ error: 'Failed to fetch weather data' });
        }
    } catch (error) {
        console.error('Error fetching weather data:', error.message);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

// Get Weather Stats (자체 통계 데이터)
app.get('/api/weather/stats', async (req, res) => {
    try {
        const stats = await WeatherStat.find().sort({ date: -1 });
        // 클라이언트에서 기존과 동일하게 객체 형태로 매핑하기 위함
        const statsObj = {};
        stats.forEach(stat => {
            statsObj[stat.date] = stat;
        });
        res.json(statsObj);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB Fetch Error' });
    }
});

// Get Switch Status (Tuya 스위치 상태 조회)
app.get('/api/switch/:id', async (req, res) => {
    try {
        const deviceId = req.params.id;
        
        if (!switchCache[deviceId]) {
            switchCache[deviceId] = { data: null, lastFetch: 0 };
        }
        
        // 캐시 데이터가 있으면 바로 응답하여 속도 최적화
        if (switchCache[deviceId].data) {
            if (Date.now() - switchCache[deviceId].lastFetch > 30000) {
                // 비동기로 데이터 업데이트 트리거
                pollSwitches().catch(console.error);
            }
            return res.json(switchCache[deviceId].data);
        }
        
        // 캐시가 비어있을 때만 직접 API 요청 후 대기
        const [infoResponse, statusResponse] = await Promise.all([
            tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}` }),
            tuya.request({ method: 'GET', path: `/v1.0/iot-03/devices/${deviceId}/status` })
        ]);
        
        const responseData = {
            name: infoResponse.result.name,
            status: statusResponse.result
        };
        
        switchCache[deviceId].data = responseData;
        switchCache[deviceId].lastFetch = Date.now();
        
        res.json(responseData);
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
        
        // 제어 성공 후 캐시 즉시 무효화 및 갱신
        if (switchCache[deviceId]) {
            switchCache[deviceId].lastFetch = 0;
            pollSwitches(); // 비동기로 최신 상태 가져오기 시작
        }
        
        res.json({ success: true, result: response.result });
    } catch (error) {
        console.error('Error controlling switch:', error);
        res.status(500).json({ error: 'Failed to control switch' });
    }
});

app.listen(port, () => {
    console.log(`Smart Farm Backend Server running on port ${port}`);
    console.log(`(Tuya API 연동 및 MongoDB 상태 대기 중)`);
});
