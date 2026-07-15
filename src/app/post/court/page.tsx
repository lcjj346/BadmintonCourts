import { listVenues } from "@/services/venueService";
import { PostForm } from "@/components/PostForm";

export const dynamic = "force-dynamic";

export default async function PostCourt() {
  const venues = await listVenues();
  return (
    <main className="mx-auto w-full max-w-lg pt-6">
      <a href="/post" className="text-sm text-gray-400">← Back</a>
      <h1 className="mt-2 text-xl font-bold">Sell a court slot</h1>
      <PostForm kind="court" venues={venues} />
    </main>
  );
}
