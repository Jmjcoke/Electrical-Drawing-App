import Link from 'next/link';
import { Key, Settings, Shield, Bell, Database } from 'lucide-react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settingsNav = [
    {
      title: 'API Keys',
      href: '/settings/api-keys',
      icon: Key,
      description: 'Configure AI service API keys',
    },
    {
      title: 'General',
      href: '/settings/general',
      icon: Settings,
      description: 'General application settings',
    },
    {
      title: 'Security',
      href: '/settings/security',
      icon: Shield,
      description: 'Security and authentication',
    },
    {
      title: 'Notifications',
      href: '/settings/notifications',
      icon: Bell,
      description: 'Notification preferences',
    },
    {
      title: 'Data & Storage',
      href: '/settings/storage',
      icon: Database,
      description: 'Data retention and storage',
    },
  ];

  return (
    <div className="flex h-full">
      {/* Settings Sidebar */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-6">Settings</h2>
        <nav className="space-y-2">
          {settingsNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block p-3 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <item.icon className="h-5 w-5 text-gray-500 group-hover:text-gray-700" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}