import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, GripVertical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
];

const priorityOptions = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const categoryOptions = [
  { value: "foundation", label: "Foundation" },
  { value: "user_experience", label: "User Experience" },
  { value: "integrations", label: "Integrations" },
  { value: "monetization", label: "Monetization" },
  { value: "developer_tools", label: "Developer Tools" },
  { value: "platform", label: "Platform" },
  { value: "analytics", label: "Analytics" },
  { value: "marketplace", label: "Marketplace" },
];

export function RoadmapManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "planned",
    priority: "medium",
    category: "foundation",
    estimated_timeline: "",
    icon: "✨",
    tags: "",
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("product_roadmap")
        .select("*")
        .order("order_index");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching roadmap:", error);
      toast({
        title: "Error",
        description: "Failed to load roadmap items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tagsArray = formData.tags.split(",").map(t => t.trim()).filter(Boolean);
      
      const payload = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        category: formData.category,
        estimated_timeline: formData.estimated_timeline || null,
        icon: formData.icon,
        tags: tagsArray,
        order_index: editingItem ? editingItem.order_index : items.length,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("product_roadmap")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Roadmap item updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("product_roadmap")
          .insert([payload]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Roadmap item created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error: any) {
      console.error("Error saving roadmap item:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save roadmap item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: RoadmapItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description,
      status: item.status,
      priority: item.priority,
      category: item.category,
      estimated_timeline: item.estimated_timeline || "",
      icon: item.icon,
      tags: item.tags.join(", "),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this roadmap item?")) return;

    try {
      const { error } = await supabase
        .from("product_roadmap")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Roadmap item deleted successfully",
      });

      fetchItems();
    } catch (error: any) {
      console.error("Error deleting roadmap item:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete roadmap item",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      description: "",
      status: "planned",
      priority: "medium",
      category: "foundation",
      estimated_timeline: "",
      icon: "✨",
      tags: "",
    });
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Roadmap Manager</h2>
          <p className="text-muted-foreground">
            Manage product roadmap features and timelines
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Feature
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Feature" : "Add New Feature"}
              </DialogTitle>
              <DialogDescription>
                {editingItem 
                  ? "Update the details of this roadmap feature"
                  : "Create a new feature for the product roadmap"
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (Emoji)</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="✨"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeline">Timeline</Label>
                  <Input
                    id="timeline"
                    value={formData.estimated_timeline}
                    onChange={(e) => setFormData({ ...formData, estimated_timeline: e.target.value })}
                    placeholder="Q1 2025"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Feature name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of the feature..."
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="feature, beta, important"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {editingItem ? "Update" : "Create"} Feature
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex items-center gap-2 cursor-grab">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl">{item.icon}</span>
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{item.status}</Badge>
                  <Badge variant="outline">{item.priority}</Badge>
                  <Badge variant="outline">{item.category}</Badge>
                  {item.estimated_timeline && (
                    <Badge variant="secondary">{item.estimated_timeline}</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
