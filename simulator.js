const mqtt = require('mqtt');

// Connect to the Mosquitto MQTT broker
const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost';
const client = mqtt.connect(brokerUrl);

// Track device state for simulated users
const userDevices = {};

// To initialize a user's device state
function initUserDevices(username) {
    if (!userDevices[username]) {
        userDevices[username] = {
            system: false, // The main system relay
        };
    }
}

client.on('connect', () => {
    console.log("🟢 Simulator connected to MQTT Broker");

    // Subscribe to control commands for any user's devices
    client.subscribe('home/+/control/#', (err) => {
        if (!err) {
            console.log("👂 Listening for commands on topic 'home/+/control/#'");
        }
    });

    // Start publishing random sensor data every 2 seconds
    setInterval(publishData, 2000);
});

// Handle incoming control messages
client.on('message', (topic, message) => {
    const parts = topic.split('/');
    if (parts.length >= 3 && parts[0] === 'home' && parts[2] === 'control') {
        const username = parts[1];
        initUserDevices(username);

        const command = message.toString();
        let targetDevice = "system";
        if (parts.length === 4) {
            targetDevice = parts[3];
        }

        console.log(`\n🔔 Command Received for [${username}] -> ${targetDevice}: ${command}`);
        if (command === 'ON') {
            userDevices[username][targetDevice] = true;
            console.log(`⚙️  Device '${targetDevice}' for [${username}] is now turned ON`);
        } else if (command === 'OFF') {
            userDevices[username][targetDevice] = false;
            console.log(`⚙️  Device '${targetDevice}' for [${username}] is now turned OFF`);
        }
    }
});

function publishData() {
    // Publish data for all simulated users
    for (const username in userDevices) {
        let isAnyDeviceOn = false;
        
        // Generate and publish device specific data (power usage)
        for (const [device, isOn] of Object.entries(userDevices[username])) {
            if (isOn && device !== 'system') {
                isAnyDeviceOn = true;
                
                // Base power usage based on device type
                let basePower = 50;
                if (device.includes('ac')) basePower = 1500;
                else if (device.includes('microwave')) basePower = 1200;
                else if (device.includes('refrigerator')) basePower = 400;
                else if (device.includes('tv')) basePower = 150;
                else if (device.includes('fan')) basePower = 70;
                else if (device.includes('lights')) basePower = 20;

                // Add some fluctuation
                const power = (basePower + (Math.random() * 10 - 5)).toFixed(1);
                
                // Also give the device realistic individual temp/gas fluctuations
                // For instance, an AC might emit cold local air, Microwave emits hot air.
                let tempFluctuation = 0;
                let gasFluctuation = 0;
                if (device.includes('ac')) tempFluctuation = -5;
                if (device.includes('microwave')) tempFluctuation = 10;
                if (device.includes('refrigerator')) tempFluctuation = -2;

                const deviceTemp = (Math.random() * 5 + 22 + tempFluctuation).toFixed(1);
                const deviceGas = Math.floor(Math.random() * 50) + 120 + gasFluctuation;

                // Send JSON payload
                const payloadObj = {
                    power: parseFloat(power),
                    temp: parseFloat(deviceTemp),
                    gas: deviceGas
                };
                
                const devicePayload = JSON.stringify(payloadObj);
                client.publish(`home/${username}/device_data/${device}`, devicePayload);
                console.log(`⚡ Published Data [${username}][${device}]: ${devicePayload}`);
            } else if (isOn && device === 'system') {
                isAnyDeviceOn = true;
            }
        }

        // Only publish temp/gas data if the main system or any device is turned ON
        if (!isAnyDeviceOn) continue;

        // Generate random temperature between 20.0 and 60.0
        const temp = (Math.random() * 40 + 20).toFixed(1);

        // Generate random gas level between 100 and 400
        const gas = Math.floor(Math.random() * 300) + 100;

        const payload = `${temp},${gas}`;

        // Publish to the user's sensor data topic
        client.publish(`home/${username}/data`, payload);
        console.log(`📤 Published Data [${username}]: ${payload}`);
    }
}
