'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitPair, type SubmitPairInput } from '@/lib/actions/submit-pair';

const CONDITION_GRADES = [
  { value: 'DS',   label: 'Deadstock',           hint: 'Never worn, in box' },
  { value: 'VNDS', label: 'Very Near Deadstock',  hint: 'Tried on only' },
  { value: '9_5',  label: '9.5/10',              hint: 'Minimal wear' },
  { value: '9',    label: '9/10',                hint: 'Light wear' },
  { value: '8_5',  label: '8.5/10',              hint: 'Moderate wear' },
  { value: '8',    label: '8/10',                hint: 'Visible wear' },
] as const;

interface SubmitFormProps {
  sellerId: string;
  defaultHubId?: string;
}

export function SubmitPostForm({
  sellerId,
  defaultHubId = '',
}: SubmitFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState<Partial<SubmitPairInput>>({
    brand: '',
    model: '',
    condition: 'VNDS',
    size_us: 0,
    asking_price_vnd: 0,
    colorway: '',
    release_year: new Date().getFullYear(),
    hub_id: defaultHubId,
    image_paths: [],
  });

  const handleInputChange = (field: keyof SubmitPairInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    // Client-side validation
    if (!formData.brand || formData.brand.length < 2) {
      setFeedback({ type: 'error', message: 'Brand name required (min 2 chars)' });
      setLoading(false);
      return;
    }
    if (!formData.model || formData.model.length < 2) {
      setFeedback({ type: 'error', message: 'Model name required (min 2 chars)' });
      setLoading(false);
      return;
    }
    if (!formData.size_us || formData.size_us <= 0) {
      setFeedback({ type: 'error', message: 'Size US required' });
      setLoading(false);
      return;
    }
    if (!formData.asking_price_vnd || formData.asking_price_vnd < 100000) {
      setFeedback({ type: 'error', message: 'Price must be ≥ 100,000 VND' });
      setLoading(false);
      return;
    }
    if (formData.asking_price_vnd > 1000000000) {
      setFeedback({ type: 'error', message: 'Price must be ≤ 1,000,000,000 VND' });
      setLoading(false);
      return;
    }
    if (!formData.hub_id) {
      setFeedback({ type: 'error', message: 'Hub not found. Please try again.' });
      setLoading(false);
      return;
    }

    try {
      console.log('[SubmitPostForm] Submitting:', formData);

      await submitPair({
        brand:            formData.brand!,
        model:            formData.model!,
        colorway:         formData.colorway || '',
        size_us:          formData.size_us!,
        condition:        formData.condition!,
        release_year:     formData.release_year || null,
        asking_price_vnd: formData.asking_price_vnd!,
        hub_id:           formData.hub_id!,
        image_paths:      formData.image_paths || [],
      });

      // submitPair dùng redirect() khi thành công
      // nếu đến đây nghĩa là có lỗi không được throw

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // NEXT_REDIRECT = success, bỏ qua
      if (message.includes('NEXT_REDIRECT')) return;

      console.error('[SubmitPostForm] Error:', err);
      setFeedback({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-ink p-8">

      {/* Header */}
      <div className="border-b border-line pb-6">
        <h1 className="font-display text-3xl text-bone">Submit Shoe</h1>
        <p className="mt-2 text-concrete">Add a new shoe to your collection</p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`rounded border px-4 py-3 font-mono text-sm ${
          feedback.type === 'success'
            ? 'border-green-700 bg-green-900/20 text-green-200'
            : 'border-red-700 bg-red-900/20 text-red-200'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-hazard">
          Basic Info
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Brand (e.g., Nike)"
            value={formData.brand || ''}
            onChange={(e) => handleInputChange('brand', e.target.value)}
            className="rounded border border-concrete/50 bg-ink px-3 py-2 text-sm text-bone placeholder-concrete/50 focus:outline-none focus:ring-2 focus:ring-rust/50"
          />
          <input
            type="text"
            placeholder="Model (e.g., Air Jordan 4)"
            value={formData.model || ''}
            onChange={(e) => handleInputChange('model', e.target.value)}
            className="rounded border border-concrete/50 bg-ink px-3 py-2 text-sm text-bone placeholder-concrete/50 focus:outline-none focus:ring-2 focus:ring-rust/50"
          />
        </div>
        <input
          type="text"
          placeholder="Colorway (optional, e.g., White Cement)"
          value={formData.colorway || ''}
          onChange={(e) => handleInputChange('colorway', e.target.value)}
          className="w-full rounded border border-concrete/50 bg-ink px-3 py-2 text-sm text-bone placeholder-concrete/50 focus:outline-none focus:ring-2 focus:ring-rust/50"
        />
      </div>

      {/* Condition */}
      <div className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-hazard">
          Condition
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {CONDITION_GRADES.map((grade) => (
            <button
              key={grade.value}
              type="button"
              onClick={() => handleInputChange('condition', grade.value)}
              className={`rounded border-2 px-3 py-3 text-center transition-all ${
                formData.condition === grade.value
                  ? 'border-rust bg-rust/10'
                  : 'border-concrete/30 hover:border-concrete/50'
              }`}
            >
              <div className="font-mono font-bold text-bone">{grade.label}</div>
              <div className="mt-1 text-xs text-concrete">{grade.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-hazard">
          Details
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <input
            type="number"
            placeholder="Size US"
            step="0.5"
            value={formData.size_us || ''}
            onChange={(e) => handleInputChange('size_us', parseFloat(e.target.value))}
            className="rounded border border-concrete/50 bg-ink px-3 py-2 text-sm text-bone placeholder-concrete/50 focus:outline-none focus:ring-2 focus:ring-rust/50"
          />
          <input
            type="number"
            placeholder="Release Year"
            value={formData.release_year || ''}
            onChange={(e) => handleInputChange('release_year', parseInt(e.target.value))}
            min="1980"
            max={new Date().getFullYear()}
            className="rounded border border-concrete/50 bg-ink px-3 py-2 text-sm text-bone placeholder-concrete/50 focus:outline-none focus:ring-2 focus:ring-rust/50"
          />
          <input
            type="number"
            placeholder="Asking Price (VND)"
            value={formData.asking_price_vnd || ''}
            onChange={(e) => handleInputChange('asking_price_vnd', parseInt(e.target.value))}
            className="rounded border border-concrete/50 bg-ink px-3 py-2 text-sm text-bone placeholder-concrete/50 focus:outline-none focus:ring-2 focus:ring-rust/50"
          />
        </div>
        <p className="text-xs text-concrete/70">
          💡 Price must be between 100,000 and 1,000,000,000 VND
        </p>
      </div>

      {/* Submit */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded border border-rust bg-rust/10 px-6 py-3 font-mono text-sm uppercase text-rust transition-all hover:bg-rust/20 disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Submit Post'}
        </button>
      </div>

      {/* Info */}
      <div className="rounded border border-concrete/30 bg-concrete/5 p-4 text-xs text-concrete">
        <p className="mb-2">
          📝 <strong>Next steps:</strong> Bring your shoe to the hub for verification.
        </p>
        <p>
          ⭐ <strong>The First:</strong> You have 48h to scan the QR
          and claim "THE FIRST" status permanently.
        </p>
      </div>

    </form>
  );
}