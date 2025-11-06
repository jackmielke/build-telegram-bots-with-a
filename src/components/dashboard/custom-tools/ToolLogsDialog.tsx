import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface ToolLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: any;
}

export function ToolLogsDialog({ open, onOpenChange, tool }: ToolLogsDialogProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['custom-tool-logs', tool.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_tool_logs')
        .select('*')
        .eq('tool_id', tool.id)
        .order('executed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tool.display_name} - Execution History</DialogTitle>
          <DialogDescription>
            Last 50 executions of this tool
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !logs || logs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No execution logs yet
              </CardContent>
            </Card>
          ) : (
            logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {log.error_message ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        <span className="text-sm font-medium">
                          {log.error_message ? 'Failed' : 'Success'}
                        </span>
                        {log.status_code && (
                          <Badge variant={log.status_code < 400 ? 'default' : 'destructive'}>
                            {log.status_code}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(log.executed_at)}
                        </div>
                      </div>

                      {log.message_context && (
                        <p className="text-sm text-muted-foreground">
                          Context: {log.message_context}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium mb-1">Input:</p>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.input_data, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="font-medium mb-1">
                            {log.error_message ? 'Error:' : 'Output:'}
                          </p>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                            {log.error_message || JSON.stringify(log.output_data, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {log.execution_time_ms && (
                        <p className="text-xs text-muted-foreground">
                          Execution time: {log.execution_time_ms}ms
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
