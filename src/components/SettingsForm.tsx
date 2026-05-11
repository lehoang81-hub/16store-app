'use client';

import { useState } from 'react';
import { updateSetting } from '@/lib/actions/update-setting';
import {
  SETTING_DEFINITIONS,
  SettingValueType,
  type SystemConfig,
} from '@/lib/types/settings.types';

interface SettingsFormProps {
  initialSettings: Record<string, SystemConfig>;
  category: string;
}

export function SettingsForm({ initialSettings, category }: SettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const settingsInCategory = Object.entries(initialSettings)
    .map(([_, setting]) => ({ setting, def: SETTING_DEFINITIONS[setting.key] }))
    .filter(
      (item) =>
        item.def && item.def.category === category && (item.setting as any).domain === '16store'
    );

  const handleChange = async (key: string, newValue: string) => {
    try {
      setLoading(true);
      setFeedback(null);

      // Validate
      const def = SETTING_DEFINITIONS[key];
      if (def?.validation && !def.validation(newValue)) {
        setFeedback({
          type: 'error',
          message: `Invalid value for ${def.label}. Check min/max or format.`,
        });
        return;
      }

      // Call server action
      await updateSetting(key, newValue);

      setFeedback({
        type: 'success',
        message: `✓ ${def?.label} updated`,
      });

      // Auto-clear success after 3s
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (settingsInCategory.length === 0) {
    return <p className="text-concrete">No settings in this category yet.</p>;
  }

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          className={`rounded border px-4 py-3 font-mono text-sm ${
            feedback.type === 'success'
              ? 'border-green-700 bg-green-900/20 text-green-200'
              : 'border-red-700 bg-red-900/20 text-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="space-y-6">
        {settingsInCategory.map(({ setting, def }) => (
          <SettingField
            key={setting.key}
            setting={setting}
            definition={def}
            onUpdate={handleChange}
            disabled={loading}
          />
        ))}
      </div>
    </div>
  );
}

interface SettingFieldProps {
  setting: SystemConfig;
  definition?: any;
  onUpdate: (key: string, value: string) => Promise<void>;
  disabled: boolean;
}

function SettingField({
  setting,
  definition,
  onUpdate,
  disabled,
}: SettingFieldProps) {
  const [value, setValue] = useState(setting.value);
  const [isSaving, setIsSaving] = useState(false);

  if (!definition) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(setting.key, value);
    } finally {
      setIsSaving(true);
    }
  };

  const inputProps = {
    disabled: disabled || isSaving,
    className:
      'bg-ink border border-concrete/50 px-3 py-2 rounded font-mono text-sm text-bone focus:outline-none focus:ring-2 focus:ring-rust/50 disabled:opacity-50',
  };

  return (
    <div className="border-b border-line/30 pb-6 last:border-b-0">
      <div className="mb-3">
        <label className="block font-mono text-xs uppercase tracking-wider text-hazard">
          {definition.label}
          {definition.unit && <span className="text-concrete"> ({definition.unit})</span>}
        </label>
        <p className="mt-1 text-xs text-concrete">{definition.description}</p>
      </div>

      <div className="flex items-end gap-3">
        {definition.inputType === 'toggle' ? (
          <button
            onClick={() => {
              const newVal = (value as string) === 'true' ? 'false' : 'true';
              setValue(newVal as any);
              onUpdate(setting.key, newVal);
            }}
            disabled={disabled}
            className={`relative h-8 w-14 rounded-full border transition-colors ${
              value === 'true'
                ? 'border-rust bg-rust/20'
                : 'border-concrete/50 bg-concrete/10'
            } disabled:opacity-50`}
          >
            <div
              className={`absolute top-1 h-6 w-6 rounded-full bg-bone transition-transform ${
                value === 'true' ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        ) : definition.inputType === 'number' ? (
          <>
            <input
              {...inputProps}
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min={definition.min}
              max={definition.max}
              step={definition.valueType === 'percentage' ? '0.1' : '1'}
            />
            <button
              onClick={handleSave}
              disabled={disabled || isSaving || value === setting.value}
              className="rounded border border-rust px-4 py-2 font-mono text-sm uppercase text-rust transition-colors hover:bg-rust/10 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <input
              {...inputProps}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <button
              onClick={handleSave}
              disabled={disabled || isSaving || value === setting.value}
              className="rounded border border-rust px-4 py-2 font-mono text-sm uppercase text-rust transition-colors hover:bg-rust/10 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>

      <div className="mt-2 text-xs text-concrete/70">
        Key: <code className="font-mono">{setting.key}</code>
      </div>
    </div>
  );
}
