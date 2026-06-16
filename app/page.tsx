import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800">
        <h1 className="text-3xl font-bold text-center mb-2">
          1X2 League
        </h1>

        <p className="text-slate-400 text-center mb-8">
          טורניר ניחושים פשוט לחברים
        </p>

        <div className="space-y-4">
          <Link
            href="/create-league"
            className="block text-center w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700"
          >
            צור ליגה
          </Link>

          <Link
            href="/join-league"
            className="block text-center w-full rounded-xl bg-slate-800 py-3 font-semibold hover:bg-slate-700"
          >
            הצטרף לליגה
          </Link>
        </div>
      </div>
    </main>
  );
}