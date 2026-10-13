/**
 * Inline pre-hydration script for Tempo Flow theme + dyslexia toggles, and the `?glass=off`
 * fallback (DESIGN.md §5: every glass surface turns solid).
 *
 * Runs before React hydrates so the user's stored preference is applied
 * in the same frame as first paint (no FOUC / theme flash).
 *
 * Source: docs/design/claude-export/design-system/theme-controller.js
 * Target: <script> injected by apps/web/app/layout.tsx via `dangerouslySetInnerHTML`.
 */

import { LANG_STORAGE_KEY } from "./i18n";

export const THEME_STORAGE_KEY = "tempo-theme";
export const DYSLEXIA_STORAGE_KEY = "tempo-dyslexia";

export type ThemePreference = "light" | "dark" | "system";

export function themeInitScript(): string {
  return `(function(){try{
    var root=document.documentElement;
    var q=new URLSearchParams(location.search);
    var qt=q.get('theme');
    var t=(qt==='light'||qt==='dark')?qt:localStorage.getItem('${THEME_STORAGE_KEY}');
    if(t==='light'||t==='dark'){root.setAttribute('data-theme',t);}
    else{root.removeAttribute('data-theme');}
    var ql=q.get('lang');
    var l=(ql==='he'||ql==='en')?ql:localStorage.getItem('${LANG_STORAGE_KEY}');
    if(l==='he'){root.lang='he';root.dir='rtl';}else{root.lang='en';root.dir='ltr';}
    var d=localStorage.getItem('${DYSLEXIA_STORAGE_KEY}');
    if(d==='on'){root.setAttribute('data-dyslexia','on');}
    if(q.get('glass')==='off'){root.setAttribute('data-glass','off');}
  }catch(e){}})();`;
}
