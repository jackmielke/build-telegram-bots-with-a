import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Sparkles, Pause, XCircle, Plus, Trash2, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  upvotes: number;
  downvotes: number;
}

const statusOptions = [
  { value: 'planned', label: 'Planned', icon: Sparkles, color: 'text-purple-600 dark:text-purple-400' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-600 dark:text-blue-400' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600 dark:text-red-400' },
];

const priorityOptions = ['low', 'medium', 'high', 'critical'];
const categoryOptions = [
  { value: 'foundation', label: 'Foundation' },
  { value: 'user_experience', label: 'User Experience' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'monetization', label: 'Monetization' },
  { value: 'developer_tools', label: 'Developer Tools' },
  { value: 'platform', label: 'Platform' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'marketplace', label: 'Marketplace' },
];

export function InlineEditRoadmapView() {
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [tempValue, setTempValue] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['roadmap-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_roadmap')
        .select('*')
        .order('order_index');
      
      if (error) throw error;
      return data as RoadmapItem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase
        .from('product_roadmap')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-items'] });
      toast.success('Updated successfully');
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('Failed to update');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_roadmap')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-items'] });
      toast.success('Deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete');
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = Math.max(...items.map(i => i.order_index), 0);
      const { error } = await supabase
        .from('product_roadmap')
        .insert({
          title: 'New Feature',
          description: 'Add description...',
          status: 'planned',
          priority: 'medium',
          category: 'foundation',
          estimated_timeline: 'TBD',
          icon: '✨',
          tags: [],
          order_index: maxOrder + 1,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-items'] });
      toast.success('Added new feature');
    },
  });

  const startEdit = (id: string, field: string, currentValue: any) => {
    setEditingField({ id, field });
    setTempValue(typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue));
  };

  const saveEdit = async (id: string, field: string) => {
    let value: any = tempValue;
    
    if (field === 'tags') {
      value = tempValue.split(',').map(t => t.trim()).filter(Boolean);
    }
    
    await updateMutation.mutateAsync({ id, field, value });
    setEditingField(null);
    setTempValue("");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue("");
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  const filteredItems = items.filter(item => {
    if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
    return true;
  });

  const statusCounts = {
    all: items.length,
    completed: items.filter(i => i.status === "completed").length,
    in_progress: items.filter(i => i.status === "in_progress").length,
    planned: items.filter(i => i.status === "planned").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Roadmap Items</h2>
        <Button onClick={() => addMutation.mutate()} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Feature
        </Button>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedStatus === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus("all")}
        >
          All ({statusCounts.all})
        </Button>
        <Button
          variant={selectedStatus === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus("completed")}
          className={cn(selectedStatus === "completed" && "bg-green-600 hover:bg-green-700")}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Completed ({statusCounts.completed})
        </Button>
        <Button
          variant={selectedStatus === "in_progress" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus("in_progress")}
          className={cn(selectedStatus === "in_progress" && "bg-blue-600 hover:bg-blue-700")}
        >
          <Clock className="h-4 w-4 mr-1" />
          In Progress ({statusCounts.in_progress})
        </Button>
        <Button
          variant={selectedStatus === "planned" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedStatus("planned")}
          className={cn(selectedStatus === "planned" && "bg-purple-600 hover:bg-purple-700")}
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Planned ({statusCounts.planned})
        </Button>
      </div>

      <div className="space-y-2">
        {filteredItems.map((item) => {
          const statusConfig = statusOptions.find(s => s.value === item.status);
          const StatusIcon = statusConfig?.icon || Sparkles;

          return (
            <div
              key={item.id}
              className={cn(
                "group relative p-4 rounded-lg border border-border/50 bg-card/50",
                "hover:bg-card hover:border-border hover:shadow-md transition-all duration-200"
              )}
            >
              {/* Delete button - shows on hover */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  if (confirm('Delete this feature?')) {
                    deleteMutation.mutate(item.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>

              <div className="space-y-3 pr-8">
                {/* Title */}
                <div>
                  {editingField?.id === item.id && editingField?.field === 'title' ? (
                    <input
                      autoFocus
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={() => saveEdit(item.id, 'title')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(item.id, 'title');
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="w-full text-xl font-bold bg-background border border-primary rounded px-2 py-1 focus:outline-none"
                    />
                  ) : (
                    <h3
                      onClick={() => startEdit(item.id, 'title', item.title)}
                      className="text-xl font-bold cursor-text hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
                    >
                      {item.title}
                    </h3>
                  )}
                </div>

                {/* Description */}
                <div>
                  {editingField?.id === item.id && editingField?.field === 'description' ? (
                    <textarea
                      autoFocus
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={() => saveEdit(item.id, 'description')}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="w-full bg-background border border-primary rounded px-2 py-1 focus:outline-none min-h-[60px]"
                    />
                  ) : (
                    <p
                      onClick={() => startEdit(item.id, 'description', item.description)}
                      className="text-muted-foreground cursor-text hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
                    >
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Metadata row */}
                <div className="flex flex-wrap gap-3 items-center text-sm">
                  {/* Status */}
                  {editingField?.id === item.id && editingField?.field === 'status' ? (
                    <select
                      autoFocus
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={() => saveEdit(item.id, 'status')}
                      className="bg-background border border-primary rounded px-2 py-1 focus:outline-none"
                    >
                      {statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn("gap-1 cursor-pointer hover:bg-muted", statusConfig?.color)}
                      onClick={() => startEdit(item.id, 'status', item.status)}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig?.label}
                    </Badge>
                  )}

                  {/* Priority */}
                  {editingField?.id === item.id && editingField?.field === 'priority' ? (
                    <select
                      autoFocus
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={() => saveEdit(item.id, 'priority')}
                      className="bg-background border border-primary rounded px-2 py-1 focus:outline-none capitalize"
                    >
                      {priorityOptions.map(opt => (
                        <option key={opt} value={opt} className="capitalize">{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="capitalize cursor-pointer hover:bg-muted"
                      onClick={() => startEdit(item.id, 'priority', item.priority)}
                    >
                      {item.priority}
                    </Badge>
                  )}

                  {/* Timeline */}
                  {editingField?.id === item.id && editingField?.field === 'estimated_timeline' ? (
                    <input
                      autoFocus
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={() => saveEdit(item.id, 'estimated_timeline')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(item.id, 'estimated_timeline');
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="bg-background border border-primary rounded px-2 py-1 focus:outline-none"
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(item.id, 'estimated_timeline', item.estimated_timeline)}
                      className="text-muted-foreground cursor-pointer hover:bg-muted rounded px-2 py-1 transition-colors"
                    >
                      {item.estimated_timeline}
                    </span>
                  )}

                  {/* Upvotes/Downvotes */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-green-100 dark:hover:bg-green-900/20"
                        onClick={() => updateMutation.mutate({ id: item.id, field: 'upvotes', value: item.upvotes + 1 })}
                      >
                        <ThumbsUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </Button>
                      <span className="text-sm font-medium min-w-[20px] text-center">{item.upvotes || 0}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-muted"
                        onClick={() => updateMutation.mutate({ id: item.id, field: 'upvotes', value: Math.max(0, item.upvotes - 1) })}
                      >
                        <span className="text-xs">−</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                        onClick={() => updateMutation.mutate({ id: item.id, field: 'downvotes', value: item.downvotes + 1 })}
                      >
                        <ThumbsDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      </Button>
                      <span className="text-sm font-medium min-w-[20px] text-center">{item.downvotes || 0}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-muted"
                        onClick={() => updateMutation.mutate({ id: item.id, field: 'downvotes', value: Math.max(0, item.downvotes - 1) })}
                      >
                        <span className="text-xs">−</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && items.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No roadmap items match the selected filter.
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No roadmap items yet. Click "Add Feature" to create one.
        </div>
      )}
    </div>
  );
}
