'use client';

import { useEffect, useRef } from 'react';
import { recordScan } from '@/lib/actions/record-scan';

interface Props {
  passportId: string;
  qrCode: string;
}

/**
 * Auto-record scan event khi user mở trang passport.
 * Hỏi geolocation (cần user permission).
 * Chỉ record 1 lần per page load (dùng ref để guard).
 */
export function ScanRecorder({ passportId, qrCode }: Props) {
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;

    async function record(lat: number | null, lng: number | null, accuracy: number | null) {
      try {
        await recordScan({
          passport_id: passportId,
          qr_code: qrCode,
          location_lat: lat,
          location_lng: lng,
          location_accuracy_m: accuracy,
          user_agent: navigator.userAgent,
          referrer: document.referrer,
        });
      } catch (err) {
        console.error('[ScanRecorder]', err);
      }
    }

    // Try to get geolocation, but don't block if denied
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          record(
            position.coords.latitude,
            position.coords.longitude,
            Math.round(position.coords.accuracy)
          );
        },
        (err) => {
          // User denied or error — record without location
          console.log('[ScanRecorder] No GPS:', err.message);
          record(null, null, null);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    } else {
      record(null, null, null);
    }
  }, [passportId, qrCode]);

  return null; // Invisible component
}
