// File: api/sheets.js
export default async function handler(req, res) {
    // 1. Cấu hình CORS để cho phép Frontend gọi API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Phản hồi ngay với request OPTIONS (Preflight) của trình duyệt
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const SPREADSHEET_ID = '1Xtwk_Y7UGKNw2YC9c4kblae71mHahzr7GqV-sfiie6E';
    const API_KEY = process.env.GOOGLE_SHEETS_API_KEY; 

    if (!API_KEY) {
        return res.status(500).json({ error: 'Chưa cấu hình biến môi trường GOOGLE_SHEETS_API_KEY trên Vercel.' });
    }

    // Đọc tham số sheet từ URL (VD: ?sheet=Gantt)
    const sheetName = req.query.sheet;

    if (!sheetName) {
        return res.status(400).json({ error: 'Thiếu tham số sheet trong URL' });
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            return res.status(400).json({ error: data.error.message });
        }
        
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi kết nối đến hệ thống Google Sheets.' });
    }
}
