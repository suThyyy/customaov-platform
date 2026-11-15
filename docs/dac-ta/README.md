# Đặc Tả Nghiệp Vụ

Thư mục này chứa các tài liệu đặc tả nghiệp vụ chi tiết.

## Cách tổ chức
- Mỗi module/feature một file hoặc thư mục con
- Đặt tên: `[module-name].md` hoặc `[module-name]/`
- Nội dung: yêu cầu nghiệp vụ, luồng xử lý, business rules

## Ví dụ cấu trúc
```
dac-ta/
├── quan-ly-nguoi-dung.md
├── quan-ly-don-hang/
│   ├── tao-don-hang.md
│   └── duyet-don-hang.md
└── bao-cao-thong-ke.md
```

## Lưu ý
- AI Agent sẽ đọc các file trong thư mục này để hiểu nghiệp vụ
- Viết càng chi tiết càng tốt → AI generate code chính xác hơn
