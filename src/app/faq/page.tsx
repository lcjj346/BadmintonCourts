import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ — BadmintonSG",
  description: "How BadmintonSG works, post lifetime, managing posts, the skill level guide, and phone-number privacy.",
};

const SKILL_GUIDE: [string, string][] = [
  ["Low Beginner", "Learning rules and basic grips, struggles to hit consistently, just started playing."],
  ["Mid Beginner", "Can serve and sustain short rallies, learning footwork, starting to control shots."],
  ["High Beginner", "Knows all basic strokes but inconsistent, rallies up to 8–10 shots, can reach most shuttles, ready for structured coaching."],
  ["Low Intermediate", "Performs all basic strokes with fair consistency, rallies 10+ shots, learning footwork patterns, beginning to place shots deliberately."],
  ["Mid Intermediate", "Controlled clears, drops, and smashes, understands singles/doubles positioning, anticipates opponent's shots, starts using deception."],
  ["High Intermediate", "High consistency and power, efficient footwork and recovery, sustains fast-paced rallies, applies strategy to build points."],
  ["Advanced", "Excellent technique under pressure, explosive footwork, strong tactics and mental game, uses advanced shots, competes at tournament level."],
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-court/10 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-gray-600">{children}</div>
    </section>
  );
}

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-2xl pt-4">
      <Link href="/" className="text-sm text-gray-400">← Back to board</Link>
      <h1 className="mt-3 text-2xl font-bold text-court">Frequently asked questions</h1>

      <div className="mt-4 space-y-4">
        <Card title="How it works">
          <p className="font-semibold text-gray-800">Transferring a court</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Post the court you can&apos;t use — venue, date, time and price.</li>
            <li>You get a secret manage link. Save it — it&apos;s the only way to edit your post.</li>
            <li>Buyers tap &quot;Reveal contact&quot; to see your number and reach you off-platform.</li>
          </ol>
          <p className="mt-3 font-semibold text-gray-800">Finding players</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Post your game — venue, date, time, players needed and skill level.</li>
            <li>You get a secret manage link. Save it — it&apos;s the only way to edit your post.</li>
            <li>Players tap &quot;Reveal contact&quot; to see your number and message you directly.</li>
          </ol>
        </Card>

        <Card title="How do I see the tutorial again?">
          <p>
            On the board page, tap the <strong>&quot;?&quot;</strong> button next to this FAQ link
            to replay the walkthrough of the Courts/Players tabs, date filter, and post button.
          </p>
        </Card>

        <Card title="How long does a post last?">
          <p>
            A post stays visible until its start time passes, then it expires automatically.
          </p>
          <p>
            Marked it sold or filled? It stays visible with a badge for 1 hour as a grace period,
            then it&apos;s automatically removed even if you forget to delete it yourself.
          </p>
          <p>Phone numbers are permanently deleted 14 days after a post expires.</p>
        </Card>

        <Card title="How do I edit, mark sold/filled, or delete my post?">
          <p>
            Only through the secret manage link shown right after you post — there are no accounts,
            so save that link. From there you can edit the date, time, price, and notes (and for
            games, players needed and skill level) at any time before it&apos;s closed.
          </p>
          <p>
            If you lose it you can&apos;t edit the post, but it expires by itself after the date, and
            the number is scrubbed 14 days later.
          </p>
        </Card>

        <Card title="Can I post more than one court or game at once?">
          <p>
            Yes — tap &quot;+ Add another court&quot; (or game) on the post form to list several at
            once, each with its own venue, date, and time. You&apos;ll get a single manage link that
            controls all of them, so you don&apos;t need to save a separate link for each one.
          </p>
        </Card>

        <Card title="Skill level guide">
          <dl className="space-y-2">
            {SKILL_GUIDE.map(([name, def]) => (
              <div key={name}>
                <dt className="font-semibold text-court">{name}</dt>
                <dd>{def}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Is my phone number safe?">
          <p>
            Your number is never shown in the page or list data. It appears only when someone taps the
            rate-limited &quot;Reveal contact&quot; button.
          </p>
          <p>
            It&apos;s deleted 14 days after your post expires, and IP addresses are stored only as
            salted hashes for rate limiting. SG (+65), MY (+60) and other regional numbers supported.
          </p>
        </Card>
      </div>
    </main>
  );
}
