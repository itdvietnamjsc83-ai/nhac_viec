const path = require('path');
const { writeTemplate } = require('../src/excel');
const out = path.join(__dirname, '..', 'assets', 'mau-tien-do-du-an.xlsx');
writeTemplate(out).then(() => console.log('Đã tạo', out));
