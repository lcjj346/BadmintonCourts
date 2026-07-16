import { listVenues } from "@/services/venueService";
import { PostForm } from "@/components/PostForm";

export const dynamic = "force-dynamic";

export default async function PostGame({
  searchParams,
}: {
  searchParams: Promise<{ batchToken?: string }>;
}) {
  const [venues, { batchToken }] = await Promise.all([listVenues(), searchParams]);
  return (
    <main className="mx-auto w-full max-w-lg pt-6">
      <a href={batchToken ? `/manage/${batchToken}` : "/post"} className="text-sm text-gray-400">← Back</a>
      <h1 className="mt-2 text-xl font-bold">{batchToken ? "Add another game" : "Host a game"}</h1>
      <PostForm kind="game" venues={venues} batchToken={batchToken} />
    </main>
  );
}
