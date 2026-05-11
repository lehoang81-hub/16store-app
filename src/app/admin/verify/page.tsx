export const dynamic = 'force-dynamic';
import { getPendingPosts, verifyPost, rejectPost } from '@/lib/actions/verify-post';
import { PostVerificationCard } from '@/components/PostVerificationCard';

export const metadata = {
  title: 'Verify Posts | Admin Dashboard',
};

export default async function AdminVerifyPage() {
  const pendingPosts = await getPendingPosts();

  return (
    <div className="space-y-8 bg-ink p-8">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <h1 className="font-display text-3xl text-bone">Verify Posts</h1>
        <p className="mt-2 text-concrete">
          Review and approve {pendingPosts.length} pending post(s)
        </p>
      </div>

      {/* Posts List */}
      {pendingPosts.length === 0 ? (
        <div className="rounded border border-concrete/30 bg-concrete/5 p-8 text-center">
          <p className="text-concrete">✓ No posts pending verification</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPosts.map((post: any) => (
            <PostVerificationCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="rounded border border-concrete/30 bg-concrete/5 p-4 text-xs text-concrete">
        <p className="mb-2">
          📋 <strong>Status flow:</strong> draft → (verify) → live
        </p>
        <p>
          🔍 <strong>Verify checklist:</strong> Stitching · Sole · Materials · Box
        </p>
      </div>
    </div>
  );
}