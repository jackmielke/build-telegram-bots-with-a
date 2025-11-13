import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';

interface ProfileBackfillSectionProps {
  communityId: string;
}

export function ProfileBackfillSection({ communityId }: ProfileBackfillSectionProps) {
  const { toast } = useToast();
  const [isBackfilling, setIsBackfilling] = useState(false);

  const handleBackfillProfiles = async () => {
    setIsBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-intros', {
        body: { communityId }
      });

      if (error) throw error;

      toast({
        title: "Backfill complete!",
        description: `Processed ${data.processed} intros. ${data.successful} profiles created, ${data.failed} failed.`,
      });
    } catch (error) {
      console.error('Error backfilling profiles:', error);
      toast({
        title: "Backfill failed",
        description: error instanceof Error ? error.message : "Failed to backfill profiles",
        variant: "destructive",
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <CardTitle>Profile Backfill</CardTitle>
        </div>
        <CardDescription>
          Import existing intro messages from your Telegram community into user profiles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will find all messages in your "Intros" topic and create profile bios for users who don't have one yet.
          </p>
          <Button 
            onClick={handleBackfillProfiles} 
            disabled={isBackfilling}
            className="w-full"
          >
            {isBackfilling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing intros...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Backfill Profiles from Intros
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
