import { Heart, Bot } from 'lucide-react';

interface CommunityAppTileProps {
  id: string;
  name: string;
  agentName: string | null;
  coverImageUrl: string | null;
  agentAvatarUrl: string | null;
  isFavorited: boolean;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onClick: () => void;
}

export function CommunityAppTile({
  id,
  name,
  agentName,
  coverImageUrl,
  agentAvatarUrl,
  isFavorited,
  onToggleFavorite,
  onClick,
}: CommunityAppTileProps) {
  const imageUrl = coverImageUrl || agentAvatarUrl;

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col items-center p-3 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/50 hover:shadow-glow cursor-pointer transition-all duration-200 active:scale-95"
    >
      {/* Favorite button */}
      <button
        onClick={(e) => onToggleFavorite(e, id)}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-muted transition-colors z-10"
      >
        <Heart 
          className={`w-3.5 h-3.5 transition-colors ${
            isFavorited 
              ? 'fill-red-500 text-red-500' 
              : 'text-muted-foreground'
          }`}
        />
      </button>

      {/* App Icon / Avatar */}
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-2 shadow-md">
        {imageUrl && imageUrl.trim() !== '' ? (
          <img 
            src={imageUrl} 
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.innerHTML = '<div class="w-6 h-6 text-primary"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="14" y="3" rx="1"/><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/></svg></div>';
              }
            }}
          />
        ) : (
          <Bot className="w-6 h-6 text-primary" />
        )}
      </div>

      {/* Community Name */}
      <p className="text-sm font-medium text-center truncate w-full group-hover:text-primary transition-colors">
        {name}
      </p>
    </div>
  );
}
