import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RdapEvent = { eventAction?: string; eventDate?: string };
type RdapEntity = { vcardArray?: [string, unknown[]]; roles?: string[] };

function extractRegistrar(entities?: RdapEntity[]): string | null {
  if (!entities) return null;
  for (const e of entities) {
    if (!e.roles?.includes("registrar")) continue;
    const vcard = e.vcardArray?.[1];
    if (Array.isArray(vcard)) {
      for (const prop of vcard) {
        if (Array.isArray(prop) && prop[0] === "fn" && typeof prop[3] === "string") return prop[3];
      }
    }
  }
  return null;
}

export const checkDomainExpiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domain: string }) => {
    const domain = (input?.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("Enter a valid domain name, e.g. example.com");
    return { domain };
  })
  .handler(async ({ data }) => {
    // rdap.org blocks server requests (403); resolve the TLD's own RDAP service via the IANA bootstrap.
    const tld = data.domain.split(".").pop()!;
    const bootstrap = await (await fetch("https://data.iana.org/rdap/dns.json")).json() as { services: [string[], string[]][] };
    const service = bootstrap.services.find((s) => s[0].includes(tld));
    if (!service) throw new Error("No lookup service for this domain extension.");
    const res = await fetch(`${service[1][0]}domain/${encodeURIComponent(data.domain)}`, {
      headers: { Accept: "application/rdap+json, application/json" },
    });
    if (res.status === 404) throw new Error("Domain not found — it may be available or unregistered.");
    if (!res.ok) throw new Error("Lookup failed. Try again later.");
    const body = (await res.json()) as { events?: RdapEvent[]; entities?: RdapEntity[] };
    const expiry = body.events?.find((e) => e.eventAction === "expiration")?.eventDate ?? null;
    if (!expiry) throw new Error("No expiry date published for this domain.");
    return {
      expiryDate: expiry.slice(0, 10),
      registrar: extractRegistrar(body.entities),
    };
  });
