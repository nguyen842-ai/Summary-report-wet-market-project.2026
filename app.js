const SPREADSHEET_ID = '1Xtwk_Y7UGKNw2YC9c4kblae71mHahzr7GqV-sfiie6E';
const API_KEY = 'AIzaSyC8oIfsPGtSedj73Qky4aasg98xqkrWT5s'; 

let globalData = {
    gantt: [],
    swot: []
};

// Hàm chuẩn hóa dữ liệu
function convertRawToObjects(rawValues) {
    if (!rawValues || rawValues.length === 0) return [];
    const headers = rawValues[0];
    return rawValues.slice(1).map(row => {
        let obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] || '';
        });
        return obj;
    });
}

// Fetch API
async function fetchSheetTab(tabName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(tabName)}?key=${API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Lỗi tải tab: ${tabName}`);
    const data = await response.json();
    return data.values;
}

// Khởi chạy hệ thống
async function initDashboard() {
    const progressBar = document.getElementById('main-progress-bar');
    const loadScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('dashboard-content');
    const statusText = document.getElementById('loading-status');

    try {
        statusText.innerText = "loading dữ liệu... (Đang tải tiến độ)";
        progressBar.style.width = '40%';
        const rawGantt = await fetchSheetTab('Gantt'); 
        globalData.gantt = convertRawToObjects(rawGantt);

        statusText.innerText = "loading dữ liệu... (Đang tải phân tích)";
        progressBar.style.width = '80%';
        const rawSwot = await fetchSheetTab('Swot'); 
        globalData.swot = convertRawToObjects(rawSwot);

        progressBar.style.width = '100%';
        statusText.innerText = "Hoàn tất! Đang kết xuất báo cáo...";
        
        // Thiết lập cấu hình bộ lọc từ dữ liệu
        setupFilters();

        // Render giao diện theo filter mặc định
        renderDashboard();

        // Xóa màn hình loading
        setTimeout(() => {
            if (loadScreen) loadScreen.style.opacity = '0';
            setTimeout(() => {
                if (loadScreen) loadScreen.style.display = 'none';
                if (mainContent) mainContent.style.display = 'block';
            }, 500);
        }, 800);

    } catch (error) {
        console.error(error);
        if (statusText) statusText.innerText = 'LỖI: ' + error.message;
        if (progressBar) progressBar.style.backgroundColor = '#f44336';
    }
}

// Chạy bộ lọc và tạo danh sách Dropdown
function setupFilters() {
    const areaFilter = document.getElementById('filter-area');
    const monthFilter = document.getElementById('filter-month');

    // Lấy các khu vực độc nhất từ dữ liệu Gantt (cột 'ar') [cite: 5]
    const areas = [...new Set(globalData.gantt.map(item => item.ar).filter(x => x))];
    
    // Đổ danh sách Khu vực vào ô chọn
    areaFilter.innerHTML = '<option value="All">Tất cả khu vực</option>';
    areas.forEach(area => {
        areaFilter.innerHTML += `<option value="${area}">${area}</option>`;
    });

    // Lắng nghe sự kiện click thay đổi
    areaFilter.addEventListener('change', renderDashboard);
    monthFilter.addEventListener('change', renderDashboard);
}

// Cơ chế Lọc dữ liệu thông minh
function filterData(dataArray) {
    const selectedArea = document.getElementById('filter-area').value;
    const selectedMonth = document.getElementById('filter-month').value;

    return dataArray.filter(item => {
        // Xét điều kiện Khu vực
        const matchArea = (selectedArea === 'All') || (item.ar === selectedArea);
        
        // Xét điều kiện Tháng dựa vào cột End Date dạng DD/MM/YYYY [cite: 5]
        let matchMonth = true;
        if (selectedMonth !== 'All') {
            const endDate = item['End date'] || item['End Date'] || '';
            if (endDate.includes(`/${selectedMonth}/`)) {
                matchMonth = true;
            } else {
                matchMonth = false;
            }
        }
        return matchArea && matchMonth;
    });
}

function renderDashboard() {
    renderGanttChart();
    renderSWOT();
}

// Đổ dữ liệu vào Gantt
function renderGanttChart() {
    const tbody = document.getElementById('gantt-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredGantt = filterData(globalData.gantt);

    if (filteredGantt.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="padding: 20px; color: #999;">Không có dữ liệu phù hợp với bộ lọc hiện tại</td></tr>';
        return;
    }

    filteredGantt.forEach((task, index) => {
        let tr = document.createElement('tr');
        
        let progressVal = task.Progress || '0%';
        let endDate = task['End date'] || task['End Date'] || '';
        let statusText = task.Remark ? task.Remark.toLowerCase() : '';
        
        let statusClass = 'status-ongoing';
        if (statusText.includes('done') || progressVal === '100%') statusClass = 'status-done';
        if (statusText.includes('delay')) statusClass = 'status-delay';

        // Vì không có cột Start Date trong dữ liệu nên chúng ta thả khối Bar tiến độ trải dài lịch tháng
        let htmlContent = `
            <td>${index + 1}</td>
            <td class="col-task">${task.Task || ''}</td>
            <td>${task.PIC || ''}</td>
            <td><strong>${endDate}</strong></td>
            <td colspan="6" style="padding: 8px;">
                <div class="bar-wrapper" title="Hoàn thành: ${progressVal}">
                    <div class="bar-fill ${statusClass}" style="width: ${progressVal};">${progressVal}</div>
                </div>
            </td>
        `;
        
        tr.innerHTML = htmlContent;
        tbody.appendChild(tr);
    });
}

// Đổ dữ liệu vào SWOT
function renderSWOT() {
    const filteredSwot = filterData(globalData.swot);
    
    // Clear dữ liệu cũ
    ['swot-s', 'swot-w', 'swot-o', 'swot-t'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    filteredSwot.forEach(item => {
        // Quét các cột STRENGTHS, WEAKNESSES, OPPORTUNITIES, THREATS từ dữ liệu Sheets [cite: 4]
        if (item.STRENGTHS) document.getElementById('swot-s').innerHTML += `<li>${item.STRENGTHS}</li>`;
        if (item.WEAKNESSES) document.getElementById('swot-w').innerHTML += `<li>${item.WEAKNESSES}</li>`;
        if (item.OPPORTUNITIES) document.getElementById('swot-o').innerHTML += `<li>${item.OPPORTUNITIES}</li>`;
        if (item.THREATS) document.getElementById('swot-t').innerHTML += `<li>${item.THREATS}</li>`;
    });
}

window.addEventListener('DOMContentLoaded', initDashboard);
