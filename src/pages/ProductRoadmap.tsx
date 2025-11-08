import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import { Sparkles, CheckCircle2, Clock, Pause, XCircle, ChevronRight, Settings, List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { RoadmapManager } from "@/components/dashboard/RoadmapManager";
import { SimpleRoadmapList } from "@/components/dashboard/roadmap/SimpleRoadmapList";

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  estimated_timeline: string;
  icon: string;
  tags: string[];
  order_index: number;
}

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
    label: "Completed"
  },
  in_progress: {
    icon: Clock,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    label: "In Progress"
  },
  planned: {
    icon: Sparkles,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    label: "Planned"
  },
  on_hold: {
    icon: Pause,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    label: "On Hold"
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    label: "Cancelled"
  }
};

const priorityColors = {
  critical: "border-red-500/40 shadow-red-500/20",
  high: "border-orange-500/40 shadow-orange-500/20",
  medium: "border-blue-500/40 shadow-blue-500/20",
  low: "border-gray-500/40 shadow-gray-500/20"
};

const categoryLabels = {
  foundation: "Foundation",
  user_experience: "User Experience",
  integrations: "Integrations",
  monetization: "Monetization",
  developer_tools: "Developer Tools",
  platform: "Platform",
  analytics: "Analytics",
  marketplace: "Marketplace"
};

export default function ProductRoadmap() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchRoadmap();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    setIsAdmin(data?.role === 'admin');
  };

  const fetchRoadmap = async () => {
    try {
      const { data, error } = await supabase
        .from("product_roadmap")
        .select("*")
        .order("order_index");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching roadmap:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    return true;
  });

  const statusCounts = {
    all: items.length,
    completed: items.filter(i => i.status === "completed").length,
    in_progress: items.filter(i => i.status === "in_progress").length,
    planned: items.filter(i => i.status === "planned").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-muted-foreground">Loading roadmap...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="flex items-center justify-center gap-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Product Roadmap
              </div>
              <div className="flex items-center gap-1 border rounded-lg p-1 bg-background">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              {isAdmin && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <RoadmapManager />
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
              Building the Future
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our vision for Vibe AI—transforming how communities connect, automate, and grow through intelligent bot orchestration.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Bar - Only show in grid mode */}
      {viewMode === "grid" && (
        <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center gap-8 py-4 overflow-x-auto">
              <StatusButton
                label="All Features"
                count={statusCounts.all}
                active={selectedStatus === "all"}
                onClick={() => setSelectedStatus("all")}
              />
              <StatusButton
                label="Completed"
                count={statusCounts.completed}
                active={selectedStatus === "completed"}
                onClick={() => setSelectedStatus("completed")}
                className="text-green-600 dark:text-green-400"
              />
              <StatusButton
                label="In Progress"
                count={statusCounts.in_progress}
                active={selectedStatus === "in_progress"}
                onClick={() => setSelectedStatus("in_progress")}
                className="text-blue-600 dark:text-blue-400"
              />
              <StatusButton
                label="Planned"
                count={statusCounts.planned}
                active={selectedStatus === "planned"}
                onClick={() => setSelectedStatus("planned")}
                className="text-purple-600 dark:text-purple-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-8">
        {viewMode === "list" ? (
          <div className="max-w-4xl mx-auto">
            <SimpleRoadmapList />
          </div>
        ) : (
          <>
            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 justify-center mb-12">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
              >
                All Categories
              </Button>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <Button
                  key={key}
                  variant={selectedCategory === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(key)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Roadmap Grid */}
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => (
                  <RoadmapCard key={item.id} item={item} />
                ))}
              </div>

              {filteredItems.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground text-lg">
                    No features match your filters
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusButton({ 
  label, 
  count, 
  active, 
  onClick, 
  className 
}: { 
  label: string; 
  count: number; 
  active: boolean; 
  onClick: () => void; 
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
        active 
          ? "bg-primary text-primary-foreground shadow-lg" 
          : "hover:bg-muted",
        className
      )}
    >
      <span className="font-semibold">{count}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const statusStyle = statusConfig[item.status as keyof typeof statusConfig];
  const StatusIcon = statusStyle.icon;
  const priorityColor = priorityColors[item.priority as keyof typeof priorityColors];

  return (
    <Card 
      className={cn(
        "p-6 hover:shadow-xl transition-all duration-300 border-2",
        statusStyle.bgColor,
        priorityColor
      )}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <Badge variant="outline" className={cn("gap-1", statusStyle.color)}>
            <StatusIcon className="h-3 w-3" />
            {statusStyle.label}
          </Badge>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-lg font-bold leading-tight">{item.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {item.description}
          </p>
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge 
                key={tag} 
                variant="secondary" 
                className="text-xs"
              >
                {tag}
              </Badge>
            ))}
            {item.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{item.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Category */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {categoryLabels[item.category as keyof typeof categoryLabels]}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Card>
  );
}
