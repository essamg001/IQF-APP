import { prisma } from "@/lib/prisma";

const FACTORY_BLURB: Record<string, { title: string; lines: string[] }> = {
  "11": {
    title: "IQF 1 — Facility One",
    lines: [
      "Fully enclosed cabin-plant line: intake, washing, de-capping, and freezing under one hygienic envelope — no open-air transfer between stages.",
      "Metal detection + EC verification on every batch before release.",
    ],
  },
  "13": {
    title: "IQF 2 — Facility Two, Our Highest Capacity",
    lines: [
      "A second enclosed cabin line, doubling total capacity while holding the same hygienic standard as IQF 1.",
      "Tomra Blizzard optical sorter — camera-based sorting removes defects and foreign material before metal detection + EC verification.",
    ],
  },
};

const PROCESS_STEPS = [
  { n: "01", title: "Pre-Nucleus", detail: "Plant genetics selected and propagated in-house." },
  { n: "02", title: "Zero-MRL Fields", detail: "Residue-free cultivation under biological pest control." },
  { n: "03", title: "De-Capping", detail: "Calyx removed by hand for hygienic care." },
  { n: "04", title: "IQF Lock-In", detail: "Flash-frozen at peak quality." },
  { n: "05", title: "Optical Sorting", detail: "Camera-based sorting removes defects and debris." },
  { n: "06", title: "Metal + EC Detection", detail: "Final batch-release screening before release." },
];

const PRODUCT_SPECS = [
  { format: "Whole, Uncalibrated", range: "25 – 40 mm" },
  { format: "Whole, Calibrated", range: "<25 mm · 25–35 mm · >35 mm" },
  { format: "Diced", range: "10×10 mm · 20×20 mm" },
  { format: "Sliced", range: "5 – 8 mm" },
];

const PACK_FORMATS = [
  { size: "10 kg", name: "Blue Bag in Carton", detail: "The foodservice and industrial standard — vacuum cartons, full traceability." },
  { size: "28 kg", name: "Bulk Sacks", detail: "High-volume format for reprocessors and manufacturing use." },
  { size: "450 g – 1 kg", name: "Retail Pillow Bags", detail: "Consumer-ready 450g, 500g, 800g, 1kg formats — printed to brand and market-ready." },
];

const ACCREDITATIONS: { group: string; items: string[] }[] = [
  {
    group: "Farming & Environment",
    items: [
      "GLOBALG.A.P Option 1 — Multisite with QMS",
      "GLOBALG.A.P PLUS",
      "GLOBALG.A.P GRASP — Social Practice",
      "GLOBALG.A.P PPM — Propagation Material",
      "LEAF — Linking Environment And Farming",
      "AVA GLOBAL",
    ],
  },
  {
    group: "Food Safety & Retail",
    items: [
      "BRC Global Standard — Grade A",
      "Tesco Nurture Module (TN 1-2)",
      "Tesco Minimum Standard",
      "McDonald's SQMS — Supplier Quality",
      "McDonald's SMA — Workplace Accountability",
    ],
  },
  {
    group: "Ethical & Organic",
    items: ["SMETA — Sedex Ethical Trade Audit", "Fairtrade Certified", "Organic", "Rainforest Alliance", "Bio Suisse"],
  },
];

