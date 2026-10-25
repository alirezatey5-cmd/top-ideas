TOP IDEAS — بسته راه‌اندازی نسخه واقعی
======================================

محتویات
- public/index.html : رابط فارسی سایت، فرم ثبت ایده، ورود پیامکی، چت ناشناس
- public/top-logo.jpg : لوگوی کاربر
- public/robots.txt و public/sitemap.xml : فایل‌های پایه سئو
- worker.js : API برای OTP، کاربران، ایده‌ها و چت
- schema.sql : ساخت جداول پایگاه داده Cloudflare D1
- wrangler.toml : تنظیمات انتشار Cloudflare Worker + Static Assets

مهم
این بسته کد آماده است، اما به‌تنهایی قابلیت‌های سمت سرور را فعال نمی‌کند. باید آن را در حساب Cloudflare منتشر کرد، پایگاه داده ساخت و اسرار پیامکی را تنظیم کرد. هیچ پیامک یا چت واقعی تا پایان این مراحل فعال نیست. رمز، توکن یا کلید API را در چت عمومی یا فایل HTML قرار ندهید.

مسیر پیشنهادی از گوشی اندرویدی
1) در https://github.com/ یک حساب بسازید و ایمیل را تأیید کنید.
2) یک Repository جدید با نام top-ideas بسازید (Public یا Private؛ برای کد عمومی مراقب باشید هیچ کلیدی داخل فایل‌ها نباشد).
3) فایل ZIP را روی گوشی دانلود و با برنامه مدیریت فایل استخراج کنید. از سایت GitHub در مرورگر، وارد repository شوید و فایل‌ها و پوشه‌های بسته را بارگذاری کنید؛ ساختار پوشه‌ها را حفظ کنید. در ریشه repository باید worker.js، wrangler.toml، schema.sql و پوشه public باشند.
4) در Cloudflare Dashboard به Storage & databases > D1 SQL Database بروید و یک دیتابیس با نام top-ideas-db بسازید. شناسه Database ID را کپی کنید.
5) فایل wrangler.toml را در GitHub ویرایش کنید و REPLACE_WITH_D1_DATABASE_ID را با شناسه واقعی جایگزین کنید.
6) در Cloudflare > Workers & Pages، یک برنامه جدید بسازید و GitHub repository را متصل کنید. نوع برنامه Workers را انتخاب کنید و تنظیمات build/deploy را طبق گزینه‌های نمایش داده‌شده انجام دهید؛ دستور deploy باید wrangler.toml را در ریشه پیدا کند. اگر Cloudflare از شما Build command خواست، npx wrangler deploy را وارد کنید. اگر داشبورد برای این مسیر گزینه‌ای نشان نداد، از راهنمای رسمی Workers Builds استفاده کنید.
7) در تنظیمات Worker، binding دیتابیس را با نام DB به دیتابیس ساخته‌شده وصل کنید. تنظیمات static assets باید پوشه public و binding با نام ASSETS را مشخص کند؛ این دو نام باید با wrangler.toml یکی باشند.
8) از بخش D1 > Console، محتوای schema.sql را اجرا کنید تا جداول ساخته شوند.
9) در تنظیمات Worker > Variables and Secrets، این مقادیر را اضافه کنید:
   - KAVENEGAR_API_KEY : کلید API حساب پیامکی کاوه‌نگار
   - KAVENEGAR_SENDER : شماره فرستنده، فقط اگر سرویس برای حساب شما لازم دارد
   - OTP_PEPPER : یک رشته تصادفی طولانی و محرمانه که خودتان تولید کنید
   این‌ها باید Secret باشند، نه متن داخل HTML یا repository. برای پیامک واقعی ممکن است نیاز به شارژ حساب و فعال بودن ارسال پیامک داشته باشید.
10) Worker را مجدداً deploy کنید و این آدرس را آزمایش کنید: https://YOUR-WORKER-DOMAIN/api/health باید JSON با ok:true برگرداند.
11) صفحه اصلی را باز کنید. شماره موبایل ایرانی را وارد کنید، کد پیامک را بگیرید، وارد شوید، سپس ثبت ایده و چت را با دو مرورگر/دو کاربر آزمایش کنید.

نکته‌های مهم فنی
- API پیامک این نمونه از ارسال پیامک متنی Kavenegar استفاده می‌کند. اگر حساب یا محدودیت اپراتور ارسال متن آزاد را نپذیرد، باید endpoint/template تأییدشده سرویس را تنظیم کنید.
- ارسال SMS ممکن است هزینه داشته باشد و تضمین دسترسی از داخل ایران به سرویس‌های خارجی وجود ندارد.
- نام مستعار در چت عمومی است؛ شماره موبایل به کاربران دیگر نمایش داده نمی‌شود.
- برای انتشار عمومی بزرگ، قبل از تبلیغ سایت CAPTCHA، سیاست حریم خصوصی، شرایط استفاده، ابزار مدیریت/حذف پیام و پنل رسیدگی به گزارش‌ها اضافه شود. endpoint ثبت گزارش در API هست ولی هنوز پنل مدیریت گزارش در رابط کاربری وجود ندارد.
- Sitemap فعلاً شامل دامنه فعلی است. اگر دامنه تغییر کرد، public/sitemap.xml را با آدرس نهایی جایگزین کنید. ثبت در Google Search Console انجام‌شدنی است اما رتبه یا نمایش فوری تضمین نمی‌شود.
- Cloudflare Workers/Pages و سرویس پیامکی شرایط و محدودیت‌های خود را دارند؛ قبل از انتشار عمومی آن‌ها را بررسی کنید.

فایل‌ها و مستندات رسمی
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Kavenegar API: https://kavenegar.com/rest.html
- Google Search Console: https://search.google.com/search-console/about
