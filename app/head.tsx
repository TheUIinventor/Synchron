export default function Head() {
  const siteName = "Synchron";
  // Prefer an absolute URL for JSON-LD logo if NEXT_PUBLIC_SITE_URL is set
  const origin = typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "") : "";
  const logoPath = origin ? `${origin}/synchron-logo.svg` : "/synchron-logo.svg";
  const siteUrl = origin || "/";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": siteUrl,
        "url": siteUrl,
        "name": siteName
      },
      {
        "@type": "Organization",
        "name": siteName,
        "url": siteUrl,
        "logo": {
          "@type": "ImageObject",
          "url": logoPath
        }
      }
    ]
  } as const;

  return (
    <>
      <meta name="application-name" content={siteName} />
      <meta name="apple-mobile-web-app-title" content={siteName} />
      <meta property="og:site_name" content={siteName} />
      <link rel="icon" href="/favicon.ico" />
      <link rel="manifest" href="/manifest.json" />
      <script key="site-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
