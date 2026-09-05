// ------------------------------
// Authentication Check
// ------------------------------
const token = localStorage.getItem('auth_token');
if (!token) {
    window.location.href = '/login.html';
}

function handleAuthError(res) {
    if (res.status === 401) {
        logout();
        throw new Error("Unauthorized");
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    window.location.href = '/login.html';
}

let historyChart = null;

async function initChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    data: [],
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Gas Level (ppm)',
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    data: [],
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', display: true, position: 'left' },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
}

async function fetchHistory() {
    try {
        const res = await fetch('/api/history', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        handleAuthError(res);
        const data = await res.json();
        if (historyChart && data.length > 0) {
            historyChart.data.labels = data.map(d => d.time);
            historyChart.data.datasets[0].data = data.map(d => d.temp);
            historyChart.data.datasets[1].data = data.map(d => d.gas);
            historyChart.update();
        }
    } catch (err) {
        console.log("Error fetching history");
    }
}

async function fetchData() {
    try {
        const res = await fetch('/api/data', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        handleAuthError(res);
        const data = await res.json();

        const statusEl = document.getElementById('status');
        const statusContainer = document.getElementById('status-container');
        const iconEl = document.getElementById('status-icon-internal');

        // Update values
        statusEl.innerText = data.status;

        // Change styles based on status
        if (data.status === "Hazard") {
            statusContainer.className = "status-badge hazard-status";
            iconEl.innerText = "⚠️";
            document.body.classList.add("hazard-mode");
        } else {
            statusContainer.className = "status-badge normal-status";
            iconEl.innerText = "✔️";
            document.body.classList.remove("hazard-mode");
        }

    } catch (err) {
        console.log("Error fetching data");
    }
}

// Refresh every 2 seconds
setInterval(() => {
    fetchData();
    fetchHistory();
    fetchDevices();
}, 2000);

// Initial fetch
initChart();
fetchData();
fetchHistory();
fetchDevices();

function control(state) {
    fetch(`/api/control/${state}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => {
            handleAuthError(res);
            return res.json();
        })
        .then(data => {
            console.log(data);
            showToast(`System turned ${state}`, state === 'ON' ? '⚡' : '🛑');
        })
        .catch(err => {
            console.error("Control error:", err);
            showToast("Failed to connect to backend", "❌");
        });
}

function controlDevice(device, state) {
    fetch(`/api/control/${device}/${state}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => {
            handleAuthError(res);
            return res.json();
        })
        .then(data => {
            console.log(data);
            const icon = device.includes('lights') ? '💡' : (device.includes('fan') ? '🌀' : (device.includes('ac') ? '❄️' : '🔌'));
            showToast(`${device.toUpperCase().replace('_', ' ')} turned ${state}`, state === 'ON' ? '⚡' : '🛑');
            fetchDevices(); // Immediatedly fetch to grab updated state
        })
        .catch(err => {
            console.error("Control error:", err);
            showToast("Failed to connect to backend", "❌");
        });
}

function fetchDevices() {
    fetch('/api/devices', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        handleAuthError(res);
        return res.json();
    })
    .then(devices => {
        // Evaluate every device component found on the UI
        const allOffButtons = document.querySelectorAll('[id$="-off"]');
        allOffButtons.forEach(btnOff => {
            if(!btnOff.id || !btnOff.id.startsWith('btn-') || !btnOff.id.endsWith('-off')) return;
            const device = btnOff.id.replace('btn-', '').replace('-off', '');
            const info = devices[device] || { state: 'OFF', data: null };

            const btnOn = document.getElementById(`btn-${device}-on`);
            const dataRow = document.getElementById(`data-${device}`);

            if(!btnOn) return;

            // Highlight buttons based on state
            if (info.state === 'ON') {
                btnOn.style.background = 'linear-gradient(135deg, #10b981, #059669)'; // Green
                btnOn.style.color = '#fff';
                btnOn.style.opacity = '1';
                btnOn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
                
                btnOff.style.background = 'transparent';
                btnOff.style.color = 'var(--text-main)';
                btnOff.style.opacity = '0.5';
                btnOff.style.boxShadow = 'none';

                if (dataRow) dataRow.style.display = 'flex';
            } else {
                btnOff.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'; // Red
                btnOff.style.color = '#fff';
                btnOff.style.opacity = '1';
                btnOff.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.3)';

                btnOn.style.background = 'transparent';
                btnOn.style.color = 'var(--text-main)';
                btnOn.style.opacity = '0.5';
                btnOn.style.boxShadow = 'none';

                // We can optionally hide or zero out the data row
                if (dataRow) dataRow.style.display = 'none';
            }

            // Fill Data if presented
            if (info.data) {
                const elPower = document.getElementById(`data-${device}-power`);
                const elTemp = document.getElementById(`data-${device}-temp`);
                const elGas = document.getElementById(`data-${device}-gas`);

                if(elPower) elPower.innerText = info.data.power;
                if(elTemp) elTemp.innerText = info.data.temp;
                if(elGas) elGas.innerText = info.data.gas;
            }
        });
    })
    .catch(err => {
        console.error("Error fetching devices:", err);
    });
}

function showToast(message, icon) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    // trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// ------------------------------
// Settings Logic
// ------------------------------
function openSettings() {
    fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        handleAuthError(res);
        return res.json();
    })
    .then(data => {
        document.getElementById('tempThreshold').value = data.temp_threshold || 50;
        document.getElementById('gasThreshold').value = data.gas_threshold || 300;
        document.getElementById('settingsModal').classList.add('show');
    })
    .catch(err => {
        console.error("Error fetching settings:", err);
        showToast("Error loading settings", "❌");
    });
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('show');
}

function saveSettings() {
    const tempThresh = parseFloat(document.getElementById('tempThreshold').value);
    const gasThresh = parseInt(document.getElementById('gasThreshold').value);

    fetch('/api/settings', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ temp_threshold: tempThresh, gas_threshold: gasThresh })
    })
    .then(res => {
        handleAuthError(res);
        return res.json();
    })
    .then(data => {
        if (data.success) {
            showToast("Settings saved successfully", "💾");
            closeSettings();
        } else {
            showToast("Failed to save settings", "❌");
        }
    })
    .catch(err => {
        console.error("Error saving settings:", err);
        showToast("Error saving settings", "❌");
    });
}

// ------------------------------
// Device History Logic
// ------------------------------
function openDeviceHistoryModal() {
    fetch('/api/device_history', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        handleAuthError(res);
        return res.json();
    })
    .then(data => {
        const tbody = document.querySelector('#deviceHistoryTable tbody');
        tbody.innerHTML = ''; // clear existing rows

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No telemetry data available yet.</td></tr>';
        } else {
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.timestamp}</td>
                    <td style="text-transform: capitalize;">${row.device.replace('_', ' ')}</td>
                    <td style="font-weight: 600;">${row.power_usage}</td>
                    <td>${row.temp}</td>
                    <td style="color: var(--text-muted);">${row.gas}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        document.getElementById('deviceHistoryModal').classList.add('show');
    })
    .catch(err => {
        console.error("Error fetching device history:", err);
        showToast("Error loading device history", "❌");
    });
}

function closeDeviceHistoryModal() {
    document.getElementById('deviceHistoryModal').classList.remove('show');
}