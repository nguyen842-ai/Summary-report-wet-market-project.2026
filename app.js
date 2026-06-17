// ==========================================
// CẤU HÌNH KẾT NỐI GOOGLE SHEETS
// ==========================================
const SPREADSHEET_ID = '1Xtwk_Y7UGKNw2YC9c4kblae71mHahzr7GqV-sfiie6E';
const API_KEY = 'DÁN_API_KEY_CỦA_BẠN_VÀO_ĐÂY'; // <-- Sửa lại dòng này

let globalData = {
    gantt: [],
    swot: []
};

// ==========================================
// 1. HÀM TẢI VÀ XỬ LÝ DỮ LIỆU
// ==========================================

// Hàm chuyển đổi mảng 2 chiều từ Sheets thành mảng Object dễ đọc
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

// Hàm Fetch API để lấy dữ liệu từ 1 Tab cụ thể
async function fetchSheetTab(tabName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(tabName)}?key=${API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Lỗi tải tab: ${tabName}`);
    const data = await response.json();
    return data.values;
}

// Hàm khởi chạy hệ thống (Chạy đầu tiên khi load web)
async function initDashboard() {
    const progressBar = document.getElementById('main-progress-bar');
    const loadScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('dashboard-content');
    const statusText = document.getElementById('loading-status');

    try {
        if (statusText) statusText.innerText = "Đang tải dữ liệu Tiến độ (Gantt)...";
        if (progressBar) progressBar.style.width = '40%';
        const rawGantt = await fetchSheetTab('Gantt'); 
        globalData.gantt = convertRawToObjects(rawGantt);

        if (statusText) statusText.innerText = "Đang tải dữ liệu Phân tích (SWOT)...";
        if (progressBar) progressBar.style.width = '80%';
        const rawSwot = await fetchSheetTab('Swot'); 
        globalData.swot = convertRawToObjects(rawSwot);

        if (progressBar) progressBar.style.width = '100%';
        if (statusText) statusText.innerText = "Hoàn tất! Đang kết xuất báo cáo...";
        
        setupFilters();
        renderDashboard();

        // Hiệu ứng mờ dần màn hình loading
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

// ==========================================
// 2. HÀM LỌC DỮ LIỆU
// ==========================================

function setupFilters() {
    const areaFilter = document.getElementById('filter-area');
    const monthFilter = document.getElementById('filter-month');
    if (!areaFilter || !monthFilter) return;

    // Lấy danh sách Khu vực độc nhất từ dữ liệu Gantt
    const areas = [...new Set(globalData.gantt.map(item => item['ar'] || item['Area'] || item['Khu vực']).filter(x => x))];
    
    areaFilter.innerHTML = '<option value="All">Tất cả khu vực</option>';
    areas.forEach(area => {
        areaFilter.innerHTML += `<option value="${area}">${area}</option>`;
    });

    // Lắng nghe sự kiện khi người dùng đổi filter
    areaFilter.addEventListener('change', renderDashboard);
    monthFilter.addEventListener('change', renderDashboard);
}

function filterData(dataArray) {
    if (!dataArray || !Array.isArray(dataArray)) return [];
    
    const areaFilterEl = document.getElementById('filter-area');
    const monthFilterEl = document.getElementById('filter-month');
    
    const selectedArea = areaFilterEl ? areaFilterEl.value : 'All';
    const selectedMonth = monthFilterEl ? monthFilterEl.value : 'All';

    return dataArray.filter(item => {
        const areaVal = item['ar'] || item['Area'] || item['Khu vực'] || '';
        const matchArea = (selectedArea === 'All') || (areaVal === selectedArea);
        
        let matchMonth = true;
        if (selectedMonth !== 'All') {
            const endDate = item['End'] || item['End date'] || item['Deadline'] || '';
            // Kiểm tra xem chuỗi ngày có chứa tháng đang lọc không (vd: /05/ hoặc -05-)
            matchMonth = endDate.includes(`/${selectedMonth}/`) || endDate.includes(`-${selectedMonth}-`);
        }
        return matchArea && matchMonth;
    });
}

// ==========================================
// 3. XỬ LÝ NGÀY THÁNG VÀ VẼ BẢNG
// ==========================================

// Hàm đọc ngày chuẩn xác từ định dạng dd/mm/yyyy
function parseDateString(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.toString().split(/[/-]/); 
    if (parts.length === 3) {
        let day = parseInt(parts[0]);
        let month = parseInt(parts[1]) - 1; // JS đếm tháng từ 0
        let year = parseInt(parts[2]);
        // Cố định năm nếu chỉ gõ 2 chữ số (VD: 24 -> 2024)
        if (year < 100) year += 2000;
        return new Date(year, month, day);
    }
    return null;
}

// Render tổng hợp
function renderDashboard() {
    renderGanttChart();
    renderSWOT();
}

// Hàm vẽ biểu đồ Gantt kiểu Fluid Timeline (Mũi tên chạy tự do)
function renderGanttChart() {
    const tbody = document.getElementById('gantt-tbody');
    if (!tbody) return;
    tbody.innerHTML = ''; 

    let filteredGantt = filterData(globalData.gantt);

    if (filteredGantt.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="padding: 20px; text-align: center; color: #999;">Không có dữ liệu tiến độ phù hợp</td></tr>';
        return;
    }

    // A. TÌM KHUNG THỜI GIAN CỦA TOÀN BỘ DỰ ÁN (Min Date -> Max Date)
    let minProjectDate = null;
    let maxProjectDate = null;

    filteredGantt.forEach(task => {
        let s = parseDateString(task['Start']);
        let e = parseDateString(task['End'] || task['End date'] || task['Deadline']);
        if (s && (!minProjectDate || s < minProjectDate)) minProjectDate = s;
        if (e && (!maxProjectDate || e > maxProjectDate)) maxProjectDate = e;
    });

    // Mở rộng viền timeline thêm 3 ngày trước và 3 ngày sau cho thoáng mắt
    if (minProjectDate && maxProjectDate) {
        minProjectDate.setDate(minProjectDate.getDate() - 3);
        maxProjectDate.setDate(maxProjectDate.getDate() + 3);
    } else {
        // Dự phòng nếu toàn bộ project không có cột ngày hợp lệ
        minProjectDate = new Date();
        maxProjectDate = new Date(); maxProjectDate.setDate(maxProjectDate.getDate() + 30);
    }

    const totalProjectMs = maxProjectDate.getTime() - minProjectDate.getTime();

    // B. VẼ TỪNG THANH TASK VÀO BẢNG
    filteredGantt.forEach((task, index) => {
        let tr = document.createElement('tr');
        
        let taskName = task['Task'] || task['Tên công việc'] || '';
        let picName = task['PIC'] || task['Phụ trách'] || '';
        let startStr = task['Start'] || '';
        let endStr = task['End'] || task['End date'] || task['Deadline'] || '';
        let progressVal = task['Progress'] || task['Hoàn thành'] || '0%';
        
        let rawStatus = (task['Status'] || task['Remark'] || '').toString().toLowerCase();
        let statusClass = 'status-ongoing';
        if (rawStatus.includes('done') || progressVal === '100%') statusClass = 'status-done';
        if (rawStatus.includes('delay')) statusClass = 'status-delay';

        let htmlContent = `
            <td>${index + 1}</td>
            <td class="col-task">${taskName}</td>
            <td>${picName}</td>
            <td><strong>${endStr}</strong></td>
        `;

        // Tính toán phần trăm (Vị trí đặt mũi tên và Chiều dài mũi tên)
        let startDateObj = parseDateString(startStr);
        let endDateObj = parseDateString(endStr);
        let leftPercent = 0;
        let widthPercent = 100;

        if (startDateObj && endDateObj) {
            if (endDateObj < startDateObj) endDateObj = startDateObj; // Fix lỗi nếu gõ sai ngày kết thúc < ngày bắt đầu
            
            leftPercent = ((startDateObj.getTime() - minProjectDate.getTime()) / totalProjectMs) * 100;
            widthPercent = ((endDateObj.getTime() - startDateObj.getTime()) / totalProjectMs) * 100;
            
        } else if (endDateObj) {
            // Milestone: Nếu task chỉ có End Date (không có ngày bắt đầu)
            leftPercent = ((endDateObj.getTime() - minProjectDate.getTime()) / totalProjectMs) * 100;
            widthPercent = 4; // Vẽ 1 mũi tên ngắn tượng trưng
        }

        // Chống tràn mũi tên ra ngoài màn hình và đảm bảo độ dài tối thiểu để không bị méo hình
        if (leftPercent < 0) leftPercent = 0;
        if (widthPercent < 4) widthPercent = 4; 
        if (leftPercent + widthPercent > 100) widthPercent = 100 - leftPercent;

        // Ô Timeline: Gộp 6 cột thành 1 ô khổng lồ, thả nổi mũi tên bằng CSS Absolute
        htmlContent += `
            <td colspan="6" class="timeline-cell">
                <div class="task-arrow-wrapper" style="left: ${leftPercent}%; width: ${widthPercent}%;" title="Start: ${startStr} | End: ${endStr} | Kéo dài: ${Math.round((widthPercent/100)*totalProjectMs/(1000*60*60*24))} ngày">
                    <div class="task-arrow-fill ${statusClass}" style="width: ${progressVal};">
                        <span class="progress-text">${progressVal}</span>
                    </div>
                </div>
            </td>
        `;

        tr.innerHTML = htmlContent;
        tbody.appendChild(tr);
    });
}

// Hàm vẽ SWOT
function renderSWOT() {
    const filteredSwot = filterData(globalData.swot);
    
    ['swot-s', 'swot-w', 'swot-o', 'swot-t'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    filteredSwot.forEach(item => {
        if (item.STRENGTHS) document.getElementById('swot-s').innerHTML += `<li>${item.STRENGTHS}</li>`;
        if (item.WEAKNESSES) document.getElementById('swot-w').innerHTML += `<li>${item.WEAKNESSES}</li>`;
        if (item.OPPORTUNITIES) document.getElementById('swot-o').innerHTML += `<li>${item.OPPORTUNITIES}</li>`;
        if (item.THREATS) document.getElementById('swot-t').innerHTML += `<li>${item.THREATS}</li>`;
    });
}

// Kích hoạt khi trang đã sẵn sàng
window.addEventListener('DOMContentLoaded', initDashboard);
