// Cấu hình thông tin Google API của bạn
const SPREADSHEET_ID = '1Xtwk_Y7UGKNw2YC9c4kblae71mHahzr7GqV-sfiie6E';
const API_KEY = 'AIzaSyCxjb8VD1tbqok8ro1bO-KUjPGoNTerqi8';

// Hệ thống lưu trữ data sau khi tải xong để các hàm khác sử dụng
let globalData = {
    gantt: [],
    swot: [],
    hcPlan: [],
    hcActual: [],
    marketList: []
};

// Hàm bổ trợ: Biến đổi dữ liệu thô từ Google Sheets thành dạng Object JSON sạch dựa theo tiêu đề cột
function convertRawToObjects(rawValues) {
    if (!rawValues || rawValues.length === 0) return [];
    const headers = rawValues[0]; // Dòng đầu tiên làm Key
    return rawValues.slice(1).map(row => {
        let obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] || ''; // Nếu ô trống thì để chuỗi rỗng
        });
        return obj;
    });
}

// Hàm fetch data từ một Tab cụ thể
async function fetchSheetTab(tabName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(tabName)}?key=${API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Lỗi tải tab: ${tabName}`);
    const data = await response.json();
    return data.values;
}

// Hàm khởi chạy chính (Quản lý thanh loading game toàn trang)
async function initDashboard() {
    const progressBar = document.getElementById('main-progress-bar');
    const statusText = document.getElementById('loading-status');
    const loadScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('dashboard-content');

    try {
        // 1. Tải Gantt
        statusText.innerText = 'Đang tải tiến độ Gantt Chart...';
        progressBar.style.width = '20%';
        const rawGantt = await fetchSheetTab('Gantt'); 
        globalData.gantt = convertRawToObjects(rawGantt);

        // 2. Tải SWOT
        statusText.innerText = 'Đang tải phân tích SWOT...';
        progressBar.style.width = '40%';
        const rawSwot = await fetchSheetTab('Swot'); 
        globalData.swot = convertRawToObjects(rawSwot);

        // 3. Tải Headcount Plan & Actual
        statusText.innerText = 'Đang đồng bộ dữ liệu nhân sự (Headcount)...';
        progressBar.style.width = '60%';
        const rawHcPlan = await fetchSheetTab('Headcount plan');
        const rawHcActual = await fetchSheetTab('Headcount actual');
        globalData.hcPlan = convertRawToObjects(rawHcPlan);
        globalData.hcActual = convertRawToObjects(rawHcActual);

        // 4. Tải Market List
        statusText.innerText = 'Đang cập nhật danh sách chợ (Market List)...';
        progressBar.style.width = '80%';
        const rawMarket = await fetchSheetTab('Market');
        globalData.marketList = convertRawToObjects(rawMarket);

        // Hoàn thành
        statusText.innerText = 'Đồng bộ hoàn tất! Đang dựng giao diện...';
        progressBar.style.width = '100%';
        
        // Vẽ các bảng biểu lên UI
        renderGanttChart();
        renderSWOT();

        // Ẩn màn hình loading, hiện Dashboard
        setTimeout(() => {
            if (loadScreen) loadScreen.style.opacity = '0';
            setTimeout(() => {
                if (loadScreen) loadScreen.style.display = 'none';
                if (mainContent) mainContent.style.display = 'block';
            }, 500);
        }, 600);

    } catch (error) {
        console.error(error);
        if (statusText) statusText.innerText = 'LỖI HỆ THỐNG: ' + error.message;
        if (progressBar) progressBar.style.backgroundColor = '#ff3366';
    }
}

// --- HÀM XỬ LÝ VẼ GANTT CHART ĐẶC BIỆT ---
function renderGanttChart() {
    const tbody = document.getElementById('gantt-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Danh sách các cột tuần cố định trên giao diện HTML
    const weeksTimeline = ['W3-May', 'W4-May', 'W1-Jun', 'W2-Jun', 'W3-Jun', 'W4-Jun'];

    globalData.gantt.forEach((task, index) => {
        let tr = document.createElement('tr');
        
        // Điền thông tin cơ bản cột Số thứ tự, Tên Task, PIC
        // Lưu ý: Các chữ task.Task, task.PIC... phải viết hoa chữ cái đầu đúng như tiêu đề cột trên Sheets của bạn
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="text-align:left;">${task.Task || ''}</td>
            <td>${task.PIC || ''}</td>
        `;

        let startIdx = weeksTimeline.indexOf(task.Start);
        let endIdx = weeksTimeline.indexOf(task.End);

        if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
            let colSpanValue = endIdx - startIdx + 1;

            // Tạo các ô trống TRƯỚC thanh loading
            for (let i = 0; i < startIdx; i++) {
                tr.innerHTML += `<td></td>`;
            }

            // Tạo ô chứa thanh Loading dựa vào Status
            let statusClass = 'bar-ongoing'; 
            if (task.Status === 'done') statusClass = 'bar-done';
            if (task.Status === 'delay') statusClass = 'bar-delay';

            tr.innerHTML += `
                <td colspan="${colSpanValue}" style="padding: 6px; vertical-align: middle;">
                    <div class="gantt-bar-wrapper">
                        <div class="gantt-loading-bar ${statusClass}" style="width: ${task.Progress || '0%'}">
                            <span class="bar-text-percent">${task.Progress || ''}</span>
                        </div>
                    </div>
                </td>
            `;

            // Tạo các ô trống SAU thanh loading
            for (let i = endIdx + 1; i < weeksTimeline.length; i++) {
                tr.innerHTML += `<td></td>`;
            }
        } else {
            weeksTimeline.forEach(() => { tr.innerHTML += `<td></td>`; });
        }

        tbody.appendChild(tr);
    });
}

// --- HÀM XỬ LÝ VẼ SWOT GRID ---
function renderSWOT() {
    const types = { 'S': 'swot-s', 'W': 'swot-w', 'O': 'swot-o', 'T': 'swot-t' };
    
    // Xóa dữ liệu cũ trong các thẻ ul nếu có trên giao diện
    Object.values(types).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    const supportList = document.getElementById('swot-support-list');
    if (supportList) supportList.innerHTML = '';

    // Đọc và phân bổ dữ liệu SWOT dựa vào cột Type và Content trên Sheets
    globalData.swot.forEach(item => {
        let li = document.createElement('li');
        li.innerText = item.Content || '';

        if (types[item.Type]) {
            const container = document.getElementById(types[item.Type]);
            if (container) container.appendChild(li);
        } else if (item.Type === 'Support' && supportList) {
            supportList.appendChild(li);
        }
    });
}

// Tự động kích hoạt khi trang web tải xong
window.addEventListener('DOMContentLoaded', initDashboard);
