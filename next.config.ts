import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // حد جسم الطلب الافتراضي 1MB يجعل رفع ملفات المكتبة (حتى 20MB) يفشل قبل بلوغ الشيفرة
    serverActions: {
      bodySizeLimit: "22mb",
    },
  },
};

export default nextConfig;
