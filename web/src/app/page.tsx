import Hero from '@/components/Hero';
import StatsStrip from '@/components/StatsStrip';
import FeatureGrid from '@/components/FeatureGrid';

export default function Home() {
  return (
    <div className="space-y-10">
      <Hero />

      {/** Stats **/}
      <StatsStrip />

      {/** Features **/}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Take full control of your crypto</h2>
        <FeatureGrid />
      </div>
    </div>
  );
}
