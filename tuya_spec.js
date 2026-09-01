require('dotenv').config();
const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

const tuya = new TuyaContext({
  baseUrl: 'https://openapi.tuyaus.com',
  accessKey: process.env.TUYA_ACCESS_ID,
  secretKey: process.env.TUYA_ACCESS_KEY,
});

async function getSpec() {
  const deviceId = process.env.TUYA_WEATHER_STATION_ID;
  try {
    const res = await tuya.request({
      method: 'GET',
      path: `/v1.0/iot-03/devices/${deviceId}/specification`
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
}

getSpec();
