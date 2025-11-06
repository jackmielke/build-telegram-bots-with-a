import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TestToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: any;
}

export function TestToolDialog({ open, onOpenChange, tool }: TestToolDialogProps) {
  const { toast } = useToast();
  const [testData, setTestData] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<any>(null);

  // Extract parameters from tool
  const parameters = Object.entries(tool.parameters || {}).map(([key, value]: [string, any]) => ({
    name: key,
    type: value.type,
    required: value.required,
    description: value.description
  }));

  const testMutation = useMutation({
    mutationFn: async () => {
      // Transform test data using request template
      let requestBody = testData;
      if (tool.request_template) {
        requestBody = JSON.parse(JSON.stringify(tool.request_template));
        Object.keys(testData).forEach(key => {
          let jsonStr = JSON.stringify(requestBody);
          // Use replace with global regex instead of replaceAll for compatibility
          jsonStr = jsonStr.replace(new RegExp(`{{${key}}}`, 'g'), testData[key]);
          requestBody = JSON.parse(jsonStr);
        });
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (tool.auth_type === 'api_key' && tool.auth_value) {
        headers['X-API-Key'] = tool.auth_value;
      } else if (tool.auth_type === 'bearer' && tool.auth_value) {
        headers['Authorization'] = `Bearer ${tool.auth_value}`;
      }

      // Make request
      const response = await fetch(tool.endpoint_url, {
        method: tool.http_method || 'POST',
        headers,
        body: tool.http_method !== 'GET' ? JSON.stringify(requestBody) : undefined
      });

      const data = await response.json();

      return {
        success: response.ok,
        status: response.status,
        data
      };
    },
    onSuccess: (result) => {
      setTestResult(result);
      
      // Update tool test results
      supabase
        .from('custom_tools')
        .update({
          last_test_at: new Date().toISOString(),
          last_test_result: result.data,
          error_count: result.success ? 0 : (tool.error_count + 1),
          last_error: result.success ? null : `${result.status}: ${JSON.stringify(result.data)}`
        })
        .eq('id', tool.id)
        .then(() => {
          toast({
            title: result.success ? "Test successful" : "Test failed",
            description: result.success 
              ? "Tool is working correctly" 
              : `API returned status ${result.status}`,
            variant: result.success ? "default" : "destructive"
          });
        });
    },
    onError: (error: any) => {
      setTestResult({
        success: false,
        error: error.message
      });
      toast({
        title: "Test failed",
        description: error.message || "Failed to test tool",
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test {tool.display_name}</DialogTitle>
          <DialogDescription>
            Test your API integration with sample data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-medium">Test Parameters</h4>
            {parameters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No parameters defined for this tool
              </p>
            ) : (
              parameters.map((param) => (
                <div key={param.name} className="space-y-2">
                  <Label htmlFor={param.name}>
                    {param.name}
                    {param.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id={param.name}
                    type={param.type === 'number' ? 'number' : 'text'}
                    placeholder={param.description || `Enter ${param.name}`}
                    value={testData[param.name] || ''}
                    onChange={(e) => setTestData({
                      ...testData,
                      [param.name]: param.type === 'number' ? Number(e.target.value) : e.target.value
                    })}
                  />
                  {param.description && (
                    <p className="text-xs text-muted-foreground">{param.description}</p>
                  )}
                </div>
              ))
            )}
          </div>

          <Button 
            onClick={() => testMutation.mutate()} 
            disabled={testMutation.isPending}
            className="w-full"
          >
            {testMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test API Call'
            )}
          </Button>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <AlertDescription>
                    {testResult.success ? (
                      <div>
                        <p className="font-medium mb-2">Success! Status: {testResult.status}</p>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium mb-2">
                          Failed: {testResult.status ? `Status ${testResult.status}` : 'Network Error'}
                        </p>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                          {testResult.error || JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
