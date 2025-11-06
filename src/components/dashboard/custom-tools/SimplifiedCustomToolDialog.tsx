import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SimplifiedCustomToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  editingTool?: any;
}

export function SimplifiedCustomToolDialog({ 
  open, 
  onOpenChange, 
  communityId,
  editingTool 
}: SimplifiedCustomToolDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [toolName, setToolName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [parameters, setParameters] = useState<Array<{ name: string; description: string }>>([]);

  useEffect(() => {
    if (editingTool) {
      setToolName(editingTool.display_name || "");
      setApiUrl(editingTool.endpoint_url || "");
      setAuthToken(editingTool.auth_value || "");
      
      const params = editingTool.parameters || {};
      const paramArray = Object.entries(params).map(([key, value]: [string, any]) => ({
        name: key,
        description: value.description || ""
      }));
      setParameters(paramArray);
    } else {
      resetForm();
    }
  }, [editingTool, open]);

  const resetForm = () => {
    setToolName("");
    setApiUrl("");
    setAuthToken("");
    setParameters([]);
  };

  const addParameter = () => {
    setParameters([...parameters, { name: "", description: "" }]);
  };

  const updateParameter = (index: number, field: string, value: string) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parametersObj = parameters.reduce((acc, param) => {
        if (param.name) {
          acc[param.name] = {
            type: "string",
            required: true,
            description: param.description
          };
        }
        return acc;
      }, {} as any);

      // Build request template from parameters
      const requestTemplate = parameters.reduce((acc, param) => {
        if (param.name) {
          acc[param.name] = `{{${param.name}}}`;
        }
        return acc;
      }, {} as any);

      const toolData = {
        community_id: communityId,
        name: toolName.toLowerCase().replace(/\s+/g, '_'),
        display_name: toolName,
        description: `Call ${toolName} API with provided parameters`,
        endpoint_url: apiUrl,
        http_method: "POST",
        auth_type: authToken ? "bearer" : "none",
        auth_value: authToken || null,
        category: "custom",
        parameters: parametersObj,
        request_template: Object.keys(requestTemplate).length > 0 ? requestTemplate : null,
        response_mapping: null,
        is_enabled: true
      };

      if (editingTool) {
        const { error } = await supabase
          .from('custom_tools')
          .update(toolData)
          .eq('id', editingTool.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_tools')
          .insert(toolData);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-tools', communityId] });
      toast({
        title: editingTool ? "Tool updated" : "Tool added",
        description: `${toolName} is now available to your bot.`
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save tool.",
        variant: "destructive"
      });
      console.error(error);
    }
  });

  const canSave = toolName && apiUrl && parameters.every(p => p.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTool ? 'Edit' : 'Add'} Custom Tool</DialogTitle>
          <DialogDescription>
            Connect an external API in 3 simple steps
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-blue-50 border-blue-200">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>Pro Tip:</strong> Ask your AI builder: "I want to connect [API name] to my bot. Give me:
            1) The API endpoint URL, 2) The auth token/API key, 3) All required parameters with descriptions"
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* Step 1: Tool Name */}
          <div className="space-y-2">
            <Label htmlFor="tool-name" className="text-base font-semibold">
              1. Tool Name
            </Label>
            <Input
              id="tool-name"
              placeholder="e.g., Weather Lookup, Stripe Payment, Send Email"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              What should your bot call this tool?
            </p>
          </div>

          {/* Step 2: API Details */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">2. API Details</Label>
            
            <div className="space-y-2">
              <Label htmlFor="api-url">API Endpoint URL *</Label>
              <Input
                id="api-url"
                type="url"
                placeholder="https://api.example.com/v1/action"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-token">Auth Token / API Key (optional)</Label>
              <Input
                id="auth-token"
                type="password"
                placeholder="Paste your API key or bearer token here"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank if the API doesn't require authentication
              </p>
            </div>
          </div>

          {/* Step 3: Parameters */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">3. Parameters</Label>
            <p className="text-sm text-muted-foreground">
              What information does the API need from users?
            </p>

            <div className="space-y-2">
              {parameters.map((param, index) => (
                <Card key={index} className="bg-muted/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Parameter name (e.g., city, amount, email)"
                          value={param.name}
                          onChange={(e) => updateParameter(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="What is this for? (e.g., The city to get weather for)"
                          value={param.description}
                          onChange={(e) => updateParameter(index, 'description', e.target.value)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParameter(index)}
                        className="mt-1"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button 
                variant="outline" 
                onClick={addParameter} 
                className="w-full"
                type="button"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Parameter
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : (editingTool ? "Update Tool" : "Add Tool")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
