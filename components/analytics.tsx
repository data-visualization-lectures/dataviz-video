import Script from "next/script";
import { GA_LINKER_DOMAINS, GA_MEASUREMENT_ID } from "@/lib/analytics/gtag";

export function Analytics() {
  if (!GA_MEASUREMENT_ID) return null;

  const linkerJson = JSON.stringify({ domains: GA_LINKER_DOMAINS });

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { linker: ${linkerJson} });
        `}
      </Script>
    </>
  );
}
