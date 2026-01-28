import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FKProfile, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";

interface ProfileSelectGroupedProps {
  profiles: FKProfile[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  filterNetwork?: FKNetwork | "all";
}

export function ProfileSelectGrouped({ 
  profiles, 
  value, 
  onValueChange, 
  placeholder = "Selecciona un perfil",
  className = "w-72",
  filterNetwork = "all"
}: ProfileSelectGroupedProps) {
  // Filter by network if specified
  const filteredProfiles = filterNetwork === "all" 
    ? profiles 
    : profiles.filter(p => p.network === filterNetwork);

  // Group profiles by network
  const groupedByNetwork = filteredProfiles.reduce((acc, profile) => {
    const network = profile.network as FKNetwork;
    if (!acc[network]) {
      acc[network] = [];
    }
    acc[network].push(profile);
    return acc;
  }, {} as Record<FKNetwork, FKProfile[]>);

  const networks = Object.keys(groupedByNetwork) as FKNetwork[];

  // If only one network, show flat list
  if (networks.length <= 1 && filteredProfiles.length > 0) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {filteredProfiles.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">@{profile.profile_id}</span>
                {profile.display_name && profile.display_name !== profile.profile_id && (
                  <span className="text-muted-foreground text-xs">
                    ({profile.display_name})
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {networks.map((network) => (
          <SelectGroup key={network}>
            <SelectLabel className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground bg-muted/50 -mx-1 px-3 py-1.5">
              {getNetworkLabel(network)}
              <span className="text-[10px] font-normal">
                ({groupedByNetwork[network].length})
              </span>
            </SelectLabel>
            {groupedByNetwork[network].map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">@{profile.profile_id}</span>
                  {profile.display_name && profile.display_name !== profile.profile_id && (
                    <span className="text-muted-foreground text-xs">
                      ({profile.display_name})
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
