import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, ArrowRight, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DeployTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    id: string;
    name: string;
    description: string;
    long_description: string;
    template_config: any;
    example_interactions?: string[];
    category: string;
    difficulty_level: string;
  };
}

interface Community {
  id: string;
  name: string;
}

export function DeployTemplateDialog({
  open,
  onOpenChange,
  template,
}: DeployTemplateDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);

  // Form state
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [botName, setBotName] = useState(template.name);
  const [customInstructions, setCustomInstructions] = useState("");

  useEffect(() => {
    if (open) {
      fetchCommunities();
      setBotName(template.name);
      setCustomInstructions("");
      setStep(1);
    }
  }, [open, template]);

  const fetchCommunities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!userData) return;

      const { data, error } = await supabase
        .from("community_members")
        .select("community_id, communities(id, name)")
        .eq("user_id", userData.id)
        .eq("role", "admin");

      if (error) throw error;

      const communityList = data
        ?.map((cm: any) => cm.communities)
        .filter(Boolean) || [];

      setCommunities(communityList);
      if (communityList.length > 0) {
        setSelectedCommunityId(communityList[0].id);
      }
    } catch (error) {
      console.error("Error fetching communities:", error);
      toast({
        title: "Error",
        description: "Failed to load your communities",
        variant: "destructive",
      });
    } finally {
      setLoadingCommunities(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedCommunityId) {
      toast({
        title: "Error",
        description: "Please select a community",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Merge template config with custom settings
      const finalConfig = {
        ...template.template_config,
        agent_name: botName,
        agent_instructions: customInstructions || template.template_config.agent_instructions,
      };

      // Update community with bot configuration
      const { error: updateError } = await supabase
        .from("communities")
        .update({
          agent_name: finalConfig.agent_name,
          agent_instructions: finalConfig.agent_instructions,
          agent_temperature: finalConfig.agent_temperature,
          agent_max_tokens: finalConfig.agent_max_tokens,
          agent_suggested_messages: finalConfig.suggested_messages,
          daily_message_enabled: finalConfig.daily_message_enabled || false,
          daily_message_time: finalConfig.daily_message_time,
          daily_message_content: finalConfig.daily_message_content,
        })
        .eq("id", selectedCommunityId);

      if (updateError) throw updateError;

      // Increment template use count (silent fail - not critical)
      try {
        await supabase
          .from("bot_templates")
          .update({ use_count: (template as any).use_count + 1 })
          .eq("id", template.id);
      } catch (e) {
        // Silent fail
      }

      toast({
        title: "Template deployed!",
        description: `${botName} has been configured successfully`,
      });

      setStep(3); // Success step
    } catch (error: any) {
      console.error("Error deploying template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to deploy template",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setSelectedCommunityId("");
      setBotName(template.name);
      setCustomInstructions("");
    }, 200);
  };

  const handleGoToDashboard = () => {
    handleClose();
    navigate(`/community/${selectedCommunityId}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Deploy: {template.name}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Choose where to deploy this bot template"}
            {step === 2 && "Customize your bot configuration"}
            {step === 3 && "Template deployed successfully!"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Community */}
        {step === 1 && (
          <div className="space-y-4">
            <Card className="p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">{template.name}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {template.long_description}
              </p>
              <div className="flex gap-2">
                <Badge variant="secondary">{template.category}</Badge>
                <Badge variant="secondary">{template.difficulty_level}</Badge>
              </div>
            </Card>

            {loadingCommunities ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : communities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  You need to be an admin of a community to deploy templates
                </p>
                <Button onClick={() => navigate("/communities")}>
                  Go to Communities
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Community</Label>
                  <Select value={selectedCommunityId} onValueChange={setSelectedCommunityId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a community" />
                    </SelectTrigger>
                    <SelectContent>
                      {communities.map((community) => (
                        <SelectItem key={community.id} value={community.id}>
                          {community.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={() => setStep(2)} disabled={!selectedCommunityId}>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Customize */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botName">Bot Name</Label>
              <Input
                id="botName"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="Enter bot name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">
                Custom Instructions (Optional)
              </Label>
              <Textarea
                id="instructions"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder={`Default: ${template.template_config.agent_instructions}`}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the template's default instructions
              </p>
            </div>

            {template.example_interactions && template.example_interactions.length > 0 && (
              <Card className="p-4 bg-muted/50">
                <h4 className="font-semibold mb-2 text-sm">Example Interactions</h4>
                <ul className="space-y-1">
                  {template.example_interactions.map((example, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      • {example}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleDeploy} disabled={loading || !botName.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Deploy Template
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-2xl font-bold">Template Deployed!</h3>
            <p className="text-muted-foreground">
              Your bot has been configured and is ready to use
            </p>
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleGoToDashboard}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