export default async function OurProcessPage() {
  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const totalCapacity = factories.reduce((sum, f) => sum + f.capacityTonnesPerHour, 0);

  return (
    <div className="space-y-16 pb-8">
      {/* Hero */}
      <section className="relative -mx-8 -mt-8 h-[420px] overflow-hidden">
        <img src="/our-process/hero.jpg" alt="Aerial view of Magrabi Agriculture's fields" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="absolute inset-0 flex flex-col justify-end p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Magrabi Agriculture</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
            Premium IQF Strawberries, Grown and Frozen in Egypt
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-200">
            A single, fully integrated operation — from our own nurseries to export-ready IQF, in Damietta, Egypt.
          </p>
        </div>
      </section>

      {/* Stat band */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { value: String(factories.length || 2), label: "Purpose-built IQF facilities" },
          { value: totalCapacity ? `${totalCapacity.toFixed(1)}` : "9.1", label: "Tons / hour freezing capacity" },
          { value: "16", label: "International accreditations" },
          { value: "0", label: "Chemical residue (zero MRL)" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-5 text-center">
            <p className="text-3xl font-semibold text-emerald-800">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </section>

      {/* One partner, accountable for every stage */}
      <section>
        <SectionKicker>What Makes Us Different</SectionKicker>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">One partner, accountable for every stage</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Vertically Integrated",
              body: "From nursery propagation to export-ready IQF, we are one operation, not a chain of hand-offs — one standard, no handoffs.",
            },
            {
              title: "Zero MRL, By Design",
              body: "Chemical-free cultivation practices with no detectable residue — clearing thresholds in the EU, UK, and beyond.",
            },
            {
              title: "Biological Pest Control",
              body: "Beneficial insects and biological methods protect the crop without pesticides — safeguarding the soil, and your brand.",
            },
            {
              title: "Twin IQF Facilities",
              body: "Two purpose-built plants engineered for volume, consistency, and complete batch-level traceability.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Growing Operation */}
      <section>
        <SectionKicker>The Growing Operation</SectionKicker>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Cultivated on our own land, to our own standard</h2>
        <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Every plant begins with us</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Propagation starts in our own nursery and entomology laboratories, tunnels transplanted into our own
                managed nursery beds, and long-tracing genetics decided in-house — never outsourced.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Compliance is grown in, not inspected in</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Zero-MRL cultivation and biological pest control are applied from the first day in the ground. By
                harvest, the fruit already meets the thresholds your auditors will test for.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <img src="/our-process/nursery-tunnel.jpg" alt="Nursery propagation tunnel" className="h-40 w-full rounded-md object-cover" />
            <img src="/our-process/hands-seedlings.jpg" alt="Hand-tending seedlings" className="h-40 w-full rounded-md object-cover" />
            <img src="/our-process/frozen-berries-bin.jpg" alt="Frozen strawberries" className="h-40 w-full rounded-md object-cover" />
            <img src="/our-process/propagation-rows.jpg" alt="Strawberry propagation rows under tunnel" className="h-40 w-full rounded-md object-cover" />
          </div>
        </div>
      </section>

      {/* Unbroken custody timeline */}
      <section className="rounded-lg bg-emerald-950 p-8 text-white">
        <SectionKicker light>Quality You Can Audit</SectionKicker>
        <h2 className="mt-2 text-2xl font-semibold">Unbroken custody, from pre-nucleus to frozen</h2>
        <p className="mt-2 max-w-2xl text-sm text-emerald-100">
          Traceability is not a review we conduct — it is the way the operation is built. Every carton traces to a
          field, a harvest date, and a production batch.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {PROCESS_STEPS.map((s) => (
            <div key={s.n}>
              <p className="text-xs font-semibold text-emerald-400">{s.n}</p>
              <h3 className="mt-1 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-emerald-200">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Twin IQF Facilities */}
      <section>
        <SectionKicker>Production</SectionKicker>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Twin IQF facilities</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {factories.map((f) => {
            const blurb = (f.code && FACTORY_BLURB[f.code]) || {
              title: f.name,
              lines: ["Fully enclosed cabin-plant line with metal detection and EC verification on every batch."],
            };
            return (
              <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">{blurb.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {f.name} · JBT Freezing Tunnel · {f.capacityTonnesPerHour} t/hr
                </p>
                <ul className="mt-3 space-y-1.5">
                  {blurb.lines.map((line) => (
                    <li key={line} className="text-xs leading-relaxed text-slate-600">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inside the Operation gallery */}
      <section>
        <SectionKicker>Inside the Operation</SectionKicker>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Farms and facilities, as your auditors would find them</h2>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["aerial-orchards.jpg", "Aerial view of the farm complex"],
            ["facility-exterior.jpg", "Plant exterior and utilities"],
            ["cold-storage-racking.jpg", "Cold-store racking"],
            ["processing-hall.jpg", "Pre-cooling / in-feed hall"],
            ["forklifts.jpg", "Materials handling"],
            ["iqf-line.jpg", "The IQF line"],
          ].map(([src, alt]) => (
            <img key={src} src={`/our-process/${src}`} alt={alt} className="h-36 w-full rounded-md object-cover sm:h-44" />
          ))}
        </div>
      </section>

      {/* Product Range */}
      <section>
        <SectionKicker>The Product Range</SectionKicker>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">A specification for every application</h2>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Whole · Diced · Sliced</p>
        <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <img src="/our-process/frozen-berries-bin.jpg" alt="Frozen strawberries" className="h-64 w-full rounded-md object-cover" />
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <tbody>
                {PRODUCT_SPECS.map((row, i) => (
                  <tr key={row.format} className={i > 0 ? "border-t border-slate-100" : undefined}>
                    <td className="bg-slate-50 px-4 py-3 font-medium text-slate-900">{row.format}</td>
                    <td className="px-4 py-3 text-slate-600">{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400">
              Custom calibrations and cut specifications are available on request for volume programs.
            </p>
          </div>
        </div>
      </section>

      {/* Optical sorting + Packing */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <SectionKicker>Screening</SectionKicker>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Optical sorting + metal detection</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            A Tomra camera-based optical sorter removes defects and foreign material before every batch passes
            through metal detection and EC verification — screening precision few competitors can match.
          </p>
          <img src="/our-process/optical-sorter.jpg" alt="Tomra optical sorter" className="mt-4 h-48 w-full rounded-md border border-slate-200 bg-white object-contain p-4" />
        </div>
        <div>
          <SectionKicker>Packing &amp; Formats</SectionKicker>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">From 28 kg bulk to shelf-ready retail</h2>
          <div className="mt-3 space-y-3">
            {PACK_FORMATS.map((p) => (
              <div key={p.name} className="flex gap-3 rounded-md border border-slate-200 bg-white p-3">
                <span className="shrink-0 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{p.size}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* People & Hygiene */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <SectionKicker>People &amp; Hygiene</SectionKicker>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">An on-site clinic protects our teams — and your product</h2>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Year-round health screening</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                All de-capping and factory personnel are tested regularly for communicable illnesses, including
                Norovirus and Hepatitis A — a continuing program, not a hiring-day formality.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Intervention before risk reaches the line</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Any employee showing symptoms is referred immediately to the in-house clinic and cleared before
                returning to production — keeping risk away from the floor entirely.
              </p>
            </div>
          </div>
        </div>
        <img src="/our-process/clinic.jpg" alt="The on-site clinic" className="h-full min-h-56 w-full rounded-lg object-cover" />
      </section>

      {/* Accreditations */}
      <section>
        <SectionKicker>International Accreditations</SectionKicker>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sixteen certifications. One standard of proof.</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          The program is audited continuously against the world&apos;s leading agricultural, food-safety, and
          ethical-trade standards.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {ACCREDITATIONS.map((g) => (
            <div key={g.group}>
              <h3 className="text-sm font-semibold text-slate-900">{g.group}</h3>
              <ul className="mt-2 space-y-1.5">
                {g.items.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <span className="mt-0.5 text-emerald-700">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Global reach */}
      <section className="relative -mx-8 overflow-hidden">
        <img src="/our-process/facility-aerial.jpg" alt="Aerial view of the facility complex" className="h-72 w-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 flex flex-col justify-center px-10">
          <SectionKicker light>Supplying Quality to the World</SectionKicker>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold text-white">
            A supplier the world&apos;s most demanding buyers return to
          </h2>
          <div className="mt-5 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["A Global Client Base", "Retailers, foodservice groups, and manufacturers across Europe, the Americas, China, and beyond."],
              ["Consistency at Scale", "The same specification, shipment after shipment, season after season."],
              ["Traceability on Demand", "Any carton, traced to field of origin and processing date, on request."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-200">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionKicker({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={
        "text-xs font-semibold uppercase tracking-[0.2em] " + (light ? "text-emerald-400" : "text-emerald-700")
      }
    >
      {children}
    </p>
  );
}
