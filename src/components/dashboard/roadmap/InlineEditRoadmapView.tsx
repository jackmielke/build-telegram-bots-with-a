import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Sparkles, Pause, XCircle, Plus, Trash2 } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Roadmap Items</h2>
        <Button onClick={() => addMutation.mutate()} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Feature
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
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

                  {/* Category */}
                  {editingField?.id === item.id && editingField?.field === 'category' ? (
                    <select
                      autoFocus
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={() => saveEdit(item.id, 'category')}
                      className="bg-background border border-primary rounded px-2 py-1 focus:outline-none"
                    >
                      {categoryOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => startEdit(item.id, 'category', item.category)}
                    >
                      {categoryOptions.find(c => c.value === item.category)?.label}
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
                </div>

                {/* Tags */}
                <div>
                  {editingField?.id === item.id && editingField?.field === 'tags' ? (
                    <input
                      autoFocus
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={() => saveEdit(item.id, 'tags')}
                      placeholder="tag1, tag2, tag3"
                      className="w-full bg-background border border-primary rounded px-2 py-1 focus:outline-none text-sm"
                    />
                  ) : (
                    <div
                      onClick={() => startEdit(item.id, 'tags', item.tags?.join(', ') || '')}
                      className="flex flex-wrap gap-1 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors min-h-[32px]"
                    >
                      {item.tags && item.tags.length > 0 ? (
                        item.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Add tags...</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No roadmap items yet. Click "Add Feature" to create one.
        </div>
      )}
    </div>
  );
}
