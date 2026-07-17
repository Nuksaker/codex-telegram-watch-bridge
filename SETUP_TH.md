# วิธีติดตั้ง Codex Telegram Watch Bridge บน Windows 11

คู่มือนี้อธิบายตั้งแต่ติดตั้งเครื่องมือที่จำเป็น สร้าง Telegram bot ตั้งค่า bridge ติดตั้ง Codex Stop hook ไปจนถึงเปิด bridge อัตโนมัติหลังเข้าสู่ Windows พร้อมวิธีแก้ปัญหาที่พบระหว่างการติดตั้งจริง

ระบบนี้ไม่ต้องมี Mac, Apple Developer Program, public server หรือ Telegram webhook เครื่อง Windows ต้องเปิดอยู่ ลงชื่อเข้าใช้ เชื่อมอินเทอร์เน็ต และมี bridge ทำงานอยู่ จึงจะรับข้อความและสั่ง Codex ต่อจาก Telegram หรือ Apple Watch ได้

## สิ่งที่ต้องมี

- Windows 11
- Node.js `22.5.0` ขึ้นไป
- Codex Desktop ที่ลงชื่อเข้าใช้แล้ว
- Codex CLI ที่ลงชื่อเข้าใช้แล้ว
- Telegram บน iPhone
- Telegram บน Apple Watch หากรุ่นและระบบรองรับ
- Telegram bot ส่วนตัวหนึ่งตัว

เครื่องที่ใช้ทดสอบครั้งนี้ใช้ Node.js `22.19.0`, npm `11.12.1` และ Codex CLI `0.144.4`

## 1. ติดตั้ง Node.js

เปิด PowerShell แบบปกติด้วยบัญชี Windows ที่จะใช้ bridge แล้วรัน:

```powershell
winget install OpenJS.NodeJS.LTS
```

ปิด PowerShell แล้วเปิดใหม่ จากนั้นตรวจสอบ:

```powershell
node --version
npm.cmd --version
```

`node --version` ต้องแสดง `v22.5.0` หรือใหม่กว่า หากติดตั้ง Node.js ไว้แล้วและเวอร์ชันถึงขั้นต่ำ ไม่ต้องติดตั้งซ้ำ

## 2. ติดตั้งและลงชื่อเข้าใช้ Codex CLI

bridge ใช้ Codex CLI เพื่อสั่ง `codex exec resume` กลับไปยัง session เดิม การมี Codex Desktop อย่างเดียวจึงยังไม่พอ

ติดตั้ง Codex CLI ผ่าน npm:

```powershell
npm.cmd install --global @openai/codex@latest
codex.cmd --version
```

ลงชื่อเข้าใช้ด้วยบัญชี ChatGPT เดียวกับที่ใช้ Codex:

```powershell
codex.cmd login
codex.cmd login status
```

เมื่อ browser เปิดขึ้น ให้ลงชื่อเข้าใช้และอนุญาตให้เสร็จจนหน้า browser แจ้งว่าสำเร็จ จากนั้นกลับมาตรวจ `codex.cmd login status` อีกครั้ง ต้องไม่แสดง `Not logged in`

