import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Settings, TestTube, Clock, Trash2, Zap, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SimplifiedCustomToolDialog } from "./SimplifiedCustomToolDialog";
import { TestToolDialog } from "./TestToolDialog";

interface CustomToolsToggleViewProps {
  communityId: string;
  isAdmin: boolean;
}

export function CustomToolsToggleView({ communityId, isAdmin }: CustomToolsToggleViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<any>(null);
  const [testingTool, setTestingTool] = useState<any>(null);

  const { data: customTools, isLoading } = useQuery({
    queryKey: ['custom-tools', communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_tools')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!communityId
  });

  const toggleToolMutation = useMutation({
    mutationFn: async ({ toolId, isEnabled }: { toolId: string; isEnabled: boolean }) => {
      const { error } = await supabase
        .from('custom_tools')
        .update({ is_enabled: isEnabled })
        .eq('id', toolId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-tools', communityId] });
      toast({ title: "Tool updated" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update tool.",
        variant: "destructive"
      });
    }
  });

  const deleteToolMutation = useMutation({
    mutationFn: async (toolId: string) => {
      const { error } = await supabase
        .from('custom_tools')
        .delete()
        .eq('id', toolId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-tools', communityId] });
      toast({ title: "Tool deleted" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete tool.",
        variant: "destructive"
      });
    }
  });

  const toggleBroadcastMutation = useMutation({
    mutationFn: async (isEnabled: boolean) => {
      const broadcastToolName = 'broadcast_message';
      
      if (isEnabled) {
        const { data: existingTool } = await supabase
          .from('custom_tools')
          .select('id')
          .eq('community_id', communityId)
          .eq('name', broadcastToolName)
          .single();

        if (existingTool) {
          const { error } = await supabase
            .from('custom_tools')
            .update({ is_enabled: true })
            .eq('id', existingTool.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('custom_tools')
            .insert({
              community_id: communityId,
              name: broadcastToolName,
              display_name: 'Broadcast Message',
              description: 'Send a message to all users who have had a conversation with the bot',
              category: 'Communication',
              endpoint_url: 'https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-broadcast',
              http_method: 'POST',
              auth_type: 'bearer',
              auth_value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM',
              is_enabled: true,
              parameters: {
                message: {
                  type: 'string',
                  description: 'The message to broadcast to all users',
                  required: true
                },
                include_opted_out: {
                  type: 'boolean',
                  description: 'Include users who opted out of notifications (default: false)',
                  required: false
                }
              },
              request_template: {
                community_id: communityId,
                message: '{{message}}',
                filter: {
                  include_opted_out: '{{include_opted_out}}'
                }
              }
            });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('custom_tools')
          .update({ is_enabled: false })
          .eq('community_id', communityId)
          .eq('name', broadcastToolName);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-tools', communityId] });
      toast({ title: "Broadcast tool updated" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update broadcast tool.",
        variant: "destructive"
      });
    }
  });

  const broadcastTool = customTools?.find(t => t.name === 'broadcast_message');
  const isBroadcastEnabled = broadcastTool?.is_enabled || false;

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Custom Tools ({customTools?.filter(t => t.name !== 'broadcast_message').length || 0})
          </p>
          <p className="text-xs text-muted-foreground">
            External APIs your bot can use
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          disabled={!isAdmin}
        >
          <Plus className="mr-2 h-3 w-3" />
          Add Tool
        </Button>
      </div>

      {!customTools || customTools.filter(t => t.name !== 'broadcast_message').length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="py-8 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              No custom tools connected yet
            </p>
            <Button 
              size="sm" 
              onClick={() => setAddDialogOpen(true)}
              disabled={!isAdmin}
            >
              <Plus className="mr-2 h-3 w-3" />
              Add Your First Tool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {customTools.filter(t => t.name !== 'broadcast_message').map((tool) => (
            <Card key={tool.id} className={!tool.is_enabled ? 'opacity-60' : ''}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-sm font-medium truncate">
                        {tool.display_name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {Object.keys(tool.parameters || {}).length} params
                      </Badge>
                    </div>
                    {tool.last_test_at && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Used {formatTimeAgo(tool.last_test_at)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTestingTool(tool)}
                      disabled={!isAdmin}
                      className="h-7 px-2"
                    >
                      <TestTube className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTool(tool)}
                      disabled={!isAdmin}
                      className="h-7 px-2"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete "${tool.display_name}"?`)) {
                          deleteToolMutation.mutate(tool.id);
                        }
                      }}
                      disabled={!isAdmin}
                      className="h-7 px-2"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                    <Switch
                      checked={tool.is_enabled}
                      onCheckedChange={(checked) => 
                        toggleToolMutation.mutate({ toolId: tool.id, isEnabled: checked })
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <SimplifiedCustomToolDialog
        open={addDialogOpen || !!editingTool}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setEditingTool(null);
        }}
        communityId={communityId}
        editingTool={editingTool}
      />

      {testingTool && (
        <TestToolDialog
          open={!!testingTool}
          onOpenChange={(open) => !open && setTestingTool(null)}
          tool={testingTool}
        />
      )}
    </div>
  );
}
