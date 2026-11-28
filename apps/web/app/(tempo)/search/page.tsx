/**
 * @screen: search
 * @category: You
 * @source: docs/design/v3/screens/web/search.html
 * @summary: Global search with grouped results.
 * @queries: search.all
 * @mutations: (none)
 * @auth: required
 */
import { Suspense } from "react";
import { ProfileReady } from "@/components/today/ProfileReady";
import { SearchHeader, SearchScreen } from "@/components/global-search/SearchScreen";

export default function Page() {
  return (
    <div className="tp-page" data-testid="search-route" data-component="PageLayout">
      <SearchHeader />
      <ProfileReady>
        <Suspense fallback={null}>
          <SearchScreen />
        </Suspense>
      </ProfileReady>
    </div>
  );
}
