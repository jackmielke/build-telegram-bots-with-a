import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { Search, Sparkles, TrendingUp, Clock, ArrowLeft } from "lucide-react";
import { DeployTemplateDialog } from "@/components/dashboard/DeployTemplateDialog";

interface BotTemplate {
  id: string;
  name: string;
  description: string;
  long_description: string;
  category: string;
  tags: string[];
  thumbnail_url?: string;
  is_featured: boolean;
  use_count: number;
  difficulty_level: string;
  estimated_setup_time: number;
  template_config: any;
  example_interactions?: string[];
}

const categoryIcons = {
  community: "👥",
  productivity: "⚡",
  entertainment: "🎮",
  education: "📚",
  business: "💼",
  support: "🎧",
  custom: "🔧"
};

const difficultyColors = {
  beginner: "bg-green-500/10 text-green-700 dark:text-green-400",
  intermediate: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  advanced: "bg-red-500/10 text-red-700 dark:text-red-400"
};

export default function TemplateMarketplace() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<BotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<BotTemplate | null>(null);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [searchQuery, selectedCategory, templates]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("bot_templates")
        .select("*")
        .order("is_featured", { ascending: false })
        .order("use_count", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    if (selectedCategory !== "all") {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleDeployTemplate = (template: BotTemplate) => {
    setSelectedTemplate(template);
    setDeployDialogOpen(true);
  };

  const categories = [
    { value: "all", label: "All Templates", icon: "✨" },
    { value: "community", label: "Community", icon: categoryIcons.community },
    { value: "productivity", label: "Productivity", icon: categoryIcons.productivity },
    { value: "education", label: "Education", icon: categoryIcons.education },
    { value: "entertainment", label: "Entertainment", icon: categoryIcons.entertainment },
    { value: "business", label: "Business", icon: categoryIcons.business },
    { value: "support", label: "Support", icon: categoryIcons.support },
  ];

  const featuredTemplates = filteredTemplates.filter(t => t.is_featured);
  const popularTemplates = filteredTemplates.filter(t => t.use_count > 0).slice(0, 3);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-muted-foreground">Loading templates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Template Marketplace</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Discover and deploy pre-built bot templates to get started in minutes
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search templates by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
              >
                <span className="mr-2">{cat.icon}</span>
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Featured Section */}
        {featuredTemplates.length > 0 && selectedCategory === "all" && !searchQuery && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Featured Templates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDeploy={handleDeployTemplate}
                  featured
                />
              ))}
            </div>
          </div>
        )}

        {/* All Templates */}
        <div>
          <h2 className="text-2xl font-bold mb-4">
            {searchQuery || selectedCategory !== "all" 
              ? `Results (${filteredTemplates.length})`
              : "All Templates"
            }
          </h2>
          
          {filteredTemplates.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground text-lg">
                No templates found. Try adjusting your filters.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDeploy={handleDeployTemplate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deploy Dialog */}
      {selectedTemplate && (
        <DeployTemplateDialog
          open={deployDialogOpen}
          onOpenChange={setDeployDialogOpen}
          template={selectedTemplate}
        />
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: BotTemplate;
  onDeploy: (template: BotTemplate) => void;
  featured?: boolean;
}

function TemplateCard({ template, onDeploy, featured }: TemplateCardProps) {
  return (
    <Card className={`p-6 hover:shadow-lg transition-all ${featured ? 'border-primary' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{categoryIcons[template.category as keyof typeof categoryIcons]}</span>
          {featured && (
            <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
        </div>
        <Badge className={difficultyColors[template.difficulty_level as keyof typeof difficultyColors]}>
          {template.difficulty_level}
        </Badge>
      </div>

      <h3 className="text-xl font-bold mb-2">{template.name}</h3>
      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
        {template.description}
      </p>

      <div className="flex flex-wrap gap-1 mb-4">
        {template.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag}
          </Badge>
        ))}
        {template.tags.length > 3 && (
          <Badge variant="secondary" className="text-xs">
            +{template.tags.length - 3}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {template.estimated_setup_time} min
        </div>
        {template.use_count > 0 && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            {template.use_count} uses
          </div>
        )}
      </div>

      <Button
        onClick={() => onDeploy(template)}
        className="w-full"
      >
        Deploy Template
      </Button>
    </Card>
  );
}
