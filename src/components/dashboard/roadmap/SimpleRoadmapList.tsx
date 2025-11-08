import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  order_index: number;
}

export const SimpleRoadmapList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<RoadmapItem>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<RoadmapItem>>({
    title: "",
    description: "",
    status: "planned",
    priority: "medium",
    category: "feature",
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ['roadmap-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_roadmap')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as RoadmapItem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RoadmapItem> }) => {
      const { error } = await supabase
        .from('product_roadmap')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-simple'] });
      queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      setEditingId(null);
      setEditData({});
      toast({ title: "Updated!" });
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
      queryClient.invalidateQueries({ queryKey: ['roadmap-simple'] });
      queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      toast({ title: "Deleted!" });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (item: Partial<RoadmapItem>) => {
      const { error } = await supabase
        .from('product_roadmap')
        .insert({
          title: item.title!,
          description: item.description!,
          status: item.status,
          priority: item.priority!,
          category: item.category!,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-simple'] });
      queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      setIsAdding(false);
      setNewItem({
        title: "",
        description: "",
        status: "planned",
        priority: "medium",
        category: "feature",
      });
      toast({ title: "Added!" });
    },
  });

  const startEdit = (item: RoadmapItem) => {
    setEditingId(item.id);
    setEditData(item);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = () => {
    if (editingId && editData.title && editData.description) {
      updateMutation.mutate({ id: editingId, updates: editData });
    }
  };

  const addItem = () => {
    if (newItem.title && newItem.description) {
      addMutation.mutate(newItem);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add New Item */}
      {!isAdding ? (
        <Button onClick={() => setIsAdding(true)} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      ) : (
        <Card className="border-2 border-primary">
          <CardContent className="pt-6 space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="Title"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              />
              <Textarea
                placeholder="Description"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                rows={2}
              />
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={newItem.status}
                  onValueChange={(value) => setNewItem({ ...newItem, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={newItem.priority}
                  onValueChange={(value) => setNewItem({ ...newItem, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={newItem.category}
                  onValueChange={(value) => setNewItem({ ...newItem, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="bug-fix">Bug Fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addItem} size="sm" disabled={!newItem.title || !newItem.description}>
                <Check className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button onClick={() => setIsAdding(false)} variant="outline" size="sm">
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List Items */}
      <div className="space-y-2">
        {items?.map((item, index) => (
          <Card key={item.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Input
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    />
                    <Textarea
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={2}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={editData.status}
                        onValueChange={(value) => setEditData({ ...editData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={editData.priority}
                        onValueChange={(value) => setEditData({ ...editData, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={editData.category}
                        onValueChange={(value) => setEditData({ ...editData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="feature">Feature</SelectItem>
                          <SelectItem value="improvement">Improvement</SelectItem>
                          <SelectItem value="bug-fix">Bug Fix</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveEdit} size="sm" disabled={!editData.title || !editData.description}>
                      <Check className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button onClick={cancelEdit} variant="outline" size="sm">
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground">#{index + 1}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {item.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary">
                          {item.priority}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {item.category}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this item?')) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};