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

  const STATS = [
    { value: String(factories.length || 2), label: "Purpose-built IQF facilities" },
    { value: totalCapacity ? totalCapacity.toFixed(1) : "9.1", label: "Tons / hour freezing capacity" },
    { value: "16", label: "International accreditations" },
    { value: "0", label: "Chemical residue (zero MRL)" },
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
          <Eyebrow light>Magrabi Agriculture</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-[42px]">
            Premium IQF Strawberries, Grown and Frozen in Egypt
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-200">
            A single, fully integrated operation — from our own nurseries to export-ready IQF, in Damietta, Egypt.
          </p>
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
      <Section eyebrow="What Makes Us Different" heading="One partner, accountable for every stage">
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* The Growing Operation */}
      <Section eyebrow="The Growing Operation" heading="Cultivated on our own land, to our own standard">
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Every plant begins with us</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Propagation starts in our own nursery and entomology laboratories, tunnels transplanted into our own
                managed nursery beds, and long-tracing genetics decided in-house — never outsourced.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Compliance is grown in, not inspected in</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Zero-MRL cultivation and biological pest control are applied from the first day in the ground. By
                harvest, the fruit already meets the thresholds your auditors will test for.
              </p>
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
        <Eyebrow light>Quality You Can Audit</Eyebrow>
        <h2 className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[34px]">
          Unbroken custody, from pre-nucleus to frozen
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-100">
          Traceability is not a review we conduct — it is the way the operation is built. Every carton traces to a
          field, a harvest date, and a production batch.
        </p>
        <ol className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {PROCESS_STEPS.map((s, i) => (
            <li key={s.n} className="relative border-t-2 border-emerald-700 pt-4">
              {i > 0 && <span className="absolute -left-3 top-0 hidden h-0.5 w-3 bg-emerald-700 lg:block" aria-hidden />}
              <p className="font-mono text-xs font-semibold tracking-wider text-emerald-400">{s.n}</p>
              <h3 className="mt-1.5 text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-emerald-200">{s.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Twin IQF Facilities */}
      <Section eyebrow="Production" heading="Twin IQF facilities">
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {factories.map((f) => {
            const blurb = (f.code && FACTORY_BLURB[f.code]) || {
              title: f.name,
              lines: ["Fully enclosed cabin-plant line with metal detection and EC verification on every batch."],
            };
            return (
              <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">{blurb.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {f.name} · JBT Freezing Tunnel · {f.capacityTonnesPerHour} t/hr
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
      <Section eyebrow="Inside the Operation" heading="Farms and facilities, as your auditors would find them">
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["aerial-orchards.jpg", "Aerial view of the farm complex"],
            ["facility-exterior.jpg", "Plant exterior and utilities"],
            ["cold-storage-racking.jpg", "Cold-store racking"],
            ["processing-hall.jpg", "Pre-cooling / in-feed hall"],
            ["forklifts.jpg", "Materials handling"],
            ["iqf-line.jpg", "The IQF line"],
          ].map(([src, alt]) => (
            <img key={src} src={`/our-process/${src}`} alt={alt} className="h-36 w-full rounded-xl object-cover sm:h-44" />
          ))}
        </div>
      </Section>

      {/* Product Range */}
      <Section eyebrow="The Product Range" heading="A specification for every application" sub="Whole · Diced · Sliced">
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-stretch">
          <img src="/our-process/frozen-berries-bin.jpg" alt="Frozen strawberries" className="h-64 w-full rounded-xl object-cover lg:h-full" />
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <tbody>
                {PRODUCT_SPECS.map((row, i) => (
                  <tr key={row.format} className={i > 0 ? "border-t border-slate-100" : undefined}>
                    <td className="bg-slate-50 px-5 py-4 font-medium text-slate-900">{row.format}</td>
                    <td className="px-5 py-4 text-slate-600">{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-400">
              Custom calibrations and cut specifications are available on request for volume programs.
            </p>
          </div>
        </div>
      </Section>

      {/* Optical sorting + Packing */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-16 border-t border-slate-200 pt-16 lg:grid-cols-2">
        <div>
          <Eyebrow>Screening</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-slate-900">
            Optical sorting + metal detection
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            A Tomra camera-based optical sorter removes defects and foreign material before every batch passes
            through metal detection and EC verification — screening precision few competitors can match.
          </p>
          <img
            src="/our-process/optical-sorter.jpg"
            alt="Tomra optical sorter"
            className="mt-5 h-48 w-full rounded-xl border border-slate-200 bg-white object-contain p-4"
          />
        </div>
        <div>
          <Eyebrow>Packing &amp; Formats</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-slate-900">
            From 28 kg bulk to shelf-ready retail
          </h2>
          <div className="mt-5 space-y-3">
            {PACK_FORMATS.map((p) => (
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
          <Eyebrow>People &amp; Hygiene</Eyebrow>
          <h2 className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-[32px]">
            An on-site clinic protects our teams — and your product
          </h2>
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Year-round health screening</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                All de-capping and factory personnel are tested regularly for communicable illnesses, including
                Norovirus and Hepatitis A — a continuing program, not a hiring-day formality.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Intervention before risk reaches the line</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Any employee showing symptoms is referred immediately to the in-house clinic and cleared before
                returning to production — keeping risk away from the floor entirely.
              </p>
            </div>
          </div>
        </div>
        <img src="/our-process/clinic.jpg" alt="The on-site clinic" className="h-full min-h-64 w-full rounded-xl object-cover" />
      </div>

      {/* Accreditations */}
      <Section
        eyebrow="International Accreditations"
        heading="Sixteen certifications. One standard of proof."
        sub="The program is audited continuously against the world's leading agricultural, food-safety, and ethical-trade standards."
      >
        <div className="mt-8 grid grid-cols-1 gap-6 rounded-2xl border border-slate-200 bg-white p-8 sm:grid-cols-3">
          {ACCREDITATIONS.map((g) => (
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
          <Eyebrow light>Supplying Quality to the World</Eyebrow>
          <h2 className="mt-4 max-w-xl text-2xl font-semibold leading-[1.15] tracking-tight text-white sm:text-[30px]">
            A supplier the world&apos;s most demanding buyers return to
          </h2>
          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              ["A Global Client Base", "Retailers, foodservice groups, and manufacturers across Europe, the Americas, China, and beyond."],
              ["Consistency at Scale", "The same specification, shipment after shipment, season after season."],
              ["Traceability on Demand", "Any carton, traced to field of origin and processing date, on request."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{body}</p>
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
