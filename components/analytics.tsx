import Script from "next/script";
import {
  GA_LINKER_DOMAINS,
  GA_MEASUREMENT_ID,
  GA_PRODUCTION_HOSTNAMES,
} from "@/lib/analytics/gtag";

export function Analytics() {
  if (!GA_MEASUREMENT_ID) return null;

  const linkerJson = JSON.stringify({ domains: GA_LINKER_DOMAINS });
  const productionHostnamesJson = JSON.stringify(GA_PRODUCTION_HOSTNAMES);

  return (
    <Script id="ga-init" strategy="afterInteractive">
      {`
        if (${productionHostnamesJson}.includes(window.location.hostname.toLowerCase())) {
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};

          var gaScript = document.createElement('script');
          gaScript.async = true;
          gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}';
          document.head.appendChild(gaScript);

          window.gtag('js', new Date());
          window.gtag('config', '${GA_MEASUREMENT_ID}', { linker: ${linkerJson} });
        }
      `}
    </Script>
  );
}
