export const dynamic = 'force-dynamic'
import { getSettings } from '@/lib/actions/update-setting';
import { getSettingsByCategory } from '@/lib/types/settings.types';
import { SettingsForm } from '@/components/SettingsForm';

export const metadata = {
  title: '16Store Settings | Admin Dashboard',
};

export default async function SettingsPage() {
  // Lấy tất cả settings từ DB, không group
  const settingsList = await getSettings(false);

  // Convert array to Record<key, setting>
  const settingsRecord: Record<string, any> = {};
  (settingsList as any[]).forEach((setting) => {
    settingsRecord[setting.key] = setting;
  });

  // Lấy categories từ definitions
  const categories = Object.keys(getSettingsByCategory()).sort();

  return (
    <div className="space-y-12 bg-ink p-8">
      {/* Header */}
      <div className="border-b border-line pb-8">
        <h1 className="font-display text-4xl text-bone">Settings</h1>
        <p className="mt-2 text-concrete">
          Configure 16Store platform parameters
        </p>
      </div>

      {/* Tabs or Category Sections */}
      <div className="space-y-12">
        {categories.map((category) => (
          <div key={category} className="space-y-4">
            <div className="border-l-4 border-rust pl-4">
              <h2 className="font-mono text-lg uppercase tracking-wider text-hazard">
                {category}
              </h2>
            </div>

            <div className="pl-4">
              <SettingsForm
                initialSettings={settingsRecord}
                category={category}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-16 space-y-3 rounded border border-concrete/30 bg-concrete/5 p-4 text-xs text-concrete">
        <p>
          💡 <strong>Tip:</strong> Tất cả settings được lưu trong{' '}
          <code className="font-mono">system_config</code> table với{' '}
          <code className="font-mono">domain='16store'</code>
        </p>
        <p>
          🔑 <strong>Key Format:</strong> Tất cả keys phải bắt đầu với{' '}
          <code className="font-mono">16store.</code>
        </p>
        <p>
          ⚙️ <strong>Schema:</strong> Mỗi setting có{' '}
          <code className="font-mono">category</code> và{' '}
          <code className="font-mono">description</code> columns
        </p>
      </div>
    </div>
  );
}

