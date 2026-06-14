import Image from 'next/image';

const testimonials = [
  {
    name: "Muhammad Emirsyah Makarim",
    profession: "Chief Technology Officer",
    description: "Lumen has completely changed how our candidates prepare. The detailed breakdown of delivery and non-verbal cues helps them shine before they even step into the interview room.",
    avatar: "/testi-user/emir.jpeg",
    companyLogo: "/testi-company/adacareer.png",
    logoHeightClass: "h-11",
  },
  {
    name: "Resan So",
    profession: "Founder",
    description: "We use Lumen to standardize our mock interviews. The AI feedback on content alignment and STAR methodology is incredibly accurate and saves us countless hours.",
    avatar: "/testi-user/sanzo.webp",
    companyLogo: "/testi-company/mentio.png",
    invertLogo: true,
  },
  {
    name: "Ardava Barus",
    profession: "Lead",
    description: "As a lead, I'm always looking for ways to improve our team's communication. Lumen provides quantified insights that are actionable, not just generic advice.",
    avatar: "/testi-user/ardava.png",
    companyLogo: "/testi-company/prodigi.png",
  },
  {
    name: "M. Hafizh Alkautsar",
    profession: "Founder & Chief Executive Officer",
    description: "The per-question analysis showed me exactly where I hesitated and used filler words. Practicing with Lumen gave me the confidence to ace my final rounds.",
    avatar: "/testi-user/hafizh.jpg",
    companyLogo: "/testi-company/eira.png",
    logoHeightClass: "h-11",
  },
  {
    name: "Dian Fajar Indriana",
    profession: "Director of Marketing Communication",
    description: "Lumen's AI-driven feedback on speech clarity and delivery pacing has been instrumental in training our communication teams to pitch effectively and confidently.",
    avatar: "/testi-user/dian.png",
    companyLogo: "/testi-company/mc-smb.png",
    logoHeightClass: "h-14",
  },
  {
    name: "Nauval Yusriya Athalla",
    profession: "Data Analyst",
    description: "Lumen transforms the subjective interview process into objective, measurable data. The quantified metrics on my delivery let me pinpoint exactly what to improve.",
    avatar: "/testi-user/nauval.jpg",
    companyLogo: "/testi-company/ojk.png",
    logoHeightClass: "h-10",
  },
  {
    name: "Guidomelvin",
    profession: "Community Ambassador",
    description: "Practicing with Lumen's simulated pressure feels exactly like clutch moments in high-stakes gaming. It helped me translate quick reflexes into structured, confident responses.",
    avatar: "/testi-user/Jewdomelvin.jpg",
    companyLogo: "/testi-company/nothing.png",
    logoHeightClass: "h-10",
  },
  {
    name: "Nabiel Muhammad Irfani",
    profession: "Product Manager",
    description: "Using Lumen to simulate product management interviews gave me the precise feedback I needed on my communication style and framework structuring. It's an absolute game changer.",
    avatar: "/testi-user/nabil.png",
    companyLogo: "/testi-company/mandiri-in-health.png",
  },
];
const duplicatedTestimonials = [...testimonials, ...testimonials];

const FUITestimonialWithSlide = () => {
  return (
    <div className='w-full -mt-16'>
      <div className="w-full mx-auto px-10">
        <div className='mb-16'>
          <p className="max-w-2xl mx-auto text-center text-[48px] lg:text-[56px] font-black font-semibold leading-tight tracking-[-2px] text-slate-900">
            What our users say
          </p>
          <p className="mt-4 max-w-xl mx-auto text-lg text-center tracking-tight text-slate-500">
            Hundreds of candidates and hiring managers use Lumen to quantify interview performance and deliver actionable coaching.
          </p>
        </div>
        <div style={{
            maskImage: 'linear-gradient(to left, transparent 0%, black 20%, black 80%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to left, transparent 0%, black 20%, black 80%, transparent 95%)'
          }} 
          className="flex relative overflow-hidden shrink-0 max-w-full">
          <div className="flex animate-x-slider gap-5 w-max hover:[animation-play-state:paused]">
            {duplicatedTestimonials.map((testimonial, indx) => {
              return (
                <div key={indx} className="border-[1.2px] flex flex-col bg-white border-slate-100 rounded-2xl shrink-0 grow-0 w-[500px] h-full shadow-sm transition-all duration-300 hover:shadow-lg">
                  <p className="px-7 py-7 text-pretty text-lg font-normal text-slate-700 leading-relaxed tracking-tight">
                    &quot;{testimonial.description}&quot;
                  </p>
                  <div className="border-t border-slate-50 w-full flex gap-1 overflow-hidden mt-auto">
                    <div className="w-3/4 flex gap-3 items-center px-6 py-4">
                      <Image src={testimonial.avatar} alt='avatar' width={40} height={40} className="rounded-full object-cover shrink-0 w-10 h-10" />
                      <div className='flex flex-col flex-1 gap-0 justify-center items-start'>
                        <h5 className='text-[15px] font-bold text-slate-900'>{testimonial.name}</h5>
                        <p className='text-slate-500 mt-[-2px] text-[13px]'>{testimonial.profession}</p>
                      </div>
                    </div>
                    <div className='w-[1px] bg-slate-100' />
                    <div className='flex-1 flex justify-center items-center p-2'>
                      <Image 
                        src={testimonial.companyLogo} 
                        alt='company logo' 
                        width={120}
                        height={60}
                        className={`object-contain w-auto opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all ${testimonial.logoHeightClass || 'h-8'} ${testimonial.invertLogo ? 'invert' : ''}`} 
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
export default FUITestimonialWithSlide;
