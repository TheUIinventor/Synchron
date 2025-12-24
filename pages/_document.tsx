// pages/_document.tsx removed the usage of `next/document` to avoid
// conflicts with the `app/` router's `app/layout.tsx` (which renders
// the top-level <html> element). Keeping an empty default export so
// any legacy pages continue to build without importing Html.

export default function LegacyDocumentPlaceholder() {
  return null
}
