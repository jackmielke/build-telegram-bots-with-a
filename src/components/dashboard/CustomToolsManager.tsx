import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Settings, TestTube, AlertCircle, Clock, Trash2, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddCustomToolDialog } from "./custom-tools/AddCustomToolDialog";
import { TestToolDialog } from "./custom-tools/TestToolDialog";
import { ToolLogsDialog } from "./custom-tools/ToolLogsDialog";

export function CustomToolsManager() {
  const { communityId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<any>(null);
  const [testingTool, setTestingTool] = useState<any>(null);
  const [viewingLogs, setViewingLogs] = useState<any>(null);

  // Fetch custom tools
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

  // Toggle tool enabled/disabled
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
      toast({
        title: "Tool updated",
        description: "Tool status has been updated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update tool status.",
        variant: "destructive"
      });
      console.error(error);
    }
  });

  // Delete tool
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
      toast({
        title: "Tool deleted",
        description: "Custom tool has been deleted successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete tool.",
        variant: "destructive"
      });
      console.error(error);
    }
  });

  // Toggle broadcast tool
  const toggleBroadcastMutation = useMutation({
    mutationFn: async (isEnabled: boolean) => {
      const broadcastToolName = 'broadcast_message';
      
      if (isEnabled) {
        // Check if broadcast tool already exists
        const { data: existingTool } = await supabase
          .from('custom_tools')
          .select('id')
          .eq('community_id', communityId)
          .eq('name', broadcastToolName)
          .single();

        if (existingTool) {
          // Just enable it
          const { error } = await supabase
            .from('custom_tools')
            .update({ is_enabled: true })
            .eq('id', existingTool.id);
          if (error) throw error;
        } else {
          // Create new broadcast tool
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
        // Disable the broadcast tool
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
      toast({
        title: "Broadcast tool updated",
        description: "Broadcast messaging has been updated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update broadcast tool.",
        variant: "destructive"
      });
      console.error(error);
    }
  });

  // Check if broadcast tool is enabled
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
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custom Tools</h2>
          <p className="text-muted-foreground">
            Connect external APIs to give your bot new capabilities
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tool
        </Button>
      </div>

      {/* Built-in Tools Section */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Broadcast Messaging</CardTitle>
                <Badge variant="outline" className="bg-primary/10">Built-in</Badge>
              </div>
              <CardDescription>
                Allow the AI agent to send messages to everyone it's had a conversation with. 
                When enabled, the bot can use this tool to notify all previous chat participants.
              </CardDescription>
            </div>
            <Switch
              checked={isBroadcastEnabled}
              onCheckedChange={(checked) => toggleBroadcastMutation.mutate(checked)}
              disabled={toggleBroadcastMutation.isPending}
            />
          </div>
        </CardHeader>
        {isBroadcastEnabled && (
          <CardContent>
            <div className="rounded-lg bg-background/50 p-4 space-y-2">
              <p className="text-sm font-medium">🤖 Agent can now:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Send broadcast messages to all chat participants</li>
                <li>• Only sends to users who opted in to notifications</li>
                <li>• Automatically invoked when the agent needs to notify everyone</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">Your Custom Tools</h3>
        {!customTools || customTools.filter(t => t.name !== 'broadcast_message').length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No custom tools yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              Create your first custom tool to connect external APIs and give your bot new capabilities.
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Tool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {customTools.filter(t => t.name !== 'broadcast_message').map((tool) => (
            <Card key={tool.id} className={!tool.is_enabled ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{tool.display_name}</CardTitle>
                      {tool.category && (
                        <Badge variant="secondary" className="text-xs">
                          {tool.category}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {tool.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={tool.is_enabled}
                      onCheckedChange={(checked) => 
                        toggleToolMutation.mutate({ toolId: tool.id, isEnabled: checked })
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {tool.last_test_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Last used {formatTimeAgo(tool.last_test_at)}</span>
                      </div>
                    )}
                    {tool.error_count > 0 && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{tool.error_count} error{tool.error_count !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {tool.error_count === 0 && tool.last_test_at && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Working
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestingTool(tool)}
                    >
                      <TestTube className="mr-2 h-3 w-3" />
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingLogs(tool)}
                    >
                      View Logs
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTool(tool)}
                    >
                      <Settings className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${tool.display_name}"?`)) {
                          deleteToolMutation.mutate(tool.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>

      <AddCustomToolDialog
        open={addDialogOpen || !!editingTool}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setEditingTool(null);
        }}
        communityId={communityId!}
        editingTool={editingTool}
      />

      {testingTool && (
        <TestToolDialog
          open={!!testingTool}
          onOpenChange={(open) => !open && setTestingTool(null)}
          tool={testingTool}
        />
      )}

      {viewingLogs && (
        <ToolLogsDialog
          open={!!viewingLogs}
          onOpenChange={(open) => !open && setViewingLogs(null)}
          tool={viewingLogs}
        />
      )}
    </div>
  );
}
