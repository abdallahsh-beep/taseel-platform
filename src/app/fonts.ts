import localFont from "next/font/local";

// خطا هوية تأصيل: Qomra للعناوين، Sakkal Saad للنصوص
export const qomra = localFont({
  src: [
    { path: "../fonts/itfQomraArabic-Light.ttf", weight: "300" },
    { path: "../fonts/itfQomraArabic-Regular.ttf", weight: "400" },
    { path: "../fonts/itfQomraArabic-Medium.ttf", weight: "500" },
    { path: "../fonts/itfQomraArabic-Bold.ttf", weight: "700" },
    { path: "../fonts/itfQomraArabic-Black.ttf", weight: "900" },
  ],
  variable: "--font-qomra",
  display: "swap",
});

export const sakkal = localFont({
  src: [
    { path: "../fonts/SakkalSaad-Light.ttf", weight: "300" },
    { path: "../fonts/SakkalSaad-Regular.ttf", weight: "400" },
    { path: "../fonts/SakkalSaad-Medium.ttf", weight: "500" },
    { path: "../fonts/SakkalSaad-Bold.ttf", weight: "700" },
    { path: "../fonts/SakkalSaad-Extrabold.ttf", weight: "800" },
  ],
  variable: "--font-sakkal",
  display: "swap",
});
