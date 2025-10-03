import React from 'react';
import { Brain, Home, Settings, Users, BarChart3, Workflow, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import vibeLogo from '@/assets/vibe-logo.png';

const Navbar = () => {
  const navItems = [
    { icon: Home, label: 'Dashboard', active: true },
    { icon: Brain, label: 'Agents', active: false },
    { icon: Users, label: 'Communities', active: false },
    { icon: Workflow, label: 'Workflows', active: false },
    { icon: MessageSquare, label: 'Messages', active: false },
    { icon: BarChart3, label: 'Analytics', active: false },
    { icon: Settings, label: 'Settings', active: false },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl glass-effect">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={vibeLogo} alt="Vibe AI" className="w-10 h-10 object-contain rounded-lg" />
            <span className="text-xl font-bold text-foreground">Vibe AI</span>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item, index) => (
              <Button
                key={index}
                variant={item.active ? "default" : "ghost"}
                size="sm"
                className={`gap-2 ${item.active ? 'shadow-glow' : ''}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-primary border-2 border-primary/20"></div>
            <span className="text-sm font-medium text-foreground hidden sm:block">Admin</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;