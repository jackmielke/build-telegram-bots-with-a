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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AddCustomToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  editingTool?: any;
}

export function AddCustomToolDialog({ 
  open, 
  onOpenChange, 
  communityId,
  editingTool 
}: AddCustomToolDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [httpMethod, setHttpMethod] = useState("POST");
  const [authType, setAuthType] = useState("none");
  const [authValue, setAuthValue] = useState("");
  const [category, setCategory] = useState("");
  const [parameters, setParameters] = useState<any[]>([]);
  const [requestTemplate, setRequestTemplate] = useState("");
  const [responseFormat, setResponseFormat] = useState("auto");
  const [responseTemplate, setResponseTemplate] = useState("");

  // Load editing tool data
  useEffect(() => {
    if (editingTool) {
      setName(editingTool.name || "");
      setDisplayName(editingTool.display_name || "");
      setDescription(editingTool.description || "");
      setEndpointUrl(editingTool.endpoint_url || "");
      setHttpMethod(editingTool.http_method || "POST");
      setAuthType(editingTool.auth_type || "none");
      setAuthValue(editingTool.auth_value || "");
      setCategory(editingTool.category || "");
      
      // Parse parameters
      const params = editingTool.parameters || {};
      const paramArray = Object.entries(params).map(([key, value]: [string, any]) => ({
        name: key,
        type: value.type || "string",
        required: value.required || false,
        description: value.description || ""
      }));
      setParameters(paramArray);
      
      setRequestTemplate(editingTool.request_template ? JSON.stringify(editingTool.request_template, null, 2) : "");
      
      if (editingTool.response_mapping?.format === 'template') {
        setResponseFormat('template');
        setResponseTemplate(editingTool.response_mapping.template || "");
      } else {
        setResponseFormat('auto');
      }
    } else {
      resetForm();
    }
  }, [editingTool]);

  const resetForm = () => {
    setName("");
    setDisplayName("");
    setDescription("");
    setEndpointUrl("");
    setHttpMethod("POST");
    setAuthType("none");
    setAuthValue("");
    setCategory("");
    setParameters([]);
    setRequestTemplate("");
    setResponseFormat("auto");
    setResponseTemplate("");
  };

  const addParameter = () => {
    setParameters([...parameters, { 
      name: "", 
      type: "string", 
      required: false,
      description: ""
    }]);
  };

  const updateParameter = (index: number, field: string, value: any) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Convert parameters array to object format
      const parametersObj = parameters.reduce((acc, param) => {
        if (param.name) {
          acc[param.name] = {
            type: param.type,
            required: param.required,
            description: param.description
          };
        }
        return acc;
      }, {} as any);

      // Parse request template if provided
      let parsedRequestTemplate = null;
      if (requestTemplate.trim()) {
        try {
          parsedRequestTemplate = JSON.parse(requestTemplate);
        } catch (e) {
          throw new Error("Invalid JSON in request template");
        }
      }

      // Build response mapping
      let responseMapping = null;
      if (responseFormat === 'template' && responseTemplate.trim()) {
        responseMapping = {
          format: 'template',
          template: responseTemplate
        };
      }

      const toolData = {
        community_id: communityId,
        name: name.toLowerCase().replace(/\s+/g, '_'),
        display_name: displayName,
        description,
        endpoint_url: endpointUrl,
        http_method: httpMethod,
        auth_type: authType,
        auth_value: authType !== 'none' ? authValue : null,
        category: category || null,
        parameters: parametersObj,
        request_template: parsedRequestTemplate,
        response_mapping: responseMapping,
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
        title: editingTool ? "Tool updated" : "Tool created",
        description: `Custom tool has been ${editingTool ? 'updated' : 'created'} successfully.`
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

  const canSave = name && displayName && description && endpointUrl && 
    (authType === 'none' || authValue) && parameters.every(p => p.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTool ? 'Edit' : 'Add'} Custom Tool</DialogTitle>
          <DialogDescription>
            Connect an external API to give your bot new capabilities
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="api">API Config</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name *</Label>
              <Input
                id="display-name"
                placeholder="Weather Lookup"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (!name || name === displayName.toLowerCase().replace(/\s+/g, '_')) {
                    setName(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Tool Name (for AI) *</Label>
              <Input
                id="name"
                placeholder="weather_lookup"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase, underscores only. Auto-generated from display name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (for AI) *</Label>
              <Textarea
                id="description"
                placeholder="Get current weather conditions for any city. Use when users ask about weather or temperature."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Explain when the AI should use this tool
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weather">Weather</SelectItem>
                  <SelectItem value="data">Data & Analytics</SelectItem>
                  <SelectItem value="communication">Communication</SelectItem>
                  <SelectItem value="media">Media & Images</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint">API Endpoint *</Label>
              <Input
                id="endpoint"
                type="url"
                placeholder="https://api.example.com/v1/endpoint"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">HTTP Method *</Label>
              <Select value={httpMethod} onValueChange={setHttpMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-type">Authentication</Label>
              <Select value={authType} onValueChange={setAuthType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Public API)</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authType !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="auth-value">
                  {authType === 'api_key' ? 'API Key' : 'Bearer Token'} *
                </Label>
                <Input
                  id="auth-value"
                  type="password"
                  placeholder={authType === 'api_key' ? 'your-api-key' : 'your-bearer-token'}
                  value={authValue}
                  onChange={(e) => setAuthValue(e.target.value)}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="parameters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Parameters</CardTitle>
                <CardDescription>
                  Define what information the AI should collect from users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {parameters.map((param, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>Parameter Name *</Label>
                              <Input
                                placeholder="city"
                                value={param.name}
                                onChange={(e) => updateParameter(index, 'name', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Type</Label>
                              <Select 
                                value={param.type} 
                                onValueChange={(v) => updateParameter(index, 'type', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Input
                              placeholder="Name of the city to get weather for"
                              value={param.description}
                              onChange={(e) => updateParameter(index, 'description', e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={param.required}
                              onChange={(e) => updateParameter(index, 'required', e.target.checked)}
                              className="rounded border-input"
                            />
                            <Label>Required</Label>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeParameter(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={addParameter} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Parameter
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request Body Template (Optional)</CardTitle>
                <CardDescription>
                  Transform AI parameters into your API format using {`{{parameter_name}}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={`{\n  "city": "{{city}}",\n  "units": "metric"\n}`}
                  value={requestTemplate}
                  onChange={(e) => setRequestTemplate(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Formatting</CardTitle>
                <CardDescription>
                  How should the API response be presented to users?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={responseFormat} onValueChange={setResponseFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic (Show full JSON)</SelectItem>
                    <SelectItem value="template">Custom Template</SelectItem>
                  </SelectContent>
                </Select>

                {responseFormat === 'template' && (
                  <div className="space-y-2">
                    <Label>Response Template</Label>
                    <Textarea
                      placeholder={`Weather in {{data.city}}:\nTemperature: {{data.temperature}}°C\nConditions: {{data.description}}`}
                      value={responseTemplate}
                      onChange={(e) => setResponseTemplate(e.target.value)}
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {`{{field.name}}`} to insert values from the API response
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : editingTool ? 'Update Tool' : 'Create Tool'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
