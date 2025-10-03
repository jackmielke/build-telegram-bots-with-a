import React from 'react';
import { Activity, Brain, Users, Zap, BarChart3, Settings, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import vibeLogo from '@/assets/vibe-logo.png';

const Dashboard = () => {
  const stats = [
    {
      title: 'Active Agents',
      value: '12',
      change: '+2 this week',
      icon: null,
      color: 'text-primary',
      isLogo: true
    },
    {
      title: 'Communities',
      value: '5',
      change: '+1 this month',
      icon: Users,
      color: 'text-accent-foreground'
    },
    {
      title: 'Messages',
      value: '2,847',
      change: '+18% from last week',
      icon: MessageSquare,
      color: 'text-primary'
    },
    {
      title: 'AI Cost',
      value: '$47.32',
      change: 'This month',
      icon: BarChart3,
      color: 'text-muted-foreground'
    }
  ];

  const recentActivities = [
    { id: 1, agent: 'Customer Support Bot', action: 'Handled 45 queries', time: '2 hours ago' },
    { id: 2, agent: 'Content Moderator', action: 'Reviewed 23 posts', time: '4 hours ago' },
    { id: 3, agent: 'Community Helper', action: 'Welcomed 8 new members', time: '6 hours ago' },
    { id: 4, agent: 'Task Automator', action: 'Processed 156 workflows', time: '8 hours ago' }
  ];

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold gradient-primary bg-clip-text text-transparent">
            Agent Command Center
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your AI agents and communities from one powerful dashboard
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="lg">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
          <Button variant="hero" size="lg">
            <img src={vibeLogo} alt="Vibe AI" className="w-5 h-5 object-contain rounded" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="gradient-card border-border/50 shadow-card animate-smooth hover:shadow-elevated hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              {stat.isLogo ? (
                <img src={vibeLogo} alt="Vibe AI" className="h-6 w-6 object-contain rounded" />
              ) : (
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Actions */}
        <Card className="gradient-card border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Common tasks and workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="tech" className="w-full justify-start">
              <img src={vibeLogo} alt="Vibe AI" className="w-5 h-5 object-contain rounded" />
              Deploy New Agent
            </Button>
            <Button variant="tech" className="w-full justify-start">
              <Users className="w-4 h-4" />
              Manage Communities
            </Button>
            <Button variant="tech" className="w-full justify-start">
              <Activity className="w-4 h-4" />
              View Analytics
            </Button>
            <Button variant="tech" className="w-full justify-start">
              <MessageSquare className="w-4 h-4" />
              Message Logs
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2 gradient-card border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest actions from your AI agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full shadow-glow"></div>
                    <div>
                      <p className="font-medium text-foreground">{activity.agent}</p>
                      <p className="text-sm text-muted-foreground">{activity.action}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Your Agents</h2>
          <Button variant="outline">View All</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[
            { name: 'Customer Support', status: 'Active', messages: 1247, cost: '$12.34' },
            { name: 'Content Moderator', status: 'Active', messages: 892, cost: '$8.91' },
            { name: 'Community Helper', status: 'Paused', messages: 445, cost: '$4.55' },
          ].map((agent, index) => (
            <Card key={index} className="gradient-card border-border/50 shadow-card animate-smooth hover:shadow-elevated hover:scale-[1.02]">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${agent.status === 'Active' ? 'bg-primary shadow-glow' : 'bg-muted-foreground'}`}></div>
                      <span className="text-sm text-muted-foreground">{agent.status}</span>
                    </div>
                  </div>
                  <img src={vibeLogo} alt="Vibe AI" className="w-10 h-10 object-contain rounded-lg" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Messages</span>
                    <span className="text-foreground font-medium">{agent.messages}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="text-foreground font-medium">{agent.cost}</span>
                  </div>
                </div>
                <Button variant="tech" className="w-full mt-4">
                  Configure
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;