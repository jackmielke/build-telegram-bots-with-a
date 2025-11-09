import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Brain, Book, Shield, Sparkles, ArrowRight, ArrowLeft, Check, Zap, MessageSquare, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BotOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  communityName: string;
  onComplete: () => void;
}

const BotOnboarding = ({ open, onOpenChange, communityId, communityName, onComplete }: BotOnboardingProps) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const { toast } = useToast();

  // Step 1: System Prompt
  const [systemPrompt, setSystemPrompt] = useState(
    `You are a helpful AI assistant for the ${communityName} community. Your role is to:\n\n- Answer questions about the community\n- Help members connect with each other\n- Provide relevant information and resources\n- Be friendly, helpful, and respectful\n\nAlways be concise and to the point.`
  );

  // Step 2: Knowledge
  const [knowledgeChunks, setKnowledgeChunks] = useState([
    { tag: 'welcome', content: `Welcome to ${communityName}! This is a vibrant community where members can connect and collaborate.` },
    { tag: 'rules', content: 'Our community values: Be respectful, Be helpful, Be authentic.' }
  ]);

  // Step 3: Permissions
  const [permissions, setPermissions] = useState({
    respondInGroups: false,
    searchMemory: true,
    saveMemory: true,
    webSearch: false
  });

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Save system prompt
      const { error: promptError } = await supabase
        .from('communities')
        .update({ agent_instructions: systemPrompt })
        .eq('id', communityId);

      if (promptError) throw promptError;

      // Save knowledge chunks as memories
      for (const chunk of knowledgeChunks) {
        if (chunk.content.trim()) {
          await supabase
            .from('memories')
            .insert({
              community_id: communityId,
              content: chunk.content,
              tags: [chunk.tag]
            });
        }
      }

      // Get or create workflow
      const { data: existingWorkflow } = await supabase
        .from('community_workflows')
        .select('*')
        .eq('community_id', communityId)
        .eq('workflow_type', 'telegram_agent_tools')
        .single();

      const workflowConfig = {
        search_chat_history: true,
        search_memory: permissions.searchMemory,
        save_memory: permissions.saveMemory,
        web_search: permissions.webSearch,
        respond_in_groups: permissions.respondInGroups
      };

      if (existingWorkflow) {
        await supabase
          .from('community_workflows')
          .update({
            configuration: workflowConfig,
            is_enabled: true
          })
          .eq('id', existingWorkflow.id);
      } else {
        await supabase
          .from('community_workflows')
          .insert({
            community_id: communityId,
            workflow_type: 'telegram_agent_tools',
            configuration: workflowConfig,
            is_enabled: true
          });
      }

      toast({
        title: "🎉 Bot Configured!",
        description: "Your AI agent is ready to help your community."
      });

      setStep(4); // Move to completion screen
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const addKnowledgeChunk = () => {
    setKnowledgeChunks([...knowledgeChunks, { tag: '', content: '' }]);
  };

  const updateKnowledgeChunk = (index: number, field: 'tag' | 'content', value: string) => {
    const updated = [...knowledgeChunks];
    updated[index][field] = value;
    setKnowledgeChunks(updated);
  };

  const removeKnowledgeChunk = (index: number) => {
    setKnowledgeChunks(knowledgeChunks.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step <= totalSteps && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="w-6 h-6 text-primary" />
                Let's Set Up Your Bot
              </DialogTitle>
              <DialogDescription>
                Configure your AI agent in just a few steps
              </DialogDescription>
            </DialogHeader>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Step {step} of {totalSteps}
              </p>
            </div>
          </>
        )}

        {/* Step 1: System Prompt */}
        {step === 1 && (
          <div className="space-y-6">
            <Card className="gradient-card border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">System Prompt</h3>
                    <p className="text-sm text-muted-foreground">Define how your AI thinks and responds</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Instructions for your AI agent</Label>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder="Define your agent's behavior..."
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Tip: Be specific about tone, style, and what the bot should/shouldn't do
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleNext} className="gradient-primary">
                Next: Knowledge
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Knowledge Chunks */}
        {step === 2 && (
          <div className="space-y-6">
            <Card className="gradient-card border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Book className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Knowledge Base</h3>
                    <p className="text-sm text-muted-foreground">Add information your bot should remember</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {knowledgeChunks.map((chunk, index) => (
                    <Card key={index} className="border-border/50">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Chunk {index + 1}</Label>
                          {knowledgeChunks.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeKnowledgeChunk(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <Input
                          placeholder="Tag (e.g., welcome, faq, rules)"
                          value={chunk.tag}
                          onChange={(e) => updateKnowledgeChunk(index, 'tag', e.target.value)}
                        />
                        <Textarea
                          placeholder="Knowledge content..."
                          value={chunk.content}
                          onChange={(e) => updateKnowledgeChunk(index, 'content', e.target.value)}
                          rows={3}
                        />
                      </CardContent>
                    </Card>
                  ))}

                  <Button variant="outline" onClick={addKnowledgeChunk} className="w-full">
                    <Book className="w-4 h-4 mr-2" />
                    Add Another Chunk
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    💡 Tip: Add FAQs, community rules, or any context your bot should know
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} className="gradient-primary">
                Next: Permissions
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Permissions */}
        {step === 3 && (
          <div className="space-y-6">
            <Card className="gradient-card border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Bot Capabilities</h3>
                    <p className="text-sm text-muted-foreground">Choose what your bot can do</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Core Tools - Always Visible */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex-1">
                        <Label className="text-base font-medium">Save Memory</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Allow bot to remember important information
                        </p>
                      </div>
                      <Switch
                        checked={permissions.saveMemory}
                        onCheckedChange={(checked) => 
                          setPermissions({ ...permissions, saveMemory: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex-1">
                        <Label className="text-base font-medium">Search Memory</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Let bot search knowledge base to answer questions
                        </p>
                      </div>
                      <Switch
                        checked={permissions.searchMemory}
                        onCheckedChange={(checked) => 
                          setPermissions({ ...permissions, searchMemory: checked })
                        }
                      />
                    </div>
                  </div>

                  {/* Additional Tools - Collapsible */}
                  <Collapsible open={showMoreTools} onOpenChange={setShowMoreTools}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        <span className="text-sm font-medium">View more tools</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showMoreTools ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-3">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                        <div className="flex-1">
                          <Label className="text-base font-medium">Respond in Group Chats</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Allow bot to reply when mentioned in groups
                          </p>
                        </div>
                        <Switch
                          checked={permissions.respondInGroups}
                          onCheckedChange={(checked) => 
                            setPermissions({ ...permissions, respondInGroups: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                        <div className="flex-1">
                          <Label className="text-base font-medium">Web Search</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Enable bot to search the web for current information
                          </p>
                        </div>
                        <Switch
                          checked={permissions.webSearch}
                          onCheckedChange={(checked) => 
                            setPermissions({ ...permissions, webSearch: checked })
                          }
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleComplete} disabled={saving} className="gradient-primary">
                {saving ? 'Saving...' : 'Complete Setup'}
                <Check className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Completion */}
        {step === 4 && (
          <div className="space-y-6 py-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              
              <div>
                <h2 className="text-3xl font-bold mb-2">🎉 You're All Set!</h2>
                <p className="text-muted-foreground text-lg">
                  Your AI agent is configured and ready to help your community
                </p>
              </div>

              <Card className="gradient-card border-primary/20 text-left">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    What's Next?
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Test your bot</p>
                        <p className="text-sm text-muted-foreground">Send a message in Telegram to see it in action</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Brain className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Fine-tune the system prompt</p>
                        <p className="text-sm text-muted-foreground">Visit Agent → Setup to adjust behavior</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Book className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Add more knowledge</p>
                        <p className="text-sm text-muted-foreground">Go to Memory to expand what your bot knows</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Adjust workflows</p>
                        <p className="text-sm text-muted-foreground">Visit Agent → Workflows to change permissions</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                onClick={onComplete} 
                size="lg"
                className="gradient-primary w-full"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BotOnboarding;