การติดตั้งนี้ใช้การลงชื่อเข้าใช้ด้วย ChatGPT จึงไม่ต้องสร้าง OpenAI API key เพิ่ม ดูขั้นตอนล่าสุดได้จาก [คู่มือ Codex CLI](https://developers.openai.com/codex/cli) และ [คู่มือ Authentication](https://developers.openai.com/codex/auth)

## 3. เตรียม Telegram และ Apple Watch

1. อัปเดต Telegram บน iPhone
2. ติดตั้งหรือเปิด Telegram บน Apple Watch หากอุปกรณ์รองรับ
3. เปิดการแจ้งเตือน Telegram ใน iPhone Settings และ Watch app
4. ทดสอบตอน iPhone ล็อก เพราะระบบอาจส่งการแจ้งเตือนไปเพียงอุปกรณ์เดียวตามสถานะการใช้งาน
5. เวลาตอบจาก Watch ให้ใช้ Dictation ในช่องข้อความ เพื่อให้ Telegram ส่งเป็นข้อความปกติ อย่าส่งเป็น voice note

## 4. สร้าง Telegram bot ส่วนตัว

1. เปิด private chat กับ `@BotFather`
2. ส่ง `/newbot`
3. ตั้งชื่อ bot และตั้ง username ที่ลงท้ายด้วย `bot`
4. เก็บ token ที่ BotFather ส่งมาเหมือนรหัสผ่าน ห้ามวางใน Git, issue, screenshot หรือแชตที่ผู้อื่นเข้าถึงได้
5. เปิด private chat กับ bot ที่สร้าง แล้วส่ง `/start`

อย่าเพิ่ม bot เข้า public group หาก token หลุด ให้ revoke ผ่าน BotFather แล้วสร้าง token ใหม่ทันที

## 5. ติดตั้งโปรเจกต์

เปิด PowerShell ที่โฟลเดอร์โปรเจกต์ ตัวอย่างสำหรับเครื่องนี้:

```powershell
Set-Location 'D:\Nukker\codex-telegram-watch-bridge'
npm.cmd install
npm.cmd run build
```

ต้อง build ก่อนใช้คำสั่ง `setup`, `doctor` และคำสั่งติดตั้ง hook เพราะคำสั่งเหล่านี้ทำงานจากโฟลเดอร์ `dist`

หากต้องการตรวจโค้ดทั้งหมด ให้รัน:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## 6. ตั้งค่า Telegram bot และผู้ใช้ที่อนุญาต

ตรวจว่าได้ส่ง `/start` ให้ bot จากบัญชี Telegram ที่ต้องการใช้แล้ว จากนั้นรัน:

```powershell
npm.cmd run setup
```

Setup จะทำสิ่งต่อไปนี้:

- รับ Telegram bot token โดยซ่อนข้อความระหว่างพิมพ์
- ตรวจสอบ bot กับ Telegram
- อ่าน private message ล่าสุด
- แสดง Telegram username, user ID และ chat ID ให้ยืนยัน
- สร้าง bridge secret แบบสุ่ม
- บันทึกค่าจริงไว้ที่ `%LOCALAPPDATA%\CodexTelegramBridge\.env`

ตรวจ username และ ID ก่อนตอบ `y` หากเป็นบัญชีผิด ให้ยกเลิก ส่ง `/start` จากบัญชีที่ถูกต้อง แล้วรัน setup ใหม่

ห้ามนำ token หรือไฟล์ `.env` จริงมาไว้ใน repository

## 7. กำหนด path ของ Codex CLI

Codex CLI ที่ติดตั้งผ่าน npm มีไฟล์ wrapper ชื่อ `codex.cmd` แต่ bridge เรียกโปรแกรมโดยไม่ผ่าน shell เพื่อความปลอดภัย จึงควรกำหนด `CODEX_BIN` ให้ชี้ไปยัง `codex.exe` ตัวจริง

ค้นหา path:

```powershell
$CodexRoot = Join-Path (npm.cmd root --global) '@openai\codex'
$CodexExe = Get-ChildItem -Recurse -Filter codex.exe -LiteralPath $CodexRoot | Select-Object -First 1 -ExpandProperty FullName
$CodexExe
```

ผลลัพธ์บนเครื่องที่ทดสอบมีรูปแบบดังนี้:

```text
C:\Users\<ชื่อผู้ใช้>\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe
```

เปิด runtime configuration:

```powershell
notepad "$env:LOCALAPPDATA\CodexTelegramBridge\.env"
```

แก้บรรทัดต่อไปนี้โดยใช้ path ที่ได้จาก `$CodexExe`:

```dotenv
CODEX_BIN=C:\Users\<ชื่อผู้ใช้>\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe
```

บันทึกไฟล์แล้วปิด Notepad

## 8. ตรวจระบบด้วย Doctor

รันจาก PowerShell ปกติ ไม่ใช่ terminal ที่ถูกจำกัดสิทธิ์หรือ network โดย sandbox:

```powershell
npm.cmd run doctor
```

ก่อนเปิด bridge สถานะที่คาดไว้คือ:

- configuration, runtime directory, Telegram token และ Codex executable ควรเป็น `PASS`
- local bridge อาจเป็น `FAIL ... offline` เพราะยังไม่ได้เปิด bridge
- port availability ควรเป็น `PASS`
- Codex Stop hook อาจเป็น `FAIL ... missing` เพราะยังไม่ได้ติดตั้ง hook

หลังเปิด bridge แล้ว `local bridge` ควรเป็น `PASS` ส่วน `port availability` อาจแสดงว่าพอร์ต `47831` ถูกใช้งาน ซึ่งเป็นเรื่องปกติเมื่อ bridge ตัวนี้กำลังทำงาน

## 9. เปิด bridge และทดสอบ Telegram

เปิด PowerShell หน้าต่างแรกแล้วรัน:

```powershell
Set-Location 'C:\PathFolder\codex-telegram-watch-bridge'
npm.cmd run start
```

อย่าปิดหน้าต่างนี้ระหว่างการทดสอบ จากนั้นส่งคำสั่งต่อไปนี้ให้ bot ใน Telegram:

```text
/ping
/status
```

bot ต้องตอบทั้งสองคำสั่ง หากไม่ตอบ ให้แก้ปัญหา Telegram หรือ bridge ก่อนติดตั้ง hook

## 10. ติดตั้ง Codex Stop hook

เปิด PowerShell หน้าต่างที่สองในโฟลเดอร์โปรเจกต์:

```powershell
npm.cmd run hook:install -- --dry-run
npm.cmd run hook:install
```

ตรวจ command และ target ที่แสดง หากถูกต้องให้ตอบ `y` จากนั้นตรวจสถานะ:

```powershell
npm.cmd run hook:status
npm.cmd run doctor
```

ตัวติดตั้งจะ merge เข้า `%USERPROFILE%\.codex\hooks.json`, สำรองไฟล์เดิมก่อนเขียน, ไม่เพิ่มรายการซ้ำ และไม่ลบ hook อื่น

หลังติดตั้ง ให้เปิด `/hooks` ใน Codex ตรวจว่า command ชี้ไปที่ `dist\hook\stop-hook.js` ของโปรเจกต์นี้ แล้ว review/trust hook ดังกล่าว การติดตั้งสำเร็จในไฟล์แต่ยังไม่ trust อาจทำให้ Codex จบงานโดยไม่มีข้อความ Telegram

## 11. ทดสอบ Codex → Telegram → Apple Watch

สั่งงานใน Codex Desktop:

```text
ตอบกลับเพียงคำว่า HOOK TEST OK
```

เมื่อ Codex จบ ต้องได้รับ Telegram หนึ่งข้อความ หากได้รับข้อความซ้ำ ให้หยุดและตรวจรายการ Stop hook ก่อนใช้งานจริง

ล็อก iPhone แล้วทดสอบอีกครั้งเพื่อยืนยันว่า Apple Watch สั่นและอ่านข้อความได้

## 12. ทดสอบ Telegram → Codex session เดิม

1. หากมี session เดียว ให้ใช้ Dictation หรือพิมพ์คำสั่งได้เลย เช่น `ตอบกลับเพียงว่า SAME SESSION RESUME OK และห้ามแก้ไฟล์`
2. หากมีหลาย session ให้ส่ง `/sessions` แล้วเลือกด้วย `/use 1` โดยเปลี่ยนเลขตามรายการ
3. ส่งคำสั่งเป็นข้อความปกติ ไม่ต้องใช้ฟังก์ชัน Reply ของ Apple Watch
4. bot ต้องส่งข้อความ `📝 รับงาน #...` ซึ่งมี project, session และสำเนาคำสั่งแบบย่อให้ตรวจว่ารับถูกงาน
5. bot ต้องส่งสถานะ `▶️ กำลังทำ` แล้วตามด้วย `✅ สำเร็จ` หรือ `❌ ล้มเหลว`
6. เมื่อ Stop hook ทำงาน จะได้รับข้อความสรุป `สิ่งที่ทำเสร็จ` เพิ่มอีกหนึ่งข้อความ
7. ส่ง `/jobs` หรือ `/history` เพื่อดู 5 งานล่าสุด คำสั่งย่อ และสถานะของแต่ละงาน
8. หาก Codex Desktop ที่เปิดอยู่ไม่ refresh ให้เปิด task เดิมอีกครั้ง ข้อความที่สั่งจาก Telegram จะอยู่ใน session เดิม

Bridge เก็บเพียง hash และข้อความตัวอย่างแบบสั้นสำหรับ `/jobs` โดยแทน token, password, secret และ API key ที่รู้จักด้วย `[REDACTED]` ไม่เก็บคำสั่งดิบฉบับเต็มในฐานข้อมูลประวัติงาน

## 13. เปิด bridge อัตโนมัติหลังเข้าสู่ Windows

ทำขั้นตอนนี้หลังจากการทดสอบแบบเปิดด้วยมือทำงานครบแล้ว

```powershell
npm.cmd run startup:install -- --dry-run
npm.cmd run startup:install
npm.cmd run startup:status
```

ก่อนทดสอบ Scheduled Task ให้หยุด bridge ที่เปิดด้วยมือด้วย `Ctrl+C` เพื่อไม่ให้พอร์ต `47831` ชนกัน จากนั้น sign out/sign in หรือเริ่ม Task แล้วทดสอบ `/ping` ใหม่

Scheduled Task เป็นแบบ per-user และทำงานหลังผู้ใช้คนนั้นเข้าสู่ Windows หาก sign out, Windows sleep, เครื่องปิด หรืออินเทอร์เน็ตหลุด การควบคุมจาก Telegram จะหยุดชั่วคราว

## ปัญหาที่เคยพบและวิธีแก้

### PowerShell แจ้งว่า `npm.ps1` หรือ `codex.ps1` ถูกบล็อก

อาการมักมีข้อความว่า script cannot be loaded because running scripts is disabled สาเหตุคือ PowerShell Execution Policy บล็อกไฟล์ `.ps1` wrapper

วิธีแก้ที่ใช้กับโปรเจกต์นี้คือเรียกไฟล์ `.cmd` โดยตรง:

```powershell
npm.cmd --version
codex.cmd --version
```

ทุกคำสั่งในคู่มือนี้จึงใช้ `npm.cmd` และ `codex.cmd` ไม่จำเป็นต้องลดความปลอดภัยด้วยการเปลี่ยน Execution Policy ทั้งเครื่อง

### Browser แจ้งว่าล็อกอินสำเร็จ แต่ `codex.cmd login status` ยังเป็น `Not logged in`

กรณีนี้เคยเกิดขึ้นแม้ log ของขั้นตอน browser จะมีข้อความ `Successfully logged in` โดยตอนที่พบ คำสั่งถูกเรียกจาก environment ที่จำกัดสิทธิ์ จึงอาจเขียนหรืออ่าน credential ของผู้ใช้ไม่ได้ สาเหตุอื่นที่ควรตรวจคือ login ถูกเปิดเป็น background process, ใช้ Windows user คนละคน หรือใช้ค่า `CODEX_HOME` คนละตำแหน่ง

แก้โดยเปิด PowerShell ปกติด้วย Windows user เดียวกับที่จะรัน bridge แล้วทำใหม่แบบ foreground:

```powershell
codex.cmd logout
codex.cmd login
codex.cmd login status
```

อย่าปิด PowerShell จน browser และคำสั่ง login จบ หากเครื่องไม่มี browser หรือเป็น remote/headless ให้ใช้:

```powershell
codex.cmd login --device-auth
```

ตรวจด้วย `codex.cmd login status` ทุกครั้ง อย่ายึดเฉพาะข้อความสำเร็จใน browser

### Doctor แจ้ง `Codex executable: not found`

สาเหตุคือ `CODEX_BIN=codex` อาจใช้ไม่ได้เมื่อ Node เรียกโปรแกรมแบบ `shell: false` หรือ Scheduled Task ไม่มี PATH เหมือน PowerShell

ให้ทำหัวข้อ “กำหนด path ของ Codex CLI” แล้วตั้ง `CODEX_BIN` เป็น absolute path ของ `codex.exe` จากนั้นรัน:

```powershell
npm.cmd run doctor
```

ผลที่ถูกต้องคือ `PASS  Codex executable: found`

### Doctor แจ้ง `runtime directory: not writable`

อาการนี้เคยเกิดเมื่อสั่ง Doctor จาก environment ที่ sandbox จำกัดการเขียนนอก workspace ไม่ได้หมายความว่าโฟลเดอร์ Windows ของผู้ใช้เสียเสมอไป

ให้เปิด PowerShell ปกตินอก sandbox ด้วย user เดียวกับที่รัน bridge แล้วตรวจ:

```powershell
$RuntimeDir = Join-Path $env:LOCALAPPDATA 'CodexTelegramBridge'
New-Item -ItemType Directory -Force -Path $RuntimeDir
Test-Path -LiteralPath $RuntimeDir
npm.cmd run doctor
```

หากยังเขียนไม่ได้ ให้ตรวจว่าโปรเจกต์และ Scheduled Task ไม่ได้รันด้วย Windows user คนละคน

### Doctor แจ้ง `Telegram token: invalid or Telegram unreachable`

ข้อความเดียวกันอาจเกิดได้จาก token ผิด, token ถูก revoke, ยังไม่ได้ส่ง `/start`, อินเทอร์เน็ตเข้า Telegram ไม่ได้ หรือคำสั่งถูกเรียกจาก sandbox ที่บล็อก network

วิธีตรวจและแก้:

1. รัน Doctor จาก PowerShell ปกติ
2. ตรวจอินเทอร์เน็ตและเปิด Telegram ได้
3. ส่ง `/start` ให้ bot อีกครั้ง
4. หาก token ถูกเปลี่ยน ให้รัน `npm.cmd run setup` ใหม่
5. อย่าวาง token ลงในคำสั่งหรือ screenshot เพื่อทดสอบ

### Doctor แจ้งว่าพอร์ต `47831` ถูกใช้งาน

หาก `local bridge: ready on loopback` เป็น `PASS` แปลว่า bridge ทำงานอยู่แล้ว พอร์ตถูกใช้งานจึงเป็นสถานะปกติ

หาก local bridge ไม่พร้อม แต่พอร์ตถูกใช้งาน ให้หาว่า process ใดถือพอร์ต:

```powershell
$Connection = Get-NetTCPConnection -LocalPort 47831 | Select-Object -First 1
$Connection | Select-Object LocalAddress,LocalPort,State,OwningProcess
Get-Process -Id $Connection.OwningProcess
```

ตรวจชื่อ process ก่อนหยุด ห้ามปิด process ที่ไม่รู้จัก หากเป็น bridge อีกหน้าต่างหนึ่ง ให้ใช้หน้าต่างเดิมหรือหยุดตัวเดิมด้วย `Ctrl+C`

### `hook:status` แสดง installed แต่ Codex จบแล้วไม่มี Telegram

ตรวจตามลำดับ:

```powershell
npm.cmd run build
npm.cmd run hook:status
npm.cmd run doctor
```

จากนั้น:

1. ตรวจว่า bridge ยังเปิดอยู่และ `/ping` ตอบ
2. เปิด `/hooks` ใน Codex แล้ว review/trust hook
3. ตรวจ path ว่าชี้มาที่ `dist\hook\stop-hook.js` ของ checkout ปัจจุบัน
4. หากย้ายโฟลเดอร์โปรเจกต์ ให้รัน `npm.cmd run hook:install` ใหม่
5. ตรวจว่า session ไม่ถูก `/mute`

### ได้ข้อความ Telegram ซ้ำ

อาจมี Stop hook มากกว่าหนึ่งรายการหรือมี bridge มากกว่าหนึ่ง process

รัน:

```powershell
npm.cmd run hook:status
Get-Process -Name node -ErrorAction SilentlyContinue
```

ตรวจ `%USERPROFILE%\.codex\hooks.json` อย่างระมัดระวัง อย่าลบ unrelated hooks ตัวติดตั้งของโปรเจกต์ใช้ marker `Codex Telegram Bridge notification` และออกแบบมาไม่ให้เพิ่ม marker เดิมซ้ำ

### ติดตั้ง Scheduled Task แล้ว `/ping` ไม่ตอบ

สาเหตุที่พบบ่อยคือ bridge แบบ manual ยังถือพอร์ตอยู่, Task ทำงานด้วย user คนละคน, path โปรเจกต์เปลี่ยน หรือ runtime `.env` อยู่คนละ user

แก้โดย:

1. หยุด manual bridge ด้วย `Ctrl+C`
2. รัน `npm.cmd run startup:status`
3. ตรวจ `CODEX_BIN` และ `%LOCALAPPDATA%\CodexTelegramBridge\.env`
4. หากย้ายโปรเจกต์ ให้ถอนแล้วติดตั้ง Task ใหม่

```powershell
npm.cmd run startup:uninstall
npm.cmd run startup:install
npm.cmd run startup:status
```

### Telegram ส่งข้อความแล้ว Codex ไม่ทำต่อ

ตรวจว่าได้ reply completion message โดยตรงและ Codex CLI ยังล็อกอินอยู่:

```powershell
codex.cmd login status
npm.cmd run doctor
```

หากมีหลาย session ให้ใช้ `/sessions` ตามด้วย `/use <ลำดับ>` แล้วส่งคำสั่งใหม่ จากนั้นใช้ `/jobs` ตรวจว่างานอยู่ในสถานะรอคิว กำลังทำ สำเร็จ ล้มเหลว หรือถูกหยุดตอน Bridge รีสตาร์ต หาก Codex ต้องการ approval ให้กลับไปทำ approval บน Codex surface ทางการ bridge จะไม่ bypass approval

### รีสตาร์ต Bridge ระหว่างที่ Codex กำลังทำงาน

process ของ Codex ที่ Bridge เปิดไว้อาจถูกหยุดตามไปด้วย เวอร์ชันนี้จะไม่ปล่อยให้งานค้างเป็น `running` อีกต่อไป เมื่อ Bridge เปิดใหม่ bot จะแจ้งจำนวนงานที่ถูกหยุด และ `/jobs` จะแสดง `⚠️ ถูกหยุดตอน Bridge รีสตาร์ต` ให้เลือก session เดิมด้วย `/use <ลำดับ>` แล้วส่งคำสั่งนั้นใหม่ อย่ารีสตาร์ต Bridge ระหว่างที่มีสถานะ `▶️ กำลังทำ`

### Codex ทำต่อแล้ว แต่หน้าต่าง Desktop ไม่อัปเดต

saved session อาจถูกอัปเดตแล้ว แต่ Codex Desktop บางเวอร์ชันไม่ live-refresh งานที่ resume จากภายนอก ให้ปิดแล้วเปิด task/session เดิมอีกครั้งก่อนสรุปว่า resume ไม่สำเร็จ

## คำสั่งตรวจสถานะแบบย่อ

บางคำสั่งอาจแสดง `missing` หากยังไม่ได้ติดตั้ง hook หรือ Scheduled Task ให้เทียบกับขั้นตอนที่ทำไปแล้ว

```powershell
node --version
npm.cmd --version
codex.cmd --version
codex.cmd login status
npm.cmd run hook:status
npm.cmd run startup:status
npm.cmd run doctor
```

## ถอนการติดตั้ง

หยุด bridge ที่เปิดด้วยมือก่อน แล้วรัน:

```powershell
npm.cmd run startup:uninstall
npm.cmd run hook:uninstall -- --dry-run
npm.cmd run hook:uninstall
```

ตรวจว่า unrelated hooks ยังอยู่ หากเลิกใช้งานถาวร ให้ revoke Telegram bot token ผ่าน BotFather ก่อนลบ runtime state ที่ `%LOCALAPPDATA%\CodexTelegramBridge`
