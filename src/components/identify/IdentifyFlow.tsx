'use client';

import { useState, useCallback } from 'react';
import { ScreenWelcome } from './ScreenWelcome';
import { ScreenGhostFrame } from './ScreenGhostFrame';
import { ScreenScanning } from './ScreenScanning';
import { ScreenMedal } from './ScreenMedal';

export type IdentifyTier = 'standard' | 'elite' | 'heritage';

export interface CaptureData {
  imageDataUrl: string;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  bearing: number | null;
  accuracy: number | null;
  tier: IdentifyTier;
  brand: string;
  model: string;
  colorway: string;
  objectType: string;
  uploadedUrls?: Record<string, string>; // hero, extra, etc.
  coverImageUrl?: string;                // primary image URL
}

export interface ScanResult {
  passportId: string;
  qrCode: string;
  serialNumber: string;
  aiConfidence: number;
  uniquenessScore: number;
  isFirstClaim: boolean;
  claimWindowExpiresAt: string;
  hlrReward: number;
}

interface Props {
  userId: string;
  userHandle: string;
  stats: {
    total: number;
    today: number;
    openWindows: number;
  };
}

export function IdentifyFlow({ userId, userHandle, stats }: Props) {
  const [screen, setScreen] = useState<0 | 1 | 2 | 3>(0);
  const [captureData, setCaptureData] = useState<CaptureData | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const goToGhostFrame = useCallback((tier: IdentifyTier) => {
    setCaptureData(prev => ({
      ...(prev ?? {} as CaptureData),
      tier,
      brand: '',
      model: '',
      colorway: '',
      objectType: 'sneaker',
      imageDataUrl: '',
      lat: null, lng: null,
      altitude: null, bearing: null, accuracy: null,
    }));
    setScreen(1);
  }, []);

  const goToScanning = useCallback((data: CaptureData) => {
    setCaptureData(data);
    setScreen(2);
  }, []);

  const goToMedal = useCallback((result: ScanResult) => {
    setScanResult(result);
    setScreen(3);
  }, []);

  const reset = useCallback(() => {
    setCaptureData(null);
    setScanResult(null);
    setScreen(0);
  }, []);

  return (
    <div style={{
      background: '#080810',
      minHeight: '100vh',
      fontFamily: "'Space Mono', monospace",
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(200,83,28,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200,83,28,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      {/* Nav dots */}
      <div style={{
        position: 'absolute', top: 80, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', gap: 6, zIndex: 20,
      }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            height: 6,
            width: screen === i ? 20 : 6,
            borderRadius: 3,
            background: screen === i ? '#c8531c' : 'rgba(255,255,255,0.15)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      {/* Screens */}
      {screen === 0 && (
        <ScreenWelcome
          stats={stats}
          onStart={goToGhostFrame}
        />
      )}
      {screen === 1 && captureData && (
        <ScreenGhostFrame
          tier={captureData.tier}
          onCapture={goToScanning}
          onBack={() => setScreen(0)}
        />
      )}
      {screen === 2 && captureData && (
        <ScreenScanning
          captureData={captureData}
          userId={userId}
          onComplete={goToMedal}
          onBack={() => setScreen(1)}
        />
      )}
      {screen === 3 && scanResult && captureData && (
        <ScreenMedal
          result={scanResult}
          captureData={captureData}
          userHandle={userHandle}
          onReset={reset}
        />
      )}
    </div>
  );
}
