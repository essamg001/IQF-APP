import { prisma } from "@/lib/prisma";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function OurProcessPage() {
  const locale = await resolveLocale();
  const dict = getDictionary(locale).ourProcess;

  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const totalCapacity = factories.reduce((sum, f) => sum + f.capacityTonnesPerHour, 0);

  const STATS = [
    { value: String(factories.length || 2), label: dict.statFacilities },
    { value: totalCapacity ? totalCapacity.toFixed(1) : "9.1", label: dict.statCapacity },
    { value: "16", label: dict.statAccreditations },
    { value: "0", label: dict.statResidue },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-20 pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl shadow-sm">
        <img
          src="/our-process/hero.jpg"
          alt="Aerial view of Magrabi Agriculture's fields"
          className="h-[380px] w-full object-cover sm:h-[440px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5" />
        <div className="absolute inset-0 flex flex-col justify-end p-8 sm:p-12">
          <Eyebrow light>{dict.eyebrowCompany}</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-[42px]">
            {dict.heroTitle}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-200">{dict.heroSubtitle}</p>
        </div>
      </section>

      {/* Stat band */}
      <section className="grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-y-0">
        {STATS.map((s) => (
          <div key={s.label} className="px-6 py-7 text-center">
            <p className="text-4xl font-semibold tracking-tight text-emerald-800">{s.value}</p>
            <p className="mt-1.5 text-xs leading-snug text-slate-500">{s.label}</p>
          </div>
        ))}
      </section>

      {/* One partner, accountable for every stage */}
      <Section eyebrow={dict.eyebrowDifferent} heading={dict.headingDifferent}>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dict.differentiators.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="min-h-[2.5rem] text-sm font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* The Growing Operation */}
      <Section eyebrow={dict.eyebrowGrowing} heading={dict.headingGrowing}>
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{dict.growingBeginsTitle}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{dict.growingBeginsBody}</p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{dict.growingComplianceTitle}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{dict.growingComplianceBody}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <img src="/our-process/nursery-tunnel.jpg" alt="Nursery propagation tunnel" className="h-44 w-full rounded-xl object-cover" />
            <img src="/our-process/hands-seedlings.jpg" alt="Hand-tending seedlings" className="h-44 w-full rounded-xl object-cover" />
            <img src="/our-process/frozen-berries-bin.jpg" alt="Frozen strawberries" className="h-44 w-full rounded-xl object-cover" />
            <img
              src="/our-process/propagation-rows.jpg"
              alt="Strawberry propagation rows under tunnel"
              className="h-44 w-full rounded-xl object-cover"
            />
          </div>
        </div>
      </Section>

      {/* Unbroken custody timeline */}
      <section className="rounded-2xl bg-emerald-950 px-8 py-12 text-white sm:px-12">
        <Eyebrow light>{dict.eyebrowQuality}</Eyebrow>
        <h2 className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[34px]">
          {dict.custodyHeading}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-100">{dict.custodyBody}</p>
        <ol className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {dict.processSteps.map((s, i) => (
            <li key={s.n} className="relative border-t-2 border-emerald-700 pt-4">
              {i > 0 && <span className="absolute -left-3 top-0 hidden h-0.5 w-3 bg-emerald-700 lg:block" aria-hidden />}
              <p className="font-mono text-xs font-semibold tracking-wider text-emerald-400">{s.n}</p>
              <h3 className="mt-1.5 min-h-[2.5rem] text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-emerald-200">{s.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Twin IQF Facilities */}
      <Section eyebrow={dict.eyebrowProduction} heading={dict.headingProduction}>
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {factories.map((f) => {
            const blurb = (f.code && dict.factoryBlurbs[f.code]) || {
              title: f.name,
              lines: [dict.factoryFallbackLine],
            };
            return (
              <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">{blurb.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {f.name} · {dict.jbtTunnelLabel} · {f.capacityTonnesPerHour} {dict.tHrSuffix}
                </p>
                <ul className="mt-4 space-y-2">
                  {blurb.lines.map((line) => (
                    <li key={line} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                      <span className="mt-0.5 shrink-0 text-emerald-700">—</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Inside the Operation gallery */}
      <Section eyebrow={dict.eyebrowInside} heading={dict.headingInside}>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              "aerial-orchards.jpg",
              "facility-exterior.jpg",
              "cold-storage-racking.jpg",
              "processing-hall.jpg",
              "forklifts.jpg",
              "iqf-line.jpg",
            ] as const
          ).map((src) => (
            <img
              key={src}
              src={`/our-process/${src}`}
              alt={dict.galleryAlts[src]}
              className="h-36 w-full rounded-xl object-cover sm:h-44"
            />
          ))}
        </div>
      </Section>

      {/* Product Range */}
      <Section eyebrow={dict.eyebrowProductRange} heading={dict.headingProductRange} sub={dict.subProductRange}>
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-stretch">
          <img src="/our-process/frozen-berries-bin.jpg" alt="Frozen strawberries" className="h-64 w-full rounded-xl object-cover lg:h-full" />
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-start text-sm">
              <tbody>
                {dict.productSpecs.map((row, i) => (
                  <tr key={row.format} className={i > 0 ? "border-t border-slate-100" : undefined}>
                    <td className="bg-slate-50 px-5 py-4 font-medium text-slate-900">{row.format}</td>
                    <td className="px-5 py-4 text-slate-600">{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-400">
              {dict.customCalibrationNote}
            </p>
          </div>
        </div>
      </Section>

      {/* Optical sorting + Packing */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-16 border-t border-slate-200 pt-16 lg:grid-cols-2">
        <div>
          <Eyebrow>{dict.eyebrowScreening}</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-slate-900">
            {dict.screeningHeading}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{dict.screeningBody}</p>
          <img
            src="/our-process/optical-sorter.jpg"
            alt="Tomra optical sorter"
            className="mt-5 h-48 w-full rounded-xl border border-slate-200 bg-white object-contain p-4"
          />
        </div>
        <div>
          <Eyebrow>{dict.eyebrowPacking}</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-slate-900">
            {dict.packingHeading}
          </h2>
          <div className="mt-5 space-y-3">
            {dict.packFormats.map((p) => (
              <div key={p.name} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <span className="h-fit shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {p.size}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{p.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* People & Hygiene */}
      <div className="grid grid-cols-1 items-center gap-10 border-t border-slate-200 pt-16 lg:grid-cols-2">
        <div>
          <Eyebrow>{dict.eyebrowPeople}</Eyebrow>
          <h2 className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-[32px]">
            {dict.peopleHeading}
          </h2>
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{dict.healthScreeningTitle}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{dict.healthScreeningBody}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{dict.interventionTitle}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{dict.interventionBody}</p>
            </div>
          </div>
        </div>
        <img src="/our-process/clinic.jpg" alt="The on-site clinic" className="h-full min-h-64 w-full rounded-xl object-cover" />
      </div>

      {/* Accreditations */}
      <Section eyebrow={dict.eyebrowAccreditations} heading={dict.accreditationsHeading} sub={dict.accreditationsSub}>
        <div className="mt-8 grid grid-cols-1 gap-6 rounded-2xl border border-slate-200 bg-white p-8 sm:grid-cols-3">
          {dict.accreditationGroups.map((g) => (
            <div key={g.group}>
              <h3 className="text-sm font-semibold text-slate-900">{g.group}</h3>
              <ul className="mt-3 space-y-2">
                {g.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                    <span className="mt-0.5 shrink-0 text-emerald-700">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Global reach */}
      <section className="relative overflow-hidden rounded-2xl shadow-sm">
        <img src="/our-process/facility-aerial.jpg" alt="Aerial view of the facility complex" className="h-80 w-full object-cover" />
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute inset-0 flex flex-col justify-center px-8 py-10 sm:px-12">
          <Eyebrow light>{dict.eyebrowGlobal}</Eyebrow>
          <h2 className="mt-4 max-w-xl text-2xl font-semibold leading-[1.15] tracking-tight text-white sm:text-[30px]">
            {dict.globalHeading}
          </h2>
          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
            {dict.globalPoints.map((p) => (
              <div key={p.title}>
                <h3 className="text-sm font-semibold text-white">{p.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={"h-px w-6 " + (light ? "bg-emerald-400" : "bg-emerald-700")} aria-hidden />
      <p className={"text-xs font-semibold uppercase tracking-[0.16em] " + (light ? "text-emerald-300" : "text-emerald-700")}>
        {children}
      </p>
    </div>
  );
}

function Section({
  eyebrow,
  heading,
  sub,
  children,
}: {
  eyebrow: string;
  heading: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-16">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 max-w-2xl text-[28px] font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-[32px]">
        {heading}
      </h2>
      {sub && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">{sub}</p>}
      {children}
    </section>
  );
}
