import HomeHeroSection from "./_components/hero-section";
import WorkWith from "./_components/partners-marquee";
import HowItWorks from "./_components/how-it-works";
import Testimonies from "./_components/trust-section";
import WhyChooseUs from "./_components/why-choose-us";
import CTA from "./_components/cta-section";

export default function Home() {
  return (
    <div className="flex flex-col">
      <HomeHeroSection />
      <WorkWith />
      <HowItWorks />
      <Testimonies />
      <WhyChooseUs />
      <CTA />
    </div>
  );
}
