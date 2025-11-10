import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Rocket, ExternalLink, Info, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  tokenName: z.string().min(1, "Token name is required"),
  tokenSymbol: z.string().min(1, "Token symbol is required").max(10, "Symbol must be 10 characters or less"),
  tokenDescription: z.string().optional(),
  userAddress: z.string().min(42, "Valid Ethereum address required"),
  imageFile: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TokenLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  communityName: string;
  coverImageUrl?: string | null;
}

export const TokenLaunchDialog = ({
  open,
  onOpenChange,
  communityId,
  communityName,
  coverImageUrl,
}: TokenLaunchDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLaunching, setIsLaunching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tokenName: `${communityName} Token`,
      tokenSymbol: "",
      tokenDescription: "",
      userAddress: "",
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsLaunching(true);
      setProgress(0);
      setTransactionHash(null);

      // Use provided image or community cover
      let imageData = imagePreview || coverImageUrl;
      
      if (!imageData) {
        toast({
          title: "Error",
          description: "Please upload an image or make sure your community has a cover image",
          variant: "destructive",
        });
        return;
      }

      // Convert image URL to base64 if it's a URL
      if (imageData.startsWith('http')) {
        setCurrentStep("Loading image...");
        const response = await fetch(imageData);
        const blob = await response.blob();
        imageData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      setCurrentStep("Step 1/4: Uploading image to IPFS...");
      setProgress(25);

      const { data, error } = await supabase.functions.invoke('launch-token', {
        body: {
          communityId,
          tokenName: values.tokenName,
          tokenSymbol: values.tokenSymbol,
          tokenDescription: values.tokenDescription,
          imageFile: imageData,
          templateId: '2c280c25-7527-4de9-891a-783c488838f8', // Vibe Residency template
          userAddress: values.userAddress,
          chainId: 8453, // Base
          socialLinks: [],
          vestingRecipients: [],
          beneficiaries: []
        },
      });

      if (error) {
        throw error;
      }

      setProgress(100);
      setCurrentStep("Token launched successfully! 🎉");
      setTransactionHash(data.transactionHash);
      setTokenAddress(data.token_address);

      toast({
        title: "Token Launched! 🚀",
        description: `${values.tokenName} has been deployed on Base`,
      });

      // Invalidate and refetch tokens to show the new one
      await queryClient.invalidateQueries({ queryKey: ['bot-tokens', communityId] });

      // Close after 3 seconds
      setTimeout(() => {
        onOpenChange(false);
        form.reset();
        setIsLaunching(false);
        setProgress(0);
        setCurrentStep("");
        setTransactionHash(null);
        setTokenAddress(null);
        setImagePreview(null);
      }, 3000);

    } catch (error: any) {
      console.error('Token launch error:', error);
      toast({
        title: "Launch Failed",
        description: error.message || "Failed to launch token",
        variant: "destructive",
      });
      setIsLaunching(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Launch Token
          </DialogTitle>
          <DialogDescription>
            Create a token for your community on Base (gasless deployment)
          </DialogDescription>
        </DialogHeader>

        {!isLaunching ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="tokenName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Community Token" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tokenSymbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Symbol</FormLabel>
                    <FormControl>
                      <Input placeholder="MCT" {...field} />
                    </FormControl>
                    <FormDescription>
                      Short ticker symbol (e.g., ETH, BTC)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tokenDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your token..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Wallet Address (Base Network)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0x..." 
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Base-compatible Ethereum address that will receive 10% of token supply and 35% of gas fees
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Token Image</FormLabel>
                <FormControl>
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </FormControl>
                <FormDescription>
                  {coverImageUrl && !imagePreview 
                    ? "Will use community cover image if no file uploaded" 
                    : "Upload an image for your token"}
                </FormDescription>
                {(imagePreview || coverImageUrl) && (
                  <div className="mt-2">
                    <img 
                      src={imagePreview || coverImageUrl!} 
                      alt="Token preview" 
                      className="w-32 h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </FormItem>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm space-y-2">
                  <div>
                    <strong>🎉 Gasless Launch:</strong> Your platform sponsors the gas fees!
                  </div>
                  <div className="pt-2 border-t">
                    <strong>Token Distribution:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                      <li><strong>90%</strong> - Allocated by the Vibe Residency template (preset)</li>
                      <li><strong>10%</strong> - Goes to your wallet address (beneficiary)</li>
                    </ul>
                  </div>
                  <div className="pt-2 border-t">
                    <strong>Gas Fees:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                      <li><strong>35%</strong> - Goes to your wallet address from trading fees</li>
                    </ul>
                  </div>
                  <div className="pt-2 text-xs text-muted-foreground">
                    Deploying on Base Network (chainId: 8453)
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  <Rocket className="mr-2 h-4 w-4" />
                  Launch Token
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-6 py-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{currentStep}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>

            {transactionHash && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="space-y-3">
                  <p className="font-medium text-green-900">Token successfully launched! 🎉</p>
                  <div className="flex flex-wrap gap-2">
                    {tokenAddress && (
                      <Button
                        size="sm"
                        className="bg-green-700 hover:bg-green-800 text-white"
                        onClick={() => window.open(`https://app.long.xyz/tokens/${tokenAddress}`, '_blank')}
                      >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Trade on Long
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-700 text-green-700 hover:bg-green-50"
                      onClick={() => window.open(`https://basescan.org/tx/${transactionHash}`, '_blank')}
                    >
                      View on BaseScan
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
