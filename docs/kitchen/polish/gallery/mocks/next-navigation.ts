// Gallery stand-in for "next/navigation".
const router = { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} };
export const useRouter = () => router;
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export function redirect() {}
export function notFound() {}
