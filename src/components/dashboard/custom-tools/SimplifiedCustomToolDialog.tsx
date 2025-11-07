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
import { Plus, X, Lightbulb, Sparkles, Copy, Check, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Dream Flow State
  const [currentTab, setCurrentTab] = useState<'dream' | 'manual'>('dream');
  const [toolDescription, setToolDescription] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  // Manual Entry State
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
    setToolDescription("");
    setGeneratedPrompt("");
    setPromptCopied(false);
    setToolName("");
    setApiUrl("");
    setAuthToken("");
    setParameters([]);
    setCurrentTab('dream');
  };

  const generatePrompt = async () => {
    if (!toolDescription.trim()) {
      toast({
        title: "Description required",
        description: "Please describe what you want this tool to do.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-tool-prompt', {
        body: { toolDescription }
      });

      if (error) throw error;

      if (data.generatedPrompt) {
        setGeneratedPrompt(data.generatedPrompt);
        
        // Auto-fill suggested details if available
        if (data.suggestedDetails) {
          setToolName(data.suggestedDetails.suggested_name || "");
          if (data.suggestedDetails.suggested_parameters) {
            setParameters(data.suggestedDetails.suggested_parameters);
          }
        }

        toast({
          title: "Prompt generated! ✨",
          description: "Copy this prompt and use it to build your API anywhere."
        });
      }
    } catch (error: any) {
      console.error('Error generating prompt:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate API prompt. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setPromptCopied(true);
    toast({
      title: "Copied!",
      description: "Paste this prompt into any AI assistant or app builder."
    });
    setTimeout(() => setPromptCopied(false), 2000);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingTool ? 'Edit' : 'Add'} Custom Tool
            {!editingTool && <Sparkles className="h-5 w-5 text-primary" />}
          </DialogTitle>
          <DialogDescription>
            {editingTool 
              ? 'Update your custom tool configuration'
              : 'Use AI to generate API specs or enter details manually'
            }
          </DialogDescription>
        </DialogHeader>

        {!editingTool && (
          <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as 'dream' | 'manual')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dream" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Dream Flow (AI)
              </TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>

            <TabsContent value="dream" className="space-y-4 mt-4">
              {/* Step 1: Describe what you want */}
              {!generatedPrompt && (
                <div className="space-y-3">
                  <Alert className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <strong>Dream Flow:</strong> Just describe what you want your tool to do, and AI will generate a complete prompt you can use anywhere to build it!
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="tool-description">What should this tool do?</Label>
                    <Textarea
                      id="tool-description"
                      placeholder="Example: Send an SMS to a phone number using Twilio, or Get the current weather for any city, or Create a new customer in Stripe..."
                      value={toolDescription}
                      onChange={(e) => setToolDescription(e.target.value)}
                      className="min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Be specific about what the tool should do and what information it needs.
                    </p>
                  </div>

                  <Button 
                    onClick={generatePrompt} 
                    disabled={!toolDescription.trim() || isGenerating}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Generating AI Prompt...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate API Prompt with AI
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Step 2: Show generated prompt */}
              {generatedPrompt && (
                <div className="space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-sm text-green-900">
                      <strong>Prompt generated!</strong> Copy this and paste it into any AI assistant, Lovable project, Make.com, or use it as a guide.
                    </AlertDescription>
                  </Alert>

                  <Card className="border-2 border-primary/20">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Generated API Specification</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={copyPrompt}
                            className="flex items-center gap-1"
                          >
                            {promptCopied ? (
                              <>
                                <Check className="h-3 w-3" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy Prompt
                              </>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          value={generatedPrompt}
                          readOnly
                          className="min-h-[300px] font-mono text-xs bg-muted"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Alert className="bg-blue-50 border-blue-200">
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      <strong>Next:</strong> Build the API using this prompt, then come back and enter the details below to connect it.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setGeneratedPrompt("");
                      setToolDescription("");
                    }}
                    className="w-full"
                  >
                    Start Over
                  </Button>

                  <div className="border-t pt-4 space-y-3">
                    <h3 className="font-semibold">Got your API? Enter the details:</h3>

                    {/* API Details Form (shown after prompt generation) */}
                    <div className="space-y-2">
                      <Label htmlFor="tool-name">Tool Name *</Label>
                      <Input
                        id="tool-name"
                        placeholder="e.g., send_sms, get_weather, create_customer"
                        value={toolName}
                        onChange={(e) => setToolName(e.target.value)}
                      />
                    </div>

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
                    </div>

                    <div className="space-y-2">
                      <Label>Parameters</Label>

                      {parameters.map((param, index) => (
                        <Card key={index} className="bg-muted/50">
                          <CardContent className="pt-3 pb-3">
                            <div className="flex gap-2">
                              <div className="flex-1 space-y-2">
                                <Input
                                  placeholder="Parameter name"
                                  value={param.name}
                                  onChange={(e) => updateParameter(index, 'name', e.target.value)}
                                />
                                <Input
                                  placeholder="Description"
                                  value={param.description}
                                  onChange={(e) => updateParameter(index, 'description', e.target.value)}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeParameter(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      <Button 
                        variant="outline" 
                        onClick={addParameter} 
                        className="w-full"
                        size="sm"
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Add Parameter
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Lightbulb className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-900">
                  <strong>Manual Entry:</strong> If you already have an API endpoint, enter the details directly.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-tool-name">Tool Name *</Label>
                  <Input
                    id="manual-tool-name"
                    placeholder="e.g., send_sms, get_weather"
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-api-url">API Endpoint URL *</Label>
                  <Input
                    id="manual-api-url"
                    type="url"
                    placeholder="https://api.example.com/v1/action"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-auth-token">Auth Token (optional)</Label>
                  <Input
                    id="manual-auth-token"
                    type="password"
                    placeholder="Your API key or bearer token"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Parameters</Label>
                  {parameters.map((param, index) => (
                    <Card key={index} className="bg-muted/50">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Parameter name"
                              value={param.name}
                              onChange={(e) => updateParameter(index, 'name', e.target.value)}
                            />
                            <Input
                              placeholder="Description"
                              value={param.description}
                              onChange={(e) => updateParameter(index, 'description', e.target.value)}
                            />
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
                  
                  <Button 
                    variant="outline" 
                    onClick={addParameter} 
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Parameter
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Edit mode (no tabs, just the form) */}
        {editingTool && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tool-name">Tool Name *</Label>
              <Input
                id="edit-tool-name"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-api-url">API Endpoint URL *</Label>
              <Input
                id="edit-api-url"
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-auth-token">Auth Token (optional)</Label>
              <Input
                id="edit-auth-token"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Parameters</Label>
              {parameters.map((param, index) => (
                <Card key={index} className="bg-muted/50">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Parameter name"
                          value={param.name}
                          onChange={(e) => updateParameter(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="Description"
                          value={param.description}
                          onChange={(e) => updateParameter(index, 'description', e.target.value)}
                        />
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
              
              <Button 
                variant="outline" 
                onClick={addParameter} 
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Parameter
              </Button>
            </div>
          </div>
        )}

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
