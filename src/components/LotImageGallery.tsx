'use client';

import { useState } from 'react';
import { SneakerThumb } from './SneakerThumb';

interface Props {
  images: string[];
  coverImage: string | null;
  lotId: string;
  brand: string;
  model: string;
}

export function LotImageGallery({ images, coverImage, lotId, brand, model }: Props) {
  const allImages = images.length > 0 ? images : coverImage ? [coverImage] : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const hasImages = allImages.length > 0;

  if (!hasImages) {
    // Fallback to SVG sneaker if no images
    return (
      <div className="aspect-[4/3] bg-ink-2 border border-line flex items-center justify-center">
        <div className="w-[80%] max-w-[500px]">
          <SneakerThumb brand={brand} colorway={null} />
        </div>
      </div>
    );
  }

  const activeSrc = allImages[activeIdx];

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div className="aspect-[4/3] bg-ink-2 border border-line overflow-hidden relative group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeSrc}
          alt={`${brand} ${model}`}
          className="w-full h-full object-contain transition-opacity duration-200"
        />

        {/* Nav arrows (if > 1 image) */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx((i) => (i === 0 ? allImages.length - 1 : i - 1))}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-ink/80 text-bone w-10 h-10 flex items-center justify-center font-display text-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rust hover:text-ink"
              aria-label="Ảnh trước"
            >
              ‹
            </button>
            <button
              onClick={() => setActiveIdx((i) => (i === allImages.length - 1 ? 0 : i + 1))}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-ink/80 text-bone w-10 h-10 flex items-center justify-center font-display text-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rust hover:text-ink"
              aria-label="Ảnh sau"
            >
              ›
            </button>
          </>
        )}

        {/* Counter */}
        {allImages.length > 1 && (
          <div className="absolute bottom-4 right-4 font-mono text-[10px] tracking-[0.14em] bg-ink/80 text-bone px-3 py-1.5 uppercase">
            {activeIdx + 1} / {allImages.length}
          </div>
        )}

        {/* Lot badge */}
        <div className="absolute top-4 left-4 font-mono text-[10px] tracking-[0.18em] bg-rust text-ink px-3 py-1.5 uppercase">
          LOT // {lotId}
        </div>
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-6 gap-2 max-sm:grid-cols-4">
          {allImages.map((src, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`aspect-square border overflow-hidden transition-all ${
                idx === activeIdx
                  ? 'border-rust border-2 opacity-100'
                  : 'border-line opacity-60 hover:opacity-100 hover:border-bone-2'
              }`}
              aria-label={`Ảnh ${idx + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`thumb ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
