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
        "name": siteName,
        "publisher": {
          "@type": "Organization",
          "name": siteName,
          "logo": {
            "@type": "ImageObject",
            "url": logoPath
          }
        }
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
      {/* canonical and richer metadata to help search engines prefer the site name */}
      {origin && <link rel="canonical" href={siteUrl} />}
      <meta name="application-name" content={siteName} />
      <meta name="apple-mobile-web-app-title" content={siteName} />
      <meta property="og:site_name" content={siteName} />
      {/* Provide a sensible OG/Twitter card */}
      <meta property="og:title" content={siteName} />
      <meta property="og:description" content="A modern, expressive timetable app for SBHS students." />
      <meta property="og:image" content={logoPath} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteName} />
      <meta name="twitter:description" content="A modern, expressive timetable app for SBHS students." />
      <meta name="twitter:image" content={logoPath} />
      <link rel="icon" href="/favicon.ico" />
      <link rel="manifest" href="/manifest.json" />
      <script key="site-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
