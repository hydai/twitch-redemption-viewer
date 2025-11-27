// Global state
let redemptionData = [];
let filterDailyOnly = true;

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
const filterToggle = document.getElementById('filterToggle');

// Event Listeners
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
csvBtn.addEventListener('click', exportCSV);
excelBtn.addEventListener('click', exportExcel);
filterToggle.addEventListener('change', (e) => {
    filterDailyOnly = e.target.checked;
    renderTable();
});

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

// Extract Redemption Events
function extractRedemptions(jsonData) {
    const redemptions = [];

    for (const entry of jsonData) {
        if (entry.message && entry.message.includes('REWARD REDEMPTION EVENT RECEIVED')) {
            const eventData = extractEventData(entry.message);
            if (eventData) {
                redemptions.push({
                    redeemedAt: formatDateTime(eventData.redeemed_at),
                    userId: eventData.user_id,
                    userLogin: eventData.user_login,
                    userName: eventData.user_name,
                    rewardTitle: eventData.reward?.title || ''
                });
            }
        }
    }

    // Sort by redemption time (oldest first)
    redemptions.sort((a, b) => a.redeemedAt.localeCompare(b.redeemedAt));

    return redemptions;
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

// Format ISO datetime to readable format
function formatDateTime(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
        return isoString;
    }
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

// Get filtered data
function getFilteredData() {
    if (filterDailyOnly) {
        return redemptionData.filter(item => item.rewardTitle === 'Dailyおみくじ');
    }
    return redemptionData;
}

// Render table with filtered data
function renderTable() {
    const filteredData = getFilteredData();

    resultCount.textContent = `${filteredData.length}件の引き換えが見つかりました`;

    // Clear existing rows
    while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
    }

    for (const item of filteredData) {
        const row = document.createElement('tr');

        const cellRedeemedAt = document.createElement('td');
        cellRedeemedAt.textContent = item.redeemedAt;
        row.appendChild(cellRedeemedAt);

        const cellUserId = document.createElement('td');
        cellUserId.textContent = item.userId;
        row.appendChild(cellUserId);

        const cellUserLogin = document.createElement('td');
        cellUserLogin.textContent = item.userLogin;
        row.appendChild(cellUserLogin);

        const cellUserName = document.createElement('td');
        cellUserName.textContent = item.userName;
        row.appendChild(cellUserName);

        const cellRewardTitle = document.createElement('td');
        cellRewardTitle.textContent = item.rewardTitle;
        row.appendChild(cellRewardTitle);

        tableBody.appendChild(row);
    }
}

// CSV Export
function exportCSV() {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return;

    const headers = ['引き換え時間', 'ユーザーID', '帳號名', '顯示名', '報酬名'];
    const rows = filteredData.map(item => [
        item.redeemedAt,
        item.userId,
        item.userLogin,
        item.userName,
        item.rewardTitle
    ]);

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
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return;

    const headers = ['引き換え時間', 'ユーザーID', '帳號名', '顯示名', '報酬名'];
    const data = filteredData.map(item => [
        item.redeemedAt,
        item.userId,
        item.userLogin,
        item.userName,
        item.rewardTitle
    ]);

    // Add headers as first row
    const worksheetData = [headers, ...data];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // 引き換え時間
        { wch: 15 }, // ユーザーID
        { wch: 20 }, // 帳號名
        { wch: 20 }, // 顯示名
        { wch: 25 }  // 報酬名
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
