# Bookmarks

تطبيق Local First حقيقي لحفظ الروابط والصور ولقطات الشاشة والملاحظات والملفات، مستند إلى التصميم المرفق. لا يحتاج حسابًا أو خدمة مدفوعة. بيانات المستخدم تُحفظ في IndexedDB، ولا تُرسل الصور أو نصوص OCR إلى خادم.

## الموجود

- الشاشات الست: Home، Collections، All Bookmarks، Add، Search، Details، بالإضافة إلى إعدادات Profile.
- Light / Dark / System، وشعار المرجع، ونمط النقاط، وحركة Motion خفيفة مع reduced motion.
- إضافة وتعديل وحذف، مجموعات وإعادة تسمية وحذف ونقل عناصر وتغيير الغلاف والترتيب، وسوم ومفضلة.
- بحث داخل العنوان والرابط والنطاق والملاحظة والوصف والوسوم والمجموعة ونص OCR.
- رفع الصور والملفات وحفظ Blob محليًا. ضغط الصور إلى JPEG وبحد أقصى 2400px، وحد رفع 40MB.
- OCR محلي عبر Tesseract، مع ملفات العربية والإنجليزية داخل التطبيق؛ زر استخراج النص ثم حفظه للبحث.
- PWA وService Worker وShare Target. مشروع Android باستخدام Capacitor مع استقبال ACTION_SEND للروابط والنصوص والصور وPDF؛ حد المرفق المشترك في Android هو 20MB.
- شريط التمرير الرمادي مخفي مع استمرار السحب. التخطيط يستخدم عرض الشاشة والمساحات الآمنة.

## التشغيل

يتطلب Node 22 أو أحدث.

```bash
npm ci
npm run prepare:ocr
npm run dev
```

المسار `/` يعرض محاكي الهاتف للمعاينة. المسار `/app.html` هو التطبيق الحقيقي المستقل. المسار `/qa.html` مخصص لفحص أبعاد الهاتف فقط ولا يدخل حزمة الإنتاج.

```bash
npm test
npm run build:app
```

حزمة الويب الجاهزة داخل `dist-app/`؛ ارفع محتوياتها إلى استضافة Static تدعم HTTPS. توجد `index.html` و`app.html` وملفات Service Worker وOCR. لا تفتحها عبر file://؛ تحتاج خادم ويب. بعد أول تحميل كامل يمكن استخدام الأساس دون اتصال. تثبيت PWA على Android يتيح Share Target حسب دعم المتصفح. امساح بيانات الموقع أو حذف التطبيق يمسح البيانات المحلية؛ زر Export local backup ينزل نسخة JSON (لا توجد واجهة استيراد في هذه النسخة).

## Android من الهاتف عبر GitHub

1. ارفع محتويات مشروع المصدر إلى مستودع GitHub، بما فيها مجلد `.github/workflows`.
2. افتح **Actions → Build Bookmarks Android APK → Run workflow**.
3. بعد نجاح التشغيل، افتح **Artifacts → Bookmarks-debug-APK** ونزل الملف.
4. فك ZIP وثبّت `app-debug.apk`. هذا Debug build، وليس إصدار Play Store موقعًا.

أوامر البناء محليًا، إذا كان Android SDK وJava 21 موجودين:

```bash
npm run build:app
npx cap sync android
cd android
./gradlew assembleDebug
```

تمت إضافة Android ومزامنته هنا، لكن لم يُبنَ APK بسبب غياب Android SDK وJava 21. استقبال المشاركة موجود في الكود ولم يُختبر على هاتف فعلي. يظل هذا الاختبار مطلوبًا قبل اعتماد نسخة Android.

## الملفات الرئيسية

| المسار | الغرض |
| --- | --- |
| `src/Prototype.tsx` | الشاشات والتدفقات والعمليات الفعلية |
| `src/data.ts` | التخزين والبحث والنموذج وOCR |
| `src/design-tokens.css` + `src/prototype.css` | الهوية والقياسات والوضعان والتجاوب |
| `src/production.tsx` | نقطة دخول التطبيق المستقل |
| `src/native-share.ts` | جسر مشاركة Android |
| `public/sw.js` + `public/manifest.webmanifest` | Offline وPWA Share Target |
| `android/app/src/main/java/app/bookmarks/local/ShareInboxPlugin.java` | استقبال Android Intent |
| `.github/workflows/android.yml` | بناء APK عبر GitHub Actions |
| `design-qa.md` + `qa/` | أدلة المقارنة والاختبارات |

## الاختبارات والحدود

نجحت نسختا Production وPreview و11 اختبارًا آليًا. اختُبرت في المتصفح الإضافة والتعديل والبحث والمجموعات ونقل العناصر وحذفها والمفضلة وOCR لصورة فعلية والبحث داخل نصها وإعادة التحميل والرابط غير الصالح والمكرر والملاحظة الطويلة. فُحصت الأحجام 360×800 و390×844 و412×915 و430×932 دون تجاوز أفقي.

استخراج بيانات الروابط محاولة مباشرة؛ المواقع التي تمنع CORS تستخدم fallback ولا تمنع الحفظ. البحث Semantic ليس منفذًا؛ وظيفة البحث مستقلة لإضافة مصنف محلي لاحقًا. ملفات OCR للعربية موجودة، لكن اختبار الدقة الفعلي كان بالنص الإنجليزي. مشاركة PWA اختُبرت على مستوى Service Worker، وليس Share Picker مثبتًا على Android. لا توجد مزامنة سحابية أو حسابات أو AI وهمي.
