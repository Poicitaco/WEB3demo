export default function PageIntro({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <div className="page-intro">
      <div className="page-kicker intro-part">{kicker}</div>
      <h1 className="page-title intro-part">{title}</h1>
      <p className="page-copy intro-part">{copy}</p>
    </div>
  );
}
