"use client";

import { useMemo, useState } from "react";
import { classifyOffer, classifyReceipt } from "../domain/classify.mjs";
import type { GardenOffer } from "../sanity/data";

type Stage = "all" | "seed" | "sprout" | "bloom" | "wilt";
const money = (amount?: { value: number; asset: string }) => amount ? `${amount.value} ${amount.asset}` : "Amount not recorded";
const stageLabel: Record<string, string> = { seed: "Seed", sprout: "Sprout", bloom: "Bloom", wilt: "Closed" };

function Petal({ stage }: { stage: string }) {
  return <span aria-hidden="true" className={`petal petal-${stage}`}><i /><i /><i /><i /><b /></span>;
}

export function Garden({ mode, offers, note }: { mode: string; offers: GardenOffer[]; note?: string }) {
  const [filter, setFilter] = useState<Stage>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(offers[1]?._id ?? offers[0]?._id ?? "");
  const classified = useMemo(() => offers.map((offer) => ({ offer, result: classifyOffer(offer) })), [offers]);
  const visible = classified.filter(({ offer, result }) => (filter === "all" || result.stage === filter)
    && `${offer.title} ${offer.buyerAlias ?? ""} ${offer.scopeSummary ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const selected = classified.find(({ offer }) => offer._id === selectedId) ?? visible[0] ?? classified[0];
  const counts = { seed: 0, sprout: 0, bloom: 0, wilt: 0 };
  classified.forEach(({ result }) => { counts[result.stage as keyof typeof counts]++; });
  const demo = mode === "local-demo";

  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="/"><span className="brand-mark">✿</span><span>receipt garden<small>evidence, then earnings</small></span></a>
      <div className="top-actions"><span className={`mode-tag ${mode}`}>{demo ? "LOCAL SYNTHETIC DEMO" : mode === "sanity-public" ? "SANITY BUILD SNAPSHOT" : "SANITY READ ERROR"}</span><a className="studio-link" href="/studio">Open Studio <span>↗</span></a></div>
    </header>

    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">A SMALL DESK FOR PROOF</span><h1>Let each claim<br /><em>earn its flower.</em></h1><p>Offers are seeds. Delivered work puts down roots. Only independent approval and a verified customer receipt make a bloom.</p><div className="hero-note"><span className="note-dot" /> No currency conversion. No test counted as a sale.</div></div>
      <div className="hero-illustration" aria-hidden="true"><div className="sun-disc" /><div className="stem stem-one"><i /><i /><b /></div><div className="stem stem-two"><i /><i /><b /></div><div className="ground" /><span className="float-label label-one">source</span><span className="float-label label-two">review</span><span className="float-label label-three">receipt</span></div>
    </section>

    <div className={`demo-banner ${mode}`}><span className="banner-icon">{demo ? "◇" : mode === "sanity-public" ? "↗" : "!"}</span><div><strong>{demo ? "Fictional sample garden" : mode === "sanity-public" ? "Snapshot of published Sanity content" : "Sanity read unavailable"}</strong><p>{demo ? "Every offer, reviewer, and receipt below is synthetic. The flower demonstrates logic; it is not income or a real payment." : mode === "sanity-public" ? "These synthetic records were captured when this site was built. Studio changes require a rebuild and redeploy to appear here." : note}</p></div><span className="banner-side">{demo ? `${offers.length} OFFERS` : mode === "sanity-public" ? `${offers.length} OFFERS` : "CHECK SETUP"}</span></div>

    <section className="metrics" aria-label="Garden summary">
      <article className="metric"><span className="metric-kicker">OPEN SCOPES</span><strong>{counts.seed + counts.sprout}</strong><span>not at receipt stage</span></article>
      <article className="metric"><span className="metric-kicker">DELIVERY ROOTS</span><strong>{counts.sprout + counts.bloom}</strong><span>evidence attached</span></article>
      <article className="metric bloom-metric"><span className="metric-kicker">FLOWER SCENARIOS</span><strong>{counts.bloom}</strong><span>synthetic demo only</span></article>
      <article className="metric"><span className="metric-kicker">REAL INCOME</span><strong>—</strong><span>no real money imported</span></article>
    </section>

    <section className="workspace">
      <div className="list-panel">
        <div className="panel-heading"><div><span className="eyebrow">THE PLOTS</span><h2>Offer board <span>{visible.length.toString().padStart(2, "0")}</span></h2></div><a href="/studio" className="add-note">Curate in Studio <b>↗</b></a></div>
        <div className="toolbar"><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an offer or evidence" aria-label="Search offers" /></label><div className="filters" aria-label="Filter by stage">{(["all", "seed", "sprout", "bloom", "wilt"] as Stage[]).map((stage) => <button key={stage} className={filter === stage ? "filter active" : "filter"} onClick={() => setFilter(stage)}>{stage === "all" ? "All" : stageLabel[stage]}</button>)}</div></div>
        <div className="offer-list">{visible.map(({ offer, result }, index) => <button key={offer._id} className={`offer-card ${selected?.offer._id === offer._id ? "selected" : ""}`} onClick={() => setSelectedId(offer._id)}>
          <span className="card-index">{String(index + 1).padStart(2, "0")}</span><Petal stage={result.stage} /><span className="card-main"><span className="card-title">{offer.title}</span><span className="card-by">{offer.buyerAlias ?? "Pseudonymous buyer"} <i>·</i> {money(offer.amount)}</span></span><span className={`stage-chip ${result.stage}`}>{stageLabel[result.stage]}</span><span className="card-chevron">›</span>
        </button>)}{visible.length === 0 && <div className="empty-state">No plot matches this filter. Try another stage or search.</div>}</div>
        <div className="garden-legend"><span><i className="legend-seed" /> Seed <small>accepted scope needed</small></span><span><i className="legend-sprout" /> Sprout <small>review or receipt missing</small></span><span><i className="legend-bloom" /> Bloom <small>all gates documented</small></span></div>
      </div>

      <aside className="detail-panel">{selected ? <>
        <div className="detail-top"><span className="eyebrow">PLOT INSPECTOR</span><span className={`stage-chip ${selected.result.stage}`}>{stageLabel[selected.result.stage]}</span></div>
        <div className="detail-flower"><Petal stage={selected.result.stage} /><span>{selected.result.stage === "bloom" ? selected.result.synthetic ? "Demo bloom" : "Receipt confirmed" : selected.result.stage === "sprout" ? "Waiting on proof" : selected.result.stage === "seed" ? "Scope is a seed" : "Closed plot"}</span></div>
        <h2>{selected.offer.title}</h2><p className="detail-scope">{selected.offer.scopeSummary}</p>
        <div className="amount-row"><span>AGREED AMOUNT</span><strong>{money(selected.offer.amount)}</strong></div>
        <div className="path-title"><span className="eyebrow">PROOF PATH</span><span className="path-count">{selected.result.stage === "bloom" ? "4 / 4" : `${selected.offer.deliveredEvidence ? "2" : "1"} / 4`}</span></div>
        <ol className="proof-path">
          <li className="done"><span className="path-marker">01</span><span><b>Offer captured</b><small>{selected.offer.status === "accepted" ? "Paid scope marked accepted" : "No accepted paid scope"}</small></span><i>{selected.offer.status === "accepted" ? "✓" : "·"}</i></li>
          <li className={selected.offer.deliveredEvidence ? "done" : "pending"}><span className="path-marker">02</span><span><b>Delivery evidence</b><small>{selected.offer.evidence[0]?.title ?? "No delivery attached"}</small></span><i>{selected.offer.deliveredEvidence ? "✓" : "○"}</i></li>
          <li className={selected.offer.buyerReview?.status === "approved" && selected.offer.buyerReview.independent ? "done" : "pending"}><span className="path-marker">03</span><span><b>Independent review</b><small>{selected.offer.buyerReview?.status === "approved" ? selected.offer.buyerReview.reviewerAlias ?? "Approval logged" : "Approval not verified"}</small></span><i>{selected.offer.buyerReview?.status === "approved" && selected.offer.buyerReview.independent ? "✓" : "○"}</i></li>
          <li className={selected.result.stage === "bloom" ? "done" : "pending"}><span className="path-marker">04</span><span><b>Matching receipt</b><small>{selected.offer.receipts[0] ? `${selected.offer.receipts[0].kind.replaceAll("_", " ")} · ${selected.offer.receipts[0].amount ? money(selected.offer.receipts[0].amount) : "amount not recorded"}` : "No receipt linked"}</small></span><i>{selected.result.stage === "bloom" ? "✓" : "○"}</i></li>
        </ol>
        <div className="classification"><span className="class-mark">{selected.result.stage === "bloom" ? "✿" : "◇"}</span><div><b>{selected.result.stage === "bloom" ? selected.result.synthetic ? "Scenario passes; not income" : "Receipt gates passed" : "What is still missing"}</b><small>{selected.result.reasons.join(" · ")}</small></div></div>
        {selected.offer.receipts.map((receipt, index) => { const result = classifyReceipt(receipt); return <div className="receipt-callout" key={`${selected.offer._id}-receipt-${index}`}><span>RECEIPT CLASSIFIER</span><strong>{result.eligible ? result.synthetic ? "Synthetic verified example" : result.countedAsIncome ? "Verified customer receipt" : "Excluded" : "Not eligible"}</strong><small>{result.eligible ? result.synthetic ? "Fixture only. The demo never counts this as real earnings." : "Native asset and amount retained; no conversion." : result.reasons.join(" · ")}</small></div>; })}
      </> : <div className="empty-state">Select a plot to inspect its evidence.</div>}</aside>
    </section>

    <section className="rules-strip"><div><span className="eyebrow">THE GARDEN RULE</span><h2>One receipt is a claim.<br /><em>Its path is the proof.</em></h2></div><div className="rule-copy"><p>Never collapse proposal, acceptance, delivery, review, and payment into one status. Each record references its evidence and carries a source fingerprint, capture time, and provenance note.</p><p>Internal tests, prepaid balances, platform credits, awards, and operator-to-operator transfers stay visible—but never become customer income.</p></div><a href="/studio" className="rules-link">See the schema <span>↗</span></a></section>

    <footer className="footer"><span>RECEIPT GARDEN <i>·</i> PATH 2 BUILD</span><span>Synthetic fixture only · no real buyers, payments, or private records</span><a href="https://www.sanity.io/docs/nextjs" target="_blank" rel="noreferrer">Built with Sanity <span>↗</span></a></footer>
  </main>;
}
