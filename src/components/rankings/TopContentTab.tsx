import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  ExternalLink, 
  Heart, 
  MessageCircle, 
  Share2, 
  RefreshCw,
  Image as ImageIcon,
  Video,
  Link as LinkIcon
} from "lucide-react";
import { FKProfile, useFetchProfilePosts, FKPost } from "@/hooks/useFanpageKarma";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TopContentTabProps {
  profiles: FKProfile[];
  isLoading: boolean;
}

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const getContentTypeIcon = (type?: string) => {
  switch (type?.toLowerCase()) {
    case "video":
      return <Video className="h-4 w-4" />;
    case "photo":
    case "image":
      return <ImageIcon className="h-4 w-4" />;
    case "link":
      return <LinkIcon className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

function PostCard({ post, profileName }: { post: FKPost; profileName: string }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Thumbnail if available */}
          {post.image_url && (
            <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
              <img 
                src={post.image_url} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                @{profileName}
              </Badge>
              {post.content_type && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  {getContentTypeIcon(post.content_type)}
                  {post.content_type}
                </Badge>
              )}
              {post.published_at && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(post.published_at), "dd MMM yyyy", { locale: es })}
                </span>
              )}
            </div>
            
            {/* Content preview */}
            <p className="text-sm line-clamp-2 mb-3">
              {post.message || post.title || "Sin texto"}
            </p>
            
            {/* Metrics */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{formatNumber(post.likes)}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>{formatNumber(post.comments)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Share2 className="h-4 w-4" />
                <span>{formatNumber(post.shares)}</span>
              </div>
              {post.url && (
                <a 
                  href={post.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-auto text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver post
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TopContentTab({ profiles, isLoading: profilesLoading }: TopContentTabProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  
  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];
  
  const { 
    data: posts = [], 
    isLoading: postsLoading, 
    refetch,
    isFetching 
  } = useFetchProfilePosts(selectedProfile);

  if (profilesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin perfiles</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Agrega perfiles en la pestaña de Configuración para ver su contenido top.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Perfil:</span>
          <Select 
            value={selectedProfileId || selectedProfile?.id || ""} 
            onValueChange={setSelectedProfileId}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecciona un perfil" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  @{profile.profile_id} ({profile.network})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Posts list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contenido Top de @{selectedProfile?.profile_id}
          </CardTitle>
          <CardDescription>
            Los posts con mejor engagement del perfil seleccionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No hay posts disponibles para este perfil.</p>
              <p className="text-sm mt-1">
                Haz clic en "Actualizar" para obtener los posts más recientes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <PostCard 
                  key={post.id || index} 
                  post={post} 
                  profileName={selectedProfile?.profile_id || ""} 
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
