# Marada — ระบบจัดการการจอง

ชุดซอร์สสำหรับรันเว็บด้วย React + Express + MySQL แยกจากระบบโฮสต์ของ ChatGPT

คัดลอกจาก `client/` และ `server/` ในโครงการเดิมเมื่อ 10 กันยายน 2569 โดยคงโค้ดและโครงสร้าง import เดิม ไม่มีข้อมูลลูกค้า บัญชีผู้ใช้ หรือฐานข้อมูลจริงติดมา

## โครงสร้าง

| ตำแหน่ง | หน้าที่ |
|---|---|
| `client/src/` | หน้าเว็บ ปฏิทิน ฟอร์ม สิทธิ์ผู้ใช้ และชุดทดสอบ frontend |
| `client/dev/` | หน้าทดสอบ UI ในเครื่อง ไม่รวมใน production build |
| `server/src/` | Express API การเข้าสู่ระบบ การจอง และจัดการบัญชี |
| `server/sql/schema.sql` | โครงสร้างฐานข้อมูล MySQL สำหรับเริ่มต้น |
| `server/scripts/` | เครื่องมือสร้าง password hash |
| `server/.env.example` | รายชื่อตัวแปรตั้งค่า พร้อมค่าตัวอย่าง |
| `docker-compose.yml` | MySQL สำหรับพัฒนาในเครื่อง |
| `AGENT.MD` | ขอบเขตโครงการและแนวทางสำหรับผู้แก้โค้ด |

## เริ่มใช้งาน

ต้องมี Node.js ที่รองรับ Vite รุ่นใน lockfile และ MySQL 8.4 หากใช้ไฟล์ Compose ต้องมี Docker Desktop

ติดตั้ง dependencies จากโฟลเดอร์นี้:

```powershell
npm --prefix client ci
npm --prefix server ci
```

ตั้งค่าฐานข้อมูล MySQL ใหม่และโหลด `server/sql/schema.sql` หรือใช้ MySQL สำหรับพัฒนาจาก `docker compose up -d` เมื่อพอร์ต 3308 และชื่อ container ว่าง ค่าที่ฝังใน Compose เป็นค่าตัวอย่างสำหรับพัฒนา ไม่ใช่ชุดตั้งค่า production อย่ารันทับฐานข้อมูลเดิม

คัดลอก `server/.env.example` เป็น `server/.env` แล้วกำหนดการเชื่อมต่อ MySQL, `JWT_SECRET` และ hash ของรหัสผ่านแอดมินเริ่มต้นด้วยค่าของตัวเอง ดูคำอธิบายในไฟล์ตัวอย่างและ `server/scripts/hash-password.js` ไม่ควรส่งไฟล์ `.env` ขึ้น Git

เปิดสอง terminal:

```powershell
# Terminal 1 — API พอร์ต 4000
npm --prefix server run dev
```

```powershell
# Terminal 2 — หน้าเว็บพอร์ต 5173
npm --prefix client run dev
```

Vite ส่ง `/api` ไปที่ `http://localhost:4000` หากเครื่อง resolve localhost เป็น IPv6 แต่ API ฟังเฉพาะ IPv4 ต้องตั้ง bind/proxy ให้ตรงกัน การเปิด frontend อย่างเดียวไม่ทำให้ระบบดึงข้อมูลได้

## ตรวจสอบและ build

```powershell
npm --prefix client test
npm --prefix client run build
```

ผล build อยู่ใน `client/dist/` ส่วน API ต้องรันแยกด้วย `npm --prefix server start` หลังตั้งค่าฐานข้อมูลและ environment แล้ว ชุดนี้ยังไม่ได้จัดทำโครง deploy production ใหม่

หน้าทดสอบในเครื่อง: `/dev/calendar-review.html` และ `/dev/keyboard-review.html` ใช้ข้อมูลทดสอบและไม่นับเป็นการทดสอบเชื่อมฐานข้อมูลจริง

## ขอบเขตชุดนี้

- ไม่มี `phone-preview/`, Worker, D1, `.openai/` หรือการตั้งค่า ChatGPT Sites
- ไม่มี `.git/`, `node_modules/`, `dist/`, secret หรือข้อมูลจริง
- ไม่คัดลอกคู่มือ VPS เก่าที่อ้างอิงโฟลเดอร์ `deploy/` ซึ่งไม่มีอยู่ในต้นทาง
- ซอร์สฝั่ง ChatGPT Sites มีการเปลี่ยนเพิ่มเติมที่ต่างจากชุด client/server นี้ การแยกครั้งนี้ไม่ได้ย้ายฟีเจอร์เหล่านั้นข้าม backend หรือรับรองว่าทั้งสองชุดเหมือนกันทุกจุด
- ไม่แก้โฟลเดอร์เดิม ไม่ deploy เว็บไซต์ และไม่ push Git

ดูผลตรวจที่ `VERIFICATION.md`

การแก้หลังแยกโฟลเดอร์: เอา Skeleton ใต้เลขวันที่และที่ตัวเลขรอยืนยันออกแล้ว ตัวเลขที่ยังไม่ทราบใช้ `—` ระหว่างรอข้อมูล ส่วน Skeleton รายการจองและจุดอื่นยังคงเดิม การเปลี่ยนนี้อยู่เฉพาะชุด standalone นี้
