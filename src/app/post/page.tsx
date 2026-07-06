import Link from "next/link";

export default function PostChooser() {
  return (
    <main className="pt-10">
      <Link href="/" className="text-sm text-gray-400">← Back</Link>
      <h1 className="mt-4 text-xl font-bold">What are you posting?</h1>
      <div className="mt-6 space-y-3">
        <Link href="/post/court" className="block rounded-2xl border-2 border-court bg-white p-4">
          <div className="font-bold text-court">Sell a court slot</div>
          <div className="text-sm text-gray-500">Balloted a court you can&apos;t use? Pass it on.</div>
        </Link>
        <Link href="/post/game" className="block rounded-2xl border-2 border-gray-300 bg-white p-4">
          <div className="font-bold">Host a game — find players</div>
          <div className="text-sm text-gray-500">Have a court but not enough players.</div>
        </Link>
      </div>
    </main>
  );
}
