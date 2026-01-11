// Global state
let redemptionData = [];

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const resultSection = document.getElementById('resultSection');
const resultCount = document.getElementById('resultCount');
const tableBody = document.getElementById('tableBody');
const csvBtn = document.getElementById('csvBtn');
const excelBtn = document.getElementById('excelBtn');
const errorMessage = document.getElementById('errorMessage');
const loading = document.getElementById('loading');

// Event Listeners
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
csvBtn.addEventListener('click', exportCSV);
excelBtn.addEventListener('click', exportExcel);

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

// File Processing
function processFile(file) {
    if (!file.name.endsWith('.json')) {
        showError('JSONファイルを選択してください');
        return;
    }

    showLoading(true);
    hideError();

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonData = JSON.parse(e.target.result);
            redemptionData = extractRedemptions(jsonData);
            displayResults();
        } catch (err) {
            showError('ファイルの読み込みに失敗しました: ' + err.message);
        } finally {
            showLoading(false);
        }
    };
    reader.onerror = () => {
        showError('ファイルの読み込みに失敗しました');
        showLoading(false);
    };
    reader.readAsText(file);
}

// Extract Redemption Events (only Dailyおみくじ)
function extractRedemptions(jsonData) {
    const redemptions = [];

    // Pre-process: combine entries within 100ms of each other
    // This handles cases where TCPR splits a single event across multiple log entries
    // with slightly different timestamps (e.g., .231Z vs .232Z)
    const combinedEntries = [];
    let currentGroup = null;

    const getTimestampMs = (ts) => new Date(ts).getTime();
    const TIMESTAMP_TOLERANCE_MS = 100; // 100ms tolerance

    for (const entry of jsonData) {
        const entryTime = getTimestampMs(entry.timestamp);
        const groupTime = currentGroup ? getTimestampMs(currentGroup.timestamp) : 0;

        if (!currentGroup || (entryTime - groupTime) > TIMESTAMP_TOLERANCE_MS) {
            if (currentGroup) combinedEntries.push(currentGroup);
            currentGroup = { timestamp: entry.timestamp, message: entry.message || '' };
        } else {
            currentGroup.message += '\n' + (entry.message || '');
        }
    }
    if (currentGroup) combinedEntries.push(currentGroup);

    // Process combined entries
    for (const entry of combinedEntries) {
        if (entry.message && entry.message.includes('REWARD REDEMPTION EVENT RECEIVED')) {
            const eventData = extractEventData(entry.message);
            if (eventData) {
                const rewardTitle = eventData.reward?.title || '';
                // Only include Dailyおみくじ redemptions
                if (rewardTitle === 'Dailyおみくじ') {
                    redemptions.push({
                        redeemer: formatRedeemer(eventData.user_name, eventData.user_login)
                    });
                }
            }
        }
    }

    return redemptions;
}

// Format redeemer display name
function formatRedeemer(userName, userLogin) {
    if (userName.toLowerCase() === userLogin.toLowerCase()) {
        return userName;
    }
    return `${userName} (${userLogin})`;
}

// Extract JSON from message
function extractEventData(message) {
    // Find JSON object in message (starts with { and ends with })
    const jsonMatch = message.match(/\{[\s\S]*"broadcaster_user_id"[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse event JSON:', e);
        }
    }
    return null;
}

// Display Results
function displayResults() {
    if (redemptionData.length === 0) {
        showError('データがありません');
        resultSection.classList.add('hidden');
        return;
    }

    // Render table
    renderTable();

    resultSection.classList.remove('hidden');
}

// Render table
function renderTable() {
    resultCount.textContent = `${redemptionData.length}件の引き換えが見つかりました`;

    // Clear existing rows
    while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
    }

    for (const item of redemptionData) {
        const row = document.createElement('tr');

        const cellRedeemer = document.createElement('td');
        cellRedeemer.textContent = item.redeemer;
        row.appendChild(cellRedeemer);

        tableBody.appendChild(row);
    }
}

// CSV Export
function exportCSV() {
    if (redemptionData.length === 0) return;

    const headers = ['名前'];
    const rows = redemptionData.map(item => [item.redeemer]);

    let csvContent = '';

    // Add headers
    csvContent += headers.map(h => csvEscape(h)).join(',') + '\n';

    // Add data rows
    for (const row of rows) {
        csvContent += row.map(cell => csvEscape(cell)).join(',') + '\n';
    }

    // Add BOM for UTF-8 (Excel compatibility)
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'twitch_redemptions.csv');
}

// CSV Escape
function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Excel Export
function exportExcel() {
    if (redemptionData.length === 0) return;

    const headers = ['名前'];
    const data = redemptionData.map(item => [item.redeemer]);

    // Add headers as first row
    const worksheetData = [headers, ...data];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    ws['!cols'] = [
        { wch: 35 } // 名前
    ];

    XLSX.utils.book_append_sheet(wb, ws, '引き換え履歴');
    XLSX.writeFile(wb, 'twitch_redemptions.xlsx');
}

// Download Blob
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// UI Helpers
function showLoading(show) {
    loading.classList.toggle('hidden', !show);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
