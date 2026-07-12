"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="pattern-bg flex min-h-screen items-center justify-center bg-cream-50 p-4">
      <div className="w-full max-w-md">
        {/* الشعار الرسمي */}
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="تأصيل التعليمية" className="h-20 w-auto" />
          <p className="text-sm text-steel-500">منصة إدارة المحتوى والروزنامة</p>
        </div>

        <form
          action={action}
          className="rounded-2xl border border-sand-300/60 bg-white p-6 shadow-[0_10px_40px_-12px_rgba(27,51,71,0.25)]"
        >
          <label className="mb-1.5 block text-sm font-bold text-navy-900">البريد الإلكتروني</label>
          <input
            name="email"
            type="email"
            required
            dir="ltr"
            placeholder="name@taseel.org.sa"
            className="mb-4 w-full rounded-lg border border-steel-300 bg-cream-50 px-3 py-2.5 text-left outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-700/20"
          />
          <label className="mb-1.5 block text-sm font-bold text-navy-900">كلمة المرور</label>
          <input
            name="password"
            type="password"
            required
            dir="ltr"
            className="mb-5 w-full rounded-lg border border-steel-300 bg-cream-50 px-3 py-2.5 text-left outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-700/20"
          />
          {state?.error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          <button
            disabled={pending}
            className="w-full rounded-lg bg-navy-900 py-3 font-heading text-lg font-bold text-cream-50 transition hover:bg-navy-700 disabled:opacity-60"
          >
            {pending ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </main>
  );
}
