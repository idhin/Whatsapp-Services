import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Send, Webhook, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/chats', icon: MessageSquare, label: 'Chats' },
    { path: '/send', icon: Send, label: 'Send Message' },
    { path: '/webhooks', icon: Webhook, label: 'Webhooks' },
  ];

  return (
    <div 
      className={`bg-white border-r border-slate-200 h-screen fixed left-0 top-0 flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo & Toggle */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">WhatsApp API</h1>
              <p className="text-xs text-slate-500">Dashboard</p>
            </div>
          </div>
        )}
        
        {collapsed && (
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center mx-auto">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-slate-600" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? item.label : ''}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200">
        {!collapsed ? (
          <div className="text-center">
            <p className="text-xs font-medium text-slate-500">WhatsApp Web API</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">v1.0</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xs text-emerald-600 font-bold">v1.0</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
