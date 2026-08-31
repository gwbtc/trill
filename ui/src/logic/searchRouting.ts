export type RailSearchRouteInput = {
  currentLocation: string;
  isSearchScreen: boolean;
  nextQuery: string;
  previousRoute: string;
};

export type RailSearchRouteResult = {
  nextPath: string;
  previousRoute: string;
};

export function getRailSearchRoute({
  currentLocation,
  isSearchScreen,
  nextQuery,
  previousRoute,
}: RailSearchRouteInput): RailSearchRouteResult {
  const fallbackRoute = previousRoute || "/f";
  const trimmed = nextQuery.trim();

  if (!trimmed) {
    return {
      nextPath: isSearchScreen ? "/search" : currentLocation || fallbackRoute,
      previousRoute: fallbackRoute,
    };
  }

  const nextPreviousRoute = isSearchScreen
    ? fallbackRoute
    : currentLocation || "/f";
  const params = new URLSearchParams();
  params.set("q", nextQuery);

  return {
    nextPath: `/search?${params.toString()}`,
    previousRoute: nextPreviousRoute,
  };
}
